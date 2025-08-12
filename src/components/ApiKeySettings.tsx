import React, { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import type { ProviderApiKeyData } from '../services/secureApiKeyService';
import { settingsService } from '../services/settingsService';

// Function to get secure API key service when needed
function getSecureApiKeyService() {
  if (typeof window === 'undefined') {
    throw new Error('Secure API key service is only available in browser environment');
  }

  try {
    const service = require('../services/secureApiKeyService').secureApiKeyService;
    if (!service) {
      throw new Error('Secure API key service not found');
    }
    return service;
  } catch (error) {
    throw new Error(`Failed to load secure API key service: ${error instanceof Error ? error.message : String(error)}`);
  }
}

interface ApiKeySettingsProps {
  onApiKeyChange?: (providerId: string, hasKey: boolean) => void;
  onRegisterSaveFunction?: (saveFunction: () => Promise<void>) => void;
}

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-...' },
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'gemini', name: 'Google Gemini', placeholder: 'API Key...' },
  { id: 'mistral', name: 'Mistral AI', placeholder: 'API Key...' },
  { id: 'deepseek', name: 'DeepSeek', placeholder: 'sk-...' },
  { id: 'deepinfra', name: 'Deepinfra', placeholder: 'API Key...' },
  { id: 'groq', name: 'Groq', placeholder: 'API Key...' },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-...' },
  { id: 'requesty', name: 'Requesty', placeholder: 'API Key...' },
  { id: 'replicate', name: 'Replicate', placeholder: 'r8_...' },
  { id: 'lmstudio', name: 'LM Studio', placeholder: 'Not required', hasBaseUrl: true },
  { id: 'jan', name: 'Jan AI', placeholder: 'API Key...', hasBaseUrl: true },
  { id: 'ollama', name: 'Ollama', placeholder: 'Not required', hasBaseUrl: true },
  { id: 'n8n', name: 'N8N', placeholder: 'API Key...', hasBaseUrl: true },
];

