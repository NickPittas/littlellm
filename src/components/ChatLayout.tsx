'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Settings, Clipboard, X, Paperclip, Image, FileText, File as FileIcon, Square } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { SearchableSelect } from './ui/searchable-select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Label } from './ui/label';
import { chatService, type ChatSettings, type Message } from '../services/chatService';
import { PromptsSelector } from './PromptsSelector';
import { ThemeSelector } from './ThemeSelector';
import { settingsService } from '../services/settingsService';
import { MessageWithThinking } from './MessageWithThinking';
import { UserMessage } from './UserMessage';



// Helper function to convert file to base64
// const fileToBase64 = (file: File): Promise<string> => {
  // return new Promise((resolve, reject) => {
  //   const reader = new FileReader();
  //   reader.readAsDataURL(file);
  //   reader.onload = () => resolve(reader.result as string);
  //   reader.onerror = error => reject(error);
  // });
// };

export function ChatLayout() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
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
  const [showSettings, setShowSettings] = useState(false);
  const [clipboardContent, setClipboardContent] = useState('');
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle Escape key to close window
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (typeof window !== 'undefined' && window.electronAPI) {
          window.electronAPI.hideWindow();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Set up Electron event listeners and settings subscription
  useEffect(() => {
    // Load settings on client side only
    if (typeof window !== 'undefined') {
      const loadedSettings = settingsService.getChatSettings();

      // Ensure providers object exists for backward compatibility
      const settingsWithProviders = {
        ...loadedSettings,
        providers: loadedSettings.providers || {
          openai: { apiKey: '' },
          openrouter: { apiKey: '' },
          requesty: { apiKey: '' },
          ollama: { apiKey: '', baseUrl: 'http://localhost:11434' },
          replicate: { apiKey: '' },
        }
      };

      setSettings(settingsWithProviders);

      // Subscribe to settings changes to keep components in sync
      const unsubscribe = settingsService.subscribe((newSettings) => {
        if (newSettings.chat) {
          const chatSettings = {
            ...newSettings.chat,
            providers: newSettings.chat.providers || {
              openai: { apiKey: '' },
              openrouter: { apiKey: '' },
              requesty: { apiKey: '' },
              ollama: { apiKey: '', baseUrl: '' },
              replicate: { apiKey: '' },
            }
          };
          setSettings(chatSettings);
        }
      });

      if (window.electronAPI) {
        // Listen for clipboard content from main process
        window.electronAPI.onClipboardContent((content: string) => {
          setClipboardContent(content);
          setInput(content);
        });

        // Listen for clipboard processing requests
        window.electronAPI.onProcessClipboard((content: string) => {
          setClipboardContent(content);
          setInput(`Please help me with this: ${content}`);
        });

        // Listen for settings dialog requests
        window.electronAPI.onOpenSettings(() => {
          setShowSettings(true);
        });
      }

      // Cleanup listeners on unmount
      return () => {
        unsubscribe();
        if (window.electronAPI) {
          window.electronAPI.removeAllListeners('clipboard-content');
          window.electronAPI.removeAllListeners('process-clipboard');
          window.electronAPI.removeAllListeners('open-settings');
        }
      };
    }
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim() && attachedFiles.length === 0) return;

    const messageContent = input;

    // Files will be processed by the chat service

    // Estimate tokens for user message (rough estimation: 1 token ≈ 4 characters)
    const estimatedTokens = Math.ceil(messageContent.length / 4);

    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageContent,
      role: 'user',
      timestamp: new Date(),
      usage: {
        promptTokens: estimatedTokens,
        completionTokens: 0,
        totalTokens: estimatedTokens,
      },
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachedFiles([]);
    setIsLoading(true);

    // Create abort controller for this request
    const controller = new AbortController();
    setAbortController(controller);

    // Reset textarea height to single line
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      let assistantContent = '';
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: '',
        role: 'assistant',
        timestamp: new Date(),
      };

      // Add the assistant message immediately for streaming
      setMessages(prev => [...prev, assistantMessage]);

      // Get conversation history (exclude the current user message we just added)
      const conversationHistory = messages.slice(0, -1);

      const response = await chatService.sendMessage(
        messageContent,
        attachedFiles,
        settings,
        conversationHistory,
        (chunk: string) => {
          // Handle streaming response
          assistantContent += chunk;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === assistantMessage.id
                ? { ...msg, content: assistantContent }
                : msg
            )
          );
        },
        controller.signal
      );

      // Update with final content if not streaming
      if (!assistantContent) {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessage.id
              ? { ...msg, content: response.content }
              : msg
          )
        );
      }
    } catch (error) {
      console.error('Error sending message:', error);

      // Check if the error is due to abort
      if (error instanceof Error && error.name === 'AbortError') {
        // Remove the assistant message that was being generated
        setMessages(prev => prev.filter(msg => msg.id !== assistantMessage.id));
      } else {
        const errorMessage: Message = {
          id: (Date.now() + 2).toString(),
          content: `Sorry, there was an error processing your message: ${error instanceof Error ? error.message : 'Unknown error'}`,
          role: 'assistant',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
      setAbortController(null);
    }
  };

  const readClipboard = async () => {
    try {
      let text = '';
      if (typeof window !== 'undefined' && window.electronAPI) {
        text = await window.electronAPI.readClipboard();
      } else {
        text = await navigator.clipboard.readText();
      }
      setClipboardContent(text);
      setInput(text);
    } catch (error) {
      console.error('Failed to read clipboard:', error);
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const stopGeneration = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
      setIsLoading(false);
    }
  };

  const updateSettings = (updates: Partial<ChatSettings>) => {
    try {
      // Update settings in memory only - will propagate to all components via subscription
      settingsService.updateChatSettingsInMemory(updates);
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  const fetchModelsForProvider = async (providerId: string) => {
    setIsLoadingModels(true);
    try {
      const providerSettings = settings.providers?.[providerId] || { apiKey: '' };

      // Only fetch models if we have an API key (except for Ollama which doesn't require one)
      if (providerId !== 'ollama' && !providerSettings.apiKey) {
        console.log(`No API key configured for ${providerId}, using fallback models`);
        const models = await chatService.fetchModels(providerId, '', '');
        return models;
      }

      const models = await chatService.fetchModels(providerId, providerSettings.apiKey, providerSettings.baseUrl);
      // Models are automatically updated in the service
      return models;
    } catch (error) {
      console.error('Failed to fetch models:', error);
      return [];
    } finally {
      setIsLoadingModels(false);
    }
  };

  // Fetch models when provider or API key changes
  useEffect(() => {
    if (settings.provider && typeof window !== 'undefined') {
      fetchModelsForProvider(settings.provider);
    }
  }, [settings.provider, settings.providers]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    for (const file of files) {
      // Check file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(`File ${file.name} is too large. Maximum size is 10MB.`);
        continue;
      }

      // Check file type
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf',
        'text/plain',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

      if (!allowedTypes.includes(file.type)) {
        alert(`File type ${file.type} is not supported.`);
        continue;
      }

      setAttachedFiles(prev => [...prev, file]);

      // For images, add to input as description
      if (file.type.startsWith('image/')) {
        setInput(prev => prev + (prev ? '\n\n' : '') + `[Image attached: ${file.name}]`);
      }
      // For text files, show preview in input
      else if (file.type === 'text/plain') {
        setInput(prev => prev + (prev ? '\n\n' : '') + `[Text file attached: ${file.name}]`);
      }
      // For other files, just mention them
      else {
        setInput(prev => prev + (prev ? '\n\n' : '') + `[Document attached: ${file.name}]`);
      }
    }

    // Clear the input
    event.target.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) return;

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            // Create a proper filename for pasted images
            const fileName = file.name || `screenshot-${Date.now()}.png`;

            // Create a new file with proper name using Object.defineProperty to avoid constructor issues
            const renamedFile = file;
            if (!file.name) {
              Object.defineProperty(renamedFile, 'name', {
                value: fileName,
                writable: false
              });
            }

            setAttachedFiles(prev => [...prev, renamedFile]);
            setInput(prev => prev + (prev ? '\n\n' : '') + `[Pasted image: ${fileName}]`);
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col gap-3 p-4 bg-background border-b border-border">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">LittleLLM Chat</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={readClipboard}
              title="Read from clipboard"
            >
              <Clipboard className="h-4 w-4" />
            </Button>
            <PromptsSelector
              onPromptSelect={(prompt) => setInput(prompt)}
              clipboardContent={clipboardContent}
            />
            <ThemeSelector />
            <Button
              variant="outline"
              size="sm"
              onClick={clearChat}
              title="Clear chat"
            >
              <X className="h-4 w-4" />
            </Button>
            <Dialog open={showSettings} onOpenChange={setShowSettings}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>API Configuration</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="text-sm text-gray-600">
                    Configure API keys and settings for {chatService.getProvider(settings.provider)?.name}
                  </div>

                  {chatService.getProvider(settings.provider)?.requiresApiKey && (
                    <div>
                      <Label htmlFor="apiKey">API Key</Label>
                      <Input
                        id="apiKey"
                        type="password"
                        value={settings.providers?.[settings.provider]?.apiKey || ''}
                        onChange={(e) => {
                          const newProviders = {
                            ...settings.providers,
                            [settings.provider]: {
                              ...settings.providers?.[settings.provider],
                              apiKey: e.target.value
                            }
                          };
                          updateSettings({ providers: newProviders });
                        }}
                        placeholder={`Enter your ${chatService.getProvider(settings.provider)?.name} API key`}
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {settings.provider === 'openai' && 'Get your API key from platform.openai.com'}
                        {settings.provider === 'openrouter' && 'Get your API key from openrouter.ai'}
                        {settings.provider === 'requesty' && 'Get your API key from app.requesty.ai'}
                        {settings.provider === 'replicate' && 'Get your API key from replicate.com'}
                      </div>
                    </div>
                  )}

                  {settings.provider === 'ollama' && (
                    <div>
                      <Label htmlFor="baseUrl">Ollama Server URL</Label>
                      <Input
                        id="baseUrl"
                        value={settings.providers?.[settings.provider]?.baseUrl || 'http://localhost:11434'}
                        onChange={(e) => {
                          const newProviders = {
                            ...settings.providers,
                            [settings.provider]: {
                              ...settings.providers?.[settings.provider],
                              baseUrl: e.target.value
                            }
                          };
                          updateSettings({ providers: newProviders });
                        }}
                        placeholder="http://localhost:11434"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        Make sure Ollama is running on this URL
                      </div>
                    </div>
                  )}

                  <div>
                    <Label htmlFor="maxTokens">Max Tokens</Label>
                    <Input
                      id="maxTokens"
                      type="number"
                      value={settings.maxTokens}
                      onChange={(e) => updateSettings({ maxTokens: parseInt(e.target.value) })}
                      min="1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="systemPrompt">System Prompt (optional)</Label>
                    <Textarea
                      id="systemPrompt"
                      value={settings.systemPrompt || ''}
                      onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
                      placeholder="Enter system prompt..."
                      rows={3}
                    />
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Provider and Model Selection */}
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium">Provider:</Label>
            <Select
              value={settings.provider}
              onValueChange={async (value) => {
                console.log('Provider selection changed to:', value);

                // Fetch models for the new provider first
                const models = await fetchModelsForProvider(value);

                // Update both provider and model in a single call to prevent race conditions
                const updates: Partial<ChatSettings> = { provider: value };
                if (models.length > 0) {
                  // Use the last selected model for this provider if available, otherwise use the first model
                  const providerSettings = settings.providers?.[value] || { apiKey: '' };
                  const lastSelectedModel = providerSettings.lastSelectedModel;
                  const modelToSelect = lastSelectedModel && models.includes(lastSelectedModel)
                    ? lastSelectedModel
                    : models[0];
                  updates.model = modelToSelect;
                }

                console.log('Updating settings with:', updates);
                await updateSettings(updates);
                console.log('Settings updated, new provider:', settings.provider);
              }}
            >
              <SelectTrigger className="h-8 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {chatService.getProviders().map(provider => (
                  <SelectItem key={provider.id} value={provider.id}>
                    {provider.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium">Model:</Label>
            {isLoadingModels ? (
              <div className="h-8 w-40 flex items-center justify-center text-xs text-muted-foreground border rounded-md">
                Loading models...
              </div>
            ) : (
              <SearchableSelect
                value={settings.model}
                onValueChange={(value) => {
                  // Update the model and save it as the last selected model for the current provider
                  const updatedProviders = {
                    ...settings.providers,
                    [settings.provider]: {
                      ...settings.providers[settings.provider],
                      lastSelectedModel: value
                    }
                  };
                  updateSettings({
                    model: value,
                    providers: updatedProviders
                  });
                }}
                placeholder="Select a model..."
                options={chatService.getProvider(settings.provider)?.models || []}
                disabled={isLoadingModels}
                className="h-8 w-64"
              />
            )}
          </div>
        </div>

        {/* Temperature Control */}
        <div className="flex items-center gap-2">
          <Label className="text-xs font-medium">Temperature:</Label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={settings.temperature}
            onChange={(e) => updateSettings({ temperature: parseFloat(e.target.value) })}
            className="w-24 h-2"
          />
          <span className="text-xs w-8">{settings.temperature}</span>
          <span className="text-xs text-gray-500 ml-2">
            {settings.temperature < 0.3 ? 'Focused' :
             settings.temperature < 0.7 ? 'Balanced' :
             settings.temperature < 1.2 ? 'Creative' : 'Very Creative'}
          </span>
        </div>

        {/* Token Counter */}
        {messages.length > 0 && (
          <div className="flex items-center gap-2">
            <Label className="text-xs font-medium">Total Tokens:</Label>
            <span className="text-xs bg-muted px-2 py-1 rounded">
              {messages.reduce((total, msg) => total + (msg.usage?.totalTokens || 0), 0)}
            </span>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-background hide-scrollbar">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground mt-8">
            <p>Welcome to LittleLLM Chat!</p>
            <p className="text-sm mt-2">Start a conversation or paste content from your clipboard.</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card text-card-foreground border border-border shadow-sm'
                }`}
              >
                {message.role === 'assistant' ? (
                  <MessageWithThinking content={message.content} />
                ) : (
                  <UserMessage content={message.content} />
                )}
                <div className="text-xs opacity-70 mt-1 flex items-center justify-between">
                  <span>{message.timestamp.toLocaleTimeString()}</span>
                  {message.usage && (
                    <span className="flex items-center space-x-2">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">
                        {message.role === 'user' ? (
                          `~${message.usage.totalTokens} tokens`
                        ) : (
                          `${message.usage.promptTokens}+${message.usage.completionTokens}=${message.usage.totalTokens} tokens`
                        )}
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-card text-card-foreground border border-border p-3 rounded-lg shadow-sm">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-background border-t border-border">
        <div className="flex items-end space-x-2">
          <div className="flex-1 relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-resize based on content
                const textarea = e.target;
                textarea.style.height = 'auto';
                const scrollHeight = Math.min(textarea.scrollHeight, 240); // Max 10 lines (~24px per line)
                textarea.style.height = scrollHeight + 'px';
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
              className="w-full min-h-[40px] max-h-[240px] resize-none overflow-y-auto hide-scrollbar"
              rows={1}
              style={{ height: '40px' }}
            />
            {/* File attachment button */}
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <input
                type="file"
                id="file-upload"
                multiple
                accept="image/*,.pdf,.txt,.doc,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => document.getElementById('file-upload')?.click()}
                className="h-8 w-8 p-0 bg-background border border-border shadow-sm hover:bg-accent"
                title="Attach files (images, PDFs, documents)"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {isLoading ? (
            <Button
              onClick={stopGeneration}
              variant="destructive"
              size="sm"
              title="Stop generation"
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim()}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* File preview area */}
        {attachedFiles.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => {
              const getFileIcon = () => {
                if (file.type.startsWith('image/')) return <Image className="h-4 w-4" />;
                if (file.type === 'application/pdf') return <FileText className="h-4 w-4" />;
                if (file.type === 'text/plain') return <FileText className="h-4 w-4" />;
                return <FileIcon className="h-4 w-4" />;
              };

              return (
                <div key={index} className="flex items-center gap-2 bg-secondary rounded px-2 py-1 text-sm">
                  {getFileIcon()}
                  <span className="truncate max-w-32">{file.name}</span>
                  {file.type.startsWith('image/') && (
                    <span className="text-xs text-muted-foreground">(preview only)</span>
                  )}
                  <button
                    onClick={() => removeFile(index)}
                    className="text-destructive hover:text-destructive/80 ml-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
