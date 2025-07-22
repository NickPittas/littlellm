'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { X, Minus, MessageSquare, ChevronDown } from 'lucide-react';

import { useEnhancedWindowDrag } from '../hooks/useEnhancedWindowDrag';
import { MessageWithThinking } from './MessageWithThinking';
import { UserMessage } from './UserMessage';
import { ThinkingIndicator } from './ThinkingIndicator';
import { sessionService } from '../services/sessionService';
import type { Message } from '../services/chatService';
import type { SessionStats } from '../services/sessionService';

interface ChatOverlayProps {
  onClose?: () => void;
}

export function ChatOverlay({ onClose }: ChatOverlayProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionStats, setSessionStats] = useState<SessionStats>(sessionService.getSessionStats());
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize enhanced window dragging
  useEnhancedWindowDrag();

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
        } catch (error) {
          console.error('Failed to load initial messages:', error);
        }
      };

      // Listen for message updates from main window
      const handleMessagesUpdate = (newMessages: unknown[]) => {
        setMessages(newMessages as Message[]);
        // Store messages in localStorage for persistence
        localStorage.setItem('chatWindowMessages', JSON.stringify(newMessages));
      };

      // Set up IPC listener for messages
      window.electronAPI.onMessagesUpdate?.(handleMessagesUpdate);

      // Load initial state
      loadInitialMessages();

      return () => {
        // Clean up listener
        window.electronAPI.removeAllListeners?.('messages-update');
      };
    }
  }, []);

  // Update session stats when messages change
  useEffect(() => {
    setSessionStats(sessionService.getSessionStats());
  }, [messages]);

  // Scroll to bottom function
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Check if user is at bottom of scroll
  const checkScrollPosition = () => {
    if (!scrollContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
    setShowScrollToBottom(!isAtBottom && messages.length > 0);
  };

  // Auto-scroll to bottom when messages change (only if user was already at bottom)
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const wasAtBottom = scrollHeight - scrollTop - clientHeight < 50;

    if (wasAtBottom) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [messages]);

  // Add scroll listener
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    scrollContainer.addEventListener('scroll', checkScrollPosition);

    // Initial check
    checkScrollPosition();

    return () => {
      scrollContainer.removeEventListener('scroll', checkScrollPosition);
    };
  }, [messages.length]);

  return (
    <div className="h-full w-full bg-background flex flex-col overflow-hidden min-h-[400px] min-w-[300px]">
        {/* Custom Title Bar - Draggable */}
        <div
          className="flex-none flex items-center justify-between p-3 border-b border-border bg-background/95 backdrop-blur-sm cursor-move"
          style={{ WebkitAppRegion: 'drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
        >
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium text-foreground">Chat</div>
          </div>
          
          <div 
            className="flex items-center gap-1"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMinimize}
              className="h-6 w-6 p-0 hover:bg-muted"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Chat Display */}
        <div className="flex-1 flex flex-col overflow-hidden p-4 w-full">
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
              className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar w-full relative"
              style={{ maxHeight: '100%' }}
            >
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <Card
                    className={`max-w-full shadow-lg ${
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
                            timing={message.timing}
                            toolCalls={message.toolCalls}
                          />
                        )
                      ) : (
                        <UserMessage
                          content={
                            typeof message.content === 'string'
                              ? message.content
                              : Array.isArray(message.content)
                                ? message.content.map((item, idx) =>
                                    item.type === 'text' ? item.text : `[Image ${idx + 1}]`
                                  ).join(' ')
                                : String(message.content)
                          }
                        />
                      )}
                    </CardContent>
                  </Card>
                </div>
              ))}
              {/* Scroll anchor */}
              <div ref={messagesEndRef} />

              {/* Scroll to bottom button */}
              {showScrollToBottom && (
                <Button
                  onClick={scrollToBottom}
                  className="absolute bottom-4 left-1/2 transform -translate-x-1/2 h-12 w-12 rounded-full bg-primary/90 hover:bg-primary shadow-lg transition-all duration-200 z-10 flex items-center justify-center p-0"
                  style={{
                    WebkitAppRegion: 'no-drag',
                    backdropFilter: 'blur(8px)',
                    minWidth: '48px',
                    minHeight: '48px'
                  } as React.CSSProperties & { WebkitAppRegion?: string }}
                >
                  <ChevronDown
                    className="text-primary-foreground"
                    size={24}
                    style={{
                      width: '24px',
                      height: '24px',
                      minWidth: '24px',
                      minHeight: '24px'
                    }}
                  />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Session Stats Display - Only show when there are messages */}
        {messages.length > 0 && (
          <div className="flex-none px-4 pb-2 min-h-0">
            <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded text-center break-words">
              <div className="truncate">
                Session: {sessionStats.totalTokens} tokens • {sessionStats.messagesCount} messages • {sessionService.formatSessionDuration()}
              </div>
              {sessionStats.totalTokens === 0 && (
                <div className="text-yellow-500 text-[10px] mt-1">[DEBUG: No tokens tracked yet]</div>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
