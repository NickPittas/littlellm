/**
 * Theme Synchronization Service
 * Ensures all windows stay synchronized with theme changes
 */

export interface ThemeData {
  customColors: any;
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
      window.electronAPI.onThemeChange((themeData: ThemeData) => {
        console.log('ThemeSyncService: Received theme change:', themeData);
        this.notifyListeners(themeData);
      });
    }
  }

  /**
   * Broadcast theme change to all windows
   */
  async broadcastThemeChange(themeData: ThemeData) {
    console.log('ThemeSyncService: Broadcasting theme change:', themeData);
    
    // Notify local listeners first
    this.notifyListeners(themeData);
    
    // Broadcast to other windows via Electron IPC
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        await window.electronAPI.notifyThemeChange(themeData);
        console.log('ThemeSyncService: Successfully broadcasted theme change');
      } catch (error) {
        console.error('ThemeSyncService: Failed to broadcast theme change:', error);
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
        console.error('ThemeSyncService: Error in listener:', error);
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
        console.log('ThemeSyncService: Got current theme from main process:', themeData);
        return themeData;
      } catch (error) {
        console.error('ThemeSyncService: Failed to get current theme:', error);
      }
    }
    return null;
  }
}

export const themeSyncService = ThemeSyncService.getInstance();
