/**
 * Unified Test Setup for Vitest
 * Compatible with both Jest and Vitest APIs
 */

import '@testing-library/jest-dom';
import { vi, beforeAll, afterAll } from 'vitest';

// Mock console methods to reduce noise during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Only show errors during tests
  console.log = vi.fn();
  console.warn = vi.fn();
  // Keep error logging for debugging
  console.error = originalConsoleError;
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Mock window.electronAPI for browser environment
Object.defineProperty(window, 'electronAPI', {
  value: {
    getSettings: vi.fn(),
    updateAppSettings: vi.fn(),
    getMCPServers: vi.fn(),
    updateMCPServer: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    takeScreenshot: vi.fn(),
    openActionMenu: vi.fn(),
    loadConversationIndex: vi.fn(),
    saveConversation: vi.fn(),
    deleteConversation: vi.fn(),
    getSecureData: vi.fn(),
    setSecureData: vi.fn(),
    deleteSecureData: vi.fn(),
    setInternalCommandsConfig: vi.fn(),
    getInternalCommandsTools: vi.fn(),
    loadMemoryIndex: vi.fn(),
    saveMemoryIndex: vi.fn(),
    loadMemoryEntry: vi.fn(),
    saveMemoryEntry: vi.fn(),
    deleteMemoryEntry: vi.fn(),
    getMemoryStats: vi.fn(),
  },
  writable: true,
});

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

// Mock fetch for API calls
global.fetch = vi.fn();

// Ensure we're running on Windows for Windows-specific tests
if (process.platform !== 'win32') {
  console.warn('⚠️ Windows Internal Commands tests are designed for Windows platform only');
  console.warn(`Current platform: ${process.platform}`);
}
