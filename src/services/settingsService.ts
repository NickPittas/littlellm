import type { ChatSettings } from './chatService';

export interface AppSettings {
  chat: ChatSettings;
  ui: {
    theme: 'light' | 'dark' | 'system';
    alwaysOnTop: boolean;
    startMinimized: boolean;
    windowBounds: {
      width: number;
      height: number;
    };
  };
  shortcuts: {
    toggleWindow: string;
    processClipboard: string;
  };
  general: {
    autoStartWithSystem: boolean;
    showNotifications: boolean;
    saveConversationHistory: boolean;
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  chat: {
    provider: 'openrouter',
    model: 'mistralai/mistral-7b-instruct:free',
    temperature: 0.7,
    maxTokens: 2048,
    systemPrompt: 'You are a helpful AI assistant. Please provide concise and helpful responses.',
    providers: {
      openai: { apiKey: '' },
      openrouter: { apiKey: '' },
      requesty: { apiKey: '' },
      ollama: { apiKey: '', baseUrl: 'http://localhost:11434' },
      replicate: { apiKey: '' },
    },
  },
  ui: {
    theme: 'system',
    alwaysOnTop: true,
    startMinimized: false,
    windowBounds: {
      width: 400,
      height: 600,
    },
  },
  shortcuts: {
    toggleWindow: 'CommandOrControl+Shift+L',
    processClipboard: 'CommandOrControl+Shift+V',
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
    // Only load settings on client side
    if (typeof window !== 'undefined') {
      this.loadSettings();
      this.initialized = true;
    }
  }

  private ensureInitialized() {
    if (!this.initialized && typeof window !== 'undefined') {
      this.loadSettings();
      this.initialized = true;
    }
  }

  private async loadSettings() {
    try {
      // Try to load from Electron store first
      if (typeof window !== 'undefined' && window.electronAPI) {
        const electronSettings = await window.electronAPI.getSettings();
        if (electronSettings) {
          this.settings = { ...DEFAULT_SETTINGS, ...electronSettings };
          this.notifyListeners();
          return;
        }
      }

      // Fallback to Electron storage API
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.getStorageItem) {
        const stored = await window.electronAPI.getStorageItem('app-settings');
        if (stored) {
          this.settings = { ...DEFAULT_SETTINGS, ...stored };
          this.notifyListeners();
          return;
        }
      }

      // Last fallback to localStorage for web version (if available)
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          const stored = localStorage.getItem('app-settings');
          if (stored) {
            const parsed = JSON.parse(stored);
            this.settings = { ...DEFAULT_SETTINGS, ...parsed };
          }
        } catch (localStorageError) {
          console.warn('localStorage not available, using defaults');
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      this.settings = DEFAULT_SETTINGS;
    }

    this.notifyListeners();
  }

  private async saveSettings() {
    try {
      // Save to Electron store if available
      if (typeof window !== 'undefined' && window.electronAPI) {
        const success = await window.electronAPI.updateSettings(this.settings);
        if (success) {
          console.log('Settings saved to Electron store');
        }
      }

      // Also save to Electron storage API
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.setStorageItem) {
        await window.electronAPI.setStorageItem('app-settings', this.settings);
        console.log('Settings saved to Electron storage');
      }

      // Fallback to localStorage if available
      if (typeof window !== 'undefined' && window.localStorage) {
        try {
          localStorage.setItem('app-settings', JSON.stringify(this.settings));
          console.log('Settings saved to localStorage');
        } catch (localStorageError) {
          console.warn('localStorage not available for saving');
        }
      }

      this.notifyListeners();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.settings));
  }

  getSettings(): AppSettings {
    this.ensureInitialized();
    return { ...this.settings };
  }

  getChatSettings(): ChatSettings {
    this.ensureInitialized();

    // Ensure providers object exists for backward compatibility
    const chatSettings = { ...this.settings.chat };
    if (!chatSettings.providers) {
      chatSettings.providers = {
        openai: { apiKey: '' },
        openrouter: { apiKey: '' },
        requesty: { apiKey: '' },
        ollama: { apiKey: '', baseUrl: 'http://localhost:11434' },
        replicate: { apiKey: '' },
      };
    }

    return chatSettings;
  }

  async updateChatSettings(updates: Partial<ChatSettings>) {
    this.settings.chat = { ...this.settings.chat, ...updates };
    await this.saveSettings();
  }

  async updateUISettings(updates: Partial<AppSettings['ui']>) {
    this.settings.ui = { ...this.settings.ui, ...updates };
    await this.saveSettings();
  }

  async updateShortcuts(updates: Partial<AppSettings['shortcuts']>) {
    this.settings.shortcuts = { ...this.settings.shortcuts, ...updates };
    await this.saveSettings();
  }

  async updateGeneralSettings(updates: Partial<AppSettings['general']>) {
    this.settings.general = { ...this.settings.general, ...updates };
    await this.saveSettings();
  }

  async updateSettings(updates: Partial<AppSettings>) {
    this.settings = { ...this.settings, ...updates };
    await this.saveSettings();
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

  // Utility methods for common operations
  async toggleAlwaysOnTop() {
    await this.updateUISettings({ alwaysOnTop: !this.settings.ui.alwaysOnTop });
  }

  async setTheme(theme: 'light' | 'dark' | 'system') {
    await this.updateUISettings({ theme });
  }

  async updateWindowBounds(width: number, height: number) {
    await this.updateUISettings({ 
      windowBounds: { width, height } 
    });
  }

  // Validation methods
  validateApiKey(provider: string, apiKey: string): boolean {
    if (!apiKey) return false;
    
    switch (provider) {
      case 'openai':
        return apiKey.startsWith('sk-');
      case 'openrouter':
        return apiKey.startsWith('sk-or-');
      case 'replicate':
        return apiKey.length > 10; // Basic length check
      case 'ollama':
        return true; // Ollama doesn't require API key
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
