/**
 * useMessages Hook - Manages message state and operations
 * Extracted from ModernChatInterface to reduce component complexity
 */

import { useState, useCallback } from 'react';
import { Message, ContentItem } from '../services/chatService';
import { conversationHistoryService } from '../services/conversationHistoryService';

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('../services/debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}

export interface UseMessagesReturn {
  // State
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  abortController: AbortController | null;
  
  // Actions
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateLastMessage: (updater: (message: Message) => Message) => void;
  clearMessages: () => void;
  setIsLoading: (loading: boolean) => void;
  setIsStreaming: (streaming: boolean) => void;
  setAbortController: (controller: AbortController | null) => void;
  
  // Operations
  loadConversation: (conversationId: string) => Promise<void>;
  saveCurrentConversation: () => Promise<void>;
  createNewConversation: () => Promise<void>;
}

export function useMessages(): UseMessagesReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const addMessage = useCallback((message: Message) => {
    setMessages(prev => [...prev, message]);
  }, []);

  const updateLastMessage = useCallback((updater: (message: Message) => Message) => {
    setMessages(prev => {
      if (prev.length === 0) return prev;
      
      const newMessages = [...prev];
      const lastIndex = newMessages.length - 1;
      newMessages[lastIndex] = updater(newMessages[lastIndex]);
      return newMessages;
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setIsLoading(false);
    setIsStreaming(false);
    setAbortController(null);
    
    // Clear the current conversation ID
    conversationHistoryService.setCurrentConversationId(null);
    
    // Clear localStorage for chat window
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chatWindowMessages');
    }
    
    safeDebugLog('info', 'USEMESSAGES', '🧹 Messages cleared and conversation reset');
  }, []);

  const loadConversation = useCallback(async (conversationId: string) => {
    try {
      safeDebugLog('info', 'USEMESSAGES', 'Loading conversation:', conversationId);
      
      const conversation = await conversationHistoryService.getConversation(conversationId);
      if (conversation) {
        setMessages(conversation.messages);
        conversationHistoryService.setCurrentConversationId(conversationId);
        safeDebugLog('info', 'USEMESSAGES', `Loaded conversation "${conversation.title}" with ${conversation.messages.length} messages`);
      } else {
        safeDebugLog('error', 'USEMESSAGES', 'Conversation not found:', conversationId);
        throw new Error('Conversation not found');
      }
    } catch (error) {
      safeDebugLog('error', 'USEMESSAGES', 'Failed to load conversation:', error);
      throw error;
    }
  }, []);

  const saveCurrentConversation = useCallback(async () => {
    try {
      if (messages.length === 0) {
        safeDebugLog('info', 'USEMESSAGES', 'No messages to save');
        return;
      }

      const currentConversationId = conversationHistoryService.getCurrentConversationId();
      
      if (currentConversationId) {
        await conversationHistoryService.updateConversation(currentConversationId, messages);
        safeDebugLog('info', 'USEMESSAGES', 'Updated existing conversation:', currentConversationId);
      } else {
        const newConversationId = await conversationHistoryService.createNewConversation(messages);
        conversationHistoryService.setCurrentConversationId(newConversationId);
        safeDebugLog('info', 'USEMESSAGES', 'Created new conversation:', newConversationId);
      }
    } catch (error) {
      safeDebugLog('error', 'USEMESSAGES', 'Failed to save conversation:', error);
      throw error;
    }
  }, [messages]);

  const createNewConversation = useCallback(async () => {
    try {
      // Save current conversation if it has messages
      if (messages.length > 0) {
        await saveCurrentConversation();
      }
      
      // Clear current state
      clearMessages();
      
      safeDebugLog('info', 'USEMESSAGES', 'New conversation created');
    } catch (error) {
      safeDebugLog('error', 'USEMESSAGES', 'Failed to create new conversation:', error);
      throw error;
    }
  }, [messages, saveCurrentConversation, clearMessages]);

  return {
    // State
    messages,
    isLoading,
    isStreaming,
    abortController,
    
    // Actions
    setMessages,
    addMessage,
    updateLastMessage,
    clearMessages,
    setIsLoading,
    setIsStreaming,
    setAbortController,
    
    // Operations
    loadConversation,
    saveCurrentConversation,
    createNewConversation
  };
}
