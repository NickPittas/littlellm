/**
 * Test file for Memory System
 * This demonstrates how the memory system works and can be used for testing
 */

import { memoryService } from '../services/memoryService';
import { executeMemoryTool } from '../services/memoryMCPTools';
import { MemoryType, MemoryEntry, SearchResponse } from '../types/memory';

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
// Mock Electron API for testing
const mockElectronAPI = {
  loadMemoryIndex: jest.fn(),
  saveMemoryIndex: jest.fn(),
  loadMemoryEntry: jest.fn(),
  saveMemoryEntry: jest.fn(),
  deleteMemoryEntry: jest.fn(),
  getMemoryStats: jest.fn()
};

// Setup mock for window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
});

describe('Memory System', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup default mock responses
    mockElectronAPI.loadMemoryIndex.mockResolvedValue(null);
    mockElectronAPI.saveMemoryIndex.mockResolvedValue(true);
    mockElectronAPI.saveMemoryEntry.mockResolvedValue(true);
    mockElectronAPI.loadMemoryEntry.mockResolvedValue(null);
    mockElectronAPI.deleteMemoryEntry.mockResolvedValue(true);
    mockElectronAPI.getMemoryStats.mockResolvedValue({ totalSize: 0, entryCount: 0 });
  });

  describe('Memory Service', () => {
    test('should store a memory entry', async () => {
      const request = {
        type: 'user_preference' as MemoryType,
        title: 'Test Preference',
        content: 'User prefers dark theme',
        tags: ['ui', 'theme'],
        source: 'user_input'
      };

      const result = await memoryService.storeMemory(request);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.title).toBe('Test Preference');
      expect(result.data?.type).toBe('user_preference');
      expect(mockElectronAPI.saveMemoryEntry).toHaveBeenCalled();
      expect(mockElectronAPI.saveMemoryIndex).toHaveBeenCalled();
    });

    test('should retrieve a memory entry', async () => {
      const mockEntry = {
        id: 'test-id',
        type: 'user_preference',
        title: 'Test Preference',
        content: 'User prefers dark theme',
        metadata: {
          tags: ['ui', 'theme'],
          timestamp: new Date().toISOString(),
          accessCount: 0
        },
        searchableText: 'test preference user prefers dark theme ui theme',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      mockElectronAPI.loadMemoryEntry.mockResolvedValue(mockEntry);

      const result = await memoryService.retrieveMemory({ id: 'test-id' });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.title).toBe('Test Preference');
      expect(mockElectronAPI.loadMemoryEntry).toHaveBeenCalledWith('test-id');
    });

    test('should handle memory not found', async () => {
      mockElectronAPI.loadMemoryEntry.mockResolvedValue(null);

      const result = await memoryService.retrieveMemory({ id: 'non-existent' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Memory MCP Tools', () => {
    test('should execute memory-store tool', async () => {
      const args = {
        type: 'code_snippet',
        title: 'React Component',
        content: 'const MyComponent = () => <div>Hello</div>;',
        tags: ['react', 'component']
      };

      const result = await executeMemoryTool('memory-store', args);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    test('should execute memory-search tool', async () => {
      // Mock index with some entries
      const mockIndex = {
        entries: [
          {
            id: 'test-1',
            type: 'user_preference',
            title: 'Dark Theme Preference',
            tags: ['ui', 'theme'],
            timestamp: new Date(),
            fileSize: 100
          }
        ],
        lastUpdated: new Date(),
        totalEntries: 1,
        version: '1.0.0'
      };

      mockElectronAPI.loadMemoryIndex.mockResolvedValue(mockIndex);

      const args = {
        text: 'theme',
        limit: 10
      };

      const result = await executeMemoryTool('memory-search', args);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect((result.data as SearchResponse).results).toBeDefined();
    });

    test('should handle unknown memory tool', async () => {
      const result = await executeMemoryTool('unknown-tool', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown memory tool');
    });
  });

  describe('Memory Integration', () => {
    test('should demonstrate complete workflow', async () => {
      // 1. Store a memory
      const storeResult = await executeMemoryTool('memory-store', {
        type: 'project_knowledge',
        title: 'LiteLLM Architecture',
        content: 'LiteLLM uses Electron with Next.js frontend and TypeScript',
        tags: ['architecture', 'electron', 'nextjs'],
        projectId: 'littlellm'
      });

      expect(storeResult.success).toBe(true);
      const memoryId = (storeResult.data as MemoryEntry)?.id;

      // 2. Retrieve the memory
      mockElectronAPI.loadMemoryEntry.mockResolvedValue({
        id: memoryId,
        type: 'project_knowledge',
        title: 'LiteLLM Architecture',
        content: 'LiteLLM uses Electron with Next.js frontend and TypeScript',
        metadata: {
          tags: ['architecture', 'electron', 'nextjs'],
          timestamp: new Date().toISOString(),
          projectId: 'littlellm',
          accessCount: 0
        },
        searchableText: 'littlellm architecture electron nextjs typescript',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const retrieveResult = await executeMemoryTool('memory-retrieve', { id: memoryId });

      expect(retrieveResult.success).toBe(true);
      expect((retrieveResult.data as MemoryEntry)?.title).toBe('LiteLLM Architecture');

      // 3. Update the memory
      const updateResult = await executeMemoryTool('memory-update', {
        id: memoryId,
        content: 'LiteLLM uses Electron with Next.js frontend, TypeScript, and MCP integration'
      });

      expect(updateResult.success).toBe(true);

      // 4. Delete the memory
      const deleteResult = await executeMemoryTool('memory-delete', { id: memoryId });

      expect(deleteResult.success).toBe(true);
    });
  });
});

// Example usage for manual testing
export const memorySystemExample = {
  async demonstrateMemorySystem() {
    safeDebugLog('info', 'MEMORYSYSTEM_TEST', '🧠 Memory System Demonstration');

    // Store user preference
    const preference = await executeMemoryTool('memory-store', {
      type: 'user_preference',
      title: 'Preferred AI Model',
      content: 'User prefers Claude 3.5 Sonnet for coding tasks',
      tags: ['ai', 'model', 'preference', 'coding']
    });
    safeDebugLog('info', 'MEMORYSYSTEM_TEST', 'Stored preference:', preference);

    // Store project knowledge
    const knowledge = await executeMemoryTool('memory-store', {
      type: 'project_knowledge',
      title: 'Memory System Implementation',
      content: 'Implemented JSON-based memory system with MCP tool integration',
      tags: ['implementation', 'memory', 'mcp', 'json'],
      projectId: 'littlellm-memory'
    });
    safeDebugLog('info', 'MEMORYSYSTEM_TEST', 'Stored knowledge:', knowledge);

    // Search memories
    const searchResult = await executeMemoryTool('memory-search', {
      text: 'memory',
      limit: 5
    });
    safeDebugLog('info', 'MEMORYSYSTEM_TEST', 'Search results:', searchResult);

    return { preference, knowledge, searchResult };
  }
};
