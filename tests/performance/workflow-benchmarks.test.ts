/**
 * Performance benchmark tests for MCP Agentic Workflows
 * Measures parallel execution efficiency, memory usage, and scalability
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LLMService } from '../../src/services/llmService';

// Performance measurement utilities
class PerformanceMonitor {
  private startTime: number = 0;
  private memoryStart: number = 0;

  start() {
    this.startTime = performance.now();
    this.memoryStart = this.getMemoryUsage();
  }

  end() {
    const endTime = performance.now();
    const memoryEnd = this.getMemoryUsage();
    
    return {
      executionTime: endTime - this.startTime,
      memoryDelta: memoryEnd - this.memoryStart,
      memoryPeak: memoryEnd
    };
  }

  private getMemoryUsage(): number {
    // In Node.js environment
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024; // MB
    }
    // In browser environment (approximate)
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      return (performance as any).memory.usedJSHeapSize / 1024 / 1024; // MB
    }
    return 0;
  }
}

// Mock electron API with performance simulation
const createMockElectronAPI = (simulatedDelay: number = 100) => ({
  callMCPTool: vi.fn().mockImplementation(async (toolName: string, args: any) => {
    await new Promise(resolve => setTimeout(resolve, simulatedDelay));
    return { result: `Mock result for ${toolName}`, args };
  }),
  
  callMultipleMCPTools: vi.fn().mockImplementation(async (toolCalls: any[]) => {
    // Simulate parallel execution - all tools complete in max delay time
    await new Promise(resolve => setTimeout(resolve, simulatedDelay));
    return toolCalls.map((tc, index) => ({
      id: tc.id || `${index}`,
      name: tc.name,
      result: { data: `parallel-result-${index}` },
      success: true,
      executionTime: simulatedDelay
    }));
  }),
  
  getAllMCPTools: vi.fn().mockResolvedValue([]),
  getMCPServers: vi.fn().mockResolvedValue({ servers: [] }),
  getConnectedMCPServerIds: vi.fn().mockResolvedValue([])
});

describe('Workflow Performance Benchmarks', () => {
  let llmService: LLMService;
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    llmService = new LLMService();
    monitor = new PerformanceMonitor();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Parallel vs Sequential Execution', () => {
    it('should demonstrate parallel execution performance advantage', async () => {
      const mockAPI = createMockElectronAPI(100); // 100ms per tool
      Object.defineProperty(window, 'electronAPI', { value: mockAPI, writable: true });

      const toolCalls = [
        { id: '1', name: 'tool1', arguments: {} },
        { id: '2', name: 'tool2', arguments: {} },
        { id: '3', name: 'tool3', arguments: {} },
        { id: '4', name: 'tool4', arguments: {} },
        { id: '5', name: 'tool5', arguments: {} }
      ];

      // Test parallel execution
      monitor.start();
      const parallelResults = await (llmService as any).executeMultipleToolsParallel(toolCalls);
      const parallelMetrics = monitor.end();

      expect(parallelResults).toHaveLength(5);
      expect(parallelResults.every((r: any) => r.success)).toBe(true);
      
      // Parallel execution should complete in ~100ms (not 500ms)
      expect(parallelMetrics.executionTime).toBeLessThan(200);
      
      console.log(`Parallel execution: ${parallelMetrics.executionTime.toFixed(2)}ms`);
      console.log(`Memory usage: ${parallelMetrics.memoryDelta.toFixed(2)}MB`);
    });

    it('should measure sequential execution for comparison', async () => {
      const mockAPI = createMockElectronAPI(100);
      Object.defineProperty(window, 'electronAPI', { value: mockAPI, writable: true });

      const toolCalls = [
        { id: '1', name: 'tool1', arguments: {} },
        { id: '2', name: 'tool2', arguments: {} },
        { id: '3', name: 'tool3', arguments: {} },
        { id: '4', name: 'tool4', arguments: {} },
        { id: '5', name: 'tool5', arguments: {} }
      ];

      // Force sequential execution by mocking failure of parallel method
      mockAPI.callMultipleMCPTools.mockRejectedValue(new Error('Force sequential'));

      monitor.start();
      const sequentialResults = await (llmService as any).executeMultipleToolsParallel(toolCalls);
      const sequentialMetrics = monitor.end();

      expect(sequentialResults).toHaveLength(5);
      
      // Sequential execution should take ~500ms (5 * 100ms)
      expect(sequentialMetrics.executionTime).toBeGreaterThan(400);
      
      console.log(`Sequential execution: ${sequentialMetrics.executionTime.toFixed(2)}ms`);
      console.log(`Memory usage: ${sequentialMetrics.memoryDelta.toFixed(2)}MB`);
    });
  });

  describe('Scalability Tests', () => {
    it('should handle increasing tool counts efficiently', async () => {
      const toolCounts = [1, 5, 10, 20, 50];
      const results: Array<{ count: number; time: number; memory: number }> = [];

      for (const count of toolCounts) {
        const mockAPI = createMockElectronAPI(50); // 50ms per tool
        Object.defineProperty(window, 'electronAPI', { value: mockAPI, writable: true });

        const toolCalls = Array.from({ length: count }, (_, i) => ({
          id: `${i}`,
          name: `tool-${i}`,
          arguments: { index: i }
        }));

        monitor.start();
        const toolResults = await (llmService as any).executeMultipleToolsParallel(toolCalls);
        const metrics = monitor.end();

        expect(toolResults).toHaveLength(count);
        expect(toolResults.every((r: any) => r.success)).toBe(true);

        results.push({
          count,
          time: metrics.executionTime,
          memory: metrics.memoryDelta
        });

        console.log(`${count} tools: ${metrics.executionTime.toFixed(2)}ms, ${metrics.memoryDelta.toFixed(2)}MB`);
      }

      // Verify that execution time doesn't scale linearly with tool count (parallel benefit)
      const timeFor1 = results.find(r => r.count === 1)?.time || 0;
      const timeFor50 = results.find(r => r.count === 50)?.time || 0;
      
      // Time for 50 tools should be much less than 50x the time for 1 tool
      expect(timeFor50).toBeLessThan(timeFor1 * 10);
    });

    it('should maintain performance under memory pressure', async () => {
      const mockAPI = createMockElectronAPI(10);
      Object.defineProperty(window, 'electronAPI', { value: mockAPI, writable: true });

      // Create large tool calls with substantial data
      const largeToolCalls = Array.from({ length: 100 }, (_, i) => ({
        id: `large-${i}`,
        name: `memory-intensive-tool-${i}`,
        arguments: {
          largeData: Array.from({ length: 1000 }, (_, j) => `data-${i}-${j}`).join(' ')
        }
      }));

      monitor.start();
      const results = await (llmService as any).executeMultipleToolsParallel(largeToolCalls);
      const metrics = monitor.end();

      expect(results).toHaveLength(100);
      expect(results.every((r: any) => r.success)).toBe(true);
      
      console.log(`Memory-intensive test: ${metrics.executionTime.toFixed(2)}ms, ${metrics.memoryDelta.toFixed(2)}MB`);
      
      // Should complete within reasonable time despite large data
      expect(metrics.executionTime).toBeLessThan(1000);
    });
  });

  describe('Error Recovery Performance', () => {
    it('should measure error recovery overhead', async () => {
      const mockAPI = createMockElectronAPI(50);
      
      // Mock some tools to fail initially
      mockAPI.callMultipleMCPTools.mockImplementation(async (toolCalls: any[]) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return toolCalls.map((tc, index) => ({
          id: tc.id,
          name: tc.name,
          result: index % 3 === 0 ? null : { data: `result-${index}` }, // Every 3rd tool fails
          success: index % 3 !== 0,
          error: index % 3 === 0 ? 'Simulated failure' : undefined,
          executionTime: 50
        }));
      });

      // Mock successful recovery calls
      mockAPI.callMCPTool.mockResolvedValue({ data: 'recovery-result' });

      Object.defineProperty(window, 'electronAPI', { value: mockAPI, writable: true });

      const toolCalls = Array.from({ length: 15 }, (_, i) => ({
        id: `${i}`,
        name: `tool-${i}`,
        arguments: {}
      }));

      const availableTools = toolCalls.map(tc => ({
        function: { name: `backup-${tc.name}`, description: 'Backup tool' }
      }));

      monitor.start();
      const results = await (llmService as any).executeToolsWithRecovery(toolCalls, availableTools);
      const metrics = monitor.end();

      expect(results).toHaveLength(15);
      
      console.log(`Error recovery test: ${metrics.executionTime.toFixed(2)}ms, ${metrics.memoryDelta.toFixed(2)}MB`);
      
      // Recovery should add some overhead but not be excessive
      expect(metrics.executionTime).toBeLessThan(500);
    });
  });

  describe('Workflow Iteration Performance', () => {
    it('should measure multi-iteration workflow performance', async () => {
      const mockAPI = createMockElectronAPI(30);
      Object.defineProperty(window, 'electronAPI', { value: mockAPI, writable: true });

      // Mock chaining behavior
      mockAPI.callMultipleMCPTools.mockImplementation(async (toolCalls: any[]) => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return toolCalls.map((tc, index) => ({
          id: tc.id,
          name: tc.name,
          result: { 
            data: `iteration-result-${index}`,
            // Simulate data that would trigger chaining
            chainable: index < 2 // First 2 tools trigger chaining
          },
          success: true,
          executionTime: 30
        }));
      });

      const initialTools = [
        { id: '1', name: 'search-tool', arguments: { query: 'test' } },
        { id: '2', name: 'analysis-tool', arguments: { data: 'test' } }
      ];

      const availableTools = [
        { function: { name: 'search-tool', description: 'Search' } },
        { function: { name: 'analysis-tool', description: 'Analyze' } },
        { function: { name: 'memory-store', description: 'Store' } },
        { function: { name: 'summary-tool', description: 'Summarize' } }
      ];

      monitor.start();
      const workflowResult = await (llmService as any).executeAgenticWorkflow(
        initialTools,
        availableTools,
        3 // max iterations
      );
      const metrics = monitor.end();

      expect(workflowResult.results.length).toBeGreaterThan(0);
      expect(workflowResult.workflow.length).toBeGreaterThan(0);
      
      console.log(`Multi-iteration workflow: ${metrics.executionTime.toFixed(2)}ms, ${metrics.memoryDelta.toFixed(2)}MB`);
      console.log(`Iterations: ${workflowResult.workflow.length}, Total tools: ${workflowResult.results.length}`);
      
      // Multi-iteration workflow should complete efficiently
      expect(metrics.executionTime).toBeLessThan(1000);
    });
  });

  describe('Response Aggregation Performance', () => {
    it('should measure aggregation performance with large result sets', async () => {
      // Create large result set
      const largeResults = Array.from({ length: 100 }, (_, i) => ({
        id: `${i}`,
        name: `tool-${i}`,
        result: JSON.stringify({
          data: Array.from({ length: 100 }, (_, j) => `result-${i}-${j}`),
          metadata: { index: i, timestamp: Date.now() }
        }),
        success: i % 10 !== 0, // 10% failure rate
        executionTime: Math.random() * 100 + 50
      }));

      monitor.start();
      const aggregated = (llmService as any).aggregateToolResults(largeResults);
      const metrics = monitor.end();

      expect(typeof aggregated).toBe('string');
      expect(aggregated.length).toBeGreaterThan(0);
      expect(aggregated).toContain('Multi-Tool Execution Results');
      
      console.log(`Aggregation performance: ${metrics.executionTime.toFixed(2)}ms for ${largeResults.length} results`);
      console.log(`Aggregated content length: ${aggregated.length} characters`);
      
      // Aggregation should be fast even for large result sets
      expect(metrics.executionTime).toBeLessThan(100);
    });
  });

  describe('Real-world Performance Scenarios', () => {
    it('should benchmark a typical research workflow', async () => {
      const mockAPI = createMockElectronAPI(80);
      Object.defineProperty(window, 'electronAPI', { value: mockAPI, writable: true });

      // Simulate research workflow: search + memory + analysis + storage
      const researchWorkflow = [
        { id: '1', name: 'tavily-search', arguments: { query: 'AI research 2024' } },
        { id: '2', name: 'memory-search', arguments: { query: 'user research interests' } },
        { id: '3', name: 'content-analysis', arguments: { text: 'research content' } },
        { id: '4', name: 'memory-store', arguments: { type: 'research', content: 'findings' } }
      ];

      monitor.start();
      const results = await (llmService as any).executeMultipleToolsParallel(researchWorkflow);
      const aggregated = (llmService as any).aggregateToolResults(results);
      const metrics = monitor.end();

      expect(results).toHaveLength(4);
      expect(aggregated).toContain('Multi-Tool Execution Results');

      console.log(`Research workflow: ${metrics.executionTime.toFixed(2)}ms`);

      // Research workflow should complete quickly
      expect(metrics.executionTime).toBeLessThan(200);
    });

    it('should benchmark a content creation workflow', async () => {
      const mockAPI = createMockElectronAPI(60);
      Object.defineProperty(window, 'electronAPI', { value: mockAPI, writable: true });

      // Simulate content creation: research + outline + draft + review
      const contentWorkflow = [
        { id: '1', name: 'web-search', arguments: { query: 'topic research' } },
        { id: '2', name: 'outline-generator', arguments: { topic: 'content topic' } },
        { id: '3', name: 'draft-writer', arguments: { outline: 'content outline' } },
        { id: '4', name: 'content-reviewer', arguments: { draft: 'content draft' } },
        { id: '5', name: 'seo-optimizer', arguments: { content: 'final content' } }
      ];

      monitor.start();
      const results = await (llmService as any).executeMultipleToolsParallel(contentWorkflow);
      const metrics = monitor.end();

      expect(results).toHaveLength(5);

      console.log(`Content creation workflow: ${metrics.executionTime.toFixed(2)}ms`);

      // Content workflow should be efficient
      expect(metrics.executionTime).toBeLessThan(150);
    });
  });
});
