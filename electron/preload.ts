/* eslint-disable @typescript-eslint/no-explicit-any */
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

  // Secure API Key operations
  getSecureApiKeys: () => ipcRenderer.invoke('get-secure-api-keys'),
  setSecureApiKeys: (apiKeys: any) => ipcRenderer.invoke('set-secure-api-keys', apiKeys),

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

  // Knowledge Base operations
  addDocument: (filePath: string) => ipcRenderer.invoke('knowledge-base:add-document', filePath),
  addDocumentsBatch: (filePaths: string[]) => ipcRenderer.invoke('knowledge-base:add-documents-batch', filePaths),
  addDocumentFromUrl: (url: string) => ipcRenderer.invoke('knowledge-base:add-document-from-url', url),
  removeDocument: (documentId: string) => ipcRenderer.invoke('knowledge-base:remove-document', documentId),
  getDocuments: () => ipcRenderer.invoke('knowledge-base:get-documents'),
  getDocumentsWithMetadata: () => ipcRenderer.invoke('knowledge-base:get-documents-with-metadata'),
  searchKnowledgeBase: (query: string, limit?: number) => ipcRenderer.invoke('knowledge-base:search', query, limit),
  openFileDialog: () => ipcRenderer.invoke('dialog:open-file'),
  openKnowledgebaseFileDialog: () => ipcRenderer.invoke('dialog:open-knowledgebase-files'),
  selectFiles: (options?: { multiple?: boolean; filters?: Array<{ name: string; extensions: string[] }>; properties?: string[] }) =>
    ipcRenderer.invoke('select-files', options),

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
  setWindowPosition: (x: number, y: number) => ipcRenderer.invoke('set-window-position', x, y),
  getChatWindowPosition: () => ipcRenderer.invoke('get-chat-window-position'),
  setChatWindowPosition: (x: number, y: number) => ipcRenderer.invoke('set-chat-window-position', x, y),
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  setWindowBackgroundColor: (backgroundColor: string) => ipcRenderer.invoke('set-window-background-color', backgroundColor),

  // Window dragging for frameless windows
  startDrag: () => {
    // Get the current mouse position
    let mouseX = 0;
    let mouseY = 0;
    let windowX = 0;
    let windowY = 0;
    let isDragging = false;

    const handleMouseDown = (e: MouseEvent) => {
      // Check if the click is on the draggable title bar
      const target = e.target as HTMLElement;
      if (target.closest('.draggable-title-bar')) {
        isDragging = true;
        mouseX = e.screenX;
        mouseY = e.screenY;

        // Determine which window we're in based on URL
        const isInChatWindow = window.location.search.includes('overlay=chat');

        // Get current window position
        if (isInChatWindow) {
          ipcRenderer.invoke('get-chat-window-position').then((pos: { x: number; y: number }) => {
            windowX = pos.x;
            windowY = pos.y;
          });
        } else {
          ipcRenderer.invoke('get-window-position').then((pos: { x: number; y: number }) => {
            windowX = pos.x;
            windowY = pos.y;
          });
        }

        e.preventDefault();
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.screenX - mouseX;
      const deltaY = e.screenY - mouseY;

      // Determine which window we're in based on URL
      const isInChatWindow = window.location.search.includes('overlay=chat');

      // Update window position
      if (isInChatWindow) {
        ipcRenderer.invoke('set-chat-window-position', windowX + deltaX, windowY + deltaY);
      } else {
        ipcRenderer.invoke('set-window-position', windowX + deltaX, windowY + deltaY);
      }
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    // Add event listeners
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Return cleanup function
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  },

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
  notifyThemeChange: (themeData: { customColors: any; useCustomColors: boolean }) => ipcRenderer.invoke('notify-theme-change', themeData),
  getCurrentTheme: () => ipcRenderer.invoke('get-current-theme'),

  // Dropdown operations
  openDropdown: (x: number, y: number, width: number, height: number, content: string) =>
    ipcRenderer.invoke('open-dropdown', { x, y, width, height, content }),
  closeDropdown: () => ipcRenderer.invoke('close-dropdown'),
  selectDropdownItem: (value: string) => ipcRenderer.invoke('select-dropdown-item', value),

  // History window operations
  openHistory: (conversations: any[]) => ipcRenderer.invoke('open-history', conversations),
  closeHistory: () => ipcRenderer.invoke('close-history'),

  // External link operations
  openExternalLink: (url: string) => ipcRenderer.invoke('open-external-link', url),
  
  // History action methods (called from history window to send events)
  selectHistoryItem: (conversationId: string) => ipcRenderer.send('history-item-selected', conversationId),
  deleteHistoryItem: (conversationId: string) => ipcRenderer.send('history-item-deleted', conversationId),
  clearAllHistory: () => ipcRenderer.send('clear-all-history'),
  
  // History event handlers (called from history window)
  onHistoryItemSelected: (callback: (conversationId: string) => void) => {
    ipcRenderer.on('history-item-selected', (_: any, conversationId: string) => callback(conversationId));
  },
  onHistoryItemDeleted: (callback: (conversationId: string) => void) => {
    ipcRenderer.on('history-item-deleted', (_: any, conversationId: string) => callback(conversationId));
  },
  onClearAllHistory: (callback: () => void) => {
    ipcRenderer.on('clear-all-history', () => callback());
  },

  // Event listeners
  onClipboardContent: (callback: (content: string) => void) => {
    ipcRenderer.on('clipboard-content', (_: any, content: string) => callback(content));
  },

  onProcessClipboard: (callback: (content: string) => void) => {
    ipcRenderer.on('process-clipboard', (_: any, content: string) => callback(content));
  },

  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on('open-settings', () => callback());
  },

  onThemeChanged: (callback: (themeId: string) => void) => {
    ipcRenderer.on('theme-changed', (_: any, themeId: string) => callback(themeId));
  },

  onThemeChange: (callback: (themeData: { customColors: unknown; useCustomColors: boolean }) => void) => {
    const wrappedCallback = (_: any, themeData: { customColors: unknown; useCustomColors: boolean }) => callback(themeData);
    ipcRenderer.on('theme-change', wrappedCallback);
    return wrappedCallback; // Return the wrapped callback for removal
  },

  removeThemeChangeListener: (wrappedCallback: any) => {
    ipcRenderer.removeListener('theme-change', wrappedCallback);
  },

  onPromptSelected: (callback: (promptText: string) => void) => {
    ipcRenderer.on('prompt-selected', (_: any, promptText: string) => callback(promptText));
  },

  onMessagesUpdate: (callback: (messages: any[]) => void) => {
    ipcRenderer.on('messages-update', (_: any, messages: any[]) => callback(messages));
  },

  onRequestCurrentMessages: (callback: () => void) => {
    ipcRenderer.on('request-current-messages', () => callback());
  },

  onDropdownItemSelected: (callback: (value: string) => void) => {
    ipcRenderer.on('dropdown-item-selected', (_: any, value: string) => callback(value));
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
  },

  // Internal Commands operations
  setInternalCommandsConfig: (config: unknown) => ipcRenderer.invoke('internal-commands:set-config', config),
  getInternalCommandsTools: () => ipcRenderer.invoke('internal-commands:get-tools'),
  executeInternalCommand: (toolName: string, args: unknown) => ipcRenderer.invoke('internal-commands:execute', { toolName, args }),
  isInternalCommandsEnabled: () => ipcRenderer.invoke('internal-commands:is-enabled'),

  // Debug Logging operations
  writeDebugLog: (logLine: string) => ipcRenderer.invoke('write-debug-log', logLine),
  clearDebugLog: () => ipcRenderer.invoke('clear-debug-log'),
  readDebugLog: () => ipcRenderer.invoke('read-debug-log')
});

// Type definitions are now in src/types/electron.d.ts
