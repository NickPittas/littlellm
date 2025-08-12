// Provider adapter to integrate new provider architecture with existing llmService

import { ILLMProvider } from './BaseProvider';
import { ProviderFactory } from './ProviderFactory';

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('../debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}
import { 
  LLMSettings, 
  LLMResponse, 
  MessageContent, 
  ContentItem, 
  LLMProvider,
  ToolObject
} from './types';

export class ProviderAdapter {
  private mcpToolsGetter?: (providerId: string, settings: LLMSettings) => Promise<unknown[]>;
  private toolExecutor?: (toolName: string, args: Record<string, unknown>) => Promise<string>;
  private streamHandler?: (response: Response, onStream: (chunk: string) => void) => Promise<LLMResponse>;
  private toolShouldSendChecker?: (conversationId: string | undefined, tools: ToolObject[]) => Promise<boolean>;
  private memoryCreator?: (userMessage: string, aiResponse: string, conversationHistory: Array<{role: string, content: string}>, conversationId?: string) => Promise<void>;

  // New tool execution dependencies
  private multipleToolsExecutor?: (
    toolCalls: Array<{ id?: string; name: string; arguments: Record<string, unknown> }>,
    provider?: string
  ) => Promise<Array<{ id?: string; name: string; result: string; success: boolean; executionTime: number }>>;
  private toolResultsSummarizer?: (
    results: Array<{ id?: string; name: string; result: string; success: boolean; executionTime: number }>
  ) => string;
  private toolResultsAggregator?: (
    results: Array<{ id?: string; name: string; result: string; success: boolean; executionTime: number }>
  ) => string;
  private toolResultFormatter?: (toolName: string, result: unknown) => string;

  // Inject dependencies from the main service
  setMCPToolsGetter(getter: (providerId: string, settings: LLMSettings) => Promise<unknown[]>) {
    this.mcpToolsGetter = getter;
  }

  setToolExecutor(executor: (toolName: string, args: Record<string, unknown>) => Promise<string>) {
    this.toolExecutor = executor;
  }

  setStreamHandler(handler: (response: Response, onStream: (chunk: string) => void) => Promise<LLMResponse>) {
    this.streamHandler = handler;
  }

  setToolShouldSendChecker(checker: (conversationId: string | undefined, tools: ToolObject[]) => Promise<boolean>) {
    this.toolShouldSendChecker = checker;
  }

  setMemoryCreator(creator: (userMessage: string, aiResponse: string, conversationHistory: Array<{role: string, content: string}>, conversationId?: string) => Promise<void>) {
    this.memoryCreator = creator;
  }

  setMultipleToolsExecutor(executor: (
    toolCalls: Array<{ id?: string; name: string; arguments: Record<string, unknown> }>,
    provider?: string
  ) => Promise<Array<{ id?: string; name: string; result: string; success: boolean; executionTime: number }>>) {
    this.multipleToolsExecutor = executor;
  }

  setToolResultsSummarizer(summarizer: (
    results: Array<{ id?: string; name: string; result: string; success: boolean; executionTime: number }>
  ) => string) {
    this.toolResultsSummarizer = summarizer;
  }

  setToolResultsAggregator(aggregator: (
    results: Array<{ id?: string; name: string; result: string; success: boolean; executionTime: number }>
  ) => string) {
    this.toolResultsAggregator = aggregator;
  }

  setToolResultFormatter(formatter: (toolName: string, result: unknown) => string) {
    this.toolResultFormatter = formatter;
  }

  // Check if a provider is available in the new architecture
  hasProvider(providerId: string): boolean {
    return ProviderFactory.hasProvider(providerId);
  }

  // Get provider instance
  getProvider(providerId: string): ILLMProvider | null {
    return ProviderFactory.getProvider(providerId);
  }

  // Send message using new provider architecture
  async sendMessage(
    providerId: string,
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
    const providerInstance = this.getProvider(providerId);
    if (!providerInstance) {
      throw new Error(`Provider ${providerId} not found in new architecture`);
    }

    // Inject dependencies into the provider instance
    await this.injectDependencies(providerInstance);

    // Use the provider's sendMessage method
    return providerInstance.sendMessage(
      message,
      settings,
      provider,
      conversationHistory,
      onStream,
      signal,
      conversationId
    );
  }

  // Fetch models using new provider architecture
  async fetchModels(providerId: string, apiKey: string, baseUrl?: string): Promise<string[]> {
    const providerInstance = this.getProvider(providerId);
    if (!providerInstance) {
      throw new Error(`Provider ${providerId} not found in new architecture`);
    }

    return providerInstance.fetchModels(apiKey, baseUrl);
  }

  // Format tools using new provider architecture
  formatTools(providerId: string, tools: ToolObject[]): unknown[] {
    const providerInstance = this.getProvider(providerId);
    if (!providerInstance) {
      throw new Error(`Provider ${providerId} not found in new architecture`);
    }

    return providerInstance.formatTools(tools);
  }

  // Get system prompt using new provider architecture
  getSystemPrompt(providerId: string): string {
    const providerInstance = this.getProvider(providerId);
    if (!providerInstance) {
      throw new Error(`Provider ${providerId} not found in new architecture`);
    }

    return providerInstance.getSystemPrompt();
  }

  // Validate tool call using new provider architecture
  validateToolCall(providerId: string, toolCall: { id?: string; name: string; arguments: Record<string, unknown> }): { valid: boolean; errors: string[] } {
    const providerInstance = this.getProvider(providerId);
    if (!providerInstance) {
      return { valid: false, errors: [`Provider ${providerId} not found`] };
    }

    return providerInstance.validateToolCall(toolCall);
  }

  // Validate tool using new provider architecture
  validateTool(providerId: string, tool: unknown): { valid: boolean; errors: string[] } {
    const providerInstance = this.getProvider(providerId);
    if (!providerInstance) {
      return { valid: false, errors: [`Provider ${providerId} not found`] };
    }

    return providerInstance.validateTool(tool);
  }

  // Get provider capabilities
  getCapabilities(providerId: string) {
    const providerInstance = this.getProvider(providerId);
    return providerInstance?.capabilities;
  }

  // Private method to inject dependencies into provider instances
  private async injectDependencies(providerInstance: ILLMProvider) {
    safeDebugLog('info', 'PROVIDERADAPTER', `🔧 ProviderAdapter: Injecting dependencies into ${providerInstance.id}`);

    // Inject the MCP tools getter - always inject if available
    if (this.mcpToolsGetter) {
      (providerInstance as unknown as {getMCPToolsForProvider: unknown}).getMCPToolsForProvider = this.mcpToolsGetter;
      safeDebugLog('info', 'PROVIDERADAPTER', `✅ ProviderAdapter: Injected getMCPToolsForProvider into ${providerInstance.id}`);
    } else {
      safeDebugLog('warn', 'PROVIDERADAPTER', `⚠️ ProviderAdapter: No mcpToolsGetter available for ${providerInstance.id}`);
    }

    // Inject the tool executor - always inject if available
    if (this.toolExecutor) {
      (providerInstance as unknown as {executeMCPTool: unknown}).executeMCPTool = this.toolExecutor;
    }

    // Inject the parallel tool executor (like Anthropic uses) - always inject if available
    if (this.multipleToolsExecutor) {
      (providerInstance as unknown as {executeMultipleToolsParallel: unknown}).executeMultipleToolsParallel = this.multipleToolsExecutor;
    }

    // Inject tool result processing methods (like Anthropic uses) - always inject if available
    if (this.toolResultsSummarizer) {
      (providerInstance as unknown as {summarizeToolResultsForModel: unknown}).summarizeToolResultsForModel = this.toolResultsSummarizer;
    }

    if (this.toolResultsAggregator) {
      (providerInstance as unknown as {aggregateToolResults: unknown}).aggregateToolResults = this.toolResultsAggregator;
    }

    if (this.toolResultFormatter) {
      (providerInstance as unknown as {formatToolResult: unknown}).formatToolResult = this.toolResultFormatter;
    }

    // Inject the stream handler - always inject if available
    if (this.streamHandler) {
      (providerInstance as unknown as {handleStreamResponse: unknown}).handleStreamResponse = this.streamHandler;
    }

    // Inject the tool should send checker
    if (this.toolShouldSendChecker && 'shouldSendTools' in providerInstance) {
      (providerInstance as unknown as {shouldSendTools: unknown}).shouldSendTools = this.toolShouldSendChecker;
    }

    // Inject the memory creator
    if (this.memoryCreator && 'createMemoryFromConversation' in providerInstance) {
      (providerInstance as unknown as {createMemoryFromConversation: unknown}).createMemoryFromConversation = this.memoryCreator;
    }

    // Inject tool names for text-based tool calling providers
    if ('setAvailableToolNames' in providerInstance && this.mcpToolsGetter) {
      try {
        // Get the actual MCP tools and extract their names
        const mcpTools = await this.mcpToolsGetter(providerInstance.id, {} as LLMSettings);
        const toolNames = (mcpTools as Array<{name?: string, function?: {name?: string}}>).map(tool => {
          // Handle different tool formats
          if (tool.name) return tool.name;
          if (tool.function?.name) return tool.function.name;
          return null;
        }).filter(Boolean) as string[];

        safeDebugLog('info', 'PROVIDERADAPTER', `🔧 Injecting ${toolNames.length} tool names into ${providerInstance.id}:`, toolNames);
        (providerInstance as unknown as {setAvailableToolNames: (names: string[]) => void}).setAvailableToolNames(toolNames);
      } catch (error) {
        safeDebugLog('warn', 'PROVIDERADAPTER', `⚠️ Failed to inject tool names into ${providerInstance.id}:`, error);
      }
    }

    // Special injection for AnthropicProvider with new tool execution methods
    if (providerInstance.id === 'anthropic' && 'injectDependencies' in providerInstance) {
      const anthropicProvider = providerInstance as unknown as {injectDependencies?: (deps: unknown) => void};
      if (anthropicProvider.injectDependencies) {
        anthropicProvider.injectDependencies({
          executeMultipleToolsParallel: this.multipleToolsExecutor,
          summarizeToolResultsForModel: this.toolResultsSummarizer,
          aggregateToolResults: this.toolResultsAggregator,
          formatToolResult: this.toolResultFormatter,
          getMCPToolsForProvider: this.mcpToolsGetter
        });
      }
    }
  }
}

export default ProviderAdapter;
