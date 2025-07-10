'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

import { Card, CardContent } from './ui/card';
import {
  Send,
  Copy,
  RotateCcw,
  Volume2,
  Edit3,
  CheckSquare,

  Minus,
  Plus,
  Sparkles,
  RotateCw,
  MessageSquare,
  Paperclip,
  X
} from 'lucide-react';
import { promptsService } from '../services/promptsService';
import { chatService, type Message, type ChatSettings } from '../services/chatService';
import { MessageWithThinking } from './MessageWithThinking';
import { UserMessage } from './UserMessage';
import { settingsService } from '../services/settingsService';

interface ChatInterfaceProps {
  input: string;
  onInputChange: (value: string) => void;
  showActionMenu: boolean;
  onActionMenuClose: () => void;
  onPromptSelect: (prompt: string) => void;
  messages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
  hideInput?: boolean; // Hide the bottom input area
  attachedFiles?: File[]; // Files to attach to the next message
  onAttachedFilesChange?: (files: File[]) => void;
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

  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [internalAttachedFiles, setInternalAttachedFiles] = useState<AttachedFile[]>([]);

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
    providers: {
      openai: { apiKey: '' },
      openrouter: { apiKey: '' },
      requesty: { apiKey: '' },
      ollama: { apiKey: '', baseUrl: '' },
      replicate: { apiKey: '' },
    },
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  };

  const handleStopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 hide-scrollbar">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Start your conversation</p>
            <p className="text-sm">Type your message and press Enter to send</p>
            <p className="text-sm mt-2">Press Space to see quick actions</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <Card
                style={{
                  backgroundColor: message.role === 'user' ? 'rgb(13, 148, 136)' : 'rgb(30, 41, 59)',
                  borderColor: message.role === 'user' ? 'rgb(20, 184, 166)' : 'rgb(71, 85, 105)'
                }}
                className="max-w-[80%] shadow-2xl text-white"
              >
                <CardContent className="p-3">
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
                  <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                    <span>{message.timestamp.toLocaleTimeString()}</span>
                    {message.role === 'assistant' && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => copyToClipboard(
                            typeof message.content === 'string'
                              ? message.content
                              : Array.isArray(message.content)
                                ? message.content.map((item, idx) =>
                                    item.type === 'text' ? item.text : `[Image ${idx + 1}]`
                                  ).join(' ')
                                : String(message.content)
                          )}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                        >
                          <Volume2 className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <Card style={{ backgroundColor: 'rgb(30, 41, 59)', borderColor: 'rgb(71, 85, 105)' }} className="text-white shadow-2xl">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-500"></div>
                  <span>Thinking...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        <div ref={messagesEndRef} />
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
        <div className="p-4 border-t border-border">
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
                      <span className="text-sm truncate max-w-[100px]">
                        {attachedFile.file.name}
                      </span>
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
                  value={input}
                  onChange={(e) => onInputChange(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 min-h-[40px] max-h-[120px] resize-none pr-10"
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
                    input.accept = 'image/*,.pdf,.txt,.doc,.docx';
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
    </div>
  );
}
