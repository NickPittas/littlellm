// Performance monitoring service for Llama.cpp models

export interface PerformanceMetrics {
  // Inference metrics
  tokensPerSecond: number;
  averageLatency: number;
  totalTokens: number;
  totalRequests: number;
  
  // Resource usage
  memoryUsage: number;
  cpuUsage: number;
  gpuUsage?: number;
  gpuMemoryUsage?: number;
  
  // Model-specific metrics
  modelName: string;
  contextSize: number;
  batchSize: number;
  
  // Timing metrics
  firstTokenLatency: number;
  lastUpdateTime: number;
  sessionStartTime: number;
  
  // Quality metrics
  averageResponseLength: number;
  errorRate: number;
}

export interface RequestMetrics {
  requestId: string;
  startTime: number;
  endTime?: number;
  tokenCount: number;
  firstTokenTime?: number;
  error?: string;
}

export class LlamaCppPerformanceMonitor {
  private metrics: PerformanceMetrics;
  private activeRequests: Map<string, RequestMetrics> = new Map();
  private requestHistory: RequestMetrics[] = [];
  private maxHistorySize = 100;
  private updateCallbacks: Array<(metrics: PerformanceMetrics) => void> = [];

  constructor() {
    this.metrics = this.getInitialMetrics();
    this.startResourceMonitoring();
  }

  private getInitialMetrics(): PerformanceMetrics {
    return {
      tokensPerSecond: 0,
      averageLatency: 0,
      totalTokens: 0,
      totalRequests: 0,
      memoryUsage: 0,
      cpuUsage: 0,
      modelName: '',
      contextSize: 0,
      batchSize: 0,
      firstTokenLatency: 0,
      lastUpdateTime: Date.now(),
      sessionStartTime: Date.now(),
      averageResponseLength: 0,
      errorRate: 0
    };
  }

  // Start monitoring a new request
  startRequest(requestId: string): void {
    const request: RequestMetrics = {
      requestId,
      startTime: Date.now(),
      tokenCount: 0
    };
    
    this.activeRequests.set(requestId, request);
  }

  // Record first token received
  recordFirstToken(requestId: string): void {
    const request = this.activeRequests.get(requestId);
    if (request && !request.firstTokenTime) {
      request.firstTokenTime = Date.now();
      this.updateFirstTokenLatency(request.firstTokenTime - request.startTime);
    }
  }

  // Record token generation
  recordToken(requestId: string): void {
    const request = this.activeRequests.get(requestId);
    if (request) {
      request.tokenCount++;
      this.metrics.totalTokens++;
    }
  }

  // Complete a request
  completeRequest(requestId: string, error?: string): void {
    const request = this.activeRequests.get(requestId);
    if (!request) return;

    request.endTime = Date.now();
    request.error = error;

    // Move to history
    this.requestHistory.push(request);
    if (this.requestHistory.length > this.maxHistorySize) {
      this.requestHistory.shift();
    }

    this.activeRequests.delete(requestId);
    this.metrics.totalRequests++;

    // Update metrics
    this.updateMetrics();
    this.notifyCallbacks();
  }

  // Update model configuration
  updateModelConfig(modelName: string, contextSize: number, batchSize: number): void {
    this.metrics.modelName = modelName;
    this.metrics.contextSize = contextSize;
    this.metrics.batchSize = batchSize;
    this.notifyCallbacks();
  }

  // Get current metrics
  getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Subscribe to metrics updates
  onMetricsUpdate(callback: (metrics: PerformanceMetrics) => void): () => void {
    this.updateCallbacks.push(callback);
    return () => {
      const index = this.updateCallbacks.indexOf(callback);
      if (index > -1) {
        this.updateCallbacks.splice(index, 1);
      }
    };
  }

  // Get detailed performance report
  getPerformanceReport(): {
    current: PerformanceMetrics;
    recentRequests: RequestMetrics[];
    recommendations: string[];
  } {
    const recommendations = this.generateRecommendations();
    
    return {
      current: this.getMetrics(),
      recentRequests: this.requestHistory.slice(-10),
      recommendations
    };
  }

  // Reset metrics (for new session)
  reset(): void {
    this.metrics = this.getInitialMetrics();
    this.activeRequests.clear();
    this.requestHistory = [];
    this.notifyCallbacks();
  }

