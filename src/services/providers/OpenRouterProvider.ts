// OpenRouter provider implementation

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
import { FALLBACK_MODELS } from './constants';
import { OPENROUTER_SYSTEM_PROMPT, generateOpenRouterToolPrompt } from './prompts/openrouter';
import { OpenAICompatibleStreaming } from './shared/OpenAICompatibleStreaming';

export class OpenRouterProvider extends BaseProvider {
  readonly id = 'openrouter';
  readonly name = 'OpenRouter';
  readonly capabilities: ProviderCapabilities = {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: 64,
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
    // OpenRouter uses OpenAI-compatible API
    const messages = [];

    // Get MCP tools for OpenRouter (fix: use correct signature)
    const mcpTools = await this.getMCPToolsForProvider('openrouter', settings);

    // Build system prompt with tool instructions
    let systemPrompt = settings.systemPrompt || this.getSystemPrompt();
    if (mcpTools.length > 0) {
      systemPrompt = this.enhanceSystemPromptWithTools(systemPrompt, mcpTools as ToolObject[]);
    }

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Add current message
    messages.push({ role: 'user', content: message });

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };

    // Add tools if available (OpenRouter expects OpenAI format)
    if (mcpTools.length > 0) {
      requestBody.tools = this.formatTools(mcpTools as ToolObject[]);
      requestBody.tool_choice = 'auto';

      console.log(`🚀 OpenRouter API call with ${mcpTools.length} tools:`, {
        model: settings.model,
        toolCount: mcpTools.length,
        toolChoice: requestBody.tool_choice,
        formattedTools: requestBody.tools
      });
    } else {
      console.log(`🚀 OpenRouter API call without tools (no MCP tools available)`);
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'HTTP-Referer': 'https://littlellm.app',
        'X-Title': 'LittleLLM'
      },
      body: JSON.stringify(requestBody),
      signal
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    if (onStream) {
      return this.handleStreamResponse(response, onStream, settings, provider, conversationHistory, signal);
    } else {
      return this.handleNonStreamResponse(response, settings, conversationHistory, conversationId);
    }
  }

  async fetchModels(apiKey: string): Promise<string[]> {
    if (!apiKey) {
      return FALLBACK_MODELS.openrouter;
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        return FALLBACK_MODELS.openrouter;
      }

      const data = await response.json() as APIResponseData;
      const models = data.data?.map((model) => model.id)?.sort() || [];

      return models.length > 0 ? models : FALLBACK_MODELS.openrouter;
    } catch (error) {
      return FALLBACK_MODELS.openrouter;
    }
  }

  formatTools(tools: ToolObject[]): unknown[] {
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
    return OPENROUTER_SYSTEM_PROMPT;
  }

  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string {
    if (tools.length === 0) {
      return basePrompt;
    }

    const toolInstructions = generateOpenRouterToolPrompt(tools);
    return basePrompt + toolInstructions;
  }

  validateToolCall(toolCall: { id?: string; name: string; arguments: Record<string, unknown> }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!toolCall.name) {
      errors.push('Tool call must have a name');
    }

    if (toolCall.name && toolCall.name.length > this.capabilities.maxToolNameLength) {
      errors.push(`Tool name must be ≤${this.capabilities.maxToolNameLength} characters`);
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

    if (toolObj.type !== 'function') {
      errors.push('OpenRouter tools must have type "function"');
    }

    if (!toolObj.function || typeof toolObj.function !== 'object') {
      errors.push('OpenRouter tools must have function object');
    } else {
      const func = toolObj.function as Record<string, unknown>;
      if (!func.name) {
        errors.push('OpenRouter tools must have function.name');
      }
      if (func.name && typeof func.name === 'string' && func.name.length > 64) {
        errors.push('OpenRouter function names must be ≤64 characters');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Private helper methods
  private async getMCPToolsForProvider(providerId: string, settings: LLMSettings): Promise<unknown[]> {
    // This will be injected by the main service
    return [];
  }

  private async executeMCPTool(toolName: string, args: Record<string, unknown>): Promise<string> {
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
    onStream?: (chunk: string) => void
  ): Promise<LLMResponse> {
    console.log(`🔧 OpenRouter detected ${toolCalls.length} tool calls, executing...`);

    // Convert to standard format for tool execution
    const standardToolCalls = toolCalls
      .filter(tc => tc.id && tc.function?.name)
      .map(tc => ({
        id: tc.id!,
        name: tc.function!.name!,
        arguments: JSON.parse(tc.function!.arguments || '{}')
      }));

    // Execute all tool calls in parallel
    const toolResults = [];
    for (const toolCall of standardToolCalls) {
      try {
        console.log(`🔧 Executing OpenRouter tool call: ${toolCall.name}`);
        const toolResult = await this.executeMCPTool(toolCall.name, toolCall.arguments);
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.name,
          content: toolResult
        });
      } catch (error) {
        console.error(`❌ OpenRouter tool execution failed:`, error);
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.name,
          content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
        });
      }
    }

    // Build follow-up messages in OpenAI format
    const followUpMessages = [
      ...conversationHistory,
      {
        role: 'assistant',
        content: initialContent || null,
        tool_calls: toolCalls.map(tc => ({
          id: tc.id || '',
          type: 'function' as const,
          function: {
            name: tc.function?.name || '',
            arguments: tc.function?.arguments || '{}'
          }
        }))
      },
      ...toolResults
    ];

    console.log(`🔄 Making OpenRouter follow-up call to process tool results...`);

    const followUpRequestBody = {
      model: settings.model,
      messages: followUpMessages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: false
    };

    const followUpResponse = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'HTTP-Referer': 'https://littlellm.app',
        'X-Title': 'LittleLLM'
      },
      body: JSON.stringify(followUpRequestBody)
    });

    if (followUpResponse.ok) {
      const followUpData = await followUpResponse.json();
      const followUpMessage = followUpData.choices[0]?.message;

      // Combine usage statistics
      const combinedUsage = {
        promptTokens: (initialUsage?.prompt_tokens || 0) + (followUpData.usage?.prompt_tokens || 0),
        completionTokens: (initialUsage?.completion_tokens || 0) + (followUpData.usage?.completion_tokens || 0),
        totalTokens: (initialUsage?.total_tokens || 0) + (followUpData.usage?.total_tokens || 0)
      };

      // Stream the follow-up content if streaming is enabled
      if (onStream && followUpMessage?.content) {
        onStream(followUpMessage.content);
      }

      return {
        content: followUpMessage?.content || 'Tool execution completed.',
        usage: combinedUsage,
        toolCalls: standardToolCalls
      };
    } else {
      const errorText = await followUpResponse.text();
      console.error(`❌ OpenRouter follow-up call failed (${followUpResponse.status}):`, errorText);

      // Return original response with tool calls
      return {
        content: initialContent || 'Tool execution completed, but follow-up failed.',
        usage: initialUsage ? {
          promptTokens: initialUsage.prompt_tokens || 0,
          completionTokens: initialUsage.completion_tokens || 0,
          totalTokens: initialUsage.total_tokens || 0
        } : undefined,
        toolCalls: standardToolCalls
      };
    }
  }

  private async handleStreamResponse(
    response: Response,
    onStream: (chunk: string) => void,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    // Use the shared OpenAI-compatible streaming handler
    return OpenAICompatibleStreaming.handleStreamResponse(
      response,
      onStream,
      settings,
      provider,
      conversationHistory,
      'OpenRouter',
      this.executeToolsAndFollowUp.bind(this)
    );
  }

  private async handleNonStreamResponse(
    response: Response,
    settings: LLMSettings,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    conversationId?: string
  ): Promise<LLMResponse> {
    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    console.log('🔍 OpenRouter non-stream response:', {
      hasToolCalls: !!(message.tool_calls && message.tool_calls.length > 0),
      toolCallsCount: message.tool_calls?.length || 0,
      content: message.content,
      usage: data.usage
    });

    // Handle tool calls if present (OpenAI format)
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`🔧 OpenRouter response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);

      // Tool execution will be handled by the main service
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
