// Deepinfra provider implementation
// Uses OpenAI-compatible API at https://api.deepinfra.com/v1/openai

import { BaseProvider } from './BaseProvider';
import {
  LLMSettings,
  LLMResponse,
  MessageContent,
  ContentItem,
  LLMProvider,
  ToolObject,
  ProviderCapabilities
} from './types';
// No fallback models - providers now properly throw errors instead of masking failures
import { DEEPINFRA_SYSTEM_PROMPT } from './prompts/deepinfra';
import { OpenAICompatibleStreaming } from './shared/OpenAICompatibleStreaming';

export class DeepinfraProvider extends BaseProvider {
  readonly id = 'deepinfra';
  readonly name = 'Deepinfra';
  readonly capabilities: ProviderCapabilities = {
    supportsVision: true, // Many models support multimodal
    supportsTools: true, // Function calling supported for Llama, Mixtral, Mistral models
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
    const messages = [];

    // Get MCP tools for this provider
    const mcpTools = await this.getMCPToolsForProvider('deepinfra', settings);

    // Use behavioral system prompt
    const hasCustomSystemPrompt = settings.systemPrompt &&
      settings.systemPrompt.trim() &&
      settings.systemPrompt !== "You are a helpful AI assistant. Please provide concise and helpful responses.";

    const systemPrompt = hasCustomSystemPrompt ? settings.systemPrompt! : this.getSystemPrompt();

    console.log(`🔍 Deepinfra system prompt source:`, {
      hasCustom: hasCustomSystemPrompt,
      usingCustom: hasCustomSystemPrompt,
      promptLength: systemPrompt?.length || 0,
      promptStart: systemPrompt?.substring(0, 100) + '...'
    });

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Add current message (handle both string and array formats)
    if (typeof message === 'string') {
      messages.push({ role: 'user', content: message });
    } else if (Array.isArray(message)) {
      // Handle ContentItem array format (images, text)
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

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };

    // Add tools if available
    if (mcpTools.length > 0) {
      requestBody.tools = mcpTools;
      requestBody.tool_choice = 'auto';
      console.log(`🚀 Deepinfra API call with ${mcpTools.length} tools:`, {
        model: settings.model,
        toolCount: mcpTools.length,
        conversationId: conversationId || 'none'
      });
    } else {
      console.log(`🚀 Deepinfra API call without tools`);
    }

    console.log('🔍 Deepinfra request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal
    });

    console.log('🔍 Deepinfra response status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Deepinfra API error response:', error);

      if (response.status === 401) {
        throw new Error(`Deepinfra API authentication failed. Please check your API key in Settings. Error: ${error}`);
      }

      throw new Error(`Deepinfra API error: ${error}`);
    }

    if (onStream) {
      return OpenAICompatibleStreaming.handleStreamResponse(
        response,
        onStream,
        settings,
        provider,
        conversationHistory,
        'Deepinfra',
        this.executeToolsAndFollowUp.bind(this)
      );
    } else {
      return this.handleNonStreamResponse(response, settings, conversationHistory);
    }
  }

  private async handleNonStreamResponse(
    response: Response,
    settings: LLMSettings,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>
  ): Promise<LLMResponse> {
    const data = await response.json();
    console.log('🔍 Deepinfra non-stream response:', JSON.stringify(data, null, 2));

    const choice = data.choices?.[0];
    if (!choice) {
      throw new Error('No choices in Deepinfra response');
    }

    const message = choice.message;
    const content = message?.content || '';
    const toolCalls = message?.tool_calls || [];

    // Handle tool calls if present
    if (toolCalls.length > 0) {
      console.log(`🔧 Deepinfra response contains ${toolCalls.length} tool calls`);
      return this.executeToolsAndFollowUp(
        toolCalls,
        content,
        data.usage,
        settings,
        { baseUrl: 'https://api.deepinfra.com/v1/openai' } as LLMProvider,
        conversationHistory,
        () => {} // No-op function for non-streaming tool execution
      );
    }

    return {
      content,
      usage: {
        promptTokens: data.usage?.prompt_tokens || 0,
        completionTokens: data.usage?.completion_tokens || 0,
        totalTokens: data.usage?.total_tokens || 0
      }
    };
  }

  async fetchModels(apiKey: string): Promise<string[]> {
    if (!apiKey) {
      console.log('❌ No Deepinfra API key provided - cannot fetch models');
      throw new Error('Deepinfra API key is required to fetch models');
    }

    try {
      const response = await fetch('https://api.deepinfra.com/v1/openai/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Deepinfra API error: ${response.status}`, errorText);
        throw new Error(`Failed to fetch Deepinfra models: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const models = data.data?.map((model: { id: string }) => model.id)?.sort() || [];

      if (models.length === 0) {
        throw new Error('No Deepinfra models returned from API. This may indicate an API issue or insufficient permissions.');
      }

      console.log(`✅ Fetched ${models.length} Deepinfra models (sorted alphabetically)`);
      return models;
    } catch (error) {
      console.error('❌ Failed to fetch Deepinfra models:', error);
      throw error instanceof Error ? error : new Error(`Failed to fetch Deepinfra models: ${String(error)}`);
    }
  }

  formatTools(tools: ToolObject[]): unknown[] {
    // OpenAI format - array of tool objects with type: 'function'
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
    return DEEPINFRA_SYSTEM_PROMPT;
  }

  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string {
    if (tools.length === 0) {
      return basePrompt;
    }

    const toolDescriptions = tools.map(tool => {
      const name = tool.name || tool.function?.name || 'unknown';
      const description = tool.description || tool.function?.description || 'No description';
      return `- ${name}: ${description}`;
    }).join('\n');

    return `${basePrompt}

## Available Tools

You have access to the following tools:
${toolDescriptions}

Use these tools when they can help provide better, more accurate, or more current information to answer the user's questions.`;
  }

  // Private helper methods
  // These methods are injected by the ProviderAdapter from the LLMService
  private getMCPToolsForProvider!: (providerId: string, settings: LLMSettings) => Promise<unknown[]>;

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
      'Deepinfra',
      this.executeMCPTool.bind(this),
      {}, // No additional headers needed
      () => this.getMCPToolsForProvider('deepinfra', settings),
      (tools: unknown[]) => this.enhanceSystemPromptWithTools(this.getSystemPrompt(), tools as ToolObject[])
    );
  }
}
