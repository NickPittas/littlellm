/**
 * useChatSettings Hook - Manages chat settings, providers, and models
 * Extracted from ModernChatInterface to reduce component complexity
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ChatSettings } from '../services/chatService';
import { settingsService } from '../services/settingsService';
import { secureApiKeyService } from '../services/secureApiKeyService';
import { chatService } from '../services/chatService';

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

export interface UseChatSettingsReturn {
  // State
  settings: ChatSettings;
  selectedModel: string;
  selectedProvider: string;
  availableModels: string[];
  toolsEnabled: boolean;
  mcpEnabled: boolean;
  knowledgeBaseEnabled: boolean;
  customSystemPrompt: string;
  
  // Actions
  setSettings: (settings: ChatSettings) => void;
  setSelectedModel: (model: string) => void;
  setSelectedProvider: (provider: string) => void;
  setAvailableModels: (models: string[]) => void;
  setToolsEnabled: (enabled: boolean) => void;
  setMcpEnabled: (enabled: boolean) => void;
  setKnowledgeBaseEnabled: (enabled: boolean) => void;
  setCustomSystemPrompt: (prompt: string) => void;
  
  // Operations
  updateSettings: (newSettings: Partial<ChatSettings>) => void;
  loadModelsForProvider: (providerId: string) => Promise<void>;
  handleModelChange: (newModel: string) => Promise<void>;
  handleProviderChange: (newProvider: string) => Promise<void>;
  
  // Refs for async operations
  userChangedProviderRef: React.MutableRefObject<boolean>;
  selectedProviderRef: React.MutableRefObject<string>;
}

export function useChatSettings(): UseChatSettingsReturn {
  // Settings state
  const [settings, setSettings] = useState<ChatSettings>({
    provider: 'ollama',
    model: 'gemma3:gpu',
    temperature: 0.7,
    maxTokens: 2000,
    systemPrompt: '',
    toolCallingEnabled: false,
    ragEnabled: false,
    providers: {
      openai: { lastSelectedModel: '' },
      anthropic: { lastSelectedModel: '' },
      gemini: { lastSelectedModel: '' },
      mistral: { lastSelectedModel: '' },
      deepseek: { lastSelectedModel: '' },
      deepinfra: { lastSelectedModel: '' },
      lmstudio: { lastSelectedModel: '' },
      jan: { lastSelectedModel: '' },
      ollama: { lastSelectedModel: '' },
      openrouter: { lastSelectedModel: '' },
      requesty: { lastSelectedModel: '' },
      replicate: { lastSelectedModel: '' },
      n8n: { lastSelectedModel: '' }
    }
  });

  const [selectedModel, setSelectedModel] = useState('gemma3:gpu');
  const [selectedProvider, setSelectedProvider] = useState('ollama');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [toolsEnabled, setToolsEnabled] = useState(false);
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [knowledgeBaseEnabled, setKnowledgeBaseEnabled] = useState(false);
  const [customSystemPrompt, setCustomSystemPrompt] = useState('');

  // Track if user has manually changed provider to avoid init overwrite
  const userChangedProviderRef = useRef(false);
  // Track current provider synchronously for async guards
  const selectedProviderRef = useRef(selectedProvider);

  useEffect(() => {
    selectedProviderRef.current = selectedProvider;
  }, [selectedProvider]);

  // Update settings callback
  const updateSettings = useCallback((newSettings: Partial<ChatSettings>) => {
    setSettings(prevSettings => {
      const updatedSettings = { ...prevSettings, ...newSettings };
      settingsService.saveChatSettings(updatedSettings);
      return updatedSettings;
    });
  }, []);

  // Load models for a specific provider
  const loadModelsForProvider = useCallback(async (providerId: string) => {
    try {
      safeDebugLog('info', 'USECHATSETTINGS', 'Loading models for provider:', providerId);
      
      // Ensure service is initialized before accessing API key data
      if (secureApiKeyService && !secureApiKeyService.isInitialized()) {
        await secureApiKeyService.waitForInitialization();
      }

      const apiKeyData = secureApiKeyService?.getApiKeyData(providerId);
      if (!apiKeyData?.apiKey && providerId !== 'ollama' && providerId !== 'lmstudio') {
        safeDebugLog('warn', 'USECHATSETTINGS', `No API key found for ${providerId}, skipping model loading`);
        setAvailableModels([]);
        return;
      }

      const models = await chatService.getAvailableModels(providerId, apiKeyData?.apiKey || '');
      setAvailableModels(models);
      
      safeDebugLog('info', 'USECHATSETTINGS', `✅ Loaded ${models.length} models for ${providerId}:`, models);
    } catch (error) {
      safeDebugLog('error', 'USECHATSETTINGS', `Failed to load models for ${providerId}:`, error);
      setAvailableModels([]);
    }
  }, []);

  // Handle model change with persistence
  const handleModelChange = useCallback(async (newModel: string) => {
    setSelectedModel(newModel);
    
    try {
      // Save the selected model for this provider
      if (secureApiKeyService && secureApiKeyService.isInitialized()) {
        const apiKeyData = secureApiKeyService.getApiKeyData(selectedProvider);
        if (apiKeyData) {
          secureApiKeyService.updateApiKeyData(selectedProvider, {
            ...apiKeyData,
            lastSelectedModel: newModel
          });
          safeDebugLog('info', 'USECHATSETTINGS', `✅ Saved model selection for ${selectedProvider}:`, newModel);
        }
      }

      // Update settings
      updateSettings({ model: newModel });
    } catch (error) {
      safeDebugLog('error', 'USECHATSETTINGS', 'Failed to save model selection:', error);
    }
  }, [selectedProvider, updateSettings]);

  // Handle provider change
  const handleProviderChange = useCallback(async (newProvider: string) => {
    userChangedProviderRef.current = true;
    setSelectedProvider(newProvider);
    
    try {
      // Load models for the new provider
      await loadModelsForProvider(newProvider);
      
      // Try to get the last selected model for this provider
      let modelToUse = 'gemma3:gpu'; // Default
      
      if (secureApiKeyService && secureApiKeyService.isInitialized()) {
        const apiKeyData = secureApiKeyService.getApiKeyData(newProvider);
        if (apiKeyData?.lastSelectedModel) {
          modelToUse = apiKeyData.lastSelectedModel;
          safeDebugLog('info', 'USECHATSETTINGS', `✅ Restored last selected model for ${newProvider}:`, modelToUse);
        }
      }
      
      setSelectedModel(modelToUse);
      
      // Update settings
      updateSettings({ 
        provider: newProvider,
        model: modelToUse
      });
      
      safeDebugLog('info', 'USECHATSETTINGS', `✅ Provider changed to ${newProvider} with model ${modelToUse}`);
    } catch (error) {
      safeDebugLog('error', 'USECHATSETTINGS', 'Failed to change provider:', error);
    }
  }, [loadModelsForProvider, updateSettings]);

  // Load settings on mount with memory management
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const loadSettings = async () => {
      try {
        if (!isMounted) return;

        const savedSettings = settingsService.getChatSettings();
        setSettings(savedSettings);

        const provider = savedSettings.provider || 'ollama';
        // Only apply initial provider if user hasn't changed it yet
        if (!userChangedProviderRef.current && isMounted) {
          setSelectedProvider(provider);
        } else {
          safeDebugLog('info', 'USECHATSETTINGS', '🛑 Skipping init provider apply; user already changed provider');
        }
        
        if (isMounted) {
          setToolsEnabled(savedSettings.toolCallingEnabled ?? false);
          setKnowledgeBaseEnabled(savedSettings.ragEnabled ?? false);
        }

        // Try to get the last selected model for this provider
        let modelToUse = savedSettings.model || 'gemma3:gpu';
        try {
          // Ensure service is initialized before accessing API key data
          if (secureApiKeyService && !secureApiKeyService.isInitialized()) {
            await secureApiKeyService.waitForInitialization();
          }

          if (!isMounted) return;

          const apiKeyData = secureApiKeyService?.getApiKeyData(provider);
          const lastSelectedModel = apiKeyData?.lastSelectedModel;
          if (lastSelectedModel) {
            modelToUse = lastSelectedModel;
            safeDebugLog('info', 'USECHATSETTINGS', `✅ Restored last selected model for ${provider} on startup:`, lastSelectedModel);
          }
        } catch (error) {
          safeDebugLog('warn', 'USECHATSETTINGS', `Failed to get last selected model for ${provider} on startup:`, error);
        }

        // Only apply initial model/load if user hasn't changed provider
        if (!userChangedProviderRef.current && isMounted) {
          setSelectedModel(modelToUse);
          // Load models for the selected provider (this will validate and potentially update the model)
          await loadModelsForProvider(provider);
        } else {
          safeDebugLog('info', 'USECHATSETTINGS', '🛑 Skipping init model load; user already changed provider');
        }
      } catch (error) {
        if (isMounted) {
          safeDebugLog('error', 'USECHATSETTINGS', 'Failed to load settings:', error);
        }
      }
    };

    loadSettings();

    // Cleanup function to prevent memory leaks
    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [loadModelsForProvider]);

  return {
    // State
    settings,
    selectedModel,
    selectedProvider,
    availableModels,
    toolsEnabled,
    mcpEnabled,
    knowledgeBaseEnabled,
    customSystemPrompt,
    
    // Actions
    setSettings,
    setSelectedModel,
    setSelectedProvider,
    setAvailableModels,
    setToolsEnabled,
    setMcpEnabled,
    setKnowledgeBaseEnabled,
    setCustomSystemPrompt,
    
    // Operations
    updateSettings,
    loadModelsForProvider,
    handleModelChange,
    handleProviderChange,
    
    // Refs for async operations
    userChangedProviderRef,
    selectedProviderRef
  };
}
