'use client';

import { useState, useEffect } from 'react';
import { conversationHistoryService, type Conversation } from '../services/conversationHistoryService';

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
// Removed redundant HistoryOverlay component - only keeping the hook

// Hook to use the history overlay
export function useHistoryOverlay(onLoadConversation: (conversation: Conversation) => Promise<void>) {
  const [loading, setLoading] = useState(false);

  const openHistory = async () => {
    setLoading(true);
    try {
      const allConversations = await conversationHistoryService.getAllConversations();
      
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.openHistory(allConversations);
      }
    } catch (error) {
      safeDebugLog('error', 'HISTORYOVERLAY', 'Failed to open history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await conversationHistoryService.deleteConversation(conversationId);
      
      // Refresh and reopen the window
      const allConversations = await conversationHistoryService.getAllConversations();
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.openHistory(allConversations);
      }
    } catch (error) {
      safeDebugLog('error', 'HISTORYOVERLAY', 'Failed to delete conversation:', error);
    }
  };

  const handleClearAllHistory = async () => {
    try {
      await conversationHistoryService.clearAllHistory();
      
      // Close the history window
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.closeHistory();
      }
    } catch (error) {
      safeDebugLog('error', 'HISTORYOVERLAY', 'Failed to clear history:', error);
    }
  };

  const handleLoadConversation = async (conversationId: string) => {
    try {
      const conversation = await conversationHistoryService.getConversation(conversationId);
      if (conversation) {
        await onLoadConversation(conversation);
      }
    } catch (error) {
      safeDebugLog('error', 'HISTORYOVERLAY', 'Failed to load conversation:', error);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Listen for history events
      window.electronAPI.onHistoryItemSelected(handleLoadConversation);
      window.electronAPI.onHistoryItemDeleted(handleDeleteConversation);
      window.electronAPI.onClearAllHistory(handleClearAllHistory);

      // Cleanup function to remove listeners on unmount
      return () => {
        // Remove listeners to prevent memory leaks
        if (window.electronAPI && window.electronAPI.removeAllListeners) {
          window.electronAPI.removeAllListeners('history-item-selected');
          window.electronAPI.removeAllListeners('history-item-deleted');
          window.electronAPI.removeAllListeners('clear-all-history');
        }
      };
    }
  }, []); // Remove dependencies to prevent re-adding listeners

  return {
    openHistory,
    loading
  };
}
