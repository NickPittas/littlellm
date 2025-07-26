/**
 * Debug Logger Service
 *
 * Provides controlled debug logging that can be enabled/disabled by user preference.
 * Only logs debug messages when debug logging is enabled in settings.
 */

import { serviceRegistry, SERVICE_NAMES, SettingsServiceInterface } from './serviceRegistry';

export class DebugLogger {
  private static instance: DebugLogger;
  private isDebugEnabled = false;
  private hasInitialized = false;
  private settingsListener: ((settings: any) => void) | null = null;

  private constructor() {
    // Start with debug STRICTLY disabled - no fallbacks
    this.isDebugEnabled = false;
    this.hasInitialized = false;

    // Register with service registry to break circular dependencies
    serviceRegistry.registerService(SERVICE_NAMES.DEBUG_LOGGER, this);

    // NO automatic initialization - only initialize when explicitly called
    // This prevents circular dependencies and unwanted debug output
  }

  public static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  /**
   * Ensure the debug logger is initialized (lazy initialization)
   */
  private ensureInitialized(): void {
    if (!this.hasInitialized) {
      this.updateDebugState();
      this.setupSettingsListener();
      this.hasInitialized = true;
    }
  }

  /**
   * Set up real-time settings listener for debug logging changes
   */
  private setupSettingsListener(): void {
    // Use service registry to avoid circular dependency
    const settingsService = serviceRegistry.getService<SettingsServiceInterface>(SERVICE_NAMES.SETTINGS_SERVICE);

    if (settingsService && typeof settingsService.addListener === 'function') {
      // Remove existing listener if any
      if (this.settingsListener) {
        settingsService.removeListener(this.settingsListener);
      }

      // Create new listener that updates debug state when settings change
      this.settingsListener = (settings: any) => {
        const newDebugState = settings?.general?.debugLogging === true;
        if (newDebugState !== this.isDebugEnabled) {
          this.isDebugEnabled = newDebugState;
          // No console output - this would create spam
        }
      };

      // Add the listener
      settingsService.addListener(this.settingsListener);
    }
  }

  private updateDebugState(): void {
    // Use service registry to avoid circular dependency
    const settingsService = serviceRegistry.getService<SettingsServiceInterface>(SERVICE_NAMES.SETTINGS_SERVICE);

    // STRICT: If settings service is not available, debug is DISABLED
    if (!settingsService || typeof settingsService.getSettings !== 'function') {
      this.isDebugEnabled = false;
      return;
    }

    // Check if settings service is properly initialized
    if (!settingsService.isInitialized || !settingsService.isInitialized()) {
      this.isDebugEnabled = false;
      return;
    }

    try {
      const settings = settingsService.getSettings();

      // STRICT: Only enable if explicitly set to true in settings
      this.isDebugEnabled = settings?.general?.debugLogging === true;

      // NO console output about debug state - this would create spam
    } catch (error) {
      // STRICT: Any error means debug is DISABLED
      this.isDebugEnabled = false;
      // Don't log the error - this could create circular logging
    }
  }

  /**
   * Log a debug message (only if debug logging is enabled)
   */
  public debug(...args: unknown[]): void {
    this.ensureInitialized();
    if (this.isDebugEnabled) {
      console.log('🐛 [DEBUG]', ...args);
    }
  }

  /**
   * Log debug info with a specific prefix
   */
  public info(prefix: string, ...args: unknown[]): void {
    this.ensureInitialized();
    if (this.isDebugEnabled) {
      console.log(`ℹ️ [${prefix}]`, ...args);
    }
  }

  /**
   * Log debug warning (only if debug logging is enabled)
   */
  public warn(prefix: string, ...args: unknown[]): void {
    this.ensureInitialized();
    if (this.isDebugEnabled) {
      console.warn(`⚠️ [${prefix}]`, ...args);
    }
  }

  /**
   * Log debug error (only if debug logging is enabled)
   */
  public error(prefix: string, ...args: unknown[]): void {
    this.ensureInitialized();
    if (this.isDebugEnabled) {
      console.error(`❌ [${prefix}]`, ...args);
    }
  }

  /**
   * Log debug success (only if debug logging is enabled)
   */
  public success(prefix: string, ...args: unknown[]): void {
    this.ensureInitialized();
    if (this.isDebugEnabled) {
      console.log(`✅ [${prefix}]`, ...args);
    }
  }

  /**
   * Log debug timing information
   */
  public time(label: string): void {
    this.ensureInitialized();
    if (this.isDebugEnabled) {
      console.time(`⏱️ [DEBUG] ${label}`);
    }
  }

  /**
   * End debug timing
   */
  public timeEnd(label: string): void {
    this.ensureInitialized();
    if (this.isDebugEnabled) {
      console.timeEnd(`⏱️ [DEBUG] ${label}`);
    }
  }

  /**
   * Log debug table (only if debug logging is enabled)
   */
  public table(data: unknown): void {
    this.ensureInitialized();
    if (this.isDebugEnabled) {
      console.log('📊 [DEBUG] Table data:');
      console.table(data);
    }
  }

  /**
   * Log debug group start
   */
  public group(label: string): void {
    this.ensureInitialized();
    if (this.isDebugEnabled) {
      console.group(`📁 [DEBUG] ${label}`);
    }
  }

  /**
   * Log debug group end
   */
  public groupEnd(): void {
    this.ensureInitialized();
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
    // NO console output - this would create spam
  }

  /**
   * Force update debug state from current settings (for immediate testing)
   */
  public forceUpdateFromSettings(): void {
    this.updateDebugState();
  }

  /**
   * Refresh debug state from settings (call this when settings are updated)
   */
  public refreshFromSettings(): void {
    // Update debug state immediately without re-initialization
    this.updateDebugState();

    // Ensure settings listener is set up if not already
    if (!this.settingsListener) {
      this.setupSettingsListener();
    }
  }

  /**
   * Clean up resources (remove settings listener)
   */
  public cleanup(): void {
    if (this.settingsListener) {
      try {
        const settingsService = serviceRegistry.getService<SettingsServiceInterface>(SERVICE_NAMES.SETTINGS_SERVICE);
        if (settingsService && typeof settingsService.removeListener === 'function') {
          settingsService.removeListener(this.settingsListener);
        }
      } catch (error) {
        console.error('❌ Failed to clean up debug logger settings listener:', error);
      }
      this.settingsListener = null;
    }
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

// Make debug logger available globally for testing
if (typeof window !== 'undefined') {
  (window as any).debugLogger = debugLogger;
  (window as any).testDebugLogging = () => {
    console.log('🧪 Testing debug logging...');
    console.log('🧪 Debug enabled:', debugLogger.isEnabled());
    debugLogger.debug('This is a test debug message');
    debugLogger.info('TEST', 'This is a test info message');
    debugLogger.warn('TEST', 'This is a test warning message');
    debugLogger.success('TEST', 'This is a test success message');
    console.log('🧪 Test complete');
  };
}
export const debugGroup = (label: string) => debugLogger.group(label);
export const debugGroupEnd = () => debugLogger.groupEnd();
