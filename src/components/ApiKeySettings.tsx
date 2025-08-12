import React, { useState, useEffect } from 'react';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import type { ProviderApiKeyData } from '../services/secureApiKeyService';

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('../services/debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}
import {
  PROVIDERS,
  getSecureApiKeyService,
  loadAllApiKeys,
  validateApiKey,
  validateAllApiKeys,
  saveProviderApiKey,
  getBaseUrlPlaceholder
} from '../utils/apiKeyUtils';

interface ApiKeySettingsProps {
  onApiKeyChange?: (providerId: string, hasKey: boolean) => void;
  onRegisterSaveFunction?: (saveFunction: () => Promise<void>) => void;
}



export function ApiKeySettings({ onApiKeyChange, onRegisterSaveFunction }: ApiKeySettingsProps) {
  const [apiKeys, setApiKeys] = useState<Record<string, ProviderApiKeyData>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});


  // Load API keys on component mount
  useEffect(() => {
    // Reduce console spam - only log once per session
    if (!(window as any).__apiKeySettingsLogged) {
      safeDebugLog('info', 'APIKEYSETTINGS', '🔐 ApiKeySettings: Component mounted');
      (window as any).__apiKeySettingsLogged = true;
    }

    const initializeApiKeys = async () => {
      try {
        const service = getSecureApiKeyService();
        // Only log during first initialization attempt to reduce console spam
        if (!service.isInitialized()) {
          safeDebugLog('info', 'APIKEYSETTINGS', '🔐 ApiKeySettings: Waiting for secure API key service...');

          // Wait for initialization without retrying (service handles its own initialization)
          await service.waitForInitialization();

          if (!service.isInitialized()) {
            safeDebugLog('warn', 'APIKEYSETTINGS', '🔐 ApiKeySettings: Service initialization timed out');
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
          safeDebugLog('error', 'APIKEYSETTINGS', '🔐 ApiKeySettings: Service failed to initialize');
        }
      } catch (error) {
        safeDebugLog('error', 'APIKEYSETTINGS', '🔐 ApiKeySettings: Failed to initialize:', error);
      }
    };

    initializeApiKeys();
  }, []); // Remove onApiKeyChange dependency to prevent re-initialization

  // Listen for settings saved events to refresh API keys
  useEffect(() => {
    const handleSettingsSaved = (event: CustomEvent) => {
      safeDebugLog('info', 'APIKEYSETTINGS', '🔄 ApiKeySettings: Settings saved event received, reloading API keys');
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
          safeDebugLog('info', 'APIKEYSETTINGS', '🔐 ApiKeySettings: Executing save via parent request');
          await handleSave();
        } else {
          safeDebugLog('info', 'APIKEYSETTINGS', '🔐 ApiKeySettings: No changes to save');
        }
      };

      safeDebugLog('info', 'APIKEYSETTINGS', '🔐 ApiKeySettings: Registering save function with parent');
      onRegisterSaveFunction(saveFunction);
    }
  }, [hasChanges, onRegisterSaveFunction]); // Re-register when hasChanges updates

  const loadApiKeys = (forceReset = false) => {
    safeDebugLog('info', 'APIKEYSETTINGS', '🔍 loadApiKeys called with forceReset:', forceReset);

    const loadedKeys = loadAllApiKeys();
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



  const handleSave = async () => {
    setIsLoading(true);

    try {
      // Get service and check if it's available and initialized
      const service = getSecureApiKeyService();

      // ALWAYS SAVE - No conditions that prevent saving
      safeDebugLog('info', 'APIKEYSETTINGS', '🔐 ApiKeySettings: Executing save (ALWAYS SAVE mode)');

      // Validate all API keys for user feedback, but don't prevent saving
      const errors = validateAllApiKeys(apiKeys);
      setValidationErrors(errors);

      // ALWAYS SAVE ALL API KEYS - No conditions that prevent saving
      for (const [providerId, data] of Object.entries(apiKeys)) {
        await saveProviderApiKey(providerId, data as ProviderApiKeyData, service);
      }

      setHasChanges(false);
      safeDebugLog('info', 'APIKEYSETTINGS', '✅ All API keys saved successfully');

      // Debug: Check API key state after save
      try {
        const service = getSecureApiKeyService();
        service.debugApiKeyState();
      } catch (error) {
        safeDebugLog('error', 'APIKEYSETTINGS', '🔍 Failed to debug API key state:', error);
      }

      // Force reload API keys from storage to ensure UI reflects saved values
      safeDebugLog('info', 'APIKEYSETTINGS', '🔄 Reloading API keys from storage after save...');
      setTimeout(() => {
        loadApiKeys(true); // Force reload from storage
      }, 100); // Small delay to ensure save is complete
    } catch (error) {
      safeDebugLog('error', 'APIKEYSETTINGS', '❌ Failed to save API keys:', error);
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
                    placeholder={getBaseUrlPlaceholder(provider.id)}
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
