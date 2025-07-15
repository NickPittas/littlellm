/**
 * Automatic Memory Service for LiteLLM
 * Handles automatic memory search and storage without requiring explicit tool calls
 */

import { memoryService } from './memoryService';
import { memoryContextService } from './memoryContextService';
import { MemoryType, MemoryEntry } from '../types/memory';

export interface AutoMemoryConfig {
  enableAutoSearch: boolean;
  enableAutoSave: boolean;
  searchThreshold: number; // Minimum relevance score to include memories
  saveThreshold: number; // Minimum confidence to auto-save
  maxContextMemories: number;
  autoSaveTypes: MemoryType[];
}

export interface MemoryEnhancedPrompt {
  enhancedPrompt: string;
  memoriesUsed: MemoryEntry[];
  originalPrompt: string;
}

export interface AutoSaveCandidate {
  type: MemoryType;
  title: string;
  content: string;
  tags: string[];
  confidence: number;
  reason: string;
}

class AutomaticMemoryService {
  private readonly DEFAULT_CONFIG: AutoMemoryConfig = {
    enableAutoSearch: true,
    enableAutoSave: true,
    searchThreshold: 0.3,
    saveThreshold: 0.7,
    maxContextMemories: 5,
    autoSaveTypes: ['user_preference', 'solution', 'project_knowledge', 'code_snippet']
  };

  private config: AutoMemoryConfig = { ...this.DEFAULT_CONFIG };

  constructor() {
    console.log('🧠 AutomaticMemoryService initialized with config:', this.config);
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AutoMemoryConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🧠 Auto-memory config updated:', this.config);
  }

  /**
   * Automatically enhance a prompt with relevant memories
   */
  async enhancePromptWithMemories(
    originalPrompt: string,
    userMessage: string,
    conversationHistory: Array<{role: string, content: string}> = [],
    conversationId?: string,
    projectId?: string
  ): Promise<MemoryEnhancedPrompt> {
    console.log('🧠 AutoMemoryService.enhancePromptWithMemories called with:', {
      enableAutoSearch: this.config.enableAutoSearch,
      userMessage: userMessage.substring(0, 100),
      conversationId,
      projectId
    });

    if (!this.config.enableAutoSearch) {
      console.log('🧠 Auto-search disabled, returning original prompt');
      return {
        enhancedPrompt: originalPrompt,
        memoriesUsed: [],
        originalPrompt
      };
    }

    try {
      // Get relevant memories automatically
      console.log('🧠 Calling memoryContextService.getMemoryContext...');
      const memoryContext = await memoryContextService.getMemoryContext(
        userMessage,
        conversationId,
        projectId,
        conversationHistory
      );
      console.log('🧠 Memory context result:', {
        relevantMemoriesCount: memoryContext.relevantMemories.length,
        contextSummary: memoryContext.contextSummary.substring(0, 100)
      });

      // Filter memories by relevance threshold
      const relevantMemories = memoryContext.relevantMemories.filter(
        memory => memory.relevanceScore >= this.config.searchThreshold
      ).slice(0, this.config.maxContextMemories);

      if (relevantMemories.length === 0) {
        return {
          enhancedPrompt: originalPrompt,
          memoriesUsed: [],
          originalPrompt
        };
      }

      // Build enhanced prompt with memory context
      const memorySection = this.buildMemorySection(relevantMemories);
      const enhancedPrompt = this.injectMemoryIntoPrompt(originalPrompt, memorySection);

      console.log(`🧠 Auto-enhanced prompt with ${relevantMemories.length} memories`);

      return {
        enhancedPrompt,
        memoriesUsed: relevantMemories.map(m => ({
          id: m.id,
          type: m.type,
          title: m.title,
          content: m.content,
          metadata: {
            tags: m.tags,
            timestamp: new Date(),
            relevanceScore: m.relevanceScore
          },
          searchableText: '',
          createdAt: new Date(),
          updatedAt: new Date()
        })),
        originalPrompt
      };
    } catch (error) {
      console.error('Error enhancing prompt with memories:', error);
      return {
        enhancedPrompt: originalPrompt,
        memoriesUsed: [],
        originalPrompt
      };
    }
  }

