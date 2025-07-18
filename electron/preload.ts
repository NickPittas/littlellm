import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Clipboard operations
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),
  writeClipboard: (text: string) => ipcRenderer.invoke('write-clipboard', text),

  // Settings operations
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings: any) => ipcRenderer.invoke('update-settings', settings),

  // App settings operations
  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  updateAppSettings: (settings: any) => ipcRenderer.invoke('update-app-settings', settings),

  // Storage operations
  getStorageItem: (key: string) => ipcRenderer.invoke('get-storage-item', key),
  setStorageItem: (key: string, value: any) => ipcRenderer.invoke('set-storage-item', key, value),

  // State file operations (separate from settings)
  getStateFile: (filename: string) => ipcRenderer.invoke('get-state-file', filename),
  saveStateFile: (filename: string, data: any) => ipcRenderer.invoke('save-state-file', filename, data),

  // MCP servers operations
  getMCPServers: () => ipcRenderer.invoke('get-mcp-servers'),
  saveMCPServers: (mcpData: any) => ipcRenderer.invoke('save-mcp-servers', mcpData),
  addMCPServer: (server: any) => ipcRenderer.invoke('add-mcp-server', server),
  updateMCPServer: (id: string, updates: any) => ipcRenderer.invoke('update-mcp-server', id, updates),
  removeMCPServer: (id: string) => ipcRenderer.invoke('remove-mcp-server', id),
  connectMCPServer: (serverId: string) => ipcRenderer.invoke('connect-mcp-server', serverId),
  disconnectMCPServer: (serverId: string) => ipcRenderer.invoke('disconnect-mcp-server', serverId),
  disconnectAllMCPServers: () => ipcRenderer.invoke('disconnect-all-mcp-servers'),
  connectEnabledMCPServers: () => ipcRenderer.invoke('connect-enabled-mcp-servers'),
  callMCPTool: (toolName: string, args: any) => ipcRenderer.invoke('call-mcp-tool', toolName, args),
  readMCPResource: (uri: string) => ipcRenderer.invoke('read-mcp-resource', uri),
  getMCPPrompt: (name: string, args: any) => ipcRenderer.invoke('get-mcp-prompt', name, args),
  getAllMCPTools: () => ipcRenderer.invoke('get-all-mcp-tools'),
  getAllMCPResources: () => ipcRenderer.invoke('get-all-mcp-resources'),
  getAllMCPPrompts: () => ipcRenderer.invoke('get-all-mcp-prompts'),
  getMCPConnectionStatus: () => ipcRenderer.invoke('get-mcp-connection-status'),
  getMCPDetailedStatus: () => ipcRenderer.invoke('get-mcp-detailed-status'),
  getConnectedMCPServerIds: () => ipcRenderer.invoke('get-connected-mcp-server-ids'),

  // macOS MCP server troubleshooting
  fixMacOSMCPServer: (serverId: string) => ipcRenderer.invoke('fix-macos-mcp-server', serverId),
  validateMCPServer: (serverId: string) => ipcRenderer.invoke('validate-mcp-server', serverId),

  // Conversation file operations
  saveConversationToFile: (conversationId: string, conversation: any) => ipcRenderer.invoke('save-conversation-to-file', conversationId, conversation),
  saveConversationIndex: (conversationIndex: any[]) => ipcRenderer.invoke('save-conversation-index', conversationIndex),
  loadConversationIndex: () => ipcRenderer.invoke('load-conversation-index'),
  loadConversationFromFile: (conversationId: string) => ipcRenderer.invoke('load-conversation-from-file', conversationId),
  getAllConversationIds: () => ipcRenderer.invoke('get-all-conversation-ids'),

  // Memory operations
  saveMemoryIndex: (memoryIndex: any) => ipcRenderer.invoke('save-memory-index', memoryIndex),
  loadMemoryIndex: () => ipcRenderer.invoke('load-memory-index'),
  saveMemoryEntry: (memoryEntry: any) => ipcRenderer.invoke('save-memory-entry', memoryEntry),
  loadMemoryEntry: (memoryId: string) => ipcRenderer.invoke('load-memory-entry', memoryId),
  deleteMemoryEntry: (memoryId: string) => ipcRenderer.invoke('delete-memory-entry', memoryId),
  getMemoryStats: () => ipcRenderer.invoke('get-memory-stats'),

  // Memory export/import operations
  saveMemoryExport: (exportData: any, filename: string) => ipcRenderer.invoke('save-memory-export', exportData, filename),
  loadMemoryExport: () => ipcRenderer.invoke('load-memory-export'),

  // Window operations
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  showWindow: () => ipcRenderer.invoke('show-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
  resizeWindow: (width: number, height: number) => ipcRenderer.invoke('resize-window', width, height),
  getCurrentWindowSize: () => ipcRenderer.invoke('get-current-window-size'),
  getWindowPosition: () => ipcRenderer.invoke('get-window-position'),
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),

  // Window dragging is now handled by CSS -webkit-app-region
  // No IPC methods needed for CSS-based dragging

  // Overlay windows
  openActionMenu: () => ipcRenderer.invoke('open-action-menu'),
  closeActionMenu: () => ipcRenderer.invoke('close-action-menu'),
  sendPromptToMain: (promptText: string) => ipcRenderer.invoke('send-prompt-to-main', promptText),
  openSettingsOverlay: () => ipcRenderer.invoke('open-settings-overlay'),
  closeSettingsOverlay: () => ipcRenderer.invoke('close-settings-overlay'),
  openChatWindow: () => ipcRenderer.invoke('open-chat-window'),
  closeChatWindow: () => ipcRenderer.invoke('close-chat-window'),
  syncMessagesToChat: (messages: any[]) => ipcRenderer.invoke('sync-messages-to-chat', messages),
  requestCurrentMessages: () => ipcRenderer.invoke('request-current-messages'),
  notifyThemeChange: (themeId: string) => ipcRenderer.invoke('notify-theme-change', themeId),

  // Dropdown operations
  openDropdown: (x: number, y: number, width: number, height: number, content: string) =>
    ipcRenderer.invoke('open-dropdown', { x, y, width, height, content }),
  closeDropdown: () => ipcRenderer.invoke('close-dropdown'),
  selectDropdownItem: (value: string) => ipcRenderer.invoke('select-dropdown-item', value),

  // History window operations
  openHistory: (conversations: any[]) => ipcRenderer.invoke('open-history', { conversations }),
  closeHistory: () => ipcRenderer.invoke('close-history'),
  selectHistoryItem: (conversationId: string) => ipcRenderer.invoke('select-history-item', conversationId),
  deleteHistoryItem: (conversationId: string) => ipcRenderer.invoke('delete-history-item', conversationId),
  clearAllHistory: () => ipcRenderer.invoke('clear-all-history'),

  // Event listeners
  onClipboardContent: (callback: (content: string) => void) => {
    ipcRenderer.on('clipboard-content', (_, content) => callback(content));
  },

  onProcessClipboard: (callback: (content: string) => void) => {
    ipcRenderer.on('process-clipboard', (_, content) => callback(content));
  },

  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on('open-settings', () => callback());
  },

  onThemeChanged: (callback: (themeId: string) => void) => {
    ipcRenderer.on('theme-changed', (_, themeId) => callback(themeId));
  },

  onPromptSelected: (callback: (promptText: string) => void) => {
    ipcRenderer.on('prompt-selected', (_, promptText) => callback(promptText));
  },

  onMessagesUpdate: (callback: (messages: any[]) => void) => {
    ipcRenderer.on('messages-update', (_, messages) => callback(messages));
  },

  onRequestCurrentMessages: (callback: () => void) => {
    ipcRenderer.on('request-current-messages', () => callback());
  },

  onDropdownItemSelected: (callback: (value: string) => void) => {
    ipcRenderer.on('dropdown-item-selected', (_, value) => callback(value));
  },

  onHistoryItemSelected: (callback: (conversationId: string) => void) => {
    ipcRenderer.on('history-item-selected', (_, conversationId) => callback(conversationId));
  },

  onHistoryItemDeleted: (callback: (conversationId: string) => void) => {
    ipcRenderer.on('history-item-deleted', (_, conversationId) => callback(conversationId));
  },

  onClearAllHistory: (callback: () => void) => {
    ipcRenderer.on('clear-all-history', () => callback());
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Tab change listener for settings overlay
  onTabChange: (callback: (tab: string) => void) => {
    const listener = (_: any, tab: string) => callback(tab);
    ipcRenderer.on('change-settings-tab', listener);
    return listener;
  },

  removeTabChangeListener: (listener: any) => {
    ipcRenderer.removeListener('change-settings-tab', listener);
  }
});

// Type definitions are now in src/types/electron.d.ts
