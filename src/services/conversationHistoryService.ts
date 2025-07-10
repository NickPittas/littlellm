import { getStorageItem, setStorageItem } from '../utils/storage';
import type { Message } from './chatService';

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

class ConversationHistoryService {
  private conversations: Conversation[] = [];
  private currentConversationId: string | null = null;
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    
    try {
      const stored = await getStorageItem('conversation-history');
      if (stored && Array.isArray(stored)) {
        this.conversations = stored.map(conv => ({
          ...conv,
          createdAt: new Date(conv.createdAt),
          updatedAt: new Date(conv.updatedAt),
          messages: conv.messages.map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
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
    return [...this.conversations];
  }

  async getConversation(conversationId: string): Promise<Conversation | null> {
    await this.initialize();
    return this.conversations.find(c => c.id === conversationId) || null;
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
}

export const conversationHistoryService = new ConversationHistoryService();
