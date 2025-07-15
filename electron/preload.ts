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
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),

  // Window dragging
  startDrag: () => ipcRenderer.invoke('start-drag'),
  dragWindow: (x: number, y: number, offsetX: number, offsetY: number) =>
    ipcRenderer.invoke('drag-window', { x, y, offsetX, offsetY }),

  // Overlay windows
  openActionMenu: () => ipcRenderer.invoke('open-action-menu'),
  closeActionMenu: () => ipcRenderer.invoke('close-action-menu'),
  sendPromptToMain: (promptText: string) => ipcRenderer.invoke('send-prompt-to-main', promptText),
  openSettingsOverlay: () => ipcRenderer.invoke('open-settings-overlay'),
  closeSettingsOverlay: () => ipcRenderer.invoke('close-settings-overlay'),
  notifyThemeChange: (themeId: string) => ipcRenderer.invoke('notify-theme-change', themeId),

  // Dropdown operations
  openDropdown: (x: number, y: number, width: number, height: number, content: string) =>
    ipcRenderer.invoke('open-dropdown', { x, y, width, height, content }),
  closeDropdown: () => ipcRenderer.invoke('close-dropdown'),
  selectDropdownItem: (value: string) => ipcRenderer.invoke('select-dropdown-item', value),

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

  onDropdownItemSelected: (callback: (value: string) => void) => {
    ipcRenderer.on('dropdown-item-selected', (_, value) => callback(value));
  },

  // Remove listeners
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      readClipboard: () => Promise<string>;
      writeClipboard: (text: string) => Promise<void>;
      getSettings: () => Promise<any>;
      updateSettings: (settings: any) => Promise<void>;
      getAppSettings: () => Promise<any>;
      updateAppSettings: (settings: any) => Promise<boolean>;
      getStorageItem: (key: string) => Promise<any>;
      setStorageItem: (key: string, value: any) => Promise<void>;
      saveConversationToFile: (conversationId: string, conversation: any) => Promise<boolean>;
      saveConversationIndex: (conversationIndex: any[]) => Promise<boolean>;
      hideWindow: () => Promise<void>;
      showWindow: () => Promise<void>;
      closeWindow: () => Promise<void>;
      minimizeWindow: () => Promise<void>;
      maximizeWindow: () => Promise<void>;
      resizeWindow: (width: number, height: number) => Promise<void>;
      getCurrentWindowSize: () => Promise<{ width: number; height: number }>;
      takeScreenshot: () => Promise<{ success: boolean; dataURL?: string; error?: string }>;
      startDrag: () => Promise<{ offsetX: number; offsetY: number } | null>;
      dragWindow: (x: number, y: number, offsetX: number, offsetY: number) => Promise<void>;
      openActionMenu: () => Promise<void>;
      closeActionMenu: () => Promise<void>;
      sendPromptToMain: (promptText: string) => Promise<void>;
      openSettingsOverlay: () => Promise<void>;
      closeSettingsOverlay: () => Promise<void>;
      notifyThemeChange: (themeId: string) => Promise<void>;
      openDropdown: (x: number, y: number, width: number, height: number, content: string) => Promise<void>;
      closeDropdown: () => Promise<void>;
      selectDropdownItem: (value: string) => Promise<void>;
      onDropdownItemSelected: (callback: (value: string) => void) => void;
      onClipboardContent: (callback: (content: string) => void) => void;
      onProcessClipboard: (callback: (content: string) => void) => void;
      onOpenSettings: (callback: () => void) => void;
      onThemeChanged: (callback: (themeId: string) => void) => void;
      onPromptSelected: (callback: (promptText: string) => void) => void;
      removeAllListeners: (channel: string) => void;

      // MCP operations
      getMCPServers: () => Promise<any>;
      saveMCPServers: (mcpData: any) => Promise<boolean>;
      addMCPServer: (server: any) => Promise<any>;
      updateMCPServer: (id: string, updates: any) => Promise<boolean>;
      removeMCPServer: (id: string) => Promise<boolean>;
      connectMCPServer: (serverId: string) => Promise<boolean>;
      disconnectMCPServer: (serverId: string) => Promise<void>;
      disconnectAllMCPServers: () => Promise<void>;
      connectEnabledMCPServers: () => Promise<void>;
      callMCPTool: (toolName: string, args: any) => Promise<any>;
      readMCPResource: (uri: string) => Promise<any>;
      getMCPPrompt: (name: string, args: any) => Promise<any>;
      getAllMCPTools: () => Promise<any[]>;
      getAllMCPResources: () => Promise<any[]>;
      getAllMCPPrompts: () => Promise<any[]>;
      getMCPConnectionStatus: () => Promise<Record<string, boolean>>;
      getMCPDetailedStatus: () => Promise<any>;
      getConnectedMCPServerIds: () => Promise<string[]>;
    };
  }
}
