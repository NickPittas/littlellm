'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { X, Minus, MessageSquare, ChevronDown } from 'lucide-react';
import { MessageWithThinking } from './MessageWithThinking';
import { UserMessage } from './UserMessage';
import { ThinkingIndicator } from './ThinkingIndicator';
import { KnowledgeBaseIndicator } from './KnowledgeBaseIndicator';
import { sessionService } from '../services/sessionService';
import type { Message } from '../services/chatService';
import type { SessionStats } from '../services/sessionService';

import './ChatOverlay.css';

interface ChatOverlayProps {
  onClose?: () => void;
}

export function ChatOverlay({ onClose }: ChatOverlayProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats>(sessionService.getSessionStats());
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [isKnowledgeBaseSearching, setIsKnowledgeBaseSearching] = useState(false);
  const [knowledgeBaseSearchQuery, setKnowledgeBaseSearchQuery] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize window dragging using preload script
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.startDrag) {
      return window.electronAPI.startDrag();
    }
  }, []);

  const handleClose = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.closeChatWindow();
    }
    onClose?.();
  };

  const handleMinimize = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.minimizeWindow();
    }
  };

  // Listen for messages from the main window and load initial state
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Load initial messages from localStorage or request from main window
      const loadInitialMessages = async () => {
        try {
          // First try to get current messages from main window
          const storedMessages = localStorage.getItem('chatWindowMessages');
          if (storedMessages) {
            const parsedMessages = JSON.parse(storedMessages);
            setMessages(parsedMessages);
          }

          // Request current messages from main window
          window.electronAPI.requestCurrentMessages?.();
        } catch {
          // Silently handle error - localStorage might not be available or data might be corrupted
          // Fall back to requesting messages from main window
        }
      };

      // Listen for message updates from main window
      const handleMessagesUpdate = (newMessages: unknown[]) => {
        const messages = newMessages as Message[];
        setMessages(messages);
        // Store messages in localStorage for persistence
        localStorage.setItem('chatWindowMessages', JSON.stringify(newMessages));
      };

      // Set up IPC listener for messages
      window.electronAPI.onMessagesUpdate?.(handleMessagesUpdate);

      // Set up IPC listener for knowledge base search updates
      const handleKnowledgeBaseSearchUpdate = (data: {isSearching: boolean, query?: string}) => {
        setIsKnowledgeBaseSearching(data.isSearching);
        if (data.query) {
          setKnowledgeBaseSearchQuery(data.query);
        }
      };

      window.electronAPI.onKnowledgeBaseSearchUpdate?.(handleKnowledgeBaseSearchUpdate);

      // Load initial state
      loadInitialMessages();

      return () => {
        // Clean up listeners
        window.electronAPI.removeAllListeners?.('messages-update');
        window.electronAPI.removeAllListeners?.('knowledge-base-search-update');
      };
    }
  }, []);

  // Update session stats when messages change
  useEffect(() => {
    setSessionStats(sessionService.getSessionStats());
  }, [messages]);

  // Debounced scroll to bottom function using requestAnimationFrame for smooth performance
  const scrollToBottom = useCallback(() => {
    if (!messagesEndRef.current) return;

    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end'
      });
    });
  }, []);

  // Check if user is at bottom of scroll container
  const isAtBottom = useCallback(() => {
    if (!scrollContainerRef.current) return false;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
  }, []);

  // Unified scroll management - handles all scroll scenarios
  useEffect(() => {
    if (!scrollContainerRef.current || messages.length === 0) return;

    const wasAtBottom = isAtBottom();

    // Auto-scroll if user was at bottom or if it's the first message
    if (wasAtBottom || messages.length === 1) {
      // Use a small delay to ensure DOM is updated, but avoid conflicts
      const timeoutId = setTimeout(() => {
        if (isAtBottom() || messages.length === 1) {
          scrollToBottom();
        }
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [messages, scrollToBottom, isAtBottom]);

  // Add scroll listener
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const handleScroll = () => {
      if (!scrollContainerRef.current) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
      setShowScrollToBottom(!isAtBottom && messages.length > 0);
    };

    scrollContainer.addEventListener('scroll', handleScroll);

    // Initial check
    handleScroll();

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
    };
  }, [messages.length]);

  return (
    <div
      className="h-screen w-full bg-background overflow-hidden flex flex-col"
      style={{
        position: 'relative',
        height: '100vh',
        maxHeight: '100vh'
      }}
    >
      {/* Title Bar - Draggable area using preload script */}
      <div
        className="flex-none h-10 bg-muted/50 border-b border-border flex items-center justify-between px-3 select-none chat-title-bar-drag-zone"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10000,
          backdropFilter: 'blur(8px)',
          backgroundColor: 'hsl(var(--muted) / 0.98)',
          pointerEvents: 'auto',
          cursor: 'grab'
        }}
      >
        <span className="text-sm font-medium">CHAT WINDOW</span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMinimize}
            className="h-6 w-6 p-0 hover:bg-muted"
            data-interactive="true"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
            data-interactive="true"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content Area */}
      <div
        className="chat-overlay-content"
        style={{
          position: 'absolute',
          top: '40px',                    // Start below the fixed title bar
          left: '0',
          right: '0',
          bottom: '0',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '16px'
        }}
      >
        {/* Knowledge Base Search Indicator */}
        {isKnowledgeBaseSearching && (
          <div className="mb-4">
            <KnowledgeBaseIndicator
              isSearching={isKnowledgeBaseSearching}
              searchQuery={knowledgeBaseSearchQuery}
            />
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
            <div>
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No messages yet</p>
              <p className="text-sm">Send a message from the main window to start chatting</p>
            </div>
          </div>
        ) : (
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar"
            style={{
              height: '100%',                  // Fill the content area
              overflowY: 'auto',
              overflowX: 'hidden'
            }}
          >
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <Card
                  className={`max-w-[85%] shadow-lg ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground user-message'
                      : 'bg-secondary text-foreground assistant-message'
                  }`}
                >
                  <CardContent className="p-3">
                    {message.role === 'assistant' ? (
                      message.isThinking ? (
                        <ThinkingIndicator />
                      ) : (
                        <MessageWithThinking
                          content={
                            typeof message.content === 'string'
                              ? message.content
                              : Array.isArray(message.content)
                                ? message.content.map((item, idx) =>
                                    item.type === 'text' ? item.text : `[Image ${idx + 1}]`
                                  ).join(' ')
                                : String(message.content)
                          }
                          usage={message.usage}
                          cost={message.cost}
                          timing={message.timing}
                          toolCalls={message.toolCalls}
                          sources={message.sources}
                          images={message.images}
                        />
                      )
                    ) : (
                      <UserMessage
                        content={message.content}
                      />
                    )}
                  </CardContent>
                </Card>
              </div>
            ))}
            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Scroll to bottom button */}
        {showScrollToBottom && (
          <Button
            onClick={scrollToBottom}
            className="absolute bottom-20 right-4 h-10 w-10 rounded-full bg-primary/90 hover:bg-primary shadow-lg transition-all duration-200 z-50 flex items-center justify-center p-0"
            style={{
              backdropFilter: 'blur(8px)',
            }}
          >
            <ChevronDown className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Session Stats Display */}
      {messages.length > 0 && (
        <div className="flex-none px-4 pb-2">
          <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded text-center">
            <div className="truncate">
              Session: {sessionStats.totalTokens} tokens • {sessionStats.messagesCount} messages • {sessionService.formatSessionCost()} • {sessionService.formatSessionDuration()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
