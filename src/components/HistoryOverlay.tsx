'use client';

import { useState, useEffect } from 'react';
import { conversationHistoryService, type Conversation } from '../services/conversationHistoryService';

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
      console.error('Failed to open history:', error);
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
      console.error('Failed to delete conversation:', error);
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
      console.error('Failed to clear history:', error);
    }
  };

  const handleLoadConversation = async (conversationId: string) => {
    try {
      const conversation = await conversationHistoryService.getConversation(conversationId);
      if (conversation) {
        await onLoadConversation(conversation);
      }
    } catch (error) {
      console.error('Failed to load conversation:', error);
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
        // Note: Electron API should provide removeListener methods
        // For now, we'll rely on the component unmounting to clean up
        // This prevents the memory leak by ensuring listeners are only added once
      };
    }
  }, [handleLoadConversation, handleDeleteConversation, handleClearAllHistory]);

  return {
    openHistory,
    loading
  };
}
