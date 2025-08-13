/**
 * Internal Command Service (Browser-compatible)
 * Provides DesktopCommanderMCP-like functionality as internal tools
 * with directory-scoped security restrictions
 *
 * This service runs in the renderer process and communicates with
 * the Electron main process via IPC for actual command execution
 */

import {
  CommandResult,
  InternalCommandTool,
  InternalCommandConfig
} from '../types/internalCommands';
import { settingsService } from './settingsService';
import { initializationManager } from './initializationManager';
import { serviceRegistry, SERVICE_NAMES, DebugLoggerInterface } from './serviceRegistry';

class InternalCommandService {
  static readonly SERVICE_NAME = 'InternalCommandService';

  private availableTools: InternalCommandTool[] = [];
  private isElectron = false;
  private initialized = false;

  constructor() {
    // Check if running in Electron
    this.isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined;

    // Register with initialization manager
    initializationManager.registerService(InternalCommandService.SERVICE_NAME);

    // Register with service registry to break circular dependencies
    serviceRegistry.registerService(SERVICE_NAMES.INTERNAL_COMMAND_SERVICE, this);
  }

  /**
   * Initialize the service and load configuration
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      // Already initialized, don't do it again
      return;
    }

    // Use service registry to avoid circular dependency
    const debugLogger = serviceRegistry.getService<DebugLoggerInterface>(SERVICE_NAMES.DEBUG_LOGGER);
    if (debugLogger) {
      debugLogger.debug('Loading internal commands settings:', settingsService.getSettings().internalCommands);
      debugLogger.debug('Setting internal commands state:', { isElectron: this.isElectron });
    }

    if (this.isElectron) {
      // Send configuration to Electron main process
      const settings = settingsService.getSettings();
      console.log(`🔧 InternalCommandService: Sending config to main process:`, settings.internalCommands);
      await this.sendConfigToMainProcess(settings.internalCommands);

      // Get available tools from main process
      console.log(`🔧 InternalCommandService: Getting tools from main process...`);
      this.availableTools = await this.getToolsFromMainProcess();
      console.log(`🔧 InternalCommandService: Received ${this.availableTools.length} tools from main process`);
    } else {
      // In browser mode, use static tool definitions
      console.log(`🔧 InternalCommandService: Browser mode - using static tools`);
      this.defineStaticTools();
    }

    this.initialized = true;
  }

  /**
   * Send configuration to main process
   */
  private async sendConfigToMainProcess(config: InternalCommandConfig): Promise<void> {
    if (this.isElectron && window.electronAPI) {
      try {
        await window.electronAPI.setInternalCommandsConfig(config);
      } catch (error) {
        console.error('Failed to send config to main process:', error);
      }
    }
  }

  /**
   * Get available tools from main process
   */
  private async getToolsFromMainProcess(): Promise<InternalCommandTool[]> {
    if (this.isElectron && window.electronAPI) {
      try {
        console.log(`🔧 InternalCommandService: Calling electronAPI.getInternalCommandsTools()`);
        const response = await window.electronAPI.getInternalCommandsTools();
        console.log(`🔧 InternalCommandService: Raw response from main process:`, response);
        const tools = (response as InternalCommandTool[]) || [];
        console.log(`🔧 InternalCommandService: Parsed ${tools.length} tools from main process`);
        return tools;
      } catch (error) {
        console.error('Failed to get tools from main process:', error);
        return [];
      }
    }
    console.log(`🔧 InternalCommandService: Not in Electron or no electronAPI available`);
    return [];
  }

  /**
   * Initialize tools (browser-compatible)
   */
  private initializeTools(): void {
    // In browser mode, tools are defined statically and execution happens via IPC
    this.defineStaticTools();
  }

  /**
   * Define static tool definitions for browser environment
   */
  private defineStaticTools(): void {
    // These are just the tool definitions - actual execution happens in main process
    this.availableTools = this.getAllToolDefinitions();
  }

