import { KnowledgeBaseService } from './KnowledgeBaseService.js';
import {
  ContextResult,
  RAGOptions
} from '../types/knowledgeBase.js';

/**
 * Enhanced service to handle Retrieval-Augmented Generation (RAG) with multiple knowledge bases.
 * It enriches user prompts with relevant context from selected knowledge bases,
 * providing more organized and topic-specific information retrieval.
 */
export class RAGService {
  private static instance: RAGService;
  private knowledgeBaseService: KnowledgeBaseService;

  private constructor() {
    this.knowledgeBaseService = KnowledgeBaseService.getInstance();
  }

  /**
   * Gets the singleton instance of the RAGService.
   * @returns {RAGService} The singleton instance.
   */
  public static getInstance(): RAGService {
    if (!RAGService.instance) {
      RAGService.instance = new RAGService();
    }
    return RAGService.instance;
  }

  /**
   * Augments a user prompt with relevant context from multiple selected knowledge bases.
   * @param prompt - The original user prompt.
   * @param knowledgeBaseIds - Array of knowledge base IDs to search.
   * @param options - RAG options for controlling search behavior.
   * @returns Promise resolving to the augmented prompt with context.
   */
  public async augmentPromptWithMultipleKnowledgeBases(
    prompt: string,
    knowledgeBaseIds: string[],
    options: RAGOptions = {
      maxResultsPerKB: 3,
      relevanceThreshold: 0.1,
      includeSourceAttribution: true,
      contextWindowTokens: 2000,
      aggregationStrategy: 'relevance'
    }
  ): Promise<string> {
    if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) {
      return prompt; // No knowledge bases selected
    }

