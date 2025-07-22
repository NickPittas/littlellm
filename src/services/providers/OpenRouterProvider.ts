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
// import { RAGService } from '../RAGService'; // Moved to Electron main process, accessed via IPC

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

  // OpenRouter-specific tool calling methods
  private async getOpenRouterTools(settings: LLMSettings): Promise<unknown[]> {
    try {
      console.log(`🔍 Getting tools for OpenRouter provider`);
      console.log(`🔍 Tool calling enabled:`, settings?.toolCallingEnabled !== false);

      // Check if tool calling is disabled
      if (settings?.toolCallingEnabled === false) {
        console.log(`🚫 Tool calling is disabled, returning empty tools array`);
        return [];
      }

      // Get raw tools from the centralized service (temporarily)
      const rawTools = await this.getMCPToolsForProvider('openrouter', settings);
      console.log(`📋 Raw tools received (${rawTools.length} tools):`, rawTools.map((t: unknown) => (t as {name?: string, function?: {name?: string}}).name || (t as {name?: string, function?: {name?: string}}).function?.name));

      // Format tools specifically for OpenRouter (uses OpenAI format)
      const formattedTools = this.formatToolsForOpenRouter(rawTools);
      console.log(`🔧 Formatted ${formattedTools.length} tools for OpenRouter`);

      return formattedTools;
    } catch (error) {
      console.error('❌ Failed to get OpenRouter tools:', error);
      return [];
    }
  }

  private formatToolsForOpenRouter(rawTools: unknown[]): unknown[] {
    return rawTools.map(tool => {
      const typedTool = tool as {type?: string, function?: {name?: string, description?: string, parameters?: unknown}, name?: string, description?: string, inputSchema?: unknown};

      // All tools now come in unified format with type: 'function' and function object
      if (typedTool.type === 'function' && typedTool.function) {
        return {
          type: 'function',
          function: {
            name: typedTool.function.name || 'unknown_tool',
            description: typedTool.function.description || 'No description',
            parameters: typedTool.function.parameters || {
              type: 'object',
              properties: {},
              required: []
            }
          }
        };
      }

      // Handle MCP tools (need conversion to OpenAI format)
      if (typedTool.name && typedTool.description) {
        return {
          type: 'function',
          function: {
            name: typedTool.name,
            description: typedTool.description,
            parameters: typedTool.inputSchema || {
              type: 'object',
              properties: {},
              required: []
            }
          }
        };
      }

      console.warn(`⚠️ Skipping invalid tool:`, tool);
      return null;
    }).filter(tool => tool !== null);
  }

  private detectUnderlyingProvider(model: string): string {
    // Detect underlying provider from OpenRouter model name
    if (model.startsWith('openai/')) return 'openai';
    if (model.startsWith('anthropic/')) return 'anthropic';
    if (model.startsWith('google/')) return 'google';
    if (model.startsWith('meta-llama/')) return 'meta';
    if (model.startsWith('mistral/') || model.startsWith('mistralai/')) return 'mistral';
    if (model.startsWith('cohere/')) return 'cohere';
    if (model.startsWith('perplexity/')) return 'perplexity';

    // Default to OpenAI format for unknown models (safest)
    console.log(`⚠️ Unknown OpenRouter model prefix for "${model}", defaulting to OpenAI format`);
    return 'openai';
  }

  private modelSupportsStructuredTools(underlyingProvider: string): boolean {
    // Check if underlying provider supports structured tool calling
    switch (underlyingProvider) {
      case 'openai':
      case 'anthropic':
      case 'google':
      case 'mistral':
        return true;
      case 'meta':
      case 'cohere':
      case 'perplexity':
      default:
        return false; // Use text-based tool descriptions
    }
  }

  private async buildProviderSpecificRequest(
    underlyingProvider: string,
    settings: LLMSettings,
    systemPrompt: string,
    tools: unknown[],
    message: MessageContent,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream?: (chunk: string) => void
  ): Promise<{ requestBody: Record<string, unknown>; messages: unknown[] }> {

    const supportsStructuredTools = this.modelSupportsStructuredTools(underlyingProvider);
    console.log(`🔧 OpenRouter underlying provider "${underlyingProvider}" supports structured tools: ${supportsStructuredTools}`);

    // Build messages based on provider format
    let messages: unknown[];
    let requestBody: Record<string, unknown>;

    if (underlyingProvider === 'anthropic') {
      // Anthropic format: system parameter + messages without system role
      messages = await this.constructMessagesWithFiles(message, conversationHistory, ''); // No system in messages
      requestBody = {
        model: settings.model,
        system: systemPrompt, // Separate system parameter
        messages,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        stream: !!onStream
      };
    } else {
      // OpenAI format (default): system message first in messages array
      messages = await this.constructMessagesWithFiles(message, conversationHistory, systemPrompt);
      requestBody = {
        model: settings.model,
        messages,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        stream: !!onStream
      };
    }

    // Add tools based on provider capabilities
    if (supportsStructuredTools && tools.length > 0) {
      requestBody.tools = tools;
      requestBody.tool_choice = 'auto';
      console.log(`🚀 OpenRouter API call with ${tools.length} structured tools for ${underlyingProvider} model`);
    } else if (tools.length > 0) {
      // For models without structured tools, include tool descriptions in system prompt
      const toolDescriptions = this.formatToolsAsText(tools as ToolObject[]);
      if (underlyingProvider === 'anthropic') {
        requestBody.system = `${systemPrompt}\n\nAvailable tools:\n${toolDescriptions}`;
      } else {
        // Update system message in messages array
        const systemMessageIndex = (messages as Array<{role: string, content: string}>).findIndex(m => m.role === 'system');
        if (systemMessageIndex >= 0) {
          (messages as Array<{role: string, content: string}>)[systemMessageIndex].content = `${systemPrompt}\n\nAvailable tools:\n${toolDescriptions}`;
        }
      }
      console.log(`🚀 OpenRouter API call with ${tools.length} text-based tools for ${underlyingProvider} model (no structured tool support)`);
    } else {
      console.log(`🚀 OpenRouter API call without tools for ${underlyingProvider} model`);
    }

    return { requestBody, messages };
  }

  private formatToolsAsText(tools: ToolObject[]): string {
    return tools.map(tool => {
      const name = tool.name || tool.function?.name || 'unknown_tool';
      const description = tool.description || tool.function?.description || 'No description';
      const parameters = tool.parameters || tool.function?.parameters || {};

      return `- ${name}: ${description}\n  Parameters: ${JSON.stringify(parameters, null, 2)}`;
    }).join('\n\n');
  }

  async sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
    // Detect underlying provider from model name
    const underlyingProvider = this.detectUnderlyingProvider(settings.model);
    console.log(`🔍 OpenRouter model "${settings.model}" detected as underlying provider: ${underlyingProvider}`);

    // Get OpenRouter-specific formatted tools
    const openRouterTools = await this.getOpenRouterTools(settings);

    // Use behavioral system prompt only (no tool descriptions)
    // Check for meaningful system prompt, not just empty string or generic default
    const hasCustomSystemPrompt = settings.systemPrompt &&
      settings.systemPrompt.trim() &&
      settings.systemPrompt !== "You are a helpful AI assistant. Please provide concise and helpful responses.";

    const systemPrompt = hasCustomSystemPrompt ? settings.systemPrompt! : this.getSystemPrompt();

    console.log(`🔍 OpenRouter system prompt source:`, {
      hasCustom: hasCustomSystemPrompt,
      usingCustom: hasCustomSystemPrompt,
      promptLength: systemPrompt?.length || 0,
      promptStart: systemPrompt?.substring(0, 100) + '...',
      underlyingProvider
    });

    // Build request based on underlying provider format
    const { requestBody } = await this.buildProviderSpecificRequest(
      underlyingProvider,
      settings,
      systemPrompt,
      openRouterTools,
      message,
      conversationHistory,
      onStream
    );




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
    } catch {
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

    if (toolCall.name && typeof this.capabilities.maxToolNameLength === 'number' && toolCall.name.length > this.capabilities.maxToolNameLength) {
      errors.push(`Tool name must be ≤${this.capabilities.maxToolNameLength} characters`);
    }

    return { valid: errors.length === 0, errors };
  }

  private async constructMessagesWithFiles(
    message: MessageContent,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    systemPrompt: string
  ): Promise<Array<{role: string, content: string | Array<ContentItem>}>> {
    const messages: Array<{role: string, content: string | Array<ContentItem>}> = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push(...conversationHistory);

    if (typeof message === 'string') {
      messages.push({ role: 'user', content: message }); // RAG integration now handled in chatService
    } else if (Array.isArray(message)) {
      const userContent: Array<ContentItem> = [];
      for (const item of message) {
        if (item.type === 'file' && item.fileContent) {
          const fileExtension = item.fileName?.split('.').pop()?.toLowerCase() || '';
          let mimeType = 'application/octet-stream';
          if (fileExtension) {
            switch (fileExtension) {
              case 'pdf':
                mimeType = 'application/pdf';
                break;
              case 'doc':
              case 'docx':
                mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                break;
              case 'csv':
                mimeType = 'text/csv';
                break;
              case 'md':
                mimeType = 'text/markdown';
                break;
              case 'txt':
                mimeType = 'text/plain';
                break;
            }
          }
          userContent.push({
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${item.fileContent}`
            }
          });
        } else {
          userContent.push(item);
        }
      }
      messages.push({ role: 'user', content: userContent });
    }

    return messages;
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
  // These methods are injected by the ProviderAdapter from the LLMService
  private getMCPToolsForProvider!: (providerId: string, settings: LLMSettings) => Promise<unknown[]>;
  private executeMCPTool!: (toolName: string, args: Record<string, unknown>) => Promise<string>;

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

  /* eslint-disable @typescript-eslint/no-unused-vars */
  private async handleNonStreamResponse(
    response: Response,
    settings: LLMSettings,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    conversationId?: string
  ): Promise<LLMResponse> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    console.log('🔍 OpenRouter non-stream response:', {
      hasToolCalls: !!(message.tool_calls && message.tool_calls.length > 0),
      toolCallsCount: message.tool_calls?.length || 0,
      content: message.content,
      usage: data.usage
    });

    // Handle tool calls if present (OpenAI format) - execute immediately like Anthropic
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`🔧 OpenRouter response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);

      // Check if we have the parallel execution method injected
      if ((this as unknown as {executeMultipleToolsParallel?: unknown, summarizeToolResultsForModel?: unknown}).executeMultipleToolsParallel && (this as unknown as {executeMultipleToolsParallel?: unknown, summarizeToolResultsForModel?: unknown}).summarizeToolResultsForModel) {
        console.log(`🚀 Executing ${message.tool_calls.length} OpenRouter tools immediately`);

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
          const parallelResults = await (executeMultipleToolsParallel as (calls: unknown[], provider: string) => Promise<Array<{success: boolean}>>)(toolCallsForExecution, 'openrouter');
          console.log(`✅ OpenRouter tool execution completed: ${parallelResults.filter(r => r.success).length}/${parallelResults.length} successful`);

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
          console.error(`❌ OpenRouter tool execution failed:`, error);
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
        console.warn(`⚠️ OpenRouter provider missing tool execution methods - falling back to external handling`);
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
