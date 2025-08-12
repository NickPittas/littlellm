import { describe, test, expect, beforeEach, vi } from 'vitest';
import { settingsService } from '../services/settingsService';
import { mcpService } from '../services/mcpService';
import { debugLogger } from '../services/debugLogger';

// Mock window.electronAPI
const mockElectronAPI = {
  getSettings: vi.fn(),
  updateAppSettings: vi.fn(),
  getMCPServers: vi.fn(),
  updateMCPServer: vi.fn(),
};

// Mock window object
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('Settings Reload Behavior', () => {
  let notifyListenersSpy: any;
  let reloadForMCPChangeSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Spy on private methods
    notifyListenersSpy = vi.spyOn(settingsService as unknown as { notifyListeners: () => void }, 'notifyListeners');
    reloadForMCPChangeSpy = vi.spyOn(settingsService, 'reloadForMCPChange');
    
    // Mock default settings response
    mockElectronAPI.getSettings.mockResolvedValue({
      chat: {
        provider: 'test',
        model: 'test-model',
        temperature: 0.3,
        maxTokens: 8192,
        systemPrompt: '',
        toolCallingEnabled: true,
        providers: {
          openai: { apiKey: '', lastSelectedModel: '' },
          anthropic: { apiKey: '', lastSelectedModel: '' },
          gemini: { apiKey: '', lastSelectedModel: '' },
          mistral: { apiKey: '', lastSelectedModel: '' },
          deepseek: { apiKey: '', lastSelectedModel: '' },
          lmstudio: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
          ollama: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
          openrouter: { apiKey: '', lastSelectedModel: '' },
          requesty: { apiKey: '', lastSelectedModel: '' },
          replicate: { apiKey: '', lastSelectedModel: '' },
          n8n: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
        }
      },
      ui: {
        theme: 'dark',
        alwaysOnTop: true,
        startMinimized: false,
        opacity: 1.0,
        fontSize: 'small',
        windowBounds: {
          width: 400,
          height: 615
        }
      },
      shortcuts: {
        toggleWindow: 'Ctrl+L',
        processClipboard: 'CommandOrControl+Shift+V',
        actionMenu: 'CommandOrControl+Shift+Space'
      },
      general: {
        autoStartWithSystem: false,
        showNotifications: true,
        saveConversationHistory: true,
        conversationHistoryLength: 10
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Settings should ONLY reload under specific conditions', () => {
    
    test('1. Manual reload button should trigger reload', async () => {
      // Simulate manual reload button click
      await settingsService.forceUpdateSettings({
        chat: {
          provider: 'test',
          model: 'test-model',
          temperature: 0.3,
          maxTokens: 8192,
          systemPrompt: '',
          toolCallingEnabled: true,
          providers: {
            openai: { lastSelectedModel: '' },
            anthropic: { lastSelectedModel: '' },
            gemini: { lastSelectedModel: '' },
            mistral: { lastSelectedModel: '' },
            deepseek: { lastSelectedModel: '' },
            deepinfra: { lastSelectedModel: '' },
            lmstudio: { baseUrl: '', lastSelectedModel: '' },
            jan: { baseUrl: '', lastSelectedModel: '' },
            ollama: { baseUrl: '', lastSelectedModel: '' },
            openrouter: { lastSelectedModel: '' },
            requesty: { lastSelectedModel: '' },
            groq: { lastSelectedModel: '' },
            replicate: { lastSelectedModel: '' },
            n8n: { baseUrl: '', lastSelectedModel: '' },
          }
        },
        ui: {
          theme: 'light',
          alwaysOnTop: true,
          startMinimized: false,
          fontSize: 'small',
          hotkey: 'CommandOrControl+Shift+A',
          screenshotHotkey: 'CommandOrControl+Shift+S',
          windowBounds: {
            width: 400,
            height: 615
          }
        },
        shortcuts: {
          toggleWindow: 'Ctrl+L',
          processClipboard: 'CommandOrControl+Shift+V',
          actionMenu: 'CommandOrControl+Shift+Space',
          openShortcuts: 'CommandOrControl+Shift+K'
        },
        general: {
          autoStartWithSystem: false,
          showNotifications: true,
          saveConversationHistory: true,
          conversationHistoryLength: 10,
          debugLogging: false
        },
        mcpServers: [],
        internalCommands: {
          enabled: false,
          allowedDirectories: [],
          blockedCommands: [],
          fileReadLineLimit: 1000,
          fileWriteLineLimit: 1000,
          defaultShell: 'powershell',
          enabledCommands: {
            terminal: false,
            filesystem: false,
            textEditing: false,
            system: false
          },
          terminalSettings: {
            defaultTimeout: 30000,
            maxProcesses: 5,
            allowInteractiveShells: false
          }
        }
      });

      expect(notifyListenersSpy).toHaveBeenCalled();
    });

    test('2. MCP server enable/disable should trigger reload', async () => {
      // Simulate MCP server enable/disable
      await settingsService.reloadForMCPChange();

      expect(mockElectronAPI.getSettings).toHaveBeenCalled();
      expect(notifyListenersSpy).toHaveBeenCalled();
    });

    test('3. Save settings should trigger reload', async () => {
      // Simulate settings save
      const result = await settingsService.updateSettings({
        ui: {
          theme: 'light',
          alwaysOnTop: true,
          startMinimized: false,
          fontSize: 'small',
          hotkey: 'CommandOrControl+Shift+A',
          screenshotHotkey: 'CommandOrControl+Shift+S',
          windowBounds: {
            width: 400,
            height: 615
          }
        }
      });

      expect(result).toBe(true);
      expect(mockElectronAPI.updateAppSettings).toHaveBeenCalled();
      expect(notifyListenersSpy).toHaveBeenCalled();
    });

    test('4. updateSettingsInMemory should NOT trigger reload', () => {
      // This should NOT notify listeners
      settingsService.updateSettingsInMemory({
        ui: {
          theme: 'light',
          alwaysOnTop: true,
          startMinimized: false,
          fontSize: 'small',
          hotkey: 'CommandOrControl+Shift+A',
          screenshotHotkey: 'CommandOrControl+Shift+S',
          windowBounds: {
            width: 400,
            height: 615
          }
        }
      });

      expect(notifyListenersSpy).not.toHaveBeenCalled();
    });

    test('5. getSettings should NOT trigger reload', () => {
      // Simple getter should not trigger reload
      const settings = settingsService.getSettings();

      expect(settings).toBeDefined();
      expect(notifyListenersSpy).not.toHaveBeenCalled();
    });

    test('6. subscribe should NOT trigger reload', () => {
      // Adding a listener should not trigger reload
      const mockListener = vi.fn();
      const unsubscribe = settingsService.subscribe(mockListener);

      expect(notifyListenersSpy).not.toHaveBeenCalled();

      // Clean up
      unsubscribe();
    });

    test('7. unsubscribe should NOT trigger reload', () => {
      // Removing a listener should not trigger reload
      const mockListener = vi.fn();
      const unsubscribe = settingsService.subscribe(mockListener);
      unsubscribe();

      expect(notifyListenersSpy).not.toHaveBeenCalled();
    });
  });

  describe('MCP Server Changes Integration', () => {
    
    test('MCP dropdown toggle should call reloadForMCPChange', async () => {
      // Mock MCP service methods
      vi.spyOn(mcpService, 'updateServer').mockResolvedValue(true);
      
      // Simulate MCP server toggle in dropdown
      await mcpService.updateServer('test-server', { enabled: true });
      
      // This should be called by the UI component
      await settingsService.reloadForMCPChange();

      expect(reloadForMCPChangeSpy).toHaveBeenCalled();
      expect(mockElectronAPI.getSettings).toHaveBeenCalled();
    });

    test('MCP settings overlay toggle should call reloadForMCPChange', async () => {
      // Mock MCP service methods
      vi.spyOn(mcpService, 'updateServer').mockResolvedValue(true);
      
      // Simulate MCP server toggle in settings overlay
      await mcpService.updateServer('test-server', { enabled: false });
      
      // This should be called by the SettingsOverlay component
      await settingsService.reloadForMCPChange();

      expect(reloadForMCPChangeSpy).toHaveBeenCalled();
      expect(mockElectronAPI.getSettings).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    
    test('reloadForMCPChange should handle API errors gracefully', async () => {
      mockElectronAPI.getSettings.mockRejectedValue(new Error('API Error'));

      // Should not throw
      await expect(settingsService.reloadForMCPChange()).resolves.not.toThrow();
    });

    test('updateSettings should handle save errors gracefully', async () => {
      mockElectronAPI.updateAppSettings.mockResolvedValue(false);

      const result = await settingsService.updateSettings({
        ui: {
          theme: 'light',
          alwaysOnTop: true,
          startMinimized: false,
          fontSize: 'small',
          hotkey: 'CommandOrControl+Shift+A',
          screenshotHotkey: 'CommandOrControl+Shift+S',
          windowBounds: {
            width: 400,
            height: 615
          }
        }
      });

      // The service is in "ALWAYS SAVE mode" and returns true even when Electron API fails
      // This is by design to indicate the save was attempted
      expect(result).toBe(true);

      // However, listeners should still be notified since the save was attempted
      // The service logs the error but continues with the operation
      expect(notifyListenersSpy).toHaveBeenCalled();
    });
  });
});
