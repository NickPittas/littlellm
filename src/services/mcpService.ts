// MCP Service for renderer process - uses IPC to communicate with main process
// The actual MCP SDK runs in the main process to avoid Node.js module conflicts

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
      console.warn('Failed to load MCP servers:', error);
    }
    return [];
  }

  public async addServer(server: Omit<MCPServer, 'id'>): Promise<MCPServer> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return (await window.electronAPI.addMCPServer(server)) as MCPServer;
      }
    } catch (error) {
      console.error('Failed to add MCP server:', error);
    }
    throw new Error('Failed to add MCP server');
  }

  public async updateServer(id: string, updates: Partial<MCPServer>): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.updateMCPServer(id, updates);
      }
    } catch (error) {
      console.error('Failed to update MCP server:', error);
    }
    return false;
  }

  public async removeServer(id: string): Promise<boolean> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.removeMCPServer(id);
      }
    } catch (error) {
      console.error('Failed to remove MCP server:', error);
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
      console.error('Failed to connect MCP server:', error);
    }
    return false;
  }

  public async disconnectServer(serverId: string): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.disconnectMCPServer(serverId);
      }
    } catch (error) {
      console.error('Failed to disconnect MCP server:', error);
    }
  }

  public async disconnectAll(): Promise<void> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.disconnectAllMCPServers();
      }
    } catch (error) {
      console.error('Failed to disconnect all MCP servers:', error);
    }
  }

  // Tool Operations - delegates to main process
  public async getAvailableTools(): Promise<MCPTool[]> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return (await window.electronAPI.getAllMCPTools()) as MCPTool[];
      }
    } catch (error) {
      console.warn('Failed to get available MCP tools:', error);
    }
    return [];
  }

  public async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.callMCPTool(toolName, args);
      }
    } catch (error) {
      console.error('Failed to call MCP tool:', error);
      throw error;
    }
    throw new Error(`Tool ${toolName} not found in any connected MCP server`);
  }

  // Resource Operations - delegates to main process
  public async getAvailableResources(): Promise<MCPResource[]> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return (await window.electronAPI.getAllMCPResources()) as MCPResource[];
      }
    } catch (error) {
      console.warn('Failed to get available MCP resources:', error);
    }
    return [];
  }

  public async readResource(uri: string): Promise<unknown> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.readMCPResource(uri);
      }
    } catch (error) {
      console.error('Failed to read MCP resource:', error);
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
      console.warn('Failed to get available MCP prompts:', error);
    }
    return [];
  }

  public async getPrompt(name: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.getMCPPrompt(name, args);
      }
    } catch (error) {
      console.error('Failed to get MCP prompt:', error);
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
      console.warn('Failed to get MCP connection status:', error);
    }
    return {};
  }

  public async getConnectedServerIds(): Promise<string[]> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.getConnectedMCPServerIds();
      }
    } catch (error) {
      console.warn('Failed to get connected MCP server IDs:', error);
    }
    return [];
  }

  public async isServerConnected(serverId: string): Promise<boolean> {
    try {
      const connectionStatus = await this.getConnectionStatus();
      return connectionStatus[serverId] || false;
    } catch (error) {
      console.warn('Failed to check MCP server connection status:', error);
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
      console.error('Failed to auto-connect enabled MCP servers:', error);
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
      console.error('Failed to restart MCP servers:', error);
    }
  }

  public async getDetailedStatus(): Promise<unknown> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        return await window.electronAPI.getMCPDetailedStatus();
      }
      return { totalServers: 0, connectedServers: 0, servers: [] };
    } catch (error) {
      console.error('Failed to get detailed MCP status:', error);
      return { totalServers: 0, connectedServers: 0, servers: [] };
    }
  }
}

// Create and export a singleton instance
export const mcpService = new MCPService();
