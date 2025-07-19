'use client';

import { useState, useEffect, useCallback } from 'react';
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
      const providerSettings = settings.providers?.[providerId] || { apiKey: '' };
      console.log('Provider settings:', providerSettings);

      // Only fetch models if we have an API key (except for Ollama, LM Studio, and n8n which don't require one)
      if (providerId !== 'ollama' && providerId !== 'lmstudio' && providerId !== 'n8n' && !providerSettings.apiKey) {
        console.log(`No API key configured for ${providerId}, fetching without API key`);
        const models = await chatService.fetchModels(providerId, '', '');
        console.log('Models fetched (no API key):', models);
        setAvailableModels(models);

        // ONLY restore model if it exists in the fetched models list
        const lastSelectedModel = settings.providers?.[providerId]?.lastSelectedModel;

        if (!settings.model && lastSelectedModel && models.includes(lastSelectedModel)) {
          console.log('✅ RESTORING valid model for provider (no API key):', providerId, '->', lastSelectedModel);
          onSettingsChange({ model: lastSelectedModel });
        } else if (lastSelectedModel && !models.includes(lastSelectedModel)) {
          console.log('❌ INVALID model found, NOT restoring:', lastSelectedModel, 'not in models:', models.slice(0, 3));
        }
        return;
      }

      const baseUrl = providerSettings.baseUrl || '';
      const apiKey = providerSettings.apiKey || '';
      console.log('🔍 BottomToolbar fetchModels:', {
        providerId,
        hasApiKey: !!apiKey,
        baseUrl,
        providerSettings: JSON.stringify(providerSettings, null, 2)
      });
      const models = await chatService.fetchModels(providerId, apiKey, baseUrl);
      console.log('Models fetched:', models);
      setAvailableModels(models);

      // ONLY restore model if it exists in the fetched models list
      const lastSelectedModel = settings.providers?.[providerId]?.lastSelectedModel;

      if (!settings.model && lastSelectedModel && models.includes(lastSelectedModel)) {
        console.log('✅ RESTORING valid model for provider (with API key):', providerId, '->', lastSelectedModel);
        onSettingsChange({ model: lastSelectedModel });
      } else if (lastSelectedModel && !models.includes(lastSelectedModel)) {
        console.log('❌ INVALID model found, NOT restoring:', lastSelectedModel, 'not in models:', models.slice(0, 3));
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      setAvailableModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  }, [settings, onSettingsChange]);

  // Fetch models when provider changes
  useEffect(() => {
    console.log('🔄 Provider useEffect triggered! settings.provider:', settings.provider);
    if (settings.provider) {
      console.log('Fetching models for provider:', settings.provider);
      fetchModelsForProvider(settings.provider);
    } else {
      console.log('❌ No provider set, skipping model fetch');
    }
  }, [settings.provider, fetchModelsForProvider]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    // Only allow: jpg, png, txt, pdf, md, log (general text files only)
    input.accept = '.jpg,.jpeg,.png,.txt,.pdf,.md,.log';
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && onFileUpload) {
        // Additional validation to ensure only allowed file types
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.txt', '.pdf', '.md', '.log'];
        const validFiles = Array.from(files).filter(file => {
          const extension = '.' + file.name.split('.').pop()?.toLowerCase();
          return allowedExtensions.includes(extension);
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

            // Add file name
            const fileName = document.createElement('div');
            fileName.style.flex = '1';
            fileName.style.overflow = 'hidden';
            fileName.style.textOverflow = 'ellipsis';
            fileName.style.whiteSpace = 'nowrap';
            fileName.style.fontSize = '12px';
            fileName.style.color = '#e2e8f0';
            fileName.textContent = file.name;
            filePreview.appendChild(fileName);

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
          console.warn('No valid files selected. Allowed types: jpg, png, txt, pdf, md, log');
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

                  // FIRST: Save the current model to the current provider's lastSelectedModel
                  const currentProvider = settings.provider;
                  const currentModel = settings.model;

                  const updatedProviders = { ...settings.providers };

                  if (currentProvider && currentModel && currentModel.trim() !== '') {
                    console.log('💾 SAVING current model to current provider:', currentProvider, '->', currentModel);
                    updatedProviders[currentProvider] = {
                      ...updatedProviders[currentProvider],
                      lastSelectedModel: currentModel
                    };
                  }

                  // SECOND: ALWAYS CLEAR THE MODEL WHEN SWITCHING PROVIDERS
                  // The model will be restored ONLY when models are fetched and validated
                  console.log('🧹 CLEARING model field - will be restored after models are fetched');
                  console.log('Final providers object:', updatedProviders);
                  console.log('=== END PROVIDER SWITCH DEBUG ===');

                  onSettingsChange({
                    provider: providerId,
                    model: '', // ALWAYS CLEAR - will be restored in fetchModelsForProvider
                    providers: updatedProviders // Include the updated providers object
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
                    // Update the model and save it as the last selected model for the current provider
                    const updatedProviders = {
                      ...settings.providers,
                      [settings.provider]: {
                        ...settings.providers[settings.provider],
                        lastSelectedModel: value
                      }
                    };

                    console.log('Updating settings with:', { model: value, providers: updatedProviders });
                    onSettingsChange({
                      model: value,
                      providers: updatedProviders
                    });

                    // Auto-save model selection to disk for persistence across restarts
                    setTimeout(async () => {
                      try {
                        console.log('Auto-saving model selection to disk...');
                        await settingsService.saveSettingsToDisk();
                        console.log('Model selection auto-saved successfully');
                      } catch (error) {
                        console.error('Failed to auto-save model selection:', error);
                      }
                    }, 500); // Small delay to ensure settings are updated

                    console.log('Model settings updated successfully');
                  } else {
                    console.error('Invalid model selection:', { value, provider: settings.provider });
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
