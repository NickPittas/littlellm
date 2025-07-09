'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Minus, Square, Camera, Paperclip, History, Settings, ChevronDown, Send, ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ChatInterface } from './ChatInterface';
import { BottomToolbar } from './BottomToolbar';
import { HistoryDialog } from './HistoryDialog';
import { AttachmentPreview } from './AttachmentPreview';
import { AutoResizeTextarea } from './AutoResizeTextarea';
import { ActionMenuPopup } from './ActionMenuPopup';
import { promptsService } from '../services/promptsService';
import { chatService, type ChatSettings } from '../services/chatService';
import { settingsService, type AppSettings } from '../services/settingsService';
import { conversationHistoryService } from '../services/conversationHistoryService';
import { useTheme } from '../contexts/ThemeContext';

interface VoilaInterfaceProps {
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
}

export function VoilaInterface({ onClose, onMinimize, onMaximize }: VoilaInterfaceProps) {
  // Always in chat mode now - simplified interface
  const [input, setInput] = useState('');
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [showChat, setShowChat] = useState(false); // Hide chat until first message
  const [isResizing, setIsResizing] = useState(false);
  const [size, setSize] = useState({ width: 520, height: 160 }); // Start with minimum dimensions
  const [showHistory, setShowHistory] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const { themes, setTheme } = useTheme();
  const [settings, setSettings] = useState<ChatSettings>({
    provider: 'openrouter',
    model: 'mistralai/mistral-7b-instruct:free',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: 'You are a helpful AI assistant. Please provide concise and helpful responses.',
    providers: {
      openai: { apiKey: '', lastSelectedModel: 'gpt-4o' },
      openrouter: { apiKey: '', lastSelectedModel: 'mistralai/mistral-7b-instruct:free' },
      requesty: { apiKey: '', lastSelectedModel: 'openai/gpt-4o-mini' },
      ollama: { apiKey: '', baseUrl: 'http://localhost:11434', lastSelectedModel: 'llama2' },
      replicate: { apiKey: '', lastSelectedModel: 'meta/llama-2-70b-chat' },
    },
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Load app settings on mount
  useEffect(() => {
    const loadAppSettings = async () => {
      try {
        const settings = await settingsService.getSettings();
        setAppSettings(settings);
      } catch (error) {
        console.error('Failed to load app settings:', error);
      }
    };
    loadAppSettings();
  }, []);

  // Helper function to check if keyboard event matches action menu shortcut
  const isActionMenuShortcut = (e: KeyboardEvent | React.KeyboardEvent) => {
    if (!appSettings?.shortcuts?.actionMenu) {
      return false;
    }

    const shortcut = appSettings.shortcuts.actionMenu;
    const parts = shortcut.split('+');

    let requiresCommandOrControl = false;
    let requiresCtrl = false;
    let requiresShift = false;
    let requiresMeta = false;
    let key = '';

    for (const part of parts) {
      const lowerPart = part.toLowerCase();
      if (lowerPart === 'commandorcontrol') {
        requiresCommandOrControl = true;
      } else if (lowerPart === 'ctrl' || lowerPart === 'control') {
        requiresCtrl = true;
      } else if (lowerPart === 'shift') {
        requiresShift = true;
      } else if (lowerPart === 'meta' || lowerPart === 'cmd' || lowerPart === 'command') {
        requiresMeta = true;
      } else {
        key = lowerPart === 'space' ? ' ' : part;
      }
    }

    // Handle CommandOrControl (Ctrl on Windows/Linux, Cmd on Mac)
    const hasRequiredModifier = requiresCommandOrControl ? (e.ctrlKey || e.metaKey) :
                               requiresCtrl ? e.ctrlKey :
                               requiresMeta ? e.metaKey : true;

    const hasShift = !requiresShift || e.shiftKey;
    const hasCorrectKey = e.key.toLowerCase() === key.toLowerCase();

    return hasRequiredModifier && hasShift && hasCorrectKey;
  };

  const handleSettingsChange = async (newSettings: Partial<ChatSettings>) => {
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);

    // Persist settings
    try {
      const currentAppSettings = await settingsService.getSettings();
      await settingsService.updateSettings({
        ...currentAppSettings,
        chat: updatedSettings
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  // Load settings on mount
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

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'k':
            e.preventDefault();
            setInput('');
            setShowActionMenu(false);
            break;
          case ',':
            e.preventDefault();
            // Open settings (could be implemented later)
            break;
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Handle window resizing based on chat visibility
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Resize window based on chat state
      // Width: 520px minimum to show all bottom toolbar buttons properly
      // Compact: input (50px) + toolbar (50px) + padding (60px) = 160px
      // Expanded: input (50px) + chat (450px) + toolbar (50px) + padding (60px) = 610px
      const targetWidth = 520; // Minimum width to show all UI elements
      const targetHeight = showChat ? 610 : 160;

      window.electronAPI.resizeWindow(targetWidth, targetHeight);
    }
  }, [showChat]);

  // Listen for theme changes from overlay windows
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const handleThemeChange = (themeId: string) => {
        const newTheme = themes.find(t => t.id === themeId);
        if (newTheme) {
          setTheme(newTheme);
        }
      };

      window.electronAPI.onThemeChanged(handleThemeChange);

      return () => {
        window.electronAPI.removeAllListeners('theme-changed');
      };
    }
  }, [themes, setTheme]);

  // Handle input changes
  const handleInputChange = (value: string) => {
    setInput(value);
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
      e.preventDefault();
      handleSendMessage();
      return;
    }

    // Check for action menu shortcut (configurable, default: Ctrl+Shift+Space)
    // Allow action menu even without input text
    if (isActionMenuShortcut(e)) {
      e.preventDefault();
      // Open action menu overlay window
      if (typeof window !== 'undefined' && window.electronAPI) {
        window.electronAPI.openActionMenu();
      }
      return;
    }
    if (e.key === 'Escape') {
      setShowActionMenu(false);
    }
    // Global shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'k':
          e.preventDefault();
          setInput('');
          setShowActionMenu(false);
          break;
        case 'n':
          e.preventDefault();
          setInput('');
          setShowActionMenu(false);
          // Clear chat history
          setMessages([]);
          break;
        case 'w':
          e.preventDefault();
          onClose?.();
          break;
      }
    }
  };

  // Handle sending messages
  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Show chat area when first message is sent
    if (!showChat) {
      setShowChat(true);
    }

    const messageContent = input.trim();

    // Add user message to messages array
    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: messageContent,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setShowActionMenu(false);

    // Send message to LLM service
    try {
      let assistantContent = '';
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        content: '',
        role: 'assistant' as const,
        timestamp: new Date(),
      };

      // Add the assistant message immediately for streaming
      setMessages(prev => [...prev, assistantMessage]);

      // Get conversation history (exclude the current user message we just added)
      const conversationHistory = messages;

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
        }
      );

      // Update final message with complete response
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantMessage.id
            ? { ...msg, content: response.content, usage: response.usage }
            : msg
        )
      );

      // Clear attached files after sending
      setAttachedFiles([]);

      // Save conversation to history
      const currentConversationId = conversationHistoryService.getCurrentConversationId();
      if (currentConversationId) {
        await conversationHistoryService.updateConversation(currentConversationId, [...messages, userMessage, { ...assistantMessage, content: response.content, usage: response.usage }]);
      } else {
        const newConversationId = await conversationHistoryService.createNewConversation([userMessage, { ...assistantMessage, content: response.content, usage: response.usage }]);
        conversationHistoryService.setCurrentConversationId(newConversationId);
      }
    } catch (error) {
      console.error('Failed to send message:', error);

      // Add error message
      const errorMessage = {
        id: (Date.now() + 2).toString(),
        content: `Error: ${error instanceof Error ? error.message : 'Failed to send message'}`,
        role: 'assistant' as const,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  // Handle prompt selection
  const handlePromptSelect = (prompt: string) => {
    setInput(prompt);
    setShowActionMenu(false);
  };

  // Handle clearing chat
  const handleClearChat = () => {
    setMessages([]);
    setInput('');
    setAttachedFiles([]);
    setShowChat(false);
  };

  // Handle toggling chat visibility
  const handleToggleChat = () => {
    setShowChat(!showChat);
  };

  const handleLoadConversation = (conversation: any) => {
    // Load the conversation messages
    setMessages(conversation.messages);
    conversationHistoryService.setCurrentConversationId(conversation.id);
    // Show the chat interface when loading a conversation
    setShowChat(true);
    // Clear any current input
    setInput('');
    // Clear any attached files
    setAttachedFiles([]);
  };

  return (
    <div
      ref={containerRef}
      className="h-full w-full bg-background flex flex-col overflow-hidden"
      style={{
        transform: 'none !important',
        transformOrigin: 'initial !important',
        zoom: 'normal !important',
        scale: '1 !important',
        userSelect: 'none',
        WebkitTransform: 'none !important',
        MozTransform: 'none !important',
        msTransform: 'none !important',
        WebkitAppRegion: 'no-drag'
      }}
    >
      {/* Invisible drag area at the top */}
      <div
        className="absolute top-0 left-0 right-0 h-8 z-10"
        style={{ WebkitAppRegion: 'drag' } as any}
      />

      {/* Main Content Area */}
      <div className={`flex flex-col overflow-hidden ${showChat ? 'flex-1' : 'flex-shrink-0'}`}>
        {/* Input Area */}
        <div className="border-b border-border flex-shrink-0">
          <div className={`${showChat ? 'p-4' : 'px-4 py-3'}`}>
            <div className="flex gap-2 items-end">
              <AutoResizeTextarea
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1 text-lg border-none shadow-none focus-visible:ring-0 bg-transparent"
                minRows={1}
                maxRows={6}
                autoFocus
              />
              {/* Chat Controls */}
              {showChat && (
                <div className="flex gap-1 mb-2">
                  <Button
                    onClick={handleToggleChat}
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0"
                    title="Hide Chat"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleClearChat}
                    variant="ghost"
                    size="sm"
                    className="flex-shrink-0"
                    title="Clear Chat"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </div>
              )}

              <Button
                onClick={handleSendMessage}
                disabled={!input.trim()}
                size="sm"
                className="flex-shrink-0 mb-2"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Attachment Preview */}
          {attachedFiles.length > 0 && (
            <AttachmentPreview
              files={attachedFiles}
              onRemoveFile={(index) => {
                setAttachedFiles(prev => prev.filter((_, i) => i !== index));
              }}
            />
          )}
        </div>

        {/* Content Area - Only show when chat is active */}
        {showChat && (
          <div className="overflow-hidden" style={{ height: '450px' }}>
            <ChatInterface
              input={input}
              onInputChange={setInput}
              showActionMenu={false}
              onActionMenuClose={() => {}}
              onPromptSelect={handlePromptSelect}
              messages={messages}
              onMessagesChange={setMessages}
              hideInput={true}
              attachedFiles={attachedFiles}
              onAttachedFilesChange={setAttachedFiles}
              onSendMessage={handleSendMessage}
            />
          </div>
        )}

        {/* Bottom Toolbar */}
        <div className="flex-shrink-0 sticky bottom-0">
          <BottomToolbar
            settings={settings}
            onSettingsChange={handleSettingsChange}
            showHistory={showHistory}
            onHistoryChange={setShowHistory}
            onFileUpload={(files) => {
              // Add files to attached files list
              const newFiles = Array.from(files);
              setAttachedFiles(prev => [...prev, ...newFiles]);
              console.log('Files uploaded:', newFiles.map(f => f.name));
            }}
            onScreenshotCapture={(file) => {
              // Auto-attach screenshot to chat
              setAttachedFiles(prev => [...prev, file]);
              console.log('Screenshot captured:', file.name);
            }}
          />
        </div>

        {/* History Dialog */}
        <HistoryDialog
          open={showHistory}
          onOpenChange={setShowHistory}
          onLoadConversation={handleLoadConversation}
        />


      </div>

      {/* Resize Handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-muted/50 hover:bg-muted"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
          const startX = e.clientX;
          const startY = e.clientY;
          const startWidth = size.width;
          const startHeight = size.height;

          const handleResize = (e: MouseEvent) => {
            const newWidth = Math.max(520, startWidth + (e.clientX - startX)); // Minimum width for all UI elements
            const newHeight = Math.max(160, startHeight + (e.clientY - startY)); // Minimum height for input + toolbar
            setSize({ width: newWidth, height: newHeight });

            // Resize the Electron window
            if (typeof window !== 'undefined' && window.electronAPI) {
              window.electronAPI.resizeWindow(newWidth, newHeight);
            }
          };

          const handleResizeEnd = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', handleResizeEnd);
          };

          document.addEventListener('mousemove', handleResize);
          document.addEventListener('mouseup', handleResizeEnd);
        }}
      >
        <div className="absolute bottom-0 right-0 w-2 h-2 bg-border" />
      </div>
    </div>
  );
}
