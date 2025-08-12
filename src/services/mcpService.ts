// MCP Service for renderer process - uses IPC to communicate with main process
// The actual MCP SDK runs in the main process to avoid Node.js module conflicts

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

export interface MCPServer {

  id: string;
  name: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  description?: string;
  version?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  serverId: string;
}

export interface MCPPrompt {
  name: string;
  description: string;
  arguments: Array<{
    name: string;
    description: string;
    required: boolean;
  }>;
  serverId: string;
}

class MCPService {
  constructor() {
    // Renderer process MCP service - delegates to main process via IPC
  }

  // Server Management - delegates to main process
  public async getServers(): Promise<MCPServer[]> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const mcpData = await window.electronAPI.getMCPServers();
        return (mcpData.servers as MCPServer[]) || [];
      }
    } catch (error) {
      safeDebugLog('warn', 'MCPSERVICE', 'Failed to load MCP servers:', error);
    }
    return [];
  }

  public async addServer(server: Omit<MCPServer, 'id'>): Promise<MCPServer> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return (await window.electronAPI.addMCPServer(server)) as MCPServer;
      }
    } catch (error) {
      safeDebugLog('error', 'MCPSERVICE', 'Failed to add MCP server:', error);
    }
    throw new Error('Failed to add MCP server');
  }

  public async updateServer(id: string, updates: Partial<MCPServer>): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.updateMCPServer(id, updates);
      }
    } catch (error) {
      safeDebugLog('error', 'MCPSERVICE', 'Failed to update MCP server:', error);
    }
    return false;
  }

  public async removeServer(id: string): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.removeMCPServer(id);
      }
    } catch (error) {
      safeDebugLog('error', 'MCPSERVICE', 'Failed to remove MCP server:', error);
    }
    return false;
  }

  // Connection Management - delegates to main process
  public async connectServer(serverId: string): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.connectMCPServer(serverId);
      }
    } catch (error) {
      safeDebugLog('error', 'MCPSERVICE', 'Failed to connect MCP server:', error);
    }
    return false;
  }

  public async disconnectServer(serverId: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.disconnectMCPServer(serverId);
      }
    } catch (error) {
      safeDebugLog('error', 'MCPSERVICE', 'Failed to disconnect MCP server:', error);
    }
  }

  public async disconnectAll(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.disconnectAllMCPServers();
      }
    } catch (error) {
      safeDebugLog('error', 'MCPSERVICE', 'Failed to disconnect all MCP servers:', error);
    }
  }

  // Tool Operations - delegates to main process
  public async getAvailableTools(): Promise<MCPTool[]> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return (await window.electronAPI.getAllMCPTools()) as MCPTool[];
      }
    } catch (error) {
      safeDebugLog('warn', 'MCPSERVICE', 'Failed to get available MCP tools:', error);
    }
    return [];
  }

  public async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.callMCPTool(toolName, args);
      }
    } catch (error) {
      safeDebugLog('error', 'MCPSERVICE', 'Failed to call MCP tool:', error);
      // Enhance error with more context
      const enhancedError = this.enhanceMCPError(toolName, error, args);
      throw enhancedError;
    }
    throw new Error(`🔧 Tool Unavailable: The ${toolName} tool is not currently available. This might be due to a service configuration issue or the tool being temporarily disabled.`);
  }

  /**
   * Execute multiple MCP tools concurrently with optimized performance
   */
  public async callMultipleTools(toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    id?: string;
  }>): Promise<Array<{
    id?: string;
    name: string;
    result: unknown;
    success: boolean;
    error?: string;
    executionTime: number;
  }>> {
    safeDebugLog('info', 'MCPSERVICE', `🚀 MCP Service: Executing ${toolCalls.length} tools concurrently`);

    const startTime = Date.now();

    // Execute all tools in parallel using Promise.allSettled for proper error handling
    const toolPromises = toolCalls.map(async (toolCall) => {
      const toolStartTime = Date.now();
      try {
        const result = await this.callTool(toolCall.name, toolCall.args);
        const executionTime = Date.now() - toolStartTime;

        return {
          id: toolCall.id,
          name: toolCall.name,
          result,
          success: true,
          executionTime
        };
      } catch (error) {
        const executionTime = Date.now() - toolStartTime;

        return {
          id: toolCall.id,
          name: toolCall.name,
          result: null,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          executionTime
        };
      }
    });

    const results = await Promise.allSettled(toolPromises);
    const totalTime = Date.now() - startTime;

    // Process results and handle any promise rejections
    const processedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          id: toolCalls[index].id,
          name: toolCalls[index].name,
          result: null,
          success: false,
          error: `Promise execution failed: ${result.reason}`,
          executionTime: 0
        };
      }
    });

    const successCount = processedResults.filter(r => r.success).length;
    safeDebugLog('info', 'MCPSERVICE', `✅ MCP Service: Concurrent execution completed in ${totalTime}ms: ${successCount}/${toolCalls.length} successful`);

    return processedResults;
  }

  /**
   * Enhanced error handling for MCP tool execution
   */
  private enhanceMCPError(toolName: string, error: unknown, args: Record<string, unknown>): Error {
    const errorStr = error instanceof Error ? error.message : String(error);
    const errorLower = errorStr.toLowerCase();

    // MCP-specific error patterns
    if (errorLower.includes('server not connected') || errorLower.includes('connection closed')) {
      return new Error(`🔌 Connection Error: The MCP server for ${toolName} is not connected. Please check the server configuration.`);
    }

    if (errorLower.includes('method not found') || errorLower.includes('unknown method')) {
      return new Error(`🔧 Tool Error: The ${toolName} tool method is not available on the MCP server. The server might need to be updated.`);
    }

    if (errorLower.includes('invalid params') || errorLower.includes('parameter validation')) {
      const argsList = Object.keys(args).length > 0 ? `\nProvided: ${JSON.stringify(args, null, 2)}` : '\nNo arguments provided.';
      return new Error(`📝 Parameter Error: Invalid parameters for ${toolName}.${argsList}`);
    }

    if (errorLower.includes('server error') || errorLower.includes('internal error')) {
      return new Error(`🚫 Server Error: The MCP server encountered an internal error while executing ${toolName}. Please try again.`);
    }

    // Return enhanced error with context
    return new Error(`❌ MCP Tool Error: ${toolName} execution failed.\nDetails: ${errorStr}`);
  }

  /**
   * Enhanced tool execution with performance monitoring and optimization
   */
  public async callToolsOptimized(toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    id?: string;
  }>): Promise<Array<{
    id?: string;
    name: string;
    result: unknown;
    success: boolean;
    error?: string;
    executionTime: number;
    serverUsed?: string;
  }>> {
    // For now, use sequential execution directly to avoid console errors
    // TODO: Implement parallel execution when Electron API is available
    safeDebugLog('info', 'MCPSERVICE', `🔄 Executing ${toolCalls.length} tools sequentially`);
    return await this.callMultipleToolsSequential(toolCalls);
  }

  /**
   * Fallback sequential execution for when concurrent execution fails
   */
  private async callMultipleToolsSequential(toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    id?: string;
  }>): Promise<Array<{
    id?: string;
    name: string;
    result: unknown;
    success: boolean;
    error?: string;
    executionTime: number;
  }>> {
    safeDebugLog('info', 'MCPSERVICE', `🔄 Sequential execution for ${toolCalls.length} tools`);

    const results = [];

    for (const toolCall of toolCalls) {
      const startTime = Date.now();
      try {
        const result = await this.callTool(toolCall.name, toolCall.args);
        const executionTime = Date.now() - startTime;

        results.push({
          id: toolCall.id,
          name: toolCall.name,
          result,
          success: true,
          executionTime
        });
      } catch (error) {
        const executionTime = Date.now() - startTime;

        results.push({
          id: toolCall.id,
          name: toolCall.name,
          result: null,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          executionTime
        });
      }
    }

    return results;
  }

  // Resource Operations - delegates to main process
  public async getAvailableResources(): Promise<MCPResource[]> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return (await window.electronAPI.getAllMCPResources()) as MCPResource[];
      }
    } catch (error) {
      safeDebugLog('warn', 'MCPSERVICE', 'Failed to get available MCP resources:', error);
    }
    return [];
  }

  public async readResource(uri: string): Promise<unknown> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.readMCPResource(uri);
      }
    } catch (error) {
      safeDebugLog('error', 'MCPSERVICE', 'Failed to read MCP resource:', error);
      throw error;
    }
    throw new Error(`Resource ${uri} not found in any connected MCP server`);
  }

  // Prompt Operations - delegates to main process
  public async getAvailablePrompts(): Promise<MCPPrompt[]> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return (await window.electronAPI.getAllMCPPrompts()) as MCPPrompt[];
      }
    } catch (error) {
      safeDebugLog('warn', 'MCPSERVICE', 'Failed to get available MCP prompts:', error);
    }
    return [];
  }

  public async getPrompt(name: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.getMCPPrompt(name, args);
      }
    } catch (error) {
      safeDebugLog('error', 'MCPSERVICE', 'Failed to get MCP prompt:', error);
      throw error;
    }
    throw new Error(`Prompt ${name} not found in any connected MCP server`);
  }

  // Connection Status - delegates to main process
  public async getConnectionStatus(): Promise<Record<string, boolean>> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.getMCPConnectionStatus();
      }
    } catch (error) {
      safeDebugLog('warn', 'MCPSERVICE', 'Failed to get MCP connection status:', error);
    }
    return {};
  }

  public async getConnectedServerIds(): Promise<string[]> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.getConnectedMCPServerIds();
      }
    } catch (error) {
      safeDebugLog('warn', 'MCPSERVICE', 'Failed to get connected MCP server IDs:', error);
    }
    return [];
  }

  public async isServerConnected(serverId: string): Promise<boolean> {
    try {
      const connectionStatus = await this.getConnectionStatus();
      return connectionStatus[serverId] || false;
    } catch (error) {
      safeDebugLog('warn', 'MCPSERVICE', 'Failed to check MCP server connection status:', error);
      return false;
    }
  }

  // Auto-connect enabled servers
  public async connectEnabledServers(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.connectEnabledMCPServers();
      }
    } catch (error) {
      safeDebugLog('error', 'MCPSERVICE', 'Failed to auto-connect enabled MCP servers:', error);
    }
  }

  // Restart all MCP servers (useful after environment variable changes)
  public async restartAllServers(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Disconnect all servers first, then reconnect them
        await window.electronAPI.disconnectAllMCPServers();
        await window.electronAPI.connectEnabledMCPServers();
      }
    } catch (error) {
      safeDebugLog('error', 'MCPSERVICE', 'Failed to restart MCP servers:', error);
    }
  }

  public async getDetailedStatus(): Promise<unknown> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.getMCPDetailedStatus();
      }
      return { totalServers: 0, connectedServers: 0, servers: [] };
    } catch (error) {
      safeDebugLog('error', 'MCPSERVICE', 'Failed to get detailed MCP status:', error);
      return { totalServers: 0, connectedServers: 0, servers: [] };
    }
  }
}

// Create and export a singleton instance
export const mcpService = new MCPService();
