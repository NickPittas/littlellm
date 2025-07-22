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

export interface AppSettings {
  chat: ChatSettings;
  mcpServers: MCPServerConfig[];
  theme?: string;
  windowSettings?: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
}
