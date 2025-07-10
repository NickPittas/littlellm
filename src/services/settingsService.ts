import type { ChatSettings } from './chatService';

export interface AppSettings {
  chat: ChatSettings;
  ui: {
    theme: 'light' | 'dark' | 'system';
    alwaysOnTop: boolean;
    startMinimized: boolean;
    opacity?: number;
    fontSize?: 'small' | 'medium' | 'large';
    windowBounds: {
      width: number;
      height: number;
    };
  };
  shortcuts: {
    toggleWindow: string;
    processClipboard: string;
    actionMenu: string;
  };
  general: {
    autoStartWithSystem: boolean;
    showNotifications: boolean;
    saveConversationHistory: boolean;
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  chat: {
    provider: '',
    model: '',
    temperature: 0.3,
    maxTokens: 8192,
    systemPrompt: '',
    providers: {
      openai: { apiKey: '', lastSelectedModel: '' },
      anthropic: { apiKey: '', lastSelectedModel: '' },
      gemini: { apiKey: '', lastSelectedModel: '' },
      mistral: { apiKey: '', lastSelectedModel: '' },
      deepseek: { apiKey: '', lastSelectedModel: '' },
      lmstudio: { apiKey: '', baseUrl: 'http://localhost:1234/v1', lastSelectedModel: '' },
      ollama: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
      openrouter: { apiKey: '', lastSelectedModel: '' },
      requesty: { apiKey: '', lastSelectedModel: '' },
      replicate: { apiKey: '', lastSelectedModel: '' },
    },
  },
  ui: {
    theme: 'system',
    alwaysOnTop: true,
    startMinimized: false,
    opacity: 1.0,
    fontSize: 'small',
    windowBounds: {
      width: 400,
      height: 600,
    },
  },
  shortcuts: {
    toggleWindow: 'CommandOrControl+Shift+L',
    processClipboard: 'CommandOrControl+Shift+V',
    actionMenu: 'CommandOrControl+Shift+Space',
  },
  general: {
    autoStartWithSystem: false,
    showNotifications: true,
    saveConversationHistory: true,
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
    this.initialized = true;
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
            this.settings = { ...DEFAULT_SETTINGS, ...savedSettings };
            this.notifyListeners();
          } else {
            console.log('No saved settings found, using defaults');
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
      if (typeof window !== 'undefined' && window.electronAPI?.updateAppSettings) {
        const success = await window.electronAPI.updateAppSettings(this.settings);
        if (success) {
          console.log('Settings saved to JSON file successfully');
          return true;
        } else {
          console.error('Failed to save settings to JSON file');
          return false;
        }
      }
      return false;
    } catch (error) {
      console.error('Error saving settings to file:', error);
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
      return { ...DEFAULT_SETTINGS.chat };
    }

    // Ensure providers object exists for backward compatibility
    const chatSettings = { ...this.settings.chat };
    if (!chatSettings.providers) {
      chatSettings.providers = {
        openai: { apiKey: '' },
        anthropic: { apiKey: '' },
        gemini: { apiKey: '' },
        mistral: { apiKey: '' },
        deepseek: { apiKey: '' },
        lmstudio: { apiKey: '', baseUrl: 'http://localhost:1234/v1' },
        ollama: { apiKey: '', baseUrl: '' },
        openrouter: { apiKey: '' },
        requesty: { apiKey: '' },
        replicate: { apiKey: '' },
      };
    }

    return chatSettings;
  }

  // Update settings in memory only (for UI changes) - NO SAVE, NO NOTIFICATIONS
  updateSettingsInMemory(updates: Partial<AppSettings>) {
    this.settings = { ...this.settings, ...updates };
    // DO NOT NOTIFY LISTENERS - PREVENTS INFINITE LOOPS
  }

  // Update chat settings in memory only - NO SAVE
  updateChatSettingsInMemory(updates: Partial<ChatSettings>) {
    this.settings.chat = { ...this.settings.chat, ...updates };
    this.notifyListeners();
  }

  // SAVE settings to JSON file - ONLY called when user clicks "Save Settings"
  async saveSettingsToDisk(): Promise<boolean> {
    const success = await this.saveSettings();
    if (success) {
      this.notifyListeners();
    }
    return success;
  }

  // Method for SettingsOverlay - SAVE TO DISK and RELOAD after 1 second
  async updateSettings(updates: Partial<AppSettings>): Promise<boolean> {
    // Update settings in memory
    this.settings = { ...this.settings, ...updates };

    // Save to disk
    const success = await this.saveSettingsToFile();

    if (success) {
      // Reload settings from disk after 1 second
      setTimeout(() => {
        this.reloadSettingsFromDisk();
      }, 1000);
    }

    return success;
  }

  // Reload settings from disk (called 1 second after save)
  private async reloadSettingsFromDisk() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        console.log('Reloading settings from disk after save...');
        const savedSettings = await window.electronAPI.getSettings();
        if (savedSettings) {
          console.log('Settings reloaded from disk:', savedSettings);
          this.settings = { ...DEFAULT_SETTINGS, ...savedSettings };
          this.notifyListeners();
        }
      } catch (error) {
        console.error('Failed to reload settings from disk:', error);
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
