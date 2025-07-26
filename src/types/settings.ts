/**
 * Shared type definitions for settings across the application
 */

export interface ProviderSettings {
  apiKey: string;
  lastSelectedModel?: string;
  baseUrl?: string;
  enabled?: boolean;
}

export interface ProvidersConfig {
  [key: string]: ProviderSettings;
  openai: ProviderSettings;
  anthropic: ProviderSettings;
  gemini: ProviderSettings;
  mistral: ProviderSettings;
  deepseek: ProviderSettings;
  groq: ProviderSettings;
  lmstudio: ProviderSettings;
  ollama: ProviderSettings;
  requesty: ProviderSettings;
  n8n: ProviderSettings;
}

export interface ChatSettings {
  provider: string;
  model: string;
  defaultModel?: string;
  defaultProvider?: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  toolCallingEnabled: boolean;
  ragEnabled?: boolean;
  providers: ProvidersConfig;
  projectId?: string; // Add project ID for memory context
}

export interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  description?: string;
  enabled: boolean;
  env?: Record<string, string>;
}

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

export interface UISettings {
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
}

export interface InternalCommandSettings {
  enabled: boolean;
  allowedDirectories: string[];
  blockedCommands: string[];
  fileReadLineLimit: number;
  fileWriteLineLimit: number;
  defaultShell: string;
  enabledCommands: {
    terminal: boolean;
    filesystem: boolean;
    textEditing: boolean;
    system: boolean;
  };
  enabledTools?: Record<string, boolean>; // Individual tool toggles
  terminalSettings: {
    defaultTimeout: number;
    maxProcesses: number;
    allowInteractiveShells: boolean;
  };
}

export interface AppSettings {
  chat: ChatSettings;
  mcpServers: MCPServerConfig[];
  internalCommands: InternalCommandSettings;
  ui: UISettings;
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
    debugLogging: boolean; // Enable/disable debug logging
  };
}
