'use client';

import { useEffect, useRef } from 'react';
import { Edit3, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import { MessageWithThinking } from '../MessageWithThinking';
import { UserMessage } from '../UserMessage';
import { cn } from '@/lib/utils';
import type { Message } from '../../services/chatService';

interface MainChatAreaProps {
  className?: string;
  selectedModel?: string;
  messages?: Message[];
  isLoading?: boolean;
  onEditModelInstructions?: () => void;
  onQuickPrompts?: () => void;
}

export function MainChatArea({
  className,
  selectedModel = 'gemma3:gpu',
  messages = [],
  isLoading = false,
  onEditModelInstructions,
  onQuickPrompts
}: MainChatAreaProps) {

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const handleEditModelInstructions = () => {
    console.log('Edit Model Instructions clicked');
    onEditModelInstructions?.();
  };

  // Auto-scroll to bottom when messages change (during streaming)
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const wasAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold

    // Always scroll to bottom if user was already at bottom or if it's a new message
    if (wasAtBottom || messages.length > 0) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 10); // Small delay to ensure DOM is updated
    }
  }, [messages]);

  // Also scroll when message content changes (for streaming updates)
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        // Scroll during streaming updates
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 10);
      }
    }
  }, [messages]);

  // Scroll to bottom when loading state changes (when response starts/ends)
  useEffect(() => {
    if (isLoading) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 10);
    }
  }, [isLoading]);

  // Show welcome state when no messages
  const showWelcomeState = messages.length === 0;

  return (
    <div 
      className={cn(
        "flex-1 flex flex-col bg-gray-950/50 relative overflow-hidden",
        className
      )}
    >
      {showWelcomeState ? (
        // Welcome State - Centered model selection
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          {/* Model Avatar */}
          <div className="mb-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center border border-gray-600/50 shadow-lg">
              {/* Cute animal face icon - simplified version */}
              <div className="text-3xl">🐷</div>
            </div>
          </div>

          {/* Model Name */}
          <div className="text-center mb-4">
            <h1 className="text-2xl font-medium text-white mb-2">
              {selectedModel}
            </h1>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEditModelInstructions}
                className="text-gray-400 hover:text-white transition-colors h-auto p-2"
              >
                <Edit3 className="w-4 h-4 mr-2" />
                <span className="text-sm">Custom Prompt</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onQuickPrompts?.()}
                className="text-gray-400 hover:text-white transition-colors h-auto p-2"
              >
                <Zap className="w-4 h-4 mr-2" />
                <span className="text-sm">Quick Prompts</span>
              </Button>
            </div>
          </div>

          {/* Optional: Model description or status */}
          <div className="text-center text-gray-500 text-sm max-w-md">
            Ready to chat. Type your message below to get started.
          </div>
        </div>
      ) : (
        // Chat Messages Area
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Messages Container */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-2 space-y-2 chat-messages"
          >
            {messages.map((message, index) => (
              <div
                key={message.id || index}
                className={cn(
                  "flex",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg shadow-sm",
                    message.role === 'user'
                      ? 'bg-blue-600 text-white p-3'
                      : 'bg-gray-800 text-gray-100 border border-gray-700 p-3'
                  )}
                >
                  {message.role === 'assistant' ? (
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
                      sources={message.sources}
                    />
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
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-sm">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-sm text-gray-400">Thinking...</span>
                  </div>
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
