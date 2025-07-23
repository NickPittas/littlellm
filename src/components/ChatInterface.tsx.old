'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Card, CardContent } from './ui/card';
import {
  Send,
  Edit3,
  CheckSquare,
  Minus,
  Plus,
  Sparkles,
  RotateCw,
  MessageSquare,
  Paperclip,
  X,
  ChevronDown
} from 'lucide-react';
import { promptsService } from '../services/promptsService';
import { chatService, type Message, type ChatSettings } from '../services/chatService';
import { MessageWithThinking } from './MessageWithThinking';
import { UserMessage } from './UserMessage';
import { ThinkingIndicator } from './ThinkingIndicator';
import { settingsService } from '../services/settingsService';
import { sessionService } from '../services/sessionService';
import type { SessionStats } from '../services/sessionService';

interface ChatInterfaceProps {
  input: string;
  onInputChange: (value: string) => void;
  showActionMenu: boolean;
  onActionMenuClose: () => void;
  onPromptSelect: (prompt: string) => void;
  messages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
  hideInput?: boolean;
  attachedFiles?: File[];
  onAttachedFilesChange?: (files: File[]) => void;
  onScreenshotCapture?: (file: File) => void;
}

interface AttachedFile {
  file: File;
  preview?: string;
}

const quickActions = [
  { name: 'Improve Writing', icon: <Edit3 className="h-4 w-4" />, category: 'writing' },
  { name: 'Fix Grammar & Spelling', icon: <CheckSquare className="h-4 w-4" />, category: 'writing' },
  { name: 'Make Longer', icon: <Plus className="h-4 w-4" />, category: 'text' },
  { name: 'Make Shorter', icon: <Minus className="h-4 w-4" />, category: 'text' },
  { name: 'Simplify Language', icon: <Sparkles className="h-4 w-4" />, category: 'writing' },
  { name: 'Rephrase', icon: <RotateCw className="h-4 w-4" />, category: 'writing' }
];

