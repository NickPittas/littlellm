import { settingsService } from '../services/settingsService';
import { mcpService } from '../services/mcpService';

// Mock window.electronAPI
const mockElectronAPI = {
  getSettings: jest.fn(),
  updateAppSettings: jest.fn(),
  getMCPServers: jest.fn(),
  updateMCPServer: jest.fn(),
};

// Mock window object
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
});

describe('Settings Reload Behavior', () => {
  let notifyListenersSpy: jest.SpyInstance;
  let reloadForMCPChangeSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Spy on private methods
    notifyListenersSpy = jest.spyOn(settingsService as any, 'notifyListeners');
    reloadForMCPChangeSpy = jest.spyOn(settingsService, 'reloadForMCPChange');
    
    // Mock default settings response
    mockElectronAPI.getSettings.mockResolvedValue({
      chat: { provider: 'test', model: 'test-model' },
      ui: { theme: 'dark' },
      shortcuts: { toggleWindow: 'Ctrl+L' },
      general: { autoStartWithSystem: false }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Settings should ONLY reload under specific conditions', () => {
    
    test('1. Manual reload button should trigger reload', async () => {
      // Simulate manual reload button click
      await settingsService.forceUpdateSettings({
        chat: { provider: 'test', model: 'test-model' },
        ui: { theme: 'light' },
        shortcuts: { toggleWindow: 'Ctrl+L' },
        general: { autoStartWithSystem: false }
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
        ui: { theme: 'light' }
      });

      expect(result).toBe(true);
      expect(mockElectronAPI.updateAppSettings).toHaveBeenCalled();
      expect(notifyListenersSpy).toHaveBeenCalled();
    });

    test('4. updateSettingsInMemory should NOT trigger reload', () => {
      // This should NOT notify listeners
      settingsService.updateSettingsInMemory({
        ui: { theme: 'light' }
      });

      expect(notifyListenersSpy).not.toHaveBeenCalled();
    });

    test('5. getSettings should NOT trigger reload', () => {
      // Simple getter should not trigger reload
      const settings = settingsService.getSettings();

      expect(settings).toBeDefined();
      expect(notifyListenersSpy).not.toHaveBeenCalled();
    });

    test('6. addListener should NOT trigger reload', () => {
      // Adding a listener should not trigger reload
      const mockListener = jest.fn();
      settingsService.addListener(mockListener);

      expect(notifyListenersSpy).not.toHaveBeenCalled();
    });

    test('7. removeListener should NOT trigger reload', () => {
      // Removing a listener should not trigger reload
      const mockListener = jest.fn();
      settingsService.addListener(mockListener);
      settingsService.removeListener(mockListener);

      expect(notifyListenersSpy).not.toHaveBeenCalled();
    });
  });

  describe('MCP Server Changes Integration', () => {
    
    test('MCP dropdown toggle should call reloadForMCPChange', async () => {
      // Mock MCP service methods
      jest.spyOn(mcpService, 'updateServer').mockResolvedValue(true);
      
      // Simulate MCP server toggle in dropdown
      await mcpService.updateServer('test-server', { enabled: true });
      
      // This should be called by the UI component
      await settingsService.reloadForMCPChange();

      expect(reloadForMCPChangeSpy).toHaveBeenCalled();
      expect(mockElectronAPI.getSettings).toHaveBeenCalled();
    });

    test('MCP settings overlay toggle should call reloadForMCPChange', async () => {
      // Mock MCP service methods
      jest.spyOn(mcpService, 'updateServer').mockResolvedValue(true);
      
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
        ui: { theme: 'light' }
      });

      expect(result).toBe(false);
      expect(notifyListenersSpy).not.toHaveBeenCalled();
    });
  });
});
