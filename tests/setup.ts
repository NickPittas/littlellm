/**
 * Test setup and global configuration for MCP Agentic Workflows testing
 */

import { vi, beforeEach, afterEach } from 'vitest';
import { testEnvironment } from './test-runner.config';

// Global test setup
beforeEach(() => {
  // Setup mock electron API
  testEnvironment.setupMockElectronAPI();
  
  // Mock console methods to reduce noise in tests
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  
  // Mock performance API if not available
  if (typeof performance === 'undefined') {
    global.performance = {
      now: () => Date.now(),
      mark: () => {},
      measure: () => {},
      getEntriesByName: () => [],
      getEntriesByType: () => [],
      clearMarks: () => {},
      clearMeasures: () => {}
    } as any;
  }
  
  // Mock process.memoryUsage for Node.js environments
  if (typeof process !== 'undefined' && !process.memoryUsage) {
    process.memoryUsage = () => ({
      rss: 0,
      heapTotal: 0,
      heapUsed: 0,
      external: 0,
      arrayBuffers: 0
    });
  }
});

// Global test cleanup
afterEach(() => {
  testEnvironment.cleanup();
});

// Global test utilities
declare global {
  var testUtils: typeof import('./test-runner.config').testUtils;
}

global.testUtils = require('./test-runner.config').testUtils;

// Custom matchers for workflow testing
expect.extend({
  toBeValidWorkflowResult(received: any) {
    const pass = received &&
      typeof received === 'object' &&
      Array.isArray(received.results) &&
      Array.isArray(received.workflow) &&
      typeof received.summary === 'string';
    
    if (pass) {
      return {
        message: () => `Expected ${received} not to be a valid workflow result`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${received} to be a valid workflow result with results, workflow, and summary properties`,
        pass: false
      };
    }
  },
  
  toHaveParallelPerformance(received: number, toolCount: number, baseTime: number) {
    const maxExpectedTime = baseTime * 2; // Allow some overhead
    const pass = received < maxExpectedTime;
    
    if (pass) {
      return {
        message: () => `Expected ${received}ms not to demonstrate parallel performance for ${toolCount} tools`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected ${received}ms to be less than ${maxExpectedTime}ms for parallel execution of ${toolCount} tools`,
        pass: false
      };
    }
  },
  
  toHaveSuccessfulRecovery(received: any[], originalFailures: number) {
    const finalFailures = received.filter(r => !r.success).length;
    const pass = finalFailures < originalFailures;
    
    if (pass) {
      return {
        message: () => `Expected no recovery from ${originalFailures} failures`,
        pass: true
      };
    } else {
      return {
        message: () => `Expected recovery from some of ${originalFailures} failures, but still have ${finalFailures} failures`,
        pass: false
      };
    }
  }
});

// Type declarations for custom matchers
declare module 'vitest' {
  interface Assertion<T = any> {
    toBeValidWorkflowResult(): T;
    toHaveParallelPerformance(toolCount: number, baseTime: number): T;
    toHaveSuccessfulRecovery(originalFailures: number): T;
  }
}

// Test data constants
export const TEST_CONSTANTS = {
  TIMEOUTS: {
    UNIT: 5000,
    INTEGRATION: 10000,
    PERFORMANCE: 15000,
    STRESS: 30000
  },
  
  PERFORMANCE_THRESHOLDS: {
    PARALLEL_EFFICIENCY: 0.5, // 50% improvement over sequential
    MAX_PARALLEL_OVERHEAD: 0.3, // 30% max overhead
    MEMORY_LIMIT_MB: 100, // 100MB memory limit for tests
    AGGREGATION_TIME_MS: 100 // Max 100ms for result aggregation
  },
  
  STRESS_TEST_PARAMS: {
    HIGH_CONCURRENCY_COUNT: 100,
    MASSIVE_CONCURRENCY_COUNT: 200,
    HIGH_FAILURE_RATE: 0.5,
    COMPLETE_FAILURE_RATE: 1.0,
    SLOW_RESPONSE_RATE: 0.3,
    MEMORY_INTENSIVE_SIZE: 10000
  },
  
  MOCK_DELAYS: {
    FAST: 10,
    NORMAL: 50,
    SLOW: 200,
    VERY_SLOW: 500
  }
};

