/**
 * Memory Context Service for LiteLLM
 * Provides memory-aware conversation enhancements
 */

import { memoryService } from './memoryService';
import { MemoryType, SearchQuery } from '../types/memory';

export interface MemoryContext {
  relevantMemories: Array<{
    id: string;
    type: MemoryType;
    title: string;
    content: string;
    relevanceScore: number;
    tags: string[];
  }>;
  contextSummary: string;
  totalMemories: number;
}

export interface ConversationAnalysis {
  topics: string[];
  intent: string;
  entities: string[];
  memoryTriggers: string[];
  shouldCreateMemory: boolean;
  suggestedMemoryType?: MemoryType;
}

class MemoryContextService {
  private readonly MAX_CONTEXT_MEMORIES = 5;
  private readonly MAX_CONTEXT_LENGTH = 2000; // characters
  private readonly MEMORY_RELEVANCE_THRESHOLD = 0.3;

  /**
   * Analyze user message to extract topics, intent, and memory triggers
   */
  analyzeMessage(message: string, conversationHistory: Array<{role: string, content: string}> = []): ConversationAnalysis {
    const messageText = message.toLowerCase();
    const recentHistory = conversationHistory.slice(-3); // Last 3 messages for context
    
    // Extract topics (simple keyword extraction)
    const topics = this.extractTopics(messageText);
    
    // Determine intent
    const intent = this.determineIntent(messageText);
    
    // Extract entities (names, projects, technologies)
    const entities = this.extractEntities(messageText);
    
    // Identify memory triggers
    const memoryTriggers = this.identifyMemoryTriggers(messageText, recentHistory);
    
    // Determine if we should create a memory
    const shouldCreateMemory = this.shouldCreateMemory(messageText, intent, recentHistory);
    
    // Suggest memory type if we should create one
    const suggestedMemoryType = shouldCreateMemory ? this.suggestMemoryType(messageText, intent) : undefined;

    return {
      topics,
      intent,
      entities,
      memoryTriggers,
      shouldCreateMemory,
      suggestedMemoryType
    };
  }

