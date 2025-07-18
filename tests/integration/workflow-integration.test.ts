/**
 * Integration tests for MCP Agentic Workflows
 * Tests end-to-end workflows across different LLM providers and MCP servers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LLMService } from '../../src/services/llmService';
import { mcpService } from '../../src/services/mcpService';
import { testEnvironment } from '../test-runner.config';

// Mock electron API
const mockElectronAPI = {
  callMCPTool: vi.fn(),
  callMultipleMCPTools: vi.fn(),
  getAllMCPTools: vi.fn(),
  getMCPServers: vi.fn(),
  getConnectedMCPServerIds: vi.fn()
};

describe('Workflow Integration Tests', () => {
  let llmService: LLMService;

  beforeEach(() => {
    // Setup mock electron API using test environment
    testEnvironment.setupMockElectronAPI(mockElectronAPI);
    llmService = new LLMService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    testEnvironment.cleanup();
    vi.restoreAllMocks();
  });

  describe('Research Workflow', () => {
    it('should execute a complete research workflow with chaining', async () => {
      // Mock available tools
      mockElectronAPI.getAllMCPTools.mockResolvedValue([
        { name: 'tavily-search', description: 'Search the web', inputSchema: {} },
        { name: 'memory-store', description: 'Store information', inputSchema: {} },
        { name: 'memory-search', description: 'Search memory', inputSchema: {} }
      ]);

      // Mock search results
      mockElectronAPI.callMultipleMCPTools.mockResolvedValue([
        {
          id: '1',
          name: 'tavily-search',
          result: {
            results: [
              {
                title: 'AI Advances in 2024',
                url: 'https://example.com/ai-2024',
                content: 'Significant breakthroughs in large language models and multimodal AI systems have been achieved in 2024.'
              }
            ]
          },
          success: true,
          executionTime: 200
        }
      ]);

      // Simulate initial search
      const initialToolCalls = [
        { id: '1', name: 'tavily-search', arguments: { query: 'AI advances 2024', search_depth: 'basic' } }
      ];

      const results = await (llmService as any).executeMultipleToolsParallel(initialToolCalls);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(mockElectronAPI.callMultipleMCPTools).toHaveBeenCalledWith([
        { id: '1', name: 'tavily-search', args: { query: 'AI advances 2024', search_depth: 'basic' } }
      ]);

      // Verify chaining analysis would suggest memory storage
      const availableTools = await llmService.getMCPToolsForProvider('openai');
      const chainedTools = (llmService as any).analyzeForToolChaining(results, availableTools);

      expect(chainedTools.length).toBeGreaterThan(0);
      expect(chainedTools.some((tool: any) => tool.name === 'memory-store')).toBe(true);
    });

    it('should handle workflow with memory context retrieval', async () => {
      // Mock memory search results
      mockElectronAPI.callMultipleMCPTools.mockResolvedValue([
        {
          id: '1',
          name: 'memory-search',
          result: {
            memories: [
              {
                title: 'User Research Interests',
                content: 'User is particularly interested in machine learning applications in healthcare and autonomous systems.'
              }
            ]
          },
          success: true,
          executionTime: 100
        }
      ]);

      const memoryToolCalls = [
        { id: '1', name: 'memory-search', arguments: { query: 'research interests' } }
      ];

      const results = await (llmService as any).executeMultipleToolsParallel(memoryToolCalls);

      expect(results[0].success).toBe(true);
      
      // Verify that memory results would chain to search
      const availableTools = [
        { function: { name: 'tavily-search', description: 'Search the web' } }
      ];
      
      const chainedTools = (llmService as any).analyzeForToolChaining(results, availableTools);
      expect(chainedTools.some((tool: any) => tool.name === 'tavily-search')).toBe(true);
    });
  });

  describe('Multi-Provider Workflow', () => {
    it('should work with OpenAI provider', async () => {
      const mockSettings = {
        provider: 'openai' as const,
        model: 'gpt-4',
        apiKey: 'test-key',
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: 'You are a helpful assistant.'
      };

      // Mock tool availability
      mockElectronAPI.getAllMCPTools.mockResolvedValue([
        { name: 'test-tool', description: 'Test tool', inputSchema: {} }
      ]);

      const tools = await llmService.getMCPToolsForProvider('openai', mockSettings);
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should work with Anthropic provider', async () => {
      const mockSettings = {
        provider: 'anthropic' as const,
        model: 'claude-3-sonnet',
        apiKey: 'test-key',
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: 'You are a helpful assistant.'
      };

      mockElectronAPI.getAllMCPTools.mockResolvedValue([
        { name: 'test-tool', description: 'Test tool', inputSchema: {} }
      ]);

      const tools = await llmService.getMCPToolsForProvider('anthropic', mockSettings);
      expect(Array.isArray(tools)).toBe(true);
    });

    it('should work with Ollama provider', async () => {
      const mockSettings = {
        provider: 'ollama' as const,
        model: 'llama2',
        apiKey: '',
        baseUrl: 'http://localhost:11434',
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: 'You are a helpful assistant.'
      };

      mockElectronAPI.getAllMCPTools.mockResolvedValue([
        { name: 'test-tool', description: 'Test tool', inputSchema: {} }
      ]);

      const tools = await llmService.getMCPToolsForProvider('ollama', mockSettings);
      expect(Array.isArray(tools)).toBe(true);
    });
  });

  describe('Error Recovery Integration', () => {
    it('should recover from tool failures using alternatives', async () => {
      // Mock initial failure then success with alternative
      mockElectronAPI.callMultipleMCPTools
        .mockResolvedValueOnce([
          {
            id: '1',
            name: 'primary-search',
            result: null,
            success: false,
            error: 'Primary search service unavailable',
            executionTime: 100
          }
        ]);

      // Mock successful alternative tool execution
      mockElectronAPI.callMCPTool.mockResolvedValue({
        results: [{ title: 'Alternative Result', content: 'Found via backup service' }]
      });

      const toolCalls = [
        { id: '1', name: 'primary-search', arguments: { query: 'test query' } }
      ];

      const availableTools = [
        { function: { name: 'primary-search', description: 'Primary search' } },
        { function: { name: 'backup-search', description: 'Backup search service' } }
      ];

      // Execute with recovery
      const results = await (llmService as any).executeToolsWithRecovery(toolCalls, availableTools);

      // Should have attempted recovery
      expect(results).toHaveLength(1);
      // The recovery mechanism should have been triggered
      expect(mockElectronAPI.callMultipleMCPTools).toHaveBeenCalled();
    });

    it('should handle complete tool failure gracefully', async () => {
      // Mock all tools failing
      mockElectronAPI.callMultipleMCPTools.mockResolvedValue([
        {
          id: '1',
          name: 'failing-tool',
          result: null,
          success: false,
          error: 'All services unavailable',
          executionTime: 50
        }
      ]);

      const toolCalls = [
        { id: '1', name: 'failing-tool', arguments: { query: 'test' } }
      ];

      const results = await (llmService as any).executeMultipleToolsParallel(toolCalls);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].result).toContain('All services unavailable');
    });
  });

  describe('Performance Integration', () => {
    it('should execute multiple tools faster than sequential execution', async () => {
      // Mock parallel execution
      const parallelStartTime = Date.now();
      mockElectronAPI.callMultipleMCPTools.mockImplementation(async (toolCalls) => {
        // Simulate parallel execution (all tools complete in max time)
        await new Promise(resolve => setTimeout(resolve, 100));
        return toolCalls.map((tc: any, index: number) => ({
          id: tc.id || `${index}`,
          name: tc.name,
          result: { data: `result-${index}` },
          success: true,
          executionTime: 100
        }));
      });

      const toolCalls = [
        { id: '1', name: 'tool1', arguments: {} },
        { id: '2', name: 'tool2', arguments: {} },
        { id: '3', name: 'tool3', arguments: {} }
      ];

      const results = await (llmService as any).executeMultipleToolsParallel(toolCalls);
      const parallelTime = Date.now() - parallelStartTime;

      expect(results).toHaveLength(3);
      expect(results.every((r: any) => r.success)).toBe(true);
      
      // Parallel execution should complete in roughly the time of the longest tool (100ms)
      // plus some overhead, but much less than 300ms (3 * 100ms sequential)
      expect(parallelTime).toBeLessThan(200);
    });

    it('should handle high concurrency without issues', async () => {
      // Mock many concurrent tools
      const manyToolCalls = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        name: `tool-${i}`,
        arguments: { index: i }
      }));

      mockElectronAPI.callMultipleMCPTools.mockImplementation(async (toolCalls) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return toolCalls.map((tc: any) => ({
          id: tc.id,
          name: tc.name,
          result: { data: `result-${tc.id}` },
          success: true,
          executionTime: 50
        }));
      });

      const results = await (llmService as any).executeMultipleToolsParallel(manyToolCalls);

      expect(results).toHaveLength(20);
      expect(results.every((r: any) => r.success)).toBe(true);
    });
  });

  describe('Workflow State Management', () => {
    it('should maintain context across workflow iterations', async () => {
      // Mock workflow execution with multiple iterations
      const initialTools = [
        { id: '1', name: 'search-tool', arguments: { query: 'initial query' } }
      ];

      // Mock first iteration
      mockElectronAPI.callMultipleMCPTools.mockResolvedValueOnce([
        {
          id: '1',
          name: 'search-tool',
          result: { results: [{ title: 'Initial Result', content: 'Found information' }] },
          success: true,
          executionTime: 100
        }
      ]);

      // Mock second iteration (chained tools)
      mockElectronAPI.callMultipleMCPTools.mockResolvedValueOnce([
        {
          id: 'chain_1_memory-store',
          name: 'memory-store',
          result: { success: true, id: 'mem-123' },
          success: true,
          executionTime: 50
        }
      ]);

      const availableTools = [
        { function: { name: 'search-tool', description: 'Search' } },
        { function: { name: 'memory-store', description: 'Store in memory' } }
      ];

      // Execute workflow
      const workflowResult = await (llmService as any).executeAgenticWorkflow(
        initialTools,
        availableTools,
        2 // max iterations
      );

      expect(workflowResult.results.length).toBeGreaterThan(0);
      expect(workflowResult.workflow.length).toBeGreaterThan(0);
      expect(workflowResult.summary).toContain('Agentic Workflow Summary');
    });
  });
});
