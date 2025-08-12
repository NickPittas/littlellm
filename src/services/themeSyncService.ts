/**
 * Theme Synchronization Service
 * Ensures all windows stay synchronized with theme changes
 */

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }

  try {
    const { debugLogger } = require('./debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}

export interface ThemeData {

  customColors: Record<string, string>;
  useCustomColors: boolean;
}

class ThemeSyncService {
  private static instance: ThemeSyncService;
  private listeners: Set<(themeData: ThemeData) => void> = new Set();

  static getInstance(): ThemeSyncService {
    if (!ThemeSyncService.instance) {
      ThemeSyncService.instance = new ThemeSyncService();
    }
    return ThemeSyncService.instance;
  }

  /**
   * Initialize theme sync service
   */
  initialize() {
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Listen for theme changes from other windows
      window.electronAPI.onThemeChange((themeData: { customColors: unknown; useCustomColors: boolean }) => {
        safeDebugLog('info', 'THEMESYNCSERVICE', 'ThemeSyncService: Received theme change:', themeData);
        this.notifyListeners(themeData as ThemeData);
      });
    }
  }

  /**
   * Broadcast theme change to all windows
   */
  async broadcastThemeChange(themeData: ThemeData) {
    // Broadcasting theme change
    
    // Notify local listeners first
    this.notifyListeners(themeData);
    
    // Broadcast to other windows via Electron IPC
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        await window.electronAPI.notifyThemeChange(themeData);
        // Successfully broadcasted theme change
      } catch (error) {
        safeDebugLog('error', 'THEMESYNCSERVICE', 'ThemeSyncService: Failed to broadcast theme change:', error);
      }
    }
  }

  /**
   * Add a listener for theme changes
   */
  addListener(listener: (themeData: ThemeData) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Remove a listener
   */
  removeListener(listener: (themeData: ThemeData) => void) {
    this.listeners.delete(listener);
  }

  /**
   * Notify all local listeners
   */
  private notifyListeners(themeData: ThemeData) {
    this.listeners.forEach(listener => {
      try {
        listener(themeData);
      } catch (error) {
        safeDebugLog('error', 'THEMESYNCSERVICE', 'ThemeSyncService: Error in listener:', error);
      }
    });
  }

  /**
   * Get current theme data from main window
   */
  async getCurrentTheme(): Promise<ThemeData | null> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        const themeData = await window.electronAPI.getCurrentTheme();
        safeDebugLog('info', 'THEMESYNCSERVICE', 'ThemeSyncService: Got current theme from main process:', themeData);
        return themeData;
      } catch (error) {
        safeDebugLog('error', 'THEMESYNCSERVICE', 'ThemeSyncService: Failed to get current theme:', error);
      }
    }
    return null;
  }
}

export const themeSyncService = ThemeSyncService.getInstance();
