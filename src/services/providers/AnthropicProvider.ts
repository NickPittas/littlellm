// Anthropic provider implementation

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
import { FALLBACK_MODELS } from './constants';
import { ToolNameUtils } from './utils';
import { ANTHROPIC_SYSTEM_PROMPT } from './prompts/anthropic';
import { debugLogger } from '../debugLogger';

export class AnthropicProvider extends BaseProvider {
  readonly id = 'anthropic';
  readonly name = 'Anthropic';
  readonly capabilities: ProviderCapabilities = {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: 64,
    toolFormat: 'anthropic'
  };

  // Injected methods from main service
  private _executeMultipleToolsParallel?: (
    toolCalls: Array<{ id?: string; name: string; arguments: Record<string, unknown> }>,
    provider?: string
  ) => Promise<Array<{ id?: string; name: string; result: string; success: boolean; executionTime: number }>>;

  private _summarizeToolResultsForModel?: (
    results: Array<{ id?: string; name: string; result: string; success: boolean; executionTime: number }>
  ) => string;

  // Injected tool executor method
  public executeMCPTool?: (toolName: string, args: Record<string, unknown>) => Promise<string>;

  private _aggregateToolResults?: (
    results: Array<{ id?: string; name: string; result: string; success: boolean; executionTime: number }>
  ) => string;

  private _formatToolResult?: (toolName: string, result: unknown) => string;

  private _getMCPToolsForProvider?: (providerId: string, settings: LLMSettings) => Promise<unknown[]>;

  // Anthropic-specific tool calling methods
  private async getAnthropicTools(settings: LLMSettings): Promise<unknown[]> {
    try {
      console.log(`🔍 Getting tools for Anthropic provider`);
      console.log(`🔍 Tool calling enabled:`, settings?.toolCallingEnabled !== false);

      // Check if tool calling is disabled
      if (settings?.toolCallingEnabled === false) {
        console.log(`🚫 Tool calling is disabled, returning empty tools array`);
        return [];
      }

      // Get raw tools from the centralized service
      const rawTools = await this._getMCPToolsForProvider!('anthropic', settings);
      console.log(`📋 Raw tools received (${rawTools.length} tools):`, (rawTools as Array<{ function?: { name?: string } }>).map(t => t.function?.name));

      // Format tools specifically for Anthropic
      const formattedTools = this.formatToolsForAnthropic(rawTools as Array<{ type?: string; function?: { name?: string; description?: string; parameters?: unknown } }>);
      console.log(`🔧 Formatted ${formattedTools.length} tools for Anthropic`);

      return formattedTools;
    } catch (error) {
      console.error('❌ Failed to get Anthropic tools:', error);
      return [];
    }
  }

  private formatToolsForAnthropic(rawTools: Array<{ type?: string; function?: { name?: string; description?: string; parameters?: unknown } }>): unknown[] {
    return rawTools.map(tool => {
      // All tools now come in unified format with type: 'function' and function object
      if (tool.type === 'function' && tool.function) {
        // Convert to Anthropic's custom tool format
        return {
          type: 'custom',
          name: tool.function.name || 'unknown_tool',
          description: tool.function.description || 'No description',
          input_schema: tool.function.parameters || {
            type: 'object',
            properties: {},
            required: []
          }
        };
      }
      
      console.warn(`⚠️ Skipping invalid tool (not in unified format):`, tool);
      return null;
    }).filter(tool => tool !== null);
  }