export function ChatInterface({
  input,
  onInputChange,
  showActionMenu,
  onActionMenuClose,
  onPromptSelect,
  messages: externalMessages,
  onMessagesChange,
  hideInput = false,
  attachedFiles: externalAttachedFiles,
  onAttachedFilesChange
}: ChatInterfaceProps) {
  const [internalMessages, setInternalMessages] = useState<Message[]>([]);
  const messages = externalMessages || internalMessages;
  const [sessionStats, setSessionStats] = useState<SessionStats>(sessionService.getSessionStats());
  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [internalAttachedFiles, setInternalAttachedFiles] = useState<AttachedFile[]>([]);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // Use external attached files if provided, otherwise use internal state
  const attachedFiles = externalAttachedFiles
    ? externalAttachedFiles.map(file => ({ file, preview: undefined }))
    : internalAttachedFiles;

  const [settings, setSettings] = useState<ChatSettings>({
    provider: '',
    model: '',
    temperature: 0.3,
    maxTokens: 8192,
    systemPrompt: '',
    toolCallingEnabled: true,
    ragEnabled: false,
    providers: {
      openai: { apiKey: '' },
      anthropic: { apiKey: '' },
      gemini: { apiKey: '' },
      mistral: { apiKey: '' },
      deepseek: { apiKey: '' },
      groq: { apiKey: '' },
      lmstudio: { apiKey: '', baseUrl: 'http://localhost:1234/v1' },
      ollama: { apiKey: '', baseUrl: '' },
      openrouter: { apiKey: '' },
      requesty: { apiKey: '' },
      replicate: { apiKey: '' },
      n8n: { apiKey: '', baseUrl: '' },
    },
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const appSettings = settingsService.getSettings();
        if (appSettings.chat) {
          setSettings(appSettings.chat);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Set up proper dragging - only title bar should be draggable
  useEffect(() => {
    const setupDragRegions = () => {
      // Make body non-draggable
      document.body.style.setProperty('-webkit-app-region', 'no-drag');

      // Make only the title bar draggable
      const titleBar = document.querySelector('.chat-title-bar-drag-zone');
      if (titleBar) {
        (titleBar as HTMLElement).style.setProperty('-webkit-app-region', 'drag', 'important');
      }

      // Ensure all interactive elements are non-draggable
      const interactiveElements = document.querySelectorAll([
        'input', 'textarea', 'button', 'select', 'a', '[contenteditable]',
        '[role="button"]', '[data-interactive]', '.cursor-pointer'
      ].join(', '));

      interactiveElements.forEach(element => {
        (element as HTMLElement).style.setProperty('-webkit-app-region', 'no-drag');
      });
    };

    // Set initially
    setupDragRegions();

    // Re-apply when DOM changes
    const observer = new MutationObserver(setupDragRegions);
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  // Title bar drag handler - visual feedback only (CSS handles the actual dragging)
  const handleTitleBarMouseDown = (e: React.MouseEvent) => {
    // Visual feedback - change cursor to grabbing
    const titleBar = e.currentTarget as HTMLElement;
    titleBar.style.cursor = 'grabbing';
  };

  const handleTitleBarMouseUp = (e: React.MouseEvent) => {
    // Reset cursor
    const titleBar = e.currentTarget as HTMLElement;
    titleBar.style.cursor = 'grab';
  };

  const handleClose = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.closeChatWindow();
    }
  };

  const handleMinimize = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.minimizeWindow();
    }
  };

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
  const checkScrollPosition = useCallback(() => {
    if (!scrollContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
    setShowScrollToBottom(!isAtBottom && messages.length > 0);
  }, [messages.length]);

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
  }, [messages.length, messages[messages.length - 1]?.content, scrollToBottomOnComplete]);

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
  }, [messages.length, checkScrollPosition]);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target as Node)) {
        onActionMenuClose();
      }
    };

    if (showActionMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showActionMenu, onActionMenuClose]);

  // Auto-focus chat input only when component first mounts (not on every change)
  useEffect(() => {
    if (!hideInput && textareaRef.current) {
      // Small delay to ensure the component is fully rendered
      setTimeout(() => {
        textareaRef.current?.focus();
        console.log('ChatInterface input auto-focused on mount');
      }, 100);
    }
  }, [hideInput]);

  const handleFileAttach = (files: FileList | null) => {
    if (!files) return;

    const newFiles: AttachedFile[] = [];
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          newFiles.push({
            file,
            preview: e.target?.result as string
          });
          if (newFiles.length === files.length) {
            if (onAttachedFilesChange) {
              onAttachedFilesChange([...attachedFiles.map(af => af.file), ...newFiles.map(nf => nf.file)]);
            } else {
              setInternalAttachedFiles((prev: AttachedFile[]) => [...prev, ...newFiles]);
            }
          }
        };
        reader.readAsDataURL(file);
      } else {
        newFiles.push({ file });
        if (newFiles.length === files.length) {
          if (onAttachedFilesChange) {
            onAttachedFilesChange([...attachedFiles.map(af => af.file), ...newFiles.map(nf => nf.file)]);
          } else {
            setInternalAttachedFiles((prev: AttachedFile[]) => [...prev, ...newFiles]);
          }
        }
      }
    });
  };

  const removeAttachedFile = (index: number) => {
    if (onAttachedFilesChange) {
      const newFiles = attachedFiles.filter((_, i) => i !== index).map(af => af.file);
      onAttachedFilesChange(newFiles);
    } else {
      setInternalAttachedFiles((prev: AttachedFile[]) => prev.filter((_, i: number) => i !== index));
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;

    const messageContent = input;
    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageContent,
      role: 'user',
      timestamp: new Date(),
    };

    if (onMessagesChange) {
      onMessagesChange([...messages, userMessage]);
    } else {
      setInternalMessages((prev: Message[]) => [...prev, userMessage]);
    }
    setIsLoading(true);
    onInputChange('');
    if (onAttachedFilesChange) {
      onAttachedFilesChange([]);
    } else {
      setInternalAttachedFiles([]);
    }

    // Create abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    try {
      let assistantContent = '';
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '',
        role: 'assistant',
        timestamp: new Date(),
      };

      // Add the assistant message immediately for streaming
      if (onMessagesChange) {
        onMessagesChange([...messages, assistantMessage]);
      } else {
        setInternalMessages((prev: Message[]) => [...prev, assistantMessage]);
      }

      // Get conversation history (exclude the current user message we just added)
      const conversationHistory = messages.slice(0, -1);

      const response = await chatService.sendMessage(
        messageContent,
        attachedFiles.map(af => af.file),
        settings,
        conversationHistory,
        (chunk: string) => {
          // Ensure chunk is a string and handle edge cases
          if (typeof chunk !== 'string') {
            console.warn('⚠️ Received non-string chunk in ChatInterface onStream:', typeof chunk, chunk);
            return;
          }

          // Handle streaming response
          assistantContent += chunk;
          if (onMessagesChange) {
            const updatedMessages = messages.map((msg: Message) =>
              msg.id === assistantMessage.id
                ? { ...msg, content: assistantContent }
                : msg
            );
            onMessagesChange(updatedMessages);
          } else {
            setInternalMessages((prev: Message[]) =>
              prev.map((msg: Message) =>
                msg.id === assistantMessage.id
                  ? { ...msg, content: assistantContent }
                  : msg
              )
            );
          }
        },
        controller.signal
      );

      // Update final message with complete response
      if (onMessagesChange) {
        const updatedMessages = messages.map((msg: Message) =>
          msg.id === assistantMessage.id
            ? { ...msg, content: response.content, usage: response.usage }
            : msg
        );
        onMessagesChange(updatedMessages);
      } else {
        setInternalMessages((prev: Message[]) =>
          prev.map((msg: Message) =>
            msg.id === assistantMessage.id
              ? { ...msg, content: response.content, usage: response.usage }
              : msg
          )
        );
      }

      // Auto-scroll to bottom when response is complete
      scrollToBottomOnComplete();
    } catch (error) {
      console.error('Error sending message:', error);

      // Check if the error is due to abort
      if (error instanceof Error && error.name === 'AbortError') {
        // Remove the assistant message that was being generated
        if (onMessagesChange) {
          const filteredMessages = messages.filter((msg: Message) => msg.id !== (Date.now() + 1).toString());
          onMessagesChange(filteredMessages);
        } else {
          setInternalMessages((prev: Message[]) => prev.filter((msg: Message) => msg.id !== (Date.now() + 1).toString()));
        }
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 2).toString(),
          content: `Sorry, there was an error processing your message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          role: 'assistant',
          timestamp: new Date(),
        };
        if (onMessagesChange) {
          onMessagesChange([...messages, errorMessage]);
        } else {
          setInternalMessages((prev: Message[]) => [...prev, errorMessage]);
        }
      }
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const handleQuickAction = async (actionName: string) => {
    const prompts = promptsService.getAllPrompts();
    const prompt = prompts.find(p => p.name === actionName);
    
    if (prompt) {
      let processedPrompt = prompt.prompt;
      
      // If the prompt uses clipboard content, try to get it
      if (prompt.prompt.includes('{content}')) {
        try {
          let clipboardContent = '';
          if (typeof window !== 'undefined' && window.electronAPI) {
            clipboardContent = (await window.electronAPI.readClipboard()).trim();
          } else if (navigator.clipboard) {
            clipboardContent = (await navigator.clipboard.readText()).trim();
          }
          
          if (clipboardContent) {
            processedPrompt = promptsService.processPrompt(prompt.id, clipboardContent);
          } else {
            processedPrompt = processedPrompt.replace('{content}', input || '[No content available]');
          }
        } catch (error) {
          console.error('Failed to read clipboard:', error);
          processedPrompt = processedPrompt.replace('{content}', input || '[Content access failed]');
        }
      }
      
      onPromptSelect(processedPrompt);
    }
    onActionMenuClose();
  };


  const handleStopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full w-full bg-background flex flex-col overflow-hidden min-h-[400px] min-w-[300px]">
      {/* Custom Title Bar - Draggable */}
      <div
        className="chat-title-bar-drag-zone flex-none flex items-center justify-between p-3 border-b border-border bg-background/95 backdrop-blur-sm select-none cursor-grab active:cursor-grabbing hover:bg-background/90 transition-colors"
        style={{
          WebkitAppRegion: 'drag'
        } as React.CSSProperties & { WebkitAppRegion?: string }}
        onMouseDown={handleTitleBarMouseDown}
        onMouseUp={handleTitleBarMouseUp}
        data-drag-zone="true"
      >
        <div className="flex items-center gap-2">
          <div className="flex flex-col gap-0.5">
            <div className="w-1 h-1 bg-muted-foreground rounded-full"></div>
            <div className="w-1 h-1 bg-muted-foreground rounded-full"></div>
            <div className="w-1 h-1 bg-muted-foreground rounded-full"></div>
          </div>
          <div className="text-sm font-medium text-foreground">Chat</div>
        </div>
        
        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMinimize}
            className="h-6 w-6 p-0 hover:bg-muted"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
          >
            <Minus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
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
              <p>Start your conversation</p>
              <p className="text-sm">Type your message and press Enter to send</p>
              <p className="text-sm mt-2">Press Space to see quick actions</p>
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
          </div>
        )}

        {/* Scroll to bottom button - positioned relative to window */}
        {showScrollToBottom && (
          <Button
            onClick={scrollToBottom}
            className="absolute bottom-20 left-1/2 transform -translate-x-1/2 h-12 w-12 rounded-full bg-primary/90 hover:bg-primary shadow-lg transition-all duration-200 z-50 flex items-center justify-center p-0"
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

      {/* Quick Actions Menu */}
      {showActionMenu && (
        <div
          ref={actionMenuRef}
          className="absolute bottom-16 left-4 right-4 bg-background border border-border rounded-lg shadow-lg p-3 z-10"
        >
          <div className="text-sm text-muted-foreground mb-2">Type to search for an action...</div>
          <div className="grid grid-cols-2 gap-2">
            {quickActions.map((action, index) => (
              <Button
                key={index}
                variant="ghost"
                size="sm"
                className="justify-start h-auto p-2"
                onClick={() => handleQuickAction(action.name)}
              >
                <div className="flex items-center gap-2">
                  {action.icon}
                  <span className="text-sm">{action.name}</span>
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      {!hideInput && (
        <div className="flex-none p-4 border-t border-border">
          {/* Attached Files */}
          {attachedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachedFiles.map((attachedFile, index) => (
                <div key={index} className="relative group">
                  {attachedFile.preview ? (
                    <div className="relative">
                      <img
                        src={attachedFile.preview}
                        alt={attachedFile.file.name}
                        className="w-16 h-16 object-cover rounded border"
                      />
                      <Button
                        variant="destructive"
                        size="sm"
                        className="absolute -top-2 -right-2 w-5 h-5 p-0 rounded-full opacity-0 group-hover:opacity-100"
                        onClick={() => removeAttachedFile(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="relative flex items-center gap-2 p-2 border rounded bg-muted">
                      <Paperclip className="h-4 w-4" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-4 h-4 p-0 opacity-0 group-hover:opacity-100"
                        onClick={() => removeAttachedFile(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="Type your message..."
                className="chat-interface flex-1 min-h-[40px] max-h-[120px] resize-none pr-10"
                style={{
                  backgroundColor: 'hsl(var(--input))',
                  color: 'hsl(var(--foreground))',
                  border: '1px solid hsl(var(--border))'
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-2 top-2 w-6 h-6 p-0"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.accept = 'image/*,.pdf,.txt,.doc,.docx,.xlsx,.xls,.ods,.pptx,.ppt,.csv,.json,.html,.htm,.xml,.ics,.rtf,.md,.log';
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    handleFileAttach(files);
                  };
                  input.click();
                }}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
            {isLoading ? (
              <Button
                onClick={handleStopGeneration}
                variant="outline"
                size="sm"
              >
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              </Button>
            ) : (
              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() && attachedFiles.length === 0}
                size="sm"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}

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
