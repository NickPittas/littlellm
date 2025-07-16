#!/usr/bin/env node

/**
 * Performance Benchmark Script for Multi-Tool Agentic System
 * 
 * This script runs comprehensive performance tests across different scenarios:
 * - Single tool execution
 * - Parallel multi-tool execution
 * - Sequential tool chaining
 * - Provider comparison
 * - Memory system performance
 * - Error recovery performance
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PerformanceBenchmark {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      system: null, // Will be set by initialize()
      benchmarks: {}
    };
  }

  async initialize() {
    this.results.system = await this.getSystemInfo();
  }

  async getSystemInfo() {
    const { default: os } = await import('os');
    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + 'GB',
      nodeVersion: process.version
    };
  }

  async measurePerformance(name, operation, iterations = 1) {
    console.log(`🔄 Running benchmark: ${name} (${iterations} iterations)`);
    
    const results = [];
    let totalMemoryDelta = 0;
    
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      const startMemory = process.memoryUsage().heapUsed;
      
      try {
        const result = await operation();
        
        const endTime = performance.now();
        const endMemory = process.memoryUsage().heapUsed;
        const executionTime = endTime - startTime;
        const memoryDelta = (endMemory - startMemory) / 1024 / 1024; // MB
        
        results.push({
          iteration: i + 1,
          executionTime,
          memoryDelta,
          success: true,
          result: result
        });
        
        totalMemoryDelta += memoryDelta;
        
      } catch (error) {
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        results.push({
          iteration: i + 1,
          executionTime,
          memoryDelta: 0,
          success: false,
          error: error.message
        });
      }
      
      // Small delay between iterations
      if (i < iterations - 1) {
        await this.delay(100);
      }
    }
    
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);
    
    const stats = {
      totalIterations: iterations,
      successful: successfulResults.length,
      failed: failedResults.length,
      successRate: (successfulResults.length / iterations) * 100,
      executionTime: {
        min: Math.min(...successfulResults.map(r => r.executionTime)),
        max: Math.max(...successfulResults.map(r => r.executionTime)),
        avg: successfulResults.reduce((sum, r) => sum + r.executionTime, 0) / successfulResults.length,
        median: this.calculateMedian(successfulResults.map(r => r.executionTime))
      },
      memory: {
        totalDelta: totalMemoryDelta,
        avgDelta: totalMemoryDelta / iterations,
        peak: Math.max(...results.map(r => r.memoryDelta))
      },
      errors: failedResults.map(r => r.error)
    };
    
    console.log(`✅ ${name}: ${stats.executionTime.avg?.toFixed(2)}ms avg, ${stats.successRate.toFixed(1)}% success`);
    
    this.results.benchmarks[name] = stats;
    return stats;
  }

  calculateMedian(values) {
    if (values.length === 0) return 0;
    const sorted = values.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 
      ? (sorted[mid - 1] + sorted[mid]) / 2 
      : sorted[mid];
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Mock tool execution for benchmarking
  async mockToolExecution(toolName, complexity = 'simple', shouldFail = false) {
    const delays = {
      simple: 50 + Math.random() * 100,    // 50-150ms
      medium: 200 + Math.random() * 300,   // 200-500ms
      complex: 500 + Math.random() * 1000  // 500-1500ms
    };
    
    await this.delay(delays[complexity] || delays.simple);
    
    if (shouldFail) {
      throw new Error(`Mock failure for ${toolName}`);
    }
    
    return {
      tool: toolName,
      result: `Mock result for ${toolName}`,
      complexity,
      timestamp: Date.now()
    };
  }

  async mockMultipleToolExecution(toolCalls, parallel = true) {
    if (parallel) {
      return Promise.all(
        toolCalls.map(tc => this.mockToolExecution(tc.name, tc.complexity, tc.shouldFail))
      );
    } else {
      const results = [];
      for (const tc of toolCalls) {
        const result = await this.mockToolExecution(tc.name, tc.complexity, tc.shouldFail);
        results.push(result);
      }
      return results;
    }
  }

  async runSingleToolBenchmarks() {
    console.log('\n📊 Single Tool Execution Benchmarks');
    
    await this.measurePerformance(
      'Single Simple Tool',
      () => this.mockToolExecution('web_search', 'simple'),
      10
    );
    
    await this.measurePerformance(
      'Single Medium Tool',
      () => this.mockToolExecution('memory_search', 'medium'),
      10
    );
    
    await this.measurePerformance(
      'Single Complex Tool',
      () => this.mockToolExecution('sequentialthinking', 'complex'),
      5
    );
  }

  async runParallelToolBenchmarks() {
    console.log('\n📊 Parallel Tool Execution Benchmarks');
    
    const twoToolsParallel = [
      { name: 'web_search', complexity: 'simple' },
      { name: 'get_datetime', complexity: 'simple' }
    ];
    
    await this.measurePerformance(
      'Two Tools Parallel',
      () => this.mockMultipleToolExecution(twoToolsParallel, true),
      10
    );
    
    const threeToolsParallel = [
      { name: 'web_search', complexity: 'medium' },
      { name: 'memory_search', complexity: 'medium' },
      { name: 'get_datetime', complexity: 'simple' }
    ];
    
    await this.measurePerformance(
      'Three Tools Parallel',
      () => this.mockMultipleToolExecution(threeToolsParallel, true),
      10
    );
    
    const fiveToolsParallel = [
      { name: 'web_search', complexity: 'simple' },
      { name: 'memory_search', complexity: 'simple' },
      { name: 'get_datetime', complexity: 'simple' },
      { name: 'fetch', complexity: 'medium' },
      { name: 'memory_store', complexity: 'simple' }
    ];
    
    await this.measurePerformance(
      'Five Tools Parallel',
      () => this.mockMultipleToolExecution(fiveToolsParallel, true),
      5
    );
  }

  async runSequentialToolBenchmarks() {
    console.log('\n📊 Sequential Tool Execution Benchmarks');
    
    const twoToolsSequential = [
      { name: 'web_search', complexity: 'simple' },
      { name: 'memory_store', complexity: 'simple' }
    ];
    
    await this.measurePerformance(
      'Two Tools Sequential',
      () => this.mockMultipleToolExecution(twoToolsSequential, false),
      10
    );
    
    const threeToolsSequential = [
      { name: 'web_search', complexity: 'medium' },
      { name: 'memory_search', complexity: 'simple' },
      { name: 'memory_store', complexity: 'simple' }
    ];
    
    await this.measurePerformance(
      'Three Tools Sequential',
      () => this.mockMultipleToolExecution(threeToolsSequential, false),
      5
    );
  }

  async runErrorRecoveryBenchmarks() {
    console.log('\n📊 Error Recovery Benchmarks');
    
    const toolsWithFailures = [
      { name: 'web_search', complexity: 'simple', shouldFail: true },
      { name: 'memory_search', complexity: 'simple', shouldFail: false },
      { name: 'get_datetime', complexity: 'simple', shouldFail: false }
    ];
    
    await this.measurePerformance(
      'Partial Failure Recovery',
      async () => {
        try {
          return await this.mockMultipleToolExecution(toolsWithFailures, true);
        } catch {
          // Simulate recovery by retrying failed tools
          const retryTools = toolsWithFailures.map(tc => ({ ...tc, shouldFail: false }));
          return await this.mockMultipleToolExecution(retryTools, true);
        }
      },
      5
    );
  }

  async runMemoryBenchmarks() {
    console.log('\n📊 Memory System Benchmarks');
    
    // Simulate memory operations
    const memoryData = new Map();
    
    await this.measurePerformance(
      'Memory Store Operations',
      async () => {
        const key = `memory_${Date.now()}_${Math.random()}`;
        const data = {
          title: 'Test Memory',
          content: 'Test content for memory benchmark',
          timestamp: Date.now()
        };
        memoryData.set(key, data);
        await this.delay(10); // Simulate storage delay
        return { stored: key };
      },
      50
    );
    
    await this.measurePerformance(
      'Memory Search Operations',
      async () => {
        const keys = Array.from(memoryData.keys());
        const searchResults = keys.slice(0, 5).map(key => memoryData.get(key));
        await this.delay(20); // Simulate search delay
        return { results: searchResults };
      },
      20
    );
  }

  generateReport() {
    const report = {
      summary: this.generateSummary(),
      detailed: this.results,
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  generateSummary() {
    const benchmarks = this.results.benchmarks;
    const summary = {
      totalBenchmarks: Object.keys(benchmarks).length,
      overallSuccessRate: 0,
      fastestOperation: null,
      slowestOperation: null,
      mostMemoryIntensive: null
    };
    
    let totalSuccessRate = 0;
    let fastestTime = Infinity;
    let slowestTime = 0;
    let highestMemory = 0;
    
    for (const [name, stats] of Object.entries(benchmarks)) {
      totalSuccessRate += stats.successRate;
      
      if (stats.executionTime.avg < fastestTime) {
        fastestTime = stats.executionTime.avg;
        summary.fastestOperation = { name, time: fastestTime };
      }
      
      if (stats.executionTime.avg > slowestTime) {
        slowestTime = stats.executionTime.avg;
        summary.slowestOperation = { name, time: slowestTime };
      }
      
      if (stats.memory.avgDelta > highestMemory) {
        highestMemory = stats.memory.avgDelta;
        summary.mostMemoryIntensive = { name, memory: highestMemory };
      }
    }
    
    summary.overallSuccessRate = totalSuccessRate / Object.keys(benchmarks).length;
    
    return summary;
  }

  generateRecommendations() {
    const recommendations = [];
    const benchmarks = this.results.benchmarks;
    
    // Performance recommendations
    const parallelVsSequential = this.compareParallelVsSequential(benchmarks);
    if (parallelVsSequential.improvement > 50) {
      recommendations.push({
        type: 'performance',
        priority: 'high',
        message: `Parallel execution is ${parallelVsSequential.improvement.toFixed(1)}% faster than sequential. Use parallel execution for independent tools.`
      });
    }
    
    // Memory recommendations
    const highMemoryOps = Object.entries(benchmarks)
      .filter(([, stats]) => stats.memory.avgDelta > 10) // > 10MB
      .map(([name, stats]) => ({ name, memory: stats.memory.avgDelta }));
    
    if (highMemoryOps.length > 0) {
      recommendations.push({
        type: 'memory',
        priority: 'medium',
        message: `High memory usage detected in: ${highMemoryOps.map(op => op.name).join(', ')}. Consider implementing memory cleanup.`
      });
    }
    
    // Reliability recommendations
    const lowSuccessRateOps = Object.entries(benchmarks)
      .filter(([, stats]) => stats.successRate < 95)
      .map(([name, stats]) => ({ name, rate: stats.successRate }));
    
    if (lowSuccessRateOps.length > 0) {
      recommendations.push({
        type: 'reliability',
        priority: 'high',
        message: `Low success rates detected in: ${lowSuccessRateOps.map(op => `${op.name} (${op.rate.toFixed(1)}%)`).join(', ')}. Implement retry mechanisms.`
      });
    }
    
    return recommendations;
  }

  compareParallelVsSequential(benchmarks) {
    const parallelTwo = benchmarks['Two Tools Parallel'];
    const sequentialTwo = benchmarks['Two Tools Sequential'];
    
    if (parallelTwo && sequentialTwo) {
      const improvement = ((sequentialTwo.executionTime.avg - parallelTwo.executionTime.avg) / sequentialTwo.executionTime.avg) * 100;
      return { improvement, parallel: parallelTwo.executionTime.avg, sequential: sequentialTwo.executionTime.avg };
    }
    
    return { improvement: 0 };
  }

  async saveResults(filename) {
    const report = this.generateReport();
    const outputPath = path.join(__dirname, '..', 'benchmark-results', filename);
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Results saved to: ${outputPath}`);
    
    return outputPath;
  }

  printSummary() {
    const summary = this.generateSummary();
    const recommendations = this.generateRecommendations();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 PERFORMANCE BENCHMARK SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total Benchmarks: ${summary.totalBenchmarks}`);
    console.log(`Overall Success Rate: ${summary.overallSuccessRate.toFixed(1)}%`);
    console.log(`Fastest Operation: ${summary.fastestOperation?.name} (${summary.fastestOperation?.time.toFixed(2)}ms)`);
    console.log(`Slowest Operation: ${summary.slowestOperation?.name} (${summary.slowestOperation?.time.toFixed(2)}ms)`);
    console.log(`Most Memory Intensive: ${summary.mostMemoryIntensive?.name} (${summary.mostMemoryIntensive?.memory.toFixed(2)}MB)`);
    
    if (recommendations.length > 0) {
      console.log('\n💡 RECOMMENDATIONS:');
      recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. [${rec.priority.toUpperCase()}] ${rec.message}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
  }

  async run() {
    console.log('🚀 Starting Multi-Tool System Performance Benchmark');
    console.log(`System: ${this.results.system.platform} ${this.results.system.arch}, ${this.results.system.cpus} CPUs, ${this.results.system.memory}`);
    
    try {
      await this.runSingleToolBenchmarks();
      await this.runParallelToolBenchmarks();
      await this.runSequentialToolBenchmarks();
      await this.runErrorRecoveryBenchmarks();
      await this.runMemoryBenchmarks();
      
      this.printSummary();
      
      const filename = `benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      await this.saveResults(filename);
      
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
      process.exit(1);
    }
  }
}

// Run benchmark if called directly
const isMainModule = process.argv[1] === __filename;

if (isMainModule) {
  (async () => {
    try {
      const benchmark = new PerformanceBenchmark();
      await benchmark.initialize();
      await benchmark.run();
    } catch (error) {
      console.error('❌ Benchmark failed:', error);
      process.exit(1);
    }
  })();
}

export default PerformanceBenchmark;