// Test logging utilities
export const testLogger = {
  logPerformance: (testName: string, metrics: any) => {
    console.log(`[PERFORMANCE] ${testName}:`, {
      executionTime: `${metrics.executionTime?.toFixed(2)}ms`,
      memoryDelta: `${metrics.memoryDelta?.toFixed(2)}MB`,
      memoryPeak: `${metrics.memoryPeak?.toFixed(2)}MB`
    });
  },
  
  logWorkflow: (testName: string, workflowResult: any) => {
    console.log(`[WORKFLOW] ${testName}:`, {
      iterations: workflowResult.workflow?.length,
      totalTools: workflowResult.results?.length,
      successRate: `${Math.round((workflowResult.results?.filter((r: any) => r.success).length / workflowResult.results?.length) * 100)}%`
    });
  },
  
  logStress: (testName: string, results: any[], params: any) => {
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    
    console.log(`[STRESS] ${testName}:`, {
      totalTools: results.length,
      successes: successCount,
      failures: failureCount,
      successRate: `${Math.round((successCount / results.length) * 100)}%`,
      params
    });
  }
};

// Mock data generators
export const mockDataGenerators = {
  createMockToolResponse: (toolName: string, success: boolean = true, delay: number = 50) => ({
    id: `mock-${toolName}-${Date.now()}`,
    name: toolName,
    result: success ? { data: `Mock result for ${toolName}` } : null,
    success,
    error: success ? undefined : `Mock error for ${toolName}`,
    executionTime: delay
  }),
  
  createMockSearchResult: (query: string, index: number = 0) => ({
    title: `${query} - Result ${index + 1}`,
    url: `https://example${index + 1}.com/search?q=${encodeURIComponent(query)}`,
    content: `Detailed content about ${query} from source ${index + 1}. This provides comprehensive information and insights.`,
    snippet: `Brief snippet about ${query} from source ${index + 1}...`,
    score: Math.random() * 0.5 + 0.5,
    timestamp: Date.now() - (index * 3600000) // Hours ago
  }),
  
  createMockMemory: (title: string, content: string, type: string = 'general') => ({
    id: `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    content,
    type,
    tags: [type, 'test', 'mock'],
    timestamp: Date.now(),
    relevance: Math.random() * 0.5 + 0.5,
    metadata: {
      source: 'test',
      version: 1
    }
  })
};

// Test assertion helpers
export const assertionHelpers = {
  assertValidToolResult: (result: any, expectedName?: string) => {
    expect(result).toBeDefined();
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('executionTime');
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.executionTime).toBe('number');
    
    if (expectedName) {
      expect(result.name).toBe(expectedName);
    }
  },
  
  assertValidAggregatedResult: (aggregated: string) => {
    expect(typeof aggregated).toBe('string');
    expect(aggregated.length).toBeGreaterThan(0);
    expect(aggregated).toContain('Multi-Tool Execution');
  },
  
  assertParallelEfficiency: (parallelTime: number, sequentialTime: number, tolerance: number = 0.7) => {
    expect(parallelTime).toBeLessThan(sequentialTime * tolerance);
    
    const efficiency = (sequentialTime - parallelTime) / sequentialTime;
    expect(efficiency).toBeGreaterThan(0.2); // At least 20% improvement
  },
  
  assertErrorRecoveryAttempted: (mockAPI: any, originalFailures: number) => {
    // Verify that recovery mechanisms were triggered
    expect(mockAPI.callMultipleMCPTools).toHaveBeenCalled();
    
    // Additional recovery-specific assertions can be added here
    // based on the specific recovery implementation
  }
};

// All exports are already defined above with individual export statements
