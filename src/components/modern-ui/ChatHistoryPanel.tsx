'use client';

import { useState, useEffect } from 'react';
import { X, MessageSquare, Clock, Search, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { conversationHistoryService, type Conversation } from '../../services/conversationHistoryService';
import { cn } from '@/lib/utils';

// Use the existing Conversation type from the service

interface ChatHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectChat?: (chatId: string) => void;
  className?: string;
}

export function ChatHistoryPanel({ 
  isOpen, 
  onClose, 
  onSelectChat,
  className 
}: ChatHistoryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load chat history when panel opens
  useEffect(() => {
    if (isOpen) {
      loadChatHistory();
    }
  }, [isOpen]);

  const loadChatHistory = async () => {
    setIsLoading(true);
    try {
      // Load real conversation history from the service
      const conversations = await conversationHistoryService.getAllConversations();
      console.log('Loaded conversations:', conversations.length);
      setChatHistory(conversations);
    } catch (error) {
      console.error('Failed to load chat history:', error);
      setChatHistory([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredHistory = chatHistory.filter(chat => {
    const lastMessage = chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].content : '';
    return chat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
           lastMessage.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else if (diffDays < 7) {
      return `${diffDays}d ago`;
    } else {
      return timestamp.toLocaleDateString();
    }
  };

  const handleChatSelect = (chatId: string) => {
    onSelectChat?.(chatId);
    onClose();
  };

  const handleDeleteChat = async (chatId: string, event: React.MouseEvent) => {
    // Prevent the chat selection when clicking delete
    event.stopPropagation();

    try {
      await conversationHistoryService.deleteConversation(chatId);
      // Reload the chat history
      await loadChatHistory();
      console.log('Chat deleted successfully:', chatId);
    } catch (error) {
      console.error('Failed to delete chat:', error);
    }
  };

  const handleClearAllHistory = async () => {
    if (confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
      try {
        await conversationHistoryService.clearAllHistory();
        // Reload the chat history (should be empty now)
        await loadChatHistory();
        console.log('All chat history cleared');
      } catch (error) {
        console.error('Failed to clear chat history:', error);
      }
    }
  };

  return (
    <div
      className={cn(
        "fixed top-0 right-0 h-full w-96 bg-gray-900/95 border-l border-gray-700/50 shadow-2xl transform transition-transform duration-300 ease-in-out z-40 flex flex-col",
        isOpen ? "translate-x-0" : "translate-x-full",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold text-white">Chat History</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50"
          title="Close History"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-700/50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-800/50 border-gray-700/50 text-white placeholder-gray-400"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-gray-400">Loading chat history...</div>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <MessageSquare className="w-12 h-12 text-gray-600 mb-4" />
            <div className="text-gray-400 mb-2">
              {searchQuery ? 'No matching conversations' : 'No chat history yet'}
            </div>
            <div className="text-sm text-gray-500">
              {searchQuery ? 'Try a different search term' : 'Start a conversation to see it here'}
            </div>
          </div>
        ) : (
          <div className="p-2">
            {filteredHistory.map((chat) => (
              <div
                key={chat.id}
                onClick={() => handleChatSelect(chat.id)}
                className="p-3 rounded-lg cursor-pointer transition-colors hover:bg-gray-800/50 mb-2"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-white font-medium text-sm truncate flex-1 mr-2">
                    {chat.title}
                  </h3>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      {formatTimestamp(chat.updatedAt)}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDeleteChat(chat.id, e)}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                      title="Delete conversation"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <p className="text-gray-400 text-xs mb-2 line-clamp-2">
                  {chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].content.substring(0, 100) + '...' : 'No messages'}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {chat.messages.length} messages
                  </span>
                  <div className="w-2 h-2 rounded-full bg-blue-500 opacity-60" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700/50 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-gray-400 border-gray-700/50 hover:text-white hover:bg-gray-800/50"
          onClick={handleClearAllHistory}
        >
          Clear History
        </Button>
      </div>
    </div>
  );
}
