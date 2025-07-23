'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { X, Minus, MessageSquare, ChevronDown } from 'lucide-react';
import { MessageWithThinking } from './MessageWithThinking';
import { UserMessage } from './UserMessage';
import { ThinkingIndicator } from './ThinkingIndicator';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initialize window dragging
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.startDrag) {
      const cleanup = window.electronAPI.startDrag();
      return cleanup;
    }
    return undefined;
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

  // Auto-scroll to bottom when response finishes
  const scrollToBottomOnComplete = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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

  // Auto-scroll to bottom when new messages are received (response finished)
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // If the last message is from assistant and has content, it means response is complete
      if (lastMessage.role === 'assistant' && lastMessage.content && !lastMessage.isThinking) {
        scrollToBottomOnComplete();
      }
    }
  }, [messages.length, messages[messages.length - 1]?.content]);

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
    <div className="h-full w-full bg-background overflow-hidden flex flex-col">
      {/* Title Bar - Simple draggable area */}
      <div 
        className="flex-none h-10 bg-muted/50 border-b border-border flex items-center justify-between px-3 select-none draggable-title-bar"
      >
        <span className="text-sm font-medium">CHAT WINDOW</span>
        
        <div className="flex items-center gap-1">
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

      {/* Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden p-4">
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
            className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar relative"
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
              Session: {sessionStats.totalTokens} tokens • {sessionStats.messagesCount} messages • {sessionService.formatSessionDuration()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