  private updateMetrics(): void {
    const now = Date.now();
    const completedRequests = this.requestHistory.filter(r => r.endTime);
    
    if (completedRequests.length === 0) return;

    // Calculate tokens per second
    const recentRequests = completedRequests.slice(-10);
    const totalTime = recentRequests.reduce((sum, req) => 
      sum + (req.endTime! - req.startTime), 0);
    const totalTokens = recentRequests.reduce((sum, req) => sum + req.tokenCount, 0);
    
    if (totalTime > 0) {
      this.metrics.tokensPerSecond = (totalTokens / totalTime) * 1000;
    }

    // Calculate average latency
    this.metrics.averageLatency = totalTime / recentRequests.length;

    // Calculate average response length
    this.metrics.averageResponseLength = totalTokens / recentRequests.length;

    // Calculate error rate
    const errorCount = completedRequests.filter(r => r.error).length;
    this.metrics.errorRate = (errorCount / completedRequests.length) * 100;

    this.metrics.lastUpdateTime = now;
  }

  private updateFirstTokenLatency(latency: number): void {
    // Exponential moving average
    const alpha = 0.1;
    this.metrics.firstTokenLatency = this.metrics.firstTokenLatency === 0 
      ? latency 
      : alpha * latency + (1 - alpha) * this.metrics.firstTokenLatency;
  }

  private startResourceMonitoring(): void {
    // Monitor system resources every 5 seconds
    setInterval(() => {
      this.updateResourceUsage();
    }, 5000);
  }

  private async updateResourceUsage(): Promise<void> {
    try {
      // In a real implementation, this would call system APIs or Electron IPC
      // For now, we'll simulate resource monitoring
      
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Could call Electron IPC to get actual system metrics
        // const resources = await window.electronAPI.getSystemResources();
        // this.metrics.memoryUsage = resources.memory;
        // this.metrics.cpuUsage = resources.cpu;
      }
      
      // Simulate resource usage based on active requests
      const activeCount = this.activeRequests.size;
      this.metrics.memoryUsage = Math.min(90, 20 + activeCount * 10);
      this.metrics.cpuUsage = Math.min(100, 10 + activeCount * 15);
      
      this.notifyCallbacks();
    } catch (error) {
      console.warn('Failed to update resource usage:', error);
    }
  }

  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.metrics;

    // Performance recommendations
    if (metrics.tokensPerSecond < 5) {
      recommendations.push('Consider increasing GPU layers or using a smaller model for better performance');
    }

    if (metrics.firstTokenLatency > 2000) {
      recommendations.push('High first token latency detected. Try reducing context size or batch size');
    }

    if (metrics.memoryUsage > 80) {
      recommendations.push('High memory usage detected. Consider using a smaller model or closing other applications');
    }

    if (metrics.cpuUsage > 90) {
      recommendations.push('High CPU usage detected. Try reducing thread count or enabling GPU acceleration');
    }

    if (metrics.errorRate > 10) {
      recommendations.push('High error rate detected. Check model configuration and system resources');
    }

    // Configuration recommendations
    if (metrics.contextSize > 8192 && metrics.tokensPerSecond < 10) {
      recommendations.push('Large context size may be impacting performance. Consider reducing to 4096 or less');
    }

    if (metrics.batchSize > 1024 && metrics.memoryUsage > 70) {
      recommendations.push('Large batch size may be causing memory pressure. Try reducing to 512 or less');
    }

    // Quality recommendations
    if (metrics.averageResponseLength < 10) {
      recommendations.push('Responses seem unusually short. Check model configuration and prompts');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance looks good! No specific recommendations at this time');
    }

    return recommendations;
  }

  private notifyCallbacks(): void {
    this.updateCallbacks.forEach(callback => {
      try {
        callback(this.getMetrics());
      } catch (error) {
        console.error('Error in metrics callback:', error);
      }
    });
  }

  // Utility methods for formatting metrics
  static formatTokensPerSecond(tps: number): string {
    return `${tps.toFixed(1)} tok/s`;
  }

  static formatLatency(ms: number): string {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    }
    return `${(ms / 1000).toFixed(1)}s`;
  }

  static formatMemoryUsage(percentage: number): string {
    return `${Math.round(percentage)}%`;
  }

  static formatErrorRate(percentage: number): string {
    return `${percentage.toFixed(1)}%`;
  }
}

export const llamaCppPerformanceMonitor = new LlamaCppPerformanceMonitor();
