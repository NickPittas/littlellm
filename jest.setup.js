import '@testing-library/jest-dom';

// Mock window.electronAPI for Jest tests
global.window = Object.create(window);
Object.defineProperty(window, 'electronAPI', {
  value: {
    getSettings: jest.fn(),
    updateAppSettings: jest.fn(),
    getMCPServers: jest.fn(),
    updateMCPServer: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    takeScreenshot: jest.fn(),
    openActionMenu: jest.fn(),
    loadConversationIndex: jest.fn(),
    saveConversation: jest.fn(),
    deleteConversation: jest.fn(),
  },
  writable: true,
});

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  },
  writable: true,
});

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: console.error, // Keep errors for debugging
};
