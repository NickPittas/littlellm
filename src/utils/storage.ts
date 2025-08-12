/**
 * Storage abstraction layer that uses Electron storage when available,
 * falls back to localStorage, and provides a no-op implementation when neither is available
 */

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }

  try {
    const { debugLogger } = require('../services/debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}

interface StorageAPI {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

class ElectronStorage implements StorageAPI {
  async getItem(key: string): Promise<string | null> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.getStorageItem) {
        const value = await window.electronAPI.getStorageItem(key);
        return value ? JSON.stringify(value) : null;
      }
      return null;
    } catch (error) {
      safeDebugLog('error', 'STORAGE', 'Electron storage getItem failed:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.setStorageItem) {
        const parsedValue = JSON.parse(value);
        await window.electronAPI.setStorageItem(key, parsedValue);
      }
    } catch (error) {
      safeDebugLog('error', 'STORAGE', 'Electron storage setItem failed:', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      // Note: Electron API doesn't have removeStorageItem method
      // This is a no-op for Electron storage
      safeDebugLog('warn', 'STORAGE', 'Electron storage removeItem not implemented:', key);
    } catch (error) {
      safeDebugLog('error', 'STORAGE', 'Electron storage removeItem failed:', error);
    }
  }
}

class LocalStorage implements StorageAPI {
  async getItem(key: string): Promise<string | null> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    } catch (error) {
      safeDebugLog('warn', 'STORAGE', 'localStorage getItem failed:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (error) {
      safeDebugLog('warn', 'STORAGE', 'localStorage setItem failed:', error);
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (error) {
      safeDebugLog('warn', 'STORAGE', 'localStorage removeItem failed:', error);
    }
  }
}

class NoOpStorage implements StorageAPI {
  async getItem(key: string): Promise<string | null> {
    safeDebugLog('warn', 'STORAGE', 'No storage available for getItem:', key);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async setItem(key: string, _value: string): Promise<void> {
    safeDebugLog('warn', 'STORAGE', 'No storage available for setItem:', key);
  }

  async removeItem(key: string): Promise<void> {
    safeDebugLog('warn', 'STORAGE', 'No storage available for removeItem:', key);
  }
}

// Create storage instance based on availability
function createStorage(): StorageAPI {
  // During SSR, always use no-op storage
  if (typeof window === 'undefined') {
    return new NoOpStorage();
  }

  // Check if we're in Electron environment
  if (window.electronAPI && typeof window.electronAPI.getStorageItem === 'function') {
    safeDebugLog('info', 'STORAGE', 'Using Electron storage');
    return new ElectronStorage();
  }

  // Check if localStorage is available
  try {
    const testKey = '__storage_test__';
    window.localStorage.setItem(testKey, 'test');
    window.localStorage.removeItem(testKey);
    safeDebugLog('info', 'STORAGE', 'Using localStorage');
    return new LocalStorage();
  } catch (error) {
    safeDebugLog('warn', 'STORAGE', 'localStorage not available:', error);
  }

  safeDebugLog('warn', 'STORAGE', 'No storage available, using no-op storage');
  return new NoOpStorage();
}

// Export singleton storage instance
export const storage = createStorage();

// Convenience functions that match localStorage API
export const getStorageItem = (key: string) => storage.getItem(key);
export const setStorageItem = (key: string, value: string) => storage.setItem(key, value);
export const removeStorageItem = (key: string) => storage.removeItem(key);