  /**
   * Automatically analyze and save useful information from conversations
   */
  async autoSaveFromConversation(
    userMessage: string,
    aiResponse: string,
    conversationHistory: Array<{role: string, content: string}> = [],
    conversationId?: string,
    projectId?: string
  ): Promise<{ saved: number; candidates: AutoSaveCandidate[] }> {
    console.log('🧠 AutoMemoryService.autoSaveFromConversation called with:', {
      enableAutoSave: this.config.enableAutoSave,
      userMessage: userMessage.substring(0, 100),
      aiResponse: aiResponse.substring(0, 100),
      conversationId,
      projectId
    });

    if (!this.config.enableAutoSave) {
      console.log('🧠 Auto-save disabled, returning empty result');
      return { saved: 0, candidates: [] };
    }

    try {
      // Analyze conversation for save-worthy content
      console.log('🧠 Identifying save candidates...');
      const candidates = await this.identifySaveCandidates(
        userMessage,
        aiResponse,
        conversationHistory,
        conversationId,
        projectId
      );
      console.log('🧠 Found candidates:', candidates.length, candidates.map(c => c.title));

      // Filter by confidence threshold
      const highConfidenceCandidates = candidates.filter(
        candidate => candidate.confidence >= this.config.saveThreshold &&
        this.config.autoSaveTypes.includes(candidate.type)
      );

      let saved = 0;
      for (const candidate of highConfidenceCandidates) {
        try {
          const result = await memoryService.storeMemory({
            type: candidate.type,
            title: candidate.title,
            content: candidate.content,
            tags: [...candidate.tags, 'auto-saved'],
            conversationId,
            projectId,
            source: 'auto_memory'
          });

          if (result.success) {
            saved++;
            console.log(`🧠 Auto-saved memory: ${candidate.title} (${candidate.type})`);
          }
        } catch (error) {
          console.error('Failed to auto-save memory candidate:', error);
        }
      }

      return { saved, candidates };
    } catch (error) {
      console.error('Error in auto-save analysis:', error);
      return { saved: 0, candidates: [] };
    }
  }

  /**
   * Build memory section for prompt injection
   */
  private buildMemorySection(memories: Array<{
    id: string;
    type: MemoryType;
    title: string;
    content: string;
    relevanceScore: number;
    tags: string[];
  }>): string {
    if (memories.length === 0) return '';

    const memoryEntries = memories.map((memory, index) => {
      const typeLabel = this.getTypeLabel(memory.type);
      return `${index + 1}. **${memory.title}** (${typeLabel})
   ${memory.content}
   Tags: ${memory.tags.join(', ')}`;
    }).join('\n\n');

    return `## Relevant Context from Memory

You have access to the following relevant information from previous conversations:

${memoryEntries}

Use this context to provide more informed and personalized responses. Reference this information naturally when relevant, but don't mention the memory system explicitly.`;
  }

  /**
   * Inject memory section into system prompt
   */
  private injectMemoryIntoPrompt(originalPrompt: string, memorySection: string): string {
    // Insert memory section before any existing tool instructions
    const toolInstructionMarkers = [
      'You have access to the following tools',
      'Available tools:',
      'Tool usage:',
      'Functions available:'
    ];

    for (const marker of toolInstructionMarkers) {
      const index = originalPrompt.indexOf(marker);
      if (index !== -1) {
        return originalPrompt.slice(0, index) + memorySection + '\n\n' + originalPrompt.slice(index);
      }
    }

    // If no tool section found, append to end
    return originalPrompt + '\n\n' + memorySection;
  }

