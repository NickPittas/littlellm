'use client';

import { useState, useEffect } from 'react';
import { conversationHistoryService, type Conversation } from '../services/conversationHistoryService';

interface HistoryOverlayProps {
  onLoadConversation: (conversation: Conversation) => Promise<void>;
}

export function HistoryOverlay({ onLoadConversation }: HistoryOverlayProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const allConversations = await conversationHistoryService.getAllConversations();
      setConversations(allConversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const openHistoryWindow = async () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      await loadConversations();
      
      // Open the overlay window with conversations data
      await window.electronAPI.openHistory(conversations);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    try {
      await conversationHistoryService.deleteConversation(conversationId);
      await loadConversations(); // Refresh the list
      
      // Reopen the window with updated data
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.openHistory(conversations);
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleClearAllHistory = async () => {
    try {
      await conversationHistoryService.clearAllHistory();
      setConversations([]);
      
      // Close the history window since there's nothing to show
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
      // Listen for history item selection
      window.electronAPI.onHistoryItemSelected((conversationId: string) => {
        handleLoadConversation(conversationId);
      });

      // Listen for history item deletion
      window.electronAPI.onHistoryItemDeleted((conversationId: string) => {
        handleDeleteConversation(conversationId);
      });

      // Listen for clear all history
      window.electronAPI.onClearAllHistory(() => {
        handleClearAllHistory();
      });

      // Cleanup listeners on unmount
      return () => {
        // Note: electronAPI doesn't provide removeListener methods in this implementation
        // The listeners will be cleaned up when the component unmounts
      };
    }
  }, [onLoadConversation]);

  // This component doesn't render anything visible
  // It just manages the overlay window through electronAPI
  return {
    openHistoryWindow,
    loading
  } as any;
}

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
    }
  }, [onLoadConversation]);

  return {
    openHistory,
    loading
  };
}
