export interface ElectronAPI {
  // Clipboard operations
  readClipboard: () => Promise<string>;
  writeClipboard: (text: string) => Promise<void>;

  // Settings operations
  getSettings: () => Promise<any>;
  updateSettings: (settings: any) => Promise<boolean>;

  // App settings operations
  getAppSettings: () => Promise<any>;
  updateAppSettings: (settings: any) => Promise<boolean>;

  // Storage operations
  getStorageItem: (key: string) => Promise<any>;
  setStorageItem: (key: string, value: any) => Promise<boolean>;

  // State file operations (separate from settings)
  getStateFile: (filename: string) => Promise<any>;
  saveStateFile: (filename: string, data: any) => Promise<boolean>;

  // MCP servers operations
  getMCPServers: () => Promise<{ servers: any[]; version: string }>;
  saveMCPServers: (mcpData: { servers: any[]; version: string }) => Promise<boolean>;
  addMCPServer: (server: any) => Promise<any>;
  updateMCPServer: (id: string, updates: any) => Promise<boolean>;
  removeMCPServer: (id: string) => Promise<boolean>;
  connectMCPServer: (serverId: string) => Promise<boolean>;
  disconnectMCPServer: (serverId: string) => Promise<void>;
  disconnectAllMCPServers: () => Promise<void>;
  connectEnabledMCPServers: () => Promise<void>;
  restartMCPServers: () => Promise<void>;
  callMCPTool: (toolName: string, args: any) => Promise<any>;
  readMCPResource: (uri: string) => Promise<any>;
  getMCPPrompt: (name: string, args: any) => Promise<any>;

  // Conversation file operations
  saveConversationToFile: (conversationId: string, conversation: any) => Promise<boolean>;
  saveConversationIndex: (conversationIndex: any[]) => Promise<boolean>;
  loadConversationIndex: () => Promise<any[]>;
  loadConversationFromFile: (conversationId: string) => Promise<any>;
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

  // Window dragging
  startDrag: () => Promise<void>;
  dragWindow: (x: number, y: number, offsetX: number, offsetY: number) => Promise<void>;

  // Overlay windows
  openActionMenu: () => Promise<void>;
  closeActionMenu: () => Promise<void>;
  sendPromptToMain: (promptText: string) => Promise<void>;
  openSettingsOverlay: () => Promise<void>;
  closeSettingsOverlay: () => Promise<void>;
  notifyThemeChange: (themeId: string) => Promise<void>;

  // Dropdown operations
  openDropdown: (x: number, y: number, width: number, height: number, content: string) => Promise<void>;
  closeDropdown: () => Promise<void>;

  // File operations
  selectFiles: (options?: { multiple?: boolean; filters?: Array<{ name: string; extensions: string[] }> }) => Promise<string[]>;
  readFile: (filePath: string) => Promise<{ name: string; content: string; type: string }>;

  // Event listeners
  onSettingsChanged: (callback: (settings: any) => void) => void;
  onPromptReceived: (callback: (prompt: string) => void) => void;
  onThemeChanged: (callback: (themeId: string) => void) => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
