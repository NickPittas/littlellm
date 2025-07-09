'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { 
  Send, 
  Copy, 
  RotateCcw, 
  Volume2,
  Edit3,
  CheckSquare,
  Lightbulb,
  FileText,
  Minus,
  Plus,
  Sparkles,
  RotateCw,
  MessageSquare
} from 'lucide-react';
import { promptsService, type Prompt } from '../services/promptsService';
import { chatService, type Message, type ChatSettings } from '../services/chatService';
import { settingsService } from '../services/settingsService';

interface ChatInterfaceProps {
  input: string;
  onInputChange: (value: string) => void;
  showActionMenu: boolean;
  onActionMenuClose: () => void;
  onPromptSelect: (prompt: string) => void;
  messages?: Message[];
  onMessagesChange?: (messages: Message[]) => void;
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
  onMessagesChange
}: ChatInterfaceProps) {
  const [internalMessages, setInternalMessages] = useState<Message[]>([]);
  const messages = externalMessages || internalMessages;
  const setMessages = onMessagesChange || setInternalMessages;
  const [isLoading, setIsLoading] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [settings, setSettings] = useState<ChatSettings>({
    provider: 'openrouter',
    model: 'mistralai/mistral-7b-instruct:free',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: 'You are a helpful AI assistant. Please provide concise and helpful responses.',
    providers: {
      openai: { apiKey: '' },
      openrouter: { apiKey: '' },
      requesty: { apiKey: '' },
      ollama: { apiKey: '', baseUrl: 'http://localhost:11434' },
      replicate: { apiKey: '' },
    },
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const appSettings = await settingsService.getSettings();
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

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const messageContent = input;
    const userMessage: Message = {
      id: Date.now().toString(),
      content: messageContent,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    onInputChange('');

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
      setMessages(prev => [...prev, assistantMessage]);

      // Get conversation history (exclude the current user message we just added)
      const conversationHistory = messages.slice(0, -1);

      const response = await chatService.sendMessage(
        messageContent,
        undefined, // No files for now
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

      // Update final message with complete response
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, content: response.content, usage: response.usage }
            : msg
        )
      );
    } catch (error) {
      console.error('Error sending message:', error);

      // Check if the error is due to abort
      if (error instanceof Error && error.name === 'AbortError') {
        // Remove the assistant message that was being generated
        setMessages(prev => prev.filter(msg => msg.id !== (Date.now() + 1).toString()));
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
                <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                  <span>{message.timestamp.toLocaleTimeString()}</span>
                  {message.role === 'assistant' && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(message.content)}
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
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted text-foreground p-3 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span>Thinking...</span>
              </div>
            </div>
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
      <div className="p-4 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 min-h-[40px] max-h-[120px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
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
              disabled={!input.trim()}
              size="sm"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
