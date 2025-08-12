// Service for managing frequently-changing state data
// Separate from main settings to avoid constant file writes

// Type helper for accessing Electron API methods that might not be in the interface
type ElectronAPIWithStateFiles = {


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

  getStateFile: (filename: string) => Promise<unknown>;
  saveStateFile: (filename: string, data: unknown) => Promise<boolean>;
};

export interface ProviderState {
  currentProvider: string;
  currentModel: string;
  lastSelectedModels: Record<string, string>; // providerId -> modelId
}

export interface MCPState {
  enabledServers: string[];
  connectedServers: string[];
  lastToolsHash: Record<string, string>; // conversationId -> toolsHash
}

class StateService {
  private providerState: ProviderState = {
    currentProvider: '',
    currentModel: '',
    lastSelectedModels: {}
  };

  private mcpState: MCPState = {
    enabledServers: [],
    connectedServers: [],
    lastToolsHash: {}
  };

  private initialized = false;

  constructor() {
    this.loadState();
  }

  private async loadState() {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Load provider state
        const providerData = await (window.electronAPI as unknown as ElectronAPIWithStateFiles).getStateFile('provider-state.json');
        if (providerData) {
          this.providerState = { ...this.providerState, ...providerData };
        }

        // Load MCP state
        const mcpData = await (window.electronAPI as unknown as ElectronAPIWithStateFiles).getStateFile('mcp-state.json');
        if (mcpData) {
          this.mcpState = { ...this.mcpState, ...mcpData };
        }

        this.initialized = true;
        safeDebugLog('info', 'STATESERVICE', 'State service initialized:', {
          provider: this.providerState,
          mcp: this.mcpState
        });
      }
    } catch (error) {
      safeDebugLog('error', 'STATESERVICE', 'Failed to load state files:', error);
      this.initialized = true; // Continue with defaults
    }
  }

  // Provider State Management
  getProviderState(): ProviderState {
    return { ...this.providerState };
  }

  async updateProviderState(updates: Partial<ProviderState>) {
    this.providerState = { ...this.providerState, ...updates };
    await this.saveProviderState();
  }

  async setCurrentProvider(provider: string) {
    this.providerState.currentProvider = provider;
    await this.saveProviderState();
  }

  async setCurrentModel(model: string) {
    this.providerState.currentModel = model;
    
    // Also update last selected model for current provider
    if (this.providerState.currentProvider) {
      this.providerState.lastSelectedModels[this.providerState.currentProvider] = model;
    }
    
    await this.saveProviderState();
  }

  async setLastSelectedModel(providerId: string, modelId: string) {
    this.providerState.lastSelectedModels[providerId] = modelId;
    await this.saveProviderState();
  }

  getLastSelectedModel(providerId: string): string {
    return this.providerState.lastSelectedModels[providerId] || '';
  }

  private async saveProviderState() {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        await (window.electronAPI as unknown as ElectronAPIWithStateFiles).saveStateFile('provider-state.json', this.providerState);
      }
    } catch (error) {
      safeDebugLog('error', 'STATESERVICE', 'Failed to save provider state:', error);
    }
  }

  // MCP State Management
  getMCPState(): MCPState {
    return { ...this.mcpState };
  }

  async updateMCPState(updates: Partial<MCPState>) {
    this.mcpState = { ...this.mcpState, ...updates };
    await this.saveMCPState();
  }

  async setEnabledServers(serverIds: string[]) {
    this.mcpState.enabledServers = [...serverIds];
    await this.saveMCPState();
  }

  async setConnectedServers(serverIds: string[]) {
    this.mcpState.connectedServers = [...serverIds];
    await this.saveMCPState();
  }

  async setToolsHashForConversation(conversationId: string, toolsHash: string) {
    this.mcpState.lastToolsHash[conversationId] = toolsHash;
    await this.saveMCPState();
  }

  getToolsHashForConversation(conversationId: string): string | null {
    return this.mcpState.lastToolsHash[conversationId] || null;
  }

  private async saveMCPState() {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        await (window.electronAPI as unknown as ElectronAPIWithStateFiles).saveStateFile('mcp-state.json', this.mcpState);
      }
    } catch (error) {
      safeDebugLog('error', 'STATESERVICE', 'Failed to save MCP state:', error);
    }
  }

  // Utility methods
  isInitialized(): boolean {
    return this.initialized;
  }

  async waitForInitialization(): Promise<void> {
    if (this.initialized) return;
    
    return new Promise((resolve) => {
      const checkInit = () => {
        if (this.initialized) {
          resolve();
        } else {
          setTimeout(checkInit, 50);
        }
      };
      checkInit();
    });
  }
}

// Export singleton instance
export const stateService = new StateService();
