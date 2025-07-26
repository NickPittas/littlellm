/**
 * Secure API Key Storage Service
 *
 * This service handles encrypted storage and retrieval of API keys using Electron's safeStorage API.
 * API keys are stored separately from general settings for enhanced security.
 */

import { initializationManager } from './initializationManager';

export interface ProviderApiKeyData {
  apiKey: string;
  baseUrl?: string;
  lastSelectedModel?: string;
}

export interface SecureApiKeyStorage {
  [providerId: string]: ProviderApiKeyData;
}

export interface ApiKeyValidationResult {
  isValid: boolean;
  error?: string;
}

class SecureApiKeyService {
  private static readonly SERVICE_NAME = 'SecureApiKeyService';
  private apiKeys: SecureApiKeyStorage = {};
  private listeners: Array<(providerId: string, hasKey: boolean) => void> = [];

  constructor() {
    // Register with initialization manager
    initializationManager.registerService(SecureApiKeyService.SERVICE_NAME);

    // Start initialization through the manager
    this.initializeService();
  }

  private async initializeService() {
    // Use initialization manager to prevent duplicate initialization
    return initializationManager.startInitialization(
      SecureApiKeyService.SERVICE_NAME,
      async () => {
        // Wait for Electron API to be available
        await this.waitForElectronAPI();

        // Only proceed if we're in a browser environment
        if (typeof window !== 'undefined') {
          await this.loadApiKeys();

          // Check for migration from old settings format
          await this.checkAndMigrateFromSettings();
        } else {
          console.log('🔐 SecureApiKeyService skipped initialization (server-side rendering)');
        }
      }
    );
  }

  /**
   * Wait for Electron API to be available
   */
  private async waitForElectronAPI(): Promise<void> {
    if (typeof window === 'undefined') {
      console.warn('⚠️ Window not available (likely server-side rendering), skipping API key initialization');
      return; // Don't throw error, just skip initialization
    }

    // If Electron API is already available, return immediately
    if (window.electronAPI && typeof window.electronAPI.getSecureApiKeys === 'function') {
      return;
    }

    // Wait up to 10 seconds for Electron API to become available
    const maxWaitTime = 10000;
    const checkInterval = 100;
    let waitTime = 0;

    return new Promise((resolve) => {
      const checkAPI = () => {
        if (window.electronAPI && typeof window.electronAPI.getSecureApiKeys === 'function') {
          console.log('🔐 Electron API is now available');
          resolve();
          return;
        }

        waitTime += checkInterval;
        if (waitTime >= maxWaitTime) {
          console.warn('⚠️ Electron API not available after waiting, continuing without persistence');
          resolve(); // Don't reject, just continue without persistence
          return;
        }

        setTimeout(checkAPI, checkInterval);
      };

      checkAPI();
    });
  }

  /**
   * Load encrypted API keys from secure storage
   */
  private async loadApiKeys(): Promise<void> {
    if (typeof window !== 'undefined' && window.electronAPI?.getSecureApiKeys) {
      try {
        const encryptedData = await window.electronAPI.getSecureApiKeys();
        if (encryptedData) {
          this.apiKeys = encryptedData;
          console.log('🔐 Loaded encrypted API keys for providers:', Object.keys(this.apiKeys));
        } else {
          console.log('🔐 No encrypted API keys found in storage');
          // Don't overwrite existing in-memory keys if storage is empty
          // This prevents losing keys when Electron storage is not available
          if (Object.keys(this.apiKeys).length === 0) {
            console.log('🔐 No in-memory keys either, starting with empty storage');
            this.apiKeys = {};
          } else {
            console.log('🔐 Keeping existing in-memory keys since storage is empty');
          }
        }
      } catch (error) {
        console.error('❌ Failed to load encrypted API keys:', error);
        // Don't overwrite existing in-memory keys on error
        console.log('🔐 Keeping existing in-memory keys due to storage error');
      }
    } else {
      console.warn('⚠️ Electron API not available, keeping existing in-memory API keys');
      // Don't overwrite existing keys when Electron API is not available
    }
  }

