// OpenAI provider implementation

import { BaseProvider } from './BaseProvider';
import {
  LLMSettings,
  LLMResponse,
  MessageContent,
  ContentItem,
  LLMProvider,
  ToolObject,
  ProviderCapabilities,
  ToolCallArguments
} from './types';
import { FALLBACK_MODELS } from './constants';
import { OPENAI_SYSTEM_PROMPT, generateOpenAIToolPrompt } from './prompts/openai';

export class OpenAIProvider extends BaseProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
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
    const messages = [];

    // Get MCP tools for this provider first
    const mcpTools = await this.getMCPToolsForProvider('openai', settings);

    // Build enhanced system prompt with tool instructions
    let systemPrompt = settings.systemPrompt || this.getSystemPrompt();
    if (mcpTools.length > 0) {
      systemPrompt = this.enhanceSystemPromptWithTools(systemPrompt, mcpTools as ToolObject[]);
    }

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Add current message (handle both string and array formats)
    messages.push({ role: 'user', content: message });

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: onStream && typeof onStream === 'function'
    };

    // Add tools if available and should be sent
    const shouldSendTools = await this.shouldSendTools(conversationId, mcpTools as ToolObject[]);
    if (mcpTools.length > 0 && shouldSendTools) {
      requestBody.tools = mcpTools;
      requestBody.tool_choice = 'auto';
      console.log(`🚀 OpenAI API call with ${mcpTools.length} tools:`, {
        model: settings.model,
        toolCount: mcpTools.length,
        conversationId: conversationId || 'none'
      });
    } else {
      console.log(`🚀 OpenAI API call without tools (${mcpTools.length} available, shouldSend: ${shouldSendTools})`);
    }

    console.log(`🔍 OpenAI request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal
    });

    console.log(`🔍 OpenAI response status:`, response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    if (onStream && typeof onStream === 'function') {
      return this.handleStreamResponse(response, onStream, settings, provider, conversationHistory, conversationId);
    } else {
      return this.handleNonStreamResponse(response, settings, conversationHistory, conversationId);
    }
  }

  async fetchModels(apiKey: string): Promise<string[]> {
    if (!apiKey) {
      console.log('No OpenAI API key provided, using fallback models');
      return FALLBACK_MODELS.openai;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`OpenAI API error: ${response.status}, using fallback models`);
        return FALLBACK_MODELS.openai;
      }

      const data = await response.json() as { data: Array<{ id: string }> };
      const models = data.data
        .filter((model) => model.id.includes('gpt'))
        .map((model) => model.id)
        .sort();

      return models.length > 0 ? models : FALLBACK_MODELS.openai;
    } catch (error) {
      console.warn('Failed to fetch OpenAI models, using fallback:', error);
      return FALLBACK_MODELS.openai;
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
    return OPENAI_SYSTEM_PROMPT;
  }

  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string {
    if (tools.length === 0) {
      return basePrompt;
    }

    const toolInstructions = generateOpenAIToolPrompt(tools);
    return basePrompt + toolInstructions;
  }

  validateToolCall(toolCall: { id?: string; name: string; arguments: Record<string, unknown> }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!toolCall.id) {
      errors.push(`OpenAI tool call missing required id: ${toolCall.name}`);
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
      errors.push('OpenAI tools must have type: "function"');
    }

    if (!toolObj.function || typeof toolObj.function !== 'object') {
      errors.push('OpenAI tools must have function object');
    } else {
      const func = toolObj.function as Record<string, unknown>;
      if (!func.name) {
        errors.push('OpenAI tools must have function.name');
      }
      if (func.name && typeof func.name === 'string' && func.name.length > 64) {
        errors.push('OpenAI function names must be ≤64 characters');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Private helper methods
  private async getMCPToolsForProvider(providerId: string, settings: LLMSettings): Promise<unknown[]> {
    // This will be injected by the main service
    // For now, return empty array - will be implemented in main service integration
    return [];
  }

  private async shouldSendTools(conversationId: string | undefined, tools: ToolObject[]): Promise<boolean> {
    // This will be injected by the main service
    // For now, return true if tools are available
    return tools.length > 0;
  }

  private async executeMCPTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    // This will be injected by the main service
    return JSON.stringify({ error: 'Tool execution not available' });
  }

  private async handleStreamResponse(
    response: Response,
    onStream: (chunk: string) => void,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    conversationId?: string
  ): Promise<LLMResponse> {
    console.log(`🔍 Starting OpenAI stream response handling...`);
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let fullContent = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined = undefined;
    let chunkCount = 0;
    const toolCalls: Array<{ id?: string; type?: string; function?: { name?: string; arguments?: string } }> = [];
    const decoder = new TextDecoder();

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        chunkCount++;
        if (chunkCount <= 3) {
          console.log(`🔍 OpenAI stream chunk ${chunkCount}:`, chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''));
        }
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (chunkCount <= 5) {
                console.log(`🔍 OpenAI parsed chunk ${chunkCount}:`, JSON.stringify(parsed, null, 2));
              }

              const choice = parsed.choices?.[0];
              const delta = choice?.delta;
              const content = delta?.content || '';

              if (content) {
                fullContent += content;
                onStream(content);
                console.log(`📝 OpenAI content chunk: "${content}"`);
              }

              // Check for tool calls and assemble them
              if (delta?.tool_calls) {
                console.log(`🔧 OpenAI tool calls detected:`, delta.tool_calls);

                for (const toolCall of delta.tool_calls) {
                  const index = toolCall.index;

                  // Initialize tool call if not exists
                  if (!toolCalls[index]) {
                    toolCalls[index] = {
                      id: toolCall.id || '',
                      type: toolCall.type || 'function',
                      function: {
                        name: toolCall.function?.name || '',
                        arguments: ''
                      }
                    };
                  }

                  // Append arguments
                  if (toolCall.function?.arguments && toolCalls[index].function) {
                    toolCalls[index].function!.arguments += toolCall.function.arguments;
                  }

                  // Set name if provided
                  if (toolCall.function?.name && toolCalls[index].function) {
                    toolCalls[index].function!.name = toolCall.function.name;
                  }

                  // Set id if provided
                  if (toolCall.id) {
                    toolCalls[index].id = toolCall.id;
                  }
                }
              }

              // Capture usage data if available
              if (parsed.usage) {
                usage = parsed.usage;
              }
            } catch (error) {
              console.error(`❌ OpenAI error parsing chunk:`, error, `Data: ${data.substring(0, 100)}...`);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Filter out empty tool calls and log final state
    const validToolCalls = toolCalls.filter(tc => tc && tc.function?.name);

    console.log('🔍 OpenAI stream response completed:', {
      contentLength: fullContent.length,
      hasUsage: !!usage,
      usage: usage,
      toolCallsCount: validToolCalls.length
    });

    if (validToolCalls.length > 0) {
      console.log(`🔧 OpenAI assembled ${validToolCalls.length} tool calls:`, validToolCalls.map(tc => ({
        name: tc.function?.name,
        arguments: tc.function?.arguments
      })));

      // Execute tools and make follow-up call
      return this.executeToolsAndFollowUp(validToolCalls, fullContent, usage, settings, provider, conversationHistory, onStream, conversationId);
    }

    return {
      content: fullContent,
      usage: usage ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      } : undefined,
      toolCalls: validToolCalls
        .filter(tc => tc.id && tc.function?.name) // Only include tool calls with valid id and name
        .map(tc => ({
          id: tc.id!,
          name: tc.function!.name!,
          arguments: JSON.parse(tc.function!.arguments || '{}')
        }))
    };
  }

  private async executeToolsAndFollowUp(
    toolCalls: Array<{ id?: string; type?: string; function?: { name?: string; arguments?: string } }>,
    initialContent: string,
    initialUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void,
    conversationId?: string
  ): Promise<LLMResponse> {
    console.log(`🔧 OpenAI streaming detected ${toolCalls.length} tool calls, executing...`);

    // Execute all tool calls
    const toolResults = [];
    for (const toolCall of toolCalls) {
      try {
        console.log(`🔧 Executing OpenAI tool call: ${toolCall.function?.name}`);
        const toolName = toolCall.function?.name || '';
        const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
        const toolResult = await this.executeMCPTool(toolName, toolArgs);
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
      } catch (error) {
        console.error(`❌ OpenAI tool execution failed:`, error);
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
        });
      }
    }

    // Make follow-up call with tool results
    const userMessages = conversationHistory.filter(msg => msg.role !== 'system');

    // Convert tool calls to OpenAI format for follow-up
    const openaiToolCalls = toolCalls.map(tc => ({
      id: tc.id || '',
      type: 'function',
      function: {
        name: tc.function?.name || '',
        arguments: tc.function?.arguments || '{}'
      }
    }));

    const followUpMessages = [
      { role: 'system', content: 'Based on the tool results provided, give a helpful and natural response to the user\'s question.' },
      ...userMessages,
      { role: 'assistant', content: initialContent, tool_calls: openaiToolCalls },
      ...toolResults
    ];

    console.log(`🔄 Making OpenAI follow-up call to process tool results...`);

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
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(followUpRequestBody)
    });

    if (followUpResponse.ok) {
      const followUpData = await followUpResponse.json();
      const followUpMessage = followUpData.choices[0]?.message;

      // Combine responses
      const combinedUsage = {
        promptTokens: (initialUsage?.prompt_tokens || 0) + (followUpData.usage?.prompt_tokens || 0),
        completionTokens: (initialUsage?.completion_tokens || 0) + (followUpData.usage?.completion_tokens || 0),
        totalTokens: (initialUsage?.total_tokens || 0) + (followUpData.usage?.total_tokens || 0)
      };

      // Stream the follow-up content
      if (followUpMessage?.content) {
        onStream(followUpMessage.content);
      }

      return {
        content: followUpMessage?.content || 'Tool execution completed.',
        usage: combinedUsage,
        toolCalls: toolCalls
          .filter(tc => tc.id && tc.function?.name)
          .map(tc => ({
            id: tc.id!,
            name: tc.function!.name!,
            arguments: JSON.parse(tc.function!.arguments || '{}')
          }))
      };
    } else {
      const errorText = await followUpResponse.text();
      console.error(`❌ OpenAI follow-up call failed (${followUpResponse.status}):`, errorText);

      // Return original response with tool calls
      return {
        content: initialContent,
        usage: initialUsage ? {
          promptTokens: initialUsage.prompt_tokens || 0,
          completionTokens: initialUsage.completion_tokens || 0,
          totalTokens: initialUsage.total_tokens || 0
        } : undefined,
        toolCalls: toolCalls
          .filter(tc => tc.id && tc.function?.name)
          .map(tc => ({
            id: tc.id!,
            name: tc.function!.name!,
            arguments: JSON.parse(tc.function!.arguments || '{}')
          }))
      };
    }
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

    // Handle tool calls if present
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`🔧 OpenAI response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);
      let content = message.content || '';

      // Tool execution will be handled by the main service
      // For now, just return the content with tool calls
      return {
        content,
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
