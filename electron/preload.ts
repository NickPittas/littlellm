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

  // Window operations
  hideWindow: () => ipcRenderer.invoke('hide-window'),
  showWindow: () => ipcRenderer.invoke('show-window'),

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
      hideWindow: () => Promise<void>;
      showWindow: () => Promise<void>;
      onClipboardContent: (callback: (content: string) => void) => void;
      onProcessClipboard: (callback: (content: string) => void) => void;
      onOpenSettings: (callback: () => void) => void;
      removeAllListeners: (channel: string) => void;
    };
  }
}
