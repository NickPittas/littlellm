// Extend Window interface for tool thinking trigger
declare global {
  interface Window {
    triggerToolThinking?: (toolName: string) => void;
  }
}

export interface LLMProvider {
  id: string;
  name: string;
  baseUrl: string;
  requiresApiKey: boolean;
  models: string[];
  logo: string; // Path to the provider logo (dark theme)
  logoLight?: string; // Path to the provider logo (light theme)
}

export interface LLMSettings {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  toolCallingEnabled?: boolean;
  memoryContext?: MemoryContext; // Memory context for provider-specific integration
}

import { mcpService } from './mcpService';
import { getMemoryMCPTools, executeMemoryTool, isMemoryTool } from './memoryMCPTools';
import { memoryContextService, MemoryContext } from './memoryContextService';
import { internalCommandService } from './internalCommandService';
import { ProviderAdapter } from './providers/ProviderAdapter';
import { debugLogger } from './debugLogger';
import {
  ToolObject,
  MessageContent,
  ContentItem,
  LLMResponse
} from './providers/types';

// Type guards for tool types
interface MCPTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  serverId?: string;
}

// interface MemoryTool {
//   type: string;
//   function: {
//     name: string;
//     description: string;
//     parameters: Record<string, unknown>;
//   };
// }

// Types are imported from providers/types

// Tool call arguments interface
export interface ToolCallArguments {
  [key: string]: unknown;
}

// Tool execution result interface
export interface ToolExecutionResult {
  success: boolean;
  result?: unknown;
  error?: string;
  toolName: string;
  arguments: ToolCallArguments;
}

// Combined tool type for MCP and Memory tools (currently unused)
// type CombinedTool = MCPTool | MemoryTool;

// Type guard functions (currently unused but kept for potential future use)
// function isMCPTool(tool: CombinedTool): tool is MCPTool {
//   return 'name' in tool && 'description' in tool && !('function' in tool);
// }

// function isMemoryToolType(tool: CombinedTool): tool is MemoryTool {
//   return 'type' in tool && 'function' in tool;
// }

// Helper function to check if a tool is an internal command
function isInternalCommand(toolName: string): boolean {
  const internalCommandNames = [
    // Terminal commands
    'start_process', 'read_process_output', 'interact_with_process',
    'force_terminate', 'list_sessions', 'kill_process', 'list_processes',
    // Filesystem commands
    'read_file', 'read_multiple_files', 'write_file', 'create_directory',
    'list_directory', 'move_file', 'search_files', 'search_code', 'get_file_info',
    // Text editing commands
    'edit_block'
  ];
  return internalCommandNames.includes(toolName);
}

// ToolObject is imported from providers/types

// Default providers configuration
const DEFAULT_PROVIDERS: LLMProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    models: [],
    logo: '/assets/providers/openai.png'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    requiresApiKey: true,
    models: [],
    logo: '/assets/providers/anthropic.png'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    requiresApiKey: true,
    models: [],
    logo: '/assets/providers/gemini.png'
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    requiresApiKey: true,
    models: [],
    logo: '/assets/providers/mistral.png'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    requiresApiKey: true,
    models: [],
    logo: '/assets/providers/deepseek.png'
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    requiresApiKey: false,
    models: [],
    logo: '/assets/providers/lmstudio.png'
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: '',
    requiresApiKey: false,
    models: [],
    logo: '/assets/providers/ollama.png'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    models: [],
    logo: '/assets/providers/openrouter.png'
  },
  {
    id: 'requesty',
    name: 'Requesty',
    baseUrl: 'https://router.requesty.ai/v1',
    requiresApiKey: true,
    models: [],
    logo: '/assets/providers/requesty.svg'
  },
  {
    id: 'replicate',
    name: 'Replicate',
    baseUrl: 'https://api.replicate.com/v1',
    requiresApiKey: true,
    models: [],
    logo: '/assets/providers/replicate.png'
  },
  {
    id: 'n8n',
    name: 'n8n Workflow',
    baseUrl: '',
    requiresApiKey: false,
    models: [],
    logo: '/assets/providers/n8n.png'
  }
];

// Fallback models for when API calls fail
const FALLBACK_MODELS: Record<string, string[]> = {
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo'
  ],
  anthropic: [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ],
  gemini: [
    'gemini-1.5-pro-latest',
    'gemini-1.5-flash-latest',
    'gemini-1.0-pro'
  ],
  mistral: [
    'mistral-medium-latest',      // Vision-capable
    'pixtral-large-latest',       // Vision-capable
    'pixtral-12b-2409',          // Vision-capable
    'mistral-large-latest',       // Text-only
    'mistral-small-latest'        // Text-only
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-coder'
  ],
  lmstudio: [
    'local-model'
  ],
  ollama: [
    'llama2',
    'codellama',
    'mistral'
  ],
  openrouter: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'meta-llama/llama-3.1-405b-instruct'
  ],
  requesty: [
    'openai/gpt-4o',
    'anthropic/claude-3.5-sonnet',
    'meta-llama/llama-3.1-405b-instruct'
  ],
  replicate: [
    'meta/llama-2-70b-chat',
    'mistralai/mixtral-8x7b-instruct-v0.1'
  ],
  n8n: [
    'n8n-workflow'
  ]
};