  /**
   * Get relevant memory context for a conversation
   */
  async getMemoryContext(
    message: string, 
    conversationId?: string, 
    projectId?: string,
    conversationHistory: Array<{role: string, content: string}> = []
  ): Promise<MemoryContext> {
    try {
      const analysis = this.analyzeMessage(message, conversationHistory);
      const searchQueries = this.buildSearchQueries(analysis, conversationId, projectId);
      
      const allMemories: Array<{
        id: string;
        type: MemoryType;
        title: string;
        content: string;
        relevanceScore: number;
        tags: string[];
      }> = [];

      // Execute multiple search queries and combine results
      for (const query of searchQueries) {
        const searchResult = await memoryService.searchMemories({ query });
        
        if (searchResult.success && searchResult.data) {
          for (const result of searchResult.data.results) {
            // Calculate relevance score based on multiple factors
            const relevanceScore = this.calculateRelevanceScore(
              result.entry,
              analysis,
              result.relevanceScore || 1.0
            );

            if (relevanceScore >= this.MEMORY_RELEVANCE_THRESHOLD) {
              allMemories.push({
                id: result.entry.id,
                type: result.entry.type,
                title: result.entry.title,
                content: result.entry.content,
                relevanceScore,
                tags: result.entry.metadata.tags
              });
            }
          }
        }
      }

      // Remove duplicates and sort by relevance
      const uniqueMemories = this.deduplicateMemories(allMemories);
      const sortedMemories = uniqueMemories
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, this.MAX_CONTEXT_MEMORIES);

      // Create context summary
      const contextSummary = this.createContextSummary(sortedMemories);

      return {
        relevantMemories: sortedMemories,
        contextSummary,
        totalMemories: uniqueMemories.length
      };
    } catch (error) {
      console.error('Error getting memory context:', error);
      return {
        relevantMemories: [],
        contextSummary: '',
        totalMemories: 0
      };
    }
  }

  /**
   * Create memory from conversation automatically
   */
  async createMemoryFromConversation(
    userMessage: string,
    aiResponse: string,
    analysis: ConversationAnalysis,
    conversationId?: string,
    projectId?: string
  ): Promise<boolean> {
    if (!analysis.shouldCreateMemory || !analysis.suggestedMemoryType) {
      return false;
    }

    try {
      // Extract key information for memory
      const memoryContent = this.extractMemoryContent(userMessage, aiResponse, analysis);
      const memoryTitle = this.generateMemoryTitle(userMessage, analysis);
      const memoryTags = this.generateMemoryTags(analysis);

      const storeResult = await memoryService.storeMemory({
        type: analysis.suggestedMemoryType,
        title: memoryTitle,
        content: memoryContent,
        tags: memoryTags,
        conversationId,
        projectId,
        source: 'auto_conversation'
      });

      if (storeResult.success) {
        console.log(`🧠 Auto-created memory: ${memoryTitle} (${analysis.suggestedMemoryType})`);
        return true;
      } else {
        console.error('Failed to auto-create memory:', storeResult.error);
        return false;
      }
    } catch (error) {
      console.error('Error creating memory from conversation:', error);
      return false;
    }
  }

  /**
   * Build enhanced system prompt with memory context
   */
  buildMemoryEnhancedPrompt(originalPrompt: string, memoryContext: MemoryContext): string {
    if (memoryContext.relevantMemories.length === 0) {
      return originalPrompt;
    }

    const memorySection = `

🧠 RELEVANT CONTEXT FROM PREVIOUS CONVERSATIONS 🧠

You have access to the following information from previous interactions:

${memoryContext.relevantMemories.map((memory, index) =>
  `• ${memory.content}`
).join('\n')}

Please use this context naturally when relevant to the conversation. You can reference this information when it helps answer questions or provide better assistance.`;

    return originalPrompt + memorySection;
  }

  // Private helper methods
  private extractTopics(message: string): string[] {
    const topics: string[] = [];
    
    // Technology keywords
    const techKeywords = ['react', 'javascript', 'typescript', 'python', 'node', 'api', 'database', 'ui', 'frontend', 'backend'];
    techKeywords.forEach(keyword => {
      if (message.includes(keyword)) topics.push(keyword);
    });

    // Action keywords
    const actionKeywords = ['create', 'build', 'fix', 'debug', 'implement', 'design', 'optimize'];
    actionKeywords.forEach(keyword => {
      if (message.includes(keyword)) topics.push(keyword);
    });

    return Array.from(new Set(topics)); // Remove duplicates
  }

  private determineIntent(message: string): string {
    if (message.includes('prefer') || message.includes('like') || message.includes('want')) {
      return 'preference';
    }
    if (message.includes('how') || message.includes('what') || message.includes('?')) {
      return 'question';
    }
    if (message.includes('create') || message.includes('build') || message.includes('make')) {
      return 'creation';
    }
    if (message.includes('fix') || message.includes('error') || message.includes('problem')) {
      return 'troubleshooting';
    }
    return 'general';
  }

  private extractEntities(message: string): string[] {
    const entities: string[] = [];
    
    // Simple entity extraction (can be enhanced with NLP)
    const words = message.split(/\s+/);
    words.forEach(word => {
      // Capitalized words might be entities
      if (word.length > 2 && word[0] === word[0].toUpperCase() && word.slice(1) === word.slice(1).toLowerCase()) {
        entities.push(word);
      }
    });

    return entities;
  }

  private identifyMemoryTriggers(message: string, history: Array<{role: string, content: string}>): string[] {
    const triggers: string[] = [];
    
    // Preference indicators
    if (message.includes('prefer') || message.includes('like') || message.includes('always')) {
      triggers.push('preference');
    }
    
    // Solution indicators
    if (message.includes('worked') || message.includes('solved') || message.includes('fixed')) {
      triggers.push('solution');
    }
    
    // Knowledge sharing
    if (message.includes('remember') || message.includes('note') || message.includes('important')) {
      triggers.push('knowledge');
    }

    return triggers;
  }

  private shouldCreateMemory(message: string, intent: string, history: Array<{role: string, content: string}>): boolean {
    // Create memory for preferences
    if (intent === 'preference') return true;
    
    // Create memory for successful solutions
    if (intent === 'troubleshooting' && history.some(h => h.content.includes('worked') || h.content.includes('solved'))) {
      return true;
    }
    
    // Create memory for important information
    if (message.includes('remember') || message.includes('important') || message.includes('note')) {
      return true;
    }

    return false;
  }

  private suggestMemoryType(message: string, intent: string): MemoryType {
    if (intent === 'preference') return 'user_preference';
    if (intent === 'troubleshooting') return 'solution';
    if (message.includes('code') || message.includes('function')) return 'code_snippet';
    if (message.includes('project')) return 'project_knowledge';
    return 'general';
  }

  private buildSearchQueries(analysis: ConversationAnalysis, conversationId?: string, projectId?: string): SearchQuery[] {
    const queries: SearchQuery[] = [];

    // Search by topics
    if (analysis.topics.length > 0) {
      queries.push({
        text: analysis.topics.join(' '),
        limit: 3
      });
    }

    // Search by entities
    if (analysis.entities.length > 0) {
      queries.push({
        text: analysis.entities.join(' '),
        limit: 2
      });
    }

    // Search by project
    if (projectId) {
      queries.push({
        projectId,
        limit: 3
      });
    }

    // Search by conversation
    if (conversationId) {
      queries.push({
        conversationId,
        limit: 2
      });
    }

    // Search preferences if intent suggests it
    if (analysis.intent === 'preference' || analysis.memoryTriggers.includes('preference')) {
      queries.push({
        type: 'user_preference',
        limit: 3
      });
    }

    return queries;
  }

  private calculateRelevanceScore(memory: any, analysis: ConversationAnalysis, baseScore: number): number {
    let score = baseScore;

    // Boost score for matching topics
    const memoryText = (memory.title + ' ' + memory.content + ' ' + memory.metadata.tags.join(' ')).toLowerCase();
    analysis.topics.forEach(topic => {
      if (memoryText.includes(topic)) score += 0.2;
    });

    // Boost score for matching entities
    analysis.entities.forEach(entity => {
      if (memoryText.includes(entity.toLowerCase())) score += 0.3;
    });

    // Boost score for recent memories
    const daysSinceCreated = (Date.now() - new Date(memory.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreated < 7) score += 0.1;

    // Boost score for frequently accessed memories
    if (memory.metadata.accessCount > 5) score += 0.1;

    return Math.min(score, 1.0); // Cap at 1.0
  }

  private deduplicateMemories(memories: Array<any>): Array<any> {
    const seen = new Set();
    return memories.filter(memory => {
      if (seen.has(memory.id)) return false;
      seen.add(memory.id);
      return true;
    });
  }

  private createContextSummary(memories: Array<any>): string {
    if (memories.length === 0) return '';

    const summaryParts: string[] = [];
    
    // Group by type
    const byType = memories.reduce((acc, memory) => {
      if (!acc[memory.type]) acc[memory.type] = [];
      acc[memory.type].push(memory);
      return acc;
    }, {} as Record<string, any[]>);

    Object.entries(byType).forEach(([type, mems]) => {
      const typeLabel = type.replace('_', ' ').toUpperCase();
      summaryParts.push(`${typeLabel}: ${(mems as any[]).map(m => m.title).join(', ')}`);
    });

    return summaryParts.join(' | ');
  }

  private extractMemoryContent(userMessage: string, aiResponse: string, analysis: ConversationAnalysis): string {
    // Create meaningful memory content based on the conversation
    if (analysis.suggestedMemoryType === 'user_preference') {
      return `User preference: ${userMessage}`;
    }
    
    if (analysis.suggestedMemoryType === 'solution') {
      return `Problem: ${userMessage}\n\nSolution: ${aiResponse}`;
    }
    
    if (analysis.suggestedMemoryType === 'code_snippet') {
      // Extract code from AI response
      const codeMatch = aiResponse.match(/```[\s\S]*?```/);
      return codeMatch ? codeMatch[0] : aiResponse;
    }

    return `${userMessage}\n\nResponse: ${aiResponse}`;
  }

  private generateMemoryTitle(userMessage: string, analysis: ConversationAnalysis): string {
    const words = userMessage.split(' ').slice(0, 6).join(' ');
    const type = analysis.suggestedMemoryType?.replace('_', ' ') || 'conversation';
    return `${type}: ${words}${words.length < userMessage.length ? '...' : ''}`;
  }

  private generateMemoryTags(analysis: ConversationAnalysis): string[] {
    const tags = [...analysis.topics, ...analysis.entities.map(e => e.toLowerCase())];
    tags.push(analysis.intent);
    return Array.from(new Set(tags)).filter(tag => tag.length > 1);
  }
}

// Export singleton instance
export const memoryContextService = new MemoryContextService();
