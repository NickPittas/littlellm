/**
 * Test setup for Windows Internal Commands
 */

// Increase timeout for Windows PowerShell operations
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Only show errors during tests
  console.log = jest.fn();
  console.warn = jest.fn();
  // Keep error logging for debugging
  console.error = originalConsoleError;
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Ensure we're running on Windows
if (process.platform !== 'win32') {
  console.warn('⚠️ Windows Internal Commands tests are designed for Windows platform only');
  console.warn(`Current platform: ${process.platform}`);
}