  /**
   * Get all tool definitions for browser environment
   */
  private getAllToolDefinitions(): InternalCommandTool[] {
    return [
      // Terminal commands
      {
        name: 'start_process',
        description: 'Start a new terminal process',
        category: 'terminal',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string' },
            timeout_ms: { type: 'number' },
            shell: { type: 'string' }
          },
          required: ['command', 'timeout_ms']
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      {
        name: 'read_process_output',
        description: 'Read output from a running process',
        category: 'terminal',
        inputSchema: {
          type: 'object',
          properties: {
            pid: { type: 'number' },
            timeout_ms: { type: 'number' }
          },
          required: ['pid']
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      {
        name: 'interact_with_process',
        description: 'Send input to an interactive process',
        category: 'terminal',
        inputSchema: {
          type: 'object',
          properties: {
            pid: { type: 'number' },
            input: { type: 'string' },
            timeout_ms: { type: 'number' }
          },
          required: ['pid', 'input']
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      {
        name: 'force_terminate',
        description: 'Force terminate a process',
        category: 'terminal',
        inputSchema: {
          type: 'object',
          properties: {
            pid: { type: 'number' }
          },
          required: ['pid']
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      {
        name: 'list_sessions',
        description: 'List all active terminal sessions',
        category: 'terminal',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      {
        name: 'kill_process',
        description: 'Kill a system process by PID',
        category: 'terminal',
        inputSchema: {
          type: 'object',
          properties: {
            pid: { type: 'number' }
          },
          required: ['pid']
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      {
        name: 'list_processes',
        description: 'List all running processes on the system with CPU and memory usage',
        category: 'system',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      {
        name: 'get_cpu_usage',
        description: 'Get current CPU usage percentage and system performance metrics. Works on Windows (PowerShell), macOS (zsh/bash), and Linux (bash).',
        category: 'system',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      {
        name: 'get_memory_usage',
        description: 'Get current memory usage statistics including total, used, and available memory. Works on Windows (PowerShell), macOS (zsh/bash), and Linux (bash).',
        category: 'system',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      {
        name: 'get_system_info',
        description: 'Get comprehensive system information including OS, CPU, memory, and disk usage. Works across all platforms.',
        category: 'system',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      // Filesystem commands
      {
        name: 'read_file',
        description: 'Read file contents (supports images, documents, code)',
        category: 'filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            isUrl: { type: 'boolean' },
            offset: { type: 'number' },
            length: { type: 'number' }
          },
          required: ['path']
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      {
        name: 'write_file',
        description: 'Write or append to files',
        category: 'filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
            mode: { type: 'string' }
          },
          required: ['path', 'content']
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      {
        name: 'create_directory',
        description: 'Create directories',
        category: 'filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path']
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      {
        name: 'list_directory',
        description: 'List directory contents',
        category: 'filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path']
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      {
        name: 'move_file',
        description: 'Move or rename files/directories',
        category: 'filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            destination: { type: 'string' }
          },
          required: ['source', 'destination']
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      {
        name: 'search_files',
        description: 'Find files by name patterns',
        category: 'filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            pattern: { type: 'string' },
            timeoutMs: { type: 'number' }
          },
          required: ['path', 'pattern']
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      {
        name: 'get_file_info',
        description: 'Get detailed file metadata',
        category: 'filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path']
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      },
      // Text editing commands
      {
        name: 'edit_block',
        description: 'Apply surgical text replacements',
        category: 'textEditing',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            old_string: { type: 'string' },
            new_string: { type: 'string' },
            expected_replacements: { type: 'number' }
          },
          required: ['file_path', 'old_string', 'new_string']
        },
        handler: async () => ({ success: false, content: [], error: 'Not implemented in browser' })
      }
    ];
  }

  /**
   * Get all available tools (filtered by enabled categories)
   */
  getAvailableTools(): InternalCommandTool[] {
    const settings = settingsService.getSettings();
    const commandSettings = settings.internalCommands;

    console.log(`🔧 InternalCommandService.getAvailableTools() called`);
    console.log(`🔧 Settings enabled: ${commandSettings.enabled}`);
    console.log(`🔧 Available tools count: ${this.availableTools.length}`);
    console.log(`🔧 Enabled commands:`, commandSettings.enabledCommands);

    if (!commandSettings.enabled) {
      console.log(`🔧 Internal commands disabled, returning empty array`);
      return [];
    }

    const filteredTools = this.availableTools.filter(tool => {
      return (tool.category === 'terminal' && commandSettings.enabledCommands.terminal) ||
        (tool.category === 'filesystem' && commandSettings.enabledCommands.filesystem) ||
        (tool.category === 'textEditing' && commandSettings.enabledCommands.textEditing) ||
        (tool.category === 'system' && commandSettings.enabledCommands.system);
    });

    console.log(`🔧 Filtered tools count: ${filteredTools.length}`);
    if (filteredTools.length > 0) {
      console.log(`🔧 Sample filtered tools:`, filteredTools.slice(0, 3).map(t => ({ name: t.name, category: t.category })));
    }

    return filteredTools;
  }

  /**
   * Check if internal commands are enabled
   */
  isEnabled(): boolean {
    const settings = settingsService.getSettings();
    return settings.internalCommands.enabled;
  }

  /**
   * Execute an internal command tool (via IPC in Electron)
   */
  async executeCommand(toolName: string, args: unknown): Promise<CommandResult> {
    try {
      // Check if service is enabled
      if (!this.isEnabled()) {
        return {
          success: false,
          content: [{
            type: 'text',
            text: 'Internal commands are disabled'
          }],
          error: 'Internal commands are disabled'
        };
      }

      // In Electron, delegate to main process
      if (this.isElectron && window.electronAPI) {
        console.log(`🔧 Executing internal command via IPC: ${toolName}`);

        try {
          const result = await window.electronAPI.executeInternalCommand(toolName, args);

          console.log(`✅ Internal command completed: ${toolName}`);
          return (result as CommandResult) || {
            success: false,
            content: [{ type: 'text', text: 'No response from main process' }],
            error: 'No response from main process'
          };
        } catch (error) {
          console.error(`❌ IPC command failed: ${toolName}`, error);
          return {
            success: false,
            content: [{
              type: 'text',
              text: `IPC Error: ${error instanceof Error ? error.message : String(error)}`
            }],
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }

      // Fallback for non-Electron environments
      return {
        success: false,
        content: [{
          type: 'text',
          text: 'Internal commands are only available in Electron environment'
        }],
        error: 'Not available in browser environment'
      };

    } catch (error) {
      console.error(`❌ Internal command failed: ${toolName}`, error);

      return {
        success: false,
        content: [{
          type: 'text',
          text: `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`
        }],
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): InternalCommandConfig {
    const settings = settingsService.getSettings();
    return settings.internalCommands;
  }

  /**
   * Update configuration
   */
  async updateConfiguration(updates: Partial<InternalCommandConfig>): Promise<boolean> {
    try {
      const currentSettings = settingsService.getSettings();
      const updatedSettings = {
        ...currentSettings,
        internalCommands: {
          ...currentSettings.internalCommands,
          ...updates
        }
      };

      const success = await settingsService.updateSettings(updatedSettings);
      if (success && this.isElectron) {
        // Update configuration in main process
        await this.sendConfigToMainProcess(updatedSettings.internalCommands);
      }
      return success;
    } catch (error) {
      console.error('Failed to update internal command configuration:', error);
      return false;
    }
  }

  /**
   * Create error response helper
   */
  createErrorResponse(message: string): CommandResult {
    return {
      success: false,
      content: [{
        type: 'text',
        text: `Error: ${message}`
      }],
      error: message
    };
  }

  /**
   * Create success response helper
   */
  createSuccessResponse(text: string): CommandResult {
    return {
      success: true,
      content: [{
        type: 'text',
        text
      }]
    };
  }
}

// Export singleton instance
export const internalCommandService = new InternalCommandService();
