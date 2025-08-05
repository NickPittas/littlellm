'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Edit3, Zap, ChevronDown } from 'lucide-react';
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
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const handleEditModelInstructions = () => {
    console.log('Edit Model Instructions clicked');
    onEditModelInstructions?.();
  };

  // Scroll to bottom function
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

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (!scrollContainerRef.current || messages.length === 0) return;

    const wasAtBottom = isAtBottom();

    // Auto-scroll if user was at bottom or if it's the first message
    if (wasAtBottom || messages.length === 1) {
      const timeoutId = setTimeout(() => {
        if (isAtBottom() || messages.length === 1) {
          scrollToBottom();
        }
      }, 50);

      return () => clearTimeout(timeoutId);
    }
  }, [messages, scrollToBottom, isAtBottom]);

  // Add scroll listener for scroll-to-bottom button
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
            className="flex-1 overflow-y-auto p-2 pt-8 space-y-2 chat-messages"
            style={
              {
                WebkitAppRegion: 'no-drag',
                // Ensure nothing inside can extend under the sticky title bar
                overflowX: 'hidden',
                overscrollBehaviorY: 'contain',
                // Extra guard to keep content below header area
                scrollPaddingTop: '32px'
              } as React.CSSProperties
            }
          >
            {messages.map((message, index) => (
              <div
                key={message.id || index}
                className={cn(
                  "flex",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
                // Prevent extremely wide content from expanding layout
                style={{ maxWidth: '85vw' } as React.CSSProperties}
              >
                <div
                  className={cn(
                    // Bubble container: enforce cropping and safe wrapping
                    "max-w-[85%] rounded-lg shadow-sm overflow-hidden break-words",
                    message.role === 'user'
                      ? 'bg-blue-600 text-white p-3'
                      : 'bg-gray-800 text-gray-100 border border-gray-700 p-3'
                  )}
                  style={{
                    // Ensure long unbroken content (URLs, code, long words) wraps and is clipped
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word'
                  } as React.CSSProperties}
                >
                  {/* Toolbar area should never extend outside bubble */}
                  <div
                    className="relative group"
                    // Make sure inner toolbar/content stays within cropped bubble
                    style={{ overflow: 'hidden' }}
                  >
                    {message.role === 'assistant' ? (
                      <MessageWithThinking
                        content={
                          typeof message.content === 'string'
                            ? message.content
                            : Array.isArray(message.content)
                              ? message.content
                                  .map((item, idx) =>
                                    item.type === 'text' ? item.text : `[Image ${idx + 1}]`
                                  )
                                  .join(' ')
                              : String(message.content)
                        }
                        usage={message.usage}
                        timing={message.timing}
                        toolCalls={message.toolCalls}
                        sources={message.sources}
                      />
                    ) : (
                      <UserMessage content={message.content} />
                    )}
                  </div>
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

          {/* Scroll to bottom button */}
          {showScrollToBottom && (
            <Button
              onClick={scrollToBottom}
              className="absolute bottom-20 right-4 h-10 w-10 rounded-full bg-blue-600/90 hover:bg-blue-600 shadow-lg transition-all duration-200 z-50 flex items-center justify-center p-0"
              style={{
                backdropFilter: 'blur(8px)',
              }}
            >
              <ChevronDown className="h-5 w-5 text-white" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
