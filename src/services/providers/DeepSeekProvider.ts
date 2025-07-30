// DeepSeek provider implementation

import { BaseProvider } from './BaseProvider';
import {
  LLMSettings,
  LLMResponse,
  MessageContent,
  ContentItem,
  LLMProvider,
  ToolObject,
  ProviderCapabilities,
  APIResponseData
} from './types';

import { DEEPSEEK_SYSTEM_PROMPT } from './prompts/deepseek';
import { OpenAICompatibleStreaming } from './shared/OpenAICompatibleStreaming';

export class DeepSeekProvider extends BaseProvider {
  readonly id = 'deepseek';
  readonly name = 'DeepSeek';
  readonly capabilities: ProviderCapabilities = {
    supportsVision: false,
    supportsTools: false, // DeepSeek has limited tool support
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'openai'
  };

  async sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
    // DeepSeek uses OpenAI-compatible API
    const messages = [];

    const systemPrompt = settings.systemPrompt || this.getSystemPrompt();
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Add current message
    if (typeof message === 'string') {
      messages.push({ role: 'user', content: message });
    } else if (Array.isArray(message)) {
      // Handle ContentItem array format (from chatService.ts)
      // DeepSeek uses OpenAI-compatible format, so we can pass through as-is
      messages.push({ role: 'user', content: message });
    } else {
      // Handle legacy vision format (convert to OpenAI format)
      const messageWithImages = message as { text: string; images: string[] };
      const content: ContentItem[] = [{ type: 'text', text: messageWithImages.text }];

      for (const imageUrl of messageWithImages.images) {
        content.push({
          type: 'image_url',
          image_url: { url: imageUrl }
        });
      }
      messages.push({ role: 'user', content });
    }