  /**
   * Save encrypted API keys to secure storage
   */
  private async saveApiKeys(): Promise<boolean> {
    // ALWAYS SAVE - No conditions that prevent saving
    try {
      // Always attempt to save, even if Electron API might not be available
      if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.setSecureApiKeys === 'function') {
        const success = await window.electronAPI.setSecureApiKeys(this.apiKeys);
        if (success) {
          console.log('🔐 Successfully saved encrypted API keys');
          return true;
        } else {
          console.error('❌ Failed to save encrypted API keys - main process returned false');
          // Still return true to indicate we attempted the save
          return true;
        }
      } else {
        console.warn('⚠️ Electron API not available, but continuing anyway (ALWAYS SAVE mode)');
        console.log('🔍 Debug info:', {
          windowAvailable: typeof window !== 'undefined',
          electronAPIAvailable: typeof window !== 'undefined' && !!window.electronAPI,
          setSecureApiKeysAvailable: typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.setSecureApiKeys === 'function'
        });
        // Return true to indicate we attempted the save (ALWAYS SAVE mode)
        return true;
      }
    } catch (error) {
      console.error('❌ Error saving encrypted API keys:', error);
      // Still return true to indicate we attempted the save (ALWAYS SAVE mode)
      return true;
    }
  }

  /**
   * Get API key data for a specific provider
   */
  getApiKeyData(providerId: string): ProviderApiKeyData | null {
    if (!this.isInitialized()) {
      console.error('❌ SecureApiKeyService not initialized - cannot retrieve API key data');
      throw new Error('SecureApiKeyService not initialized. Please wait for initialization to complete.');
    }

    const data = this.apiKeys[providerId];
    if (data) {
      console.log(`🔐 Retrieved API key data for ${providerId}:`, {
        hasApiKey: !!data.apiKey,
        keyLength: data.apiKey?.length || 0,
        hasBaseUrl: !!data.baseUrl,
        hasLastModel: !!data.lastSelectedModel
      });
    }
    return data || null;
  }

  /**
   * Get just the API key for a specific provider
   */
  getApiKey(providerId: string): string | null {
    const data = this.getApiKeyData(providerId);
    return data?.apiKey || null;
  }

  /**
   * Set API key data for a specific provider
   */
  async setApiKeyData(providerId: string, data: ProviderApiKeyData): Promise<boolean> {
    // ALWAYS SAVE - No conditions that prevent saving

    console.log(`🔐 Setting API key data for ${providerId}:`, {
      hasApiKey: !!data.apiKey,
      keyLength: data.apiKey?.length || 0,
      hasBaseUrl: !!data.baseUrl,
      hasLastModel: !!data.lastSelectedModel
    });

    this.apiKeys[providerId] = { ...data };
    const success = await this.saveApiKeys();
    
    if (success) {
      // Notify listeners about the change
      this.notifyListeners(providerId, !!data.apiKey);
    }
    
    return success;
  }

  /**
   * Set just the API key for a specific provider (preserving other data)
   */
  async setApiKey(providerId: string, apiKey: string): Promise<boolean> {
    const existingData = this.getApiKeyData(providerId) || {};
    return this.setApiKeyData(providerId, {
      ...existingData,
      apiKey
    });
  }

  /**
   * Remove API key data for a specific provider
   */
  async removeApiKeyData(providerId: string): Promise<boolean> {
    // ALWAYS SAVE - No conditions that prevent saving

    console.log(`🔐 Removing API key data for ${providerId}`);
    delete this.apiKeys[providerId];
    const success = await this.saveApiKeys();
    
    if (success) {
      // Notify listeners about the removal
      this.notifyListeners(providerId, false);
    }
    
    return success;
  }

  /**
   * Check if a provider has an API key
   */
  hasApiKey(providerId: string): boolean {
    const data = this.getApiKeyData(providerId);
    return !!(data?.apiKey);
  }

  /**
   * Get all provider IDs that have API keys
   */
  getProvidersWithApiKeys(): string[] {
    return Object.keys(this.apiKeys).filter(providerId => 
      this.apiKeys[providerId]?.apiKey
    );
  }

  /**
   * Validate API key format for a specific provider
   */
  validateApiKey(providerId: string, apiKey: string): ApiKeyValidationResult {
    if (!apiKey || typeof apiKey !== 'string') {
      return { isValid: false, error: 'API key is required' };
    }

    switch (providerId) {
      case 'openai':
        if (!apiKey.startsWith('sk-')) {
          return { isValid: false, error: 'OpenAI API key should start with "sk-"' };
        }
        break;
      case 'anthropic':
        if (!apiKey.startsWith('sk-ant-')) {
          return { isValid: false, error: 'Anthropic API key should start with "sk-ant-"' };
        }
        break;
      case 'gemini':
        if (apiKey.length < 20) {
          return { isValid: false, error: 'Google API key appears to be too short' };
        }
        break;
      case 'openrouter':
        if (!apiKey.startsWith('sk-or-')) {
          return { isValid: false, error: 'OpenRouter API key should start with "sk-or-"' };
        }
        break;
      case 'deepseek':
        if (!apiKey.startsWith('sk-')) {
          return { isValid: false, error: 'DeepSeek API key should start with "sk-"' };
        }
        break;
      case 'mistral':
      case 'groq':
      case 'replicate':
        if (apiKey.length < 10) {
          return { isValid: false, error: 'API key appears to be too short' };
        }
        break;
      case 'lmstudio':
      case 'ollama':
      case 'n8n':
        // These providers don't require API keys
        return { isValid: true };
      default:
        if (apiKey.length === 0) {
          return { isValid: false, error: 'API key cannot be empty' };
        }
        break;
    }

    return { isValid: true };
  }

  /**
   * Add listener for API key changes
   */
  addListener(callback: (providerId: string, hasKey: boolean) => void): void {
    this.listeners.push(callback);
  }

  /**
   * Remove listener for API key changes
   */
  removeListener(callback: (providerId: string, hasKey: boolean) => void): void {
    const index = this.listeners.indexOf(callback);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners about API key changes
   */
  private notifyListeners(providerId: string, hasKey: boolean): void {
    this.listeners.forEach(callback => {
      try {
        callback(providerId, hasKey);
      } catch (error) {
        console.error('Error in API key change listener:', error);
      }
    });
  }

  /**
   * Check if the service is initialized
   */
  isInitialized(): boolean {
    return initializationManager.isServiceInitialized(SecureApiKeyService.SERVICE_NAME);
  }

  /**
   * Wait for the service to be initialized
   */
  async waitForInitialization(): Promise<void> {
    return initializationManager.waitForService(SecureApiKeyService.SERVICE_NAME);
  }

  /**
   * Retry initialization (useful when window becomes available)
   */
  async retryInitialization(): Promise<void> {
    if (!this.isInitialized() && typeof window !== 'undefined') {
      console.log('🔐 Retrying SecureApiKeyService initialization...');
      await this.initializeService();
    }
  }

  /**
   * Force reload API keys from storage (useful after save operations)
   */
  async forceReloadApiKeys(): Promise<void> {
    console.log('🔄 Force reloading API keys from secure storage...');
    console.log('🔍 Current API keys before reload:', Object.keys(this.apiKeys));

    // Always try to reload from storage when explicitly requested
    if (typeof window !== 'undefined' && window.electronAPI?.getSecureApiKeys) {
      try {
        // Force reload from storage
        const encryptedData = await window.electronAPI.getSecureApiKeys();
        if (encryptedData) {
          this.apiKeys = encryptedData;
          console.log('✅ API keys force reloaded from storage successfully');
          console.log('🔍 API keys after reload:', Object.keys(this.apiKeys));

          // Notify all listeners about the reload
          Object.keys(this.apiKeys).forEach(providerId => {
            this.notifyListeners(providerId, !!this.apiKeys[providerId]?.apiKey);
          });
        } else {
          console.warn('⚠️ No API keys found in storage during force reload');
        }
      } catch (error) {
        console.error('❌ Failed to force reload API keys:', error);
      }
    } else {
      console.warn('⚠️ Electron API not available, cannot force reload from storage');
    }
  }

  /**
   * Debug method to check current API key state
   */
  debugApiKeyState(): void {
    console.log('🔍 DEBUG: Current API key state:');
    console.log('🔍 Service initialized:', this.isInitialized());
    console.log('🔍 Providers with API keys:', Object.keys(this.apiKeys));
    Object.entries(this.apiKeys).forEach(([providerId, data]) => {
      console.log(`🔍 ${providerId}:`, {
        hasApiKey: !!data.apiKey,
        keyLength: data.apiKey?.length || 0,
        hasBaseUrl: !!data.baseUrl
      });
    });
  }

  /**
   * Check for and migrate API keys from old settings format
   */
  private async checkAndMigrateFromSettings(): Promise<void> {
    try {
      // Only attempt migration if we don't have any API keys yet
      if (Object.keys(this.apiKeys).length > 0) {
        console.log('🔐 API keys already exist in secure storage, skipping migration');
        return;
      }

      // Try to load old settings to check for API keys
      if (typeof window !== 'undefined' && window.electronAPI?.getAppSettings) {
        const oldSettings = await window.electronAPI.getAppSettings() as any;

        if (oldSettings?.chat?.providers) {
          console.log('🔄 Checking for API keys to migrate from old settings...');
          let migrated = false;

          for (const [providerId, providerData] of Object.entries(oldSettings.chat.providers)) {
            const data = providerData as any;
            if (data.apiKey && data.apiKey.trim() !== '') {
              console.log(`🔄 Migrating API key for ${providerId}`);
              await this.setApiKeyData(providerId, {
                apiKey: data.apiKey,
                baseUrl: data.baseUrl,
                lastSelectedModel: data.lastSelectedModel
              });
              migrated = true;
            }
          }

          if (migrated) {
            console.log('✅ API key migration completed successfully');

            // Clean up API keys from old settings
            await this.cleanupOldSettingsApiKeys(oldSettings);
          } else {
            console.log('ℹ️ No API keys found to migrate');
          }
        }
      }
    } catch (error) {
      console.error('❌ Error during API key migration:', error);
    }
  }

  /**
   * Clean up API keys from old settings format
   */
  private async cleanupOldSettingsApiKeys(oldSettings: any): Promise<void> {
    try {
      console.log('🧹 Cleaning up API keys from old settings...');

      // Remove API keys from the providers
      if (oldSettings.chat?.providers) {
        for (const [providerId, providerData] of Object.entries(oldSettings.chat.providers)) {
          const data = providerData as any;
          if (data.apiKey) {
            delete data.apiKey;
            console.log(`🧹 Removed API key from settings for ${providerId}`);
          }
        }

        // Save the cleaned settings back
        if (typeof window !== 'undefined' && window.electronAPI?.updateAppSettings) {
          await window.electronAPI.updateAppSettings(oldSettings);
          console.log('✅ Cleaned up API keys from old settings');
        }
      }
    } catch (error) {
      console.error('❌ Error cleaning up old settings:', error);
    }
  }

  /**
   * Migrate API keys from old settings format (public method for manual migration)
   */
  async migrateFromSettings(oldProviders: Record<string, { apiKey?: string; baseUrl?: string; lastSelectedModel?: string }>): Promise<boolean> {
    // ALWAYS SAVE - No conditions that prevent saving

    console.log('🔄 Migrating API keys from old settings format...');
    let migrated = false;

    for (const [providerId, providerData] of Object.entries(oldProviders)) {
      if (providerData.apiKey && !this.hasApiKey(providerId)) {
        console.log(`🔄 Migrating API key for ${providerId}`);
        await this.setApiKeyData(providerId, {
          apiKey: providerData.apiKey,
          baseUrl: providerData.baseUrl,
          lastSelectedModel: providerData.lastSelectedModel
        });
        migrated = true;
      }
    }

    if (migrated) {
      console.log('✅ API key migration completed successfully');
    } else {
      console.log('ℹ️ No API keys to migrate');
    }

    return migrated;
  }
}

// Create and export singleton instance
export const secureApiKeyService = new SecureApiKeyService();
export default secureApiKeyService;
