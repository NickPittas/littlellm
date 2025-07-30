// Requesty provider implementation

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

import { REQUESTY_SYSTEM_PROMPT } from './prompts/requesty';
import { OpenAICompatibleStreaming } from './shared/OpenAICompatibleStreaming';

export class RequestyProvider extends BaseProvider {
  readonly id = 'requesty';
  readonly name = 'Requesty';
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
    // Requesty uses OpenAI-compatible API
    const messages = [];

    // Get MCP tools for Requesty
    const mcpTools = await this.getMCPToolsForProvider('requesty', settings);

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

    // Add tools if available
    if (mcpTools.length > 0) {
      requestBody.tools = mcpTools;
      requestBody.tool_choice = 'auto';
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
      throw new Error(`Requesty API error: ${error}`);
    }

    if (onStream) {
      return this.handleStreamResponse(response, onStream, settings, provider, conversationHistory, signal);
    } else {
      return this.handleNonStreamResponse(response, settings, conversationHistory, conversationId);
    }
  }

  async fetchModels(apiKey: string): Promise<string[]> {
    if (!apiKey) {
      console.log('❌ No Requesty API key provided - cannot fetch models');
      return [];
    }

    try {
      const response = await fetch('https://router.requesty.ai/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`❌ Requesty API error: ${response.status} - check API key`);
        return [];
      }

      const data = await response.json() as APIResponseData;
      const models = data.data?.map((model) => model.id)?.sort() || [];

      return models;
    } catch (error) {
      console.warn('❌ Failed to fetch Requesty models:', error);
      return [];
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
    return REQUESTY_SYSTEM_PROMPT;
  }

  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string {
    if (tools.length === 0) {
      return basePrompt;
    }

    // Requesty uses structured tool calling with tools parameter and tool_choice
    // Don't add XML tool instructions as they conflict with native function calling
    console.log(`🔧 Requesty using structured tools, skipping XML tool instructions`);
    return basePrompt;
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
    _signal?: AbortSignal
  ): Promise<LLMResponse> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    return OpenAICompatibleStreaming.handleStreamResponse(
      response,
      onStream,
      settings,
      provider,
      conversationHistory,
      'Requesty',
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
      'Requesty',
      this.executeMCPTool.bind(this),
      {},
      () => this.getMCPToolsForProvider(provider.id, settings),
      (tools: unknown[]) => {
        const basePrompt = settings.systemPrompt || this.getSystemPrompt();
        return this.enhanceSystemPromptWithTools(basePrompt, tools as ToolObject[]);
      }
    );
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  private async handleNonStreamResponse(
    response: Response,
    _settings: LLMSettings,
    _conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    _conversationId?: string
  ): Promise<LLMResponse> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    if (message.tool_calls && message.tool_calls.length > 0) {
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
