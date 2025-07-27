/**
 * Progress monitoring service for knowledge base operations
 * Provides real-time progress tracking and logging functionality
 */

export interface ProgressEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warning' | 'error' | 'success';
  operation: string;
  message: string;
  progress?: {
    current: number;
    total: number;
    percentage: number;
  };
  metadata?: Record<string, unknown>;
}

export interface OperationStats {
  operationId: string;
  operationType: 'upload' | 'export' | 'import' | 'processing';
  startTime: Date;
  endTime?: Date;
  totalFiles?: number;
  processedFiles?: number;
  totalChunks?: number;
  processedChunks?: number;
  errors: number;
  warnings: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
}

export type ProgressCallback = (entry: ProgressEntry) => void;

class ProgressMonitorService {
  private static instance: ProgressMonitorService;
  private progressEntries: ProgressEntry[] = [];
  private activeOperations: Map<string, OperationStats> = new Map();
  private callbacks: Set<ProgressCallback> = new Set();
  private maxEntries = 1000; // Limit to prevent memory issues

  private constructor() {}

  public static getInstance(): ProgressMonitorService {
    if (!ProgressMonitorService.instance) {
      ProgressMonitorService.instance = new ProgressMonitorService();
    }
    return ProgressMonitorService.instance;
  }

  /**
   * Subscribe to progress updates
   */
  public subscribe(callback: ProgressCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  /**
   * Start tracking a new operation
   */
  public startOperation(
    operationId: string, 
    operationType: OperationStats['operationType'],
    metadata?: { totalFiles?: number; totalChunks?: number }
  ): void {
    const operation: OperationStats = {
      operationId,
      operationType,
      startTime: new Date(),
      totalFiles: metadata?.totalFiles,
      processedFiles: 0,
      totalChunks: metadata?.totalChunks,
      processedChunks: 0,
      errors: 0,
      warnings: 0,
      status: 'running'
    };

    this.activeOperations.set(operationId, operation);
    
    this.addEntry({
      id: this.generateId(),
      timestamp: new Date(),
      level: 'info',
      operation: operationId,
      message: `Started ${operationType} operation`,
      metadata: metadata
    });
  }

  /**
   * Update operation progress
   */
  public updateProgress(
    operationId: string,
    message: string,
    progress?: { current: number; total: number },
    level: ProgressEntry['level'] = 'info',
    metadata?: Record<string, unknown>
  ): void {
    const operation = this.activeOperations.get(operationId);
    if (operation) {
      if (level === 'error') operation.errors++;
      if (level === 'warning') operation.warnings++;
      
      // Update operation stats based on metadata
      if (metadata?.processedFiles !== undefined) {
        operation.processedFiles = metadata.processedFiles as number;
      }
      if (metadata?.processedChunks !== undefined) {
        operation.processedChunks = metadata.processedChunks as number;
      }
    }

    const entry: ProgressEntry = {
      id: this.generateId(),
      timestamp: new Date(),
      level,
      operation: operationId,
      message,
      metadata
    };

    if (progress) {
      entry.progress = {
        current: progress.current,
        total: progress.total,
        percentage: Math.round((progress.current / progress.total) * 100)
      };
    }

    this.addEntry(entry);
  }

  /**
   * Complete an operation
   */
  public completeOperation(
    operationId: string, 
    status: 'completed' | 'failed' | 'cancelled',
    finalMessage?: string,
    finalStats?: Record<string, unknown>
  ): void {
    const operation = this.activeOperations.get(operationId);
    if (operation) {
      operation.endTime = new Date();
      operation.status = status;

      const duration = operation.endTime.getTime() - operation.startTime.getTime();
      const level = status === 'completed' ? 'success' : status === 'failed' ? 'error' : 'warning';
      
      this.addEntry({
        id: this.generateId(),
        timestamp: new Date(),
        level,
        operation: operationId,
        message: finalMessage || `Operation ${status}`,
        metadata: {
          duration,
          ...finalStats,
          totalErrors: operation.errors,
          totalWarnings: operation.warnings
        }
      });
    }
  }

  /**
   * Add a progress entry
   */
  private addEntry(entry: ProgressEntry): void {
    this.progressEntries.push(entry);
    
    // Limit entries to prevent memory issues
    if (this.progressEntries.length > this.maxEntries) {
      this.progressEntries = this.progressEntries.slice(-this.maxEntries);
    }

    // Notify all subscribers
    this.callbacks.forEach(callback => {
      try {
        callback(entry);
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    });
  }

  /**
   * Get all progress entries
   */
  public getEntries(): ProgressEntry[] {
    return [...this.progressEntries];
  }

  /**
   * Get entries for a specific operation
   */
  public getEntriesForOperation(operationId: string): ProgressEntry[] {
    return this.progressEntries.filter(entry => entry.operation === operationId);
  }

  /**
   * Get active operations
   */
  public getActiveOperations(): OperationStats[] {
    return Array.from(this.activeOperations.values()).filter(op => op.status === 'running');
  }

  /**
   * Get operation statistics
   */
  public getOperationStats(operationId: string): OperationStats | undefined {
    return this.activeOperations.get(operationId);
  }

  /**
   * Clear all progress entries
   */
  public clearEntries(): void {
    this.progressEntries = [];
    this.addEntry({
      id: this.generateId(),
      timestamp: new Date(),
      level: 'info',
      operation: 'system',
      message: 'Progress log cleared'
    });
  }

  /**
   * Clear completed operations
   */
  public clearCompletedOperations(): void {
    const activeOps = new Map();
    for (const [id, op] of this.activeOperations) {
      if (op.status === 'running') {
        activeOps.set(id, op);
      }
    }
    this.activeOperations = activeOps;
  }

  /**
   * Generate a unique ID for entries
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format duration in human-readable format
   */
  public static formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) return `${milliseconds}ms`;
    if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1)}s`;
    if (milliseconds < 3600000) return `${(milliseconds / 60000).toFixed(1)}m`;
    return `${(milliseconds / 3600000).toFixed(1)}h`;
  }

  /**
   * Format file size in human-readable format
   */
  public static formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
}

export const progressMonitorService = ProgressMonitorService.getInstance();