    try {
      const searchResults = await this.knowledgeBaseService.searchMultipleKnowledgeBases(
        knowledgeBaseIds,
        prompt,
        {
          maxResultsPerKB: options.maxResultsPerKB,
          relevanceThreshold: options.relevanceThreshold,
          includeSourceAttribution: options.includeSourceAttribution,
          contextWindowTokens: options.contextWindowTokens
        }
      );

      if (searchResults.length === 0) {
        return prompt; // No relevant context found
      }

      // Convert to context results
      const contextResults: ContextResult[] = searchResults.map(r => ({
        text: r.text,
        source: r.source,
        knowledgeBaseName: r.knowledgeBaseName,
        knowledgeBaseId: r.knowledgeBaseId,
        relevanceScore: r.relevanceScore,
        chunkIndex: r.chunkIndex,
        documentId: r.documentId,
        metadata: r.metadata
      }));

      return this.formatContextForPrompt(contextResults, prompt, options);
    } catch (error) {
      console.error('Error in multi-KB RAG augmentation:', error);
      return prompt; // Return original prompt on error
    }
  }

  /**
   * Legacy method for backward compatibility - augments prompt with default knowledge base.
   * @param prompt - The original user prompt.
   * @returns Promise resolving to the augmented prompt.
   */
  public async augmentPromptWithContext(prompt: string): Promise<string> {
    try {
      // Get available knowledge bases and use all of them for backward compatibility
      const availableKBs = await this.knowledgeBaseService.getAvailableKnowledgeBases();
      
      if (availableKBs.length === 0) {
        return prompt;
      }

      // Use default knowledge base or first available one
      const defaultKB = availableKBs.find(kb => kb.isDefault) || availableKBs[0];
      
      return await this.augmentPromptWithMultipleKnowledgeBases(
        prompt,
        [defaultKB.id],
        {
          maxResultsPerKB: 3,
          relevanceThreshold: 0.1,
          includeSourceAttribution: true,
          contextWindowTokens: 2000,
          aggregationStrategy: 'relevance'
        }
      );
    } catch (error) {
      console.error('Error in legacy RAG augmentation:', error);
      return prompt;
    }
  }

  /**
   * Gets relevant context from multiple knowledge bases without formatting.
   * @param query - The search query.
   * @param knowledgeBaseIds - Array of knowledge base IDs to search.
   * @param options - RAG options for controlling search behavior.
   * @returns Promise resolving to array of context results.
   */
  public async getRelevantContext(
    query: string,
    knowledgeBaseIds: string[],
    options: RAGOptions = {
      maxResultsPerKB: 5,
      relevanceThreshold: 0.1,
      includeSourceAttribution: true,
      contextWindowTokens: 2000,
      aggregationStrategy: 'relevance'
    }
  ): Promise<ContextResult[]> {
    if (!knowledgeBaseIds || knowledgeBaseIds.length === 0) {
      return [];
    }

    try {
      const searchResults = await this.knowledgeBaseService.searchMultipleKnowledgeBases(
        knowledgeBaseIds,
        query,
        {
          maxResultsPerKB: options.maxResultsPerKB,
          relevanceThreshold: options.relevanceThreshold,
          includeSourceAttribution: options.includeSourceAttribution,
          contextWindowTokens: options.contextWindowTokens
        }
      );

      return searchResults.map(r => ({
        text: r.text,
        source: r.source,
        knowledgeBaseName: r.knowledgeBaseName,
        knowledgeBaseId: r.knowledgeBaseId,
        relevanceScore: r.relevanceScore,
        chunkIndex: r.chunkIndex,
        documentId: r.documentId,
        metadata: r.metadata
      }));
    } catch (error) {
      console.error('Error getting relevant context:', error);
      return [];
    }
  }

  /**
   * Formats context results into a properly structured prompt.
   * @param contextResults - Array of context results.
   * @param originalPrompt - The original user prompt.
   * @param options - RAG options.
   * @returns The formatted prompt with context.
   */
  private formatContextForPrompt(
    contextResults: ContextResult[],
    originalPrompt: string,
    options: RAGOptions
  ): string {
    if (contextResults.length === 0) {
      return originalPrompt;
    }

    // Group results by knowledge base for better organization
    const resultsByKB = new Map<string, ContextResult[]>();
    
    contextResults.forEach(result => {
      if (!resultsByKB.has(result.knowledgeBaseId)) {
        resultsByKB.set(result.knowledgeBaseId, []);
      }
      resultsByKB.get(result.knowledgeBaseId)!.push(result);
    });

    // Build context sections
    const contextSections: string[] = [];
    let contextHeader: string;

    if (resultsByKB.size === 1) {
      // Single knowledge base
      const kbName = contextResults[0].knowledgeBaseName;
      contextHeader = `Use the following context from ${kbName} to answer the question below:`;
      
      const contexts = contextResults.map((r, i) => {
        const sourceInfo = options.includeSourceAttribution ? ` [Source: ${r.source}]` : '';
        return `${i + 1}. ${r.text}${sourceInfo}`;
      });
      
      contextSections.push(contexts.join('\n\n'));
    } else {
      // Multiple knowledge bases - organize by KB
      contextHeader = `Use the following context from ${resultsByKB.size} knowledge base(s) to answer the question below:`;
      
      for (const [, results] of resultsByKB.entries()) {
        const kbName = results[0].knowledgeBaseName;
        const kbContexts = results.map((r, i) => {
          const sourceInfo = options.includeSourceAttribution ? ` [Source: ${r.source}]` : '';
          return `   ${i + 1}. ${r.text}${sourceInfo}`;
        });
        
        contextSections.push(`**${kbName}:**\n${kbContexts.join('\n\n')}`);
      }
    }

    const contextBlock = contextSections.join('\n\n');
    
    return `${contextHeader}\n\n---\nContext:\n${contextBlock}\n---\n\nQuestion: ${originalPrompt}`;
  }

  /**
   * Analyzes a query to determine if it might require comprehensive search
   * (looks for words like "all", "total", "complete", etc.)
   * @param query - The user query to analyze.
   * @returns Whether the query appears to need comprehensive results.
   */
  public analyzeQueryForComprehensiveSearch(query: string): boolean {
    const comprehensiveKeywords = [
      'all', 'total', 'complete', 'entire', 'everything', 'comprehensive',
      'full', 'every', 'overall', 'summary', 'summarize', 'list all',
      'show all', 'give me all', 'what are all', 'how many total'
    ];
    
    const lowerQuery = query.toLowerCase();
    return comprehensiveKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Gets adaptive RAG options based on query analysis.
   * @param query - The user query.
   * @param baseOptions - Base RAG options to adapt.
   * @returns Adapted RAG options.
   */
  public getAdaptiveRAGOptions(query: string, baseOptions: RAGOptions): RAGOptions {
    const isComprehensive = this.analyzeQueryForComprehensiveSearch(query);
    
    if (isComprehensive) {
      // Increase limits for comprehensive queries
      return {
        ...baseOptions,
        maxResultsPerKB: Math.max(baseOptions.maxResultsPerKB, 5),
        contextWindowTokens: Math.max(baseOptions.contextWindowTokens, 3000),
        aggregationStrategy: 'comprehensive'
      };
    }
    
    return baseOptions;
  }

  /**
   * Estimates the token count of a text string.
   * @param text - The text to estimate tokens for.
   * @returns Estimated token count.
   */
  public estimateTokenCount(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  /**
   * Validates knowledge base IDs exist and are accessible.
   * @param knowledgeBaseIds - Array of knowledge base IDs to validate.
   * @returns Promise resolving to array of valid knowledge base IDs.
   */
  public async validateKnowledgeBaseIds(knowledgeBaseIds: string[]): Promise<string[]> {
    const validIds: string[] = [];
    const availableKBs = await this.knowledgeBaseService.getAvailableKnowledgeBases();
    const availableIds = new Set(availableKBs.map(kb => kb.id));
    
    for (const id of knowledgeBaseIds) {
      if (availableIds.has(id)) {
        validIds.push(id);
      } else {
        console.warn(`Knowledge base with ID "${id}" not found or not accessible`);
      }
    }
    
    return validIds;
  }
}
