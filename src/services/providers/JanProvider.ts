// Jan AI provider implementation

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

import { JAN_SYSTEM_PROMPT } from './prompts/jan';
import { OpenAICompatibleStreaming } from './shared/OpenAICompatibleStreaming';

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
export class JanProvider extends BaseProvider {
  readonly id = 'jan';
  readonly name = 'Jan AI';
  readonly capabilities: ProviderCapabilities = {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsPromptCaching: false,
    maxToolNameLength: 64,
    toolFormat: 'openai'
  };

  // This method is injected by the ProviderAdapter from the LLMService
  private getMCPToolsForProvider!: (providerId: string, settings: LLMSettings) => Promise<unknown[]>;

  async sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
    // Jan AI uses OpenAI-compatible API - get base URL from settings or provider default
    // Jan AI documentation shows 127.0.0.1:1337 as the default host
    let baseUrl = settings.baseUrl || provider.baseUrl || 'http://127.0.0.1:1337/v1';

    // Handle base URL - ensure it's properly formatted
    if (baseUrl && baseUrl.trim()) {
      baseUrl = baseUrl.trim();
      // Ensure the base URL ends with /v1 for Jan AI API
      if (!baseUrl.endsWith('/v1')) {
        baseUrl = baseUrl.replace(/\/$/, '') + '/v1';
      }
    } else {
      baseUrl = 'http://localhost:1337/v1';
    }

