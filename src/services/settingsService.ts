

export interface ColorSettings {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  ring: string;
  destructive: string;
  destructiveForeground: string;
  systemText: string; // System UI text color (labels, buttons, etc.)
}

export interface AppSettings {
  chat: ChatSettings;
  ui: {
    theme: 'light' | 'dark' | 'system';
    alwaysOnTop: boolean;
    startMinimized: boolean;
    fontSize?: 'small' | 'medium' | 'large';
    windowBounds: {
      width: number;
      height: number;
      x?: number;
      y?: number;
    };
    hotkey: string;
    screenshotHotkey: string;
    customColors?: ColorSettings;
    useCustomColors?: boolean;
    selectedThemePreset?: string; // ID of selected theme preset
    colorMode?: 'preset' | 'custom'; // Whether using preset or custom colors
  };
  shortcuts: {
    toggleWindow: string;
    processClipboard: string;
    actionMenu: string;
    openShortcuts: string;
  };
  general: {
    autoStartWithSystem: boolean;
    showNotifications: boolean;
    saveConversationHistory: boolean;
    conversationHistoryLength: number; // Number of previous messages to include in context
  };
}

// Import shared types
import type { ChatSettings, ProviderSettings, ProvidersConfig, MCPServerConfig } from '../types/settings';

// Re-export shared types for convenience
export type { ChatSettings, ProviderSettings, ProvidersConfig, MCPServerConfig };

const DEFAULT_SETTINGS: AppSettings = {
  chat: {
    provider: '', // Will be loaded from stateService
    model: '', // Will be loaded from stateService
    defaultModel: 'gpt-4-1106-preview',
    defaultProvider: 'openai',
    systemPrompt: '',
    temperature: 0.3,
    maxTokens: 8192,
    toolCallingEnabled: true,
    providers: {
      openai: { apiKey: '', lastSelectedModel: '' },
      anthropic: { apiKey: '', lastSelectedModel: '' },
      gemini: { apiKey: '', lastSelectedModel: '' },
      mistral: { apiKey: '', lastSelectedModel: '' },
      deepseek: { apiKey: '', lastSelectedModel: '' },
      groq: { apiKey: '', lastSelectedModel: '' },
      lmstudio: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
      ollama: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
      openrouter: { apiKey: '', lastSelectedModel: '' },
      requesty: { apiKey: '', lastSelectedModel: '' },
      replicate: { apiKey: '', lastSelectedModel: '' },
      n8n: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
    },
  },
  ui: {
    theme: 'system',
    alwaysOnTop: true,
    startMinimized: false,
    fontSize: 'small',
    hotkey: 'CommandOrControl+Shift+A',
    screenshotHotkey: 'CommandOrControl+Shift+S',
    windowBounds: {
      width: 400,
      height: 615, // Increased by 15px for draggable header
      x: undefined, // Let Electron choose initial position
      y: undefined, // Let Electron choose initial position
    },
    useCustomColors: false,
    selectedThemePreset: 'default', // Default to VS Code Dark theme
    colorMode: 'preset', // Default to using preset themes
    customColors: {
      background: '#181829',
      foreground: '#d4d4d4',
      card: '#181829',
      cardForeground: '#ffffff',
      primary: '#569cd6',
      primaryForeground: '#ffffff',
      secondary: '#4fc1ff',
      secondaryForeground: '#adadad',
      accent: '#569cd6',
      accentForeground: '#ffffff',
      muted: '#211f32',
      mutedForeground: '#9ca3af',
      border: '#3b3b68',
      input: '#949494',
      ring: '#569cd6',
      destructive: '#f44747',
      destructiveForeground: '#ffffff',
      systemText: '#e0e0e0',
    },
  },
  shortcuts: {
    toggleWindow: 'CommandOrControl+Shift+L',
    processClipboard: 'CommandOrControl+Shift+V',
    actionMenu: 'CommandOrControl+Shift+Space',
    openShortcuts: 'CommandOrControl+Shift+K',
  },
  general: {
    autoStartWithSystem: false,
    showNotifications: true,
    saveConversationHistory: true,
    conversationHistoryLength: 10, // Default to last 10 messages
  },
};

