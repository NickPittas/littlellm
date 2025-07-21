import { KnowledgeBaseService } from './KnowledgeBaseService';

/**
 * A service to handle Retrieval-Augmented Generation (RAG).
 * It enriches user prompts with relevant context from the knowledge base.
 */
export class RAGService {
  private static instance: RAGService;
  private knowledgeBase: KnowledgeBaseService;

  private constructor() {
    this.knowledgeBase = KnowledgeBaseService.getInstance();
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
   * Augments a user prompt with relevant context from the knowledge base.
   * @param prompt - The original user prompt.
   * @returns {Promise<string>} The augmented prompt with context.
   */
  public async augmentPromptWithContext(prompt: string): Promise<string> {
    const searchResults = await this.knowledgeBase.search(prompt, 3);

    if (searchResults.length === 0) {
      return prompt; // No relevant context found
    }

    const contextHeader = 'Use the following context to answer the question below:';
    const context = searchResults.map(r => `- ${r.text}`).join('\n');
    
    const augmentedPrompt = `${contextHeader}\n\n---\nContext:\n${context}\n---\n\nQuestion: ${prompt}`;

    return augmentedPrompt;
  }
}
