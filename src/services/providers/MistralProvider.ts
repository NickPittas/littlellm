// Mistral AI provider implementation

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

import { MISTRAL_SYSTEM_PROMPT } from './prompts/mistral';
import { PricingService } from '../pricingService';
import { MistralFileService } from '../mistralFileService';

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
export class MistralProvider extends BaseProvider {
  readonly id = 'mistral';
  readonly name = 'Mistral AI';
  readonly capabilities: ProviderCapabilities = {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: 64,
    toolFormat: 'openai'
  };

  private fileService?: MistralFileService;

  // Mistral-specific tool calling methods
  private async getMistralTools(settings: LLMSettings): Promise<unknown[]> {
    try {
      safeDebugLog('info', 'MISTRALPROVIDER', `🔍 Getting tools for Mistral provider`);
      safeDebugLog('info', 'MISTRALPROVIDER', `🔍 Tool calling enabled:`, settings?.toolCallingEnabled !== false);

      // Check if tool calling is disabled
      if (settings?.toolCallingEnabled === false) {
        safeDebugLog('info', 'MISTRALPROVIDER', `🚫 Tool calling is disabled, returning empty tools array`);
        return [];
      }

      // Get raw tools from the centralized service (temporarily)
      const rawTools = await this.getMCPToolsForProvider('mistral', settings);
      safeDebugLog('info', 'MISTRALPROVIDER', `📋 Raw tools received (${rawTools.length} tools):`, (rawTools as Array<{name?: string, function?: {name?: string}}>).map(t => t.name || t.function?.name));

      // Format tools specifically for Mistral (uses OpenAI format)
      const formattedTools = this.formatToolsForMistral(rawTools);
      safeDebugLog('info', 'MISTRALPROVIDER', `🔧 Formatted ${formattedTools.length} tools for Mistral`);

      return formattedTools;
    } catch (error) {
      safeDebugLog('error', 'MISTRALPROVIDER', '❌ Failed to get Mistral tools:', error);
      return [];
    }
  }