  // Method to inject dependencies from main service
  injectDependencies(dependencies: {
    executeMultipleToolsParallel?: (
      toolCalls: Array<{ id?: string; name: string; arguments: Record<string, unknown> }>,
      provider?: string
    ) => Promise<Array<{ id?: string; name: string; result: string; success: boolean; executionTime: number }>>;
    summarizeToolResultsForModel?: (
      results: Array<{ id?: string; name: string; result: string; success: boolean; executionTime: number }>
    ) => string;
    aggregateToolResults?: (
      results: Array<{ id?: string; name: string; result: string; success: boolean; executionTime: number }>
    ) => string;
    formatToolResult?: (toolName: string, result: unknown) => string;
    getMCPToolsForProvider?: (providerId: string, settings: LLMSettings) => Promise<unknown[]>;
  }) {
    this._executeMultipleToolsParallel = dependencies.executeMultipleToolsParallel;
    this._summarizeToolResultsForModel = dependencies.summarizeToolResultsForModel;
    this._aggregateToolResults = dependencies.aggregateToolResults;
    this._formatToolResult = dependencies.formatToolResult;
    this._getMCPToolsForProvider = dependencies.getMCPToolsForProvider;
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
    // Debug API key details
    console.log('🔍 Anthropic API key debug:', {
      hasApiKey: !!settings.apiKey,
      keyLength: settings.apiKey?.length || 0,
      keyStart: settings.apiKey?.substring(0, 10) || 'undefined',
      keyType: typeof settings.apiKey,
      startsWithSkAnt: settings.apiKey?.startsWith('sk-ant-') || false
    });

    // Validate API key format
    if (!settings.apiKey || !settings.apiKey.startsWith('sk-ant-')) {
      console.error('❌ Anthropic API key validation failed:', {
        apiKey: settings.apiKey,
        hasApiKey: !!settings.apiKey,
        startsWithSkAnt: settings.apiKey?.startsWith('sk-ant-')
      });
      throw new Error('Invalid Anthropic API key format. Key should start with "sk-ant-"');
    }

    // Adjust max_tokens based on Claude model limits
    let maxTokens = settings.maxTokens;
    if (settings.model.includes('claude-3-5-haiku')) {
      maxTokens = Math.min(maxTokens, 8192);
    } else if (settings.model.includes('claude-3-opus') || settings.model.includes('claude-3-sonnet') || settings.model.includes('claude-3-haiku')) {
      // Claude 3 models have 4096 max output tokens
      maxTokens = Math.min(maxTokens, 4096);
    } else if (settings.model.includes('claude-3-5-sonnet')) {
      maxTokens = Math.min(maxTokens, 8192);
    } else {
      // Default Claude limit
      maxTokens = Math.min(maxTokens, 4096);
    }

    const messages = [];

    // Add conversation history - filter out empty messages for Anthropic
    for (const historyMessage of conversationHistory) {
      let content: string;
      if (typeof historyMessage.content === 'string') {
        content = historyMessage.content.trim();
      } else if (Array.isArray(historyMessage.content)) {
        // Extract text from array format
        content = historyMessage.content.map((item: ContentItem | string) => {
          if (typeof item === 'string') return item;
          if (item.type === 'text') return item.text;
          return '[Non-text content]';
        }).join(' ').trim();
      } else {
        content = String(historyMessage.content).trim();
      }

      // Only add messages with non-empty content
      if (content) {
        messages.push({
          role: historyMessage.role,
          content: content
        });
      } else {
        console.warn(`⚠️ Skipping empty message in Anthropic conversation history:`, historyMessage);
      }
    }

    // Add current message
    if (typeof message === 'string') {
      messages.push({ role: 'user', content: message });
    } else if (Array.isArray(message)) {
      // Handle ContentItem array format (from chatService.ts)
      const anthropicContent = message.map((item: ContentItem) => {
        if (item.type === 'text') {
          return { type: 'text', text: item.text };
        } else if (item.type === 'image_url') {
          // Convert OpenAI format to Anthropic format
          const imageUrl = item.image_url?.url || '';

          // Determine media type from data URL
          const mediaType = imageUrl.includes('data:image/png') ? 'image/png' :
                           imageUrl.includes('data:image/gif') ? 'image/gif' :
                           imageUrl.includes('data:image/webp') ? 'image/webp' : 'image/jpeg';

          return {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageUrl.split(',')[1] // Remove data:image/jpeg;base64, prefix
            }
          };
        } else if (item.type === 'document') {
          // Handle document format for Anthropic
          return {
            type: 'document',
            source: {
              type: 'base64',
              media_type: item.document?.media_type || 'application/pdf',
              data: item.document?.data || ''
            }
          };
        }
        return item; // Pass through other types as-is
      });

      messages.push({ role: 'user', content: anthropicContent });
    } else {
      // Handle legacy vision format (for backward compatibility)
      const messageWithImages = message as { text: string; images: string[] };
      const content = [];
      content.push({ type: 'text', text: messageWithImages.text });

      // Add images in Anthropic format
      for (const imageUrl of messageWithImages.images) {
        // Determine media type from data URL
        const mediaType = imageUrl.includes('data:image/png') ? 'image/png' :
                         imageUrl.includes('data:image/gif') ? 'image/gif' :
                         imageUrl.includes('data:image/webp') ? 'image/webp' : 'image/jpeg';

        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: imageUrl.split(',')[1] // Remove data:image/jpeg;base64, prefix
          }
        });
      }
      messages.push({ role: 'user', content });
    }

    // Get Anthropic-specific formatted tools
    const anthropicTools = await this.getAnthropicTools(settings);

    // Use behavioral system prompt only (no tool descriptions)
    // Tools are sent separately in the tools parameter
    // Check for meaningful system prompt, not just empty string or generic default
    const hasCustomSystemPrompt = settings.systemPrompt &&
      settings.systemPrompt.trim() &&
      settings.systemPrompt !== "You are a helpful AI assistant. Please provide concise and helpful responses.";

    const systemPrompt = hasCustomSystemPrompt ? settings.systemPrompt! : this.getSystemPrompt();

    console.log(`🔍 Anthropic system prompt source:`, {
      hasCustom: hasCustomSystemPrompt,
      usingCustom: hasCustomSystemPrompt,
      promptLength: systemPrompt?.length || 0,
      promptStart: systemPrompt?.substring(0, 100) + '...'
    });

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      max_tokens: maxTokens,
      temperature: settings.temperature,
      system: systemPrompt || undefined,
      messages: messages,
      stream: !!onStream
    };

    // Add tools if available
    if (anthropicTools.length > 0) {
      requestBody.tools = anthropicTools;

      // For Claude 3.7 Sonnet, encourage parallel tool use
      if (settings.model.includes('claude-3-7-sonnet') || settings.model.includes('claude-sonnet-3-7')) {
        // Don't disable parallel tool use to encourage multiple tool calls
      }

      // Use auto tool choice to allow Claude to decide when to use tools
      requestBody.tool_choice = { type: "auto" };

      console.log(`🚀 Anthropic API call with ${anthropicTools.length} tools:`, {
        model: settings.model,
        toolCount: anthropicTools.length,
        toolChoice: requestBody.tool_choice
      });
    } else {
      console.log(`🚀 Anthropic API call without tools (no tools available)`);
    }

    console.log('🔍 Anthropic request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${provider.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody),
      signal
    });

    console.log('🔍 Anthropic response status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Anthropic API error response:', error);
      if (response.status === 401) {
        throw new Error(`Anthropic API authentication failed. Please check your API key in Settings. The key may be expired or invalid. Error: ${error}`);
      }
      throw new Error(`Anthropic API error: ${error}`);
    }

    if (onStream) {
      return this.handleStreamResponse(response, onStream, settings, provider, conversationHistory, signal);
    } else {
      return this.handleNonStreamResponse(response, settings, conversationHistory, conversationId);
    }
  }

  async fetchModels(apiKey: string): Promise<string[]> {
    if (!apiKey) {
      console.error('❌ No Anthropic API key provided - cannot fetch models');
      throw new Error('Anthropic API key is required to fetch available models. Please add your API key in settings.');
    }

    try {
      console.log('🔍 Fetching Anthropic models from API...');
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Anthropic API error: ${response.status} ${response.statusText}`, errorText);
        throw new Error(`Failed to fetch Anthropic models: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as { data: Array<{ id: string; display_name: string }> };
      const models = data.data?.map((model) => model.id)?.sort() || [];

      console.log(`✅ Fetched ${models.length} Anthropic models from API:`, models);

      if (models.length === 0) {
        throw new Error('No Anthropic models returned from API. This may indicate an API issue or insufficient permissions.');
      }

      return models;
    } catch (error) {
      console.error('❌ Failed to fetch Anthropic models from API:', error);
      throw error instanceof Error ? error : new Error(`Failed to fetch Anthropic models: ${String(error)}`);
    }
  }

  formatTools(tools: ToolObject[]): unknown[] {
    // Anthropic format with name length validation (max 64 characters)
    return tools.map(tool => {
      const originalName = tool.name || tool.function?.name || '';
      const truncatedName = originalName.length > 64
        ? ToolNameUtils.truncateToolNameForAnthropic(originalName)
        : originalName;

      if (originalName !== truncatedName) {
        console.warn(`⚠️ Truncated tool name for Anthropic: "${originalName}" -> "${truncatedName}"`);
      }

      return {
        name: truncatedName,
        description: tool.description || tool.function?.description,
        input_schema: tool.parameters || tool.function?.parameters || {
          type: 'object',
          properties: {},
          required: []
        }
      };
    });
  }

  getSystemPrompt(): string {
    return ANTHROPIC_SYSTEM_PROMPT;
  }



  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string {
    if (tools.length === 0) {
      return basePrompt;
    }

    // Anthropic uses structured tool calling with tools parameter and tool_choice
    // Don't add XML tool instructions as they conflict with native function calling
    console.log(`🔧 Anthropic using structured tools, skipping XML tool instructions`);
    return basePrompt;
  }

  validateToolCall(toolCall: { id?: string; name: string; arguments: Record<string, unknown> }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!toolCall.name || typeof toolCall.name !== 'string') {
      errors.push('Tool call must have a valid name');
    }

    // Anthropic uses tool_use blocks with specific format
    if (toolCall.arguments && typeof toolCall.arguments !== 'object') {
      errors.push(`Anthropic tool call arguments must be object: ${toolCall.name}`);
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

    if (!toolObj.name) {
      errors.push('Anthropic tools must have name property');
    }

    if (!toolObj.description) {
      errors.push('Anthropic tools must have description property');
    }

    return { valid: errors.length === 0, errors };
  }

  // Legacy methods for backward compatibility (now use injected dependencies)
  private async getMCPToolsForProvider(providerId: string, settings: LLMSettings): Promise<unknown[]> {
    return this._getMCPToolsForProvider ? await this._getMCPToolsForProvider(providerId, settings) : [];
  }

  private async executeMultipleToolsParallel(
    toolCalls: Array<{ id?: string; name: string; arguments: Record<string, unknown> }>,
    provider?: string
  ): Promise<Array<{ id?: string; name: string; result: string; success: boolean; executionTime: number }>> {
    return this._executeMultipleToolsParallel ? await this._executeMultipleToolsParallel(toolCalls, provider) : [];
  }

  private summarizeToolResultsForModel(
    results: Array<{ id?: string; name: string; result: string; success: boolean; executionTime: number }>
  ): string {
    return this._summarizeToolResultsForModel ? this._summarizeToolResultsForModel(results) : '';
  }

  private aggregateToolResults(
    results: Array<{ id?: string; name: string; result: string; success: boolean; executionTime: number }>
  ): string {
    return this._aggregateToolResults ? this._aggregateToolResults(results) : '';
  }

  private formatToolResult(toolName: string, result: unknown): string {
    return this._formatToolResult ? this._formatToolResult(toolName, result) : JSON.stringify(result);
  }

  private static streamingCallCount = 0;
  private static readonly MAX_STREAMING_CALLS = 5;

  private async handleStreamResponse(
    response: Response,
    onStream: (chunk: string) => void,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    // Prevent infinite recursion
    AnthropicProvider.streamingCallCount++;
    if (AnthropicProvider.streamingCallCount > AnthropicProvider.MAX_STREAMING_CALLS) {
      console.error('❌ CRITICAL: Too many streaming calls detected - preventing infinite loop');
      AnthropicProvider.streamingCallCount = 0;
      throw new Error('Maximum streaming calls exceeded - preventing infinite loop');
    }

    try {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let fullContent = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined = undefined;
    const decoder = new TextDecoder();
    const toolCalls: Array<{ id?: string; name?: string; arguments?: unknown; result?: string; isError?: boolean; parseError?: string }> = [];
    const toolInputBuffers: { [index: number]: string } = {};
    const currentToolBlocks: { [index: number]: Record<string, unknown> } = {};
    const assistantContent: Array<Record<string, unknown>> = [];

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            // Skip event type lines
            continue;
          }

          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              // Handle content_block_start for text
              if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'text') {
                assistantContent.push({ type: 'text', text: '' });
              }

              // Handle content_block_start for tool_use
              if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
                console.log(`🔧 Anthropic streaming tool use started:`, parsed.content_block);
                currentToolBlocks[parsed.index] = parsed.content_block;
                toolInputBuffers[parsed.index] = '';
                assistantContent.push({
                  type: 'tool_use',
                  id: parsed.content_block.id,
                  name: parsed.content_block.name,
                  input: {}
                });

                // Show tool usage in chat
                const toolMessage = `\n\n🔧 **Using tool: ${parsed.content_block.name}**\n`;
                fullContent += toolMessage;
                onStream(toolMessage);
              }

              // Handle content_block_delta events with text_delta
              if (parsed.type === 'content_block_delta' &&
                  parsed.delta?.type === 'text_delta' &&
                  parsed.delta?.text) {
                const content = parsed.delta.text;
                fullContent += content;
                onStream(content);

                // Update assistant content
                if (assistantContent[parsed.index] && assistantContent[parsed.index].type === 'text') {
                  assistantContent[parsed.index].text += content;
                }
              }

              // Handle content_block_delta events with input_json_delta (tool parameters)
              if (parsed.type === 'content_block_delta' &&
                  parsed.delta?.type === 'input_json_delta' &&
                  parsed.delta?.partial_json !== undefined) {
                const index = parsed.index;
                toolInputBuffers[index] += parsed.delta.partial_json;
                console.log(`🔧 Anthropic streaming tool input:`, { index, partial: parsed.delta.partial_json });
              }

              // Handle content_block_stop for tool_use
              if (parsed.type === 'content_block_stop' && currentToolBlocks[parsed.index]?.type === 'tool_use') {
                const index = parsed.index;
                const toolBlock = currentToolBlocks[index];
                const inputJson = toolInputBuffers[index];

                console.log(`🔧 Anthropic streaming tool use completed:`, { toolBlock, inputJson });

                try {
                  const toolInput = JSON.parse(inputJson);
                  console.log(`🔧 Collected streaming tool for parallel execution:`, toolBlock.name, toolInput);

                  // Update assistant content with final input
                  if (assistantContent[index] && assistantContent[index].type === 'tool_use') {
                    assistantContent[index].input = toolInput;
                  }

                  // Collect tool for parallel execution (don't execute yet)
                  toolCalls.push({
                    id: toolBlock.id as string,
                    name: toolBlock.name as string,
                    arguments: toolInput
                  });

                  // Show that we're preparing the tool (don't execute yet)
                  const preparingMessage = `⚙️ Preparing ${toolBlock.name}...\n`;
                  fullContent += preparingMessage;
                  onStream(preparingMessage);

                } catch (error) {
                  console.error(`❌ Anthropic streaming tool input parsing failed:`, error);

                  // Show parsing error in chat
                  const errorMessage = `❌ Tool ${toolBlock.name} input parsing failed: ${error instanceof Error ? error.message : String(error)}\n`;
                  fullContent += errorMessage;
                  onStream(errorMessage);

                  // Still collect the tool call for potential execution
                  toolCalls.push({
                    id: toolBlock.id as string,
                    name: toolBlock.name as string,
                    arguments: {},
                    parseError: error instanceof Error ? error.message : String(error)
                  });
                }

                // Clean up
                delete currentToolBlocks[index];
                delete toolInputBuffers[index];
              }

              // Handle message_delta events with usage data
              if (parsed.type === 'message_delta' && parsed.usage) {
                usage = {
                  prompt_tokens: parsed.usage.input_tokens,
                  completion_tokens: parsed.usage.output_tokens,
                  total_tokens: parsed.usage.input_tokens + parsed.usage.output_tokens
                };
              }
            } catch (e) {
              // Skip invalid JSON
              console.warn('Failed to parse streaming event:', e);

              // Prevent infinite loops from debug logger errors
              if (e instanceof Error && e.message.includes('debugLogger') && e.message.includes('is not a function')) {
                console.error('❌ Critical: Debug logger method missing - breaking streaming loop to prevent infinite recursion');
                break; // Exit the streaming loop
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
      // Reset counter when streaming completes normally
      AnthropicProvider.streamingCallCount = Math.max(0, AnthropicProvider.streamingCallCount - 1);
    }

    // If we have tool calls, execute them in parallel and make a follow-up streaming call
    console.log(`🔍 Anthropic tool execution check:`, {
      toolCallsCount: toolCalls.length,
      hasExecuteMultipleToolsParallel: !!this._executeMultipleToolsParallel,
      hasSummarizeToolResultsForModel: !!this._summarizeToolResultsForModel,
      hasAggregateToolResults: !!this._aggregateToolResults,
      hasFormatToolResult: !!this._formatToolResult
    });

    if (toolCalls.length > 0 && this._executeMultipleToolsParallel && this._summarizeToolResultsForModel && this._aggregateToolResults && this._formatToolResult) {
      console.log(`🚀 Executing ${toolCalls.length} Anthropic tools in parallel before follow-up`);

      // Show parallel execution message
      const parallelMessage = `\n🚀 Executing ${toolCalls.length} tools in parallel...\n`;
      fullContent += parallelMessage;
      onStream(parallelMessage);

      // Filter and prepare tool calls for parallel execution
      const validToolCalls = toolCalls
        .filter(tc => tc.id && tc.name && tc.arguments !== undefined)
        .map(tc => ({
          id: tc.id!,
          name: tc.name!,
          arguments: tc.arguments as Record<string, unknown>
        }));

      // Execute all tools in parallel
      const parallelResults = await this._executeMultipleToolsParallel(validToolCalls, 'anthropic');

      // Show completion message
      const successCount = parallelResults.filter(r => r.success).length;
      const completionMessage = `✅ Parallel execution completed: ${successCount}/${parallelResults.length} successful\n\n`;
      fullContent += completionMessage;
      onStream(completionMessage);

      // Add user-friendly summary for the model to work with (not the detailed debug output)
      const toolSummary = this._summarizeToolResultsForModel(parallelResults);

      // Log detailed results for debugging (not shown to user)
      console.log('🔧 Detailed tool execution results:', this._aggregateToolResults(parallelResults));

      // Only add the clean summary to the content stream
      fullContent += toolSummary;
      onStream(toolSummary);

      // Log tool execution for debugging
      console.log(`🔍 Executed tools:`, parallelResults.map(r => r.name));
      console.log(`🔍 Tool execution completed, proceeding with follow-up call`);

      console.log(`🔄 Making follow-up Anthropic streaming call with ${parallelResults.length} tool results`);

      // Reconstruct the conversation with tool results
      const messages = conversationHistory ? [...conversationHistory] : [];

      // Add the assistant's message with tool calls (proper Anthropic format)
      messages.push({
        role: 'assistant',
        content: assistantContent as unknown as Array<ContentItem>
      });

      // Add tool results as user message using parallel execution results (proper Anthropic format)
      const toolResults = parallelResults.map(result => {
        let content = result.result;

        // Parse JSON results and format them properly for Claude
        try {
          const parsedResult = JSON.parse(result.result);
          content = this._formatToolResult!(result.name, parsedResult);
        } catch {
          // If not JSON, use as-is but clean up quotes
          content = result.result.replace(/^"|"$/g, '');
        }

        return {
          type: 'tool_result',
          tool_use_id: result.id || '',
          content: content,
          is_error: !result.success
        };
      });

      messages.push({
        role: 'user',
        content: toolResults as unknown as Array<ContentItem>
      });

      // Get tools for continued agentic behavior
      const anthropicTools = await this.getAnthropicTools(settings);
      console.log(`🔧 Anthropic follow-up call with ${anthropicTools.length} tools available for continued agentic behavior`);

      // Use behavioral system prompt only for follow-up (no tool descriptions)
      // Tools are sent separately in the tools parameter
      const hasCustomSystemPromptFollowUp = settings.systemPrompt &&
        settings.systemPrompt.trim() &&
        settings.systemPrompt !== "You are a helpful AI assistant. Please provide concise and helpful responses.";

      const baseSystemPrompt = hasCustomSystemPromptFollowUp ? settings.systemPrompt! : this.getSystemPrompt();
      const followUpSystemPrompt = baseSystemPrompt +
        `\n\n## Follow-up Context\n\nBased on the tool results provided above, analyze the information and provide a complete, helpful response to the user's original question. Use the tool results to give specific, detailed information. If you need additional tools to provide a better answer, use them, but always conclude with a final response to the user.`;

      // Make follow-up streaming call with tools enabled for agentic behavior
      const followUpRequestBody = {
        model: settings.model,
        max_tokens: settings.maxTokens,
        temperature: settings.temperature,
        system: followUpSystemPrompt,
        messages: messages,
        stream: true,
        // Include tools to allow continued agentic behavior
        ...(anthropicTools.length > 0 && {
          tools: anthropicTools,
          tool_choice: { type: "auto" }
        })
      };

      const followUpResponse = await fetch(`${provider.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(followUpRequestBody),
        signal
      });

      if (followUpResponse.ok) {
        console.log(`✅ Starting follow-up streaming response`);

        try {
          // Stream the follow-up response with updated conversation history for agentic behavior
          const followUpResult = await this.handleStreamResponse(
            followUpResponse,
            (chunk: string) => {
              console.log(`🔄 Anthropic streaming follow-up chunk:`, chunk.substring(0, 50) + '...');
              // DISABLED: debugLogger.logStreaming('Anthropic', chunk, true);
              onStream(chunk);
            },
            settings,
            provider,
            messages, // Use updated messages that include tool results
            signal
          );

          console.log(`✅ Follow-up streaming completed:`, {
            contentLength: followUpResult.content?.length || 0,
            hasUsage: !!followUpResult.usage,
            hasToolCalls: !!followUpResult.toolCalls
          });

          // Combine tool calls from initial response AND follow-up response
          const initialToolCalls = toolCalls
            .filter(tc => tc.id && tc.name)
            .map(tc => ({
              id: tc.id!,
              name: tc.name!,
              arguments: tc.arguments as Record<string, unknown>
            }));

          const followUpToolCalls = followUpResult.toolCalls || [];
          const allToolCalls = [...initialToolCalls, ...followUpToolCalls];

          console.log(`🔧 Combined tool calls: ${initialToolCalls.length} initial + ${followUpToolCalls.length} follow-up = ${allToolCalls.length} total`);

          return {
            content: fullContent + followUpResult.content,
            usage: followUpResult.usage ? {
              promptTokens: (usage?.prompt_tokens || 0) + (followUpResult.usage?.promptTokens || 0),
              completionTokens: (usage?.completion_tokens || 0) + (followUpResult.usage?.completionTokens || 0),
              totalTokens: (usage?.total_tokens || 0) + (followUpResult.usage?.totalTokens || 0)
            } : usage ? {
              promptTokens: usage.prompt_tokens || 0,
              completionTokens: usage.completion_tokens || 0,
              totalTokens: usage.total_tokens || 0
            } : undefined,
            toolCalls: allToolCalls
          };
        } catch (error) {
          console.error(`❌ Anthropic follow-up streaming failed:`, error);
          console.error(`❌ Error details:`, {
            errorType: typeof error,
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined
          });

          // Reset streaming counter on error to prevent permanent lockout
          AnthropicProvider.streamingCallCount = 0;

          // Prevent infinite loops by not retrying on specific errors
          if (error instanceof Error && error.message.includes('debugLogger') && error.message.includes('is not a function')) {
            console.error('❌ Critical: Debug logger method missing - this would cause infinite loops. Stopping retry attempts.');
            // Don't retry, just provide fallback response
          }

          // Provide a fallback response with tool results
          const fallbackMessage = `\n\n**Tool execution completed successfully, but follow-up response failed. Here are the tool results:**\n\n`;
          onStream(fallbackMessage);

          // Stream the tool summary as fallback
          const toolSummary = this._summarizeToolResultsForModel!(parallelResults);
          onStream(toolSummary);

          // Check if it's a rate limit error and try local execution
          if (error && typeof error === 'object' && 'error' in error) {
            const apiError = error as { error?: { type?: string } };
            if (apiError.error?.type === 'rate_limit_error') {
              console.warn('⚠️ Anthropic: Rate limit exceeded, attempting local tool execution');

              // Try to execute tools locally if methods are available
              if (this.executeMCPTool && toolCalls.length > 0) {
                try {
                  const localResults = await this.executeToolsLocally(toolCalls, fullContent, usage);
                  return localResults as unknown as LLMResponse;
                } catch (localError) {
                  console.error('❌ Local tool execution also failed:', localError);
                }
              }
            }
          }

          // Fall through to return original response
        }
      } else {
        const errorText = await followUpResponse.text();
        console.error(`❌ Anthropic follow-up streaming call failed:`, followUpResponse.status, followUpResponse.statusText);
        console.error(`❌ Follow-up error details:`, errorText);

        // Provide a fallback response with tool results
        const fallbackMessage = `\n\n**Tool execution completed successfully, but follow-up request failed (${followUpResponse.status}). Here are the tool results:**\n\n`;
        onStream(fallbackMessage);

        // Stream the tool summary as fallback
        const toolSummary = this._summarizeToolResultsForModel!(parallelResults);
        onStream(toolSummary);
      }
    }

    // If we reach here, either no tool calls or tool execution methods not available
    if (toolCalls.length > 0) {
      console.warn(`⚠️ Anthropic: Tool calls detected but execution methods not available. Tool calls will not be executed.`);
      console.warn(`⚠️ Anthropic: Returning tool calls for external handling.`);
    }

    return {
      content: fullContent,
      usage: usage ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      } : undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls
        .filter(tc => tc.id && tc.name)
        .map(tc => ({
          id: tc.id!,
          name: tc.name!,
          arguments: tc.arguments as Record<string, unknown>
        })) : undefined
    };
    } catch (error) {
      // Reset streaming counter on error to prevent permanent lockout
      AnthropicProvider.streamingCallCount = 0;
      console.error('❌ Anthropic streaming error:', error);
      throw error;
    }
  }

  /**
   * Execute tools locally when API calls fail (e.g., rate limits)
   */
  private async executeToolsLocally(
    toolCalls: Array<Record<string, unknown>>,
    content: string,
    usage: Record<string, unknown> | undefined
  ): Promise<Record<string, unknown>> {
    console.log(`🔧 Executing ${toolCalls.length} tools locally due to API limitations`);

    const toolResults = [];
    for (const toolCall of toolCalls) {
      try {
        console.log(`🔧 Executing local tool: ${toolCall.name} with args:`, toolCall.arguments);
        const result = await this.executeMCPTool!(String(toolCall.name), toolCall.arguments as Record<string, unknown>);
        toolResults.push({
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          result: result
        });
        console.log(`✅ Local tool execution successful for ${toolCall.name}`);
      } catch (error) {
        console.error(`❌ Local tool execution failed for ${toolCall.name}:`, error);
        toolResults.push({
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          result: `Error: ${error instanceof Error ? error.message : String(error)}`
        });
      }
    }

    // Format results for display
    const resultsText = toolResults.map(tr =>
      `**${tr.toolName}**: ${tr.result.substring(0, 500)}${tr.result.length > 500 ? '...' : ''}`
    ).join('\n\n');

    return {
      content: `${content}\n\n**Tool Execution Results:**\n\n${resultsText}`,
      usage: usage ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      } : undefined,
      toolCalls: undefined // Clear tool calls since they've been executed
    };
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
    console.log('🔍 Anthropic raw response:', JSON.stringify(data, null, 2));

    // Handle tool calls in Anthropic format
    let content = '';
    const toolUseBlocks = [];

    // First pass: collect text content and tool use blocks
    for (const contentBlock of data.content) {
      if (contentBlock.type === 'text') {
        content += contentBlock.text;
      } else if (contentBlock.type === 'tool_use') {
        toolUseBlocks.push(contentBlock);
      }
    }

    // Create toolCalls array for compatibility
    const toolCalls = toolUseBlocks.map(block => ({
      id: block.id,
      name: block.name,
      arguments: block.input || {}
    }));

    return {
      content,
      usage: data.usage ? {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      } : undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    };
  }
}
