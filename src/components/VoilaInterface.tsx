'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

// Extend Window interface for tool thinking trigger
declare global {
  interface Window {
    triggerToolThinking?: (toolName: string) => void;
  }
}
import { X, Send, Paperclip, Camera } from 'lucide-react';
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
  const [userResizedWindow, setUserResizedWindow] = useState(false); // Track if user manually resized

  // Sync messages to chat window whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI && messages.length > 0) {
      window.electronAPI.syncMessagesToChat(messages);

      // Auto-open chat window when first message is sent
      if (messages.length === 1) {
        window.electronAPI.openChatWindow();
      }
    }
  }, [messages]);

  // Listen for conversation loading events from the chat button
  useEffect(() => {
    const handleLoadConversation = (event: CustomEvent) => {
      const { conversation } = event.detail;
      if (conversation && conversation.messages) {
        setMessages(conversation.messages);
        setShowChat(true);
        // Set the current conversation ID
        conversationHistoryService.setCurrentConversationId(conversation.id);
      }
    };

    window.addEventListener('loadConversation', handleLoadConversation as EventListener);
    return () => {
      window.removeEventListener('loadConversation', handleLoadConversation as EventListener);
    };
  }, []);

  // Listen for requests for current messages from chat window
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const handleRequestCurrentMessages = () => {
        // Send current messages to chat window
        if (messages.length > 0) {
          window.electronAPI.syncMessagesToChat(messages);
        }
      };

      // Listen for requests from chat window
      window.electronAPI.onRequestCurrentMessages?.(handleRequestCurrentMessages);

      return () => {
        window.electronAPI.removeAllListeners?.('request-current-messages');
      };
    }
  }, [messages]);





  // Theme system disabled

  // Initialize enhanced window dragging
  const { isDragging } = useEnhancedWindowDrag();

  // Ref for auto-resizing textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);











  // Reset chat function
  const handleResetChat = async () => {
    setMessages([]);
    setShowChat(false);
    setInput('');
    setAttachedFiles([]);

    // Clear the current conversation ID
    conversationHistoryService.setCurrentConversationId(null);

    // Clear localStorage for chat window
    localStorage.removeItem('chatWindowMessages');

    // Sync empty state to chat window
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.syncMessagesToChat([]);
    }

    await sessionService.resetSession();
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

      window.electronAPI.onPromptSelected?.(handlePromptSelected);

      return () => {
        window.electronAPI.removeAllListeners('prompt-selected');
      };
    }
  }, []); // EMPTY DEPENDENCY ARRAY - ONLY SETUP ONCE

  // Listen for window resize events to detect manual resizing
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      let resizeTimeout: NodeJS.Timeout;

      const handleWindowResize = () => {
        // Debounce resize events to avoid excessive state updates
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          setUserResizedWindow(true);
          console.log('User manually resized window - disabling auto-resize');
        }, 500); // 500ms delay to distinguish from auto-resize
      };

      // Listen for window resize events
      window.addEventListener('resize', handleWindowResize);

      return () => {
        window.removeEventListener('resize', handleWindowResize);
        clearTimeout(resizeTimeout);
      };
    }
  }, []);

  // Calculate minimum window size based on UI elements
  const calculateMinimumWindowSize = useCallback(() => {
    const inputArea = document.getElementById('input-area');
    const bottomToolbar = document.getElementById('bottom-toolbar');

    if (inputArea && bottomToolbar) {
      // Get the minimum width needed for the bottom toolbar buttons
      const toolbarRect = bottomToolbar.getBoundingClientRect();
      const minWidth = Math.max(380, Math.ceil(toolbarRect.width + 40)); // Add padding

      // Get minimum height for single-line input + toolbar
      const singleLineHeight = 40; // Actual single-line textarea height (matches button height)
      const toolbarHeight = toolbarRect.height;
      const minHeight = Math.max(90, singleLineHeight + toolbarHeight + 25); // Minimum for 1-line + toolbar

      // Note: Maximum will be handled by the 600px limit to accommodate 10-line textarea

      return { minWidth, minHeight };
    }

    return { minWidth: 380, minHeight: 120 }; // Fallback values
  }, []);

  // Auto-resize window based on actual content measurements
  const autoResizeWindow = useCallback(() => {
    if (typeof window !== 'undefined' && window.electronAPI && !userResizedWindow) {
      // Wait for DOM to be fully rendered and measured
      setTimeout(() => {
        // Get the main container that holds all content
        const mainContainer = document.querySelector('.voila-interface-container') as HTMLElement;

        if (mainContainer) {
          // Force a layout recalculation
          mainContainer.style.height = 'auto';

          // Use getBoundingClientRect for more accurate measurements
          const containerRect = mainContainer.getBoundingClientRect();
          const actualContentHeight = containerRect.height;

          // Add minimal padding for window chrome
          const windowChrome = 8; // Minimal window padding
          const newHeight = Math.ceil(actualContentHeight + windowChrome);

          // Calculate dynamic minimum size based on actual UI elements
          const { minHeight } = calculateMinimumWindowSize();

          // Set reasonable bounds - allow for 10-line textarea + toolbar + attachments
          const maxHeight = 600; // Increased to accommodate 10-line textarea + toolbar + attachments
          const boundedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));

          console.log('Window auto-resize (content-aware):', {
            actualContentHeight: Math.round(actualContentHeight),
            newHeight,
            boundedHeight,
            minHeight,
            attachedFilesCount: attachedFiles.length,
            textareaHeight: textareaRef.current?.offsetHeight || 0,
            containerRect: {
              width: Math.round(containerRect.width),
              height: Math.round(containerRect.height)
            }
          });

          // Get current window size and resize if needed
          window.electronAPI.getCurrentWindowSize().then((currentSize: { width: number; height: number }) => {
            // Only resize if height changed significantly
            if (Math.abs(currentSize.height - boundedHeight) > 5) {
              console.log(`Resizing window from ${currentSize.height}px to ${boundedHeight}px`);
              window.electronAPI.resizeWindow(currentSize.width, boundedHeight);
            }
          }).catch((error: unknown) => {
            console.error('Failed to get current window size:', error);
          });
        }
      }, 50); // Small delay to ensure DOM is updated
    }
  }, [attachedFiles.length, userResizedWindow, calculateMinimumWindowSize]);

  // Auto-resize textarea height and window
  const autoResizeTextarea = useCallback(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;

      // For empty input, always set to single line height
      if (input.trim() === '') {
        textarea.style.height = '40px';
        textarea.style.overflowY = 'hidden';
        setTimeout(() => {
          autoResizeWindow();
        }, 10);
        return;
      }

      // Get computed styles for accurate calculations
      const computedStyle = getComputedStyle(textarea);
      const fontSize = parseInt(computedStyle.fontSize) || 14;
      const lineHeight = computedStyle.lineHeight === 'normal' ? fontSize * 1.4 : parseInt(computedStyle.lineHeight) || (fontSize * 1.4);
      const paddingTop = parseInt(computedStyle.paddingTop) || 6;
      const paddingBottom = parseInt(computedStyle.paddingBottom) || 6;

      // Calculate minimum height for 1 line of text (precise calculation)
      const minHeight = 40; // Fixed to match initial height (1 line) and button height
      const maxHeight = Math.ceil(lineHeight * 10 + paddingTop + paddingBottom); // Max 10 lines as requested

      // Create a hidden clone to measure content without affecting the visible textarea
      const clone = textarea.cloneNode(true) as HTMLTextAreaElement;
      clone.style.position = 'absolute';
      clone.style.visibility = 'hidden';
      clone.style.height = 'auto';
      clone.style.minHeight = 'auto';
      clone.style.maxHeight = 'none';
      clone.style.overflow = 'hidden';
      clone.value = textarea.value;

      // Append to body temporarily to get measurements
      document.body.appendChild(clone);
      const scrollHeight = clone.scrollHeight;
      document.body.removeChild(clone);

      // Calculate final height with hysteresis to prevent jittering
      const currentHeight = parseInt(textarea.style.height) || minHeight;
      let finalHeight = Math.max(minHeight, Math.min(maxHeight, scrollHeight));

      // Add hysteresis: only change height if the difference is significant enough
      const heightDifference = Math.abs(finalHeight - currentHeight);
      const threshold = lineHeight * 0.3; // 30% of line height threshold

      if (heightDifference < threshold && currentHeight >= minHeight && currentHeight <= maxHeight) {
        // Keep current height if change is too small (prevents jittering)
        finalHeight = currentHeight;
      }

      // Set the new height smoothly
      textarea.style.height = `${finalHeight}px`;

      // Enable/disable scrolling based on content
      textarea.style.overflowY = scrollHeight > maxHeight ? 'auto' : 'hidden';

      console.log('Textarea auto-resize:', {
        scrollHeight,
        finalHeight,
        currentHeight,
        heightDifference,
        threshold,
        minHeight,
        maxHeight,
        lineHeight,
        inputLength: input.length,
        lineCount: Math.ceil((scrollHeight - paddingTop - paddingBottom) / lineHeight)
      });

      // Trigger window resize after textarea resize
      setTimeout(() => {
        autoResizeWindow();
      }, 10);
    }
  }, [input, autoResizeWindow]);

  // Auto-resize textarea when input changes
  useEffect(() => {
    // Use setTimeout to ensure DOM is updated
    const timer = setTimeout(() => {
      autoResizeTextarea();
    }, 0);

    return () => clearTimeout(timer);
  }, [input, autoResizeTextarea]);

  // Additional effect to handle immediate textarea changes for better responsiveness
  useEffect(() => {
    if (textareaRef.current) {
      // Immediate resize for better user experience
      autoResizeTextarea();
    }
  }, [input.length, autoResizeTextarea]); // Trigger on length changes for immediate feedback

  // Auto-resize window when attached files change
  useEffect(() => {
    console.log('Attached files changed, triggering resize. Count:', attachedFiles.length);

    // Always trigger resize, but with different timing based on file count
    if (attachedFiles.length === 0) {
      // Quick resize when all attachments are removed
      const quickTimer = setTimeout(() => {
        console.log('No attachments, quick resize down');
        autoResizeWindow();
      }, 30);
      return () => clearTimeout(quickTimer);
    } else {
      // Multiple timers for file additions to handle image loading
      const quickTimer = setTimeout(() => {
        console.log('Attachments present, quick resize');
        autoResizeWindow();
      }, 50);

      const delayedTimer = setTimeout(() => {
        console.log('Attachments present, delayed resize for image loading');
        autoResizeWindow();
      }, 300);

      return () => {
        clearTimeout(quickTimer);
        clearTimeout(delayedTimer);
      };
    }
  }, [attachedFiles.length, autoResizeWindow]); // Use .length to trigger on count changes

  // Initial window resize on component mount
  useEffect(() => {
    // Ensure textarea starts with correct single-line height
    if (textareaRef.current) {
      textareaRef.current.style.height = '40px';
    }

    // Initial resize with longer delay to ensure everything is rendered
    const timer = setTimeout(() => {
      autoResizeTextarea(); // First resize the textarea
      setTimeout(() => {
        autoResizeWindow(); // Then resize the window
      }, 100);
    }, 300);

    return () => clearTimeout(timer);
  }, [autoResizeWindow, autoResizeTextarea]);

  // Additional resize trigger when user stops resizing manually
  useEffect(() => {
    if (userResizedWindow) {
      // If user manually resized, we can re-enable auto-resize after a delay
      const timer = setTimeout(() => {
        console.log('Re-enabling auto-resize after manual resize');
        setUserResizedWindow(false);
      }, 5000); // Re-enable after 5 seconds of no manual resizing

      return () => clearTimeout(timer);
    }
  }, [userResizedWindow]);

  // Listen for clear all history event from history window
  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.onClearAllHistory(async () => {
        console.log('🗑️ Main window received clear-all-history event');
        try {
          // Clear the current conversation and messages
          await handleResetChat();
          console.log('✅ Main window cleared chat after history clear');
        } catch (error) {
          console.error('❌ Failed to clear chat in main window:', error);
        }
      });
    }
  }, []);



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

    // Immediately sync user message to chat window and ensure it's open
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.syncMessagesToChat(updatedMessages);
      // Always open chat window when user sends a new message (re-opens if closed)
      window.electronAPI.openChatWindow();
    }

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



      // Only update the message if streaming didn't occur (to prevent double content)
      if (assistantContent === '') {
        // No streaming occurred, update with the final response
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
      } else {
        // Streaming occurred, just update usage and toolCalls without changing content
        console.log(`🔄 Streaming occurred, updating only usage and toolCalls`);
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantMessage.id
              ? { ...msg, usage: response.usage, toolCalls: response.toolCalls }
              : msg
          )
        );
      }

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

      // Remove any remaining thinking bubbles that might have been added during tool execution
      setMessages(prev => prev.filter(msg => !msg.isThinking));

      console.log('🔄 Message handling completed, reset all loading states and cleared thinking bubbles');
    }
  };



  // Handle prompts button click - open action menu like Ctrl+Shift+Space
  const handlePromptsClick = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.openActionMenu();
    }
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
          console.log(`- Connected servers: ${Object.keys((status as any)?.servers || {}).filter((id: string) => (status as any).servers[id].connected).length}`);
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
              connectedServers: Object.keys((status as any)?.servers || {}).filter((id: string) => (status as any).servers[id].connected).length,
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
      {/* No visual header - completely eliminated for maximum compactness */}

      {/* Content wrapper - Auto-sized container */}
      <div className="flex flex-col" style={{ overflow: 'visible', minHeight: 'auto', height: 'auto' }}>

        {/* Input Area with Attachment Preview */}
      <div
        id="input-area"
        className="flex-none p-1"
      >
        <Card className="p-2" style={{ backgroundColor: 'var(--card)', border: 'none', borderRadius: '8px' }}>
          {/* Attachment Preview */}
          {attachedFiles.length > 0 && (
            <div
              id="attachment-preview"
              className="mb-3 p-2 bg-muted rounded-lg max-h-32 overflow-y-auto"
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
                        onLoad={() => {
                          // Trigger window resize when image loads to account for any layout changes
                          setTimeout(() => autoResizeWindow(), 50);
                        }}
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
                      onClick={() => {
                        console.log('Removing attachment at index:', index);
                        setAttachedFiles(prev => prev.filter((_, i) => i !== index));

                        // Multiple resize triggers for immediate feedback when removing attachments
                        setTimeout(() => {
                          console.log('Immediate resize after attachment removal');
                          autoResizeWindow();
                        }, 5);

                        setTimeout(() => {
                          console.log('Secondary resize after attachment removal');
                          autoResizeWindow();
                        }, 50);

                        // Final resize to ensure window scales down properly
                        setTimeout(() => {
                          autoResizeWindow();
                        }, 150);
                      }}
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
                padding: '8px 12px', // Proper padding to match button height
                height: '40px', // Match button height (h-10)
                minHeight: '40px', // Ensure it doesn't go smaller
                overflowY: 'hidden', // Start with no scrollbar
                transition: 'height 0.1s ease-out' // Smooth height transitions
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





      {/* Bottom Toolbar - TESTING MINIMAL VERSION */}
      <div
        id="bottom-toolbar"
        className="flex-none cursor-default"
      >
        <Card className="rounded-lg m-0" style={{ backgroundColor: 'var(--card)', border: 'none', borderRadius: '0 0 12px 12px', margin: 0 }}>
            <BottomToolbar
              settings={settings}
              onSettingsChange={handleSettingsChange}
              onHistoryClick={openHistory}
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