class LLMService {
  private providers: LLMProvider[] = DEFAULT_PROVIDERS;
  private modelCache: Map<string, { models: string[], timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private providerAdapter: ProviderAdapter;

  constructor() {
    // Initialize provider adapter and inject dependencies
    this.providerAdapter = new ProviderAdapter();
    this.setupProviderAdapter();

    // Initialize internal command service
    this.initializeInternalCommands();
  }

  private async initializeInternalCommands() {
    try {
      await internalCommandService.initialize();
      console.log('🔧 Internal command service initialized in LLM service');
    } catch (error) {
      console.error('❌ Failed to initialize internal command service:', error);
    }
  }

  private setupProviderAdapter() {
    // Inject dependencies into the provider adapter
    this.providerAdapter.setMCPToolsGetter(this.getMCPToolsForProvider.bind(this));
    this.providerAdapter.setToolExecutor(this.executeMCPTool.bind(this));
    this.providerAdapter.setToolShouldSendChecker(this.shouldSendTools.bind(this));
    this.providerAdapter.setMemoryCreator(this.createMemoryFromConversation.bind(this));

    // Inject new tool execution dependencies
    this.providerAdapter.setMultipleToolsExecutor(this.executeMultipleToolsParallel.bind(this));
    this.providerAdapter.setToolResultsSummarizer(this.summarizeToolResultsForModel.bind(this));
    this.providerAdapter.setToolResultsAggregator(this.aggregateToolResults.bind(this));
    this.providerAdapter.setToolResultFormatter(this.formatToolResult.bind(this));
  }

  getProviders(): LLMProvider[] {
    return this.providers;
  }

  getProvider(id: string): LLMProvider | undefined {
    return this.providers.find(p => p.id === id);
  }

  // Get the provider adapter for accessing actual provider instances
  getProviderAdapter(): ProviderAdapter {
    return this.providerAdapter;
  }

  async getModels(providerId: string, apiKey?: string, baseUrl?: string): Promise<string[]> {
    const cacheKey = `${providerId}-${apiKey || 'no-key'}-${baseUrl || 'default'}`;
    const cached = this.modelCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.models;
    }

    try {
      const models = await this.providerAdapter.fetchModels(providerId, apiKey || '', baseUrl);
      this.modelCache.set(cacheKey, { models, timestamp: Date.now() });
      return models;
    } catch (error) {
      console.warn(`Failed to fetch models for ${providerId}:`, error);
      return FALLBACK_MODELS[providerId] || [];
    }
  }

  // Alias for backward compatibility with frontend
  async fetchModels(providerId: string, apiKey?: string, baseUrl?: string): Promise<string[]> {
    return this.getModels(providerId, apiKey, baseUrl);
  }

  async sendMessage(
    message: string | MessageContent,
    settings: LLMSettings,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
    const provider = this.getProvider(settings.provider);
    if (!provider) {
      throw new Error(`Provider ${settings.provider} not found`);
    }

    console.log(`🚀 LLMService: Sending message via ${provider.name}`);

    try {
      // Use the new ProviderAdapter for all providers
      const response = await this.providerAdapter.sendMessage(
        settings.provider, // providerId is the first parameter
        message,
        settings,
        provider,
        conversationHistory,
        onStream,
        signal,
        conversationId
      );

      console.log(`✅ LLMService: Message sent successfully via ${provider.name}`);
      return response;
    } catch (error) {
      console.error(`❌ LLMService: Error sending message via ${provider.name}:`, error);
      throw error;
    }
  }