    // Get MCP tools for DeepSeek (limited support)
    const mcpTools = await this.getMCPToolsForProvider('deepseek', settings);

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };

    // Add tools if available (DeepSeek has limited tool support)
    if (mcpTools.length > 0) {
      requestBody.tools = mcpTools;
      requestBody.tool_choice = 'auto';
      console.log(`🚀 DeepSeek API call with ${mcpTools.length} tools:`, {
        model: settings.model,
        toolCount: mcpTools.length,
        tools: mcpTools
      });
    } else {
      console.log(`🚀 DeepSeek API call without tools (no MCP tools available)`);
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${error}`);
    }

    if (onStream) {
      return this.handleStreamResponse(response, onStream, settings, provider, conversationHistory, signal);
    } else {
      return this.handleNonStreamResponse(response, settings, conversationHistory, conversationId);
    }
  }

  async fetchModels(apiKey: string): Promise<string[]> {
    if (!apiKey) {
      console.error('❌ No DeepSeek API key provided - cannot fetch models');
      throw new Error('DeepSeek API key is required to fetch available models. Please add your API key in settings.');
    }

    try {
      // DeepSeek models endpoint (OpenAI-compatible)
      const response = await fetch('https://api.deepseek.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ DeepSeek API error: ${response.status}`, errorText);
        throw new Error(`Failed to fetch DeepSeek models: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as APIResponseData;
      const models = data.data?.map((model) => model.id)?.sort() || [];

      if (models.length === 0) {
        throw new Error('No DeepSeek models returned from API. This may indicate an API issue or insufficient permissions.');
      }

      return models;
    } catch (error) {
      console.error('❌ Failed to fetch DeepSeek models:', error);
      throw error instanceof Error ? error : new Error(`Failed to fetch DeepSeek models: ${String(error)}`);
    }
  }

  formatTools(tools: ToolObject[]): unknown[] {
    // DeepSeek uses OpenAI-compatible format (limited support)
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name || tool.function?.name,
        description: tool.description || tool.function?.description,
        parameters: tool.parameters || tool.function?.parameters || {
          type: 'object',
          properties: {},
          required: []
        }
      }
    }));
  }

  getSystemPrompt(): string {
    return DEEPSEEK_SYSTEM_PROMPT;
  }

  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string {
    if (tools.length === 0) {
      return basePrompt;
    }

    // DeepSeek uses structured tool calling with tools parameter and tool_choice
    // Don't add XML tool instructions as they conflict with native function calling
    console.log(`🔧 DeepSeek using structured tools, skipping XML tool instructions`);
    return basePrompt;
  }

  validateToolCall(toolCall: { id?: string; name: string; arguments: Record<string, unknown> }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!toolCall.id) {
      errors.push(`DeepSeek tool call missing required id: ${toolCall.name}`);
    }

    if (!toolCall.name || typeof toolCall.name !== 'string') {
      errors.push('Tool call must have a valid name');
    }

    if (!toolCall.arguments || typeof toolCall.arguments !== 'object') {
      errors.push('Tool call must have valid arguments object');
    }

    return { valid: errors.length === 0, errors };
  }

  validateTool(tool: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!tool || typeof tool !== 'object') {
      errors.push('Tool must be an object');
      return { valid: false, errors };
    }

    const toolObj = tool as Record<string, unknown>;

    if (!toolObj.type || toolObj.type !== 'function') {
      errors.push('DeepSeek tools must have type: "function"');
    }

    if (!toolObj.function || typeof toolObj.function !== 'object') {
      errors.push('DeepSeek tools must have function object');
    } else {
      const func = toolObj.function as Record<string, unknown>;
      if (!func.name) {
        errors.push('DeepSeek tools must have function.name');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Private helper methods
  // This method is injected by the ProviderAdapter from the LLMService
  private getMCPToolsForProvider!: (providerId: string, settings: LLMSettings) => Promise<unknown[]>;

  /* eslint-disable @typescript-eslint/no-unused-vars */
  private async handleStreamResponse(
    response: Response,
    onStream: (chunk: string) => void,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    return OpenAICompatibleStreaming.handleStreamResponse(
      response,
      onStream,
      settings,
      provider,
      conversationHistory,
      'DeepSeek',
      this.executeToolsAndFollowUp.bind(this)
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async executeMCPTool(_toolName: string, _args: Record<string, unknown>): Promise<string> {
    // This will be injected by the main service
    return JSON.stringify({ error: 'Tool execution not available' });
  }

  private async executeToolsAndFollowUp(
    toolCalls: Array<{ id?: string; type?: string; function?: { name?: string; arguments?: string } }>,
    initialContent: string,
    initialUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    return OpenAICompatibleStreaming.executeToolsAndFollowUp(
      toolCalls,
      initialContent,
      initialUsage,
      settings,
      provider,
      conversationHistory,
      onStream,
      'DeepSeek',
      this.executeMCPTool.bind(this),
      {},
      () => this.getMCPToolsForProvider(provider.id, settings)
      // No enhanced system prompt function - tools sent separately in tools parameter
    );
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  private async handleNonStreamResponse(
    response: Response,
    settings: LLMSettings,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    conversationId?: string
  ): Promise<LLMResponse> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    const data = await response.json();
    console.log('🔍 DeepSeek non-streaming response:', {
      hasUsage: !!data.usage,
      usage: data.usage,
      responseKeys: Object.keys(data)
    });

    const choice = data.choices[0];
    const message = choice.message;

    // Handle tool calls (same as OpenAI format) - execute immediately like Anthropic
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`🔧 DeepSeek response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);

      // Check if we have the parallel execution method injected
      if ((this as unknown as {executeMultipleToolsParallel?: unknown, summarizeToolResultsForModel?: unknown}).executeMultipleToolsParallel && (this as unknown as {executeMultipleToolsParallel?: unknown, summarizeToolResultsForModel?: unknown}).summarizeToolResultsForModel) {
        console.log(`🚀 Executing ${message.tool_calls.length} DeepSeek tools immediately`);

        // Format tool calls for execution
        const toolCallsForExecution = message.tool_calls.map((toolCall: { id: string; function: { name: string; arguments: string } }) => ({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments)
        }));

        // Execute tools in parallel immediately
        const executeMultipleToolsParallel = (this as unknown as {executeMultipleToolsParallel: unknown}).executeMultipleToolsParallel;
        const summarizeToolResultsForModel = (this as unknown as {summarizeToolResultsForModel: unknown}).summarizeToolResultsForModel;
        
        try {
          const parallelResults = await (executeMultipleToolsParallel as (calls: unknown[], provider: string) => Promise<Array<{success: boolean}>>)(toolCallsForExecution, 'deepseek');
          console.log(`✅ DeepSeek tool execution completed: ${parallelResults.filter(r => r.success).length}/${parallelResults.length} successful`);

          // Get tool results summary for the model
          const toolSummary = (summarizeToolResultsForModel as (results: unknown[]) => string)(parallelResults);
          
          // Return response with tool results included
          return {
            content: (message.content || '') + '\n\n' + toolSummary,
            usage: data.usage ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens
            } : undefined
          };
        } catch (error) {
          console.error(`❌ DeepSeek tool execution failed:`, error);
          // Fall back to returning tool calls for external handling
          return {
            content: message.content || '',
            usage: data.usage ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens
            } : undefined,
            toolCalls: toolCallsForExecution
          };
        }
      } else {
        console.warn(`⚠️ DeepSeek provider missing tool execution methods - falling back to external handling`);
        // Fall back to external handling if methods not injected
        return {
          content: message.content || '',
          usage: data.usage ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens
          } : undefined,
          toolCalls: message.tool_calls.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments)
          }))
        };
      }
    }

    return {
      content: message.content,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    };
  }
}
