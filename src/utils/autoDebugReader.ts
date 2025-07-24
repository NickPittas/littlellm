/**
 * Automatic debug log reader that I can call from codebase-retrieval
 * This will automatically read and return the debug log content
 */

export async function getDebugLogContent(): Promise<string> {
  try {
    // Check if we're in Electron environment
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const result = await (window as any).electronAPI.readDebugLog();
      if (result.success) {
        const content = result.content || 'Debug log is empty';
        const logPath = result.logPath || 'Unknown path';
        
        return `=== AUTOMATIC DEBUG LOG DUMP ===
Log File Path: ${logPath}
Timestamp: ${new Date().toISOString()}
Content Length: ${content.length} characters

=== LOG CONTENT ===
${content}

=== END OF LOG ===`;
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

export async function clearDebugLogContent(): Promise<string> {
  try {
    // Check if we're in Electron environment
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const result = await (window as any).electronAPI.clearDebugLog();
      if (result.success) {
        const logPath = result.logPath || 'Unknown path';
        return `Debug log cleared successfully at: ${logPath}`;
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

// Auto-initialize when loaded
if (typeof window !== 'undefined') {
  // Make functions available globally
  (window as any).getDebugLogContent = getDebugLogContent;
  (window as any).clearDebugLogContent = clearDebugLogContent;
  
  console.log('🔧 Auto Debug Reader loaded');
  console.log('🔧 All console output is automatically being saved to debug log file');
  console.log('🔧 Tool executions are automatically being logged');
  
  // Log initial message to verify system is working
  console.log('🔧 AUTO DEBUG: System initialized and ready for testing');
}
