import React, { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import type { ProviderApiKeyData } from '../services/secureApiKeyService';

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
  { id: 'groq', name: 'Groq', placeholder: 'API Key...' },
  { id: 'openrouter', name: 'OpenRouter', placeholder: 'sk-or-...' },
  { id: 'requesty', name: 'Requesty', placeholder: 'API Key...' },
  { id: 'replicate', name: 'Replicate', placeholder: 'r8_...' },
  { id: 'lmstudio', name: 'LM Studio', placeholder: 'Not required', hasBaseUrl: true },
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
    console.log('🔐 ApiKeySettings: Component mounted');

    const initializeApiKeys = async () => {
      try {
        const service = getSecureApiKeyService();
        console.log('🔐 ApiKeySettings: Secure API key service loaded');

        // Check if service is initialized, if not wait for it
        if (!service.isInitialized()) {
          console.log('🔐 ApiKeySettings: Service not initialized, waiting...');
          // Retry initialization
          await service.retryInitialization();

          // Wait a bit more if still not initialized
          if (!service.isInitialized()) {
            console.log('🔐 ApiKeySettings: Waiting for service initialization...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        if (service.isInitialized()) {
          console.log('🔐 ApiKeySettings: Service is initialized, loading API keys');
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

    const loadedKeys: Record<string, ProviderApiKeyData> = {};

    try {
      const service = getSecureApiKeyService();

      PROVIDERS.forEach(provider => {
        try {
          const data = service.getApiKeyData(provider.id);
          if (data) {
            loadedKeys[provider.id] = data;

          } else {
            loadedKeys[provider.id] = { apiKey: '', baseUrl: '', lastSelectedModel: '' };
          }
        } catch (error) {
          console.error(`🔐 ApiKeySettings: Error loading API key for ${provider.id}:`, error);
          loadedKeys[provider.id] = { apiKey: '', baseUrl: '', lastSelectedModel: '' };
        }
      });
    } catch (error) {
      console.error('🔐 ApiKeySettings: Service not available:', error);
      PROVIDERS.forEach(provider => {
        loadedKeys[provider.id] = { apiKey: '', baseUrl: '', lastSelectedModel: '' };
      });
    }

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
      if (provider && !['lmstudio', 'ollama'].includes(providerId)) {
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

      if (!service.isInitialized()) {
        throw new Error('API key service is not initialized. Please wait a moment and try again.');
      }

      // Validate all API keys before saving
      for (const [providerId, data] of Object.entries(apiKeys)) {
        if (data.apiKey.trim()) {
          const error = validateApiKey(providerId, data.apiKey);
          if (error) {
            errors[providerId] = error;
          }
        }
      }

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }

      // Save all API keys
      let saveSuccessful = true;
      for (const [providerId, data] of Object.entries(apiKeys)) {
        if (data.apiKey.trim() || data.baseUrl?.trim()) {
          const success = await service.setApiKeyData(providerId, {
            apiKey: data.apiKey.trim(),
            baseUrl: data.baseUrl?.trim(),
            lastSelectedModel: data.lastSelectedModel
          });
          if (!success) {
            saveSuccessful = false;
            console.error(`❌ Failed to save API key for ${providerId}`);
          }
        } else {
          // Remove empty API key data
          const success = await service.removeApiKeyData(providerId);
          if (!success) {
            console.warn(`⚠️ Failed to remove API key for ${providerId}`);
          }
        }
      }

      if (saveSuccessful) {
        setHasChanges(false);
        console.log('✅ API keys saved successfully');
      } else {
        throw new Error('Some API keys could not be saved. Please check the console for details and try again.');
      }
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
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-4">API Configuration</h3>
        <p className="text-sm text-muted-foreground mb-6">
          API keys are encrypted and stored securely. They are never transmitted in plain text.
        </p>
        
        <div className="space-y-4">
          {PROVIDERS.map(provider => (
            <div key={provider.id} className="space-y-2">
              <Label htmlFor={`${provider.id}-key`}>{provider.name} API Key</Label>
              <Input
                id={`${provider.id}-key`}
                type="password"
                value={apiKeys[provider.id]?.apiKey || ''}
                placeholder={provider.placeholder}
                className={`bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors ${
                  validationErrors[provider.id] ? 'border-destructive' : ''
                }`}
                onChange={(e) => updateApiKey(provider.id, 'apiKey', e.target.value)}
              />
              {validationErrors[provider.id] && (
                <p className="text-sm text-destructive">{validationErrors[provider.id]}</p>
              )}
              
              {provider.hasBaseUrl && (
                <div className="mt-2">
                  <Label htmlFor={`${provider.id}-url`}>{provider.name} Base URL</Label>
                  <Input
                    id={`${provider.id}-url`}
                    type="url"
                    value={apiKeys[provider.id]?.baseUrl || ''}
                    placeholder={provider.id === 'lmstudio' ? 'http://localhost:1234/v1' : 'Base URL...'}
                    className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                    onChange={(e) => updateApiKey(provider.id, 'baseUrl', e.target.value)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
        




        {hasChanges && (
          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel Changes
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
