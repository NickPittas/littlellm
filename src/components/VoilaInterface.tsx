'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// Extend Window interface for tool thinking trigger
declare global {
  interface Window {
    triggerToolThinking?: (toolName: string) => void;
  }
}
import { X, Minus, Send, Paperclip, Camera } from 'lucide-react';
import { Button } from './ui/button';
import { ToolCallingToggle } from './ui/tool-calling-toggle';
import { useEnhancedWindowDrag } from '../hooks/useEnhancedWindowDrag';

import { Card } from './ui/card';
import { BottomToolbar } from './BottomToolbarNew';
import { useHistoryOverlay } from './HistoryOverlay';

// Settings handled by separate overlay window

import { chatService, type ChatSettings, type Message } from '../services/chatService';
import { settingsService } from '../services/settingsService';
import { conversationHistoryService } from '../services/conversationHistoryService';
import { sessionService } from '../services/sessionService';
import { stateService } from '../services/stateService';
import { MessageWithThinking } from './MessageWithThinking';
import { UserMessage } from './UserMessage';
import { ThinkingIndicator } from './ThinkingIndicator';
// Theme system disabled


interface VoilaInterfaceProps {
  onClose?: () => void;
}

export function VoilaInterface({ onClose }: VoilaInterfaceProps) {
  // VoilaInterface component mounting

  // Always in chat mode now - simplified interface
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [showChat, setShowChat] = useState(false); // Hide chat until first message
  const [isLoading, setIsLoading] = useState(false); // Loading state for thinking indicator


  const [windowExpanded, setWindowExpanded] = useState(false); // Track if window has been expanded
  const [sessionStats, setSessionStats] = useState(sessionService.getSessionStats());
  // Theme system disabled

  // Initialize enhanced window dragging
  const { isDragging } = useEnhancedWindowDrag();

  // Ref for auto-resizing textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Ref for chat messages container
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  // Track if user has manually scrolled up
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);

  // Dynamic window height management based on chat state
  const updateWindowHeight = useCallback((hasChatContent: boolean) => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const baseWidth = 570; // Keep width unchanged

      if (hasChatContent) {
        // Expanded height for active chat
        const expandedHeight = 600; // Height when chat is active
        console.log('🔧 Expanding window for active chat:', { width: baseWidth, height: expandedHeight });
        window.electronAPI.resizeWindow(baseWidth, expandedHeight);
      } else {
        // Compact height for no chat - minimal size
        const compactHeight = 120; // Very small height when no chat
        console.log('🔧 Compacting window for no chat:', { width: baseWidth, height: compactHeight });
        window.electronAPI.resizeWindow(baseWidth, compactHeight);
      }
    }
  }, []);

  // Calculate total tokens for current chat
  const calculateChatTokens = () => {
    let totalTokens = 0;
    let promptTokens = 0;
    let completionTokens = 0;

    messages.forEach(message => {
      if (message.usage) {
        // Normalize token usage format (different providers use different field names)
        const usage = message.usage as {
          promptTokens?: number;
          prompt_tokens?: number;
          input_tokens?: number;
          completionTokens?: number;
          completion_tokens?: number;
          output_tokens?: number;
          totalTokens?: number;
          total_tokens?: number;
        };
        const normalizedUsage = {
          promptTokens: usage.promptTokens || usage.prompt_tokens || usage.input_tokens || 0,
          completionTokens: usage.completionTokens || usage.completion_tokens || usage.output_tokens || 0,
          totalTokens: usage.totalTokens || usage.total_tokens ||
                      (usage.promptTokens || usage.prompt_tokens || usage.input_tokens || 0) +
                      (usage.completionTokens || usage.completion_tokens || usage.output_tokens || 0)
        };

        totalTokens += normalizedUsage.totalTokens;
        promptTokens += normalizedUsage.promptTokens;
        completionTokens += normalizedUsage.completionTokens;
      }
    });

    return { totalTokens, promptTokens, completionTokens };
  };

  // Dynamic window height management based on chat state
  useEffect(() => {
    const hasChatContent = messages.length > 0 || showChat;
    updateWindowHeight(hasChatContent);
  }, [messages.length, showChat, updateWindowHeight]);

  // Update session stats when messages change
  useEffect(() => {
    setSessionStats(sessionService.getSessionStats());

    // Debug: Log last message usage
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant') {
        console.log('🔍 Last assistant message usage:', lastMessage.usage);
        console.log('🔍 Current session stats:', sessionService.getSessionStats());
      }
    }
  }, [messages]);

  // Reset chat function
  const handleResetChat = async () => {
    setMessages([]);
    setShowChat(false);
    setInput('');
    setAttachedFiles([]);
    await sessionService.resetSession();
    setSessionStats(sessionService.getSessionStats());
    console.log('Chat reset');
  };
  const [settings, setSettings] = useState<ChatSettings>({
    provider: '',
    model: '',
    temperature: 0.3,
    maxTokens: 8192,
    systemPrompt: '',
    toolCallingEnabled: true,
    providers: {
      openai: { apiKey: '', lastSelectedModel: '' },
      anthropic: { apiKey: '', lastSelectedModel: '' },
      gemini: { apiKey: '', lastSelectedModel: '' },
      mistral: { apiKey: '', lastSelectedModel: '' },
      deepseek: { apiKey: '', lastSelectedModel: '' },
      lmstudio: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
      ollama: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
      openrouter: { apiKey: '', lastSelectedModel: '' },
      requesty: { apiKey: '', lastSelectedModel: '' },
      replicate: { apiKey: '', lastSelectedModel: '' },
    },
  });



  // Load app settings on mount and subscribe to changes
  useEffect(() => {
    try {
      console.log('VoilaInterface: Loading app settings on mount...');

      // Wait a bit for settings service to initialize
      const loadSettings = () => {
        const appSettings = settingsService.getSettings();
        console.log('VoilaInterface: Loaded app settings:', appSettings);

        // Only update if we have actual settings (not defaults from uninitialized service)
        if (appSettings.chat && (appSettings.chat.provider || Object.keys(appSettings.chat.providers || {}).length > 0)) {
          console.log('VoilaInterface: Settings appear to be loaded, updating state');

          setSettings(appSettings.chat);
        } else {
          console.log('VoilaInterface: Settings not yet loaded, will retry...');
          // Retry after a short delay
          setTimeout(loadSettings, 100);
          return;
        }
      };

      loadSettings();
      console.log('VoilaInterface: Settings loaded successfully');

      // Load provider/model state from state service
      const loadProviderState = async () => {
        await stateService.waitForInitialization();
        const providerState = stateService.getProviderState();
        if (providerState.currentProvider || providerState.currentModel) {
          console.log('VoilaInterface: Loading provider state:', providerState);
          setSettings(prev => ({
            ...prev,
            provider: providerState.currentProvider,
            model: providerState.currentModel
          }));
        }
      };
      loadProviderState();

      // Subscribe to settings changes - but only for external changes (like settings overlay)
      const unsubscribe = settingsService.subscribe((newAppSettings) => {
        console.log('VoilaInterface: Settings changed via subscription:', newAppSettings);
        // Only update if this is an external change (not from our own handleSettingsChange)
        // We handle our own changes directly in handleSettingsChange to avoid loops

        // Don't update chat settings here - handleSettingsChange handles that
      });

      // Cleanup subscription on unmount
      return unsubscribe;
    } catch (error) {
      console.error('VoilaInterface: Failed to load app settings:', error);
    }
  }, []);

  // Memoized file upload handler to prevent infinite re-renders
  const handleFileUpload = useCallback((files: FileList) => {
    // Add files to attached files list
    const newFiles = Array.from(files);
    setAttachedFiles(prev => [...prev, ...newFiles]);
    console.log('Files uploaded:', newFiles.map(f => f.name));
  }, []);

  // Memoized screenshot capture handler to prevent infinite re-renders
  const handleScreenshotCapture = useCallback((file: File) => {
    // Auto-attach screenshot to chat
    setAttachedFiles(prev => [...prev, file]);
    console.log('Screenshot captured:', file.name);
  }, []);



  // Auto-focus chat input on app startup and window activation (but not on every click)
  useEffect(() => {
    const focusInput = () => {
      if (textareaRef.current) {
        // Small delay to ensure the component is fully rendered
        setTimeout(() => {
          try {
            textareaRef.current?.focus();
            // Also set cursor to end of text if there's any content
            const textarea = textareaRef.current;
            if (textarea && textarea.value) {
              textarea.setSelectionRange(textarea.value.length, textarea.value.length);
            }
            console.log('Chat input auto-focused');
          } catch (error) {
            console.warn('Failed to focus input:', error);
          }
        }, 150); // Slightly longer delay for better reliability
      }
    };

    // Focus immediately on mount (when app is opened)
    focusInput();

    // Focus when window becomes visible (e.g., when opened via shortcut)
    const handleWindowFocus = () => {
      focusInput();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        focusInput();
      }
    };

    // Listen for window focus events (when app is activated)
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('visibilitychange', handleVisibilityChange);

    // REMOVED: The aggressive click handler that was preventing text selection
    // Users can click in the input field manually if they want to type

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // Empty dependency array - only run on mount

  // Helper function to check if keyboard event matches action menu shortcut
  const isActionMenuShortcut = (e: KeyboardEvent | React.KeyboardEvent) => {
    // Simple check for Ctrl+Shift+Space
    return e.ctrlKey && e.shiftKey && e.key === ' ';
  };

  const handleSettingsChange = async (newSettings: Partial<ChatSettings>) => {
    console.log('VoilaInterface handleSettingsChange called with:', newSettings);
    console.log('Current settings before update:', settings);

    // Update local React state immediately
    const updatedSettings = { ...settings, ...newSettings };
    setSettings(updatedSettings);
    console.log('Local React state updated to:', updatedSettings);

    // Update settings service in memory only - NO AUTO-SAVE
    settingsService.updateChatSettingsInMemory(newSettings);

    // Save provider/model changes to state service for real-time updates
    if (newSettings.provider !== undefined) {
      await stateService.setCurrentProvider(newSettings.provider);
      console.log('Provider saved to state service:', newSettings.provider);
    }
    if (newSettings.model !== undefined) {
      await stateService.setCurrentModel(newSettings.model);
      console.log('Model saved to state service:', newSettings.model);
    }

    console.log('Settings service updated in memory, state service updated for provider/model');
  };

  // REMOVED: Duplicate settings loading - now handled in combined useEffect above

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Check for action menu shortcut first
      if (isActionMenuShortcut(e)) {
        e.preventDefault();
        console.log('Action menu shortcut detected globally');
        if (typeof window !== 'undefined' && window.electronAPI) {
          window.electronAPI.openActionMenu();
        }
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'k':
            e.preventDefault();
            setInput('');
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

  // Calculate total window height needed
  const calculateWindowHeight = useCallback((textareaHeight: number = 40) => {
    const baseHeight = 165; // Base height (padding, borders, etc.)
    const chatHeight = showChat && messages.length > 0 ? 450 : 0; // Chat area height
    const textareaExtraHeight = Math.max(0, textareaHeight - 40); // Extra height beyond minimum

    return baseHeight + chatHeight + textareaExtraHeight;
  }, [showChat, messages.length]);

  // Auto-context window resizing - grows based on content, never shrinks unless cleared
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const baseWidth = 570; // Minimum width for UI elements

      // Get current textarea height
      const currentTextareaHeight = textareaRef.current?.style.height
        ? parseInt(textareaRef.current.style.height)
        : 40;

      const targetHeight = calculateWindowHeight(currentTextareaHeight);

      // Only resize if we're changing to a larger size or going back to compact (no messages)
      if (showChat && messages.length > 0 && !windowExpanded) {
        console.log('Auto-expanding window for chat content');
        window.electronAPI.resizeWindow(baseWidth, targetHeight);
        setWindowExpanded(true);
      } else if (messages.length === 0 && windowExpanded) {
        console.log('Auto-compacting window - no content');
        window.electronAPI.resizeWindow(baseWidth, targetHeight);
        setWindowExpanded(false);
      }
    }
  }, [showChat, messages.length, windowExpanded, calculateWindowHeight]);

  // Theme system disabled

  // Listen for prompt selections from action menu overlay
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const handlePromptSelected = async (promptText: string) => {
        console.log('Received prompt from action menu:', promptText);

        let processedPrompt = promptText;

        // If the prompt contains {content} placeholder, replace it with clipboard content
        if (promptText.includes('{content}')) {
          try {
            console.log('Prompt contains {content}, reading clipboard...');
            const clipboardContent = await window.electronAPI.readClipboard();

            if (clipboardContent && clipboardContent.trim()) {
              processedPrompt = promptText.replace('{content}', clipboardContent.trim());
              console.log('Replaced {content} with clipboard content');
            } else {
              processedPrompt = promptText.replace('{content}', '[No clipboard content available]');
              console.log('No clipboard content available, using placeholder');
            }
          } catch (error) {
            console.error('Failed to read clipboard:', error);
            processedPrompt = promptText.replace('{content}', '[Clipboard access failed]');
          }
        }

        // Add the processed prompt to the input field
        setInput(processedPrompt);
        console.log('Set input with processed prompt:', processedPrompt);
        // Trigger resize after prompt is set - will be handled by input change effect
      };

      window.electronAPI.onPromptSelected(handlePromptSelected);

      return () => {
        window.electronAPI.removeAllListeners('prompt-selected');
      };
    }
  }, []); // EMPTY DEPENDENCY ARRAY - ONLY SETUP ONCE



  // Auto-resize textarea height only (no window resizing)
  const autoResizeTextarea = useCallback(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;

      // Reset height to get accurate scrollHeight
      textarea.style.height = '40px'; // Reset to minimum height first

      // Force a reflow to get accurate scrollHeight
      void textarea.offsetHeight;

      // Calculate the new height based on content
      const minHeight = 40; // Minimum height (40px)
      const maxHeight = 200; // Maximum height before scrolling

      // Get the scroll height
      const scrollHeight = textarea.scrollHeight;
      const contentHeight = Math.max(minHeight, Math.min(maxHeight, scrollHeight));

      // Set the new height (textarea only, no window resizing)
      textarea.style.height = `${contentHeight}px`;

      console.log('Textarea auto-resize:', { scrollHeight, contentHeight, inputLength: input.length });
    }
  }, [input]);

  // Auto-resize textarea when input changes
  useEffect(() => {
    // Use setTimeout to ensure DOM is updated
    const timer = setTimeout(() => {
      autoResizeTextarea();
    }, 0);

    return () => clearTimeout(timer);
  }, [input, autoResizeTextarea]);

  // Auto-scroll to bottom when new messages are added (unless user is scrolling)
  useEffect(() => {
    if (!isUserScrolling && chatMessagesRef.current) {
      const scrollContainer = chatMessagesRef.current;

      // Use requestAnimationFrame for smoother auto-scroll
      requestAnimationFrame(() => {
        const targetScrollTop = scrollContainer.scrollHeight - scrollContainer.clientHeight;
        const currentScrollTop = scrollContainer.scrollTop;
        const distance = targetScrollTop - currentScrollTop;

        // If the distance is small, use instant scroll
        if (Math.abs(distance) < 100) {
          scrollContainer.scrollTop = targetScrollTop;
        } else {
          // For larger distances, use smooth animated scroll
          setIsAutoScrolling(true);
          const startTime = performance.now();
          const duration = Math.min(400, Math.abs(distance) * 0.6); // Slightly longer for smoother feel

          const animateScroll = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ultra-smooth easing function (ease-out-expo)
            const easeOutExpo = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

            scrollContainer.scrollTop = currentScrollTop + distance * easeOutExpo;

            if (progress < 1) {
              requestAnimationFrame(animateScroll);
            } else {
              setIsAutoScrolling(false);
            }
          };

          requestAnimationFrame(animateScroll);
        }
      });
    }
  }, [messages, isUserScrolling]);

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
      // Handle escape key
    }
    // Global shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'k':
          e.preventDefault();
          setInput('');
          break;
        case 'n':
          e.preventDefault();
          setInput('');
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

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true); // Start thinking indicator
    console.log('🧠 Started thinking indicator - user message sent');

    // Track when we started processing for timeout detection
    const processingStartTime = Date.now();

    // Save conversation immediately after user message
    try {
      const currentConversationId = conversationHistoryService.getCurrentConversationId();
      if (currentConversationId) {
        await conversationHistoryService.updateConversation(currentConversationId, updatedMessages);
      } else {
        const newConversationId = await conversationHistoryService.createNewConversation(updatedMessages);
        conversationHistoryService.setCurrentConversationId(newConversationId);
      }
    } catch (error) {
      console.error('Failed to save conversation after user message:', error);
    }

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
      const conversationHistory = updatedMessages.slice(0, -1); // Exclude the current user message
      console.log('🧠 VoilaInterface conversation history debug:', {
        updatedMessagesLength: updatedMessages.length,
        conversationHistoryLength: conversationHistory.length,
        lastMessage: (() => {
          const content = updatedMessages[updatedMessages.length - 1]?.content;
          return typeof content === 'string' ? content.substring(0, 50) : '[Complex content]';
        })()
      });

      // Track if we've already created a tool thinking bubble for this conversation turn
      let toolThinkingCreated = false;

      // Set up tool thinking trigger function
      window.triggerToolThinking = () => {
        // Only create thinking bubble for the FIRST tool call in a turn
        if (!toolThinkingCreated && !isLoading) {
          toolThinkingCreated = true;
          const toolThinkingMessage = {
            id: (Date.now() + 2).toString(),
            content: '',
            role: 'assistant' as const,
            timestamp: new Date(),
            isThinking: true,
          };

          setMessages(prev => [...prev, toolThinkingMessage]);
          setIsLoading(true);
        }


      };

      const response = await chatService.sendMessage(
        messageContent,
        attachedFiles,
        settings,
        conversationHistory,
        (chunk: string) => {
          // Stop thinking indicator when streaming starts (first chunk received)
          if (assistantContent === '' && chunk.trim().length > 0) {
            const processingDuration = Date.now() - processingStartTime;
            console.log(`🤖 Model started streaming after ${processingDuration}ms, stopping thinking indicators and removing thinking bubbles`);
            setIsLoading(false);

            // Remove all thinking bubbles when streaming starts
            setMessages(prev => prev.filter(msg => !msg.isThinking));
          }

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
        undefined, // signal
        conversationHistoryService.getCurrentConversationId() || undefined
      );

      // If we get here and still loading, it means no streaming occurred
      // This handles non-streaming responses (like OpenRouter issues)
      if (isLoading) {
        const totalProcessingTime = Date.now() - processingStartTime;
        console.log(`🔄 No streaming detected, stopping thinking indicator after ${totalProcessingTime}ms (non-streaming response)`);
        setIsLoading(false);
      }



      // Check if this is a follow-up response replacing a thinking bubble
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];

        if (lastMessage && lastMessage.isThinking) {
          // Replace the thinking bubble with the actual response
          console.log(`🔄 Replacing thinking bubble with follow-up response`);
          return prev.slice(0, -1).concat([{
            id: lastMessage.id,
            content: response.content,
            role: 'assistant' as const,
            timestamp: new Date(),
            usage: response.usage,
            toolCalls: response.toolCalls,
            isThinking: false, // No longer thinking
          }]);
        } else {
          // Update the original assistant message
          return prev.map(msg =>
            msg.id === assistantMessage.id
              ? { ...msg, content: response.content, usage: response.usage, toolCalls: response.toolCalls }
              : msg
          );
        }
      });

      // Stop thinking indicator when final response is complete
      if (isLoading) {
        const totalProcessingTime = Date.now() - processingStartTime;
        console.log(`✅ Final response complete after ${totalProcessingTime}ms, stopping thinking indicator`);
        setIsLoading(false);
      }

      // Clear attached files after sending
      setAttachedFiles([]);

      // Save conversation to history
      const currentConversationId = conversationHistoryService.getCurrentConversationId();
      if (currentConversationId) {
        await conversationHistoryService.updateConversation(currentConversationId, [...messages, userMessage, { ...assistantMessage, content: response.content, usage: response.usage, toolCalls: response.toolCalls }]);
      } else {
        const newConversationId = await conversationHistoryService.createNewConversation([userMessage, { ...assistantMessage, content: response.content, usage: response.usage, toolCalls: response.toolCalls }]);
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
    } finally {
      // Clean up tool thinking trigger
      delete window.triggerToolThinking;

      // Ensure all loading indicators are reset
      setIsLoading(false);
      console.log('🔄 Message handling completed, reset all loading states');
    }
  };



  // Handle prompts button click - open action menu like Ctrl+Shift+Space
  const handlePromptsClick = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.openActionMenu();
    }
  };

  // Handle clearing chat
  const handleClearChat = async () => {
    // Save the current conversation before clearing
    if (messages.length > 0) {
      try {
        const currentConversationId = conversationHistoryService.getCurrentConversationId();
        if (currentConversationId) {
          await conversationHistoryService.updateConversation(currentConversationId, messages);
        } else if (messages.length > 0) {
          // Create a new conversation if there isn't one
          await conversationHistoryService.createNewConversation(messages);
          // Don't set as current since we're clearing it
        }
      } catch (error) {
        console.error('Failed to save conversation before clearing:', error);
      }
    }

    // Clear the current conversation ID
    conversationHistoryService.setCurrentConversationId(null);

    // Clear the UI
    setMessages([]);
    setInput('');
    setAttachedFiles([]);
    setShowChat(false);
  };

  // Handle minimizing chat (save current state)
  const handleMinimizeChat = async () => {
    // Save the current conversation before minimizing
    if (messages.length > 0) {
      try {
        const currentConversationId = conversationHistoryService.getCurrentConversationId();
        if (currentConversationId) {
          await conversationHistoryService.updateConversation(currentConversationId, messages);
        } else {
          // Create a new conversation if there isn't one
          const newConversationId = await conversationHistoryService.createNewConversation(messages);
          conversationHistoryService.setCurrentConversationId(newConversationId);
        }
      } catch (error) {
        console.error('Failed to save conversation before minimizing:', error);
      }
    }

    // Hide the chat
    setShowChat(false);
  };



  const handleLoadConversation = async (conversation: { id: string; messages: Message[] }) => {
    try {
      console.log('🔄 Loading conversation:', conversation.id);

      // Get the full conversation data (including messages) from the service
      const fullConversation = await conversationHistoryService.getConversation(conversation.id);

      if (fullConversation && fullConversation.messages) {
        console.log('✅ Loaded conversation with', fullConversation.messages.length, 'messages');
        // Load the conversation messages
        setMessages(fullConversation.messages);
        conversationHistoryService.setCurrentConversationId(conversation.id);
        // Show the chat interface when loading a conversation
        setShowChat(true);
        // Clear any current input
        setInput('');
        // Clear any attached files
        setAttachedFiles([]);
      } else {
        console.error('❌ Failed to load conversation data');
      }
    } catch (error) {
      console.error('❌ Error loading conversation:', error);
    }
  };

  // Initialize history overlay after handleLoadConversation is defined
  const { openHistory } = useHistoryOverlay(handleLoadConversation);

  // Add MCP connectivity test function to window for debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).testMCPConnectivity = async () => {
        console.log('🔍 Testing MCP Connectivity...');

        try {
          if (!window.electronAPI) {
            console.error('❌ Electron API not available');
            return;
          }

          // Get MCP connection status
          const status = await window.electronAPI.getMCPDetailedStatus();
          console.log('📊 MCP Detailed Status:', status);

          // Get all available tools
          const tools = await window.electronAPI.getAllMCPTools();
          console.log('🔧 Available MCP Tools:', tools);

          // Get all available resources
          const resources = await window.electronAPI.getAllMCPResources();
          console.log('📁 Available MCP Resources:', resources);

          // Get all available prompts
          const prompts = await window.electronAPI.getAllMCPPrompts();
          console.log('💬 Available MCP Prompts:', prompts);

          // Summary
          console.log('📋 MCP CONNECTIVITY SUMMARY:');
          console.log(`- Connected servers: ${Object.keys(status.servers || {}).filter(id => status.servers[id].connected).length}`);
          console.log(`- Total tools: ${tools.length}`);
          console.log(`- Total resources: ${resources.length}`);
          console.log(`- Total prompts: ${prompts.length}`);

          if (tools.length === 0) {
            console.warn('⚠️ No MCP tools available! This is why the LLM cannot use tools.');
          }

          return {
            status,
            tools,
            resources,
            prompts,
            summary: {
              connectedServers: Object.keys(status.servers || {}).filter(id => status.servers[id].connected).length,
              totalTools: tools.length,
              totalResources: resources.length,
              totalPrompts: prompts.length
            }
          };
        } catch (error) {
          console.error('❌ MCP Connectivity Test Failed:', error);
          return { error: error instanceof Error ? error.message : String(error) };
        }
      };
    }
  }, []);

  return (
    <div
      className={`h-screen w-full flex flex-col ${isDragging ? 'cursor-grabbing' : ''}`}
      style={{
        userSelect: isDragging ? 'none' : 'auto',
        overflow: 'hidden',
        background: '#1a1a1a', // Solid background
        color: '#ffffff',
        borderRadius: '12px'
      }}
    >
      {/* Minimal visual header for window identification */}
      <div
        className="h-1 w-full bg-primary/20 flex-none"
        title="LittleLLM Chat Window"
      />

      {/* Content wrapper - Fixed height container */}
      <div className="flex-1 flex flex-col min-h-0" style={{ overflow: 'visible' }}>

        {/* Input Area with Attachment Preview */}
      <div
        id="input-area"
        className="flex-none p-2"
      >
        <Card className="p-2" style={{ backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '12px' }}>
          {/* Attachment Preview */}
          {attachedFiles.length > 0 && (
            <div
              id="attachment-preview"
              className="mb-3 p-3 bg-muted rounded-lg"
              data-interactive="true"
            >
              <div className="flex flex-wrap gap-2">
                {attachedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 bg-background p-2 rounded border">
                    {/* Thumbnail or Icon */}
                    {file.type.startsWith('image/') ? (
                      <img
                        src={URL.createObjectURL(file)}
                        alt={file.name}
                        className="w-8 h-8 object-cover rounded"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">
                          {file.name.split('.').pop()?.toUpperCase() || 'FILE'}
                        </span>
                      </div>
                    )}

                    {/* File Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{file.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </div>
                    </div>

                    {/* Remove Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== index))}
                      className="h-6 w-6 p-0 hover:bg-destructive/20"
                      data-interactive="true"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                const newValue = e.target.value;
                setInput(newValue);
                // Note: Textarea auto-resize is handled by the useEffect hook above
              }}
              onKeyDown={handleKeyDown}
              placeholder="Type your message..."
              className="flex-1 min-h-[40px] p-2 resize-none focus:outline-none cursor-text overflow-y-auto"
              style={{
                lineHeight: '1.5',
                backgroundColor: '#333333',
                border: '1px solid #555',
                color: '#ffffff',
                borderRadius: '8px'
              }}
              data-interactive="true"
            />

            {/* Attachment and Screenshot buttons - moved to left of Send button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.accept = 'image/*,.pdf,.txt,.doc,.docx,.jpg,.png,.md,.log';
                input.onchange = (e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (files) {
                    handleFileUpload(files);
                  }
                };
                input.click();
              }}
              className="h-10 w-10 cursor-pointer flex-shrink-0"
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
                    if (result.success && result.dataURL) {
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
              className="h-10 w-10 cursor-pointer flex-shrink-0"
              title="Take Screenshot"
              data-interactive="true"
            >
              <Camera className="h-4 w-4" />
            </Button>

            <ToolCallingToggle
              enabled={settings.toolCallingEnabled}
              onToggle={(enabled) => {
                const updatedSettings = { ...settings, toolCallingEnabled: enabled };
                setSettings(updatedSettings);
                settingsService.updateChatSettingsInMemory(updatedSettings);
                settingsService.saveSettingsToDisk();
              }}
              title={settings.toolCallingEnabled ? "Disable Tool Calling" : "Enable Tool Calling"}
              data-interactive="true"
            />

            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() && attachedFiles.length === 0}
              className="h-10 w-10 cursor-pointer flex-shrink-0 p-0"
              data-interactive="true"
            >
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Chat Interface - Only show after first message - Positioned between input and bottom toolbar */}
      {messages.length > 0 && showChat && (
        <div className="flex-1 flex flex-col p-2 overflow-hidden">
          <Card className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '12px' }}>
            {/* Chat Header with Controls - FIXED POSITION */}
            <div className="flex-none flex items-center justify-between p-2 border-b border-border bg-background">
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium text-muted-foreground">Chat</div>
                {(() => {
                  const chatTokens = calculateChatTokens();
                  return chatTokens.totalTokens > 0 ? (
                    <div className="text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                      📊 {chatTokens.totalTokens} tokens ({chatTokens.promptTokens} in, {chatTokens.completionTokens} out)
                    </div>
                  ) : null;
                })()}
              </div>
              <div className="flex items-center gap-1">
                {/* Minimize Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMinimizeChat}
                  className="h-6 w-6 p-0 hover:bg-muted"
                  data-interactive="true"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                {/* Close Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearChat}
                  className="h-6 w-6 p-0 hover:bg-destructive/20"
                  data-interactive="true"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Chat Messages */}
            <div
              ref={chatMessagesRef}
              className="flex-1 p-4 space-y-4 hide-scrollbar overlay-scroll chat-messages"

              data-interactive="true"
              onScroll={(e) => {
                // Don't interfere with auto-scrolling
                if (isAutoScrolling) return;

                const element = e.currentTarget;
                const { scrollTop, scrollHeight, clientHeight } = element;

                // Check if user is near the bottom (within 50px)
                const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;

                // If user scrolled up from bottom, disable auto-scroll
                // If user scrolled back to bottom, re-enable auto-scroll
                setIsUserScrolling(!isNearBottom);
              }}

            >
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                  data-interactive="true"
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                    data-interactive="true"
                  >
                    {message.role === 'assistant' ? (
                      <>
                        {message.isThinking ? (
                          <ThinkingIndicator />
                        ) : (
                          <>
                            <MessageWithThinking
                              content={typeof message.content === 'string' ? message.content : JSON.stringify(message.content)}
                              usage={message.usage}
                              timing={message.timing}
                              toolCalls={message.toolCalls}
                            />
                            {/* Debug tool calls */}
                            {message.toolCalls && console.log('🔍 UI received toolCalls for message:', {
                              messageId: message.id,
                              toolCallsCount: message.toolCalls.length,
                              toolNames: message.toolCalls.map((tc: { name: string }) => tc.name)
                            })}
                          </>
                        )}
                      </>
                    ) : (
                      <UserMessage content={typeof message.content === 'string' ? message.content : JSON.stringify(message.content)} />
                    )}
                  </div>
                </div>
              ))}

              {/* Show thinking indicator when loading */}
              {isLoading && (
                <div className="flex justify-start p-2">
                  <div className="max-w-[80%]">
                    <ThinkingIndicator />
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Session Stats Display - Only show when there are messages */}
      {messages.length > 0 && (
        <div className="flex-none px-2 pb-1">
          <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-1 rounded text-center">
            Session: {sessionStats.totalTokens} tokens • {sessionStats.messagesCount} messages • {sessionService.formatSessionDuration()}
            {sessionStats.totalTokens === 0 && (
              <span className="text-yellow-500 ml-2">[DEBUG: No tokens tracked yet]</span>
            )}
          </div>
        </div>
      )}

      {/* Bottom Toolbar - TESTING MINIMAL VERSION */}
      <div
        id="bottom-toolbar"
        className="flex-none cursor-default p-2"
      >
        <Card className="rounded-lg" style={{ backgroundColor: '#2a2a2a', border: '1px solid #444', borderRadius: '12px' }}>
            <BottomToolbar
              settings={settings}
              onSettingsChange={handleSettingsChange}
              showHistory={false}
              onHistoryChange={openHistory}
              onFileUpload={handleFileUpload}
              onScreenshotCapture={handleScreenshotCapture}
              onPromptsClick={handlePromptsClick}
              onResetChat={handleResetChat}
            />
          </Card>
        </div>

        {/* Settings now opens as separate overlay window via electronAPI */}

        {/* History is now handled by overlay window */}

        {/* STILL COMMENTED OUT */}
        {/* AutoResizeTextarea */}
        {/* Chat Controls */}
        {/* ChatInterface */}
        {/* Resize Handle */}
      </div>
    </div>
  );
}