export function ApiKeySettings({ onApiKeyChange, onRegisterSaveFunction }: ApiKeySettingsProps) {
  const [apiKeys, setApiKeys] = useState<Record<string, ProviderApiKeyData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});


  // Load API keys on component mount
  useEffect(() => {
    // Reduce console spam - only log once per session
    if (!(window as any).__apiKeySettingsLogged) {
      console.log('🔐 ApiKeySettings: Component mounted');
      (window as any).__apiKeySettingsLogged = true;
    }

    const initializeApiKeys = async () => {
      try {
        const service = getSecureApiKeyService();
        // Only log during first initialization attempt to reduce console spam
        if (!service.isInitialized()) {
          console.log('🔐 ApiKeySettings: Waiting for secure API key service...');

          // Wait for initialization without retrying (service handles its own initialization)
          await service.waitForInitialization();

          if (!service.isInitialized()) {
            console.warn('🔐 ApiKeySettings: Service initialization timed out');
            return;
          }
        }

        if (service.isInitialized()) {
          // Service is ready - only log once to reduce console spam
          loadApiKeys(true); // Force reset on initial load

          // Listen for API key changes
          const handleApiKeyChange = (providerId: string, hasKey: boolean) => {
            onApiKeyChange?.(providerId, hasKey);
          };

          service.addListener(handleApiKeyChange);

          return () => {
            service.removeListener(handleApiKeyChange);
          };
        } else {
          console.error('🔐 ApiKeySettings: Service failed to initialize');
        }
      } catch (error) {
        console.error('🔐 ApiKeySettings: Failed to initialize:', error);
      }
    };

    initializeApiKeys();
  }, []); // Remove onApiKeyChange dependency to prevent re-initialization

  // Listen for settings saved events to refresh API keys
  useEffect(() => {
    const handleSettingsSaved = (event: CustomEvent) => {
      console.log('🔄 ApiKeySettings: Settings saved event received, reloading API keys');
      // Reload API keys from storage after settings are saved
      setTimeout(() => {
        loadApiKeys(true); // Force reload from storage
      }, 200); // Small delay to ensure save is complete
    };

    window.addEventListener('settingsSaved', handleSettingsSaved as EventListener);
    return () => {
      window.removeEventListener('settingsSaved', handleSettingsSaved as EventListener);
    };
  }, []);

  // Register save function with parent component
  useEffect(() => {
    if (onRegisterSaveFunction) {
      const saveFunction = async () => {
        if (hasChanges) {
          console.log('🔐 ApiKeySettings: Executing save via parent request');
          await handleSave();
        } else {
          console.log('🔐 ApiKeySettings: No changes to save');
        }
      };

      console.log('🔐 ApiKeySettings: Registering save function with parent');
      onRegisterSaveFunction(saveFunction);
    }
  }, [hasChanges, onRegisterSaveFunction]); // Re-register when hasChanges updates

  const loadApiKeys = (forceReset: boolean = false) => {
    console.log('🔍 loadApiKeys called with forceReset:', forceReset);

    const loadedKeys: Record<string, ProviderApiKeyData> = {};

    try {
      const service = getSecureApiKeyService();
      console.log('🔍 Service initialized:', service.isInitialized());

      // Also get settings to merge baseUrl from regular settings
      const currentSettings = settingsService.getSettings();
      console.log('🔍 Current settings providers:', currentSettings?.chat?.providers);

      PROVIDERS.forEach(provider => {
        try {
          const data = service.getApiKeyData(provider.id);
          const settingsBaseUrl = currentSettings?.chat?.providers?.[provider.id]?.baseUrl || '';

          if (data) {
            // Merge secure storage data with settings baseUrl if secure storage doesn't have it
            loadedKeys[provider.id] = {
              ...data,
              baseUrl: data.baseUrl || settingsBaseUrl
            };
            console.log(`🔍 Loaded API key for ${provider.id}:`, {
              hasApiKey: !!data.apiKey,
              keyLength: data.apiKey?.length || 0,
              hasBaseUrl: !!(data.baseUrl || settingsBaseUrl),
              baseUrlSource: data.baseUrl ? 'secure' : settingsBaseUrl ? 'settings' : 'none'
            });
          } else {
            loadedKeys[provider.id] = {
              apiKey: '',
              baseUrl: settingsBaseUrl,
              lastSelectedModel: ''
            };
            console.log(`🔍 No API key data for ${provider.id}, using baseUrl from settings:`, settingsBaseUrl);
          }
        } catch (error) {
          console.error(`🔐 ApiKeySettings: Error loading API key for ${provider.id}:`, error);
          // Don't mask the error - let user know service is not ready
          if (error instanceof Error && error.message.includes('not initialized')) {
            console.warn('🔐 ApiKeySettings: Service not initialized, will retry when ready');
          }
          const settingsBaseUrl = currentSettings?.chat?.providers?.[provider.id]?.baseUrl || '';
          loadedKeys[provider.id] = { apiKey: '', baseUrl: settingsBaseUrl, lastSelectedModel: '' };
        }
      });
    } catch (error) {
      console.error('🔐 ApiKeySettings: Service not available:', error);
      PROVIDERS.forEach(provider => {
        loadedKeys[provider.id] = { apiKey: '', baseUrl: '', lastSelectedModel: '' };
      });
    }

    console.log('🔍 Setting API keys in component state:', Object.keys(loadedKeys));
    setApiKeys(loadedKeys);

    // Only reset hasChanges if forced (initial load or cancel) or if no changes exist
    if (forceReset || !hasChanges) {
      setHasChanges(false);
    }

    setValidationErrors({});

  };

  const updateApiKey = (providerId: string, field: keyof ProviderApiKeyData, value: string) => {
    setApiKeys(prev => ({
      ...prev,
      [providerId]: {
        ...prev[providerId],
        [field]: value
      }
    }));

    setHasChanges(true);

    // Notify parent component that API keys have changed
    if (onApiKeyChange) {
      onApiKeyChange(providerId, value.length > 0);
    }

    // Clear validation error for this provider
    if (validationErrors[providerId]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[providerId];
        return newErrors;
      });
    }


  };

  const validateApiKey = (providerId: string, apiKey: string): string | null => {
    if (!apiKey.trim()) {
      // Only validate if the provider requires an API key
      const provider = PROVIDERS.find(p => p.id === providerId);
      if (provider && !['lmstudio', 'ollama', 'llamacpp', 'jan'].includes(providerId)) {
        return null; // Allow empty keys, they're optional
      }
      return null;
    }
    
    try {
      const service = getSecureApiKeyService();
      const validation = service.validateApiKey(providerId, apiKey);
      return validation.isValid ? null : validation.error || 'Invalid API key format';
    } catch (error) {
      console.warn('🔐 ApiKeySettings: Validation service not available:', error);
      return null; // No validation if service not available
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    const errors: Record<string, string> = {};

    try {
      // Get service and check if it's available and initialized
      const service = getSecureApiKeyService();

      // ALWAYS SAVE - No conditions that prevent saving
      console.log('🔐 ApiKeySettings: Executing save (ALWAYS SAVE mode)');

      // ALWAYS SAVE - No validation that prevents saving
      // Still validate for user feedback, but don't prevent saving
      for (const [providerId, data] of Object.entries(apiKeys)) {
        if (data.apiKey.trim()) {
          const error = validateApiKey(providerId, data.apiKey);
          if (error) {
            errors[providerId] = error;
            console.warn(`⚠️ Validation warning for ${providerId}: ${error} (but saving anyway)`);
          }
        }
      }

      // Set validation errors for display but continue saving
      setValidationErrors(errors);

      // ALWAYS SAVE ALL API KEYS - No conditions that prevent saving
      for (const [providerId, data] of Object.entries(apiKeys)) {
        try {
          // Always save, regardless of whether fields are empty or not
          await service.setApiKeyData(providerId, {
            apiKey: data.apiKey.trim(),
            baseUrl: data.baseUrl?.trim(),
            lastSelectedModel: data.lastSelectedModel
          });
          console.log(`✅ Saved API key for ${providerId}`);

          // Also save baseUrl to regular settings for providers that use it
          if (data.baseUrl?.trim() && (providerId === 'ollama' || providerId === 'lmstudio' || providerId === 'jan' || providerId === 'n8n')) {
            try {
              const currentSettings = settingsService.getSettings();
              if (currentSettings?.chat?.providers) {
                const updatedSettings = {
                  ...currentSettings,
                  chat: {
                    ...currentSettings.chat,
                    providers: {
                      ...currentSettings.chat.providers,
                      [providerId]: {
                        ...currentSettings.chat.providers[providerId],
                        baseUrl: data.baseUrl.trim()
                      }
                    }
                  }
                };
                await settingsService.updateSettings(updatedSettings);
                console.log(`✅ Saved baseUrl to settings for ${providerId}: ${data.baseUrl.trim()}`);
              }
            } catch (settingsError) {
              console.error(`❌ Failed to save baseUrl to settings for ${providerId}:`, settingsError);
            }
          }
        } catch (error) {
          console.error(`❌ Failed to save API key for ${providerId}:`, error);
          // Don't throw error - continue saving other keys (ALWAYS SAVE mode)
          console.log(`🔄 Continuing to save other API keys despite error for ${providerId}`);
        }
      }

      setHasChanges(false);
      console.log('✅ All API keys saved successfully');

      // Debug: Check API key state after save
      try {
        const service = getSecureApiKeyService();
        service.debugApiKeyState();
      } catch (error) {
        console.error('🔍 Failed to debug API key state:', error);
      }

      // Force reload API keys from storage to ensure UI reflects saved values
      console.log('🔄 Reloading API keys from storage after save...');
      setTimeout(() => {
        loadApiKeys(true); // Force reload from storage
      }, 100); // Small delay to ensure save is complete
    } catch (error) {
      console.error('❌ Failed to save API keys:', error);
      throw error; // Re-throw so parent can handle the error
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    loadApiKeys(true); // Force reset on cancel
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium mb-2">API Configuration</h3>
        <p className="text-xs text-muted-foreground mb-3">
          API keys are encrypted and stored securely. They are never transmitted in plain text.
        </p>

        <div className="space-y-2">
          {PROVIDERS.map(provider => (
            <div key={provider.id} className="space-y-1">
              <Label htmlFor={`${provider.id}-key`} className="text-xs">{provider.name} API Key</Label>
              <Input
                id={`${provider.id}-key`}
                type="password"
                value={apiKeys[provider.id]?.apiKey || ''}
                placeholder={provider.placeholder}
                className={`h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors ${
                  validationErrors[provider.id] ? 'border-destructive' : ''
                }`}
                onChange={(e) => updateApiKey(provider.id, 'apiKey', e.target.value)}
              />
              {validationErrors[provider.id] && (
                <p className="text-xs text-destructive">{validationErrors[provider.id]}</p>
              )}
              
              {provider.hasBaseUrl && (
                <div className="mt-1">
                  <Label htmlFor={`${provider.id}-url`} className="text-xs">{provider.name} Base URL</Label>
                  <Input
                    id={`${provider.id}-url`}
                    type="url"
                    value={apiKeys[provider.id]?.baseUrl || ''}
                    placeholder={
                      provider.id === 'lmstudio' ? 'http://localhost:1234/v1' :
                      provider.id === 'jan' ? 'http://127.0.0.1:1337/v1' :
                      provider.id === 'ollama' ? 'http://localhost:11434' :
                      provider.id === 'n8n' ? 'https://your-n8n-instance.com/webhook/your-webhook-id' :
                      'Base URL...'
                    }
                    className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                    onChange={(e) => updateApiKey(provider.id, 'baseUrl', e.target.value)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        




        {hasChanges && (
          <div className="flex gap-1 mt-3 pt-2 border-t">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              className="h-7 text-xs flex-1"
            >
              Cancel Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
