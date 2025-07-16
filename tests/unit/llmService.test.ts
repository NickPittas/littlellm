/**
 * Unit tests for LLMService multi-tool functionality
 */

import { LLMService } from '../../src/services/llmService';

// Mock electron API
const mockElectronAPI = {
  callMCPTool: jest.fn(),
  callMultipleMCPTools: jest.fn(),
  getAllMCPTools: jest.fn(),
  getMCPServers: jest.fn(),
  getConnectedMCPServerIds: jest.fn()
};

// Setup global window mock
Object.defineProperty(global, 'window', {
  value: {
    electronAPI: mockElectronAPI
  },
  writable: true
});

describe('LLMService Multi-Tool Functionality', () => {
  let llmService: LLMService;

  beforeEach(() => {
    llmService = new LLMService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Tool Call Validation', () => {
    it('should validate OpenAI tool calls correctly', () => {
      const toolCalls = [
        {
          id: 'test-1',
          name: 'web_search',
          arguments: { query: 'test' }
        }
      ];

      const result = (llmService as any).validateToolCallsForProvider(toolCalls, 'openai');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing tool call IDs for OpenAI', () => {
      const toolCalls = [
        {
          name: 'web_search',
          arguments: { query: 'test' }
        }
      ];

      const result = (llmService as any).validateToolCallsForProvider(toolCalls, 'openai');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('OpenAI tool call missing required id: web_search');
    });

    it('should validate Anthropic tool calls correctly', () => {
      const toolCalls = [
        {
          name: 'web_search',
          arguments: { query: 'test' }
        }
      ];

      const result = (llmService as any).validateToolCallsForProvider(toolCalls, 'anthropic');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate Ollama tool calls correctly', () => {
      const toolCalls = [
        {
          id: 'test-1',
          name: 'web_search',
          arguments: { query: 'test' }
        }
      ];

      const result = (llmService as any).validateToolCallsForProvider(toolCalls, 'ollama');
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect tool names that are too long', () => {
      const toolCalls = [
        {
          id: 'test-1',
          name: 'a'.repeat(65), // 65 characters, exceeds 64 limit
          arguments: { query: 'test' }
        }
      ];

      const result = (llmService as any).validateToolCallsForProvider(toolCalls, 'openai');
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('Tool name too long'))).toBe(true);
    });

    it('should detect invalid tool name characters', () => {
      const toolCalls = [
        {
          id: 'test-1',
          name: 'web search!', // Contains space and exclamation mark
          arguments: { query: 'test' }
        }
      ];

      const result = (llmService as any).validateToolCallsForProvider(toolCalls, 'openai');
      expect(result.valid).toBe(false);
      expect(result.errors.some(error => error.includes('invalid characters'))).toBe(true);
    });
  });

  describe('Tool Execution', () => {
    it('should handle empty tool calls array', async () => {
      const result = await (llmService as any).executeMultipleToolsParallel([], 'test-provider');
      expect(result).toEqual([]);
    });

    it('should return validation errors for critical failures', async () => {
      const toolCalls = [
        {
          name: 'web_search', // Missing required ID for OpenAI
          arguments: { query: 'test' }
        }
      ];

      const result = await (llmService as any).executeMultipleToolsParallel(toolCalls, 'openai');
      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(false);
      expect(result[0].result).toContain('Validation Error');
    });
  });
});
