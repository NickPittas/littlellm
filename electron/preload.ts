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

  // Conversation file operations
  saveConversationToFile: (conversationId: string, conversation: any) => ipcRenderer.invoke('save-conversation-to-file', conversationId, conversation),
  saveConversationIndex: (conversationIndex: any[]) => ipcRenderer.invoke('save-conversation-index', conversationIndex),

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
      onClipboardContent: (callback: (content: string) => void) => void;
      onProcessClipboard: (callback: (content: string) => void) => void;
      onOpenSettings: (callback: () => void) => void;
      onThemeChanged: (callback: (themeId: string) => void) => void;
      onPromptSelected: (callback: (promptText: string) => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
