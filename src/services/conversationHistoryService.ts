import { getStorageItem } from '../utils/storage';
import type { Message } from './chatService';
import type { ElectronAPI } from '../types/electron';

// Type for conversation data from storage
interface ConversationData {
  id: string;
  title: string;
  messages: Array<{
    id: string;
    content: string;
    role: string;
    timestamp: string | Date;
    usage?: unknown;
    timing?: unknown;
    toolCalls?: unknown;
  }>;
  createdAt: string | Date;
  updatedAt: string | Date;
  toolsHash?: string;
}

// Type for tool objects
interface ToolObject {
  name?: string;
  description?: string;
  parameters?: unknown;
  function?: {
    name?: string;
    description?: string;
    parameters?: unknown;
  };
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  toolsHash?: string; // Hash of tools sent to track changes
}

class ConversationHistoryService {
  private conversations: Conversation[] = [];
  private currentConversationId: string | null = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;

    try {
      // Load conversation index from disk (contains metadata for ALL conversations)
      if (typeof window !== 'undefined' && window.electronAPI) {
        const electronAPI = window.electronAPI as unknown as ElectronAPI;
        const conversationIndex = await electronAPI.loadConversationIndex();

        if (conversationIndex && Array.isArray(conversationIndex)) {
          // Convert index entries back to Conversation objects (without full messages)
          this.conversations = conversationIndex.map((conv: unknown) => {
            const convData = conv as ConversationData;
            return {
              ...convData,
              createdAt: new Date(convData.createdAt),
              updatedAt: new Date(convData.updatedAt),
              messages: [] // Messages will be loaded on-demand when conversation is opened
            };
          });

          console.log(`Loaded ${this.conversations.length} conversations from disk`);
        } else {
          // Fallback: try loading from old storage system
          console.log('No conversation index found, trying legacy storage...');
          const stored = await getStorageItem('conversation-history');
          if (stored && Array.isArray(stored)) {
            this.conversations = stored.map(conv => ({
              ...conv,
              createdAt: new Date(conv.createdAt),
              updatedAt: new Date(conv.updatedAt),
              messages: conv.messages.map((msg: ConversationData['messages'][0]) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              }))
            }));

            // Migrate to new file-based system
            console.log('Migrating conversations to new file-based system...');
            await this.migrateToFileSystem();
          }
        }
      } else {
        // Fallback for environments without Electron API
        const stored = await getStorageItem('conversation-history');
        if (stored && Array.isArray(stored)) {
          this.conversations = stored.map(conv => ({
            ...conv,
            createdAt: new Date(conv.createdAt),
            updatedAt: new Date(conv.updatedAt),
            messages: conv.messages.map((msg: ConversationData['messages'][0]) => ({
              ...msg,
              timestamp: new Date(msg.timestamp)
            }))
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load conversation history:', error);
      this.conversations = [];
    }

    this.initialized = true;
  }

  // Save individual conversation to its own JSON file
  private async saveConversationToFile(conversation: Conversation) {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.saveConversationToFile) {
        const serializedConversation = {
          ...conversation,
          createdAt: conversation.createdAt.toISOString(),
          updatedAt: conversation.updatedAt.toISOString(),
          messages: conversation.messages.map(msg => ({
            ...msg,
            timestamp: msg.timestamp.toISOString()
          }))
        };

        const success = await window.electronAPI.saveConversationToFile(conversation.id, serializedConversation);
        if (success) {
          console.log(`Conversation ${conversation.id} saved to file successfully`);
        } else {
          console.error(`Failed to save conversation ${conversation.id} to file`);
        }
        return success;
      }
      return false;
    } catch (error) {
      console.error('Error saving conversation to file:', error);
      return false;
    }
  }

  // Migrate conversations from old storage system to new file-based system
  private async migrateToFileSystem() {
    try {
      for (const conversation of this.conversations) {
        await this.saveConversationToFile(conversation);
      }
      await this.saveConversationIndex();
      console.log('Migration to file-based system completed');
    } catch (error) {
      console.error('Failed to migrate conversations to file system:', error);
    }
  }

  // Load full conversation data from file (including messages)
  async loadFullConversation(conversationId: string): Promise<Conversation | null> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const electronAPI = window.electronAPI as unknown as ElectronAPI;
        const conversationData = await electronAPI.loadConversationFromFile(conversationId);

        if (conversationData) {
          const data = conversationData as ConversationData;
          return {
            ...data,
            createdAt: new Date(data.createdAt),
            updatedAt: new Date(data.updatedAt),
            messages: data.messages.map((msg: ConversationData['messages'][0]) => ({
              ...msg,
              role: msg.role as 'user' | 'assistant',
              timestamp: new Date(msg.timestamp)
            } as Message))
          };
        }
      }
      return null;
    } catch (error) {
      console.error(`Failed to load full conversation ${conversationId}:`, error);
      return null;
    }
  }

  // Save conversation list (just metadata) to index file
  private async saveConversationIndex() {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.saveConversationIndex) {
        const conversationIndex = this.conversations.map(conv => ({
          id: conv.id,
          title: conv.title,
          createdAt: conv.createdAt.toISOString(),
          updatedAt: conv.updatedAt.toISOString(),
          messageCount: conv.messages.length
        }));

        const success = await window.electronAPI.saveConversationIndex(conversationIndex);
        if (success) {
          console.log('Conversation index saved successfully');
        }
        return success;
      }
      return false;
    } catch (error) {
      console.error('Error saving conversation index:', error);
      return false;
    }
  }

  private generateTitle(messages: Message[]): string {
    // Generate title from first user message
    const firstUserMessage = messages.find(m => m.role === 'user');
    if (firstUserMessage && typeof firstUserMessage.content === 'string') {
      const content = firstUserMessage.content.trim();
      if (content.length > 50) {
        return content.substring(0, 47) + '...';
      }
      return content;
    }
    return `Chat ${new Date().toLocaleDateString()}`;
  }

  async createNewConversation(messages: Message[]): Promise<string> {
    await this.initialize();

    const conversationId = Date.now().toString();
    const conversation: Conversation = {
      id: conversationId,
      title: this.generateTitle(messages),
      messages: [...messages],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.conversations.unshift(conversation); // Add to beginning
    this.currentConversationId = conversationId;

    // Keep only last 50 conversations
    if (this.conversations.length > 50) {
      this.conversations = this.conversations.slice(0, 50);
    }

    // Save individual conversation to its own JSON file
    await this.saveConversationToFile(conversation);
    // Update the conversation index
    await this.saveConversationIndex();

    return conversationId;
  }

  async updateConversation(conversationId: string, messages: Message[]) {
    await this.initialize();

    const conversation = this.conversations.find(c => c.id === conversationId);
    if (conversation) {
      conversation.messages = [...messages];
      conversation.updatedAt = new Date();

      // Update title if it's still the default
      if (conversation.title.startsWith('Chat ')) {
        conversation.title = this.generateTitle(messages);
      }

      // Save updated conversation to its own JSON file
      await this.saveConversationToFile(conversation);
      // Update the conversation index
      await this.saveConversationIndex();
    }
  }

  async getAllConversations(): Promise<Conversation[]> {
    await this.initialize();
    // Return conversation metadata (without full messages for performance)
    // Messages will be loaded on-demand when conversation is opened
    return [...this.conversations];
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    await this.initialize();

    // First check if we have the conversation in memory
    const conversation = this.conversations.find(c => c.id === conversationId);
    if (!conversation) {
      return null;
    }

    // If conversation has no messages (loaded from index), load full data from file
    if (conversation.messages.length === 0) {
      const fullConversation = await this.loadFullConversation(conversationId);
      if (fullConversation) {
        // Update the in-memory conversation with full data
        const index = this.conversations.findIndex(c => c.id === conversationId);
        if (index !== -1) {
          this.conversations[index] = fullConversation;
        }
        return fullConversation;
      }
    }

    return conversation;
  }

  async deleteConversation(conversationId: string) {
    await this.initialize();
    this.conversations = this.conversations.filter(c => c.id !== conversationId);
    
    if (this.currentConversationId === conversationId) {
      this.currentConversationId = null;
    }
    
    await this.saveConversationIndex();
  }

  async clearAllHistory() {
    this.conversations = [];
    this.currentConversationId = null;
    await this.saveConversationIndex();
  }

  getCurrentConversationId(): string | null {
    return this.currentConversationId;
  }

  setCurrentConversationId(id: string | null) {
    this.currentConversationId = id;
  }

  // Tool state management for conversation-level optimization
  async getToolsHashForConversation(conversationId: string): Promise<string | null> {
    await this.initialize();
    const conversation = this.conversations.find(c => c.id === conversationId);
    return conversation?.toolsHash || null;
  }

  async setToolsHashForConversation(conversationId: string, toolsHash: string) {
    await this.initialize();
    const conversation = this.conversations.find(c => c.id === conversationId);
    if (conversation) {
      conversation.toolsHash = toolsHash;
      conversation.updatedAt = new Date();

      // Save updated conversation
      await this.saveConversationToFile(conversation);
      await this.saveConversationIndex();
    }
  }

  // Helper to generate hash from tools array
  generateToolsHash(tools: ToolObject[]): string {
    const toolsString = JSON.stringify(tools.map(tool => ({
      name: tool.name || tool.function?.name || 'unknown',
      description: tool.description || tool.function?.description || '',
      parameters: tool.parameters || tool.function?.parameters || {}
    })).filter(tool => tool.name !== 'unknown').sort((a, b) => a.name.localeCompare(b.name)));

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < toolsString.length; i++) {
      const char = toolsString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString();
  }
}

export const conversationHistoryService = new ConversationHistoryService();
