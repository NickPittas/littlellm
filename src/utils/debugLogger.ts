/**
 * Debug Logger for Tool Execution and Follow-up Call Analysis
 * Writes debug information to files that can be read later
 */

interface LogEntry {
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  category: string;
  message: string;
  data?: any;
}

class DebugLogger {
  private logs: LogEntry[] = [];
  private isElectron = false;
  private originalConsole: any = {};

  constructor() {
    // Check if we're in Electron environment
    this.isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

    if (this.isElectron) {
      console.log('🔧 Debug Logger initialized for Electron environment');
      // Write initial log entry to verify system is working
      this.info('SYSTEM', 'Debug Logger initialized successfully');

      // Automatically intercept all console output
      this.interceptConsoleOutput();
    }
  }

  private interceptConsoleOutput() {
    // Store original console methods
    this.originalConsole.log = console.log;
    this.originalConsole.warn = console.warn;
    this.originalConsole.error = console.error;
    this.originalConsole.info = console.info;

    // Override console methods to also write to file
    console.log = (...args: any[]) => {
      this.originalConsole.log(...args);
      this.writeConsoleToFile('LOG', args);
    };

    console.warn = (...args: any[]) => {
      this.originalConsole.warn(...args);
      this.writeConsoleToFile('WARN', args);
    };

    console.error = (...args: any[]) => {
      this.originalConsole.error(...args);
      this.writeConsoleToFile('ERROR', args);
    };

    console.info = (...args: any[]) => {
      this.originalConsole.info(...args);
      this.writeConsoleToFile('INFO', args);
    };

    this.info('SYSTEM', 'Console output interception enabled - all console logs will be saved to file');
  }

  private async writeConsoleToFile(level: string, args: any[]) {
    try {
      const message = args.map(arg =>
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' ');

      const logLine = `[${new Date().toISOString()}] CONSOLE_${level} ${message}\n`;

      if (this.isElectron) {
        await (window as any).electronAPI.writeDebugLog(logLine);
      }
    } catch (error) {
      // Don't use console.error here to avoid infinite loop
      this.originalConsole.error('Failed to write console to file:', error);
    }
  }

  private createLogEntry(level: LogEntry['level'], category: string, message: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data: data ? JSON.stringify(data, null, 2) : undefined
    };
  }

  private async writeToFile(entry: LogEntry) {
    if (!this.isElectron) return;

    try {
      const logLine = `[${entry.timestamp}] ${entry.level} [${entry.category}] ${entry.message}${entry.data ? '\nData: ' + entry.data : ''}\n\n`;
      
      // Write to debug log file via Electron API
      await (window as any).electronAPI.writeDebugLog(logLine);
    } catch (error) {
      console.error('Failed to write debug log:', error);
    }
  }

  async log(level: LogEntry['level'], category: string, message: string, data?: any) {
    const entry = this.createLogEntry(level, category, message, data);
    this.logs.push(entry);
    
    // Also log to console for immediate visibility
    console.log(`🔧 [${category}] ${message}`, data || '');
    
    // Write to file
    await this.writeToFile(entry);
  }

  async info(category: string, message: string, data?: any) {
    await this.log('INFO', category, message, data);
  }

  async warn(category: string, message: string, data?: any) {
    await this.log('WARN', category, message, data);
  }

  async error(category: string, message: string, data?: any) {
    await this.log('ERROR', category, message, data);
  }

  async debug(category: string, message: string, data?: any) {
    await this.log('DEBUG', category, message, data);
  }

  // Tool execution specific logging
  async logToolExecution(toolName: string, args: any, result: any, duration: number) {
    await this.info('TOOL_EXECUTION', `Tool ${toolName} executed in ${duration}ms`, {
      toolName,
      args,
      result: {
        success: result?.success,
        hasContent: result?.content?.length > 0,
        contentTypes: result?.content?.map((c: any) => c.type),
        hasError: !!result?.error,
        contentPreview: result?.content?.filter((c: any) => c.type === 'text')
          .map((c: any) => c.text?.substring(0, 200))
          .join('\n')
      }
    });
  }

  // Follow-up call specific logging
  async logFollowUpCall(provider: string, stage: string, message: string, data?: any) {
    await this.info('FOLLOW_UP', `${provider} - ${stage}: ${message}`, data);
  }

  // Streaming specific logging
  async logStreaming(provider: string, content: string, isFollowUp: boolean = false) {
    await this.info('STREAMING', `${provider} ${isFollowUp ? 'follow-up' : 'initial'} streaming`, {
      contentLength: content.length,
      contentPreview: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
      isFollowUp
    });
  }

  // Clear logs
  async clearLogs() {
    this.logs = [];
    if (this.isElectron) {
      try {
        await (window as any).electronAPI.clearDebugLog();
        await this.info('SYSTEM', 'Debug logs cleared');
      } catch (error) {
        console.error('Failed to clear debug log file:', error);
      }
    }
  }

  // Get current logs
  getLogs(): LogEntry[] {
    return [...this.logs];
  }
}

// Create global instance
export const debugLogger = new DebugLogger();

// Make available globally for console access
if (typeof window !== 'undefined') {
  (window as any).debugLogger = debugLogger;
  console.log('🔧 Debug Logger available globally as window.debugLogger');
  console.log('🔧 Available methods: clearLogs(), getLogs()');
}
