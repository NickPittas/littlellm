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

  // Secure API Key operations
  getSecureApiKeys: () => Promise<Record<string, { apiKey: string; baseUrl?: string; lastSelectedModel?: string }>>;
  setSecureApiKeys: (apiKeys: Record<string, { apiKey: string; baseUrl?: string; lastSelectedModel?: string }>) => Promise<boolean>;

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
  fixMacOSMCPServer: (serverId: string) => Promise<{ success: boolean; message: string }>;
  validateMCPServer: (serverId: string) => Promise<{ valid: boolean; error?: string; fixedCommand?: string }>;

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
  getWindowPosition: () => Promise<{ x: number; y: number }>;
  takeScreenshot: () => Promise<{ success: boolean; dataURL?: string; error?: string }>;
  setWindowBackgroundColor: (backgroundColor: string) => Promise<boolean>;

  // Window dragging
  startDrag: () => (() => void);
  setWindowPosition: (x: number, y: number) => Promise<void>;
  getChatWindowPosition: () => Promise<{ x: number; y: number }>;
  setChatWindowPosition: (x: number, y: number) => Promise<void>;

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
  syncKnowledgeBaseSearch: (isSearching: boolean, query?: string) => Promise<void>;
  openExternal: (url: string) => Promise<{success: boolean, error?: string}>;
  notifyThemeChange: (themeData: { customColors: unknown; useCustomColors: boolean }) => Promise<void>;

  // Console window
  toggleConsoleWindow: () => Promise<void>;
  getCurrentTheme: () => Promise<{ customColors: Record<string, string>; useCustomColors: boolean } | null>;

  // Dropdown operations
  openDropdown: (x: number, y: number, width: number, height: number, content: string) => Promise<void>;
  closeDropdown: () => Promise<void>;
  selectDropdownItem: (value: string) => Promise<void>;
  onDropdownItemSelected?: (callback: (value: string) => void) => void;

  // File operations
  selectFiles: (options?: { multiple?: boolean; filters?: Array<{ name: string; extensions: string[] }>; properties?: string[] }) => Promise<string[]>;
  readFile: (filePath: string) => Promise<{ success: boolean; content?: string; name?: string; type?: string; error?: string }>;
  selectDirectory: () => Promise<string | null>;

  // Event listeners
  onSettingsChanged: (callback: (settings: unknown) => void) => void;
  onPromptReceived: (callback: (prompt: string) => void) => void;
  onPromptSelected?: (callback: (promptText: string) => void) => void;
  onThemeChanged: (callback: (themeId: string) => void) => void;
  onThemeChange: (callback: (themeData: { customColors: unknown; useCustomColors: boolean }) => void) => any;
  removeThemeChangeListener?: (wrappedCallback: any) => void;
  onMessagesUpdate?: (callback: (messages: unknown[]) => void) => void;
  onKnowledgeBaseSearchUpdate?: (callback: (data: {isSearching: boolean, query?: string}) => void) => void;
  onRequestCurrentMessages: (callback: () => void) => void;
  onClipboardContent?: (callback: (content: string) => void) => void;
  onProcessClipboard?: (callback: (content: string) => void) => void;
  onOpenSettings?: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;

  // Memory operations
  loadMemoryIndex: () => Promise<MemoryIndex>;
  saveMemoryIndex: (index: MemoryIndex) => Promise<boolean>;
  loadMemoryEntry: (id: string) => Promise<MemoryEntry>;
  saveMemoryEntry: (entry: MemoryEntry) => Promise<boolean>;
  deleteMemoryEntry: (id: string) => Promise<boolean>;
  getMemoryStats: () => Promise<{ totalSize: number; entryCount: number }>;

  // Memory export/import operations
  saveMemoryExport: (exportData: unknown, filename: string) => Promise<boolean>;
  loadMemoryExport: () => Promise<unknown>;

  // Tab change listener for settings overlay
  onTabChange?: (callback: (tab: string) => void) => unknown;
  removeTabChangeListener?: (listener: unknown) => void;

  // Knowledge Base operations
  addDocument: (filePath: string) => Promise<{ success: boolean; error?: string }>;
  addDocumentsBatch: (filePaths: string[]) => Promise<{ success: boolean; results?: Array<{filePath: string, success: boolean, error?: string}>; summary?: string; error?: string }>;
  addDocumentFromUrl: (url: string) => Promise<{ success: boolean; error?: string }>;
  removeDocument: (documentId: string) => Promise<{ success: boolean; error?: string }>;
  getDocuments: () => Promise<{ success: boolean; documents: string[]; error?: string }>;
  getDocumentsWithMetadata: () => Promise<{ success: boolean; documents: Array<{source: string, metadata: Record<string, unknown>, chunkCount: number, addedAt?: string}>; error?: string }>;
  searchKnowledgeBase: (query: string, limit?: number) => Promise<{ success: boolean; results: Array<{text: string, source: string, score?: number}>; error?: string }>;
  exportKnowledgeBase: () => Promise<{ success: boolean; filePath?: string; stats?: {totalRecords: number, totalDocuments: number, exportSize: number, exportTime: number}; error?: string }>;
  importKnowledgeBase: (options?: {mode: 'replace' | 'merge'}) => Promise<{ success: boolean; stats?: {importedRecords: number, importedDocuments: number, skippedRecords: number, importTime: number}; filePath?: string; error?: string }>;
  getKnowledgeBaseStats: () => Promise<{ success: boolean; stats?: {totalRecords: number, totalDocuments: number, databaseSize: number}; error?: string }>;
  openFileDialog: () => Promise<string | null>;
  openKnowledgebaseFileDialog: () => Promise<string[]>;

  // Progress monitoring
  onExportProgress: (callback: (progress: {step: string, current: number, total: number, message: string}) => void) => () => void;
  onImportProgress: (callback: (progress: {step: string, current: number, total: number, message: string}) => void) => () => void;
  onBatchProgress: (callback: (progress: {step: string, message: string, fileIndex: number, totalFiles: number, fileName: string, chunkCount?: number, status: 'processing' | 'success' | 'error', error?: string}) => void) => () => void;

  // Internal Commands operations
  setInternalCommandsConfig: (config: unknown) => Promise<boolean>;
  getInternalCommandsTools: () => Promise<unknown[]>;
  executeInternalCommand: (toolName: string, args: unknown) => Promise<unknown>;
  isInternalCommandsEnabled: () => Promise<boolean>;

  // History operations
  openHistory: (conversations: unknown[]) => Promise<void>;
  closeHistory: () => Promise<void>;
  selectHistoryItem: (conversationId: string) => void;
  deleteHistoryItem: (conversationId: string) => void;
  clearAllHistory: () => void;
  onHistoryItemSelected: (callback: (conversationId: string) => void) => void;
  onHistoryItemDeleted: (callback: (conversationId: string) => void) => void;
  onClearAllHistory: (callback: () => void) => void;

  // External link operations
  openExternalLink: (url: string) => Promise<{ success: boolean; error?: string }>;

  // State file operations
  getStateFile: (filename: string) => Promise<unknown>;
  saveStateFile: (filename: string, data: unknown) => Promise<boolean>;

  // Transparency operations
  setTransparency?: (enabled: boolean) => Promise<void>;
  setOpacity?: (opacity: number) => Promise<void>;
  setVibrancyType?: (type: string) => Promise<void>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
