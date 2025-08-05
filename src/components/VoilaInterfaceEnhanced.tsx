'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Paperclip, Camera } from 'lucide-react';
import { Button } from './ui/button';
import { ToolCallingToggle } from './ui/tool-calling-toggle';
import { RAGToggle } from './ui/rag-toggle';
import { useEnhancedWindowDrag } from '../hooks/useEnhancedWindowDrag';
import { BottomToolbar } from './BottomToolbarNew';
import { useHistoryOverlay } from './HistoryOverlay';
import { KnowledgeBaseIndicator } from './KnowledgeBaseIndicator';
import { MessageContent } from './MessageContent';
import { ContentItem } from '../services/chatService';

// Magic UI Components
import { MagicContainer, MagicCard } from './magicui/magic-card';
import { BlurFade } from './magicui/blur-fade';
import { BorderBeam } from './magicui/border-beam';

// Services
import { chatService, type ChatSettings, type Message } from '../services/chatService';
import { settingsService } from '../services/settingsService';
import { conversationHistoryService } from '../services/conversationHistoryService';
import { sessionService } from '../services/sessionService';
import { stateService } from '../services/stateService';

// Extend Window interface for tool thinking trigger
declare global {
  interface Window {
    triggerToolThinking?: (toolName: string) => void;
  }
}

interface VoilaInterfaceProps {
  onClose?: () => void;
}