    try {
      // Jan AI uses OpenAI-compatible API at /chat/completions
      const endpoint = `${baseUrl}/chat/completions`;
      safeDebugLog('info', 'JANPROVIDER', `🔍 Jan AI: Using API URL: ${endpoint}`);

      // Get tools if tool calling is enabled
      const tools = settings.toolCallingEnabled ? await this.getJanTools(settings) : [];
      safeDebugLog('info', 'JANPROVIDER', `🔧 Jan AI: ${tools.length} tools available for model ${settings.model}`);

      // Build messages array
      const messages = this.buildMessagesArray(message, conversationHistory, settings);

      const requestBody = {
        model: settings.model,
        messages,
        stream: !!onStream,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        ...(tools.length > 0 && { tools })
      };

      safeDebugLog('info', 'JANPROVIDER', `📤 Jan AI: Sending request to ${endpoint}`, {
        model: settings.model,
        messageCount: messages.length,
        toolCount: tools.length,
        streaming: !!onStream
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey || 'jan-api-key'}`
        },
        body: JSON.stringify(requestBody),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        safeDebugLog('error', 'JANPROVIDER', `❌ Jan AI API error: ${response.status}`, errorText);
        throw new Error(`Jan AI API error: ${response.status} - ${errorText}`);
      }

      if (onStream) {
        return this.handleStreamResponse(response, onStream, settings, provider, conversationHistory);
      } else {
        return this.handleNonStreamResponse(response, settings, provider, conversationHistory);
      }
    } catch (error) {
      safeDebugLog('error', 'JANPROVIDER', '❌ Jan AI request failed:', error);
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }
      throw new Error(`Jan AI request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getJanTools(settings: LLMSettings): Promise<unknown[]> {
    try {
      safeDebugLog('info', 'JANPROVIDER', `🔧 Jan AI: Getting tools for provider 'jan'`);

      // Get raw tools from the centralized service
      const rawTools = await this.getMCPToolsForProvider('jan', settings);
      safeDebugLog('info', 'JANPROVIDER', `📋 Raw tools received (${rawTools.length} tools):`, (rawTools as Array<{name?: string, function?: {name?: string}}>).map(t => t.name || t.function?.name));

      // Format tools for Jan AI (uses OpenAI format)
      const formattedTools = this.formatToolsForJan(rawTools);
      safeDebugLog('info', 'JANPROVIDER', `🔧 Formatted ${formattedTools.length} tools for Jan AI`);

      return formattedTools;
    } catch (error) {
      safeDebugLog('error', 'JANPROVIDER', '❌ Failed to get Jan AI tools:', error);
      return [];
    }
  }

  private formatToolsForJan(tools: unknown[]): unknown[] {
    return tools.map(tool => {
      const toolObj = tool as ToolObject;
      return {
        type: 'function',
        function: {
          name: toolObj.name || toolObj.function?.name,
          description: toolObj.description || toolObj.function?.description,
          parameters: toolObj.parameters || toolObj.function?.parameters || {
            type: 'object',
            properties: {},
            required: []
          }
        }
      };
    });
  }

  private buildMessagesArray(
    message: MessageContent,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    settings: LLMSettings
  ) {
    const messages: Array<{role: string, content: string | Array<ContentItem>}> = [];

    // Add system message if provided
    if (settings.systemPrompt) {
      messages.push({
        role: 'system',
        content: settings.systemPrompt
      });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Add current message
    if (typeof message === 'string') {
      messages.push({ role: 'user', content: message });
    } else if (Array.isArray(message)) {
      messages.push({ role: 'user', content: message });
    } else {
      // Handle vision format (same as LMStudioProvider)
      const messageWithImages = message as { text: string; images: string[] };
      const content: ContentItem[] = [{ type: 'text', text: messageWithImages.text }];

      safeDebugLog('info', 'JANPROVIDER', `🖼️ Jan AI: Processing ${messageWithImages.images.length} images`);

      for (const imageUrl of messageWithImages.images) {
        // Extract base64 data if it's a data URL, otherwise assume it's raw base64
        let base64Data = imageUrl;
        if (imageUrl.startsWith('data:image/')) {
          base64Data = imageUrl.split(',')[1];
        } else if (imageUrl.includes(',')) {
          base64Data = imageUrl.split(',')[1];
        }

        // Use OpenAI-compatible format
        const formattedImageUrl = `data:image/jpeg;base64,${base64Data}`;

        content.push({
          type: 'image_url',
          image_url: { url: formattedImageUrl }
        });
      }

      messages.push({ role: 'user', content });
      safeDebugLog('info', 'JANPROVIDER', `🖼️ Jan AI: Created message with ${content.length} content items`);
    }

    return messages;
  }

  async fetchModels(apiKey: string, baseUrl?: string): Promise<string[]> {
    // Handle base URL - try multiple common Jan AI configurations
    let janBaseUrl = baseUrl && baseUrl.trim() ? baseUrl.trim() : 'http://127.0.0.1:1337/v1';

    // Ensure the base URL ends with /v1 for Jan AI API
    if (!janBaseUrl.endsWith('/v1')) {
      janBaseUrl = janBaseUrl.replace(/\/$/, '') + '/v1';
    }

    safeDebugLog('info', 'JANPROVIDER', `🔍 Jan AI: Using base URL: ${janBaseUrl}`);
    safeDebugLog('info', 'JANPROVIDER', `🔍 Jan AI: Using API key: ${apiKey ? `${apiKey.substring(0, 8)}...` : 'none'}`);

    // Validate API key
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Jan AI requires an API key. Please set an API key in Jan AI settings and configure it in LittleLLM settings.');
    }

    // Try multiple host configurations if no custom base URL is provided
    const hostsToTry = baseUrl ? [janBaseUrl] : [
      'http://127.0.0.1:1337/v1',
      'http://localhost:1337/v1',
      'http://0.0.0.0:1337/v1'
    ];

    let lastError: Error | null = null;

    for (const hostUrl of hostsToTry) {
      try {
        safeDebugLog('info', 'JANPROVIDER', `🔍 Jan AI: Trying host: ${hostUrl}`);

        // Jan AI models endpoint (OpenAI-compatible: GET /v1/models)
        const response = await fetch(`${hostUrl}/models`, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.trim()}`
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          safeDebugLog('error', 'JANPROVIDER', `❌ Jan AI API error at ${hostUrl}: ${response.status}`, errorText);

          if (response.status === 404) {
            lastError = new Error(`Jan AI API not found at ${hostUrl}. Please check:\n1. Jan AI is installed and running\n2. Local API Server is started in Jan AI settings\n3. Server is running on the correct port (default: 1337)\n4. API prefix is set to /v1 in Jan AI settings`);
          } else if (response.status === 401) {
            lastError = new Error(`Jan AI API authentication failed. Please check:\n1. API key is set in Jan AI settings\n2. API key is correctly configured in LittleLLM settings\n3. API key matches the one set in Jan AI`);
          } else {
            lastError = new Error(`Failed to connect to Jan AI at ${hostUrl}. Status: ${response.status} - ${errorText}. Make sure Jan AI is running and the API server is started.`);
          }

          // If this is not the last host to try, continue to next host
          if (hostUrl !== hostsToTry[hostsToTry.length - 1]) {
            continue;
          } else {
            throw lastError;
          }
        }

        // Success! Parse the response
        const data = await response.json();
        safeDebugLog('info', 'JANPROVIDER', `✅ Jan AI: Successfully connected to ${hostUrl}`);
        safeDebugLog('info', 'JANPROVIDER', '🔍 Jan AI models response:', data);

        if (!data.data || !Array.isArray(data.data)) {
          safeDebugLog('warn', 'JANPROVIDER', '⚠️ Jan AI: Unexpected response format:', data);
          return [];
        }

        const models = data.data.map((model: any) => model.id || model.name).filter(Boolean);
        safeDebugLog('info', 'JANPROVIDER', `✅ Jan AI: Found ${models.length} models:`, models);
        return models;

      } catch (error) {
        safeDebugLog('error', 'JANPROVIDER', `❌ Jan AI: Error connecting to ${hostUrl}:`, error);
        lastError = error as Error;

        // If this is not the last host to try, continue to next host
        if (hostUrl !== hostsToTry[hostsToTry.length - 1]) {
          continue;
        }
      }
    }

    // If we get here, all hosts failed
    safeDebugLog('error', 'JANPROVIDER', `❌ Failed to connect to Jan AI on any host:`, hostsToTry);
    throw lastError || new Error(`Failed to connect to Jan AI. Tried hosts: ${hostsToTry.join(', ')}`);
  }

  formatTools(tools: ToolObject[]): unknown[] {
    // Jan AI uses OpenAI-compatible format
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
    return JAN_SYSTEM_PROMPT;
  }

  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string {
    if (tools.length === 0) return basePrompt;

    const toolDescriptions = tools.map(tool => {
      const name = tool.name || tool.function?.name || 'unknown';
      const description = tool.description || tool.function?.description || 'No description available';
      return `- ${name}: ${description}`;
    }).join('\n');

    return `${basePrompt}

You have access to the following tools:
${toolDescriptions}

Use these tools when appropriate to help answer the user's questions or complete tasks.`;
  }

  // Private helper methods

  private async handleStreamResponse(
    response: Response,
    onStream: (chunk: string) => void,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>
  ): Promise<LLMResponse> {
    // Use OpenAI-compatible streaming with tool calling support
    return OpenAICompatibleStreaming.handleStreamResponse(
      response,
      onStream,
      settings,
      provider,
      conversationHistory,
      'Jan AI',
      this.executeToolsAndFollowUp.bind(this)
    );
  }

  private async handleNonStreamResponse(
    response: Response,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>
  ): Promise<LLMResponse> {
    const data = await response.json();
    const message = data.choices?.[0]?.message;

    if (!message) {
      throw new Error('Invalid response format from Jan AI');
    }

    // Handle tool calls if present
    if (message.tool_calls && message.tool_calls.length > 0) {
      safeDebugLog('info', 'JANPROVIDER', `🔧 Jan AI: Processing ${message.tool_calls.length} tool calls`);
      return this.executeToolsAndFollowUp(
        message.tool_calls,
        message.content || '',
        data.usage,
        settings,
        provider,
        conversationHistory,
        () => {} // No-op for non-stream
      );
    }

    return {
      content: message.content || '',
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined,
      toolCalls: []
    };
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
      'Jan AI',
      this.executeMCPTool.bind(this),
      {},
      () => this.getMCPToolsForProvider(provider.id, settings)
    );
  }

  private async executeMCPTool(_toolName: string, _args: Record<string, unknown>): Promise<string> {
    // This will be injected by the ProviderAdapter
    throw new Error('MCP tool execution not available - method not injected');
  }
}