  private formatToolsForMistral(rawTools: unknown[]): unknown[] {
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

      safeDebugLog('warn', 'MISTRALPROVIDER', `⚠️ Skipping invalid tool:`, tool);
      return null;
    }).filter(tool => tool !== null);
  }

  /* eslint-disable @typescript-eslint/no-explicit-any */
  async sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
    /* eslint-enable @typescript-eslint/no-explicit-any */
    // Initialize file service if not already done
    if (!this.fileService && settings.apiKey) {
      this.fileService = new MistralFileService(settings.apiKey, provider.baseUrl);
    }

    // Mistral uses OpenAI-compatible API
    const messages = [];

    // Get Mistral-specific formatted tools
    const mistralTools = await this.getMistralTools(settings);

    // Use behavioral system prompt only (no tool descriptions)
    // Tools are sent separately in the tools parameter (OpenAI-compatible)
    // Check for meaningful system prompt, not just empty string or generic default
    const hasCustomSystemPrompt = settings.systemPrompt &&
      settings.systemPrompt.trim() &&
      settings.systemPrompt !== "You are a helpful AI assistant. Please provide concise and helpful responses.";

    const systemPrompt = hasCustomSystemPrompt ? settings.systemPrompt! : this.getSystemPrompt();

    safeDebugLog('info', 'MISTRALPROVIDER', `🔍 Mistral system prompt source:`, {
      hasCustom: hasCustomSystemPrompt,
      usingCustom: hasCustomSystemPrompt,
      promptLength: systemPrompt?.length || 0,
      promptStart: systemPrompt?.substring(0, 100) + '...'
    });

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Add conversation history (clean for Mistral requirements)
    const cleanedHistory = conversationHistory.map(msg => {
      const typedMsg = msg as {role: string, tool_calls?: unknown, content?: unknown};
      if (typedMsg.role === 'assistant' && typedMsg.tool_calls && typedMsg.content) {
        // Mistral requires assistant messages to have EITHER content OR tool_calls, not both
        // Keep only tool_calls for assistant messages that have both
        return {
          role: typedMsg.role,
          tool_calls: typedMsg.tool_calls
        };
      }
      return msg;
    });
    messages.push(...cleanedHistory);

    // Check if model supports vision when images are present
    const hasImages = (Array.isArray(message) && message.some((item: ContentItem) => item.type === 'image_url')) ||
                     (typeof message === 'object' && message && 'images' in message && ((message as {images?: unknown[]}).images?.length ?? 0) > 0);

    if (hasImages) {
      const visionModels = [
        'mistral-medium-latest', 'mistral-medium-2505',
        'pixtral-large-latest', 'pixtral-large-2411',
        'pixtral-12b-latest', 'pixtral-12b-2409',
        'mistral-small-2503'
      ];

      if (!visionModels.includes(settings.model)) {
        throw new Error(`Mistral model "${settings.model}" does not support images. Please use a vision-capable model like "mistral-medium-latest", "pixtral-large-latest", or "pixtral-12b-2409" for image analysis.`);
      }
    }

    // Add current message
    if (typeof message === 'string') {
      messages.push({ role: 'user', content: message });
    } else if (Array.isArray(message)) {
      // Handle ContentItem array format (from chatService.ts)
      // Mistral uses OpenAI-compatible format, so we can pass through most content as-is
      const mistralContent = await Promise.all(message.map(async (item: ContentItem) => {
        if (item.type === 'text') {
          return { type: 'text', text: item.text };
        } else if (item.type === 'image_url') {
          // Mistral uses OpenAI-compatible format
          return {
            type: 'image_url',
            image_url: { url: item.image_url?.url || '' }
          };
        } else if (item.type === 'document') {
          // For documents, use Mistral's native capabilities
          if (this.fileService && item.document?.data) {
            try {
              // Convert base64 back to file for processing
              const binaryString = atob(item.document.data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              const file = new File([bytes], item.document.name || 'document', {
                type: item.document.media_type || 'application/pdf'
              });

              // Use Mistral's file service to prepare the document
              const preparedFile = await this.fileService.prepareFileForVision(file);
              return preparedFile;
            } catch (error) {
              safeDebugLog('error', 'MISTRALPROVIDER', '❌ Error processing document with Mistral:', error);
              return {
                type: 'text',
                text: `[Document: ${item.document?.name || 'document'} - Processing failed: ${error}]`
              };
            }
          } else {
            return {
              type: 'text',
              text: `[Document: ${item.document?.name || 'document'}]`
            };
          }
        }
        return item; // Pass through other types as-is
      }));

      messages.push({ role: 'user', content: mistralContent });
    } else {
      // Handle legacy vision format (for backward compatibility)
      const messageWithImages = message as { text: string; images: string[] };
      const content: ContentItem[] = [{ type: 'text', text: messageWithImages.text }];

      for (const imageUrl of messageWithImages.images) {
        // Mistral uses OpenAI-compatible format for images
        content.push({
          type: 'image_url',
          image_url: { url: imageUrl }
        });
      }
      messages.push({ role: 'user', content });
    }

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: onStream && typeof onStream === 'function'
    };

    // Add tools if available
    if (mistralTools.length > 0) {
      requestBody.tools = mistralTools;
      requestBody.tool_choice = 'auto';
      safeDebugLog('info', 'MISTRALPROVIDER', `🚀 Mistral API call with ${mistralTools.length} tools:`, {
        model: settings.model,
        toolCount: mistralTools.length,
        tools: mistralTools
      });
    } else {
      safeDebugLog('info', 'MISTRALPROVIDER', `🚀 Mistral API call without tools (no tools available)`);
    }

    // Log the full request for debugging
    safeDebugLog('info', 'MISTRALPROVIDER', `🔍 Mistral API request:`, {
      url: `${provider.baseUrl}/chat/completions`,
      model: settings.model,
      messageCount: messages.length,
      hasImages: messages.some(msg => 'content' in msg && Array.isArray(msg.content) && msg.content.some((c: {type?: string}) => c.type === 'image_url')),
      requestBody: JSON.stringify(requestBody, null, 2)
    });

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'User-Agent': 'LittleLLM/1.0'
      },
      body: JSON.stringify(requestBody),
      signal
    });

    if (!response.ok) {
      const error = await response.text();
      safeDebugLog('error', 'MISTRALPROVIDER', `❌ Mistral API error (${response.status} ${response.statusText}):`, error);
      safeDebugLog('error', 'MISTRALPROVIDER', `❌ Request details:`, {
        url: `${provider.baseUrl}/chat/completions`,
        model: settings.model,
        messageCount: messages.length,
        hasTools: mistralTools.length > 0,
        hasImages: messages.some(msg => 'content' in msg && Array.isArray(msg.content) && msg.content.some((c: {type?: string}) => c.type === 'image_url'))
      });

      // Try to parse error as JSON for better error messages
      let errorMessage = error;
      let errorDetails = '';
      try {
        const errorObj = JSON.parse(error);
        errorMessage = errorObj.message || errorObj.error?.message || error;

        // Add specific guidance for common errors
        if (response.status === 503) {
          errorDetails = '\n\nTroubleshooting tips for 503 Service Unavailable:\n' +
            '1. Check if your API key is valid and active\n' +
            '2. Verify the model name is correct (try "mistral-small-latest")\n' +
            '3. Check Mistral AI status page for service outages\n' +
            '4. Try again in a few moments - this may be temporary\n' +
            '5. Ensure you have sufficient API credits/quota';
        } else if (response.status === 401) {
          errorDetails = '\n\nAuthentication error - please check your API key';
        } else if (response.status === 429) {
          errorDetails = '\n\nRate limit exceeded - please wait before retrying';
        }
      } catch {
        // Keep original error if not JSON
      }

      throw new Error(`Mistral API error: ${errorMessage}${errorDetails}`);
    }

    if (onStream && typeof onStream === 'function') {
      return this.handleStreamResponse(response, onStream, settings, provider, conversationHistory, signal);
    } else {
      return this.handleNonStreamResponse(response, settings, conversationHistory, conversationId);
    }
  }

  async fetchModels(apiKey: string): Promise<string[]> {
    if (!apiKey) {
      safeDebugLog('error', 'MISTRALPROVIDER', '❌ No Mistral API key provided - cannot fetch models');
      throw new Error('Mistral API key is required to fetch available models. Please add your API key in settings.');
    }

    try {
      // Test API connectivity first
      safeDebugLog('info', 'MISTRALPROVIDER', '🔍 Testing Mistral API connectivity...');

      // Mistral AI models endpoint - correct API endpoint from their documentation
      const response = await fetch('https://api.mistral.ai/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'LittleLLM/1.0'
        }
      });

      safeDebugLog('info', 'MISTRALPROVIDER', `🔍 Mistral models API response: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        safeDebugLog('error', 'MISTRALPROVIDER', `❌ Mistral API error: ${response.status} ${response.statusText}`, errorText);

        // Try to parse error for better debugging
        let errorDetails = errorText;
        try {
          const errorObj = JSON.parse(errorText);
          safeDebugLog('error', 'MISTRALPROVIDER', 'Mistral API error details:', errorObj);
          errorDetails = errorObj.message || errorObj.error || errorText;
        } catch {
          safeDebugLog('error', 'MISTRALPROVIDER', 'Mistral API raw error:', errorText);
        }

        throw new Error(`Failed to fetch Mistral models: ${response.status} ${response.statusText} - ${errorDetails}`);
      }

      const data = await response.json() as APIResponseData;
      safeDebugLog('info', 'MISTRALPROVIDER', '✅ Mistral API models response:', data);

      // Mistral API returns models in data array with id field
      const models = data.data?.map((model) => model.id)?.sort() || [];

      safeDebugLog('info', 'MISTRALPROVIDER', `✅ Fetched ${models.length} Mistral models:`, models);

      if (models.length === 0) {
        throw new Error('No Mistral models returned from API. This may indicate an API issue or insufficient permissions.');
      }

      return models;
    } catch (error) {
      safeDebugLog('error', 'MISTRALPROVIDER', '❌ Failed to fetch Mistral models:', error);
      throw error instanceof Error ? error : new Error(`Failed to fetch Mistral models: ${String(error)}`);
    }
  }

  formatTools(tools: ToolObject[]): unknown[] {
    // Mistral uses OpenAI-compatible format
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
    return MISTRAL_SYSTEM_PROMPT;
  }

  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string {
    if (tools.length === 0) {
      return basePrompt;
    }

    // Mistral uses structured tool calling with tools parameter and tool_choice
    // Don't add XML tool instructions as they conflict with native function calling
    safeDebugLog('info', 'MISTRALPROVIDER', `🔧 Mistral using structured tools, skipping XML tool instructions`);
    return basePrompt;
  }

  // Test method to help debug API connectivity
  async testConnection(apiKey: string, baseUrl = 'https://api.mistral.ai/v1'): Promise<{ success: boolean; error?: string; details?: unknown }> {
    try {
      safeDebugLog('info', 'MISTRALPROVIDER', '🧪 Testing Mistral API connection...');

      // Simple test request
      const testResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'User-Agent': 'LittleLLM/1.0'
        },
        body: JSON.stringify({
          model: 'mistral-small-latest',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 10
        })
      });

      const responseText = await testResponse.text();

      if (testResponse.ok) {
        safeDebugLog('info', 'MISTRALPROVIDER', '✅ Mistral API connection test successful');
        return { success: true, details: { status: testResponse.status, response: responseText } };
      } else {
        safeDebugLog('error', 'MISTRALPROVIDER', `❌ Mistral API connection test failed: ${testResponse.status} ${testResponse.statusText}`);
        return {
          success: false,
          error: `${testResponse.status} ${testResponse.statusText}`,
          details: { status: testResponse.status, response: responseText }
        };
      }
    } catch (error) {
      safeDebugLog('error', 'MISTRALPROVIDER', '❌ Mistral API connection test error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  validateToolCall(toolCall: { id?: string; name: string; arguments: Record<string, unknown> }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!toolCall.id) {
      errors.push(`Mistral tool call missing required id: ${toolCall.name}`);
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
      errors.push('Mistral tools must have type: "function"');
    }

    if (!toolObj.function || typeof toolObj.function !== 'object') {
      errors.push('Mistral tools must have function object');
    } else {
      const func = toolObj.function as Record<string, unknown>;
      if (!func.name) {
        errors.push('Mistral tools must have function.name');
      }
      if (func.name && typeof func.name === 'string' && func.name.length > 64) {
        errors.push('Mistral function names must be ≤64 characters');
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
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    safeDebugLog('info', 'MISTRALPROVIDER', `🔧 Mistral streaming detected ${toolCalls.length} tool calls, executing...`);

    // Execute all tool calls and ensure exact matching
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const toolResults: any[] = [];
    for (let i = 0; i < toolCalls.length; i++) {
      const toolCall = toolCalls[i];
      try {
        safeDebugLog('info', 'MISTRALPROVIDER', `🔧 Executing Mistral tool call: ${toolCall.function?.name} with ID: ${toolCall.id}`);
        const toolName = toolCall.function?.name || '';
        const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
        const toolResult = await this.executeMCPTool(toolName, toolArgs);

        // Use the exact tool call ID from Mistral - don't generate new ones
        const toolCallId = toolCall.id;
        if (!toolCallId) {
          throw new Error(`Tool call missing ID: ${JSON.stringify(toolCall)}`);
        }

        // Ensure content is properly formatted JSON string
        let contentString: string;
        if (typeof toolResult === 'string') {
          // If it's already a string, validate it's valid JSON
          try {
            JSON.parse(toolResult);
            contentString = toolResult;
          } catch {
            // If not valid JSON, wrap it in a JSON object
            contentString = JSON.stringify({ content: toolResult });
          }
        } else {
          // Convert object to JSON string
          contentString = JSON.stringify(toolResult);
        }

        toolResults.push({
          role: 'tool',
          tool_call_id: toolCallId, // Must be first and match exactly
          name: toolName,
          content: contentString
        });

        safeDebugLog('info', 'MISTRALPROVIDER', `✅ Mistral tool result created for ID: ${toolCallId}`);
      } catch (error) {
        safeDebugLog('error', 'MISTRALPROVIDER', `❌ Mistral tool execution failed:`, error);
        const toolCallId = toolCall.id;
        if (!toolCallId) {
          safeDebugLog('error', 'MISTRALPROVIDER', `❌ Tool call missing ID during error handling: ${JSON.stringify(toolCall)}`);
          continue; // Skip this tool call if no ID
        }

        toolResults.push({
          role: 'tool',
          tool_call_id: toolCallId, // Must be first and match exactly
          name: toolCall.function?.name || '',
          content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
        });

        safeDebugLog('info', 'MISTRALPROVIDER', `❌ Mistral error result created for ID: ${toolCallId}`);
      }
    }

    safeDebugLog('info', 'MISTRALPROVIDER', `🔧 Mistral tool execution completed: ${toolCalls.length} calls, ${toolResults.length} results`);

    // Verify we have matching counts
    if (toolCalls.length !== toolResults.length) {
      safeDebugLog('error', 'MISTRALPROVIDER', `❌ Mistral tool call/result count mismatch: ${toolCalls.length} calls vs ${toolResults.length} results`);
      throw new Error(`Tool call/result count mismatch: ${toolCalls.length} calls vs ${toolResults.length} results`);
    }

    // Make follow-up call with tool results
    // According to Mistral docs, we need to:
    // 1. Add the assistant message with tool_calls to the conversation
    // 2. Add the tool result messages
    // 3. Make a new API call

    // Convert tool calls to the format Mistral expects
    const mistralToolCalls = toolCalls.map(tc => ({
      id: tc.id,
      type: 'function',
      function: {
        name: tc.function?.name || '',
        arguments: tc.function?.arguments || '{}'
      }
    }));

    // Build the follow-up messages using the original conversation + assistant response + tool results
    const followUpMessages = [];

    safeDebugLog('info', 'MISTRALPROVIDER', `🔍 Mistral conversation history debug:`, {
      historyLength: conversationHistory.length,
      roles: conversationHistory.map(msg => msg.role),
      userMessageCount: conversationHistory.filter(msg => msg.role === 'user').length
    });

    // Add system message if it exists
    const systemMessage = conversationHistory.find(msg => msg.role === 'system');
    if (systemMessage) {
      followUpMessages.push(systemMessage);
      safeDebugLog('info', 'MISTRALPROVIDER', `✅ Added system message`);
    }

    // Add the user message that triggered the tool call (the most recent user message)
    const userMessages = conversationHistory.filter(msg => msg.role === 'user');
    if (userMessages.length > 0) {
      const lastUserMessage = userMessages[userMessages.length - 1];
      followUpMessages.push(lastUserMessage);
      safeDebugLog('info', 'MISTRALPROVIDER', `✅ Added user message: "${typeof lastUserMessage.content === 'string' ? lastUserMessage.content.substring(0, 50) : 'complex content'}..."`);
    } else {
      safeDebugLog('info', 'MISTRALPROVIDER', `❌ No user messages found in conversation history!`);
      // Add a fallback user message if none found
      followUpMessages.push({
        role: 'user',
        content: 'Please provide a response based on the tool results.'
      });
      safeDebugLog('info', 'MISTRALPROVIDER', `✅ Added fallback user message`);
    }

    // Add the assistant message with tool calls (this is the response from step 2)
    followUpMessages.push({
      role: 'assistant',
      content: '', // Empty content when using tool_calls
      tool_calls: mistralToolCalls
    });

    // Add all tool results (step 3)
    followUpMessages.push(...toolResults);

    safeDebugLog('info', 'MISTRALPROVIDER', `🔄 Making Mistral follow-up call to process tool results...`);
    safeDebugLog('info', 'MISTRALPROVIDER', `🔧 Mistral follow-up message structure:`, {
      totalMessages: followUpMessages.length,
      toolCallsCount: mistralToolCalls.length,
      toolResultsCount: toolResults.length,
      toolCallIds: mistralToolCalls.map(tc => tc.id),
      toolResultIds: (toolResults as any[]).map((tr: any) => tr.tool_call_id),
      idsMatch: mistralToolCalls.every(tc => (toolResults as any[]).some((tr: any) => tr.tool_call_id === tc.id)),
      messages: followUpMessages.map(msg => ({
        role: msg.role,
        hasToolCalls: !!(msg as any).tool_calls,
        hasContent: !!(msg as any).content,
        toolCallsCount: (msg as any).tool_calls?.length || 0
      }))
    });

    // Verify exact ID matching and log detailed comparison
    safeDebugLog('info', 'MISTRALPROVIDER', `🔍 Mistral ID matching verification:`);
    for (const toolCall of mistralToolCalls) {
      const matchingResult = toolResults.find(tr => tr.tool_call_id === toolCall.id);
      safeDebugLog('info', 'MISTRALPROVIDER', `Tool call ID: "${toolCall.id}" -> Match found: ${!!matchingResult}`);
      if (!matchingResult) {
        safeDebugLog('error', 'MISTRALPROVIDER', `❌ Mistral: No matching tool result for tool call ID: "${toolCall.id}"`);
        safeDebugLog('error', 'MISTRALPROVIDER', `Available tool result IDs:`, toolResults.map(tr => `"${tr.tool_call_id}"`));
        throw new Error(`Tool call/result ID mismatch: "${toolCall.id}" not found in results`);
      }
    }

    // Final validation: exact count and ID matching
    if (mistralToolCalls.length !== toolResults.length) {
      throw new Error(`Count mismatch: ${mistralToolCalls.length} tool calls vs ${toolResults.length} results`);
    }

    safeDebugLog('info', 'MISTRALPROVIDER', `✅ Mistral: All ${mistralToolCalls.length} tool calls have matching results`);

    // Get tools for continued agentic behavior in follow-up call
    const followUpTools = await this.getMistralTools(settings);
    safeDebugLog('info', 'MISTRALPROVIDER', `🔄 Making Mistral follow-up call with ${followUpTools.length} tools available for continued agentic behavior`);

    const followUpRequestBody = {
      model: settings.model,
      messages: followUpMessages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: false,
      // Include tools to allow continued agentic behavior
      ...(followUpTools.length > 0 && {
        tools: followUpTools,
        tool_choice: 'auto'
      })
    };

    safeDebugLog('info', 'MISTRALPROVIDER', `🔧 Mistral follow-up request body:`, JSON.stringify(followUpRequestBody, null, 2));

    // Detailed validation of the exact structure Mistral expects
    safeDebugLog('info', 'MISTRALPROVIDER', `🔍 Mistral follow-up validation:`);
    safeDebugLog('info', 'MISTRALPROVIDER', `- Messages array length: ${followUpMessages.length}`);
    safeDebugLog('info', 'MISTRALPROVIDER', `- Message roles: [${followUpMessages.map(m => m.role).join(', ')}]`);

    // Validate each message
    followUpMessages.forEach((msg, index) => {
      safeDebugLog('info', 'MISTRALPROVIDER', `Message ${index + 1} (${msg.role}):`);
      if (msg.role === 'assistant' && msg.tool_calls) {
        safeDebugLog('info', 'MISTRALPROVIDER', `  - Has ${msg.tool_calls.length} tool calls`);
        safeDebugLog('info', 'MISTRALPROVIDER', `  - Content: "${msg.content}"`);
        msg.tool_calls.forEach((tc: any, tcIndex: number) => {
          safeDebugLog('info', 'MISTRALPROVIDER', `  - Tool call ${tcIndex + 1}: ID="${tc.id}", name="${tc.function.name}"`);
        });
      } else if (msg.role === 'tool') {
        safeDebugLog('info', 'MISTRALPROVIDER', `  - tool_call_id: "${(msg as any).tool_call_id}"`);
        safeDebugLog('info', 'MISTRALPROVIDER', `  - name: "${(msg as any).name}"`);
        safeDebugLog('info', 'MISTRALPROVIDER', `  - content length: ${(msg as any).content?.length || 0} chars`);
        safeDebugLog('info', 'MISTRALPROVIDER', `  - content preview: ${typeof (msg as any).content === 'string' ? (msg as any).content.substring(0, 100) : ''}...`);

        // Validate content is valid JSON
        try {
          const content = (msg as any).content;
          if (typeof content === 'string') {
            JSON.parse(content);
            safeDebugLog('info', 'MISTRALPROVIDER', `  - ✅ Content is valid JSON`);
          } else {
            safeDebugLog('info', 'MISTRALPROVIDER', `  - ⚠️ Content is not a string`);
          }
        } catch (e) {
          safeDebugLog('info', 'MISTRALPROVIDER', `  - ❌ Content is NOT valid JSON: ${e}`);
        }
      }
    });

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

      // Stream the follow-up content with type safety
      if (followUpMessage?.content && typeof followUpMessage.content === 'string') {
        onStream(followUpMessage.content);
      } else if (followUpMessage?.content) {
        safeDebugLog('warn', 'MISTRALPROVIDER', '⚠️ Mistral follow-up content is not a string:', typeof followUpMessage.content, followUpMessage.content);
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
      safeDebugLog('error', 'MISTRALPROVIDER', `❌ Mistral follow-up call failed (${followUpResponse.status}):`, errorText);

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
    /* eslint-enable @typescript-eslint/no-explicit-any */
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
    safeDebugLog('info', 'MISTRALPROVIDER', `🔍 Starting Mistral stream response handling...`);
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
          safeDebugLog('info', 'MISTRALPROVIDER', `🔍 Mistral stream chunk ${chunkCount}:`, chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''));
        }
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (chunkCount <= 5) {
                safeDebugLog('info', 'MISTRALPROVIDER', `🔍 Mistral parsed chunk ${chunkCount}:`, JSON.stringify(parsed, null, 2));
              }

              const choice = parsed.choices?.[0];
              const delta = choice?.delta;
              const content = delta?.content || '';

              if (content && typeof content === 'string') {
                fullContent += content;
                onStream(content);
                safeDebugLog('info', 'MISTRALPROVIDER', `📝 Mistral content chunk: "${content}"`);
              } else if (content) {
                safeDebugLog('warn', 'MISTRALPROVIDER', `⚠️ Mistral content chunk is not a string:`, typeof content, content);
              }

              // Check for tool calls and assemble them
              if (delta?.tool_calls) {
                safeDebugLog('info', 'MISTRALPROVIDER', `🔧 Mistral tool calls detected:`, delta.tool_calls);

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
              safeDebugLog('error', 'MISTRALPROVIDER', `❌ Mistral error parsing chunk:`, error, `Data: ${data.substring(0, 100)}...`);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Filter out empty tool calls and log final state
    const validToolCalls = toolCalls.filter(tc => tc && tc.function?.name);

    safeDebugLog('info', 'MISTRALPROVIDER', '🔍 Mistral stream response completed:', {
      contentLength: fullContent.length,
      hasUsage: !!usage,
      usage: usage,
      toolCallsCount: validToolCalls.length
    });

    if (validToolCalls.length > 0) {
      safeDebugLog('info', 'MISTRALPROVIDER', `🔧 Mistral assembled ${validToolCalls.length} tool calls:`, validToolCalls.map(tc => ({
        name: tc.function?.name,
        arguments: tc.function?.arguments
      })));

      // Execute tools and make follow-up call
      return this.executeToolsAndFollowUp(validToolCalls, fullContent, usage, settings, provider, conversationHistory, onStream);
    }

    return {
      content: fullContent,
      usage: usage ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      } : undefined,
      toolCalls: validToolCalls
        .filter(tc => tc.id && tc.function?.name)
        .map(tc => ({
          id: tc.id!,
          name: tc.function!.name!,
          arguments: JSON.parse(tc.function!.arguments || '{}')
        }))
    };
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
    safeDebugLog('info', 'MISTRALPROVIDER', `🔍 Mistral raw response:`, JSON.stringify(data, null, 2));
    const choice = data.choices[0];
    const message = choice.message;
    safeDebugLog('info', 'MISTRALPROVIDER', `🔍 Mistral message:`, message);

    // Handle tool calls if present - execute immediately like Anthropic
    if (message.tool_calls && message.tool_calls.length > 0) {
      safeDebugLog('info', 'MISTRALPROVIDER', `🔧 Mistral response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);

      // Check if we have the parallel execution method injected
      /* eslint-disable @typescript-eslint/no-explicit-any */
      if ((this as any).executeMultipleToolsParallel && (this as any).summarizeToolResultsForModel) {
        safeDebugLog('info', 'MISTRALPROVIDER', `🚀 Executing ${message.tool_calls.length} Mistral tools immediately`);
        
        // Format tool calls for execution
        const toolCallsForExecution = message.tool_calls.map((toolCall: { id: string; function: { name: string; arguments: string } }) => ({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments)
        }));

        // Execute tools in parallel immediately
        const executeMultipleToolsParallel = (this as any).executeMultipleToolsParallel;
        const summarizeToolResultsForModel = (this as any).summarizeToolResultsForModel;
        
        try {
          const parallelResults = await executeMultipleToolsParallel(toolCallsForExecution, 'mistral');
          safeDebugLog('info', 'MISTRALPROVIDER', `✅ Mistral tool execution completed: ${parallelResults.filter((r: any) => r.success).length}/${parallelResults.length} successful`);
          
          // Get tool results summary for the model
          const toolSummary = summarizeToolResultsForModel(parallelResults);
          
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
          safeDebugLog('error', 'MISTRALPROVIDER', `❌ Mistral tool execution failed:`, error);
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
        /* eslint-enable @typescript-eslint/no-explicit-any */
      } else {
        safeDebugLog('warn', 'MISTRALPROVIDER', `⚠️ Mistral provider missing tool execution methods - falling back to external handling`);
        // Fall back to external handling if methods not injected
        return {
          content: message.content || '',
          usage: data.usage ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens
          } : undefined,
          toolCalls: message.tool_calls.map((toolCall: { id: string; function: { name: string; arguments: string } }) => ({
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: JSON.parse(toolCall.function.arguments)
          }))
        };
      }
    }

    const { usage, cost } = this.createUsageAndCost(settings.model, data.usage);
    return {
      content: message.content,
      usage,
      cost
    };
  }

  /**
   * Process files using Mistral's native capabilities
   * Focus on local processing for vision models, no server uploads needed
   */
  async processFiles(files: File[], settings: LLMSettings, provider: LLMProvider): Promise<Array<ContentItem>> {
    safeDebugLog('info', 'MISTRALPROVIDER', '🔍 MistralProvider.processFiles called with:', {
      filesCount: files.length,
      fileNames: files.map(f => f.name),
      fileTypes: files.map(f => f.type),
      hasApiKey: !!settings.apiKey,
      baseUrl: provider.baseUrl
    });

    // Initialize file service for local processing (no API key needed for local operations)
    if (!this.fileService) {
      safeDebugLog('info', 'MISTRALPROVIDER', '🔧 Initializing Mistral file service for local processing...');
      this.fileService = new MistralFileService(settings.apiKey || 'local', provider.baseUrl);
    }

    safeDebugLog('info', 'MISTRALPROVIDER', '✅ Mistral file service ready, processing files locally...');
    const contentItems: Array<ContentItem> = [];

    for (const file of files) {
      safeDebugLog('info', 'MISTRALPROVIDER', `🔍 Processing file with Mistral: ${file.name} (${file.type}, ${Math.round(file.size/1024)}KB)`);

      // Validate file support
      const validation = MistralFileService.isFileSupported(file);
      if (!validation.supported) {
        safeDebugLog('warn', 'MISTRALPROVIDER', `❌ File not supported: ${validation.reason}`);
        contentItems.push({
          type: 'text',
          text: `[File: ${file.name} - ${validation.reason}]`
        });
        continue;
      }

      try {
        // Use the unified file preparation method for all file types
        const preparedFile = await this.fileService.prepareFileForVision(file);
        contentItems.push(preparedFile as ContentItem);
        safeDebugLog('info', 'MISTRALPROVIDER', `✅ File processed: ${file.name} (${preparedFile.type})`);

      } catch (error) {
        safeDebugLog('error', 'MISTRALPROVIDER', `❌ Error processing file ${file.name}:`, error);
        contentItems.push({
          type: 'text',
          text: `[File: ${file.name} - Processing failed: ${error instanceof Error ? error.message : String(error)}]`
        });
      }
    }

    safeDebugLog('info', 'MISTRALPROVIDER', `✅ Mistral file processing complete. Processed ${contentItems.length} items:`,
      contentItems.map(item => ({ type: item.type, hasContent: !!(item.text || item.image_url) }))
    );

    return contentItems;
  }

  /**
   * Read text file content (fallback method)
   */
  private async readTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
      reader.readAsText(file);
    });
  }

  /**
   * Check if file is supported by Mistral
   */
  static isFileSupported(file: File): { supported: boolean; reason?: string } {
    return MistralFileService.isFileSupported(file);
  }

  /**
   * Create usage and cost information from Mistral API response
   */
  private createUsageAndCost(model: string, usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) {
    if (!usage) return { usage: undefined, cost: undefined };

    const usageInfo = {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0
    };

    const costInfo = PricingService.calculateCost('mistral', model, usageInfo.promptTokens, usageInfo.completionTokens);

    return { usage: usageInfo, cost: costInfo };
  }
}
