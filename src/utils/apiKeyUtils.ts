import { settingsService } from '../services/settingsService';
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

// Provider configuration constants
export const PROVIDERS = [
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

// Providers that require base URLs
export const PROVIDERS_WITH_BASE_URL = ['ollama', 'lmstudio', 'jan', 'n8n'];

// Function to get secure API key service when needed
export function getSecureApiKeyService() {
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

/**
 * Loads API key data for a single provider
 */
export function loadProviderApiKey(
  providerId: string, 
  service: any, 
  currentSettings: any
): ProviderApiKeyData {
  try {
    const data = service.getApiKeyData(providerId);
    const settingsBaseUrl = currentSettings?.chat?.providers?.[providerId]?.baseUrl || '';

    if (data) {
      // Merge secure storage data with settings baseUrl if secure storage doesn't have it
      const result = {
        ...data,
        baseUrl: data.baseUrl || settingsBaseUrl
      };
      
      safeDebugLog('info', 'APIKEY_UTILS', `🔍 Loaded API key for ${providerId}:`, {
        hasApiKey: !!data.apiKey,
        keyLength: data.apiKey?.length || 0,
        hasBaseUrl: !!(data.baseUrl || settingsBaseUrl),
        baseUrlSource: data.baseUrl ? 'secure' : settingsBaseUrl ? 'settings' : 'none'
      });
      
      return result;
    } else {
      const result = {
        apiKey: '',
        baseUrl: settingsBaseUrl,
        lastSelectedModel: ''
      };
      
      safeDebugLog('info', 'APIKEY_UTILS', `🔍 No API key data for ${providerId}, using baseUrl from settings:`, settingsBaseUrl);
      return result;
    }
  } catch (error) {
    safeDebugLog('error', 'APIKEY_UTILS', `🔐 Error loading API key for ${providerId}:`, error);
    
    // Don't mask the error - let user know service is not ready
    if (error instanceof Error && error.message.includes('not initialized')) {
      safeDebugLog('warn', 'APIKEY_UTILS', '🔐 Service not initialized, will retry when ready');
    }
    
    const settingsBaseUrl = currentSettings?.chat?.providers?.[providerId]?.baseUrl || '';
    return { apiKey: '', baseUrl: settingsBaseUrl, lastSelectedModel: '' };
  }
}

/**
 * Loads all API keys from the service
 */
export function loadAllApiKeys(): Record<string, ProviderApiKeyData> {
  safeDebugLog('info', 'APIKEY_UTILS', '🔍 Loading all API keys');
  
  const loadedKeys: Record<string, ProviderApiKeyData> = {};

  try {
    const service = getSecureApiKeyService();
    safeDebugLog('info', 'APIKEY_UTILS', '🔍 Service initialized:', service.isInitialized());

    // Also get settings to merge baseUrl from regular settings
    const currentSettings = settingsService.getSettings();
    safeDebugLog('info', 'APIKEY_UTILS', '🔍 Current settings providers:', currentSettings?.chat?.providers);

    PROVIDERS.forEach(provider => {
      loadedKeys[provider.id] = loadProviderApiKey(provider.id, service, currentSettings);
    });
  } catch (error) {
    safeDebugLog('error', 'APIKEY_UTILS', '🔐 Service not available:', error);
    PROVIDERS.forEach(provider => {
      loadedKeys[provider.id] = { apiKey: '', baseUrl: '', lastSelectedModel: '' };
    });
  }

  safeDebugLog('info', 'APIKEY_UTILS', '🔍 Loaded API keys for providers:', Object.keys(loadedKeys));
  return loadedKeys;
}

/**
 * Validates an API key for a specific provider
 */
export function validateApiKey(providerId: string, apiKey: string): string | null {
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
    safeDebugLog('warn', 'APIKEY_UTILS', '🔐 Validation service not available:', error);
    return null; // No validation if service not available
  }
}

/**
 * Saves API key data for a single provider
 */
export async function saveProviderApiKey(
  providerId: string, 
  data: ProviderApiKeyData, 
  service: any
): Promise<void> {
  try {
    // Always save, regardless of whether fields are empty or not
    await service.setApiKeyData(providerId, {
      apiKey: data.apiKey.trim(),
      baseUrl: data.baseUrl?.trim(),
      lastSelectedModel: data.lastSelectedModel
    });
    safeDebugLog('info', 'APIKEY_UTILS', `✅ Saved API key for ${providerId}`);

    // Also save baseUrl to regular settings for providers that use it
    if (data.baseUrl?.trim() && PROVIDERS_WITH_BASE_URL.includes(providerId)) {
      await saveBaseUrlToSettings(providerId, data.baseUrl.trim());
    }
  } catch (error) {
    safeDebugLog('error', 'APIKEY_UTILS', `❌ Failed to save API key for ${providerId}:`, error);
    // Don't throw error - continue saving other keys (ALWAYS SAVE mode)
    safeDebugLog('info', 'APIKEY_UTILS', `🔄 Continuing to save other API keys despite error for ${providerId}`);
  }
}

/**
 * Saves base URL to settings for providers that need it
 */
export async function saveBaseUrlToSettings(providerId: string, baseUrl: string): Promise<void> {
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
              baseUrl: baseUrl
            }
          }
        }
      };
      await settingsService.updateSettings(updatedSettings);
      safeDebugLog('info', 'APIKEY_UTILS', `✅ Saved baseUrl to settings for ${providerId}: ${baseUrl}`);
    }
  } catch (settingsError) {
    safeDebugLog('error', 'APIKEY_UTILS', `❌ Failed to save baseUrl to settings for ${providerId}:`, settingsError);
  }
}

/**
 * Validates all API keys and returns validation errors
 */
export function validateAllApiKeys(apiKeys: Record<string, ProviderApiKeyData>): Record<string, string> {
  const errors: Record<string, string> = {};

  for (const [providerId, data] of Object.entries(apiKeys)) {
    if (data.apiKey.trim()) {
      const error = validateApiKey(providerId, data.apiKey);
      if (error) {
        errors[providerId] = error;
        safeDebugLog('warn', 'APIKEY_UTILS', `⚠️ Validation warning for ${providerId}: ${error} (but saving anyway)`);
      }
    }
  }

  return errors;
}

/**
 * Gets the placeholder text for a provider's base URL input
 */
export function getBaseUrlPlaceholder(providerId: string): string {
  switch (providerId) {
    case 'lmstudio':
      return 'http://localhost:1234/v1';
    case 'jan':
      return 'http://127.0.0.1:1337/v1';
    case 'ollama':
      return 'http://localhost:11434';
    case 'n8n':
      return 'https://your-n8n-instance.com/webhook/your-webhook-id';
    default:
      return 'Base URL...';
  }
}
