import React, { useState, useEffect, useRef } from 'react';

interface ProgressEntry {
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

interface ProgressLogPanelProps {
  entries: ProgressEntry[];
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onClear?: () => void;
  maxHeight?: string;
}

export const ProgressLogPanel: React.FC<ProgressLogPanelProps> = ({
  entries,
  isCollapsed = false,
  onToggleCollapse,
  onClear,
  maxHeight = '300px'
}) => {
  const logEndRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, autoScroll]);

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString();
  };

  const getLevelIcon = (level: ProgressEntry['level']) => {
    switch (level) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info':
      default: return 'ℹ️';
    }
  };

  const getLevelColor = (level: ProgressEntry['level']) => {
    switch (level) {
      case 'success': return 'text-green-600';
      case 'error': return 'text-red-600';
      case 'warning': return 'text-yellow-600';
      case 'info':
      default: return 'text-blue-600';
    }
  };

  const formatDuration = (milliseconds: number) => {
    if (milliseconds < 1000) return `${milliseconds}ms`;
    if (milliseconds < 60000) return `${(milliseconds / 1000).toFixed(1)}s`;
    return `${(milliseconds / 60000).toFixed(1)}m`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getActiveOperations = () => {
    const operations = new Set<string>();
    entries.forEach(entry => {
      if (entry.operation !== 'system') {
        operations.add(entry.operation);
      }
    });
    return Array.from(operations);
  };

  const getOperationStats = (operation: string) => {
    const operationEntries = entries.filter(e => e.operation === operation);
    const errors = operationEntries.filter(e => e.level === 'error').length;
    const warnings = operationEntries.filter(e => e.level === 'warning').length;
    const lastEntry = operationEntries[operationEntries.length - 1];
    
    return {
      totalEntries: operationEntries.length,
      errors,
      warnings,
      lastUpdate: lastEntry?.timestamp,
      isActive: lastEntry && !['success', 'error'].includes(lastEntry.level)
    };
  };

  return (
    <div className="border border-border rounded bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border bg-muted">
        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleCollapse}
            className="text-foreground hover:text-muted-foreground"
          >
            {isCollapsed ? '▶️' : '▼'}
          </button>
          <h4 className="font-medium text-foreground">
            Progress Log ({entries.length} entries)
          </h4>
        </div>
        
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-1 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded"
            />
            <span>Auto-scroll</span>
          </label>
          
          {onClear && (
            <button
              onClick={onClear}
              className="text-xs bg-red-500 hover:bg-red-700 text-white px-2 py-1 rounded"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-3">
          {/* Active Operations Summary */}
          {getActiveOperations().length > 0 && (
            <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-sm">
              <p className="font-medium text-blue-800 mb-1">Active Operations:</p>
              <div className="space-y-1">
                {getActiveOperations().map(operation => {
                  const stats = getOperationStats(operation);
                  return (
                    <div key={operation} className="flex items-center justify-between text-blue-700">
                      <span className="font-medium">{operation}</span>
                      <span className="text-xs">
                        {stats.errors > 0 && `${stats.errors} errors `}
                        {stats.warnings > 0 && `${stats.warnings} warnings `}
                        {stats.lastUpdate && `(${formatTimestamp(stats.lastUpdate)})`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Log Entries */}
          <div 
            className="space-y-1 overflow-y-auto text-sm font-mono"
            style={{ maxHeight }}
          >
            {entries.length === 0 ? (
              <div className="text-center text-muted-foreground py-4">
                No log entries yet. Operations will appear here when started.
              </div>
            ) : (
              entries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start space-x-2 p-2 rounded hover:bg-muted"
                >
                  <span className="text-xs text-muted-foreground mt-0.5 min-w-[60px]">
                    {formatTimestamp(entry.timestamp)}
                  </span>
                  
                  <span className="mt-0.5">{getLevelIcon(entry.level)}</span>
                  
                  <div className="flex-1 min-w-0">
                    <div className={`${getLevelColor(entry.level)} font-medium`}>
                      [{entry.operation}] {entry.message}
                    </div>
                    
                    {entry.progress && (
                      <div className="mt-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Progress: {entry.progress.current}/{entry.progress.total}</span>
                          <span>{entry.progress.percentage}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                          <div 
                            className="bg-blue-600 h-1 rounded-full transition-all duration-300" 
                            style={{ width: `${entry.progress.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                    
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        {Object.entries(entry.metadata).map(([key, value]) => {
                          if (key === 'duration' && typeof value === 'number') {
                            return `${key}: ${formatDuration(value)}`;
                          }
                          if (key.includes('Size') && typeof value === 'number') {
                            return `${key}: ${formatFileSize(value)}`;
                          }
                          return `${key}: ${value}`;
                        }).join(' • ')}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};
