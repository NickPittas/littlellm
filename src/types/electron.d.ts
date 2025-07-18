import { MemoryEntry, MemoryIndex } from './memory';

export interface ElectronAPI {
  // Clipboard operations
  readClipboard: () => Promise<string>;
  writeClipboard: (text: string) => Promise<void>;

  // Settings operations
  getSettings: () => Promise<unknown>;
  updateSettings: (settings: unknown) => Promise<boolean>;

  // App settings operations
  getAppSettings: () => Promise<unknown>;
  updateAppSettings: (settings: unknown) => Promise<boolean>;

  // Storage operations
  getStorageItem: (key: string) => Promise<unknown>;
  setStorageItem: (key: string, value: unknown) => Promise<boolean>;

  // State file operations (separate from settings)
  getStateFile: (filename: string) => Promise<unknown>;
  saveStateFile: (filename: string, data: unknown) => Promise<boolean>;

  // MCP servers operations
  getMCPServers: () => Promise<{ servers: unknown[]; version: string }>;
  saveMCPServers: (mcpData: { servers: unknown[]; version: string }) => Promise<boolean>;
  addMCPServer: (server: unknown) => Promise<unknown>;
  updateMCPServer: (id: string, updates: unknown) => Promise<boolean>;
  removeMCPServer: (id: string) => Promise<boolean>;
  connectMCPServer: (serverId: string) => Promise<boolean>;
  disconnectMCPServer: (serverId: string) => Promise<void>;
  disconnectAllMCPServers: () => Promise<void>;
  connectEnabledMCPServers: () => Promise<void>;
  callMCPTool: (toolName: string, args: unknown) => Promise<unknown>;
  readMCPResource: (uri: string) => Promise<unknown>;
  getMCPPrompt: (name: string, args: unknown) => Promise<unknown>;
  getAllMCPTools: () => Promise<unknown[]>;
  getAllMCPResources: () => Promise<unknown[]>;
  getAllMCPPrompts: () => Promise<unknown[]>;
  getMCPConnectionStatus: () => Promise<Record<string, boolean>>;
  getMCPDetailedStatus: () => Promise<unknown>;
  getConnectedMCPServerIds: () => Promise<string[]>;

  // Conversation file operations
  saveConversationToFile: (conversationId: string, conversation: unknown) => Promise<boolean>;
  saveConversationIndex: (conversationIndex: unknown[]) => Promise<boolean>;
  loadConversationIndex: () => Promise<unknown[]>;
  loadConversationFromFile: (conversationId: string) => Promise<unknown>;
  getAllConversationIds: () => Promise<string[]>;

  // Window operations
  hideWindow: () => Promise<void>;
  showWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  minimizeWindow: () => Promise<void>;
  maximizeWindow: () => Promise<void>;
  resizeWindow: (width: number, height: number) => Promise<void>;
  getCurrentWindowSize: () => Promise<{ width: number; height: number }>;
  takeScreenshot: () => Promise<string>;

  // Window dragging is now handled by CSS -webkit-app-region
  // No methods needed for CSS-based dragging

  // Overlay windows
  openActionMenu: () => Promise<void>;
  closeActionMenu: () => Promise<void>;
  sendPromptToMain: (promptText: string) => Promise<void>;
  openSettingsOverlay: () => Promise<void>;
  closeSettingsOverlay: () => Promise<void>;
  openChatWindow: () => Promise<void>;
  closeChatWindow: () => Promise<void>;
  syncMessagesToChat: (messages: unknown[]) => Promise<void>;
  requestCurrentMessages: () => Promise<void>;
  notifyThemeChange: (themeId: string) => Promise<void>;

  // Dropdown operations
  openDropdown: (x: number, y: number, width: number, height: number, content: string) => Promise<void>;
  closeDropdown: () => Promise<void>;

  // File operations
  selectFiles: (options?: { multiple?: boolean; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string[]>;
  readFile: (filePath: string) => Promise<{ name: string; content: string; type: string }>;

  // Event listeners
  onSettingsChanged: (callback: (settings: unknown) => void) => void;
  onPromptReceived: (callback: (prompt: string) => void) => void;
  onThemeChanged: (callback: (themeId: string) => void) => void;
  onMessagesUpdate: (callback: (messages: unknown[]) => void) => void;
  onRequestCurrentMessages: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;

  // Memory operations
  loadMemoryIndex: () => Promise<MemoryIndex>;
  saveMemoryIndex: (index: MemoryIndex) => Promise<boolean>;
  loadMemoryEntry: (id: string) => Promise<MemoryEntry>;
  saveMemoryEntry: (entry: MemoryEntry) => Promise<boolean>;
  deleteMemoryEntry: (id: string) => Promise<boolean>;
  getMemoryStats: () => Promise<{ totalSize: number; entryCount: number }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
