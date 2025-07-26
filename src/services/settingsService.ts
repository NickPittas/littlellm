

// Import shared types
import type {
  ChatSettings,
  ProviderSettings,
  ProvidersConfig,
  MCPServerConfig,
  AppSettings,
  UISettings,
  ColorSettings,
  InternalCommandSettings
} from '../types/settings';
import { serviceRegistry, SERVICE_NAMES, DebugLoggerInterface } from './serviceRegistry';

// Re-export shared types for convenience
export type {
  ChatSettings,
  ProviderSettings,
  ProvidersConfig,
  MCPServerConfig,
  AppSettings,
  UISettings,
  ColorSettings,
  InternalCommandSettings
};

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
      openai: { lastSelectedModel: '' },
      anthropic: { lastSelectedModel: '' },
      gemini: { lastSelectedModel: '' },
      mistral: { lastSelectedModel: '' },
      deepseek: { lastSelectedModel: '' },
      groq: { lastSelectedModel: '' },
      lmstudio: { baseUrl: '', lastSelectedModel: '' },
      ollama: { baseUrl: '', lastSelectedModel: '' },
      openrouter: { lastSelectedModel: '' },
      requesty: { lastSelectedModel: '' },
      replicate: { lastSelectedModel: '' },
      n8n: { baseUrl: '', lastSelectedModel: '' },
    },
  },
  mcpServers: [],
  internalCommands: {
    enabled: false, // Disabled by default for security
    allowedDirectories: [
      // Common safe directories for file operations
      process.env.HOME || process.env.USERPROFILE || '~', // User home directory
      process.cwd(), // Current working directory
      ...(process.env.DESKTOP ? [process.env.DESKTOP] : []), // Desktop if available
      ...(process.env.DOWNLOADS ? [process.env.DOWNLOADS] : []), // Downloads if available
    ].filter(Boolean), // Remove any undefined values
    blockedCommands: [
      'rm', 'del', 'format', 'fdisk', 'mkfs', 'dd', 'sudo', 'su',
      'chmod 777', 'chown', 'passwd', 'useradd', 'userdel', 'groupadd',
      'systemctl', 'service', 'shutdown', 'reboot', 'halt', 'poweroff'
    ],
    fileReadLineLimit: 1000,
    fileWriteLineLimit: 50,
    defaultShell: process.platform === 'win32' ? 'powershell' : 'bash',
    enabledCommands: {
      terminal: true,
      filesystem: true,
      textEditing: true,
      system: true,
    },
    terminalSettings: {
      defaultTimeout: 30000, // 30 seconds
      maxProcesses: 10,
      allowInteractiveShells: true,
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
    // Required theme properties with defaults
    useCustomColors: false,
    selectedThemePreset: 'cyberpunk',
    colorMode: 'preset',
    customColors: {
      background: '#0a0a0f',
      foreground: '#e0e0ff',
      card: '#1a1a2e',
      cardForeground: '#ffffff',
      primary: '#00d4ff',
      primaryForeground: '#000000',
      secondary: '#ff6b9d',
      secondaryForeground: '#000000',
      accent: '#00d4ff',
      accentForeground: '#000000',
      muted: '#16213e',
      mutedForeground: '#9ca3af',
      border: '#3b3b68',
      input: '#1e1b2e',
      ring: '#00d4ff',
      destructive: '#f44747',
      destructiveForeground: '#ffffff',
      systemText: '#e0e0ff',
    }
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
    debugLogging: false, // Debug logging disabled by default
  },
};

class SettingsService {
  private settings: AppSettings = {} as AppSettings; // Don't initialize with defaults
  private listeners: Array<(settings: AppSettings) => void> = [];
  private initialized = false;
  private initializationPromise: Promise<void> | null = null;
  private saveInProgress = false;


  constructor() {
    // Register with service registry to break circular dependencies
    serviceRegistry.registerService(SERVICE_NAMES.SETTINGS_SERVICE, this);

    // DO NOT initialize with defaults - wait for actual settings to load
    // this.settings will be set in loadSettingsAsync()

    // Start async initialization to prevent race conditions
    this.initializationPromise = this.loadSettingsAsync();
  }

