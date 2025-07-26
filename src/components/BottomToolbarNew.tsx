'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './ui/button';
import { ElectronDropdown } from './ui/electron-dropdown';
import { ProviderDropdown } from './ui/provider-dropdown';
import { MCPDropdown } from './ui/mcp-dropdown';
import {
  History,
  Settings,
  Wand2,
  RotateCcw,
  MessageSquare
} from 'lucide-react';
import { chatService } from '../services/chatService';
import type { ChatSettings } from '../services/chatService';
import { settingsService } from '../services/settingsService';
import { conversationHistoryService } from '../services/conversationHistoryService';
import { secureApiKeyService } from '../services/secureApiKeyService';

interface BottomToolbarProps {
  onFileUpload?: (files: FileList) => void;
  onScreenshotCapture?: (file: File) => void;
  onPromptsClick?: () => void;
  onResetChat?: () => void;
  settings: ChatSettings;
  onSettingsChange: (settings: Partial<ChatSettings>) => void;
  onHistoryClick?: () => void;
}

export function BottomToolbar({
  onFileUpload,
  onScreenshotCapture,
  onPromptsClick,
  onResetChat,
  settings,
  onSettingsChange,
  onHistoryClick
}: BottomToolbarProps) {
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);



  const getProviderNameFromId = (id: string) => {
    const provider = chatService.getProviders().find(p => p.id === id);
    return provider?.name || id;
  };

  // Debug: Log settings changes
  useEffect(() => {
    console.log('🔍 Settings changed in BottomToolbar:', {
      provider: settings.provider,
      model: settings.model,
      settingsObject: settings
    });
  }, [settings]);

  // Initialize provider if none is set - but wait for settings to load
  useEffect(() => {
    const providers = chatService.getProviders();
    console.log('Total providers found:', providers.length);
    console.log('Available providers:', providers.map(p => ({ id: p.id, name: p.name })));
    console.log('Current provider:', settings.provider);
    console.log('Current model:', settings.model);
    console.log('Settings object:', settings);

    // Never auto-initialize provider - only use what the user has saved
    // Let the user manually select their provider
  }, [settings]); // Watch for settings changes

  const fetchModelsForProvider = useCallback(async (providerId: string) => {
    console.log('fetchModelsForProvider called with:', providerId);
    setIsLoadingModels(true);
    try {
      // Wait for secure API key service to be initialized
      await secureApiKeyService.waitForInitialization();

      // Get API key from secure storage instead of settings
      let apiKeyData = null;
      let apiKey = '';
      let baseUrl = '';

      try {
        apiKeyData = secureApiKeyService.getApiKeyData(providerId);
        apiKey = apiKeyData?.apiKey || '';
        baseUrl = apiKeyData?.baseUrl || '';
      } catch (error) {
        console.error(`❌ Failed to get API key data for ${providerId}:`, error);
        // Don't mask the error - let the user know there's an issue
        setAvailableModels([]);
        return;
      }

      console.log('🔍 BottomToolbar fetchModels from secure storage:', {
        providerId,
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey.length,
        hasBaseUrl: !!baseUrl,
        secureServiceInitialized: secureApiKeyService.isInitialized()
      });

      // Only fetch models if we have an API key (except for Ollama, LM Studio, and n8n which don't require one)
      if (providerId !== 'ollama' && providerId !== 'lmstudio' && providerId !== 'n8n' && !apiKey) {
        console.log(`❌ No API key configured for ${providerId} - cannot fetch models`);
        setAvailableModels([]);
        return;
      }

      const models = await chatService.fetchModels(providerId, apiKey, baseUrl);
      console.log(`✅ Models fetched for ${providerId} with API key:`, models.length, 'models available');
      setAvailableModels(models);

      if (models.length === 0) {
        console.warn(`⚠️ No models returned for ${providerId} with API key - check API key validity`);
      }

      // ONLY restore model if it exists in the fetched models list
      // Get last selected model from secure storage
      const lastSelectedModel = apiKeyData?.lastSelectedModel;
      const currentSettings = settingsRef.current;

      if (!currentSettings.model && lastSelectedModel && models.includes(lastSelectedModel)) {
        console.log('✅ RESTORING valid model for provider (with API key):', providerId, '->', lastSelectedModel);
        onSettingsChange({ model: lastSelectedModel });
      } else if (lastSelectedModel && !models.includes(lastSelectedModel)) {
        console.log('❌ INVALID model found, NOT restoring:', lastSelectedModel, 'not in models:', models.slice(0, 3));
      }
    } catch (error) {
      console.error(`❌ Failed to fetch models for ${providerId}:`, error);
      setAvailableModels([]);

      // Provide user-friendly error message
      if (error instanceof Error) {
        if (error.message.includes('network') || error.message.includes('fetch')) {
          console.warn(`🌐 Network error fetching models for ${providerId} - check internet connection`);
        } else if (error.message.includes('unauthorized') || error.message.includes('401')) {
          console.warn(`🔐 Authentication error for ${providerId} - check API key`);
        } else {
          console.warn(`⚠️ Unexpected error fetching models for ${providerId}:`, error.message);
        }
      }
    } finally {
      setIsLoadingModels(false);
    }
  }, [onSettingsChange]); // Remove settings dependency to prevent constant recreation

  // Fetch models when provider changes - use ref to access current settings
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    // Only log when provider actually changes, not on every render
    if (settings.provider) {
      console.log('🔄 Provider changed, fetching models for:', settings.provider);
      fetchModelsForProvider(settings.provider);
    }
  }, [settings.provider]); // Only watch provider changes, not the callback

  // Listen for settings saved events to refresh models
  useEffect(() => {
    const handleSettingsSaved = (event: CustomEvent) => {
      console.log('🔄 Settings saved event received, clearing cache and refreshing models');

      // Clear model cache to force fresh fetch
      chatService.clearModelCache();

      if (settings.provider) {
        console.log('🔄 Refreshing models for current provider:', settings.provider);
        fetchModelsForProvider(settings.provider);
      }
    };

    window.addEventListener('settingsSaved', handleSettingsSaved as EventListener);
    return () => {
      window.removeEventListener('settingsSaved', handleSettingsSaved as EventListener);
    };
  }, [settings.provider, fetchModelsForProvider]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;

    // Provider-specific file type support
    // Base supported formats (all providers support these with text extraction)
    const baseFormats = '.jpg,.jpeg,.png,.txt,.pdf,.md,.log,.csv,.json,.html,.htm,.xml,.ics,.rtf';
    const baseExtensions = ['.jpg', '.jpeg', '.png', '.txt', '.pdf', '.md', '.log', '.csv', '.json', '.html', '.htm', '.xml', '.ics', '.rtf'];

    // Extended formats (require document parsing)
    const extendedFormats = '.docx,.doc,.xlsx,.xls,.ods,.pptx,.ppt';
    const extendedExtensions = ['.docx', '.doc', '.xlsx', '.xls', '.ods', '.pptx', '.ppt'];

    let acceptedTypes = baseFormats + ',' + extendedFormats;
    let allowedExtensions = [...baseExtensions, ...extendedExtensions];

    if (settings.provider === 'mistral') {
      // Mistral supports additional formats through its Document AI and Vision
      acceptedTypes = baseFormats + ',' + extendedFormats + ',.webp,.gif';
      allowedExtensions = [...baseExtensions, ...extendedExtensions, '.webp', '.gif'];
    }

    input.accept = acceptedTypes;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && onFileUpload) {
        // Provider-specific file validation
        const validFiles = Array.from(files).filter(file => {
          const extension = '.' + file.name.split('.').pop()?.toLowerCase();

          // Basic extension check
          if (!allowedExtensions.includes(extension)) {
            return false;
          }

          // Mistral-specific validation
          if (settings.provider === 'mistral') {
            // Import MistralFileService for validation
            try {
              // Dynamic import to avoid circular dependencies
              import('../services/mistralFileService').then(({ MistralFileService }) => {
                const validation = MistralFileService.isFileSupported(file);
                if (!validation.supported) {
                  console.warn(`❌ Mistral file validation failed: ${validation.reason}`);
                }
              });
            } catch (error) {
              console.warn('Could not validate file for Mistral:', error);
            }
          }

          return true;
        });

        if (validFiles.length > 0) {
          // Create a preview container
          const previewContainer = document.createElement('div');
          previewContainer.className = 'file-upload-preview';
          previewContainer.style.position = 'fixed';
          previewContainer.style.bottom = '60px';
          previewContainer.style.right = '10px';
          previewContainer.style.display = 'flex';
          previewContainer.style.flexDirection = 'column';
          previewContainer.style.gap = '5px';
          previewContainer.style.zIndex = '1000';
          document.body.appendChild(previewContainer);

          // Add each file as a preview
          validFiles.forEach((file) => {
            const filePreview = document.createElement('div');
            filePreview.style.display = 'flex';
            filePreview.style.alignItems = 'center';
            filePreview.style.padding = '5px';
            filePreview.style.backgroundColor = '#1e293b';
            filePreview.style.borderRadius = '4px';
            filePreview.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
            filePreview.style.marginBottom = '5px';
            filePreview.style.maxWidth = '200px';

            // Add thumbnail or icon
            if (file.type.startsWith('image/')) {
              const img = document.createElement('img');
              img.src = URL.createObjectURL(file);
              img.style.width = '40px';
              img.style.height = '40px';
              img.style.objectFit = 'cover';
              img.style.borderRadius = '2px';
              img.style.marginRight = '8px';
              filePreview.appendChild(img);
            } else {
              const icon = document.createElement('div');
              icon.style.width = '40px';
              icon.style.height = '40px';
              icon.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
              icon.style.borderRadius = '2px';
              icon.style.display = 'flex';
              icon.style.alignItems = 'center';
              icon.style.justifyContent = 'center';
              icon.style.marginRight = '8px';
              icon.style.color = '#3b82f6';
              icon.style.fontWeight = 'bold';
              icon.style.fontSize = '10px';
              icon.textContent = file.name.split('.').pop()?.toUpperCase() || 'FILE';
              filePreview.appendChild(icon);
            }

            // Add file name and provider-specific info
            const fileInfo = document.createElement('div');
            fileInfo.style.flex = '1';
            fileInfo.style.display = 'flex';
            fileInfo.style.flexDirection = 'column';
            fileInfo.style.overflow = 'hidden';

            const fileName = document.createElement('div');
            fileName.style.overflow = 'hidden';
            fileName.style.textOverflow = 'ellipsis';
            fileName.style.whiteSpace = 'nowrap';
            fileName.style.fontSize = '12px';
            fileName.style.color = '#e2e8f0';
            fileName.textContent = file.name;
            fileInfo.appendChild(fileName);

            // Add provider-specific processing info
            if (settings.provider === 'mistral') {
              const processingInfo = document.createElement('div');
              processingInfo.style.fontSize = '10px';
              processingInfo.style.color = '#94a3b8';
              processingInfo.style.marginTop = '2px';

              const extension = '.' + file.name.split('.').pop()?.toLowerCase();

              if (file.type.startsWith('image/')) {
                processingInfo.textContent = '🖼️ Mistral Vision';
              } else if (file.type === 'application/pdf' || ['.docx', '.doc', '.xlsx', '.xls', '.ods', '.pptx', '.ppt'].includes(extension)) {
                processingInfo.textContent = '📄 Mistral Document AI';
              } else if (['.txt', '.md', '.csv', '.json', '.html', '.htm', '.xml', '.ics', '.rtf'].includes(extension)) {
                processingInfo.textContent = '📝 Document Parser';
              } else {
                processingInfo.textContent = '🔍 Mistral Processing';
              }

              fileInfo.appendChild(processingInfo);
            }

            filePreview.appendChild(fileInfo);

            previewContainer.appendChild(filePreview);
          });

          // Animate and remove after delay
          setTimeout(() => {
            previewContainer.style.transition = 'all 0.5s ease-in-out';
            previewContainer.style.opacity = '0';
            previewContainer.style.transform = 'translateX(20px)';

            setTimeout(() => {
              document.body.removeChild(previewContainer);
            }, 500);
          }, 2000);

          const fileList = new DataTransfer();
          validFiles.forEach(file => fileList.items.add(file));
          onFileUpload(fileList.files);
          console.log('Files uploaded:', validFiles.map(f => f.name));
        } else {
          const providerInfo = settings.provider === 'mistral'
            ? 'Mistral supports: images (jpg, png, webp, gif), documents (pdf, docx, doc, xlsx, xls, ods, pptx, ppt), text files (txt, md, csv, json, html, xml, ics, rtf)'
            : 'Supported types: images (jpg, png), documents (pdf, docx, doc, xlsx, xls, ods, pptx, ppt), text files (txt, md, csv, json, html, xml, ics, rtf, log)';
          console.warn(`No valid files selected. ${providerInfo}`);
        }
      }
    };
    input.click();
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleScreenshot = async () => {
    try {
      console.log('Screenshot button clicked');
      if (typeof window !== 'undefined' && window.electronAPI) {
        console.log('Calling electronAPI.takeScreenshot...');
        const result = await window.electronAPI.takeScreenshot();
        console.log('Screenshot result:', result);

        if (typeof result === 'object' && result.success && result.dataURL && onScreenshotCapture) {
          console.log('Converting screenshot to file...');
          const response = await fetch(result.dataURL);
          const blob = await response.blob();
          const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
          console.log('Screenshot file created:', file.name, file.size, 'bytes');

          // Create a preview thumbnail in the UI immediately
          const img = document.createElement('img');
          if (typeof result === 'object' && result.dataURL) {
            img.src = result.dataURL;
          }
          img.className = 'screenshot-preview';
          img.style.position = 'fixed';
          img.style.bottom = '60px';
          img.style.right = '10px';
          img.style.width = '100px';
          img.style.height = 'auto';
          img.style.border = '2px solid #3b82f6';
          img.style.borderRadius = '4px';
          img.style.zIndex = '1000';
          img.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
          document.body.appendChild(img);

          // Animate the thumbnail
          setTimeout(() => {
            img.style.transition = 'all 0.5s ease-in-out';
            img.style.transform = 'scale(0.8)';
            img.style.opacity = '0.8';

            // Remove the preview after animation
            setTimeout(() => {
              document.body.removeChild(img);
            }, 1000);
          }, 100);

          onScreenshotCapture(file);
          console.log('Screenshot captured and passed to parent component');
        } else {
          console.error('Screenshot failed or no callback:', {
            success: typeof result === 'object' ? result.success : false,
            hasDataURL: typeof result === 'object' ? !!result.dataURL : false,
            hasCallback: !!onScreenshotCapture
          });
        }
      } else {
        console.error('No electronAPI available');
      }
    } catch (error) {
      console.error('Failed to take screenshot:', error);
    }
  };

  return (
    <div className="flex items-center justify-between px-4 py-2">
      {/* Left side - Provider Selection */}
      <div className="flex items-center gap-2">
        {/* Provider Dropdown */}
        <div className="flex items-center gap-1">
          <div className="relative" data-interactive="true">
            <ProviderDropdown
              value={getProviderNameFromId(settings.provider)}
              onValueChange={(value: string) => {
                console.log('🔥 ProviderDropdown onValueChange triggered!');
                console.log('🔥 Raw value received:', value);

                // Check if the value is a provider ID or provider name
                let providerId: string;
                let providerName: string;

                const providerById = chatService.getProviders().find(p => p.id === value);
                const providerByName = chatService.getProviders().find(p => p.name === value);

                if (providerById) {
                  // Value is a provider ID (from Electron dropdown)
                  providerId = value;
                  providerName = providerById.name;
                  console.log('🔥 Received provider ID:', providerId, '-> name:', providerName);
                } else if (providerByName) {
                  // Value is a provider name (from regular dropdown)
                  providerId = providerByName.id;
                  providerName = value;
                  console.log('🔥 Received provider name:', providerName, '-> ID:', providerId);
                } else {
                  console.error('🔥 Unknown provider value:', value);
                  return;
                }

                if (providerId) {
                  console.log('=== PROVIDER SWITCH DEBUG ===');
                  console.log('Switching FROM provider:', settings.provider, 'TO provider:', providerId);
                  console.log('Provider name:', providerName);
                  console.log('Current settings.model:', settings.model);
                  console.log('Current settings.providers:', settings.providers);

                  // FIRST: Save the current model to secure storage for the current provider
                  const currentProvider = settings.provider;
                  const currentModel = settings.model;

                  if (currentProvider && currentModel && currentModel.trim() !== '') {
                    console.log('💾 SAVING current model to secure storage:', currentProvider, '->', currentModel);
                    // Save to secure storage asynchronously
                    setTimeout(async () => {
                      try {
                        await secureApiKeyService.waitForInitialization();

                        try {
                          const currentApiKeyData = secureApiKeyService.getApiKeyData(currentProvider);
                          if (currentApiKeyData) {
                            await secureApiKeyService.setApiKeyData(currentProvider, {
                              ...currentApiKeyData,
                              lastSelectedModel: currentModel
                            });
                          } else {
                            await secureApiKeyService.setApiKeyData(currentProvider, {
                              apiKey: '',
                              baseUrl: '',
                              lastSelectedModel: currentModel
                            });
                          }
                          console.log('✅ Saved current model to secure storage');
                        } catch (error) {
                          console.error('❌ Failed to save current model to secure storage:', error);
                          // Don't mask the error - let user know there's an issue
                        }
                      } catch (error) {
                        console.error('❌ Failed to save current model to secure storage:', error);
                      }
                    }, 50);
                  }

                  // SECOND: ALWAYS CLEAR THE MODEL WHEN SWITCHING PROVIDERS
                  // The model will be restored ONLY when models are fetched and validated
                  console.log('🧹 CLEARING model field - will be restored after models are fetched');
                  console.log('=== END PROVIDER SWITCH DEBUG ===');

                  onSettingsChange({
                    provider: providerId,
                    model: '' // ALWAYS CLEAR - will be restored in fetchModelsForProvider
                  });
                  console.log('Settings updated with provider:', providerId, 'and model:', '');
                } else {
                  console.error('Could not find provider ID for name:', providerName);
                }
              }}
              placeholder="Select Provider"
              providers={chatService.getProviders()}
              className="h-8 w-[50px] text-xs"
            />
          </div>
        </div>
      </div>

      {/* Center - Model Selection */}
      <div className="flex items-center gap-2" data-interactive="true">
        {settings.provider && (
          <div className="w-[200px]" data-interactive="true">
            {isLoadingModels ? (
              <div className="h-8 px-3 flex items-center justify-center text-xs text-muted-foreground border rounded-md">
                Loading...
              </div>
            ) : (
              <ElectronDropdown
                value={settings.model}
                options={availableModels}
                onValueChange={(value: string) => {
                  console.log('🚨 ElectronDropdown onValueChange called!');
                  console.log('🚨 Value received:', value);
                  console.log('🚨 Type of value:', typeof value);
                  console.log('🚨 Available models:', availableModels);
                  console.log('🚨 Is value in availableModels?', availableModels.includes(value));
                  console.log('🎯 Model selection callback triggered!');
                  console.log('🎯 Model selected:', value);
                  console.log('🎯 Current provider:', settings.provider);
                  console.log('🎯 Available models:', availableModels.slice(0, 3));

                  // VALIDATE: Only allow models that are in the availableModels list
                  if (!availableModels.includes(value)) {
                    console.error('🚨 REJECTED: Model not in available models list:', value);
                    return;
                  }

                  if (value && settings.provider) {
                    // Update the current model in settings
                    console.log('🔄 Updating current model to:', value);
                    onSettingsChange({ model: value });

                    // Save the selected model to secure storage for this provider
                    setTimeout(async () => {
                      try {
                        console.log('💾 Saving last selected model to secure storage...');
                        await secureApiKeyService.waitForInitialization();

                        try {
                          const currentApiKeyData = secureApiKeyService.getApiKeyData(settings.provider);
                          if (currentApiKeyData) {
                            // Update existing API key data with new last selected model
                            await secureApiKeyService.setApiKeyData(settings.provider, {
                              ...currentApiKeyData,
                              lastSelectedModel: value
                            });
                            console.log('✅ Last selected model saved to secure storage');
                          } else {
                            // Create new entry with just the last selected model
                            await secureApiKeyService.setApiKeyData(settings.provider, {
                              apiKey: '',
                              baseUrl: '',
                              lastSelectedModel: value
                            });
                            console.log('✅ Created new secure storage entry with last selected model');
                          }
                        } catch (error) {
                          console.error('❌ Failed to save last selected model to secure storage:', error);
                          // Don't mask the error - let user know there's an issue
                        }
                      } catch (error) {
                        console.error('❌ Failed to save last selected model:', error);
                      }
                    }, 100); // Small delay to ensure settings are updated

                    console.log('✅ Model selection completed');
                  } else {
                    console.error('❌ Invalid model selection:', { value, provider: settings.provider });
                  }
                }}
                placeholder="Select model..."
                className="h-8 w-full text-xs"
              />
            )}
          </div>
        )}
      </div>

      {/* Right side - Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onPromptsClick}
          className="h-8 w-8 p-0"
          title="Prompts"
          data-interactive="true"
        >
          <Wand2 className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onResetChat}
          className="h-8 w-8 p-0"
          title="Reset Chat"
          data-interactive="true"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onHistoryClick}
          className="h-8 w-8 p-0"
          title="Chat History"
          data-interactive="true"
        >
          <History className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            if (typeof window !== 'undefined' && window.electronAPI) {
              // Check if there's already an active conversation
              const currentConversationId = conversationHistoryService.getCurrentConversationId();

              // Only load a previous conversation if there's no active conversation
              if (!currentConversationId) {
                try {
                  const conversations = await conversationHistoryService.getAllConversations();
                  if (conversations.length > 0) {
                    const mostRecent = conversations[0]; // Conversations are sorted by most recent first
                    const fullConversation = await conversationHistoryService.loadFullConversation(mostRecent.id);
                    if (fullConversation && fullConversation.messages) {
                      // Sync the conversation to the chat window
                      window.electronAPI.syncMessagesToChat(fullConversation.messages);

                      // Also trigger a custom event to load the conversation in the main window
                      const event = new CustomEvent('loadConversation', {
                        detail: { conversation: fullConversation }
                      });
                      window.dispatchEvent(event);
                    }
                  }
                } catch (error) {
                  console.error('Failed to load recent conversation:', error);
                }
              }

              // Open the chat window (it will request current messages automatically)
              window.electronAPI.openChatWindow();
            }
          }}
          className="h-8 w-8 p-0"
          title="Open Chat Window"
          data-interactive="true"
        >
          <MessageSquare className="h-4 w-4" />
        </Button>

        <MCPDropdown
          className="h-8 w-8"
        />

        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (typeof window !== 'undefined' && window.electronAPI) {
              window.electronAPI.openSettingsOverlay();
            }
          }}
          className="h-8 w-8 p-0"
          title="Settings"
          data-interactive="true"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