  /**
   * Identify candidates for automatic saving
   */
  private async identifySaveCandidates(
    userMessage: string,
    aiResponse: string,
    conversationHistory: Array<{role: string, content: string}>,
    conversationId?: string,
    projectId?: string
  ): Promise<AutoSaveCandidate[]> {
    const candidates: AutoSaveCandidate[] = [];

    // Analyze user message for preferences
    const preferenceCandidate = this.analyzeForPreferences(userMessage);
    if (preferenceCandidate) candidates.push(preferenceCandidate);

    // Analyze AI response for solutions
    const solutionCandidate = this.analyzeForSolutions(userMessage, aiResponse);
    if (solutionCandidate) candidates.push(solutionCandidate);

    // Analyze for code snippets
    const codeCandidate = this.analyzeForCodeSnippets(aiResponse);
    if (codeCandidate) candidates.push(codeCandidate);

    // Analyze for project knowledge
    const knowledgeCandidate = this.analyzeForProjectKnowledge(userMessage, aiResponse, projectId);
    if (knowledgeCandidate) candidates.push(knowledgeCandidate);

    return candidates;
  }

  /**
   * Analyze message for user preferences
   */
  private analyzeForPreferences(userMessage: string): AutoSaveCandidate | null {
    const preferenceIndicators = [
      'i prefer', 'i like', 'i want', 'i always', 'i usually',
      'my preference', 'i tend to', 'i typically', 'i favor',
      'please remember', 'remember that i', 'note that i'
    ];

    // Add identity/name indicators
    const identityIndicators = [
      'my name is', 'i am', 'i\'m', 'call me', 'my name\'s',
      'i go by', 'you can call me', 'my birthday is', 'i was born'
    ];

    const message = userMessage.toLowerCase();
    const hasPreferenceIndicator = preferenceIndicators.some(indicator =>
      message.includes(indicator)
    );
    const hasIdentityIndicator = identityIndicators.some(indicator =>
      message.includes(indicator)
    );

    if (!hasPreferenceIndicator && !hasIdentityIndicator) {
      console.log('🧠 No preference or identity indicators found in:', message);
      return null;
    }

    // Extract preference or identity content
    const sentences = userMessage.split(/[.!?]+/);
    const allIndicators = [...preferenceIndicators, ...identityIndicators];
    const relevantSentences = sentences.filter(sentence =>
      allIndicators.some(indicator =>
        sentence.toLowerCase().includes(indicator)
      )
    );

    if (relevantSentences.length === 0) {
      // If no sentences match, use the whole message if it's short
      if (userMessage.length < 100) {
        const content = userMessage.trim();
        console.log('🧠 Using whole message as preference content:', content);
        return {
          type: 'user_preference',
          title: `User Info: ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`,
          content,
          tags: hasIdentityIndicator ? ['identity', 'user-info'] : ['preference', 'user-stated'],
          confidence: hasIdentityIndicator ? 0.9 : 0.8,
          reason: hasIdentityIndicator ? 'User provided identity information' : 'User explicitly stated a preference'
        };
      }
      return null;
    }

    const content = relevantSentences.join('. ').trim();
    console.log('🧠 Extracted preference/identity content:', content);

    return {
      type: 'user_preference',
      title: hasIdentityIndicator ?
        `User Identity: ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}` :
        `User Preference: ${content.slice(0, 50)}${content.length > 50 ? '...' : ''}`,
      content,
      tags: hasIdentityIndicator ? ['identity', 'user-info'] : ['preference', 'user-stated'],
      confidence: hasIdentityIndicator ? 0.9 : 0.8,
      reason: hasIdentityIndicator ? 'User provided identity information' : 'User explicitly stated a preference'
    };
  }

