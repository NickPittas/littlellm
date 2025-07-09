'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import {
  Camera,
  Paperclip,
  History,
  Settings,
  ChevronDown,
  Zap,
  Brain,
  Cpu
} from 'lucide-react';
import { Badge } from './ui/badge';
// Settings handled by overlay system
import { chatService, type ChatSettings } from '../services/chatService';

// Provider icons mapping
const getProviderIcon = (providerId: string) => {
  switch (providerId) {
    case 'openai':
      return <Zap className="h-4 w-4" />;
    case 'openrouter':
      return <Brain className="h-4 w-4" />;
    case 'ollama':
      return <Cpu className="h-4 w-4" />;
    case 'requesty':
      return <Zap className="h-4 w-4" />;
    case 'replicate':
      return <Brain className="h-4 w-4" />;
    default:
      return <Cpu className="h-4 w-4" />;
  }
};

// Provider badges mapping
const getProviderBadge = (providerId: string) => {
  switch (providerId) {
    case 'openai':
      return 'Premium';
    case 'openrouter':
      return 'Multi';
    case 'ollama':
      return 'Local';
    case 'requesty':
      return 'Smart';
    case 'replicate':
      return 'Cloud';
    default:
      return 'API';
  }
};

interface BottomToolbarProps {
  onFileUpload?: (files: FileList) => void;
  onScreenshotCapture?: (file: File) => void;
  settings?: ChatSettings;
  onSettingsChange?: (settings: Partial<ChatSettings>) => void;
  showHistory?: boolean;
  onHistoryChange?: (show: boolean) => void;
}

export function BottomToolbar({ onFileUpload, onScreenshotCapture, settings, onSettingsChange, showHistory, onHistoryChange }: BottomToolbarProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Default settings if not provided
  const currentSettings: ChatSettings = settings || {
    provider: 'openrouter',
    model: 'mistralai/mistral-7b-instruct:free',
    temperature: 0.7,
    maxTokens: 4096,
    systemPrompt: 'You are a helpful AI assistant.',
    providers: {
      openai: { apiKey: '', lastSelectedModel: 'gpt-4o' },
      openrouter: { apiKey: '', lastSelectedModel: 'mistralai/mistral-7b-instruct:free' },
      requesty: { apiKey: '', lastSelectedModel: 'openai/gpt-4o-mini' },
      ollama: { apiKey: '', baseUrl: 'http://localhost:11434', lastSelectedModel: 'llama2' },
      replicate: { apiKey: '', lastSelectedModel: 'meta/llama-2-70b-chat' },
    },
  };

  const providers = chatService.getProviders();
  const currentProvider = chatService.getProvider(currentSettings.provider);
  const availableModels = currentProvider?.models || [];

  // Fetch models when provider changes
  useEffect(() => {
    const fetchModels = async () => {
      if (currentSettings.provider) {
        setIsLoadingModels(true);
        try {
          const providerSettings = currentSettings.providers?.[currentSettings.provider] || { apiKey: '' };
          await chatService.fetchModels(
            currentSettings.provider,
            providerSettings.apiKey,
            providerSettings.baseUrl
          );
        } catch (error) {
          console.error('Failed to fetch models:', error);
        } finally {
          setIsLoadingModels(false);
        }
      }
    };

    fetchModels();
  }, [currentSettings.provider, currentSettings.providers]);

  const handleProviderChange = async (providerId: string) => {
    if (onSettingsChange) {
      setIsLoadingModels(true);
      try {
        const providerSettings = currentSettings.providers?.[providerId] || { apiKey: '' };
        const models = await chatService.fetchModels(providerId, providerSettings.apiKey, providerSettings.baseUrl);

        // Use the last selected model for this provider if available, otherwise use the first model
        const lastSelectedModel = providerSettings.lastSelectedModel;
        const modelToSelect = lastSelectedModel && models.includes(lastSelectedModel)
          ? lastSelectedModel
          : (models.length > 0 ? models[0] : '');

        onSettingsChange({
          provider: providerId,
          model: modelToSelect
        });
      } catch (error) {
        console.error('Failed to fetch models:', error);
        onSettingsChange({ provider: providerId });
      } finally {
        setIsLoadingModels(false);
      }
    }
  };

  const handleModelChange = (modelId: string) => {
    if (onSettingsChange) {
      // Update the model and save it as the last selected model for the current provider
      const updatedProviders = {
        ...currentSettings.providers,
        [currentSettings.provider]: {
          ...currentSettings.providers[currentSettings.provider],
          lastSelectedModel: modelId
        }
      };

      onSettingsChange({
        model: modelId,
        providers: updatedProviders
      });
    }
  };

  const handleScreenshot = async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Call electron screenshot API
        const result = await window.electronAPI.takeScreenshot();

        if (result.success && result.dataURL && onScreenshotCapture) {
          // Convert data URL to File object
          const response = await fetch(result.dataURL);
          const blob = await response.blob();
          const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });

          // Auto-attach the screenshot to chat
          onScreenshotCapture(file);
        } else {
          console.error('Screenshot failed:', result.error);
        }
      } else {
        // Fallback for web version
        console.log('Screenshot functionality not available in web version');
      }
    } catch (error) {
      console.error('Failed to take screenshot:', error);
    }
  };

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,.pdf,.txt,.doc,.docx';
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && onFileUpload) {
        onFileUpload(files);
      }
    };
    input.click();
  };

  return (
    <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/30">
      {/* Left side - Provider and Model selector */}
      <div className="flex items-center gap-2">
        {/* Provider Selector */}
        <Select value={currentSettings.provider} onValueChange={handleProviderChange}>
          <SelectTrigger className="w-auto min-w-[120px] h-8">
            <div className="flex items-center gap-2">
              {getProviderIcon(currentSettings.provider)}
              <span className="font-medium">{currentProvider?.name || 'Select Provider'}</span>
              <Badge variant="secondary" className="text-xs">
                {getProviderBadge(currentSettings.provider)}
              </Badge>
            </div>
          </SelectTrigger>
          <SelectContent>
            {providers.map((provider) => (
              <SelectItem key={provider.id} value={provider.id}>
                <div className="flex items-center gap-2">
                  {getProviderIcon(provider.id)}
                  <div className="flex flex-col">
                    <span className="font-medium">{provider.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {provider.requiresApiKey ? 'API Key Required' : 'No Key Required'}
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {getProviderBadge(provider.id)}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Model Selector */}
        {isLoadingModels ? (
          <div className="h-8 w-40 flex items-center justify-center text-xs text-muted-foreground border rounded-md">
            Loading models...
          </div>
        ) : (
          <Select value={currentSettings.model} onValueChange={handleModelChange}>
            <SelectTrigger className="w-auto min-w-[180px] h-8">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {currentSettings.model || 'Select Model'}
                </span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((model) => (
                <SelectItem key={model} value={model}>
                  <span className="font-medium">{model}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Right side - Action buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleScreenshot}
          title="Take screenshot"
          className="h-8 w-8 p-0"
        >
          <Camera className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleFileUpload}
          title="Upload file"
          className="h-8 w-8 p-0"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onHistoryChange?.(!showHistory)}
          title="Chat history"
          className="h-8 w-8 p-0"
        >
          <History className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // Try overlay first, fallback to dialog
            if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.openSettingsOverlay) {
              window.electronAPI.openSettingsOverlay();
            } else {
              setShowSettings(!showSettings);
            }
          }}
          title="Settings"
          className="h-8 w-8 p-0"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Settings handled by overlay system */}
    </div>
  );
}
