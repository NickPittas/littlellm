/**
 * Debug Logger Service
 *
 * Provides controlled debug logging that can be enabled/disabled by user preference.
 * Only logs debug messages when debug logging is enabled in settings.
 */

export class DebugLogger {
  private static instance: DebugLogger;
  private isDebugEnabled = false;

  private constructor() {
    // Start with debug disabled to prevent circular dependency during settings initialization
    this.isDebugEnabled = false;

    // Delay initialization to avoid circular dependency with settings service
    setTimeout(() => {
      this.updateDebugState();
    }, 100);
  }

  public static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  private updateDebugState(): void {
    try {
      // Import settingsService dynamically to avoid circular dependency
      const { settingsService } = require('./settingsService');

      // Check if settings service is initialized
      if (!settingsService || typeof settingsService.getSettings !== 'function') {
        this.isDebugEnabled = false;
        return;
      }

      const settings = settingsService.getSettings();
      this.isDebugEnabled = settings?.general?.debugLogging || false;

      if (this.isDebugEnabled) {
        console.log('🐛 Debug logging enabled');
      }
    } catch (error) {
      // Fallback to false if settings can't be loaded
      this.isDebugEnabled = false;
    }
  }

  /**
   * Log a debug message (only if debug logging is enabled)
   */
  public debug(...args: unknown[]): void {
    if (this.isDebugEnabled) {
      console.log('🐛 [DEBUG]', ...args);
    }
  }

  /**
   * Log debug info with a specific prefix
   */
  public info(prefix: string, ...args: unknown[]): void {
    if (this.isDebugEnabled) {
      console.log(`ℹ️ [${prefix}]`, ...args);
    }
  }

  /**
   * Log debug warning (only if debug logging is enabled)
   */
  public warn(prefix: string, ...args: unknown[]): void {
    if (this.isDebugEnabled) {
      console.warn(`⚠️ [${prefix}]`, ...args);
    }
  }

  /**
   * Log debug error (only if debug logging is enabled)
   */
  public error(prefix: string, ...args: unknown[]): void {
    if (this.isDebugEnabled) {
      console.error(`❌ [${prefix}]`, ...args);
    }
  }

  /**
   * Log debug success (only if debug logging is enabled)
   */
  public success(prefix: string, ...args: unknown[]): void {
    if (this.isDebugEnabled) {
      console.log(`✅ [${prefix}]`, ...args);
    }
  }

  /**
   * Log debug timing information
   */
  public time(label: string): void {
    if (this.isDebugEnabled) {
      console.time(`⏱️ [DEBUG] ${label}`);
    }
  }

  /**
   * End debug timing
   */
  public timeEnd(label: string): void {
    if (this.isDebugEnabled) {
      console.timeEnd(`⏱️ [DEBUG] ${label}`);
    }
  }

  /**
   * Log debug table (only if debug logging is enabled)
   */
  public table(data: unknown): void {
    if (this.isDebugEnabled) {
      console.log('📊 [DEBUG] Table data:');
      console.table(data);
    }
  }

  /**
   * Log debug group start
   */
  public group(label: string): void {
    if (this.isDebugEnabled) {
      console.group(`📁 [DEBUG] ${label}`);
    }
  }

  /**
   * Log debug group end
   */
  public groupEnd(): void {
    if (this.isDebugEnabled) {
      console.groupEnd();
    }
  }

  /**
   * Check if debug logging is currently enabled
   */
  public isEnabled(): boolean {
    return this.isDebugEnabled;
  }

  /**
   * Force enable/disable debug logging (for testing)
   */
  public setEnabled(enabled: boolean): void {
    this.isDebugEnabled = enabled;
    console.log(`🐛 Debug logging ${enabled ? 'enabled' : 'disabled'} (forced)`);
  }

  /**
   * Refresh debug state from settings (call this when settings are updated)
   */
  public refreshFromSettings(): void {
    this.updateDebugState();
  }

  /**
   * Log tool execution details (only if debug logging is enabled)
   */
  public logToolExecution(toolName: string, args: unknown, result: unknown, duration: number): void {
    if (this.isDebugEnabled) {
      console.group(`🔧 [TOOL] ${toolName} (${duration}ms)`);
      console.log('📥 Arguments:', args);
      console.log('📤 Result:', result);
      console.groupEnd();
    }
  }
}

// Export singleton instance
export const debugLogger = DebugLogger.getInstance();

// Export convenience functions
export const debug = (...args: unknown[]) => debugLogger.debug(...args);
export const debugInfo = (prefix: string, ...args: unknown[]) => debugLogger.info(prefix, ...args);
export const debugWarn = (prefix: string, ...args: unknown[]) => debugLogger.warn(prefix, ...args);
export const debugError = (prefix: string, ...args: unknown[]) => debugLogger.error(prefix, ...args);
export const debugSuccess = (prefix: string, ...args: unknown[]) => debugLogger.success(prefix, ...args);
export const debugTime = (label: string) => debugLogger.time(label);
export const debugTimeEnd = (label: string) => debugLogger.timeEnd(label);
export const debugTable = (data: unknown) => debugLogger.table(data);
export const debugGroup = (label: string) => debugLogger.group(label);
export const debugGroupEnd = () => debugLogger.groupEnd();