  /**
   * Analyze for successful solutions
   */
  private analyzeForSolutions(userMessage: string, aiResponse: string): AutoSaveCandidate | null {
    const problemIndicators = ['error', 'issue', 'problem', 'bug', 'fix', 'help', 'how to'];
    const solutionIndicators = ['here\'s how', 'you can', 'try this', 'solution', 'fix this'];

    const userLower = userMessage.toLowerCase();
    const responseLower = aiResponse.toLowerCase();

    const hasProblem = problemIndicators.some(indicator => userLower.includes(indicator));
    const hasSolution = solutionIndicators.some(indicator => responseLower.includes(indicator));

    if (!hasProblem || !hasSolution) return null;

    // Extract problem and solution
    const problemSummary = userMessage.slice(0, 100) + (userMessage.length > 100 ? '...' : '');
    
    return {
      type: 'solution',
      title: `Solution: ${problemSummary}`,
      content: `Problem: ${userMessage}\n\nSolution: ${aiResponse}`,
      tags: ['solution', 'problem-solving'],
      confidence: 0.7,
      reason: 'Conversation contains problem and solution pattern'
    };
  }

  /**
   * Analyze for code snippets
   */
  private analyzeForCodeSnippets(aiResponse: string): AutoSaveCandidate | null {
    const codeBlockRegex = /```[\s\S]*?```/g;
    const codeBlocks = aiResponse.match(codeBlockRegex);

    if (!codeBlocks || codeBlocks.length === 0) return null;

    // Only save substantial code blocks
    const substantialCode = codeBlocks.find(block => 
      block.split('\n').length > 3 && block.length > 100
    );

    if (!substantialCode) return null;

    // Extract language and create title
    const languageMatch = substantialCode.match(/```(\w+)/);
    const language = languageMatch ? languageMatch[1] : 'code';
    
    return {
      type: 'code_snippet',
      title: `${language.charAt(0).toUpperCase() + language.slice(1)} Code Snippet`,
      content: substantialCode,
      tags: ['code', language, 'snippet'],
      confidence: 0.6,
      reason: 'Response contains substantial code block'
    };
  }

  /**
   * Analyze for project knowledge
   */
  private analyzeForProjectKnowledge(
    userMessage: string, 
    aiResponse: string, 
    projectId?: string
  ): AutoSaveCandidate | null {
    if (!projectId) return null;

    const knowledgeIndicators = [
      'architecture', 'design', 'structure', 'database', 'api',
      'requirements', 'specification', 'documentation', 'workflow'
    ];

    const combinedText = (userMessage + ' ' + aiResponse).toLowerCase();
    const hasKnowledgeIndicator = knowledgeIndicators.some(indicator => 
      combinedText.includes(indicator)
    );

    if (!hasKnowledgeIndicator) return null;

    const title = `Project Knowledge: ${userMessage.slice(0, 50)}...`;
    
    return {
      type: 'project_knowledge',
      title,
      content: `Context: ${userMessage}\n\nInformation: ${aiResponse}`,
      tags: ['project', 'knowledge', projectId],
      confidence: 0.5,
      reason: 'Conversation contains project-related knowledge'
    };
  }

  /**
   * Get human-readable type label
   */
  private getTypeLabel(type: MemoryType): string {
    const labels = {
      user_preference: 'User Preference',
      conversation_context: 'Conversation',
      project_knowledge: 'Project Knowledge',
      code_snippet: 'Code Snippet',
      solution: 'Solution',
      general: 'General'
    };
    return labels[type] || type;
  }

  /**
   * Get current configuration
   */
  getConfig(): AutoMemoryConfig {
    return { ...this.config };
  }

  /**
   * Enable/disable automatic memory features
   */
  setEnabled(autoSearch: boolean, autoSave: boolean): void {
    this.config.enableAutoSearch = autoSearch;
    this.config.enableAutoSave = autoSave;
    console.log(`🧠 Auto-memory: search=${autoSearch}, save=${autoSave}`);
  }
}

// Export singleton instance
export const automaticMemoryService = new AutomaticMemoryService();
