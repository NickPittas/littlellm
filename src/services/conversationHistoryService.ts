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

  private async saveToStorage() {
    try {
      // Serialize conversations with proper Date handling
      const serializedConversations = this.conversations.map(conv => ({
        ...conv,
        createdAt: conv.createdAt.toISOString(),
        updatedAt: conv.updatedAt.toISOString(),
        messages: conv.messages.map(msg => ({
          ...msg,
          timestamp: msg.timestamp.toISOString()
        }))
      }));

      await setStorageItem('conversation-history', serializedConversations);
    } catch (error) {
      console.error('Failed to save conversation history:', error);
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
    
    await this.saveToStorage();
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
      
      await this.saveToStorage();
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
    
    await this.saveToStorage();
  }

  async clearAllHistory() {
    this.conversations = [];
    this.currentConversationId = null;
    await this.saveToStorage();
  }

  getCurrentConversationId(): string | null {
    return this.currentConversationId;
  }

  setCurrentConversationId(id: string | null) {
    this.currentConversationId = id;
  }
}

export const conversationHistoryService = new ConversationHistoryService();
