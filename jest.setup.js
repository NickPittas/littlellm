import '@testing-library/jest-dom'

// Mock window.electronAPI
global.window = Object.create(window);
Object.defineProperty(window, 'electronAPI', {
  value: {
    getSettings: jest.fn(),
    updateAppSettings: jest.fn(),
    getMCPServers: jest.fn(),
    updateMCPServer: jest.fn(),
  },
  writable: true,
});
