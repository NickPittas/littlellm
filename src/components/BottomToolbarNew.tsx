'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { ElectronDropdown } from './ui/electron-dropdown';
import {
  Camera,
  Paperclip,
  History,
  Settings,
  Wand2
} from 'lucide-react';
import { chatService } from '../services/chatService';
import type { ChatSettings } from '../services/chatService';
import { settingsService } from '../services/settingsService';

interface BottomToolbarProps {
  onFileUpload?: (files: FileList) => void;
  onScreenshotCapture?: (file: File) => void;
  onPromptsClick?: () => void;
  settings: ChatSettings;
  onSettingsChange: (settings: Partial<ChatSettings>) => void;
  showHistory?: boolean;
  onHistoryChange?: (show: boolean) => void;
}

export function BottomToolbar({
  onFileUpload,
  onScreenshotCapture,
  onPromptsClick,
  settings,
  onSettingsChange,
  showHistory,
  onHistoryChange
}: BottomToolbarProps) {
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Get provider display options
  const getProviderOptions = () => {
    return chatService.getProviders().map(provider => provider.name);
  };

  const getProviderIdFromName = (name: string) => {
    const provider = chatService.getProviders().find(p => p.name === name);
    return provider?.id || '';
  };

  const getProviderNameFromId = (id: string) => {
    const provider = chatService.getProviders().find(p => p.id === id);
    return provider?.name || id;
  };

  // Initialize provider if none is set - ONLY RUN ONCE
  useEffect(() => {
    const providers = chatService.getProviders();
    console.log('Total providers found:', providers.length);
    console.log('Available providers:', providers.map(p => ({ id: p.id, name: p.name })));
    console.log('Current provider:', settings.provider);
    console.log('Settings object:', settings);

    if (!settings.provider && providers.length > 0) {
      console.log('No provider set, initializing with first provider:', providers[0].id);
      onSettingsChange({ provider: providers[0].id });
    }
  }, []); // EMPTY DEPENDENCY ARRAY - ONLY RUN ONCE ON MOUNT

  // Fetch models when provider changes
  useEffect(() => {
    if (settings.provider) {
      console.log('Fetching models for provider:', settings.provider);
      fetchModelsForProvider(settings.provider);
    }
  }, [settings.provider]);

  const fetchModelsForProvider = async (providerId: string) => {
    console.log('fetchModelsForProvider called with:', providerId);
    setIsLoadingModels(true);
    try {
      const providerSettings = settings.providers?.[providerId] || { apiKey: '' };
      console.log('Provider settings:', providerSettings);

      // Only fetch models if we have an API key (except for Ollama and LM Studio which don't require one)
      if (providerId !== 'ollama' && providerId !== 'lmstudio' && !providerSettings.apiKey) {
        console.log(`No API key configured for ${providerId}, fetching without API key`);
        const models = await chatService.fetchModels(providerId, '', '');
        console.log('Models fetched (no API key):', models);
        setAvailableModels(models);

        // If no model is currently selected but there's a last selected model for this provider, restore it
        const lastSelectedModel = settings.providers?.[providerId]?.lastSelectedModel;
        if (!settings.model && lastSelectedModel && models.includes(lastSelectedModel)) {
          console.log('Restoring last selected model for provider (no API key):', providerId, '->', lastSelectedModel);
          onSettingsChange({ model: lastSelectedModel });
        }
        return;
      }

      const baseUrl = providerSettings.baseUrl || '';
      const apiKey = providerSettings.apiKey || '';
      console.log('Fetching models with API key:', { providerId, hasApiKey: !!apiKey, baseUrl });
      const models = await chatService.fetchModels(providerId, apiKey, baseUrl);
      console.log('Models fetched:', models);
      setAvailableModels(models);

      // If no model is currently selected but there's a last selected model for this provider, restore it
      const lastSelectedModel = settings.providers?.[providerId]?.lastSelectedModel;
      if (!settings.model && lastSelectedModel && models.includes(lastSelectedModel)) {
        console.log('Restoring last selected model for provider:', providerId, '->', lastSelectedModel);
        onSettingsChange({ model: lastSelectedModel });
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      setAvailableModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };
  
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

  const handleScreenshot = async () => {
    try {
      console.log('Screenshot button clicked');
      if (typeof window !== 'undefined' && window.electronAPI) {
        console.log('Calling electronAPI.takeScreenshot...');
        const result = await window.electronAPI.takeScreenshot();
        console.log('Screenshot result:', result);

        if (result.success && result.dataURL && onScreenshotCapture) {
          console.log('Converting screenshot to file...');
          const response = await fetch(result.dataURL);
          const blob = await response.blob();
          const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });
          console.log('Screenshot file created:', file.name, file.size, 'bytes');

          // Create a preview thumbnail in the UI immediately
          const img = document.createElement('img');
          img.src = result.dataURL;
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
          console.error('Screenshot failed or no callback:', { success: result.success, hasDataURL: !!result.dataURL, hasCallback: !!onScreenshotCapture });
        }
      } else {
        console.error('No electronAPI available');
      }
    } catch (error) {
      console.error('Failed to take screenshot:', error);
    }
  };

  return (
    <div
      className="flex items-center justify-between px-4 py-2"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
    >
      {/* Left side - Provider Selection */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        {/* Provider Dropdown */}
        <div
          className="flex items-center gap-1"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
        >
          <div
            className="relative"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
          >
            <ElectronDropdown
              value={getProviderNameFromId(settings.provider)}
              onValueChange={(providerName: string) => {
                const providerId = getProviderIdFromName(providerName);
                console.log('Provider selection callback triggered!');
                console.log('Provider selected:', providerName, '->', providerId);
                console.log('Available providers:', chatService.getProviders().map(p => ({ id: p.id, name: p.name })));

                if (providerId) {
                  // Get the last selected model for this provider
                  const lastSelectedModel = settings.providers?.[providerId]?.lastSelectedModel || '';
                  console.log('Switching to provider:', providerId, 'with last selected model:', lastSelectedModel);

                  onSettingsChange({
                    provider: providerId,
                    model: lastSelectedModel // Restore last selected model for this provider
                  });
                  console.log('Settings updated with provider:', providerId, 'and model:', lastSelectedModel);
                } else {
                  console.error('Could not find provider ID for name:', providerName);
                }
              }}
              placeholder="Select Provider"
              options={getProviderOptions()}
              className="h-8 min-w-[120px] text-xs"
            />
          </div>
        </div>
      </div>

      {/* Center - Model Selection */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        {settings.provider && (
          <div
            className="min-w-[200px]"
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
          >
            {isLoadingModels ? (
              <div className="h-8 px-3 flex items-center justify-center text-xs text-muted-foreground border rounded-md">
                Loading...
              </div>
            ) : (
              <ElectronDropdown
                value={settings.model}
                onValueChange={(value: string) => {
                  console.log('Model selection callback triggered!');
                  console.log('Model selected:', value);
                  console.log('Current provider:', settings.provider);
                  console.log('Available models:', availableModels);

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
                options={availableModels}
                className="h-8 text-xs"
              />
            )}
          </div>
        )}
      </div>

      {/* Right side - Action buttons */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={handleFileUpload}
          className="h-8 w-8 p-0"
          title="Upload File"
        >
          <Paperclip className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={onPromptsClick}
          className="h-8 w-8 p-0"
          title="Prompts"
        >
          <Wand2 className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleScreenshot}
          className="h-8 w-8 p-0"
          title="Take Screenshot"
        >
          <Camera className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => onHistoryChange?.(!showHistory)}
          className="h-8 w-8 p-0"
          title="Chat History"
        >
          <History className="h-4 w-4" />
        </Button>

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
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