export function VoilaInterfaceEnhanced({ onClose }: VoilaInterfaceProps) {
  // State management (keeping existing state structure)
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [userResizedWindow, setUserResizedWindow] = useState(false);
  const [isKnowledgeBaseSearching, setIsKnowledgeBaseSearching] = useState(false);
  const [knowledgeBaseSearchQuery, setKnowledgeBaseSearchQuery] = useState<string>('');

  // Settings and refs
  const [settings, setSettings] = useState<ChatSettings>({
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
    systemPrompt: '',
    toolCallingEnabled: false,
    ragEnabled: false,
    providers: {
      openai: { lastSelectedModel: '' },
      anthropic: { lastSelectedModel: '' },
      gemini: { lastSelectedModel: '' },
      mistral: { lastSelectedModel: '' },
      deepseek: { lastSelectedModel: '' },
      deepinfra: { lastSelectedModel: '' },
      groq: { lastSelectedModel: '' },
      lmstudio: { baseUrl: '', lastSelectedModel: '' },
      ollama: { baseUrl: '', lastSelectedModel: '' },
      openrouter: { lastSelectedModel: '' },
      requesty: { lastSelectedModel: '' },
      replicate: { lastSelectedModel: '' },
      n8n: { baseUrl: '', lastSelectedModel: '' },
    },
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Enhanced window drag functionality
  const { isDragging } = useEnhancedWindowDrag();

  // Auto-resize functionality (keeping existing logic)
  const autoResizeWindow = useCallback(() => {
    if (typeof window !== 'undefined' && window.electronAPI && !userResizedWindow) {
      // Note: autoResizeWindow method doesn't exist in electronAPI
      // This would need to be implemented if auto-resize is needed
      console.log('Auto-resize requested but not implemented');
    }
  }, [userResizedWindow]);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedSettings = await settingsService.getChatSettings();
        setSettings(savedSettings);
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      autoResizeWindow();
    }
  }, [input, autoResizeWindow]);

  // Handle file upload
  const handleFileUpload = useCallback((files: FileList) => {
    const newFiles = Array.from(files);
    setAttachedFiles(prev => [...prev, ...newFiles]);
    setTimeout(() => autoResizeWindow(), 50);
  }, [autoResizeWindow]);

  // Handle screenshot capture
  const handleScreenshotCapture = useCallback((file: File) => {
    setAttachedFiles(prev => [...prev, file]);
    setTimeout(() => autoResizeWindow(), 50);
  }, [autoResizeWindow]);

  // Handle key down events
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, []);

  // Handle send message (simplified for now)
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() && attachedFiles.length === 0) return;

    // Create content array that includes both text and files
    const contentArray: Array<ContentItem> = [];

    // Add text content if present
    if (input.trim()) {
      contentArray.push({
        type: 'text',
        text: input.trim()
      });
    }

    // Add file content
    for (const file of attachedFiles) {
      if (file.type.startsWith('image/')) {
        // Convert image to base64 for display in chat
        const base64 = await chatService.fileToBase64(file);
        contentArray.push({
          type: 'image_url',
          image_url: {
            url: base64
          }
        });
      } else {
        // For non-image files, add a file reference
        contentArray.push({
          type: 'text',
          text: `\n\n[File attached: ${file.name}]`
        });
      }
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      content: contentArray.length === 1 && contentArray[0].type === 'text'
        ? contentArray[0].text || input.trim()
        : contentArray,
      role: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    setInput('');
    setAttachedFiles([]);
    setShowChat(true);
    setIsLoading(true);

    // Auto-resize after message is added
    setTimeout(() => autoResizeWindow(), 50);

    try {
      // Simulate AI response for now
      setTimeout(() => {
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          content: "This is a placeholder response. The enhanced UI is working!",
          role: 'assistant',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiResponse]);
        setIsLoading(false);
        setTimeout(() => autoResizeWindow(), 50);
      }, 1000);
    } catch (error) {
      console.error('Failed to send message:', error);
      setIsLoading(false);
    }
  }, [input, attachedFiles, autoResizeWindow]);

  // Handle settings change
  const handleSettingsChange = useCallback((partialSettings: Partial<ChatSettings>) => {
    const newSettings = { ...settings, ...partialSettings };
    setSettings(newSettings);
    settingsService.updateChatSettingsInMemory(newSettings);
    settingsService.saveSettingsToDisk();
  }, [settings]);

  // Placeholder handlers
  const openHistory = useCallback(() => {
    console.log('Opening history...');
  }, []);

  const handlePromptsClick = useCallback(() => {
    console.log('Opening prompts...');
  }, []);

  const handleResetChat = useCallback(() => {
    setMessages([]);
    setShowChat(false);
    setTimeout(() => autoResizeWindow(), 50);
  }, [autoResizeWindow]);

  return (
    <MagicContainer
      className={`voila-interface-container min-h-0 w-full flex flex-col ${isDragging ? 'cursor-grabbing' : ''}`}
      style={{
        userSelect: isDragging ? 'none' : 'auto',
        overflow: 'hidden',
        background: 'var(--background)',
        color: 'var(--foreground)',
        borderRadius: '32px',
        border: '0px solid transparent',
        boxShadow: 'none'
      }}
    >
      {/* Enhanced Input Area with Magic Card */}
      <BlurFade delay={0.1}>
        <div id="input-area" className="flex-none p-1">
          <MagicCard 
            className="p-2 relative" 
            style={{ 
              backgroundColor: 'var(--card)', 
              border: 'none', 
              borderRadius: '8px' 
            }}
            gradientColor="#262626"
            gradientOpacity={0.3}
          >
            {/* Active state indicator */}
            {isLoading && (
              <BorderBeam
                size={100}
                duration={2}
                colorFrom="#ffaa40"
                colorTo="#9c40ff"
              />
            )}

            {/* Attachment Preview with enhanced animations */}
            {attachedFiles.length > 0 && (
              <BlurFade delay={0.2}>
                <div
                  id="attachment-preview"
                  className="mb-3 p-2 bg-muted rounded-lg max-h-32 overflow-y-auto"
                  data-interactive="true"
                >
                  <div className="flex flex-wrap gap-2">
                    {attachedFiles.map((file, index) => (
                      <BlurFade key={index} delay={0.1 * index}>
                        <MagicCard className="flex items-center gap-2 p-2 rounded border">
                          {/* File preview content */}
                          {file.type.startsWith('image/') ? (
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              className="w-8 h-8 object-cover rounded"
                              onLoad={() => setTimeout(() => autoResizeWindow(), 50)}
                            />
                          ) : (
                            <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center">
                              <span className="text-xs font-medium text-primary">
                                {file.name.split('.').pop()?.toUpperCase() || 'FILE'}
                              </span>
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            {/* File info can be added here if needed */}
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setAttachedFiles(prev => prev.filter((_, i) => i !== index));
                              setTimeout(() => autoResizeWindow(), 50);
                            }}
                            className="h-6 w-6 p-0 hover:bg-destructive/20"
                            data-interactive="true"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </MagicCard>
                      </BlurFade>
                    ))}
                  </div>
                </div>
              </BlurFade>
            )}

            {/* Knowledge Base Search Indicator */}
            {isKnowledgeBaseSearching && (
              <BlurFade delay={0.3}>
                <div className="mb-3">
                  <KnowledgeBaseIndicator
                    isSearching={isKnowledgeBaseSearching}
                    searchQuery={knowledgeBaseSearchQuery}
                  />
                </div>
              </BlurFade>
            )}

            {/* Enhanced Input Area */}
            <div className="flex gap-2 items-end">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1 resize-none focus:outline-none cursor-text"
                style={{
                  lineHeight: '1.4',
                  backgroundColor: 'var(--input)',
                  border: 'none',
                  color: 'var(--foreground)',
                  borderRadius: '8px',
                  verticalAlign: 'top',
                  fontFamily: 'inherit',
                  fontSize: '14px',
                  padding: '8px 12px',
                  minHeight: '40px',
                  maxHeight: '200px',
                  height: 'auto',
                  overflowY: 'auto',
                  resize: 'none',
                  transition: 'none'
                }}
                data-interactive="true"
              />

              {/* Action Buttons */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.accept = 'image/*,.pdf,.txt,.doc,.docx,.xlsx,.xls,.ods,.pptx,.ppt,.csv,.json,.html,.htm,.xml,.ics,.rtf,.jpg,.png,.md,.log';
                  input.onchange = (e) => {
                    const files = (e.target as HTMLInputElement).files;
                    if (files) handleFileUpload(files);
                  };
                  input.click();
                }}
                className="h-8 w-8 p-0 cursor-pointer flex-shrink-0"
                title="Attach File"
                data-interactive="true"
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    if (typeof window !== 'undefined' && window.electronAPI) {
                      const result = await window.electronAPI.takeScreenshot();
                      if (typeof result === 'object' && result.success && result.dataURL) {
                        const response = await fetch(result.dataURL);
                        const blob = await response.blob();
                        const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
                        handleScreenshotCapture(file);
                      }
                    }
                  } catch (error) {
                    console.error('Failed to take screenshot:', error);
                  }
                }}
                className="h-8 w-8 p-0 cursor-pointer flex-shrink-0"
                title="Take Screenshot"
                data-interactive="true"
              >
                <Camera className="h-4 w-4" />
              </Button>

              <ToolCallingToggle
                enabled={settings.toolCallingEnabled}
                onToggle={(enabled) => {
                  const updatedSettings = { ...settings, toolCallingEnabled: enabled };
                  handleSettingsChange(updatedSettings);
                }}
                title={settings.toolCallingEnabled ? "Disable Tool Calling" : "Enable Tool Calling"}
                data-interactive="true"
              />

              <RAGToggle
                enabled={settings.ragEnabled || false}
                onToggle={(enabled) => {
                  const updatedSettings = { ...settings, ragEnabled: enabled };
                  handleSettingsChange(updatedSettings);
                }}
                title={settings.ragEnabled ? "Disable RAG (Knowledge Base)" : "Enable RAG (Knowledge Base)"}
              />

              <Button
                onClick={handleSendMessage}
                disabled={!input.trim() && attachedFiles.length === 0}
                className="h-8 w-8 cursor-pointer flex-shrink-0 p-0"
                data-interactive="true"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </MagicCard>
        </div>
      </BlurFade>

      {/* Chat Messages Area (to be enhanced in next iteration) */}
      {showChat && messages.length > 0 && (
        <BlurFade delay={0.4}>
          <div className="flex-1 p-1 overflow-y-auto">
            {messages.map((message, index) => (
              <BlurFade key={message.id} delay={0.1 * index}>
                <MagicCard className="mb-2 p-3">
                  <div className={`${message.role === 'user' ? 'text-blue-400' : 'text-green-400'} font-semibold mb-1`}>
                    {message.role === 'user' ? 'You' : 'AI'}
                  </div>
                  <MessageContent content={message.content} />
                </MagicCard>
              </BlurFade>
            ))}
            {isLoading && (
              <BlurFade>
                <MagicCard className="mb-2 p-3 relative">
                  <BorderBeam size={80} duration={1.5} />
                  <div className="text-green-400 font-semibold mb-1">AI</div>
                  <div className="text-muted-foreground">Thinking...</div>
                </MagicCard>
              </BlurFade>
            )}
          </div>
        </BlurFade>
      )}

      {/* Enhanced Bottom Toolbar */}
      <BlurFade delay={0.5}>
        <div id="bottom-toolbar" className="flex-none cursor-default">
          <MagicCard 
            className="rounded-lg m-0" 
            style={{ 
              backgroundColor: 'var(--card)', 
              border: 'none', 
              borderRadius: '0 0 12px 12px', 
              margin: 0 
            }}
            gradientColor="#262626"
            gradientOpacity={0.2}
          >
            <BottomToolbar
              settings={settings}
              onSettingsChange={handleSettingsChange}
              onHistoryClick={openHistory}
              onFileUpload={handleFileUpload}
              onScreenshotCapture={handleScreenshotCapture}
              onPromptsClick={handlePromptsClick}
              onResetChat={handleResetChat}
            />
          </MagicCard>
        </div>
      </BlurFade>
    </MagicContainer>
  );
}
