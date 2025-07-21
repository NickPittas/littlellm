// Ollama provider implementation

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
import { OLLAMA_SYSTEM_PROMPT, generateOllamaToolPrompt } from './prompts/ollama';

export class OllamaProvider extends BaseProvider {
  readonly id = 'ollama';
  readonly name = 'Ollama (Local)';
  readonly capabilities: ProviderCapabilities = {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'openai'
  };

  // Ollama-specific tool calling methods
  private async getOllamaTools(settings: LLMSettings): Promise<unknown[]> {
    try {
      console.log(`🔍 Getting tools for Ollama provider`);
      console.log(`🔍 Tool calling enabled:`, settings?.toolCallingEnabled !== false);

      // Check if tool calling is disabled
      if (settings?.toolCallingEnabled === false) {
        console.log(`🚫 Tool calling is disabled, returning empty tools array`);
        return [];
      }

      // Get raw tools from the centralized service (temporarily)
      const rawTools = await this.getMCPToolsForProvider('ollama', settings);
      console.log(`📋 Raw tools received (${rawTools.length} tools):`, rawTools.map((t: any) => t.name || t.function?.name));

      // Format tools specifically for Ollama (uses OpenAI format)
      const formattedTools = this.formatToolsForOllama(rawTools);
      console.log(`🔧 Formatted ${formattedTools.length} tools for Ollama`);

      return formattedTools;
    } catch (error) {
      console.error('❌ Failed to get Ollama tools:', error);
      return [];
    }
  }

