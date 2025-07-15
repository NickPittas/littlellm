/**
 * Test runner configuration for MCP Agentic Workflows
 * Configures test suites, timeouts, and reporting for comprehensive testing
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Test environment configuration
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    
    // Timeout configuration for different test types
    testTimeout: 30000, // 30 seconds for regular tests
    hookTimeout: 10000, // 10 seconds for setup/teardown
    
    // Test file patterns
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**'
    ],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './tests/coverage',
      include: [
        'src/services/llmService.ts',
        'src/services/mcpService.ts'
      ],
      exclude: [
        'tests/**',
        'node_modules/**',
        '**/*.d.ts'
      ],
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70
        }
      }
    },
    
    // Reporter configuration
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './tests/results/test-results.json',
      html: './tests/results/test-results.html'
    },
    
    // Parallel execution configuration
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1
      }
    },
    
    // Test categorization
    sequence: {
      shuffle: false,
      concurrent: true
    }
  },
  
  // Resolve configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
      '@tests': path.resolve(__dirname, '.')
    }
  },
  
  // Define custom test configurations for different test types
  define: {
    __TEST_TIMEOUT_UNIT__: 1000,
    __TEST_TIMEOUT_INTEGRATION__: 5000,
    __TEST_TIMEOUT_PERFORMANCE__: 10000,
    __TEST_TIMEOUT_STRESS__: 30000
  }
});

// Test suite configurations
export const testSuites = {
  unit: {
    pattern: 'tests/agentic-workflows.test.ts',
    timeout: 5000,
    description: 'Unit tests for core agentic workflow components'
  },
  
  integration: {
    pattern: 'tests/integration/**/*.test.ts',
    timeout: 10000,
    description: 'End-to-end integration tests across providers and servers'
  },
  
  performance: {
    pattern: 'tests/performance/**/*.test.ts',
    timeout: 15000,
    description: 'Performance benchmarks and scalability tests'
  },
  
  scenarios: {
    pattern: 'tests/scenarios/**/*.test.ts',
    timeout: 10000,
    description: 'Realistic workflow scenario tests'
  },
  
  stress: {
    pattern: 'tests/stress/**/*.test.ts',
    timeout: 30000,
    description: 'Stress tests and edge case scenarios'
  }
};

// Test execution strategies
export const executionStrategies = {
  // Quick smoke test - essential functionality only
  smoke: {
    suites: ['unit'],
    parallel: true,
    timeout: 5000,
    description: 'Quick validation of core functionality'
  },
  
  // Standard test run - comprehensive but efficient
  standard: {
    suites: ['unit', 'integration', 'scenarios'],
    parallel: true,
    timeout: 10000,
    description: 'Comprehensive testing of functionality and integration'
  },
  
  // Full test suite - everything including performance and stress
  full: {
    suites: ['unit', 'integration', 'performance', 'scenarios', 'stress'],
    parallel: false, // Sequential for accurate performance measurements
    timeout: 30000,
    description: 'Complete test coverage including performance and stress testing'
  },
  
  // Performance-focused testing
  performance: {
    suites: ['performance', 'stress'],
    parallel: false,
    timeout: 30000,
    description: 'Performance benchmarking and stress testing only'
  },
  
  // CI/CD optimized testing
  ci: {
    suites: ['unit', 'integration'],
    parallel: true,
    timeout: 8000,
    description: 'Optimized for continuous integration environments'
  }
};

// Test data generators and utilities
export const testUtils = {
  // Generate mock tool calls for testing
  generateMockToolCalls: (count: number, namePrefix: string = 'test-tool') => {
    return Array.from({ length: count }, (_, i) => ({
      id: `${namePrefix}-${i}`,
      name: `${namePrefix}-${i}`,
      arguments: {
        index: i,
        timestamp: Date.now(),
        testData: `mock-data-${i}`
      }
    }));
  },
  
  // Generate mock search results
  generateMockSearchResults: (query: string, count: number = 3) => ({
    results: Array.from({ length: count }, (_, i) => ({
      title: `${query} Result ${i + 1}`,
      url: `https://example${i + 1}.com/${query.toLowerCase().replace(/\s+/g, '-')}`,
      content: `Detailed information about ${query} from source ${i + 1}.`,
      snippet: `Brief snippet about ${query}...`,
      score: Math.random() * 0.5 + 0.5 // Random score between 0.5-1.0
    }))
  }),
  
  // Generate mock memory results
  generateMockMemoryResults: (query: string, count: number = 2) => ({
    success: true,
    memories: Array.from({ length: count }, (_, i) => ({
      id: `mem-${query}-${i}`,
      title: `Memory: ${query} ${i + 1}`,
      content: `Stored information about ${query} from previous interactions.`,
      type: 'user_preference',
      tags: [query.toLowerCase(), 'test'],
      timestamp: Date.now() - (i * 86400000),
      relevance: Math.random() * 0.5 + 0.5
    }))
  }),
  
  // Performance measurement utilities
  measurePerformance: async <T>(operation: () => Promise<T>) => {
    const startTime = performance.now();
    const startMemory = process.memoryUsage?.()?.heapUsed || 0;
    
    const result = await operation();
    
    const endTime = performance.now();
    const endMemory = process.memoryUsage?.()?.heapUsed || 0;
    
    return {
      result,
      metrics: {
        executionTime: endTime - startTime,
        memoryDelta: (endMemory - startMemory) / 1024 / 1024, // MB
        memoryPeak: endMemory / 1024 / 1024 // MB
      }
    };
  },
  
  // Assertion helpers for workflow testing
  assertWorkflowSuccess: (results: any[], expectedCount: number) => {
    expect(results).toHaveLength(expectedCount);
    expect(results.every(r => typeof r.success === 'boolean')).toBe(true);
    expect(results.some(r => r.success)).toBe(true);
  },
  
  assertParallelPerformance: (executionTime: number, toolCount: number, baseTime: number) => {
    // Parallel execution should be much faster than sequential
    const sequentialTime = toolCount * baseTime;
    const parallelEfficiency = (sequentialTime - executionTime) / sequentialTime;
    
    expect(parallelEfficiency).toBeGreaterThan(0.5); // At least 50% improvement
    expect(executionTime).toBeLessThan(sequentialTime * 0.7); // Max 70% of sequential time
  },
  
  assertErrorRecovery: (results: any[], originalFailures: number) => {
    const finalFailures = results.filter(r => !r.success).length;
    const recoveredCount = originalFailures - finalFailures;
    
    expect(recoveredCount).toBeGreaterThanOrEqual(0);
    return { recoveredCount, finalFailures };
  }
};

// Test environment setup
export const testEnvironment = {
  // Mock electron API setup
  setupMockElectronAPI: (customMocks: Partial<any> = {}) => {
    const defaultMocks = {
      callMCPTool: vi.fn(),
      callMultipleMCPTools: vi.fn(),
      getAllMCPTools: vi.fn().mockResolvedValue([]),
      getMCPServers: vi.fn().mockResolvedValue({ servers: [] }),
      getConnectedMCPServerIds: vi.fn().mockResolvedValue([])
    };
    
    const mockAPI = { ...defaultMocks, ...customMocks };
    Object.defineProperty(window, 'electronAPI', { value: mockAPI, writable: true });
    
    return mockAPI;
  },
  
  // Clean up test environment
  cleanup: () => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    
    // Clear any global state
    if (typeof window !== 'undefined') {
      delete (window as any).electronAPI;
    }
  }
};
