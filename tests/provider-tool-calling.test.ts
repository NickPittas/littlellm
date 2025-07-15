/**
 * Provider-specific tool calling tests for MCP Agentic Workflows
 * Tests the fixed tool calling implementation across OpenAI, Anthropic, Ollama, and Mistral
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { LLMService } from '../src/services/llmService';

// Mock the MCP service
vi.mock('../src/services/mcpService', () => ({
  mcpService: {
    callTool: vi.fn(),
    callToolsOptimized: vi.fn(),
    getAvailableTools: vi.fn(),
    getServers: vi.fn(),
    getConnectedServerIds: vi.fn()
  }
}));

// Mock memory tools
vi.mock('../src/services/memoryMCPTools', () => ({
  getMemoryMCPTools: vi.fn(() => []),
  executeMemoryTool: vi.fn(),
  isMemoryTool: vi.fn(() => false)
}));

// Mock memory context service
vi.mock('../src/services/memoryContextService', () => ({
  memoryContextService: {
    searchRelevantMemories: vi.fn(() => Promise.resolve([])),
    enhancePromptWithMemory: vi.fn((prompt) => Promise.resolve(prompt))
  }
}));

// Mock automatic memory service
vi.mock('../src/services/automaticMemoryService', () => ({
  automaticMemoryService: {
    shouldCreateMemory: vi.fn(() => false),
    createMemoryFromConversation: vi.fn()
  }
}));

describe('Provider-Specific Tool Calling Tests', () => {
  let llmService: LLMService;

  beforeEach(() => {
    llmService = new LLMService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Tool Call Validation', () => {
    it('should validate OpenAI tool calls correctly', () => {
      const validToolCalls = [
        { id: 'call_123', name: 'search-tool', arguments: { query: 'test' } },
        { id: 'call_456', name: 'memory-tool', arguments: { data: 'test' } }
      ];

      const validation = (llmService as any).validateToolCallsForProvider(validToolCalls, 'openai');
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing IDs in OpenAI tool calls', () => {
      const invalidToolCalls = [
        { name: 'search-tool', arguments: { query: 'test' } }, // Missing ID
        { id: 'call_456', name: 'memory-tool', arguments: { data: 'test' } }
      ];

      const validation = (llmService as any).validateToolCallsForProvider(invalidToolCalls, 'openai');
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('OpenAI tool call missing required id: search-tool');
    });

    it('should validate Anthropic tool calls correctly', () => {
      const validToolCalls = [
        { id: 'tool_123', name: 'search-tool', arguments: { query: 'test' } },
        { id: 'tool_456', name: 'memory-tool', arguments: { data: 'test' } }
      ];

      const validation = (llmService as any).validateToolCallsForProvider(validToolCalls, 'anthropic');
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid arguments in Anthropic tool calls', () => {
      const invalidToolCalls = [
        { id: 'tool_123', name: 'search-tool', arguments: 'invalid-string-args' }, // Should be object
        { id: 'tool_456', name: 'memory-tool', arguments: { data: 'test' } }
      ];

      const validation = (llmService as any).validateToolCallsForProvider(invalidToolCalls, 'anthropic');
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Anthropic tool call arguments must be object: search-tool');
    });

    it('should validate Ollama tool calls correctly', () => {
      const validToolCalls = [
        { id: 'call_123', name: 'search-tool', arguments: { query: 'test' } },
        { id: 'call_456', name: 'memory-tool', arguments: '{"data": "test"}' } // JSON string is valid for Ollama
      ];

      const validation = (llmService as any).validateToolCallsForProvider(validToolCalls, 'ollama');
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid JSON in Ollama tool calls', () => {
      const invalidToolCalls = [
        { id: 'call_123', name: 'search-tool', arguments: 'invalid-json-{' }, // Invalid JSON
        { id: 'call_456', name: 'memory-tool', arguments: { data: 'test' } }
      ];

      const validation = (llmService as any).validateToolCallsForProvider(invalidToolCalls, 'ollama');
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Ollama tool call has invalid JSON arguments: search-tool');
    });

    it('should validate Mistral tool calls correctly', () => {
      const validToolCalls = [
        { id: 'call_123', name: 'search-tool', arguments: { query: 'test' } },
        { id: 'call_456', name: 'memory-tool', arguments: { data: 'test' } }
      ];

      const validation = (llmService as any).validateToolCallsForProvider(validToolCalls, 'mistral');
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing IDs in Mistral tool calls', () => {
      const invalidToolCalls = [
        { name: 'search-tool', arguments: { query: 'test' } }, // Missing ID
        { id: 'call_456', name: 'memory-tool', arguments: { data: 'test' } }
      ];

      const validation = (llmService as any).validateToolCallsForProvider(invalidToolCalls, 'mistral');
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain('Mistral tool call missing required id: search-tool');
    });
  });

  describe('Parallel Tool Execution with Provider Context', () => {
    it('should execute tools with OpenAI provider context', async () => {
      // Mock successful parallel execution
      const mockResults = [
        { id: '1', name: 'search-tool', result: { results: ['result1'] }, success: true, executionTime: 100 },
        { id: '2', name: 'memory-tool', result: { memories: ['memory1'] }, success: true, executionTime: 150 }
      ];

      // Mock the optimized execution
      const mcpService = await import('../src/services/mcpService');
      (mcpService.mcpService.callToolsOptimized as Mock).mockResolvedValue(mockResults);

      const toolCalls = [
        { id: 'call_1', name: 'search-tool', arguments: { query: 'test' } },
        { id: 'call_2', name: 'memory-tool', arguments: { query: 'test' } }
      ];

      const result = await (llmService as any).executeMultipleToolsParallel(toolCalls, 'openai');

      expect(result).toHaveLength(2);
      expect(result[0].success).toBe(true);
      expect(result[1].success).toBe(true);
      expect(mcpService.mcpService.callToolsOptimized).toHaveBeenCalledWith([
        { id: 'call_1', name: 'search-tool', args: { query: 'test' } },
        { id: 'call_2', name: 'memory-tool', args: { query: 'test' } }
      ]);
    });

    it('should execute tools with Anthropic provider context', async () => {
      const mockResults = [
        { id: 'tool_1', name: 'search-tool', result: { results: ['result1'] }, success: true, executionTime: 120 },
        { id: 'tool_2', name: 'analysis-tool', result: { analysis: 'complete' }, success: true, executionTime: 180 }
      ];

      const mcpService = await import('../src/services/mcpService');
      (mcpService.mcpService.callToolsOptimized as Mock).mockResolvedValue(mockResults);

      const toolCalls = [
        { id: 'tool_1', name: 'search-tool', arguments: { query: 'anthropic test' } },
        { id: 'tool_2', name: 'analysis-tool', arguments: { data: 'test data' } }
      ];

      const result = await (llmService as any).executeMultipleToolsParallel(toolCalls, 'anthropic');

      expect(result).toHaveLength(2);
      expect(result.every((r: any) => r.success)).toBe(true);
    });

    it('should execute tools with Ollama provider context', async () => {
      const mockResults = [
        { id: 'ollama_1', name: 'local-tool', result: { data: 'local result' }, success: true, executionTime: 80 },
        { id: 'ollama_2', name: 'compute-tool', result: { computation: 'done' }, success: true, executionTime: 200 }
      ];

      const mcpService = await import('../src/services/mcpService');
      (mcpService.mcpService.callToolsOptimized as Mock).mockResolvedValue(mockResults);

      const toolCalls = [
        { id: 'ollama_1', name: 'local-tool', arguments: { input: 'test' } },
        { id: 'ollama_2', name: 'compute-tool', arguments: '{"task": "compute"}' } // JSON string format
      ];

      const result = await (llmService as any).executeMultipleToolsParallel(toolCalls, 'ollama');

      expect(result).toHaveLength(2);
      expect(result.every((r: any) => r.success)).toBe(true);
    });

    it('should execute tools with Mistral provider context', async () => {
      const mockResults = [
        { id: 'mistral_1', name: 'reasoning-tool', result: { reasoning: 'complete' }, success: true, executionTime: 160 },
        { id: 'mistral_2', name: 'synthesis-tool', result: { synthesis: 'done' }, success: true, executionTime: 140 }
      ];

      const mcpService = await import('../src/services/mcpService');
      (mcpService.mcpService.callToolsOptimized as Mock).mockResolvedValue(mockResults);

      const toolCalls = [
        { id: 'mistral_1', name: 'reasoning-tool', arguments: { problem: 'test problem' } },
        { id: 'mistral_2', name: 'synthesis-tool', arguments: { data: ['item1', 'item2'] } }
      ];

      const result = await (llmService as any).executeMultipleToolsParallel(toolCalls, 'mistral');

      expect(result).toHaveLength(2);
      expect(result.every((r: any) => r.success)).toBe(true);
    });
  });

  describe('Provider-Specific Error Handling', () => {
    it('should handle OpenAI tool call parsing errors gracefully', async () => {
      const toolCallsWithParsingIssues = [
        { id: 'call_1', name: 'valid-tool', arguments: { query: 'test' } },
        { id: 'call_2', name: 'invalid-tool', arguments: 'malformed-json-{' }
      ];

      // Should not throw, but log warnings
      const result = await (llmService as any).executeMultipleToolsParallel(toolCallsWithParsingIssues, 'openai');
      
      // Should still attempt execution despite validation warnings
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle Anthropic tool format variations', async () => {
      const anthropicToolCalls = [
        { id: 'tool_use_1', name: 'search', arguments: { query: 'test', depth: 'basic' } },
        { id: 'tool_use_2', name: 'analyze', arguments: { content: 'test content', format: 'json' } }
      ];

      const result = await (llmService as any).executeMultipleToolsParallel(anthropicToolCalls, 'anthropic');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle Ollama native vs OpenAI-compatible formats', async () => {
      const mixedFormatToolCalls = [
        { id: 'native_1', name: 'ollama-tool', arguments: { param: 'value' } }, // Object format
        { id: 'compat_1', name: 'openai-tool', arguments: '{"param": "value"}' } // String format
      ];

      const result = await (llmService as any).executeMultipleToolsParallel(mixedFormatToolCalls, 'ollama');
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle Mistral tool call edge cases', async () => {
      const edgeCaseToolCalls = [
        { id: 'edge_1', name: 'tool-with-dashes', arguments: { 'param-with-dashes': 'value' } },
        { id: 'edge_2', name: 'tool_with_underscores', arguments: { param_with_underscores: 'value' } }
      ];

      const result = await (llmService as any).executeMultipleToolsParallel(edgeCaseToolCalls, 'mistral');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('Cross-Provider Compatibility', () => {
    it('should maintain consistent behavior across all providers', async () => {
      const standardToolCalls = [
        { id: 'test_1', name: 'search-tool', arguments: { query: 'test query' } },
        { id: 'test_2', name: 'memory-tool', arguments: { action: 'store', data: 'test data' } }
      ];

      const providers = ['openai', 'anthropic', 'ollama', 'mistral'];
      const results = [];

      for (const provider of providers) {
        const result = await (llmService as any).executeMultipleToolsParallel(standardToolCalls, provider);
        results.push({ provider, result });
      }

      // All providers should return arrays of the same length
      expect(results.every(r => Array.isArray(r.result) && r.result.length === 2)).toBe(true);
      
      // All results should have consistent structure
      results.forEach(({ provider, result }) => {
        result.forEach((toolResult: any) => {
          expect(toolResult).toHaveProperty('id');
          expect(toolResult).toHaveProperty('name');
          expect(toolResult).toHaveProperty('result');
          expect(toolResult).toHaveProperty('success');
          expect(toolResult).toHaveProperty('executionTime');
        });
      });
    });
  });
});
