// Ollama provider implementation

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

import { OLLAMA_SYSTEM_PROMPT, generateOllamaToolPrompt } from './prompts/ollama';


export class OllamaProvider extends BaseProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama (Local)';

  // Cache for model tool support detection
  private static modelToolSupportCache = new Map<string, boolean>();

  private static readonly DEFAULT_BASE_URL = 'http://localhost:11434';

  readonly capabilities: ProviderCapabilities = {
    supportsVision: true,
    supportsTools: true, // Dynamic: structured tools if supported, text-based fallback
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'adaptive' // Adaptive: structured tools or text-based based on model
  };

  /**
   * Clear conversation state for Ollama to start fresh
   * This helps ensure new chats don't carry over context from previous conversations
   */
  async clearConversationState(settings: LLMSettings): Promise<void> {
    try {
      const baseUrl = settings.baseUrl || OllamaProvider.DEFAULT_BASE_URL;
      const ollamaUrl = baseUrl.replace('/v1', '');



      // Send an empty conversation to reset context
      // This effectively tells Ollama to forget previous conversation context
      const resetRequestBody = {
        model: settings.model,
        messages: [
          {
            role: 'system',
            content: 'Starting fresh conversation. Previous context cleared.'
          }
        ],
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 1 // Minimal response
        }
      };

      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(resetRequestBody)
      });

      if (response.ok) {
        // Conversation state cleared successfully
      } else {
        // Failed to clear conversation state, but continuing
      }
    } catch {
      // Don't throw - this is a best-effort cleanup
    }
  }

  // Check if a specific model supports structured tools
  private async checkModelSupportsStructuredTools(model: string, baseUrl?: string): Promise<boolean> {
    // Check cache first
    const cacheKey = `${model}@${baseUrl || 'default'}`;
    if (OllamaProvider.modelToolSupportCache.has(cacheKey)) {
      return OllamaProvider.modelToolSupportCache.get(cacheKey)!;
    }

    // Most Ollama models don't support structured tools yet, so default to text-based
    // This ensures models get tool descriptions in their system prompt
    OllamaProvider.modelToolSupportCache.set(cacheKey, false);
    return false;

    // TODO: Re-enable actual testing if needed, but for now this is more reliable
    /*
    // Test with a simple tool call to detect support
    try {
      const ollamaUrl = (baseUrl || OllamaProvider.DEFAULT_BASE_URL).replace('/v1', '');
      const endpoint = `${ollamaUrl}/api/chat`;

      const testRequestBody = {
        model: model,
        messages: [{ role: 'user', content: 'Test message' }],
        stream: false,
        tools: [{
          type: 'function',
          function: {
            name: 'test_tool',
            description: 'Test tool for capability detection',
            parameters: {
              type: 'object',
              properties: {
                test: { type: 'string', description: 'Test parameter' }
              }
            }
          }
        }]
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testRequestBody)
      });

      if (response.ok) {
        // Model supports structured tools

        OllamaProvider.modelToolSupportCache.set(cacheKey, true);
        return true;
      } else {
        const errorText = await response.text();
        if (errorText.includes('does not support tools')) {
          // Model explicitly doesn't support tools

          OllamaProvider.modelToolSupportCache.set(cacheKey, false);
          return false;
        } else {
          // Other error - assume no tool support to be safe

          OllamaProvider.modelToolSupportCache.set(cacheKey, false);
          return false;
        }
      }
    } catch (error) {
      // Network or other error - assume no tool support to be safe

      OllamaProvider.modelToolSupportCache.set(cacheKey, false);
      return false;
    }
    */
  }

  // Ollama-specific tool calling methods
  private async getOllamaTools(settings: LLMSettings): Promise<unknown[]> {
    try {


      // Check if tool calling is disabled
      if (settings?.toolCallingEnabled === false) {

        return [];
      }

      // Get raw tools from the centralized service (temporarily)
      const rawTools = await this.getMCPToolsForProvider('ollama', settings);


      // Format tools specifically for Ollama (uses OpenAI format)
      return this.formatToolsForOllama(rawTools);
    } catch {
      return [];
    }
  }

  private formatToolsForOllama(rawTools: unknown[]): unknown[] {
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


      return null;
    }).filter(tool => tool !== null);
  }

  async sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _conversationId?: string
  ): Promise<LLMResponse> {

    // Ollama API - check if using OpenAI-compatible endpoint or native API
    const baseUrl = settings.baseUrl || provider.baseUrl || OllamaProvider.DEFAULT_BASE_URL;

    const messages = [];

    // Get tools for text-based descriptions (Ollama doesn't support structured tools)
    const ollamaTools = await this.getOllamaTools(settings);

    // Use behavioral system prompt + tool descriptions (text-based approach)
    // Check for meaningful system prompt, not just empty string or generic default
    const hasCustomSystemPrompt = settings.systemPrompt &&
      settings.systemPrompt.trim() &&
      settings.systemPrompt !== "You are a helpful AI assistant. Please provide concise and helpful responses.";

    let systemPrompt = hasCustomSystemPrompt ? settings.systemPrompt! : this.getSystemPrompt();

    // Add tool descriptions to system prompt (Ollama doesn't support structured tools)
    if (ollamaTools.length > 0) {
      systemPrompt = this.enhanceSystemPromptWithTools(systemPrompt, ollamaTools as ToolObject[]);
    }





    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Add conversation history (convert ContentItem arrays to Ollama format)
    for (const historyMessage of conversationHistory) {
      if (Array.isArray(historyMessage.content)) {
        // Convert ContentItem array to Ollama format
        let textContent = '';
        const images: string[] = [];

        for (const item of historyMessage.content as ContentItem[]) {
          if (item.type === 'text') {
            textContent += item.text || '';
          } else if (item.type === 'image_url') {
            // Extract base64 data from data URL for Ollama
            const imageUrl = item.image_url?.url || '';
            if (imageUrl.includes(',')) {
              const base64Data = imageUrl.split(',')[1];
              images.push(base64Data);
            }
          }
        }

        if (images.length > 0) {
          messages.push({
            role: historyMessage.role,
            content: textContent,
            images: images
          });
        } else {
          messages.push({ role: historyMessage.role, content: textContent });
        }
      } else {
        // String content, add as-is
        messages.push(historyMessage);
      }
    }

    // Add current message
    if (typeof message === 'string') {
      messages.push({ role: 'user', content: message });
    } else if (Array.isArray(message)) {
      // Handle ContentItem array format (from chatService.ts)
      // Ollama's native API expects content to be a string, not an array
      // We need to convert the ContentItem array to Ollama's format

      let textContent = '';
      const images: string[] = [];

      for (const item of message as ContentItem[]) {
        if (item.type === 'text') {
          textContent += item.text || '';
        } else if (item.type === 'image_url') {
          // Extract base64 data from data URL for Ollama
          const imageUrl = item.image_url?.url || '';
          if (imageUrl.includes(',')) {
            const base64Data = imageUrl.split(',')[1];
            images.push(base64Data);
          }
        } else if (item.type === 'document') {
          // Handle documents as text for Ollama
          textContent += `\n\n[Document: ${item.document?.name || 'document'}]`;
        }
      }

      if (images.length > 0) {
        // Use Ollama's vision format: { text: string, images: string[] }
        messages.push({
          role: 'user',
          content: textContent,
          images: images
        });
      } else {
        // Text-only message
        messages.push({ role: 'user', content: textContent });
      }
    } else {
      // Handle legacy vision format
      const messageWithImages = message as { text: string; images: string[] };

      if (messageWithImages.images && messageWithImages.images.length > 0) {
        // Convert data URLs to base64 data for Ollama
        const images = messageWithImages.images.map(imageUrl => {
          return imageUrl.includes(',') ? imageUrl.split(',')[1] : imageUrl;
        });

        messages.push({
          role: 'user',
          content: messageWithImages.text,
          images: images
        });
      } else {
        messages.push({ role: 'user', content: messageWithImages.text });
      }
    }



    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: true // Ollama only supports streaming
    };

    // Check if model supports structured tools
    const supportsStructuredTools = await this.checkModelSupportsStructuredTools(settings.model, baseUrl);

    // Use Ollama's native /api/chat endpoint (not OpenAI-compatible)
    const ollamaUrl = baseUrl.replace('/v1', '');
    const endpoint = `${ollamaUrl}/api/chat`;


    // Convert to Ollama's native format with dynamic tool support
    const ollamaRequestBody = {
      model: requestBody.model,
      messages: requestBody.messages,
      stream: requestBody.stream,
      options: {
        temperature: requestBody.temperature,
        num_predict: requestBody.max_tokens
      },
      // Include structured tools only if model supports them
      ...(supportsStructuredTools && ollamaTools.length > 0 && { tools: ollamaTools })
    };



    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ollamaRequestBody),
      signal
    });

    if (!response.ok) {
      const error = await response.text();


      // Handle model not found error specifically
      if (response.status === 404 && error.includes('not found')) {
        try {
          // Try to get available models to suggest alternatives
          const availableModels = await this.fetchModels('', baseUrl);
          const modelSuggestions = availableModels.length > 0
            ? `\n\nAvailable models: ${availableModels.slice(0, 5).join(', ')}${availableModels.length > 5 ? '...' : ''}`
            : '\n\nNo models found. Please install models using: ollama pull <model-name>';

          throw new Error(`Model "${settings.model}" not found in Ollama.${modelSuggestions}\n\nTo install this model, run: ollama pull ${settings.model}`);
        } catch {
          // If we can't fetch models, just show the basic error
          throw new Error(`Model "${settings.model}" not found in Ollama. Please install it using: ollama pull ${settings.model}`);
        }
      }

      throw new Error(`Ollama API error: ${error}`);
    }

    // Ollama only supports streaming
    if (!onStream) {
      throw new Error('Ollama provider only supports streaming responses. Please enable streaming.');
    }

    return this.handleNativeStreamResponse(response, onStream, settings, provider, conversationHistory, signal);
  }

  async fetchModels(_apiKey: string, baseUrl?: string): Promise<string[]> {
    const ollamaUrl = baseUrl || OllamaProvider.DEFAULT_BASE_URL;
    
    try {
      // Ollama models endpoint
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(`Failed to connect to Ollama at ${ollamaUrl}. Status: ${response.status} - ${errorText}. Make sure Ollama is running and accessible.`);
      }

      const data = await response.json() as { models?: Array<{ name: string }> };
      const models = data.models?.map((model) => model.name)?.sort() || [];

      if (models.length === 0) {
        throw new Error(`No models found in Ollama at ${ollamaUrl}. Please install some models using 'ollama pull <model-name>'.`);
      }

      return models;
    } catch (error) {

      throw error instanceof Error ? error : new Error(`Failed to fetch Ollama models: ${String(error)}`);
    }
  }

  formatTools(tools: ToolObject[]): unknown[] {
    // Ollama uses OpenAI-compatible format
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
    return OLLAMA_SYSTEM_PROMPT;
  }

  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string {
    if (tools.length === 0) {
      return basePrompt;
    }

    const toolInstructions = generateOllamaToolPrompt(tools);
    return basePrompt + toolInstructions;
  }

  validateToolCall(toolCall: { id?: string; name: string; arguments: Record<string, unknown> }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

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
      errors.push('Ollama tools must have type: "function"');
    }

    if (!toolObj.function || typeof toolObj.function !== 'object') {
      errors.push('Ollama tools must have function object');
    } else {
      const func = toolObj.function as Record<string, unknown>;
      if (!func.name) {
        errors.push('Ollama tools must have function.name');
      }
    }

    return { valid: errors.length === 0, errors };
  }



  // Parse text-based tool calls from content
  private parseTextBasedToolCalls(content: string): Array<{ name: string; arguments: Record<string, unknown> }> {
    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    try {
      // Look for JSON blocks in the content
      const jsonBlocks = content.match(/```json\s*([\s\S]*?)\s*```/g);

      if (jsonBlocks) {
        for (const block of jsonBlocks) {
          // Extract JSON content
          const jsonContent = block.replace(/```json\s*/, '').replace(/\s*```/, '').trim();

          try {
            const parsed = JSON.parse(jsonContent);

            // Check if it's a tool call
            if (parsed.tool_call && parsed.tool_call.name) {
              toolCalls.push({
                name: parsed.tool_call.name,
                arguments: parsed.tool_call.arguments || {}
              });
            }
          } catch {
            // Skip invalid JSON blocks
          }
        }
      }
    } catch {
      // Continue with empty tool calls if parsing fails
    }

    return toolCalls;
  }



  // Private helper methods
  // This method is injected by the ProviderAdapter from the LLMService
  private getMCPToolsForProvider!: (providerId: string, settings: LLMSettings) => Promise<unknown[]>;

  /* eslint-disable @typescript-eslint/no-unused-vars */
  private async handleNativeStreamResponse(
    response: Response,
    onStream: (chunk: string) => void,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    _signal?: AbortSignal
  ): Promise<LLMResponse> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    // Use native Ollama tool calling - similar to OpenAI provider
    let fullContent = '';
    let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;
    const toolCalls: Array<{ id: string; function: { name: string; arguments: string } }> = [];
    let streamingComplete = false;



    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            streamingComplete = true;

            break;
          }

          const chunk = decoder.decode(value, { stream: true });


          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              // Ollama native API returns JSON objects directly (no "data: " prefix)
              const parsed = JSON.parse(line);

              // Ollama native streaming format
              const message = parsed.message;

              if (message?.content) {
                fullContent += message.content;
                onStream(message.content);
              }

              // Handle tool calls in Ollama native format
              if (message?.tool_calls) {

                for (const toolCall of message.tool_calls) {
                  if (toolCall.function) {
                    toolCalls.push({
                      id: toolCall.id || `call_${Date.now()}`,
                      function: {
                        name: toolCall.function.name,
                        arguments: JSON.stringify(toolCall.function.arguments) || '{}'
                      }
                    });
                  }
                }
              }

              // Handle final response with usage data
              if (parsed.done && parsed.total_duration) {
                usage = {
                  promptTokens: parsed.prompt_eval_count || 0,
                  completionTokens: parsed.eval_count || 0,
                  totalTokens: (parsed.prompt_eval_count || 0) + (parsed.eval_count || 0)
                };

              }
            } catch {
              // Skip empty lines or malformed JSON
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }



    // If no native tool calls found, check for text-based tool calls in content
    if (toolCalls.length === 0 && fullContent.includes('```json')) {
      const textBasedToolCalls = this.parseTextBasedToolCalls(fullContent);
      if (textBasedToolCalls.length > 0) {
        // Convert to native format
        for (const textTool of textBasedToolCalls) {
          toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
            function: {
              name: textTool.name,
              arguments: JSON.stringify(textTool.arguments)
            }
          });
        }
      }
    }

    // IMPORTANT: Verify streaming is complete before tool execution
    if (!streamingComplete) {
      throw new Error('Tool execution attempted before streaming completion');
    }

    // Check for XML-based tool calls in the content (since Ollama uses text-based tool calling)
    const xmlToolCalls = this.parseToolCallsFromText(fullContent);


    // If we have native tool calls, execute them and make a follow-up call
    if (toolCalls.length > 0) {


      // Stream any initial content first
      if (fullContent && typeof onStream === 'function') {
        // Content was already streamed during parsing, no need to stream again
      }


      return this.executeNativeToolCalls(toolCalls, fullContent, usage, settings, provider, conversationHistory, onStream);
    }

    // If we have XML tool calls, execute them using text-based tool execution
    if (xmlToolCalls.length > 0) {

      return this.executeTextBasedTools(xmlToolCalls, fullContent, usage, settings, provider, conversationHistory, onStream);
    }



    const { usage: usageInfo, cost } = this.createUsageAndCost(settings.model, usage);
    return {
      content: fullContent,
      usage: usageInfo,
      cost,
      toolCalls: []
    };
  }



  private async executeNativeToolCalls(
    toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>,
    _originalContent: string,
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
    settings: LLMSettings,
    _provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    // Check if we have parallel execution method injected (like Anthropic/Mistral)
    if ((this as unknown as {executeMultipleToolsParallel?: unknown, summarizeToolResultsForModel?: unknown}).executeMultipleToolsParallel && (this as unknown as {executeMultipleToolsParallel?: unknown, summarizeToolResultsForModel?: unknown}).summarizeToolResultsForModel) {
      
      // Format tool calls for parallel execution
      const toolCallsForExecution = toolCalls.map(tc => {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments);
        } catch {
          parsedArgs = {};
        }
        
        return {
          id: tc.id,
          name: tc.function.name,
          arguments: parsedArgs
        };
      });

      try {
        // Execute tools in parallel immediately
        const executeMultipleToolsParallel = (this as unknown as {executeMultipleToolsParallel: unknown}).executeMultipleToolsParallel;
        const summarizeToolResultsForModel = (this as unknown as {summarizeToolResultsForModel: unknown}).summarizeToolResultsForModel;

        const parallelResults = await (executeMultipleToolsParallel as (calls: unknown[], provider: string) => Promise<Array<{success: boolean}>>)(toolCallsForExecution, 'ollama');

        
        // Get tool results summary for the model
        const toolSummary = (summarizeToolResultsForModel as (results: unknown[]) => string)(parallelResults);

        // Stream the tool results to user
        onStream('\n\n' + toolSummary);

        // Make follow-up call to get model's response based on tool results


        try {
          // Build follow-up prompt with tool results
          const toolResultsText = (parallelResults as unknown as Array<{name: string, result: string}>).map(tr =>
            `Tool: ${tr.name}\nResult: ${tr.result}\n`
          ).join('\n');

          const followUpPrompt = `Based on the tool results below, please provide a helpful response to the user's question.

Tool Results:
${toolResultsText}

Please integrate these results into a natural, helpful response.`;

          // Build follow-up messages
          const followUpMessages = [
            ...conversationHistory,
            { role: 'user', content: followUpPrompt }
          ];

          const followUpResponse = await this.makeDirectFollowUpCall(
            followUpMessages,
            settings,
            onStream,
            true // enableTools for continued agentic behavior
          );

          // Combine original content + tool summary + follow-up response
          const combinedContent = _originalContent + '\n\n' + toolSummary + '\n\n' + followUpResponse.content;

          return {
            content: combinedContent,
            usage: followUpResponse.usage ? {
              promptTokens: (usage?.promptTokens || 0) + (followUpResponse.usage.promptTokens || 0),
              completionTokens: (usage?.completionTokens || 0) + (followUpResponse.usage.completionTokens || 0),
              totalTokens: (usage?.totalTokens || 0) + (followUpResponse.usage.totalTokens || 0)
            } : usage ? {
              promptTokens: usage.promptTokens || 0,
              completionTokens: usage.completionTokens || 0,
              totalTokens: usage.totalTokens || 0
            } : undefined,
            toolCalls: toolCallsForExecution
          };
        } catch {
          // Fall back to returning tool summary only
          const { usage: usageInfo, cost } = this.createUsageAndCost(settings.model, usage);
          return {
            content: _originalContent + '\n\n' + toolSummary,
            usage: usageInfo,
            cost,
            toolCalls: toolCallsForExecution
          };
        }
      } catch {
        // Fall back to sequential execution below
      }
    }

    // Fallback: Execute all tool calls sequentially (old method)

    const toolResults: Array<{ name: string; result: string; error?: boolean }> = [];

    for (const toolCall of toolCalls) {
      try {
        // Parse arguments safely
        let parsedArgs: Record<string, unknown> = {};
        if (toolCall.function.arguments) {
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments);
          } catch {
            parsedArgs = {};
          }
        }

        const result = await (this as unknown as {executeMCPTool: (name: string, args: unknown) => Promise<string>}).executeMCPTool(toolCall.function.name, parsedArgs);

        toolResults.push({
          name: toolCall.function.name,
          result: result,
          error: false
        });
      } catch (error) {
        const userFriendlyError = (this as unknown as {formatToolError?: (name: string, error: unknown) => string}).formatToolError ? (this as unknown as {formatToolError: (name: string, error: unknown) => string}).formatToolError(toolCall.function.name, error) : String(error);
        toolResults.push({
          name: toolCall.function.name,
          result: userFriendlyError,
          error: true
        });
      }
    }

    // Show tool execution completion
    const successCount = toolResults.filter(tr => !tr.error).length;
    const failureCount = toolResults.filter(tr => tr.error).length;
    const completionMessage = `<tool_execution>\n🏁 **Tool Execution Complete**\n\n✅ ${successCount} successful, ❌ ${failureCount} failed\n</tool_execution>\n\n`;
    onStream(completionMessage);

    // Create follow-up prompt with tool results (simplified approach like LM Studio)
    const toolResultsText = toolResults.map(tr =>
      `Tool: ${tr.name}\nResult: ${tr.result}\n`
    ).join('\n');

    const followUpPrompt = `Based on the tool results below, please provide a helpful response to the user's question.

Tool Results:
${toolResultsText}

Original Question: ${this.getLastUserMessage(conversationHistory)}

Please provide a natural, helpful response based on the tool results.`;



    // Clean conversation history to remove any malformed tool results
    const cleanedHistory = conversationHistory.filter(msg => {
      // Remove messages that contain tool execution errors
      if (typeof msg.content === 'string' && msg.content.includes('Tool Results:') && msg.content.includes('Error:')) {

        return false;
      }
      return true;
    });

    // Make follow-up call with simplified message format
    const followUpMessages = [
      ...cleanedHistory,
      { role: 'user', content: followUpPrompt }
    ];

    // Make a follow-up call with tools enabled for agentic behavior
    const followUpResponse = await this.makeDirectFollowUpCall(
      followUpMessages,
      settings,
      onStream,
      true // Enable tools for continued agentic behavior
    );

    // According to OpenAI/LM Studio docs, we should return ONLY the final assistant response
    // Tool execution details are handled by the UI separately via toolCalls

    return {
      content: followUpResponse.content || '',
      usage: followUpResponse.usage,
      toolCalls: toolCalls.map(tc => {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments);
        } catch {
          // Use empty args if parsing fails
        }

        const result = toolResults.find(tr => tr.name === tc.function.name);
        return {
          id: tc.id,
          name: tc.function.name,
          arguments: parsedArgs,
          result: result?.result,
          error: result?.error
        };
      })
    };
  }

  private getLastUserMessage(conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>): string {
    // Find the last user message in the conversation history
    for (let i = conversationHistory.length - 1; i >= 0; i--) {
      const msg = conversationHistory[i];
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          return msg.content;
        } else if (Array.isArray(msg.content)) {
          // Extract text from content array
          return msg.content
            .filter(item => item.type === 'text')
            .map(item => item.text || '')
            .join(' ');
        }
      }
    }
    return 'Please provide a response based on the tool results.';
  }

  private async makeDirectFollowUpCall(
    messages: Array<{role: string, content: string | Array<ContentItem>}>,
    settings: LLMSettings,
    onStream: (chunk: string) => void,
    enableTools = true
  ): Promise<LLMResponse> {
    const baseUrl = settings.baseUrl || OllamaProvider.DEFAULT_BASE_URL;
    const ollamaUrl = baseUrl.replace('/v1', '');
    const endpoint = `${ollamaUrl}/api/chat`;

    // Convert messages to Ollama format (handle ContentItem arrays)
    const ollamaMessages = messages.map(msg => {
      if (Array.isArray(msg.content)) {
        // Convert ContentItem array to Ollama format
        let textContent = '';
        const images: string[] = [];

        for (const item of msg.content as ContentItem[]) {
          if (item.type === 'text') {
            textContent += item.text || '';
          } else if (item.type === 'image_url') {
            // Extract base64 data from data URL for Ollama
            const imageUrl = item.image_url?.url || '';
            if (imageUrl.includes(',')) {
              const base64Data = imageUrl.split(',')[1];
              images.push(base64Data);
            }
          }
        }

        if (images.length > 0) {
          return {
            role: msg.role,
            content: textContent,
            images: images
          };
        } else {
          return { role: msg.role, content: textContent };
        }
      } else {
        // String content, return as-is
        return msg;
      }
    });

    // Get tools for text-based descriptions (Ollama doesn't support structured tools)
    let tools: unknown[] = [];
    if (enableTools && this.getMCPToolsForProvider) {
      try {
        tools = await this.getMCPToolsForProvider('ollama', settings);
      } catch {
        // Continue without tools if fetching fails
      }
    }

    // Update system message with optimized prompt if tools are available
    if (enableTools && tools.length > 0) {
      // Use condensed prompt for follow-up calls to avoid token limits
      const toolNames = (tools as Array<{function?: {name?: string}, name?: string}>).map(tool => tool.function?.name || tool.name).filter(Boolean);
      const followUpPrompt = `You are an AI assistant with access to ${tools.length} tools. Based on the tool results provided, continue the conversation naturally. Use additional tools if needed.

Available tools: ${toolNames.join(', ')}

Use XML format for tool calls:
\`\`\`xml
<tool_name>
<param>value</param>
</tool_name>
\`\`\`

Continue based on the tool results above. Call additional tools if needed for a comprehensive response.`;

      // Find and update system message, or add one if it doesn't exist
      const systemMessageIndex = ollamaMessages.findIndex(msg => msg.role === 'system');
      if (systemMessageIndex >= 0) {
        ollamaMessages[systemMessageIndex].content = followUpPrompt;
      } else {
        ollamaMessages.unshift({ role: 'system', content: followUpPrompt });
      }
    }

    // Check if model supports structured tools for follow-up call
    const supportsStructuredTools = await this.checkModelSupportsStructuredTools(settings.model, baseUrl);

    const requestBody = {
      model: settings.model,
      messages: ollamaMessages,
      stream: true, // Ollama only supports streaming
      options: {
        temperature: settings.temperature,
        num_predict: settings.maxTokens
      },
      // Include structured tools only if model supports them
      ...(supportsStructuredTools && enableTools && tools.length > 0 && { tools })
    };



    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama follow-up API error: ${error}`);
    }

    // Ollama only supports streaming
    if (!onStream) {
      throw new Error('Ollama follow-up calls only support streaming responses.');
    }

    // Handle streaming follow-up response
    let fullContent = '';
    let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              // Ollama native API returns JSON objects directly
              const parsed = JSON.parse(line);
              const message = parsed.message;

              if (message?.content) {
                fullContent += message.content;
                onStream(message.content);
              }

              // Handle final response with usage data
              if (parsed.done && parsed.total_duration) {
                usage = {
                  promptTokens: parsed.prompt_eval_count || 0,
                  completionTokens: parsed.eval_count || 0,
                  totalTokens: (parsed.prompt_eval_count || 0) + (parsed.eval_count || 0)
                };
              }
            } catch {
              // Skip empty lines or malformed JSON
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    // Check for additional tool calls in the follow-up response (agentic behavior)
    if (enableTools && fullContent) {
      const toolCalls = this.parseToolCallsFromText(fullContent);
      if (toolCalls.length > 0) {

        // Recursively execute additional tool calls
        return this.executeTextBasedTools(
          toolCalls,
          fullContent,
          usage,
          settings,
          { id: 'ollama', name: 'Ollama' } as LLMProvider,
          messages,
          onStream
        );
      }
    }

    const { usage: usageInfo, cost } = this.createUsageAndCost(settings.model, usage);
    return {
      content: fullContent,
      usage: usageInfo,
      cost
    };
  }

  public executeMCPTool?: (toolName: string, args: Record<string, unknown>) => Promise<string>;



  // Helper function to extract complete JSON object from text starting at a given index
  private extractCompleteJSON(text: string, startIndex: number): string | null {
    let braceCount = 0;
    let inString = false;
    let escaped = false;
    let jsonStart = -1;

    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          if (jsonStart === -1) jsonStart = i;
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && jsonStart !== -1) {
            return text.substring(jsonStart, i + 1);
          }
        }
      }
    }

    return null;
  }

  private parseToolCallsFromText(content: string): Array<{ name: string; arguments: Record<string, unknown> }> {
    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    // Get available tool names from MCP tools
    const availableTools = this.getAvailableToolNames();



    // Pattern 0: XML-style tool tags as instructed in the Ollama system prompt
    // Example:
    // <web_search>
    //   <query>current weather</query>
    // </web_search>
    try {
      const xmlTagRegex = /<([a-zA-Z_][\w-]*)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      let xmlMatch: RegExpExecArray | null;






      while ((xmlMatch = xmlTagRegex.exec(content)) !== null) {
        const rawToolName = xmlMatch[1];
        const inner = (xmlMatch[2] || '').trim();



        // IMMEDIATELY skip switch_mode - do not process as tool
        if (rawToolName === 'switch_mode') {

          continue;
        }

        // Also skip other non-tool XML tags
        if (rawToolName === 'think' || rawToolName === 'thinking' || rawToolName === 'tool_execution') {

          continue;
        }

        // Only handle tags that correspond to available tools; ignore others
        if (!availableTools.includes(rawToolName)) {

          continue;
        }



        const args: Record<string, unknown> = {};

        // Parse child tags as arguments: <param>value</param>
        const childTagRegex = /<([a-zA-Z_][\w-]*)\b[^>]*>([\s\S]*?)<\/\1>/gi;
        let childFound = false;
        let childMatch: RegExpExecArray | null;
        while ((childMatch = childTagRegex.exec(inner)) !== null) {
          childFound = true;
          const key = childMatch[1];
          const value = (childMatch[2] || '').trim();

          if (args[key] === undefined) {
            args[key] = value;
          } else if (Array.isArray(args[key])) {
            (args[key] as unknown[]).push(value);
          } else {
            args[key] = [args[key], value];
          }
        }

        if (!childFound) {
          // If no child tags, try JSON first, then fallback to single "input"
          if (inner.startsWith('{') || inner.startsWith('[')) {
            try {
              Object.assign(args, JSON.parse(inner));
            } catch {
              args.input = inner;
            }
          } else {
            args.input = inner;
          }
        }

        toolCalls.push({ name: rawToolName, arguments: args });
      }


    } catch {
      // Continue with empty tool calls if XML parsing fails
    }

    if (toolCalls.length > 0) {

      return this.deduplicateToolCalls ? this.deduplicateToolCalls(toolCalls) : toolCalls;
    }

    // Pattern 1: New model format with optional commentary prefix and to=tool_name and JSON arguments
    // Example: "commentary to=web_search json{"query":"dad joke", "topn":5}" or "to=list_directoryjson{...}"
    // Updated to handle nested JSON, multiple tool calls, hyphens, function namespace prefixes, and optional space before json
    const newModelFormatRegex = /(?:commentary\s+)?to=(?:functions\.)?([a-zA-Z_][a-zA-Z0-9_-]*)\s*json(\{(?:[^{}]|{[^{}]*})*\})/gi;

    // Pattern 1b: Nested function call format - to=functions json{"name":"tool_name","arguments":{...}}
    // CHECK THIS FIRST before the general pattern to avoid conflicts
    const nestedFunctionFormatRegex = /(?:commentary\s+)?to=functions\s*json\{[^}]*"name"\s*:\s*"([^"]+)"[^}]*"arguments"\s*:\s*(\{[^}]*\})[^}]*\}/gi;

    // Handle nested function format FIRST
    let nestedMatch;
    while ((nestedMatch = nestedFunctionFormatRegex.exec(content)) !== null) {
      try {
        const rawToolName = nestedMatch[1];
        const jsonArgs = nestedMatch[2];
        const args = JSON.parse(jsonArgs);

        // Apply same tool name mapping
        const toolNameMapping: Record<string, string> = {
          'memory_store': 'memory-store',
          'memory_search': 'memory-search',
          'memory_retrieve': 'memory-retrieve',
          'knowledge_base': 'knowledge-base',
          'knowledge_search': 'knowledge-base',
          'internal_tools': 'internal-commands',
          'internal_commands': 'internal-commands',
          'search': 'web_search'
        };

        const toolName = toolNameMapping[rawToolName] || rawToolName;

        // Verify this is a valid tool name
        if (availableTools.includes(toolName)) {
          toolCalls.push({ name: toolName, arguments: args });

        }
      } catch {
        // Skip invalid nested function calls
      }
    }

    // If we found nested function calls, return them immediately
    if (toolCalls.length > 0) {

      return toolCalls;
    }

    let newModelMatch;
    while ((newModelMatch = newModelFormatRegex.exec(content)) !== null) {
      try {
        const rawToolName = newModelMatch[1];
        const jsonArgs = newModelMatch[2];

        // Only parse tools that actually exist - no guessing or mapping
        if (availableTools.includes(rawToolName)) {
          try {
            // Handle malformed empty JSON like {"":""}
            let cleanJsonArgs = jsonArgs;
            if (jsonArgs === '{"":""}' || jsonArgs === '{"": ""}') {
              cleanJsonArgs = '{}';

            }

            const args = JSON.parse(cleanJsonArgs);
            toolCalls.push({ name: rawToolName, arguments: args });

          } catch {
            // Skip invalid JSON arguments
          }
        } else {

          // Return an error response that the LLM can see and correct
          return [{
            name: 'error_response',
            arguments: {
              error: `Tool "${rawToolName}" does not exist. Available tools include: ${availableTools.slice(0, 10).join(', ')}, and ${availableTools.length - 10} more. Please use an exact tool name from the available list.`
            }
          }];
        }
      } catch {
        // Skip invalid new model format calls
      }
    }

    // If we found any new model format tool calls, return them
    if (toolCalls.length > 0) {

      return toolCalls;
    }

    // Pattern 2: Enhanced tool_call format with ```json wrapper (Option 2)
    // ```json { "tool_call": { "name": "web_search", "arguments": {...} } } ```
    const jsonWrappedToolCallRegex = /```json\s*(\{[\s\S]*?"tool_call"[\s\S]*?\})\s*```/gi;
    let match = jsonWrappedToolCallRegex.exec(content);
    if (match) {
      try {
        const jsonObj = JSON.parse(match[1]);
        if (jsonObj.tool_call && jsonObj.tool_call.name && jsonObj.tool_call.arguments) {
          toolCalls.push({
            name: jsonObj.tool_call.name,
            arguments: jsonObj.tool_call.arguments
          });

          return toolCalls; // Return early if we found the structured format
        }
      } catch {
        // Skip invalid JSON-wrapped calls
      }
    }

    // Pattern 3: Direct JSON tool_call format (Option 1) - Enhanced with robust JSON parsing
    // { "tool_call": { "name": "web_search", "arguments": {...} } }
    const toolCallPattern = /\{\s*"tool_call"\s*:\s*\{/gi;
    let directMatch;
    while ((directMatch = toolCallPattern.exec(content)) !== null) {
      try {
        // Find the complete JSON object starting from the match
        const startIndex = directMatch.index;
        const jsonStr = this.extractCompleteJSON(content, startIndex);

        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          if (parsed.tool_call && parsed.tool_call.name) {
            toolCalls.push({
              name: parsed.tool_call.name,
              arguments: parsed.tool_call.arguments || {}
            });

            return toolCalls; // Return early if we found the structured format
          }
        }
      } catch {
        // Skip invalid direct tool calls
      }
    }

    // Pattern 3: Look for any JSON blocks and check if they contain tool calls
    const jsonBlockRegex = /```json\s*(\{[\s\S]*?\})\s*```/gi;
    let jsonMatch;
    while ((jsonMatch = jsonBlockRegex.exec(content)) !== null) {
      try {
        const jsonObj = JSON.parse(jsonMatch[1]);
        if (jsonObj.tool_call && jsonObj.tool_call.name && jsonObj.tool_call.arguments) {
          toolCalls.push({
            name: jsonObj.tool_call.name,
            arguments: jsonObj.tool_call.arguments
          });

        }
      } catch {
        // Skip invalid JSON blocks
      }
    }

    if (toolCalls.length > 0) {
      return toolCalls;
    }

    // Fallback patterns for less structured responses
    for (const toolName of availableTools) {
      // Pattern 4: Function call format - toolName(args)
      const functionCallRegex = new RegExp(`${toolName}\\s*\\(([^)]+)\\)`, 'gi');
      match = functionCallRegex.exec(content);
      if (match) {
        const args = this.parseArgumentsFromText(match[1]);
        toolCalls.push({ name: toolName, arguments: args });

        continue;
      }

      // Pattern 5: JSON-like format with tool name
      const jsonRegex = new RegExp(`["']?${toolName}["']?\\s*[:=]\\s*({[^}]*})`, 'gi');
      match = jsonRegex.exec(content);
      if (match) {
        const args = this.parseArgumentsFromText(match[1]);
        toolCalls.push({ name: toolName, arguments: args });

        continue;
      }

      // Pattern 6: Simple mention with nearby JSON
      if (content.toLowerCase().includes(toolName.toLowerCase())) {
        // Look for JSON objects near the tool name
        const toolIndex = content.toLowerCase().indexOf(toolName.toLowerCase());
        const nearbyText = content.substring(Math.max(0, toolIndex - 100), toolIndex + 200);

        const jsonMatches = nearbyText.match(/{[^}]*}/g);
        if (jsonMatches) {
          for (const jsonMatch of jsonMatches) {
            const args = this.parseArgumentsFromText(jsonMatch);
            if (Object.keys(args).length > 0) {
              toolCalls.push({ name: toolName, arguments: args });

              break;
            }
          }
        }
      }
    }

    return toolCalls;
  }

  private parseArgumentsFromText(argsText: string): Record<string, unknown> {
    try {
      // Try to parse as JSON first
      return JSON.parse(argsText);
    } catch {


      // If JSON parsing fails, try to extract key-value pairs
      const args: Record<string, unknown> = {};

      // Enhanced regex patterns for different value types
      const patterns = [
        // String values with quotes
        /["']?(\w+)["']?\s*[:=]\s*["']([^"']+)["']/g,
        // Number values
        /["']?(\w+)["']?\s*[:=]\s*(\d+(?:\.\d+)?)/g,
        // Boolean values
        /["']?(\w+)["']?\s*[:=]\s*(true|false)/g,
        // Array values (simplified)
        /["']?(\w+)["']?\s*[:=]\s*\[([^\]]+)\]/g,
        // General fallback
        /["']?(\w+)["']?\s*[:=]\s*([^,}\]]+)/g
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(argsText)) !== null) {
          const key = match[1];
          let value: unknown = match[2];

          // Skip if we already have this key
          if (args[key] !== undefined) continue;

          // Type conversion
          if (value === 'true') value = true;
          else if (value === 'false') value = false;
          else if (typeof value === 'string' && !isNaN(Number(value))) value = Number(value);
          else if (typeof value === 'string' && value.includes(',')) {
            // Try to parse as array
            value = value.split(',').map(v => v.trim().replace(/['"]/g, ''));
          }

          args[key] = value;
        }
      }


      return args;
    }
  }

  private deduplicateToolCalls(toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>): Array<{ name: string; arguments: Record<string, unknown> }> {
    const seen = new Set<string>();
    const unique: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    for (const toolCall of toolCalls) {
      const key = `${toolCall.name}:${JSON.stringify(toolCall.arguments)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(toolCall);
      }
    }

    return unique;
  }

  private availableToolNames: string[] = [];

  // Method to inject actual tool names from MCP service
  setAvailableToolNames(toolNames: string[]): void {
    this.availableToolNames = toolNames;

  }

  private getAvailableToolNames(): string[] {
    // Return injected tool names if available, otherwise fallback to common ones
    if (this.availableToolNames.length > 0) {
      return this.availableToolNames;
    }

    // Fallback to common tool names
    return [
      'web_search', 'search', 'google_search',
      'get_weather', 'weather', 'weather_search',
      'calculator', 'calculate', 'math',
      'file_read', 'read_file', 'get_file',
      'file_write', 'write_file', 'save_file',
      'get_datetime', 'current_time', 'date_time'
    ];
  }

  private async executeTextBasedTools(
    toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>,
    _originalContent: string,
    _usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    // STEP 1: STOP all streaming and execute tools completely

    // Show tool execution start (this is the ONLY streaming during tool execution)
    const toolNames = toolCalls.map(tc => `- ${tc.name}`).join('\n');
    const toolExecutionHeader = `\n\n<tool_execution>\n🔧 **Tool Execution Started**\n\nExecuting ${toolCalls.length} tool${toolCalls.length !== 1 ? 's' : ''}:\n${toolNames}\n</tool_execution>\n\n`;
    onStream(toolExecutionHeader);

    // STEP 2: Execute ALL tools to completion WITHOUT streaming

    const toolResults: Array<{ name: string; result: string; error?: boolean }> = [];

    for (const toolCall of toolCalls) {
      try {


        if (!this.executeMCPTool) {
          throw new Error('🚨 Ollama: executeMCPTool not injected! This should not happen.');
        }
        const result = await this.executeMCPTool(toolCall.name, toolCall.arguments);
        const resultString = typeof result === 'string' ? result : JSON.stringify(result);

        toolResults.push({
          name: toolCall.name,
          result: resultString,
          error: false
        });

      } catch (error) {
        const userFriendlyError = this.formatToolError(toolCall.name, error);

        toolResults.push({
          name: toolCall.name,
          result: userFriendlyError,
          error: true
        });
      }
    }

    // Create follow-up prompt with tool results
    const toolResultsText = toolResults.map(tr =>
      `Tool: ${tr.name}\nResult: ${tr.result}\n`
    ).join('\n');

    const followUpPrompt = `Based on the tool results below, please provide a helpful response to the user's question.

Tool Results:
${toolResultsText}

Original Question: ${this.getLastUserMessage(conversationHistory)}

Please provide a natural, helpful response based on the tool results.`;



    // Clean conversation history to remove any malformed tool results
    const cleanedHistory = conversationHistory.filter(msg => {
      // Remove messages that contain tool execution errors
      if (typeof msg.content === 'string' && msg.content.includes('Tool Results:') && msg.content.includes('Error:')) {

        return false;
      }
      return true;
    });

    // Make follow-up call
    const followUpMessages = [
      ...cleanedHistory,
      { role: 'user', content: followUpPrompt }
    ];

    const followUpResponse = await this.sendMessage(
      followUpPrompt,
      settings,
      provider,
      followUpMessages,
      onStream
    );

    return {
      content: followUpResponse.content,
      usage: followUpResponse.usage,
      toolCalls: toolResults.map((tr, index) => ({
        id: `text_tool_${index}`,
        name: tr.name,
        arguments: toolCalls.find(tc => tc.name === tr.name)?.arguments || {},
        result: tr.result,
        error: tr.error
      }))
    };
  }



  private formatToolError(toolName: string, error: unknown): string {
    const errorStr = error instanceof Error ? error.message : String(error);
    const errorLower = errorStr.toLowerCase();

    // Check for common error patterns and provide user-friendly messages
    if (errorLower.includes('timeout') || errorLower.includes('timed out')) {
      return `⏰ ${toolName} timed out. The tool took too long to respond. Please try again.`;
    }

    if (errorLower.includes('not found') || errorLower.includes('unknown tool')) {
      return `🔧 ${toolName} is not available. The tool might be disabled or not properly configured.`;
    }

    if (errorLower.includes('network') || errorLower.includes('connection')) {
      return `🌐 Network error while executing ${toolName}. Please check your connection and try again.`;
    }

    if (errorLower.includes('invalid') && errorLower.includes('argument')) {
      return `📝 ${toolName} received invalid arguments. Please check the parameters and try again.`;
    }

    if (errorLower.includes('rate limit') || errorLower.includes('too many requests')) {
      return `⏱️ ${toolName} rate limit exceeded. Please wait a moment before trying again.`;
    }

    if (errorLower.includes('unauthorized') || errorLower.includes('forbidden')) {
      return `🔐 Access denied for ${toolName}. Please check your permissions or API credentials.`;
    }

    // Default error message with the original error for debugging
    return `❌ ${toolName} execution failed: ${errorStr}`;
  }



  /**
   * Create usage information from Ollama API response (no cost calculation for local provider)
   */
  private createUsageAndCost(_model: string, usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) {
    if (!usage) return { usage: undefined, cost: undefined };

    const usageInfo = {
      promptTokens: usage.promptTokens || 0,
      completionTokens: usage.completionTokens || 0,
      totalTokens: usage.totalTokens || 0
    };

    // No cost calculation for local providers
    return { usage: usageInfo, cost: undefined };
  }
}
