/**
 * Comprehensive test suite for MCP Agentic Workflows
 * Tests parallel execution, tool chaining, error recovery, and response aggregation
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { LLMService } from '../src/services/llmService';
import { mcpService } from '../src/services/mcpService';

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

describe('MCP Agentic Workflows', () => {
  let llmService: LLMService;
  let mockMcpService: typeof mcpService;

  beforeEach(() => {
    llmService = new LLMService();
    mockMcpService = mcpService as any;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Parallel Tool Execution', () => {
    it('should execute multiple tools concurrently', async () => {
      // Mock successful tool executions
      const mockResults = [
        { id: '1', name: 'search-tool', result: { results: ['result1'] }, success: true, executionTime: 100 },
        { id: '2', name: 'memory-tool', result: { memories: ['memory1'] }, success: true, executionTime: 150 }
      ];

      (mockMcpService.callToolsOptimized as Mock).mockResolvedValue(mockResults);

      const toolCalls = [
        { id: '1', name: 'search-tool', arguments: { query: 'test' } },
        { id: '2', name: 'memory-tool', arguments: { query: 'test' } }
      ];

      // Access private method for testing
      const result = await (llmService as any).executeMultipleToolsParallel(toolCalls);

      expect(result).toHaveLength(2);
      expect(result[0].success).toBe(true);
      expect(result[1].success).toBe(true);
      expect(mockMcpService.callToolsOptimized).toHaveBeenCalledWith([
        { id: '1', name: 'search-tool', args: { query: 'test' } },
        { id: '2', name: 'memory-tool', args: { query: 'test' } }
      ]);
    });

    it('should handle partial failures in parallel execution', async () => {
      const mockResults = [
        { id: '1', name: 'search-tool', result: { results: ['result1'] }, success: true, executionTime: 100 },
        { id: '2', name: 'failing-tool', result: null, success: false, error: 'Tool failed', executionTime: 50 }
      ];

      (mockMcpService.callToolsOptimized as Mock).mockResolvedValue(mockResults);

      const toolCalls = [
        { id: '1', name: 'search-tool', arguments: { query: 'test' } },
        { id: '2', name: 'failing-tool', arguments: { query: 'test' } }
      ];

      const result = await (llmService as any).executeMultipleToolsParallel(toolCalls);

      expect(result).toHaveLength(2);
      expect(result[0].success).toBe(true);
      expect(result[1].success).toBe(false);
      expect(result[1].result).toContain('Tool failed');
    });

    it('should fallback to legacy execution when optimized fails', async () => {
      // Mock optimized execution failure
      (mockMcpService.callToolsOptimized as Mock).mockRejectedValue(new Error('Optimized execution failed'));
      
      // Mock individual tool calls for legacy fallback
      (mockMcpService.callTool as Mock)
        .mockResolvedValueOnce({ results: ['result1'] })
        .mockResolvedValueOnce({ memories: ['memory1'] });

      const toolCalls = [
        { id: '1', name: 'search-tool', arguments: { query: 'test' } },
        { id: '2', name: 'memory-tool', arguments: { query: 'test' } }
      ];

      const result = await (llmService as any).executeMultipleToolsParallel(toolCalls);

      expect(result).toHaveLength(2);
      expect(result[0].success).toBe(true);
      expect(result[1].success).toBe(true);
      expect(mockMcpService.callTool).toHaveBeenCalledTimes(2);
    });
  });

  describe('Response Aggregation', () => {
    it('should format search results correctly', async () => {
      const results = [
        {
          id: '1',
          name: 'tavily-search',
          result: JSON.stringify({
            results: [
              { title: 'Test Result', url: 'https://example.com', content: 'Test content' },
              { title: 'Another Result', url: 'https://example2.com', content: 'More content' }
            ]
          }),
          success: true,
          executionTime: 100
        }
      ];

      const aggregated = (llmService as any).aggregateToolResults(results);

      expect(aggregated).toContain('Multi-Tool Execution Results');
      expect(aggregated).toContain('tavily-search');
      expect(aggregated).toContain('Test Result');
      expect(aggregated).toContain('https://example.com');
      expect(aggregated).toContain('100ms');
    });

    it('should format memory results correctly', async () => {
      const results = [
        {
          id: '1',
          name: 'memory-search',
          result: JSON.stringify({
            success: true,
            memories: [
              { title: 'User Preference', content: 'User likes dark mode' },
              { title: 'Project Info', content: 'Working on LiteLLM project' }
            ]
          }),
          success: true,
          executionTime: 50
        }
      ];

      const aggregated = (llmService as any).aggregateToolResults(results);

      expect(aggregated).toContain('memory-search');
      expect(aggregated).toContain('User Preference');
      expect(aggregated).toContain('User likes dark mode');
      expect(aggregated).toContain('50ms');
    });

    it('should handle mixed success and failure results', async () => {
      const results = [
        {
          id: '1',
          name: 'successful-tool',
          result: JSON.stringify({ data: 'success' }),
          success: true,
          executionTime: 100
        },
        {
          id: '2',
          name: 'failed-tool',
          result: JSON.stringify({ error: 'Tool execution failed' }),
          success: false,
          executionTime: 50
        }
      ];

      const aggregated = (llmService as any).aggregateToolResults(results);

      expect(aggregated).toContain('✅ Successful Results');
      expect(aggregated).toContain('❌ Failed Results');
      expect(aggregated).toContain('successful-tool');
      expect(aggregated).toContain('failed-tool');
      expect(aggregated).toContain('Success Rate: 50%');
    });
  });

  describe('Tool Chaining Analysis', () => {
    it('should identify search-to-memory chaining opportunities', async () => {
      const searchResults = [
        {
          id: '1',
          name: 'tavily-search',
          result: JSON.stringify({
            results: [
              { title: 'Important Finding', url: 'https://example.com', content: 'Critical information about AI' }
            ]
          }),
          success: true,
          executionTime: 100
        }
      ];

      const availableTools = [
        { function: { name: 'memory-store', description: 'Store information in memory' } }
      ];

      const chainedTools = (llmService as any).analyzeForToolChaining(searchResults, availableTools);

      expect(chainedTools).toHaveLength(1);
      expect(chainedTools[0].name).toBe('memory-store');
      expect(chainedTools[0].arguments.type).toBe('search_result');
      expect(chainedTools[0].arguments.title).toContain('Important Finding');
      expect(chainedTools[0].chainedFrom).toBe('tavily-search');
    });

    it('should identify memory-to-search chaining opportunities', async () => {
      const memoryResults = [
        {
          id: '1',
          name: 'memory-search',
          result: JSON.stringify({
            memories: [
              { title: 'User Interest', content: 'User is interested in artificial intelligence and machine learning' }
            ]
          }),
          success: true,
          executionTime: 50
        }
      ];

      const availableTools = [
        { function: { name: 'tavily-search', description: 'Search the web' } }
      ];

      const chainedTools = (llmService as any).analyzeForToolChaining(memoryResults, availableTools);

      expect(chainedTools).toHaveLength(1);
      expect(chainedTools[0].name).toBe('tavily-search');
      expect(chainedTools[0].arguments.query).toContain('artificial');
      expect(chainedTools[0].chainedFrom).toBe('memory-search');
    });

    it('should limit chaining to prevent infinite loops', async () => {
      const results = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        name: 'search-tool',
        result: JSON.stringify({ results: [{ title: `Result ${i}`, content: `Content ${i}` }] }),
        success: true,
        executionTime: 100
      }));

      const availableTools = [
        { function: { name: 'memory-store', description: 'Store information' } }
      ];

      const chainedTools = (llmService as any).analyzeForToolChaining(results, availableTools);

      // Should be limited to 5 chained tools maximum
      expect(chainedTools.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Error Recovery', () => {
    it('should find alternative tools for failed searches', async () => {
      const availableTools = [
        { function: { name: 'tavily-search', description: 'Search with Tavily' } },
        { function: { name: 'brave-search', description: 'Search with Brave' } },
        { function: { name: 'searx-search', description: 'Search with SearX' } }
      ];

      const alternatives = (llmService as any).findAlternativeTools('tavily-search', availableTools);

      expect(alternatives).toContain('brave-search');
      expect(alternatives).toContain('searx-search');
      expect(alternatives).not.toContain('tavily-search'); // Should not include the failed tool
      expect(alternatives.length).toBeLessThanOrEqual(3); // Limited to 3 alternatives
    });

    it('should find alternative tools for failed memory operations', async () => {
      const availableTools = [
        { function: { name: 'memory-store', description: 'Store in memory' } },
        { function: { name: 'memory-search', description: 'Search memory' } },
        { function: { name: 'memory-update', description: 'Update memory' } }
      ];

      const alternatives = (llmService as any).findAlternativeTools('memory-store', availableTools);

      expect(alternatives).toContain('memory-search');
      expect(alternatives).toContain('memory-update');
      expect(alternatives).not.toContain('memory-store');
    });

    it('should return empty array when no alternatives exist', async () => {
      const availableTools = [
        { function: { name: 'unique-tool', description: 'A unique tool' } }
      ];

      const alternatives = (llmService as any).findAlternativeTools('failed-tool', availableTools);

      expect(alternatives).toHaveLength(0);
    });
  });
});