  private formatToolsForOllama(rawTools: any[]): unknown[] {
    return rawTools.map(tool => {
      // All tools now come in unified format with type: 'function' and function object
      if (tool.type === 'function' && tool.function) {
        return {
          type: 'function',
          function: {
            name: tool.function.name || 'unknown_tool',
            description: tool.function.description || 'No description',
            parameters: tool.function.parameters || {
              type: 'object',
              properties: {},
              required: []
            }
          }
        };
      }
      
      // Handle MCP tools (need conversion to OpenAI format)
      if (tool.name && tool.description) {
        return {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema || {
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

  async sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
    console.log(`🔍 Ollama sendMessage called with:`, {
      model: settings.model,
      baseUrl: settings.baseUrl,
      providerBaseUrl: provider.baseUrl,
      messageType: typeof message
    });
    // Ollama API - check if using OpenAI-compatible endpoint or native API
    const baseUrl = settings.baseUrl || provider.baseUrl || 'http://localhost:11434';

    const messages = [];

    // Get Ollama-specific formatted tools
    const ollamaTools = await this.getOllamaTools(settings);

    // Build system prompt with tool instructions if tools are available
    let systemPrompt = settings.systemPrompt || this.getSystemPrompt();
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

    console.log(`🔍 Ollama: Using model: "${settings.model}"`);
    console.log(`🔍 Ollama: Available tools: ${ollamaTools.length}`);

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };

    // Check if model supports tools before adding them
    const supportsTools = this.modelSupportsTools(settings.model);
    console.log(`🔍 Ollama: Model "${settings.model}" supports tools: ${supportsTools}`);

    // Only add tools if model supports them AND we have tools available
    if (supportsTools && ollamaTools.length > 0) {
      requestBody.tools = ollamaTools;
      requestBody.tool_choice = 'auto';
      console.log(`🚀 Ollama API call with ${ollamaTools.length} tools:`, {
        model: settings.model,
        toolCount: ollamaTools.length
      });
      console.log(`🔍 Ollama: Full request body:`, JSON.stringify(requestBody, null, 2));
    } else {
      if (!supportsTools) {
        console.log(`🚀 Ollama API call without tools (model "${settings.model}" doesn't support tools)`);
      } else {
        console.log(`🚀 Ollama API call without tools (no tools available)`);
      }
    }

    // Use Ollama's native /api/chat endpoint (not OpenAI-compatible)
    const ollamaUrl = baseUrl.replace('/v1', '');
    const endpoint = `${ollamaUrl}/api/chat`;
    console.log(`🔍 Ollama: Using native API URL: ${endpoint}`);

    // Convert to Ollama's native format
    const ollamaRequestBody = {
      model: requestBody.model,
      messages: requestBody.messages,
      stream: requestBody.stream,
      tools: requestBody.tools,
      options: {
        temperature: requestBody.temperature,
        num_predict: requestBody.max_tokens
      }
    };

    console.log(`🔍 Ollama: Native request body:`, JSON.stringify(ollamaRequestBody, null, 2));

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
      console.error('🚨 Ollama API error response:', error);
      console.error('🚨 Ollama API error details:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        requestModel: settings.model
      });
      throw new Error(`Ollama API error: ${error}`);
    }

    if (onStream) {
      return this.handleNativeStreamResponse(response, onStream, settings, provider, conversationHistory, signal);
    } else {
      return this.handleNativeNonStreamResponse(response, settings, conversationHistory, conversationId);
    }
  }

  async fetchModels(apiKey: string, baseUrl?: string): Promise<string[]> {
    const ollamaUrl = baseUrl || 'http://localhost:11434';
    
    try {
      // Ollama models endpoint
      const response = await fetch(`${ollamaUrl}/api/tags`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`Ollama API error: ${response.status}, using fallback models`);
        return FALLBACK_MODELS.ollama;
      }

      const data = await response.json() as { models?: Array<{ name: string }> };
      const models = data.models?.map((model) => model.name)?.sort() || [];

      return models.length > 0 ? models : FALLBACK_MODELS.ollama;
    } catch (error) {
      console.warn('Failed to fetch Ollama models, using fallback:', error);
      return FALLBACK_MODELS.ollama;
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
          } catch (parseError) {
            console.warn(`⚠️ Failed to parse JSON block:`, jsonContent, parseError);
          }
        }
      }
    } catch (error) {
      console.warn(`⚠️ Error parsing text-based tool calls:`, error);
    }

    return toolCalls;
  }

  // Check if a model supports tool calling
  private modelSupportsTools(modelName: string): boolean {
    const modelLower = modelName.toLowerCase();

    // First, exclude models that definitely don't support tools
    const excludedPatterns = [
      'vision',     // Vision models don't support tools
      'embed',      // Embedding models don't support tools
      'code',       // Code-specific models often don't support tools
      'instruct',   // Some instruct models don't support tools
    ];

    // If model contains excluded patterns, it doesn't support tools
    if (excludedPatterns.some(pattern => modelLower.includes(pattern))) {
      console.log(`🔍 Ollama: Model "${modelName}" excluded from tool support (contains: ${excludedPatterns.find(p => modelLower.includes(p))})`);
      return false;
    }

    // List of known tool-capable model families
    const toolCapableModels = [
      // Llama models with tool support (but not vision variants)
      'llama3.1', 'llama3.2', 'llama3.3',
      // Qwen models with tool support
      'qwen2.5', 'qwen2', 'qwen',
      // Mistral models with tool support
      'mistral', 'mixtral',
      // Other tool-capable models
      'cogito', 'hermes', 'nous-hermes',
      // Add more as needed
    ];

    // Check if the model name contains any of the tool-capable model names
    const isToolCapable = toolCapableModels.some(capable => modelLower.includes(capable));
    console.log(`🔍 Ollama: Model "${modelName}" tool support: ${isToolCapable}`);
    return isToolCapable;
  }

  // Private helper methods
  // This method is injected by the ProviderAdapter from the LLMService
  private getMCPToolsForProvider!: (providerId: string, settings: LLMSettings) => Promise<unknown[]>;

  private async handleNativeStreamResponse(
    response: Response,
    onStream: (chunk: string) => void,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    // Use native Ollama tool calling - similar to OpenAI provider
    let fullContent = '';
    let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;
    let toolCalls: Array<{ id: string; function: { name: string; arguments: string } }> = [];
    let chunkCount = 0;

    console.log('🔍 Ollama: Starting to process streaming response...');

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            console.log(`🔍 Ollama: Stream ended. Total chunks processed: ${chunkCount}`);
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          chunkCount++;
          console.log(`🔍 Ollama: Chunk ${chunkCount}:`, chunk);

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
                console.log(`🔧 Ollama: Found tool calls in response:`, message.tool_calls);
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
                console.log(`🔍 Ollama: Final usage data:`, usage);
              }
            } catch (error) {
              // Skip empty lines or malformed JSON
              if (line.trim()) {
                console.warn('Failed to parse Ollama streaming chunk:', error, 'Raw line:', line);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    console.log(`🔍 Ollama: Final results - Content length: ${fullContent.length}, Tool calls: ${toolCalls.length}`);
    console.log(`🔍 Ollama: Full content:`, fullContent);
    console.log(`🔍 Ollama: Tool calls:`, toolCalls);

    // If no native tool calls found, check for text-based tool calls in content
    if (toolCalls.length === 0 && fullContent.includes('```json')) {
      console.log(`🔍 Ollama: No native tool calls found, checking for text-based tool calls...`);
      const textBasedToolCalls = this.parseTextBasedToolCalls(fullContent);
      if (textBasedToolCalls.length > 0) {
        console.log(`🔧 Ollama: Found ${textBasedToolCalls.length} text-based tool calls:`, textBasedToolCalls);
        // Convert to native format
        for (const textTool of textBasedToolCalls) {
          toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            function: {
              name: textTool.name,
              arguments: JSON.stringify(textTool.arguments)
            }
          });
        }
      }
    }

    // If we have tool calls, execute them and make a follow-up call
    if (toolCalls.length > 0) {
      console.log(`🔧 Ollama found ${toolCalls.length} native tool calls`);
      console.log(`🔧 Ollama tool calls:`, toolCalls);

      // Stream any initial content first
      if (fullContent && typeof onStream === 'function') {
        console.log(`🔄 Ollama: Streaming initial content before tool execution: "${fullContent}"`);
        // Content was already streamed during parsing, no need to stream again
      }

      return this.executeNativeToolCalls(toolCalls, fullContent, usage, settings, provider, conversationHistory, onStream);
    }

    console.log(`🔍 Ollama: No tool calls found, returning content: "${fullContent}"`);
    return {
      content: fullContent,
      usage: usage ? {
        promptTokens: usage.promptTokens || 0,
        completionTokens: usage.completionTokens || 0,
        totalTokens: usage.totalTokens || 0
      } : undefined,
      toolCalls: []
    };
  }

  private async handleNativeNonStreamResponse(
    response: Response,
    settings: LLMSettings,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    conversationId?: string
  ): Promise<LLMResponse> {
    const data = await response.json();
    console.log(`🔍 Ollama native non-stream response:`, JSON.stringify(data, null, 2));

    // Ollama native response format has message directly
    const message = data.message;
    if (!message) {
      console.error('❌ Ollama: No message in response');
      return { content: '', usage: undefined, toolCalls: [] };
    }

    console.log(`🔍 Ollama: Message content: "${message?.content || 'NO CONTENT'}"`);
    console.log(`🔍 Ollama: Message tool_calls:`, message?.tool_calls);

    // Handle native tool calls if present
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`🔧 Ollama native response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);

      // Convert tool calls to expected format
      const formattedToolCalls = message.tool_calls.map((tc: any) => ({
        id: tc.id || `call_${Date.now()}`,
        function: {
          name: tc.function.name,
          arguments: JSON.stringify(tc.function.arguments) || '{}'
        }
      }));

      // Execute tool calls and make follow-up call
      return this.executeNativeToolCalls(
        formattedToolCalls,
        message.content || '',
        data.total_duration ? {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        } : undefined,
        settings,
        { id: 'ollama', name: 'Ollama' } as LLMProvider,
        conversationHistory,
        () => {} // No-op for non-stream
      );
    }

    return {
      content: message.content || '',
      usage: data.total_duration ? {
        promptTokens: data.prompt_eval_count || 0,
        completionTokens: data.eval_count || 0,
        totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
      } : undefined,
      toolCalls: []
    };
  }

  private async executeNativeToolCalls(
    toolCalls: Array<{ id: string; function: { name: string; arguments: string } }>,
    originalContent: string,
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    console.log(`🔧 Ollama executing ${toolCalls.length} native tool calls`);

    // Check if we have parallel execution method injected (like Anthropic/Mistral)
    if ((this as any).executeMultipleToolsParallel && (this as any).summarizeToolResultsForModel) {
      console.log(`🚀 Using parallel execution for ${toolCalls.length} Ollama tools`);
      
      // Format tool calls for parallel execution
      const toolCallsForExecution = toolCalls.map(tc => {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments);
        } catch (parseError) {
          console.warn(`⚠️ Failed to parse tool arguments: ${tc.function.arguments}`, parseError);
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
        const executeMultipleToolsParallel = (this as any).executeMultipleToolsParallel;
        const summarizeToolResultsForModel = (this as any).summarizeToolResultsForModel;
        
        const parallelResults = await executeMultipleToolsParallel(toolCallsForExecution, 'ollama');
        console.log(`✅ Ollama parallel execution completed: ${parallelResults.filter((r: any) => r.success).length}/${parallelResults.length} successful`);
        
        // Get tool results summary for the model
        const toolSummary = summarizeToolResultsForModel(parallelResults);
        
        // Stream the tool results to user
        onStream('\n\n' + toolSummary);
        
        // Return response with tool results included
        return {
          content: originalContent + '\n\n' + toolSummary,
          usage: usage ? {
            promptTokens: usage.promptTokens || 0,
            completionTokens: usage.completionTokens || 0,
            totalTokens: usage.totalTokens || 0
          } : undefined,
          toolCalls: toolCallsForExecution
        };
      } catch (error) {
        console.error(`❌ Ollama parallel tool execution failed, falling back to sequential:`, error);
        // Fall back to sequential execution below
      }
    }

    // Fallback: Execute all tool calls sequentially (old method)
    console.log(`⚠️ Using sequential execution for ${toolCalls.length} Ollama tools`);
    const toolResults: Array<{ name: string; result: string; error?: boolean }> = [];

    for (const toolCall of toolCalls) {
      try {
        // Parse arguments safely
        let parsedArgs: Record<string, unknown> = {};
        if (toolCall.function.arguments) {
          try {
            parsedArgs = JSON.parse(toolCall.function.arguments);
          } catch (parseError) {
            console.warn(`⚠️ Failed to parse tool arguments: ${toolCall.function.arguments}`, parseError);
            parsedArgs = {};
          }
        }

        console.log(`🔧 Executing Ollama native tool: ${toolCall.function.name} with args:`, parsedArgs);
        const result = await (this as any).executeMCPTool(toolCall.function.name, parsedArgs);
        console.log(`🔍 Ollama: Tool execution result:`, result);

        toolResults.push({
          name: toolCall.function.name,
          result: result,
          error: false
        });
        console.log(`✅ Ollama native tool ${toolCall.function.name} executed successfully`);
      } catch (error) {
        console.error(`❌ Ollama native tool ${toolCall.function.name} failed:`, error);
        const userFriendlyError = (this as any).formatToolError ? (this as any).formatToolError(toolCall.function.name, error) : String(error);
        toolResults.push({
          name: toolCall.function.name,
          result: userFriendlyError,
          error: true
        });
      }
    }

    // Create follow-up prompt with tool results (simplified approach like LM Studio)
    const toolResultsText = toolResults.map(tr =>
      `Tool: ${tr.name}\nResult: ${tr.result}\n`
    ).join('\n');

    const followUpPrompt = `Based on the tool results below, please provide a helpful response to the user's question.

Tool Results:
${toolResultsText}

Original Question: ${this.getLastUserMessage(conversationHistory)}

Please provide a natural, helpful response based on the tool results.`;

    console.log(`🔄 Ollama making follow-up call with simplified prompt`);

    // Clean conversation history to remove any malformed tool results
    const cleanedHistory = conversationHistory.filter(msg => {
      // Remove messages that contain tool execution errors
      if (typeof msg.content === 'string' && msg.content.includes('Tool Results:') && msg.content.includes('Error:')) {
        console.log(`🧹 Removing malformed tool result message from history`);
        return false;
      }
      return true;
    });

    // Make follow-up call with simplified message format
    const followUpMessages = [
      ...cleanedHistory,
      { role: 'user', content: followUpPrompt }
    ];

    // Make a direct API call without tool calling for the follow-up
    const followUpResponse = await this.makeDirectFollowUpCall(
      followUpMessages,
      settings,
      onStream
    );

    // Create tool execution content for UI display (like LM Studio)
    const toolExecutionContent = `<tool_execution>
${toolResults.map(tr => {
  const status = tr.error ? 'failed' : 'success';
  return `Tool: ${tr.name}
Status: ${status}
Result: ${tr.result}`;
}).join('\n\n')}
</tool_execution>`;

    // Combine tool execution content with the final response
    const finalContent = toolExecutionContent + '\n\n' + (followUpResponse.content || '');

    console.log(`🎯 Ollama: Final response with tool execution:`, finalContent);

    return {
      content: finalContent,
      usage: followUpResponse.usage,
      toolCalls: toolCalls.map(tc => {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments);
        } catch (error) {
          console.warn(`⚠️ Failed to parse tool arguments for return: ${tc.function.arguments}`, error);
        }

        return {
          id: tc.id,
          name: tc.function.name,
          arguments: parsedArgs
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
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    const baseUrl = settings.baseUrl || 'http://localhost:11434';
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

    const requestBody = {
      model: settings.model,
      messages: ollamaMessages,
      stream: !!onStream,
      options: {
        temperature: settings.temperature,
        num_predict: settings.maxTokens
      }
      // Note: NO tools parameter for follow-up calls
    };

    console.log(`🔄 Ollama making direct follow-up call without tools to: ${endpoint}`);
    console.log(`🔍 Ollama direct follow-up request body:`, JSON.stringify(requestBody, null, 2));

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

    if (onStream) {
      // Handle streaming follow-up response
      let fullContent = '';
      let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
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
              } catch (error) {
                // Skip empty lines or malformed JSON
                if (line.trim()) {
                  console.warn('Failed to parse follow-up streaming chunk:', error, 'Line:', line);
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      return {
        content: fullContent,
        usage: usage ? {
          promptTokens: usage.promptTokens || 0,
          completionTokens: usage.completionTokens || 0,
          totalTokens: usage.totalTokens || 0
        } : undefined
      };
    } else {
      // Handle non-streaming follow-up response
      const data = await response.json();
      const message = data.message;

      return {
        content: message?.content || '',
        usage: data.total_duration ? {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        } : undefined
      };
    }
  }



  public executeMCPTool: (toolName: string, args: Record<string, unknown>) => Promise<string> = async (toolName: string, args: Record<string, unknown>) => {
    // This will be injected by the main service
    console.error('🚨 Ollama: executeMCPTool called but not injected! This should not happen.');
    console.error('🚨 Ollama: toolName:', toolName, 'args:', args);
    console.error('🚨 Ollama: Method type:', typeof this.executeMCPTool);
    return JSON.stringify({ error: 'Tool execution not available - injection failed' });
  };

  // Legacy text-based tool calling methods (kept for reference but not used)
  private async handleTextBasedToolCalling(
    response: Response,
    onStream: (chunk: string) => void,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>
  ): Promise<LLMResponse> {
    let fullContent = '';
    let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || '';

                if (content) {
                  fullContent += content;
                  onStream(content);
                }

                if (parsed.usage) {
                  usage = {
                    promptTokens: parsed.usage.prompt_tokens,
                    completionTokens: parsed.usage.completion_tokens,
                    totalTokens: parsed.usage.total_tokens
                  };
                }
              } catch (error) {
                console.warn('Failed to parse Ollama stream chunk:', error);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    console.log(`🔍 Ollama response content for tool parsing:`, fullContent);

    // Handle empty responses
    if (!fullContent || fullContent.trim().length === 0) {
      console.warn(`⚠️ Ollama returned empty response. This might indicate:`);
      console.warn(`   - Model failed to generate content`);
      console.warn(`   - Network/connection issues`);
      console.warn(`   - Model overloaded or timeout`);

      return {
        content: "I apologize, but I didn't receive a proper response from the model. This could be due to the model being overloaded or a connection issue. Please try again.",
        usage: usage ? {
          promptTokens: usage.promptTokens || 0,
          completionTokens: usage.completionTokens || 0,
          totalTokens: usage.totalTokens || 0
        } : undefined
      };
    }

    // Remove thinking content before parsing for tool calls
    const contentWithoutThinking = this.removeThinkingContent(fullContent);
    console.log(`🧠 Content after removing thinking tags:`, contentWithoutThinking);

    // Parse the response for tool calls (excluding thinking content)
    const toolCalls = this.parseToolCallsFromText(contentWithoutThinking);

    if (toolCalls.length > 0) {
      console.log(`🔧 Ollama found ${toolCalls.length} tool calls in text response`);
      return this.executeTextBasedTools(toolCalls, fullContent, usage, settings, provider, conversationHistory, onStream);
    }

    // Return the original content (with thinking) for UI display
    // The UI component will handle parsing and displaying thinking content
    return {
      content: fullContent, // Keep original content with thinking for UI
      usage: usage ? {
        promptTokens: usage.promptTokens || 0,
        completionTokens: usage.completionTokens || 0,
        totalTokens: usage.totalTokens || 0
      } : undefined
    };
  }

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

    console.log(`🔍 Ollama parsing text for tools. Available tools:`, availableTools);
    console.log(`🔍 Content to parse:`, content);

    // Pattern 1: Enhanced tool_call format with ```json wrapper (Option 2)
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
          console.log(`✅ Found JSON-wrapped tool call: ${jsonObj.tool_call.name} with args:`, jsonObj.tool_call.arguments);
          return toolCalls; // Return early if we found the structured format
        }
      } catch (error) {
        console.log(`⚠️ Failed to parse JSON-wrapped tool call:`, match[1]);
      }
    }

    // Pattern 2: Direct JSON tool_call format (Option 1) - Enhanced with robust JSON parsing
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
            console.log(`✅ Found direct tool call: ${parsed.tool_call.name} with args:`, parsed.tool_call.arguments);
            return toolCalls; // Return early if we found the structured format
          }
        }
      } catch (error) {
        console.log(`⚠️ Failed to parse direct tool call:`, error);
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
          console.log(`✅ Found JSON block tool call: ${jsonObj.tool_call.name} with args:`, jsonObj.tool_call.arguments);
        }
      } catch (error) {
        console.log(`⚠️ Failed to parse JSON block:`, jsonMatch[1]);
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
        console.log(`✅ Found function call: ${toolName} with args:`, args);
        continue;
      }

      // Pattern 5: JSON-like format with tool name
      const jsonRegex = new RegExp(`["']?${toolName}["']?\\s*[:=]\\s*({[^}]*})`, 'gi');
      match = jsonRegex.exec(content);
      if (match) {
        const args = this.parseArgumentsFromText(match[1]);
        toolCalls.push({ name: toolName, arguments: args });
        console.log(`✅ Found JSON-like call: ${toolName} with args:`, args);
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
              console.log(`✅ Found nearby JSON call: ${toolName} with args:`, args);
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
    } catch (error) {
      console.log(`⚠️ JSON parsing failed for: ${argsText}, trying fallback parsing`);

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

      console.log(`✅ Fallback parsing extracted:`, args);
      return args;
    }
  }

  private availableToolNames: string[] = [];

  // Method to inject actual tool names from MCP service
  setAvailableToolNames(toolNames: string[]): void {
    this.availableToolNames = toolNames;
    console.log(`🔧 Ollama: Updated available tool names:`, toolNames);
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
    originalContent: string,
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    console.log(`🔧 Ollama executing ${toolCalls.length} text-based tool calls`);

    // Execute all tool calls
    const toolResults: Array<{ name: string; result: string; error?: boolean }> = [];

    for (const toolCall of toolCalls) {
      try {
        console.log(`🔧 Executing Ollama tool: ${toolCall.name} with args:`, toolCall.arguments);
        const result = await this.executeMCPTool(toolCall.name, toolCall.arguments);
        toolResults.push({
          name: toolCall.name,
          result: typeof result === 'string' ? result : JSON.stringify(result),
          error: false
        });
        console.log(`✅ Ollama tool ${toolCall.name} executed successfully`);
      } catch (error) {
        console.error(`❌ Ollama tool ${toolCall.name} failed:`, error);
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

    console.log(`🔄 Ollama making follow-up call with tool results`);

    // Clean conversation history to remove any malformed tool results
    const cleanedHistory = conversationHistory.filter(msg => {
      // Remove messages that contain tool execution errors
      if (typeof msg.content === 'string' && msg.content.includes('Tool Results:') && msg.content.includes('Error:')) {
        console.log(`🧹 Removing malformed tool result message from history`);
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
      toolCalls: toolCalls.map((tc, index) => ({
        id: `text_tool_${index}`,
        name: tc.name,
        arguments: tc.arguments
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

  private removeThinkingContent(content: string): string {
    // Remove various thinking patterns from content before parsing for tool calls
    let cleanedContent = content;

    // Remove <think>...</think> blocks
    cleanedContent = cleanedContent.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // Remove <thinking>...</thinking> blocks
    cleanedContent = cleanedContent.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

    // Remove unclosed thinking tags (in case they're at the end)
    cleanedContent = cleanedContent.replace(/<think>[\s\S]*$/gi, '');
    cleanedContent = cleanedContent.replace(/<thinking>[\s\S]*$/gi, '');

    // Clean up any extra whitespace
    cleanedContent = cleanedContent.trim();

    return cleanedContent;
  }

  private async handleNonStreamResponse(
    response: Response,
    settings: LLMSettings,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    conversationId?: string
  ): Promise<LLMResponse> {
    const data = await response.json();
    console.log(`🔍 Ollama raw response:`, JSON.stringify(data, null, 2));
    const message = data.choices[0].message;

    // Handle tool calls if present
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`🔧 Ollama response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);

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

  private hasThinkingContent(content: string): boolean {
    // Check for various thinking patterns
    const thinkingPatterns = [
      /<think>/i,
      /<thinking>/i,
      /\*\*thinking\*\*/i,
      /\*thinking\*/i,
      /thinking:/i,
      /let me think/i,
      /i need to think/i,
      /first, let me/i,
      /step by step/i
    ];

    return thinkingPatterns.some(pattern => pattern.test(content));
  }

  private isThinkingComplete(content: string): boolean {
    // Check if thinking tags are properly closed
    const hasOpenThink = /<think>/i.test(content);
    const hasCloseThink = /<\/think>/i.test(content);

    const hasOpenThinking = /<thinking>/i.test(content);
    const hasCloseThinking = /<\/thinking>/i.test(content);

    // If we have opening tags, we need closing tags
    if (hasOpenThink && !hasCloseThink) return false;
    if (hasOpenThinking && !hasCloseThinking) return false;

    // Check for incomplete reasoning patterns
    const incompletePatterns = [
      /thinking\.\.\.$/i,
      /let me think\.\.\.$/i,
      /step \d+:?\s*$/i,
      /first,?\s*$/i,
      /so,?\s*$/i,
      /therefore,?\s*$/i
    ];

    if (incompletePatterns.some(pattern => pattern.test(content.trim()))) {
      return false;
    }

    // If content ends with reasoning indicators, it might be incomplete
    const reasoningEndings = [
      /\.\.\.$/, // ends with ...
      /:\s*$/, // ends with :
      /,\s*$/, // ends with ,
      /-\s*$/, // ends with -
    ];

    if (reasoningEndings.some(pattern => pattern.test(content.trim()))) {
      return false;
    }

    return true;
  }
}