class SettingsService {
  private settings: AppSettings = DEFAULT_SETTINGS;
  private listeners: Array<(settings: AppSettings) => void> = [];
  private initialized = false;


  constructor() {
    // Initialize with defaults
    this.settings = { ...DEFAULT_SETTINGS };

    // Load settings immediately if Electron is available
    this.loadSettingsSync();
    // Note: initialized will be set to true after settings are actually loaded
  }

  private loadSettingsSync() {
    // Load settings from disk ONCE at startup
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        console.log('Loading settings from disk...');
        // This should be synchronous at startup
        window.electronAPI.getSettings().then((savedSettings) => {
          if (savedSettings) {
            console.log('Settings loaded from disk:', savedSettings);
            const settings = savedSettings as {
              chat?: {
                model?: string;
                providers?: Record<string, { lastSelectedModel?: string }>
              }
            };

            // Migration fix: Check if model is set to a provider name and clear it
            const providerNames = ['OpenAI', 'Anthropic', 'Google Gemini', 'Mistral AI', 'DeepSeek', 'LM Studio', 'Ollama (Local)', 'OpenRouter', 'Requesty', 'Replicate'];
            if (settings.chat?.model && providerNames.includes(settings.chat.model)) {
              console.log('Migration: Detected model set to provider name, clearing it:', settings.chat.model);
              settings.chat.model = '';
            }

            // Also clean up any corrupted lastSelectedModel values in providers
            if (settings.chat?.providers) {
              Object.keys(settings.chat.providers).forEach(providerId => {
                const provider = settings.chat!.providers![providerId];
                if (provider.lastSelectedModel && providerNames.includes(provider.lastSelectedModel)) {
                  console.log('Migration: Detected corrupted lastSelectedModel for provider', providerId, ':', provider.lastSelectedModel);
                  provider.lastSelectedModel = '';
                }
              });
            }

            this.settings = { ...DEFAULT_SETTINGS, ...(savedSettings as AppSettings) };
            this.initialized = true; // Mark as initialized after settings are loaded
            this.notifyListeners();
          } else {
            console.log('No saved settings found, using defaults');
            this.initialized = true; // Mark as initialized even with defaults
          }
        }).catch((error) => {
          console.error('Failed to load settings from disk:', error);
          console.log('Using default settings');
        });
      } catch (error) {
        console.error('Error loading settings:', error);
        console.log('Settings service initialized with defaults only');
      }
    } else {
      console.log('Settings service initialized with defaults only (no Electron API)');
    }
  }

  // Save settings to JSON file via Electron
  private async saveSettingsToFile() {
    try {
      console.log('🔍 saveSettingsToFile called');
      console.log('🔍 window available:', typeof window !== 'undefined');
      console.log('🔍 electronAPI available:', typeof window !== 'undefined' && !!window.electronAPI);
      console.log('🔍 updateAppSettings available:', typeof window !== 'undefined' && !!window.electronAPI?.updateAppSettings);
      console.log('🔍 Settings to save:', JSON.stringify(this.settings, null, 2));

      if (typeof window !== 'undefined' && window.electronAPI?.updateAppSettings) {
        console.log('🔍 Calling window.electronAPI.updateAppSettings...');
        const success = await window.electronAPI.updateAppSettings(this.settings);
        console.log('🔍 updateAppSettings returned:', success);

        if (success) {
          console.log('✅ Settings saved to JSON file successfully');
          return true;
        } else {
          console.error('❌ Failed to save settings to JSON file - updateAppSettings returned false');
          return false;
        }
      } else {
        console.error('❌ Electron API or updateAppSettings not available');
        console.log('🔍 window:', typeof window);
        console.log('🔍 electronAPI:', typeof window !== 'undefined' ? window.electronAPI : 'window undefined');
        return false;
      }
    } catch (error) {
      console.error('❌ Error saving settings to file:', error);
      return false;
    }
  }

  // Simple method that just calls the file save
  private async saveSettings() {
    return await this.saveSettingsToFile();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.settings));
  }

  getSettings(): AppSettings {
    if (!this.initialized) {
      // Return defaults if not initialized yet
      return { ...DEFAULT_SETTINGS };
    }
    return { ...this.settings };
  }

  getChatSettings(): ChatSettings {
    if (!this.initialized) {
      // Return defaults if not initialized yet
      console.log('🔍 getChatSettings: Not initialized, returning defaults');
      return { ...DEFAULT_SETTINGS.chat };
    }

    // Ensure providers object exists for backward compatibility
    const chatSettings = { ...this.settings.chat };
    if (!chatSettings.providers) {
      console.log('🔍 getChatSettings: No providers found, creating defaults');
      chatSettings.providers = {
        openai: { apiKey: '', lastSelectedModel: '' },
        anthropic: { apiKey: '', lastSelectedModel: '' },
        gemini: { apiKey: '', lastSelectedModel: '' },
        mistral: { apiKey: '', lastSelectedModel: '' },
        deepseek: { apiKey: '', lastSelectedModel: '' },
        groq: { apiKey: '', lastSelectedModel: '' },
        lmstudio: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
        ollama: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
        openrouter: { apiKey: '', lastSelectedModel: '' },
        requesty: { apiKey: '', lastSelectedModel: '' },
        replicate: { apiKey: '', lastSelectedModel: '' },
        n8n: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
      };
    } else {
      // Debug loaded API keys
      Object.entries(chatSettings.providers).forEach(([provider, config]) => {
        if (config.apiKey) {
          console.log(`🔍 getChatSettings: Loaded API key for ${provider}:`, {
            hasKey: !!config.apiKey,
            keyLength: config.apiKey.length,
            keyStart: config.apiKey.substring(0, 10),
            keyType: typeof config.apiKey,
            startsWithSkAnt: provider === 'anthropic' ? config.apiKey.startsWith('sk-ant-') : 'N/A'
          });
        }
      });
    }

    // Ensure toolCallingEnabled exists for backward compatibility
    if (chatSettings.toolCallingEnabled === undefined) {
      chatSettings.toolCallingEnabled = true; // Default to enabled
    }

    return chatSettings;
  }

  // Update settings in memory only (for UI changes) - NO SAVE, NO NOTIFICATIONS
  updateSettingsInMemory(updates: Partial<AppSettings>) {
    this.settings = { ...this.settings, ...updates };
    // DO NOT NOTIFY LISTENERS - PREVENTS INFINITE LOOPS
  }

  // Force update settings and notify all listeners (used by Reload Settings button)
  forceUpdateSettings(newSettings: AppSettings) {
    console.log('🔄 Force updating settings and notifying all listeners');
    console.log('🔍 Old settings:', JSON.stringify(this.settings, null, 2));
    console.log('🔍 New settings:', JSON.stringify(newSettings, null, 2));

    this.settings = { ...DEFAULT_SETTINGS, ...newSettings };
    console.log('🔍 Merged settings:', JSON.stringify(this.settings, null, 2));
    console.log('🔍 Notifying', this.listeners.length, 'listeners');

    this.notifyListeners();
    console.log('✅ Settings force updated and all listeners notified');
  }

  // Update chat settings in memory only - NO SAVE, NO NOTIFICATIONS
  // Excludes provider/model which are managed by stateService
  updateChatSettingsInMemory(updates: Partial<ChatSettings>) {
    // Extract provider/model from updates since they're managed separately
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { provider, model, ...settingsUpdates } = updates;

    // Only update non-provider/model settings in main settings
    this.settings.chat = { ...this.settings.chat, ...settingsUpdates };

    // DO NOT NOTIFY LISTENERS - PREVENTS INFINITE LOOPS
    console.log('Settings updated in memory (excluding provider/model):', settingsUpdates);
  }

  // SAVE settings to JSON file - ONLY called when user clicks "Save Settings"
  async saveSettingsToDisk(): Promise<boolean> {
    // Clean settings before saving to prevent corruption
    this.cleanCorruptedData();
    const success = await this.saveSettings();
    // DO NOT NOTIFY LISTENERS - Only explicit reload should trigger notifications
    return success;
  }

  // Clean any corrupted data in settings
  private cleanCorruptedData(): void {
    const providerNames = ['OpenAI', 'Anthropic', 'Google Gemini', 'Mistral AI', 'DeepSeek', 'LM Studio', 'Ollama (Local)', 'OpenRouter', 'Requesty', 'Replicate'];

    // Clean provider lastSelectedModel fields (provider/model are managed by stateService now)
    if (this.settings.chat?.providers) {
      Object.keys(this.settings.chat.providers).forEach(providerId => {
        const provider = this.settings.chat.providers[providerId];
        if (provider.lastSelectedModel && providerNames.includes(provider.lastSelectedModel)) {
          console.log('Cleaning corrupted lastSelectedModel for provider', providerId, ':', provider.lastSelectedModel);
          provider.lastSelectedModel = '';
        }
      });
    }
  }

  // Force clean all corrupted data immediately
  forceCleanCorruptedData(): void {
    console.log('Force cleaning all corrupted data...');
    this.cleanCorruptedData();
    // DO NOT NOTIFY LISTENERS - Only explicit reload should trigger notifications
  }

  // Method for SettingsOverlay - SAVE TO DISK ONLY (no auto-reload)
  async updateSettings(updates: Partial<AppSettings>): Promise<boolean> {
    console.log('🔍 updateSettings called with:', JSON.stringify(updates, null, 2));

    // Debug API keys in the updates
    if (updates.chat?.providers) {
      Object.entries(updates.chat.providers).forEach(([provider, config]) => {
        if (config.apiKey) {
          console.log(`🔍 Updating API key for ${provider}:`, {
            hasKey: !!config.apiKey,
            keyLength: config.apiKey.length,
            keyStart: config.apiKey.substring(0, 10),
            keyType: typeof config.apiKey,
            startsWithSkAnt: provider === 'anthropic' ? config.apiKey.startsWith('sk-ant-') : 'N/A'
          });
        }
      });
    }

    // Update settings in memory with deep merge
    const oldSettings = { ...this.settings };

    // Deep merge for nested objects like ui, chat, etc.
    this.settings = {
      ...this.settings,
      ...updates,
      // Deep merge ui object if it exists in updates
      ...(updates.ui && {
        ui: {
          ...this.settings.ui,
          ...updates.ui
        }
      }),
      // Deep merge chat object if it exists in updates
      ...(updates.chat && {
        chat: {
          ...this.settings.chat,
          ...updates.chat,
          // Deep merge providers if it exists
          ...(updates.chat.providers && {
            providers: {
              ...this.settings.chat.providers,
              ...updates.chat.providers
            }
          })
        }
      })
    };

    console.log('🔍 Settings updated in memory from:', JSON.stringify(oldSettings, null, 2));
    console.log('🔍 Settings updated in memory to:', JSON.stringify(this.settings, null, 2));

    // Save to disk
    console.log('🔍 Calling saveSettingsToFile...');
    const success = await this.saveSettingsToFile();
    console.log('🔍 saveSettingsToFile returned:', success);

    if (success) {
      console.log('🔍 Notifying listeners...');
      // Notify listeners immediately after successful save
      this.notifyListeners();
      console.log('✅ Settings updated and listeners notified');

      // Also trigger a reload from disk to ensure all components get the latest settings
      setTimeout(async () => {
        try {
          console.log('🔄 Auto-reloading settings from disk after save...');
          if (typeof window !== 'undefined' && window.electronAPI) {
            const savedSettings = await window.electronAPI.getSettings();
            if (savedSettings) {
              this.settings = { ...DEFAULT_SETTINGS, ...(savedSettings as AppSettings) };
              this.notifyListeners();
              console.log('✅ Settings auto-reloaded from disk successfully');
            }
          }
        } catch (error) {
          console.error('❌ Failed to auto-reload settings from disk:', error);
        }
      }, 100); // Small delay to ensure file is written
    } else {
      console.error('❌ Failed to save settings, not notifying listeners');
    }

    return success;
  }

  // REMOVED: Automatic reload method - settings should only reload when explicitly requested

  // Reload settings when MCP servers are enabled/disabled (explicit requirement)
  async reloadForMCPChange(): Promise<void> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        console.log('🔄 Reloading settings due to MCP server change...');
        const savedSettings = await window.electronAPI.getSettings();
        if (savedSettings) {
          console.log('Settings reloaded for MCP change:', savedSettings);
          this.settings = { ...DEFAULT_SETTINGS, ...(savedSettings as AppSettings) };
          this.notifyListeners();
        }
      } catch (error) {
        console.error('Failed to reload settings for MCP change:', error);
      }
    }
  }

  async resetSettings() {
    this.settings = { ...DEFAULT_SETTINGS };
    await this.saveSettings();
  }

  subscribe(listener: (settings: AppSettings) => void) {
    this.listeners.push(listener);
    // Immediately call with current settings
    listener(this.settings);
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  async exportSettings(): Promise<string> {
    return JSON.stringify(this.settings, null, 2);
  }

  async importSettings(settingsJson: string): Promise<boolean> {
    try {
      const imported = JSON.parse(settingsJson);
      
      // Validate the imported settings structure
      if (typeof imported === 'object' && imported !== null) {
        // Merge with defaults to ensure all required fields exist
        this.settings = {
          chat: { ...DEFAULT_SETTINGS.chat, ...imported.chat },
          ui: { ...DEFAULT_SETTINGS.ui, ...imported.ui },
          shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...imported.shortcuts },
          general: { ...DEFAULT_SETTINGS.general, ...imported.general },
        };
        
        await this.saveSettings();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to import settings:', error);
      return false;
    }
  }

  // Removed utility methods to prevent automatic saves
  // All settings changes should go through the main updateSettings method
  // which is only called when user clicks "Save Settings"

  // Validation methods
  validateApiKey(provider: string, apiKey: string): boolean {
    if (!apiKey) return false;

    switch (provider) {
      case 'openai':
        return apiKey.startsWith('sk-');
      case 'anthropic':
        return apiKey.startsWith('sk-ant-');
      case 'gemini':
        return apiKey.length > 20; // Google API keys are typically longer
      case 'mistral':
        return apiKey.length > 10; // Basic length check
      case 'deepseek':
        return apiKey.startsWith('sk-');
      case 'lmstudio':
        return true; // LM Studio doesn't require API key
      case 'ollama':
        return true; // Ollama doesn't require API key
      case 'openrouter':
        return apiKey.startsWith('sk-or-');
      case 'replicate':
        return apiKey.length > 10; // Basic length check
      case 'n8n':
        return true; // n8n doesn't require API key, uses webhook URL
      default:
        return apiKey.length > 0;
    }
  }

  validateShortcut(shortcut: string): boolean {
    // Basic validation for Electron shortcuts
    const validModifiers = ['CommandOrControl', 'Alt', 'Shift', 'Super'];
    const parts = shortcut.split('+');
    
    if (parts.length < 2) return false;
    
    const modifiers = parts.slice(0, -1);
    const key = parts[parts.length - 1];
    
    // Check if all modifiers are valid
    const hasValidModifier = modifiers.some(mod => validModifiers.includes(mod));
    
    // Check if key is valid (basic check)
    const hasValidKey = key.length === 1 || ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].includes(key);
    
    return hasValidModifier && hasValidKey;
  }
}

export const settingsService = new SettingsService();