  async testConnection(settings: LLMSettings): Promise<boolean> {
    try {
      const provider = this.getProvider(settings.provider);
      if (!provider) {
        return false;
      }

      // Test with a simple message
      const testMessage = "Hello";
      const testSettings = {
        ...settings,
        maxTokens: 10, // Minimal tokens for testing
        toolCallingEnabled: false // Disable tools for connection test
      };

      await this.sendMessage(testMessage, testSettings, [], undefined, undefined);
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }





  // MCP Integration Methods

  public async getMCPToolsForProvider(provider: string, settings?: LLMSettings): Promise<unknown[]> {
    try {
      console.log(`🔍 Getting MCP tools for provider: ${provider}`);
      console.log(`🔍 MCP Service available:`, !!mcpService);
      console.log(`🔍 Tool calling enabled:`, settings?.toolCallingEnabled !== false);

      // Check if tool calling is disabled
      if (settings?.toolCallingEnabled === false) {
        console.log(`🚫 Tool calling is disabled, returning empty tools array`);
        return [];
      }

      // Get tools directly from enabled servers in JSON
      console.log(`🔍 Reading MCP servers directly from JSON file...`);
      const mcpTools = await this.getToolsFromEnabledServers();
      console.log(`📋 Tools from enabled servers (${mcpTools.length} tools):`, mcpTools);

      // Add memory tools to the available tools
      const memoryTools = getMemoryMCPTools();
      console.log(`🧠 Memory tools available (${memoryTools.length} tools):`, memoryTools.map(t => t.function.name));

      // Get internal command tools if enabled
      const isInternalEnabled = internalCommandService.isEnabled();
      console.log(`🔧 Internal commands enabled: ${isInternalEnabled}`);
      const internalTools = isInternalEnabled ? internalCommandService.getAvailableTools() : [];
      console.log(`🔧 Internal command tools available (${internalTools.length} tools):`, internalTools.map(t => t.name));
      if (internalTools.length === 0 && isInternalEnabled) {
        console.warn(`⚠️ Internal commands are enabled but no tools returned. This indicates a configuration or filtering issue.`);
      }

      // Convert all tools to a unified format that providers can handle
      const unifiedTools: Array<{type: string, function: {name: string, description: string, parameters: unknown}, serverId?: string}> = [];
      const toolNames = new Set<string>(); // Track tool names to prevent duplicates

      // First, add internal command tools (highest priority)
      for (const tool of internalTools) {
        if (!toolNames.has(tool.name)) {
          unifiedTools.push({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema || {
                type: 'object',
                properties: {},
                required: []
              }
            },
            serverId: 'internal-commands' // Mark as internal command
          });
          toolNames.add(tool.name);
          console.log(`🔧 Added internal command tool: ${tool.name}`);
        }
      }

      // Then add memory tools (medium priority)
      for (const tool of memoryTools) {
        const toolName = tool.function.name;
        if (!toolNames.has(toolName)) {
          unifiedTools.push(tool);
          toolNames.add(toolName);
          console.log(`🧠 Added memory tool: ${toolName}`);
        } else {
          console.log(`⚠️ Skipped duplicate memory tool: ${toolName} (already exists)`);
        }
      }

      // Finally, add MCP tools (lowest priority - skip if name conflicts)
      for (const tool of mcpTools) {
        if (!toolNames.has(tool.name)) {
          unifiedTools.push({
            type: 'function',
            function: {
              name: tool.name,
              description: tool.description,
              parameters: tool.inputSchema || {
                type: 'object',
                properties: {},
                required: []
              }
            },
            serverId: tool.serverId // Keep server ID for execution routing
          });
          toolNames.add(tool.name);
          console.log(`📋 Added MCP tool: ${tool.name} from server ${tool.serverId}`);
        } else {
          console.log(`⚠️ Skipped duplicate MCP tool: ${tool.name} from server ${tool.serverId} (conflicts with higher priority tool)`);
        }
      }

      console.log(`📋 Total unified tools available (${unifiedTools.length} tools):`, unifiedTools.map(t => t.function.name));

      if (!unifiedTools || unifiedTools.length === 0) {
        console.log(`⚠️ No tools available for provider: ${provider}`);
        return [];
      }

      // Return unified tools - all in the same format for consistent provider handling
      console.log(`✅ Returning ${unifiedTools.length} unified tools for ${provider} to format`);
      return unifiedTools;
    } catch (error) {
      console.error('❌ Failed to get MCP tools:', error);
      return [];
    }
  }

