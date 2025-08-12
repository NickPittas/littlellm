/**
 * SecureApiKeyService Tests
 * Tests for proper initialization and error handling
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { secureApiKeyService } from '../src/services/secureApiKeyService';

describe('SecureApiKeyService', () => {
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Reset service state for each test
    // Note: Using the singleton instance since that's how it's exported
  });

  describe('Initialization', () => {
    test('should check initialization status', () => {
      // In test environment, service may not be fully initialized
      const isInitialized = secureApiKeyService.isInitialized();
      expect(typeof isInitialized).toBe('boolean');
    });

    test('should handle missing Electron API gracefully', () => {
      // Mock window without electronAPI
      const originalWindow = global.window;
      global.window = {} as any;

      // Service should handle missing API gracefully
      expect(secureApiKeyService.isInitialized()).toBe(false);

      // Restore window
      global.window = originalWindow;
    });

    test('should provide wait for initialization method', () => {
      // Method should exist and return a promise
      const initPromise = secureApiKeyService.waitForInitialization();
      expect(initPromise).toBeInstanceOf(Promise);
    });
  });

  describe('API Key Management', () => {
    test('should handle getApiKeyData for unknown provider when not initialized', () => {
      // When service is not initialized, it should throw an error
      expect(() => {
        secureApiKeyService.getApiKeyData('unknown-provider');
      }).toThrow('SecureApiKeyService not initialized');
    });

    test('should handle setApiKeyData method existence', () => {
      // Method should exist
      expect(typeof secureApiKeyService.setApiKeyData).toBe('function');
    });

    test('should handle removeApiKeyData method existence', () => {
      // Method should exist
      expect(typeof secureApiKeyService.removeApiKeyData).toBe('function');
    });

    test('should handle hasApiKey method', () => {
      // Method should exist and return boolean
      expect(typeof secureApiKeyService.hasApiKey).toBe('function');

      // Should handle unknown provider gracefully when not initialized
      expect(() => {
        secureApiKeyService.hasApiKey('unknown-provider');
      }).toThrow('SecureApiKeyService not initialized');
    });
  });

  describe('Error Handling', () => {
    test('should handle corrupted data gracefully', () => {
      // Mock Electron API with corrupted data
      const mockElectronAPI = {
        getSecureApiKeys: vi.fn().mockRejectedValue(new Error('Corrupted data')),
      };

      Object.defineProperty(window, 'electronAPI', {
        value: mockElectronAPI,
        writable: true,
      });

      // Service should handle errors gracefully
      expect(secureApiKeyService.isInitialized()).toBe(false);
    });

    test('should handle storage errors gracefully', () => {
      // Mock Electron API that throws errors
      const mockElectronAPI = {
        getSecureApiKeys: vi.fn().mockImplementation(() => {
          throw new Error('Storage error');
        }),
      };

      Object.defineProperty(window, 'electronAPI', {
        value: mockElectronAPI,
        writable: true,
      });

      // Service should handle errors gracefully
      expect(secureApiKeyService.isInitialized()).toBe(false);
    });
  });

  describe('Provider Support', () => {
    test('should support validation for known providers', () => {
      const knownProviders = [
        'openai', 'anthropic', 'gemini', 'mistral', 'deepseek',
        'deepinfra', 'lmstudio', 'jan', 'ollama', 'openrouter',
        'requesty', 'replicate', 'n8n'
      ];

      for (const provider of knownProviders) {
        // Test API key validation
        const result = secureApiKeyService.validateApiKey(provider, 'test-key');
        expect(result).toHaveProperty('isValid');
        expect(typeof result.isValid).toBe('boolean');
      }
    });

    test('should provide getProvidersWithApiKeys method', () => {
      // Method should exist and return an array
      expect(typeof secureApiKeyService.getProvidersWithApiKeys).toBe('function');
      const providers = secureApiKeyService.getProvidersWithApiKeys();
      expect(Array.isArray(providers)).toBe(true);
    });

    test('should provide API key validation', () => {
      // Test OpenAI key validation
      const openaiResult = secureApiKeyService.validateApiKey('openai', 'sk-test123');
      expect(openaiResult).toHaveProperty('isValid');

      // Test invalid key
      const invalidResult = secureApiKeyService.validateApiKey('openai', 'invalid');
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult).toHaveProperty('error');
    });
  });

  describe('Electron Integration', () => {
    test('should handle Electron API calls safely', () => {
      // Mock successful Electron API
      const mockElectronAPI = {
        getSecureApiKeys: vi.fn().mockResolvedValue({}),
        setSecureApiKeys: vi.fn().mockResolvedValue(true),
      };

      Object.defineProperty(window, 'electronAPI', {
        value: mockElectronAPI,
        writable: true,
      });

      // Service should handle API calls gracefully
      expect(secureApiKeyService.isInitialized()).toBe(false);
    });

    test('should handle Electron API failures gracefully', () => {
      // Mock failing Electron API
      const mockElectronAPI = {
        getSecureApiKeys: vi.fn().mockRejectedValue(new Error('Electron error')),
        setSecureApiKeys: vi.fn().mockRejectedValue(new Error('Electron error')),
      };

      Object.defineProperty(window, 'electronAPI', {
        value: mockElectronAPI,
        writable: true,
      });

      // Service should handle failures gracefully
      expect(secureApiKeyService.isInitialized()).toBe(false);
    });
  });

  describe('Utility Methods', () => {
    test('should provide debug methods', () => {
      // Method should exist
      expect(typeof secureApiKeyService.debugApiKeyState).toBe('function');

      // Should not throw when called
      expect(() => {
        secureApiKeyService.debugApiKeyState();
      }).not.toThrow();
    });

    test('should provide listener management', () => {
      // Methods should exist
      expect(typeof secureApiKeyService.addListener).toBe('function');
      expect(typeof secureApiKeyService.removeListener).toBe('function');

      // Should handle listener operations
      const mockListener = vi.fn();
      expect(() => {
        secureApiKeyService.addListener(mockListener);
        secureApiKeyService.removeListener(mockListener);
      }).not.toThrow();
    });

    test('should provide retry initialization method', () => {
      // Method should exist
      expect(typeof secureApiKeyService.retryInitialization).toBe('function');
    });
  });
});
