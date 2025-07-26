/**
 * Utility to read debug log file for analysis
 * This can be called from codebase-retrieval to analyze debug logs
 */

export async function readDebugLogFile(): Promise<string> {
  try {
    // Check if we're in Electron environment
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const result = await (window as any).electronAPI.readDebugLog();
      if (result.success) {
        const content = result.content || 'Debug log is empty';
        const logPath = result.logPath || 'Unknown path';
        return `Debug Log Path: ${logPath}\n\n${content}`;
      } else {
        return `Error reading debug log: ${result.error}`;
      }
    } else {
      return 'Debug log not available (not in Electron environment)';
    }
  } catch (error) {
    return `Failed to read debug log: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function clearDebugLogFile(): Promise<string> {
  try {
    // Check if we're in Electron environment
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const result = await (window as any).electronAPI.clearDebugLog();
      if (result.success) {
        return 'Debug log cleared successfully';
      } else {
        return `Error clearing debug log: ${result.error}`;
      }
    } else {
      return 'Debug log not available (not in Electron environment)';
    }
  } catch (error) {
    return `Failed to clear debug log: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// Make functions available globally for console access
if (typeof window !== 'undefined') {
  (window as any).readDebugLog = readDebugLogFile;
  (window as any).clearDebugLog = clearDebugLogFile;
  // Removed debug spam - utilities loaded silently
}