  private async executeMCPTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    try {
      // Parse arguments if they're a JSON string
      let parsedArgs = args;
      if (typeof args === 'string') {
        try {
          parsedArgs = JSON.parse(args);
        } catch {
          console.warn(`⚠️ Failed to parse tool arguments as JSON, using as-is:`, args);
        }
      }

      console.log(`🔧 Executing tool: ${toolName} with args:`, parsedArgs);

      // Check if this is a memory tool
      if (isMemoryTool(toolName)) {
        console.log(`🧠 Executing memory tool: ${toolName}`);
        const result = await executeMemoryTool(toolName, parsedArgs);
        console.log(`✅ Memory tool ${toolName} executed successfully:`, result);
        return JSON.stringify(result);
      }
      // Check if this is an internal command
      else if (isInternalCommand(toolName)) {
        console.log(`🔧 Executing internal command: ${toolName}`);

        // Trigger thinking indicator for tool execution
        if (typeof window !== 'undefined' && window.triggerToolThinking) {
          window.triggerToolThinking(toolName);
        }

        const startTime = Date.now();
        const result = await internalCommandService.executeCommand(toolName, parsedArgs);
        const duration = Date.now() - startTime;

        console.log(`✅ Internal command ${toolName} executed successfully:`, result);

        // Automatically log tool execution for debugging
        debugLogger.logToolExecution(toolName, parsedArgs, result, duration);

        // Format result for LLM consumption
        if (result.success) {
          console.log(`🔧 Internal command result structure:`, result);
          const textContent = result.content
            .filter(item => item.type === 'text')
            .map(item => item.text)
            .join('\n');
          console.log(`🔧 Extracted text content:`, textContent);

          // Ensure we have meaningful content to return to the LLM
          if (!textContent || textContent.trim() === '') {
            const fallbackResult = `The ${toolName} command executed successfully but returned no output.`;
            console.log(`🔧 No text content, using fallback:`, fallbackResult);
            return fallbackResult;
          }

          console.log(`🔧 Final result being returned:`, textContent);
          return textContent;
        } else {
          console.log(`🔧 Internal command failed:`, result);

          // Format error in a user-friendly way for the LLM
          const errorMessage = result.error || 'Command failed';
          const friendlyError = `The ${toolName} command failed. ${this.formatErrorForLLM(errorMessage, toolName)}`;
          console.log(`🔧 Formatted error for LLM:`, friendlyError);
          return friendlyError;
        }
      }
      else {
        // Execute as MCP tool
        console.log(`🔧 Executing MCP tool: ${toolName}`);

        // Trigger thinking indicator for tool execution
        if (typeof window !== 'undefined' && window.triggerToolThinking) {
          window.triggerToolThinking(toolName);
        }

        const startTime = Date.now();
        const result = await mcpService.callTool(toolName, parsedArgs);
        const duration = Date.now() - startTime;

        console.log(`✅ MCP tool ${toolName} executed successfully:`, result);

        // Automatically log MCP tool execution for debugging
        debugLogger.logToolExecution(toolName, parsedArgs, result, duration);

        // Format MCP tool results consistently
        if (result && typeof result === 'object') {
          const resultObj = result as {
            content?: Array<{ type: string; text?: string }>;
            text?: string;
            error?: unknown;
          }; // Type assertion for MCP result object

          // If result has content, extract it
          if (resultObj.content && Array.isArray(resultObj.content)) {
            const textContent = resultObj.content
              .filter((item: { type: string; text?: string }) => item.type === 'text')
              .map((item: { type: string; text?: string }) => item.text)
              .join('\n');

            if (textContent) {
              console.log(`🔧 Extracted MCP text content:`, textContent);
              return textContent;
            }
          }

          // If result has a direct text property
          if (resultObj.text) {
            return resultObj.text;
          }

          // If result has error information
          if (resultObj.error) {
            const friendlyError = `The ${toolName} tool failed. ${this.formatErrorForLLM(String(resultObj.error), toolName)}`;
            console.log(`🔧 Formatted MCP error for LLM:`, friendlyError);
            return friendlyError;
          }
        }

        // Fallback to JSON string if no specific format found
        return JSON.stringify(result);
      }
    } catch (error) {
      console.error(`❌ Failed to execute tool ${toolName}:`, error);

      // Categorize and provide user-friendly error messages
      const errorMessage = this.categorizeToolError(toolName, error, args);
      return errorMessage;
    }
  }

  // Enhanced error categorization for better user feedback
  private categorizeToolError(toolName: string, error: unknown, args: Record<string, unknown>): string {
    const errorStr = error instanceof Error ? error.message : String(error);
    const errorLower = errorStr.toLowerCase();

    // Network/Connection Errors
    if (errorLower.includes('network') || errorLower.includes('connection') ||
        errorLower.includes('timeout') || errorLower.includes('econnrefused') ||
        errorLower.includes('fetch failed') || errorLower.includes('socket')) {
      return `🌐 Network Error: Unable to connect to the service for ${toolName}. Please check your internet connection and try again.`;
    }

    // Tool Not Found Errors
    if (errorLower.includes('not found') || errorLower.includes('unknown tool') ||
        errorLower.includes('tool') && errorLower.includes('not available')) {
      return `🔧 Tool Unavailable: The ${toolName} tool is not currently available. This might be due to a service configuration issue or the tool being temporarily disabled.`;
    }

    // Authentication/Permission Errors
    if (errorLower.includes('unauthorized') || errorLower.includes('forbidden') ||
        errorLower.includes('authentication') || errorLower.includes('api key') ||
        errorLower.includes('permission denied')) {
      return `🔐 Authentication Error: Access denied for ${toolName}. Please check your API credentials or permissions.`;
    }

    // Rate Limiting Errors
    if (errorLower.includes('rate limit') || errorLower.includes('too many requests') ||
        errorLower.includes('quota exceeded') || errorLower.includes('429')) {
      return `⏱️ Rate Limit: Too many requests to ${toolName}. Please wait a moment before trying again.`;
    }

    // Invalid Arguments Errors
    if (errorLower.includes('invalid') && (errorLower.includes('argument') || errorLower.includes('parameter')) ||
        errorLower.includes('missing required') || errorLower.includes('validation error')) {
      const argsList = Object.keys(args).length > 0 ? `\nProvided arguments: ${JSON.stringify(args, null, 2)}` : '\nNo arguments provided.';
      return `📝 Invalid Arguments: The ${toolName} tool received invalid or missing parameters.${argsList}\nPlease check the tool documentation for required parameters.`;
    }

    // Service Unavailable Errors
    if (errorLower.includes('service unavailable') || errorLower.includes('502') ||
        errorLower.includes('503') || errorLower.includes('504') ||
        errorLower.includes('server error') || errorLower.includes('internal error')) {
      return `🚫 Service Unavailable: The ${toolName} service is temporarily unavailable. Please try again later.`;
    }

    // JSON/Parsing Errors
    if (errorLower.includes('json') || errorLower.includes('parse') ||
        errorLower.includes('syntax error') || errorLower.includes('unexpected token')) {
      return `📄 Data Format Error: The ${toolName} tool returned malformed data. This is likely a temporary issue with the service.`;
    }

    // Timeout Errors
    if (errorLower.includes('timeout') || errorLower.includes('timed out') ||
        errorLower.includes('deadline exceeded')) {
      return `⏰ Timeout Error: The ${toolName} tool took too long to respond. The service might be overloaded. Please try again.`;
    }

    // Generic Error with helpful context
    return `❌ Tool Execution Error: ${toolName} failed to execute.\nError: ${errorStr}\n\nThis might be a temporary issue. Please try again or contact support if the problem persists.`;
  }

  // Helper to determine if tools should be sent based on conversation state
  private async shouldSendTools(conversationId: string | undefined, tools: ToolObject[]): Promise<boolean> {
    if (!conversationId || tools.length === 0) {
      return tools.length > 0; // Send tools if available and no conversation tracking
    }

    try {
      // Import conversation service dynamically to avoid circular dependencies
      const { conversationHistoryService } = await import('./conversationHistoryService');

      // Generate current tools hash
      const currentToolsHash = conversationHistoryService.generateToolsHash(tools);

      // Get stored tools hash for this conversation
      const storedToolsHash = await conversationHistoryService.getToolsHashForConversation(conversationId);

      // Send tools if:
      // 1. No stored hash (first message in conversation)
      // 2. Tools have changed (different hash)
      const shouldSend = !storedToolsHash || storedToolsHash !== currentToolsHash;

      if (shouldSend) {
        // Update stored hash for this conversation
        await conversationHistoryService.setToolsHashForConversation(conversationId, currentToolsHash);
        console.log(`🔧 Sending tools to ${conversationId}: ${tools.length} tools (hash: ${currentToolsHash})`);
      } else {
        console.log(`🔧 Skipping tools for ${conversationId}: no changes (hash: ${currentToolsHash})`);
      }

      return shouldSend;
    } catch (error) {
      console.error('Error checking tool state:', error);
      return tools.length > 0; // Fallback to always send tools
    }
  }

  // Helper methods for MCP tools

  private async getToolsFromEnabledServers(): Promise<MCPTool[]> {
    try {
      console.log(`🔍 Attempting to get MCP tools from enabled servers...`);
      
      // First, check if we can get the server list
      const servers = await mcpService.getServers();
      console.log(`📊 MCP servers found: ${servers.length}`);
      const enabledServers = servers.filter(s => s.enabled);
      console.log(`✅ Enabled MCP servers: ${enabledServers.length}`, enabledServers.map(s => s.name));
      
      // Check if servers need to be connected first
      console.log(`🔗 Attempting to connect to enabled MCP servers...`);
      for (const server of enabledServers) {
        try {
          const connected = await mcpService.connectServer(server.id);
          console.log(`🔗 Server ${server.name} (${server.id}) connection result:`, connected);
        } catch (connectError) {
          console.error(`❌ Failed to connect server ${server.name}:`, connectError);
        }
      }
      
      // Now try to get tools
      const mcpTools = await mcpService.getAvailableTools();
      console.log(`📋 Raw MCP tools from service (${mcpTools.length} tools):`, mcpTools);
      
      if (mcpTools.length === 0) {
        console.warn(`⚠️ No MCP tools retrieved despite enabled servers. This indicates an MCP connectivity issue.`);
        console.warn(`⚠️ Possible causes: 1) Servers not connected, 2) Tool extraction failing, 3) IPC communication broken`);
      }
      
      return mcpTools;
    } catch (error) {
      console.error(`❌ Failed to get tools from enabled servers:`, error);
      return [];
    }
  }

  /**
   * Format error messages in a user-friendly way for LLM consumption
   */
  private formatErrorForLLM(errorMessage: string, toolName: string): string {
    // Common error patterns and their user-friendly explanations
    const errorPatterns = [
      {
        pattern: /Unknown internal command/i,
        replacement: `The command "${toolName}" is not available or not enabled in the current configuration.`
      },
      {
        pattern: /Path is not allowed/i,
        replacement: `Access to the specified path is not permitted. Please check the allowed directories in settings.`
      },
      {
        pattern: /ENOENT|No such file or directory/i,
        replacement: `The specified file or directory does not exist.`
      },
      {
        pattern: /EACCES|Permission denied/i,
        replacement: `Permission denied. The system does not allow access to this resource.`
      },
      {
        pattern: /timeout|timed out/i,
        replacement: `The operation timed out. The command may be taking too long to execute.`
      },
      {
        pattern: /Not implemented in browser/i,
        replacement: `This command is not available in the current environment.`
      }
    ];

    // Try to match and replace with user-friendly message
    for (const { pattern, replacement } of errorPatterns) {
      if (pattern.test(errorMessage)) {
        return replacement;
      }
    }

    // If no pattern matches, return a generic friendly message
    return `An error occurred: ${errorMessage}. Please check your configuration and try again.`;
  }

  private truncateToolNameForAnthropic(name: string): string {
    if (name.length <= 64) return name;

    // Try to truncate intelligently by removing common prefixes/suffixes
    let truncated = name;

    // Remove common prefixes
    const prefixes = ['mcp_', 'tool_', 'function_'];
    for (const prefix of prefixes) {
      if (truncated.startsWith(prefix)) {
        truncated = truncated.substring(prefix.length);
        break;
      }
    }

    // If still too long, truncate from the end
    if (truncated.length > 64) {
      truncated = truncated.substring(0, 61) + '...';
    }

    return truncated;
  }



  private async createMemoryFromConversation(
    userMessage: string,
    aiResponse: string,
    conversationHistory: Array<{role: string, content: string}> = [],
    conversationId?: string,
    projectId?: string
  ): Promise<void> {
    try {
      // Analyze the conversation to determine if memory should be created
      const analysis = memoryContextService.analyzeMessage(userMessage, conversationHistory);

      if (analysis.shouldCreateMemory) {
        const success = await memoryContextService.createMemoryFromConversation(
          userMessage,
          aiResponse,
          analysis,
          conversationId,
          projectId
        );

        if (success) {
          console.log(`🧠 Auto-created memory from conversation (type: ${analysis.suggestedMemoryType})`);
        }
      }
    } catch (error) {
      console.error('Error creating memory from conversation:', error);
    }
  }

  // Private helper methods for tool execution

  /**
   * Execute multiple tools in parallel with proper routing (internal commands vs MCP tools)
   */
  private async executeMultipleToolsParallel(
    toolCalls: Array<{
      id?: string;
      name: string;
      arguments: Record<string, unknown>;
    }>,
    provider: string = 'unknown'
  ): Promise<Array<{
    id?: string;
    name: string;
    result: string;
    success: boolean;
    executionTime: number;
  }>> {
    console.log(`🚀 Executing ${toolCalls.length} tools in parallel (optimized) for ${provider}:`, toolCalls.map(tc => tc.name));

    const startTime = Date.now();

    // IMPORTANT: Use executeMCPTool for each tool to ensure proper routing
    // This handles internal commands vs MCP tools correctly
    const toolPromises = toolCalls.map(async (toolCall, index) => {
      const toolStartTime = Date.now();
      try {
        console.log(`🔧 [${index}] Starting parallel execution of ${toolCall.name} with proper routing`);

        // Use executeMCPTool which has the correct routing logic for internal commands
        const result = await this.executeMCPTool(toolCall.name, toolCall.arguments);
        const executionTime = Date.now() - toolStartTime;
        console.log(`✅ [${index}] Tool ${toolCall.name} completed in ${executionTime}ms`);

        return {
          id: toolCall.id,
          name: toolCall.name,
          result,
          success: true,
          executionTime
        };
      } catch (error) {
        const executionTime = Date.now() - toolStartTime;
        console.error(`❌ [${index}] Tool ${toolCall.name} failed in ${executionTime}ms:`, error);

        return {
          id: toolCall.id,
          name: toolCall.name,
          result: error instanceof Error ? error.message : String(error),
          success: false,
          executionTime
        };
      }
    });

    // Execute all tools in parallel using Promise.allSettled for proper error handling
    const results = await Promise.allSettled(toolPromises);
    const totalTime = Date.now() - startTime;

    // Process results
    const processedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          id: toolCalls[index].id,
          name: toolCalls[index].name,
          result: `Tool execution failed: ${result.reason}`,
          success: false,
          executionTime: 0
        };
      }
    });

    const successCount = processedResults.filter(r => r.success).length;
    const failureCount = processedResults.length - successCount;

    console.log(`🏁 Optimized parallel execution completed in ${totalTime}ms: ${successCount} successful, ${failureCount} failed`);

    return processedResults;
  }

  /**
   * Legacy parallel execution method (fallback)
   */
  private async executeMultipleToolsLegacy(toolCalls: Array<{
    id?: string;
    name: string;
    arguments: Record<string, unknown>;
  }>): Promise<Array<{
    id?: string;
    name: string;
    result: string;
    success: boolean;
    executionTime: number;
  }>> {
    console.log(`🔄 Using legacy parallel execution for ${toolCalls.length} tools`);

    const startTime = Date.now();

    // Execute all tools in parallel using Promise.allSettled for proper error handling
    const toolPromises = toolCalls.map(async (toolCall, index) => {
      const toolStartTime = Date.now();
      try {
        console.log(`🔧 [${index}] Starting legacy parallel execution of ${toolCall.name}`);

        const result = await this.executeMCPTool(toolCall.name, toolCall.arguments);
        const executionTime = Date.now() - toolStartTime;
        console.log(`✅ [${index}] Tool ${toolCall.name} completed in ${executionTime}ms`);

        return {
          id: toolCall.id,
          name: toolCall.name,
          result,
          success: true,
          executionTime
        };
      } catch (error) {
        const executionTime = Date.now() - toolStartTime;
        console.error(`❌ [${index}] Tool ${toolCall.name} failed after ${executionTime}ms:`, error);

        return {
          id: toolCall.id,
          name: toolCall.name,
          result: JSON.stringify({
            error: `Legacy parallel execution failed: ${error instanceof Error ? error.message : String(error)}`,
            toolName: toolCall.name,
            args: toolCall.arguments
          }),
          success: false,
          executionTime
        };
      }
    });

    // Wait for all tools to complete (successful or failed)
    const results = await Promise.allSettled(toolPromises);
    const totalTime = Date.now() - startTime;

    // Process results and extract values
    const processedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`❌ Promise rejected for tool ${toolCalls[index].name}:`, result.reason);
        return {
          id: toolCalls[index].id,
          name: toolCalls[index].name,
          result: JSON.stringify({
            error: `Promise execution failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
            toolName: toolCalls[index].name,
            args: toolCalls[index].arguments
          }),
          success: false,
          executionTime: 0
        };
      }
    });

    const successCount = processedResults.filter(r => r.success).length;
    const failureCount = processedResults.length - successCount;

    console.log(`🏁 Legacy parallel execution completed in ${totalTime}ms: ${successCount} successful, ${failureCount} failed`);

    return processedResults;
  }

  /**
   * Create user-friendly summary of tool execution results (for model context)
   */
  private summarizeToolResultsForModel(results: Array<{
    id?: string;
    name: string;
    result: string;
    success: boolean;
    executionTime: number;
  }>): string {
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    let summary = '';

    // Add collapsible tool execution details (similar to <think> blocks)
    summary += `<tool_execution>\n`;
    summary += `**Tool Execution Summary:** ${successfulResults.length}/${results.length} tools completed successfully.\n\n`;

    // Add formatted results for the model to work with
    successfulResults.forEach((result) => {
      summary += `**${result.name} Result:**\n`;

      try {
        const parsedResult = JSON.parse(result.result);
        const formattedResult = this.formatToolResult(result.name, parsedResult);
        summary += `${formattedResult}\n\n`;
      } catch {
        // If not JSON, add as plain text
        const cleanResult = result.result.replace(/^"|"$/g, '');
        summary += `${cleanResult}\n\n`;
      }
    });

    // Add failed results if any
    if (failedResults.length > 0) {
      summary += `**Failed Tools:**\n`;
      failedResults.forEach((result) => {
        summary += `- ${result.name}: ${result.result}\n`;
      });
    }

    summary += `</tool_execution>\n\n`;

    return summary;
  }

  /**
   * Enhanced aggregation and formatting of results from multiple tool executions (for debugging)
   */
  private aggregateToolResults(results: Array<{
    id?: string;
    name: string;
    result: string;
    success: boolean;
    executionTime: number;
  }>): string {
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    let aggregatedContent = '';

    // Add execution summary with enhanced formatting
    aggregatedContent += `## 🛠️ Multi-Tool Execution Results\n`;
    aggregatedContent += `**Executed:** ${results.length} tools | **✅ Success:** ${successfulResults.length} | **❌ Failed:** ${failedResults.length}\n\n`;

    // Add successful results with intelligent formatting
    if (successfulResults.length > 0) {
      aggregatedContent += `### ✅ Successful Results\n\n`;
      successfulResults.forEach((result) => {
        aggregatedContent += `#### 🔧 **${result.name}** \`${result.executionTime}ms\`\n`;

        try {
          const parsedResult = JSON.parse(result.result);
          const formattedResult = this.formatToolResult(result.name, parsedResult);
          aggregatedContent += `${formattedResult}\n\n`;
        } catch {
          // If not JSON, add as plain text with basic formatting
          const cleanResult = result.result.replace(/^"|"$/g, ''); // Remove surrounding quotes
          aggregatedContent += `${cleanResult}\n\n`;
        }
      });
    }

    // Add failed results if any
    if (failedResults.length > 0) {
      aggregatedContent += `### ❌ Failed Results\n\n`;
      failedResults.forEach((result) => {
        aggregatedContent += `#### 🚨 **${result.name}** \`${result.executionTime}ms\`\n`;
        aggregatedContent += `**Error:** ${result.result}\n\n`;
      });
    }

    return aggregatedContent;
  }

  /**
   * Format individual tool results based on tool type and content
   */
  private formatToolResult(toolName: string, result: unknown): string {
    const toolType = this.identifyToolType(toolName);

    switch (toolType) {
      case 'search':
        return this.formatSearchResult(result as { results?: Array<{ title?: string; content?: string; snippet?: string; url?: string }> });
      case 'memory':
        return this.formatMemoryResult(result as { success?: boolean; memories?: Array<{ title?: string; content?: string }>; id?: string });
      case 'file':
        return this.formatFileResult(result as { content?: string; [key: string]: unknown });
      case 'api':
        return this.formatApiResult(result as { status?: string; data?: unknown; [key: string]: unknown });
      case 'datetime':
        return this.formatDateTimeResult(result as string | { content?: Array<{ text?: string }>; [key: string]: unknown });
      case 'weather':
        return this.formatWeatherResult(result as string | { weather?: string; temperature?: string; condition?: string; [key: string]: unknown });
      default:
        return this.formatGenericResult(result);
    }
  }

  /**
   * Identify tool type based on tool name
   */
  private identifyToolType(toolName: string): string {
    const name = toolName.toLowerCase();

    if (name.includes('search') || name.includes('web')) {
      return 'search';
    } else if (name.includes('memory')) {
      return 'memory';
    } else if (name.includes('file') || name.includes('read') || name.includes('write')) {
      return 'file';
    } else if (name.includes('api') || name.includes('http') || name.includes('fetch')) {
      return 'api';
    } else if (name.includes('datetime') || name.includes('date') || name.includes('time')) {
      return 'datetime';
    } else if (name.includes('weather')) {
      return 'weather';
    }

    return 'generic';
  }

  /**
   * Format search tool results
   */
  private formatSearchResult(result: { results?: Array<{ title?: string; content?: string; snippet?: string; url?: string }> }): string {
    if (result.results && Array.isArray(result.results)) {
      let formatted = `**Found ${result.results.length} results:**\n\n`;
      result.results.slice(0, 5).forEach((item: { title?: string; content?: string; snippet?: string; url?: string }, index: number) => {
        formatted += `${index + 1}. **${item.title || 'No title'}**\n`;
        if (item.url) formatted += `   🔗 ${item.url}\n`;
        if (item.content || item.snippet) {
          const content = (item.content || item.snippet || '').substring(0, 200);
          formatted += `   ${content}${content.length >= 200 ? '...' : ''}\n\n`;
        }
      });
      if (result.results.length > 5) {
        formatted += `... and ${result.results.length - 5} more results\n`;
      }
      return formatted;
    }

    return this.formatGenericResult(result);
  }

  /**
   * Format memory tool results
   */
  private formatMemoryResult(result: { success?: boolean; memories?: Array<{ title?: string; content?: string }>; id?: string }): string {
    if (result.success && result.memories && Array.isArray(result.memories)) {
      let formatted = `**Retrieved ${result.memories.length} memory entries:**\n\n`;
      result.memories.forEach((memory: { title?: string; content?: string }, index: number) => {
        formatted += `${index + 1}. **${memory.title || 'Untitled'}**\n`;
        formatted += `   ${memory.content?.substring(0, 150)}${(memory.content?.length || 0) > 150 ? '...' : ''}\n\n`;
      });
      return formatted;
    } else if (result.id) {
      return `**Memory saved successfully** (ID: ${result.id})\n`;
    }

    return this.formatGenericResult(result);
  }

  /**
   * Format file tool results
   */
  private formatFileResult(result: { content?: string; [key: string]: unknown }): string {
    if (result.content) {
      const content = result.content.substring(0, 500);
      return `**File Content:**\n\`\`\`\n${content}${result.content.length > 500 ? '\n... (truncated)' : ''}\n\`\`\`\n`;
    }

    return this.formatGenericResult(result);
  }

  /**
   * Format API tool results
   */
  private formatApiResult(result: { status?: string; data?: unknown; [key: string]: unknown }): string {
    if (result.status && result.data) {
      return `**API Response (${result.status}):**\n\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\`\n`;
    }

    return this.formatGenericResult(result);
  }

  /**
   * Format datetime tool results
   */
  private formatDateTimeResult(result: string | { content?: Array<{ text?: string }>; [key: string]: unknown }): string {
    if (typeof result === 'string') {
      return `**Current Date/Time:** ${result}\n`;
    } else if (result.content && Array.isArray(result.content)) {
      const text = result.content.map(item => item.text).join(' ');
      return `**Date/Time Information:** ${text}\n`;
    }

    return this.formatGenericResult(result);
  }

  /**
   * Format weather tool results
   */
  private formatWeatherResult(result: string | { weather?: string; temperature?: string; condition?: string; [key: string]: unknown }): string {
    if (typeof result === 'string') {
      return `**Weather:** ${result}\n`;
    } else if (result.weather || result.temperature || result.condition) {
      let formatted = `**Weather Information:**\n`;
      if (result.condition) formatted += `- Condition: ${result.condition}\n`;
      if (result.temperature) formatted += `- Temperature: ${result.temperature}\n`;
      if (result.weather) formatted += `- Details: ${result.weather}\n`;
      return formatted;
    }

    return this.formatGenericResult(result);
  }

  /**
   * Format generic tool results
   */
  private formatGenericResult(result: unknown): string {
    if (typeof result === 'string') {
      return result;
    } else if (typeof result === 'object' && result !== null) {
      return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\`\n`;
    } else {
      return String(result);
    }
  }

}

export const llmService = new LLMService();