  private async loadSettingsAsync(): Promise<void> {
    // Load settings from disk ONCE at startup
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        console.log('Loading settings from disk...');
        const savedSettings = await window.electronAPI.getSettings();

        if (savedSettings) {
          console.log('Settings loaded from disk:', savedSettings);

          // Use saved settings directly without merging defaults to preserve user data
          this.settings = savedSettings as AppSettings;

          // Ensure essential structure exists without overriding user values
          this.ensureEssentialStructure();

          this.initialized = true;
          this.notifyListeners();
          console.log('✅ Settings loaded from file successfully');
        } else {
          console.log('🔧 No saved settings found - using defaults');
          this.settings = { ...DEFAULT_SETTINGS };
          this.initialized = true;
          this.notifyListeners();
        }
      } catch (error) {
        console.error('❌ CRITICAL: Failed to load settings from disk:', error);
        // Don't mask the error - let it propagate
        this.initialized = false;
        throw new Error(`Failed to load settings: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      console.warn('⚠️ No Electron API available - settings will not persist');
      this.settings = { ...DEFAULT_SETTINGS };
      this.initialized = true;
      this.notifyListeners();
    }
  }

  /**
   * Ensure essential structure exists without overriding user values
   */
  private ensureEssentialStructure() {
    // Only add missing essential properties, never override existing ones
    if (!this.settings.ui) {
      this.settings.ui = { ...DEFAULT_SETTINGS.ui };
    }
    if (!this.settings.chat) {
      this.settings.chat = { ...DEFAULT_SETTINGS.chat };
    }
    if (!this.settings.general) {
      this.settings.general = { ...DEFAULT_SETTINGS.general };
    }
    if (!this.settings.shortcuts) {
      this.settings.shortcuts = { ...DEFAULT_SETTINGS.shortcuts };
    }
    if (!this.settings.mcpServers) {
      this.settings.mcpServers = [];
    }
    if (!this.settings.internalCommands) {
      this.settings.internalCommands = { ...DEFAULT_SETTINGS.internalCommands };
    }
  }

  /**
   * Update debug logger when debug setting changes
   */
  private updateDebugLogger() {
    // Use service registry to avoid circular dependency
    const debugLogger = serviceRegistry.getService<DebugLoggerInterface>(SERVICE_NAMES.DEBUG_LOGGER);
    if (debugLogger && typeof debugLogger.refreshFromSettings === 'function') {
      debugLogger.refreshFromSettings();
      // No console output - this would create spam
    }
  }

  // Save settings to JSON file via Electron with race condition protection
  private async saveSettingsToFile(): Promise<boolean> {
    // ALWAYS SAVE - No conditions that prevent saving
    console.log('🔍 saveSettingsToFile called (ALWAYS SAVE mode)');
    console.log('🔍 Settings to save:', JSON.stringify(this.settings, null, 2));

    try {
      // Always attempt to save, even if Electron API might not be available
      if (typeof window !== 'undefined' && window.electronAPI?.updateAppSettings) {
        console.log('🔍 Calling window.electronAPI.updateAppSettings...');
        const success = await window.electronAPI.updateAppSettings(this.settings);
        console.log('🔍 updateAppSettings returned:', success);

        if (success) {
          console.log('✅ Settings saved to JSON file successfully');
          return true;
        } else {
          console.error('❌ Failed to save settings to JSON file - updateAppSettings returned false');
          // Still return true to indicate we attempted the save (ALWAYS SAVE mode)
          return true;
        }
      } else {
        console.error('❌ Electron API or updateAppSettings not available, but continuing anyway (ALWAYS SAVE mode)');
        // Return true to indicate we attempted the save (ALWAYS SAVE mode)
        return true;
      }
    } catch (error) {
      console.error('❌ Error saving settings to file:', error);
      // Still return true to indicate we attempted the save (ALWAYS SAVE mode)
      return true;
    }
  }

  // Simple method that just calls the file save
  private async saveSettings() {
    return await this.saveSettingsToFile();
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.settings));

    // Refresh debug logger state when settings change
    const debugLogger = serviceRegistry.getService<DebugLoggerInterface>(SERVICE_NAMES.DEBUG_LOGGER);
    if (debugLogger && typeof debugLogger.refreshFromSettings === 'function') {
      debugLogger.refreshFromSettings();
    }
  }

  getSettings(): AppSettings {
    if (!this.initialized) {
      // Wait for initialization instead of returning defaults
      console.warn('⚠️ Settings not yet initialized, waiting...');
      // Return current settings even if not fully initialized to prevent defaults
      return { ...this.settings };
    }
    return { ...this.settings };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Wait for settings to be initialized
   */
  async waitForInitialization(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
  }

  getChatSettings(): ChatSettings {
    if (!this.initialized) {
      // Wait for initialization instead of returning defaults
      console.warn('⚠️ getChatSettings: Not initialized, returning current settings to preserve user data');
      return { ...this.settings.chat };
    }

    // Ensure providers object exists for backward compatibility
    const chatSettings = { ...this.settings.chat };
    if (!chatSettings.providers) {
      console.log('🔍 getChatSettings: No providers found, creating defaults');
      chatSettings.providers = {
        openai: { lastSelectedModel: '' },
        anthropic: { lastSelectedModel: '' },
        gemini: { lastSelectedModel: '' },
        mistral: { lastSelectedModel: '' },
        deepseek: { lastSelectedModel: '' },
        groq: { lastSelectedModel: '' },
        lmstudio: { baseUrl: '', lastSelectedModel: '' },
        ollama: { baseUrl: '', lastSelectedModel: '' },
        openrouter: { lastSelectedModel: '' },
        requesty: { lastSelectedModel: '' },
        replicate: { lastSelectedModel: '' },
        n8n: { baseUrl: '', lastSelectedModel: '' },
      };
    } else {
      // Clean up any legacy API keys that might still be in settings
      Object.entries(chatSettings.providers).forEach(([provider, config]) => {
        if ('apiKey' in config) {
          console.log(`🔄 Removing legacy API key from settings for ${provider}`);
          // Remove apiKey from the config object
          const { apiKey, ...cleanConfig } = config as any;
          chatSettings.providers[provider] = cleanConfig;
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

    // DON'T merge with defaults - use the new settings as-is to preserve user data
    this.settings = { ...newSettings };
    console.log('🔍 Updated settings (no default merge):', JSON.stringify(this.settings, null, 2));
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
    // Wait for initialization to complete
    if (this.initializationPromise) {
      await this.initializationPromise;
    }

    console.log('🔍 updateSettings called with:', JSON.stringify(updates, null, 2));

    // API keys are now handled by secureApiKeyService, not in settings

    // Update settings in memory with deep merge
    const oldSettings = { ...this.settings };

    // Deep merge for nested objects like ui, chat, etc.
    this.settings = { ...this.settings, ...updates };

    // Handle deep merge for ui object
    if (updates.ui) {
      this.settings.ui = { ...this.settings.ui, ...updates.ui };
    }

    // Handle deep merge for chat object
    if (updates.chat) {
      this.settings.chat = { ...this.settings.chat, ...updates.chat };

      // Handle deep merge for providers
      if (updates.chat.providers) {
        this.settings.chat.providers = { ...this.settings.chat.providers, ...updates.chat.providers };
      }
    }

    // Handle deep merge for general object
    if (updates.general) {
      this.settings.general = { ...this.settings.general, ...updates.general };
    }

    console.log('🔍 Settings updated in memory from:', JSON.stringify(oldSettings, null, 2));
    console.log('🔍 Settings updated in memory to:', JSON.stringify(this.settings, null, 2));

    // Save to disk
    console.log('🔍 Calling saveSettingsToFile...');
    const success = await this.saveSettingsToFile();
    console.log('🔍 saveSettingsToFile returned:', success);

    if (success) {
      console.log('🔍 Notifying listeners...');

      // Update debug logger immediately if debug setting changed
      if (updates.general?.debugLogging !== undefined) {
        this.updateDebugLogger();
        // No console output - this would create spam
      }

      // Notify listeners immediately after successful save
      this.notifyListeners();
      console.log('✅ Settings updated and listeners notified');

      // No auto-reload - settings are already updated in memory and saved to disk
      // Components should use the current in-memory settings
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
          // Don't merge with defaults - use saved settings as-is to preserve user data
          this.settings = { ...(savedSettings as AppSettings) };
          this.ensureEssentialStructure(); // Only add missing structure, don't override
          this.notifyListeners();
        }
      } catch (error) {
        console.error('Failed to reload settings for MCP change:', error);
      }
    }
  }

  // Force reload settings from disk (useful after save operations)
  async forceReloadFromDisk(): Promise<void> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        console.log('🔄 Force reloading settings from disk...');
        const savedSettings = await window.electronAPI.getSettings();
        if (savedSettings) {
          console.log('✅ Settings force reloaded from disk');
          // Don't merge with defaults - use saved settings as-is to preserve user data
          this.settings = { ...(savedSettings as AppSettings) };
          this.ensureEssentialStructure(); // Only add missing structure, don't override
          this.notifyListeners();
        }
      } catch (error) {
        console.error('❌ Failed to force reload settings from disk:', error);
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
          mcpServers: imported.mcpServers || DEFAULT_SETTINGS.mcpServers,
          internalCommands: { ...DEFAULT_SETTINGS.internalCommands, ...imported.internalCommands },
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
