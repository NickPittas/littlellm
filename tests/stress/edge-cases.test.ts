/**
 * Stress tests and edge case scenarios for MCP Agentic Workflows
 * Tests failure scenarios, timeout handling, resource limits, and concurrent execution edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LLMService } from '../../src/services/llmService';

// Stress test utilities
const createStressTestAPI = (options: {
  failureRate?: number;
  timeoutRate?: number;
  slowResponseRate?: number;
  baseDelay?: number;
}) => {
  const { failureRate = 0, timeoutRate = 0, slowResponseRate = 0, baseDelay = 50 } = options;

  return {
    callMCPTool: vi.fn().mockImplementation(async (toolName: string, args: any) => {
      const random = Math.random();
      
      if (random < failureRate) {
        throw new Error(`Simulated failure for ${toolName}`);
      }
      
      if (random < timeoutRate) {
        // Simulate timeout
        await new Promise(resolve => setTimeout(resolve, 30000));
        throw new Error(`Timeout for ${toolName}`);
      }
      
      const delay = random < slowResponseRate ? baseDelay * 10 : baseDelay;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return { result: `Success for ${toolName}`, args };
    }),

    callMultipleMCPTools: vi.fn().mockImplementation(async (toolCalls: any[]) => {
      const results = [];
      
      for (const tc of toolCalls) {
        const random = Math.random();
        
        if (random < failureRate) {
          results.push({
            id: tc.id,
            name: tc.name,
            result: null,
            success: false,
            error: `Simulated failure for ${tc.name}`,
            executionTime: baseDelay
          });
        } else {
          const delay = random < slowResponseRate ? baseDelay * 10 : baseDelay;
          await new Promise(resolve => setTimeout(resolve, delay));
          
          results.push({
            id: tc.id,
            name: tc.name,
            result: { data: `Success for ${tc.name}` },
            success: true,
            executionTime: delay
          });
        }
      }
      
      return results;
    }),

    getAllMCPTools: vi.fn().mockResolvedValue([]),
    getMCPServers: vi.fn().mockResolvedValue({ servers: [] }),
    getConnectedMCPServerIds: vi.fn().mockResolvedValue([])
  };
};

describe('Stress Tests and Edge Cases', () => {
  let llmService: LLMService;

  beforeEach(() => {
    llmService = new LLMService();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('High Failure Rate Scenarios', () => {
    it('should handle 50% tool failure rate gracefully', async () => {
      const stressAPI = createStressTestAPI({ failureRate: 0.5, baseDelay: 20 });
      Object.defineProperty(window, 'electronAPI', { value: stressAPI, writable: true });

      const toolCalls = Array.from({ length: 20 }, (_, i) => ({
        id: `${i}`,
        name: `stress-tool-${i}`,
        arguments: { index: i }
      }));

      const results = await (llmService as any).executeMultipleToolsParallel(toolCalls);

      expect(results).toHaveLength(20);
      
      const successCount = results.filter((r: any) => r.success).length;
      const failureCount = results.filter((r: any) => !r.success).length;
      
      // Should have roughly 50% success rate (with some variance)
      expect(successCount).toBeGreaterThan(5);
      expect(failureCount).toBeGreaterThan(5);
      
      console.log(`High failure test: ${successCount} successes, ${failureCount} failures`);
    });

    it('should handle complete tool failure scenario', async () => {
      const stressAPI = createStressTestAPI({ failureRate: 1.0, baseDelay: 10 });
      Object.defineProperty(window, 'electronAPI', { value: stressAPI, writable: true });

      const toolCalls = [
        { id: '1', name: 'failing-tool-1', arguments: {} },
        { id: '2', name: 'failing-tool-2', arguments: {} },
        { id: '3', name: 'failing-tool-3', arguments: {} }
      ];

      const results = await (llmService as any).executeMultipleToolsParallel(toolCalls);

      expect(results).toHaveLength(3);
      expect(results.every((r: any) => !r.success)).toBe(true);
      
      const aggregated = (llmService as any).aggregateToolResults(results);
      expect(aggregated).toContain('❌ Failed Results');
      expect(aggregated).toContain('Success Rate: 0%');
    });
  });

  describe('Resource Exhaustion Scenarios', () => {
    it('should handle excessive concurrent tool execution', async () => {
      const stressAPI = createStressTestAPI({ baseDelay: 5 });
      Object.defineProperty(window, 'electronAPI', { value: stressAPI, writable: true });

      // Create 200 concurrent tool calls
      const massiveToolCalls = Array.from({ length: 200 }, (_, i) => ({
        id: `massive-${i}`,
        name: `concurrent-tool-${i}`,
        arguments: { batch: Math.floor(i / 10) }
      }));

      const startTime = Date.now();
      const results = await (llmService as any).executeMultipleToolsParallel(massiveToolCalls);
      const executionTime = Date.now() - startTime;

      expect(results).toHaveLength(200);
      expect(results.every((r: any) => r.success)).toBe(true);
      
      console.log(`Massive concurrency test: ${results.length} tools in ${executionTime}ms`);
      
      // Should complete in reasonable time despite high concurrency
      expect(executionTime).toBeLessThan(2000);
    });

    it('should handle memory-intensive tool operations', async () => {
      const stressAPI = createStressTestAPI({ baseDelay: 30 });
      Object.defineProperty(window, 'electronAPI', { value: stressAPI, writable: true });

      // Create tools with large argument payloads
      const memoryIntensiveTools = Array.from({ length: 50 }, (_, i) => ({
        id: `memory-${i}`,
        name: `memory-intensive-tool-${i}`,
        arguments: {
          largeData: Array.from({ length: 10000 }, (_, j) => `data-${i}-${j}`),
          metadata: {
            index: i,
            timestamp: Date.now(),
            description: `Memory intensive operation ${i} with large payload data structure`
          }
        }
      }));

      const results = await (llmService as any).executeMultipleToolsParallel(memoryIntensiveTools);

      expect(results).toHaveLength(50);
      expect(results.every((r: any) => r.success)).toBe(true);
      
      console.log(`Memory intensive test: ${results.length} tools with large payloads`);
    });
  });

  describe('Timeout and Slow Response Scenarios', () => {
    it('should handle mixed fast and slow tool responses', async () => {
      const stressAPI = createStressTestAPI({ 
        slowResponseRate: 0.3, // 30% slow responses
        baseDelay: 20 
      });
      Object.defineProperty(window, 'electronAPI', { value: stressAPI, writable: true });

      const mixedSpeedTools = Array.from({ length: 15 }, (_, i) => ({
        id: `mixed-${i}`,
        name: `speed-test-tool-${i}`,
        arguments: { expectedSpeed: i % 3 === 0 ? 'slow' : 'fast' }
      }));

      const startTime = Date.now();
      const results = await (llmService as any).executeMultipleToolsParallel(mixedSpeedTools);
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(15);
      expect(results.every((r: any) => r.success)).toBe(true);
      
      // Should complete in time dominated by slowest tools, not sum of all
      const slowToolCount = Math.ceil(15 * 0.3);
      console.log(`Mixed speed test: ${totalTime}ms for ${results.length} tools (${slowToolCount} slow)`);
      
      // Should be much faster than sequential execution of slow tools
      expect(totalTime).toBeLessThan(slowToolCount * 200 * 10);
    });

    it('should handle extremely slow tool responses', async () => {
      const stressAPI = createStressTestAPI({ 
        slowResponseRate: 1.0, // All slow
        baseDelay: 500 // Very slow base delay
      });
      Object.defineProperty(window, 'electronAPI', { value: stressAPI, writable: true });

      const slowTools = [
        { id: '1', name: 'very-slow-tool-1', arguments: {} },
        { id: '2', name: 'very-slow-tool-2', arguments: {} }
      ];

      const startTime = Date.now();
      const results = await (llmService as any).executeMultipleToolsParallel(slowTools);
      const totalTime = Date.now() - startTime;

      expect(results).toHaveLength(2);
      expect(results.every((r: any) => r.success)).toBe(true);
      
      console.log(`Very slow test: ${totalTime}ms for ${results.length} tools`);
      
      // Parallel execution should complete in ~5000ms, not 10000ms
      expect(totalTime).toBeLessThan(7000);
      expect(totalTime).toBeGreaterThan(4500);
    });
  });

  describe('Edge Case Data Scenarios', () => {
    it('should handle empty tool call arrays', async () => {
      const stressAPI = createStressTestAPI({});
      Object.defineProperty(window, 'electronAPI', { value: stressAPI, writable: true });

      const emptyResults = await (llmService as any).executeMultipleToolsParallel([]);
      
      expect(emptyResults).toHaveLength(0);
      expect(Array.isArray(emptyResults)).toBe(true);
    });

    it('should handle malformed tool arguments', async () => {
      const stressAPI = createStressTestAPI({ baseDelay: 10 });
      Object.defineProperty(window, 'electronAPI', { value: stressAPI, writable: true });

      const malformedTools = [
        { id: '1', name: 'tool-1', arguments: null },
        { id: '2', name: 'tool-2', arguments: undefined },
        { id: '3', name: 'tool-3', arguments: { circular: {} } },
        { id: '4', name: 'tool-4', arguments: 'not-an-object' }
      ];

      // Add circular reference
      (malformedTools[2].arguments as any).circular.self = malformedTools[2].arguments;

      const results = await (llmService as any).executeMultipleToolsParallel(malformedTools);

      expect(results).toHaveLength(4);
      // Should handle malformed arguments gracefully
      expect(results.every((r: any) => typeof r.success === 'boolean')).toBe(true);
    });

    it('should handle extremely large result sets', async () => {
      const stressAPI = createStressTestAPI({ baseDelay: 5 });
      
      // Mock large result data
      stressAPI.callMultipleMCPTools.mockImplementation(async (toolCalls: any[]) => {
        return toolCalls.map((tc, index) => ({
          id: tc.id,
          name: tc.name,
          result: {
            largeDataSet: Array.from({ length: 1000 }, (_, i) => ({
              id: `data-${index}-${i}`,
              content: `Large content block ${i} for tool ${tc.name}`,
              metadata: { index: i, toolIndex: index, timestamp: Date.now() }
            }))
          },
          success: true,
          executionTime: 5
        }));
      });

      Object.defineProperty(window, 'electronAPI', { value: stressAPI, writable: true });

      const largeResultTools = Array.from({ length: 10 }, (_, i) => ({
        id: `large-${i}`,
        name: `large-result-tool-${i}`,
        arguments: {}
      }));

      const results = await (llmService as any).executeMultipleToolsParallel(largeResultTools);
      
      expect(results).toHaveLength(10);
      expect(results.every((r: any) => r.success)).toBe(true);
      
      // Test aggregation with large results
      const aggregated = (llmService as any).aggregateToolResults(results);
      expect(typeof aggregated).toBe('string');
      expect(aggregated.length).toBeGreaterThan(1000);
      
      console.log(`Large result test: ${aggregated.length} characters in aggregated output`);
    });
  });

  describe('Workflow Iteration Edge Cases', () => {
    it('should handle infinite chaining prevention', async () => {
      const stressAPI = createStressTestAPI({ baseDelay: 10 });
      Object.defineProperty(window, 'electronAPI', { value: stressAPI, writable: true });

      // Mock tools that would always trigger chaining
      stressAPI.callMultipleMCPTools.mockImplementation(async (toolCalls: any[]) => {
        return toolCalls.map(tc => ({
          id: tc.id,
          name: tc.name,
          result: {
            // Result that would trigger memory storage chaining
            results: [{ title: 'Always chainable', content: 'This should trigger chaining' }]
          },
          success: true,
          executionTime: 10
        }));
      });

      const chainableTools = [
        { id: '1', name: 'search-tool', arguments: { query: 'test' } }
      ];

      const availableTools = [
        { function: { name: 'search-tool', description: 'Search' } },
        { function: { name: 'memory-store', description: 'Store in memory' } }
      ];

      const workflowResult = await (llmService as any).executeAgenticWorkflow(
        chainableTools,
        availableTools,
        10 // High max iterations
      );

      // Should not run forever - should be limited by max iterations or chaining limits
      expect(workflowResult.workflow.length).toBeLessThanOrEqual(10);
      expect(workflowResult.results.length).toBeGreaterThan(0);
      
      console.log(`Infinite chaining test: ${workflowResult.workflow.length} iterations, ${workflowResult.results.length} total tools`);
    });

    it('should handle workflow with no chainable tools', async () => {
      const stressAPI = createStressTestAPI({ baseDelay: 10 });
      Object.defineProperty(window, 'electronAPI', { value: stressAPI, writable: true });

      const isolatedTools = [
        { id: '1', name: 'isolated-tool', arguments: {} }
      ];

      const limitedAvailableTools = [
        { function: { name: 'isolated-tool', description: 'Isolated tool with no chaining' } }
      ];

      const workflowResult = await (llmService as any).executeAgenticWorkflow(
        isolatedTools,
        limitedAvailableTools,
        5
      );

      // Should complete in 1 iteration since no chaining is possible
      expect(workflowResult.workflow.length).toBe(1);
      expect(workflowResult.results.length).toBe(1);
      expect(workflowResult.summary).toContain('1');
    });
  });
});
