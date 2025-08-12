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

  readonly capabilities: ProviderCapabilities = {
    supportsVision: true,
    supportsTools: true, // Dynamic: structured tools if supported, text-based fallback
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'adaptive' // Adaptive: structured tools or text-based based on model
  };

  // Check if a specific model supports structured tools
  private async checkModelSupportsStructuredTools(model: string, baseUrl?: string): Promise<boolean> {
    // Check cache first
    const cacheKey = `${model}@${baseUrl || 'default'}`;
    if (OllamaProvider.modelToolSupportCache.has(cacheKey)) {
      const cached = OllamaProvider.modelToolSupportCache.get(cacheKey)!;
      console.log(`🔍 Ollama: Using cached tool support for model "${model}": ${cached}`);
      return cached;
    }

    console.log(`🔍 Ollama: Testing structured tool support for model "${model}" at ${baseUrl || 'http://localhost:11434'}...`);

    // Most Ollama models don't support structured tools yet, so default to text-based
    // This ensures models get tool descriptions in their system prompt
    console.log(`🔍 Ollama: Defaulting to text-based tools for model "${model}" (most reliable approach)`);
    OllamaProvider.modelToolSupportCache.set(cacheKey, false);
    return false;

    // TODO: Re-enable actual testing if needed, but for now this is more reliable
    /*
    // Test with a simple tool call to detect support
    try {
      const ollamaUrl = (baseUrl || 'http://localhost:11434').replace('/v1', '');
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
        console.log(`✅ Ollama: Model "${model}" supports structured tools`);
        OllamaProvider.modelToolSupportCache.set(cacheKey, true);
        return true;
      } else {
        const errorText = await response.text();
        if (errorText.includes('does not support tools')) {
          // Model explicitly doesn't support tools
          console.log(`❌ Ollama: Model "${model}" does not support structured tools`);
          OllamaProvider.modelToolSupportCache.set(cacheKey, false);
          return false;
        } else {
          // Other error - assume no tool support to be safe
          console.log(`⚠️ Ollama: Model "${model}" tool support unknown (error: ${errorText}), assuming no support`);
          OllamaProvider.modelToolSupportCache.set(cacheKey, false);
          return false;
        }
      }
    } catch (error) {
      // Network or other error - assume no tool support to be safe
      console.log(`⚠️ Ollama: Failed to test tool support for model "${model}":`, error);
      OllamaProvider.modelToolSupportCache.set(cacheKey, false);
      return false;
    }
    */
  }

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
      console.log(`📋 Raw tools received (${rawTools.length} tools):`, (rawTools as Array<{name?: string, function?: {name?: string}}>).map(t => t.name || t.function?.name));

      // Format tools specifically for Ollama (uses OpenAI format)
      const formattedTools = this.formatToolsForOllama(rawTools);
      console.log(`🔧 Formatted ${formattedTools.length} tools for Ollama`);

      return formattedTools;
    } catch (error) {
      console.error('❌ Failed to get Ollama tools:', error);
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
      const originalLength = systemPrompt.length;
      systemPrompt = this.enhanceSystemPromptWithTools(systemPrompt, ollamaTools as ToolObject[]);
      const newLength = systemPrompt.length;
      console.log(`🔧 Ollama enhanced system prompt with ${ollamaTools.length} text-based tool descriptions`);
      console.log(`🔧 Ollama system prompt length: ${originalLength} → ${newLength} (+${newLength - originalLength} chars)`);
      console.log(`🔧 Ollama tool names included:`, (ollamaTools as Array<{function?: {name?: string}, name?: string}>).map(t => t.function?.name || t.name).filter(Boolean));
    }

    console.log(`🔍 Ollama system prompt source:`, {
      hasCustom: hasCustomSystemPrompt,
      usingCustom: hasCustomSystemPrompt,
      promptLength: systemPrompt?.length || 0,
      promptStart: systemPrompt?.substring(0, 200) + '...',
      toolsIncluded: ollamaTools.length > 0
    });

    // Debug: Show a sample of the actual system prompt to verify tool descriptions are included
    if (systemPrompt && systemPrompt.length > 1000) {
      const toolSectionStart = systemPrompt.indexOf('Available Tools:');
      if (toolSectionStart !== -1) {
        const toolSection = systemPrompt.substring(toolSectionStart, toolSectionStart + 500);
        console.log(`🔧 Ollama system prompt tool section preview:`, toolSection + '...');
      } else {
        console.warn(`⚠️ Ollama: "Available Tools:" section not found in system prompt!`);
        console.log(`🔧 Ollama system prompt end preview:`, systemPrompt.substring(Math.max(0, systemPrompt.length - 500)));
      }
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

    // Check if model supports structured tools
    const supportsStructuredTools = await this.checkModelSupportsStructuredTools(settings.model, baseUrl);

    if (supportsStructuredTools && ollamaTools.length > 0) {
      console.log(`🚀 Ollama API call with structured tools:`, {
        model: settings.model,
        toolCount: ollamaTools.length,
        note: 'Model supports structured tools - using tools parameter'
      });
    } else {
      console.log(`🚀 Ollama API call with text-based tools:`, {
        model: settings.model,
        toolDescriptionsInSystemPrompt: ollamaTools.length > 0,
        toolCount: ollamaTools.length,
        note: 'Model does not support structured tools - using text descriptions in system prompt'
      });
    }

    // Use Ollama's native /api/chat endpoint (not OpenAI-compatible)
    const ollamaUrl = baseUrl.replace('/v1', '');
    const endpoint = `${ollamaUrl}/api/chat`;
    console.log(`🔍 Ollama: Using native API URL: ${endpoint}`);

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

    // Debug: Show what's actually being sent to Ollama
    console.log(`🔍 Ollama request debug:`, {
      model: ollamaRequestBody.model,
      messageCount: (ollamaRequestBody.messages as unknown[]).length,
      hasStructuredTools: 'tools' in ollamaRequestBody,
      structuredToolCount: supportsStructuredTools && ollamaTools.length > 0 ? ollamaTools.length : 0,
      systemMessageLength: ((ollamaRequestBody.messages as Array<{role: string, content: string}>).find(m => m.role === 'system')?.content?.length || 0),
      systemMessagePreview: ((ollamaRequestBody.messages as Array<{role: string, content: string}>).find(m => m.role === 'system')?.content?.substring(0, 200) || '') + '...'
    });

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

      // Handle model not found error specifically
      if (response.status === 404 && error.includes('not found')) {
        try {
          // Try to get available models to suggest alternatives
          const availableModels = await this.fetchModels('', baseUrl);
          const modelSuggestions = availableModels.length > 0
            ? `\n\nAvailable models: ${availableModels.slice(0, 5).join(', ')}${availableModels.length > 5 ? '...' : ''}`
            : '\n\nNo models found. Please install models using: ollama pull <model-name>';

          throw new Error(`Model "${settings.model}" not found in Ollama.${modelSuggestions}\n\nTo install this model, run: ollama pull ${settings.model}`);
        } catch (fetchError) {
          // If we can't fetch models, just show the basic error
          throw new Error(`Model "${settings.model}" not found in Ollama. Please install it using: ollama pull ${settings.model}`);
        }
      }

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
        const errorText = await response.text();
        console.error(`❌ Ollama API error: ${response.status}`, errorText);
        throw new Error(`Failed to connect to Ollama at ${ollamaUrl}. Status: ${response.status} - ${errorText}. Make sure Ollama is running and accessible.`);
      }

      const data = await response.json() as { models?: Array<{ name: string }> };
      const models = data.models?.map((model) => model.name)?.sort() || [];

      if (models.length === 0) {
        throw new Error(`No models found in Ollama at ${ollamaUrl}. Please install some models using 'ollama pull <model-name>'.`);
      }

      return models;
    } catch (error) {
      console.error('❌ Failed to fetch Ollama models:', error);
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
    console.log(`🔍 Ollama: Assuming tool support for model: "${modelName}" (user can name models anything)`);

    // ALWAYS return true - let the API determine if tools are supported
    // Users can name their models anything in Ollama, so name-based detection is unreliable
    // If a model doesn't support tools, the API will simply ignore the tools parameter
    return true;
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
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    // Use native Ollama tool calling - similar to OpenAI provider
    let fullContent = '';
    let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;
    const toolCalls: Array<{ id: string; function: { name: string; arguments: string } }> = [];
    let chunkCount = 0;
    let streamingComplete = false;

    console.log('🔍 Ollama: Starting to process streaming response...');
    console.log('🔍 Ollama: IMPORTANT - Tool execution will only happen AFTER streaming is complete');

    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            streamingComplete = true;
            console.log(`🔍 Ollama: Stream ended. Total chunks processed: ${chunkCount}`);
            console.log(`🔍 Ollama: Streaming is now COMPLETE - ready for tool processing`);
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

    // IMPORTANT: Verify streaming is complete before tool execution
    if (!streamingComplete) {
      console.error(`❌ Ollama: CRITICAL ERROR - Attempting tool execution before streaming is complete!`);
      throw new Error('Tool execution attempted before streaming completion');
    }

    console.log(`✅ Ollama: Streaming is CONFIRMED COMPLETE. Processing tool calls...`);
    console.log(`🔍 Ollama: Final content length: ${fullContent.length} characters`);
    console.log(`🔍 Ollama: Total chunks processed: ${chunkCount}`);

    // If we have tool calls, execute them and make a follow-up call
    if (toolCalls.length > 0) {
      console.log(`🔧 Ollama found ${toolCalls.length} native tool calls AFTER streaming completed`);
      console.log(`🔧 Ollama tool calls:`, toolCalls);

      // Stream any initial content first
      if (fullContent && typeof onStream === 'function') {
        console.log(`🔄 Ollama: All content already streamed during response. Content: "${fullContent.substring(0, 200)}..."`);
        // Content was already streamed during parsing, no need to stream again
      }

      console.log(`🚀 Ollama: Now executing tools AFTER complete streaming...`);
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

  /* eslint-disable @typescript-eslint/no-unused-vars */
  private async handleNativeNonStreamResponse(
    response: Response,
    settings: LLMSettings,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    conversationId?: string
  ): Promise<LLMResponse> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
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
      const formattedToolCalls = message.tool_calls.map((tc: {id?: string, function: {name: string, arguments: string}}) => ({
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
    if ((this as unknown as {executeMultipleToolsParallel?: unknown, summarizeToolResultsForModel?: unknown}).executeMultipleToolsParallel && (this as unknown as {executeMultipleToolsParallel?: unknown, summarizeToolResultsForModel?: unknown}).summarizeToolResultsForModel) {
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
        const executeMultipleToolsParallel = (this as unknown as {executeMultipleToolsParallel: unknown}).executeMultipleToolsParallel;
        const summarizeToolResultsForModel = (this as unknown as {summarizeToolResultsForModel: unknown}).summarizeToolResultsForModel;

        const parallelResults = await (executeMultipleToolsParallel as (calls: unknown[], provider: string) => Promise<Array<{success: boolean}>>)(toolCallsForExecution, 'ollama');
        console.log(`✅ Ollama parallel execution completed: ${parallelResults.filter(r => r.success).length}/${parallelResults.length} successful`);
        
        // Get tool results summary for the model
        const toolSummary = (summarizeToolResultsForModel as (results: unknown[]) => string)(parallelResults);

        // Stream the tool results to user
        onStream('\n\n' + toolSummary);

        // Make follow-up call to get model's response based on tool results
        console.log(`🔄 Making Ollama follow-up call to process tool results...`);

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
          const combinedContent = originalContent + '\n\n' + toolSummary + '\n\n' + followUpResponse.content;

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
        } catch (followUpError) {
          console.error(`❌ Ollama follow-up call failed:`, followUpError);
          // Fall back to returning tool summary only
          return {
            content: originalContent + '\n\n' + toolSummary,
            usage: usage ? {
              promptTokens: usage.promptTokens || 0,
              completionTokens: usage.completionTokens || 0,
              totalTokens: usage.totalTokens || 0
            } : undefined,
            toolCalls: toolCallsForExecution
          };
        }
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
        const result = await (this as unknown as {executeMCPTool: (name: string, args: unknown) => Promise<string>}).executeMCPTool(toolCall.function.name, parsedArgs);
        console.log(`🔍 Ollama: Tool execution result:`, result);

        toolResults.push({
          name: toolCall.function.name,
          result: result,
          error: false
        });
        console.log(`✅ Ollama native tool ${toolCall.function.name} executed successfully`);
      } catch (error) {
        console.error(`❌ Ollama native tool ${toolCall.function.name} failed:`, error);
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

    // Make a follow-up call with tools enabled for agentic behavior
    const followUpResponse = await this.makeDirectFollowUpCall(
      followUpMessages,
      settings,
      onStream,
      true // Enable tools for continued agentic behavior
    );

    // According to OpenAI/LM Studio docs, we should return ONLY the final assistant response
    // Tool execution details are handled by the UI separately via toolCalls
    console.log(`🎯 Ollama: Final response (clean):`, followUpResponse.content);

    return {
      content: followUpResponse.content || '',
      usage: followUpResponse.usage,
      toolCalls: toolCalls.map(tc => {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(tc.function.arguments);
        } catch (error) {
          console.warn(`⚠️ Failed to parse tool arguments for return: ${tc.function.arguments}`, error);
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
    enableTools: boolean = true
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

    // Get tools for text-based descriptions (Ollama doesn't support structured tools)
    let tools: unknown[] = [];
    if (enableTools && this.getMCPToolsForProvider) {
      try {
        tools = await this.getMCPToolsForProvider('ollama', settings);
        console.log(`🔧 Ollama follow-up call with ${tools.length} text-based tools for continued agentic behavior`);
        console.log(`🔧 Ollama follow-up: Tools will be included in system prompt, NOT as structured tools parameter`);
      } catch (error) {
        console.warn(`⚠️ Failed to get tools for Ollama follow-up call:`, error);
      }
    }

    // Update system message with optimized prompt if tools are available
    if (enableTools && tools.length > 0) {
      // Use condensed prompt for follow-up calls to avoid token limits
      const toolNames = (tools as Array<{function?: {name?: string}, name?: string}>).map(tool => tool.function?.name || tool.name).filter(Boolean);
      const followUpPrompt = `You are an AI assistant with access to ${tools.length} tools. Based on the tool results provided, continue the conversation naturally. Use additional tools if needed.

Available tools: ${toolNames.join(', ')}

Use structured JSON for tool calls:
\`\`\`json
{"tool_call": {"name": "tool_name", "arguments": {"param": "value"}}}
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
      stream: !!onStream,
      options: {
        temperature: settings.temperature,
        num_predict: settings.maxTokens
      },
      // Include structured tools only if model supports them
      ...(supportsStructuredTools && enableTools && tools.length > 0 && { tools })
    };

    console.log(`🔧 Ollama follow-up call using ${supportsStructuredTools ? 'structured' : 'text-based'} tools`);
    if (supportsStructuredTools && tools.length > 0) {
      console.log(`🔧 Ollama follow-up: Including ${tools.length} structured tools in request`);
    } else if (tools.length > 0) {
      console.log(`🔧 Ollama follow-up: Tools included as text descriptions in system prompt`);
    }

    console.log(`🔄 Ollama making follow-up call ${enableTools ? 'with' : 'without'} tools to: ${endpoint}`);
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

      // Check for additional tool calls in the follow-up response (agentic behavior)
      if (enableTools && fullContent) {
        const toolCalls = this.parseToolCallsFromText(fullContent);
        if (toolCalls.length > 0) {
          console.log(`🔄 Ollama follow-up response contains ${toolCalls.length} additional tool calls - continuing agentic workflow`);
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

      // Check for additional tool calls in the follow-up response (agentic behavior)
      const content = message?.content || '';
      if (enableTools && content) {
        const toolCalls = this.parseToolCallsFromText(content);
        if (toolCalls.length > 0) {
          console.log(`🔄 Ollama follow-up response contains ${toolCalls.length} additional tool calls - continuing agentic workflow`);
          // Recursively execute additional tool calls
          return this.executeTextBasedTools(
            toolCalls,
            content,
            data.total_duration ? {
              promptTokens: data.prompt_eval_count || 0,
              completionTokens: data.eval_count || 0,
              totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
            } : undefined,
            settings,
            { id: 'ollama', name: 'Ollama' } as LLMProvider,
            messages,
            onStream
          );
        }
      }

      return {
        content: content,
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
        // eslint-disable-next-line no-constant-condition
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
    console.log(`🔍 Content length:`, content.length);

    // Pattern 0: XML-style tool tags as instructed in the Ollama system prompt
    // Example:
    // <web_search>
    //   <query>current weather</query>
    // </web_search>
    try {
      const xmlTagRegex = /<([a-zA-Z_][\w-]*)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      let xmlMatch: RegExpExecArray | null;

      console.log(`🔍 Testing XML regex against content...`);
      console.log(`🔍 Regex pattern: ${xmlTagRegex.source}`);

      // Test with the exact example
      const testContent = '<web_search>\n<query>current weather in Athens, Greece</query>\n</web_search>';
      const testRegex = /<([a-zA-Z_][\w-]*)\b[^>]*>([\s\S]*?)<\/\1>/gi;
      const testMatch = testRegex.exec(testContent);
      console.log(`🔍 Test match result:`, testMatch);

      while ((xmlMatch = xmlTagRegex.exec(content)) !== null) {
        const rawToolName = xmlMatch[1];
        const inner = (xmlMatch[2] || '').trim();

        console.log(`🔍 Found XML tag: ${rawToolName}, inner: ${inner}`);

        // Only handle tags that correspond to available tools; ignore others (e.g., <switch_mode>)
        if (!availableTools.includes(rawToolName)) {
          console.log(`⚠️ Tool ${rawToolName} not in available tools list:`, availableTools);
          continue;
        }

        console.log(`✅ Tool ${rawToolName} is available, processing...`);

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

      if (toolCalls.length === 0) {
        console.log(`🔍 No XML tool calls found in content`);
      }
    } catch (e) {
      console.log('⚠️ XML-style parsing failed:', e);
    }

    if (toolCalls.length > 0) {
      console.log(`✅ Found ${toolCalls.length} XML-style tool calls, returning them`);
      const uniqueXmlCalls = this.deduplicateToolCalls ? this.deduplicateToolCalls(toolCalls) : toolCalls;
      return uniqueXmlCalls;
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
          console.log(`✅ Found nested function format tool call: ${rawToolName} -> ${toolName} with args:`, args);
        } else {
          console.log(`⚠️ Nested function tool name "${rawToolName}" (mapped to "${toolName}") not in available tools:`, availableTools);
        }
      } catch (error) {
        console.log(`⚠️ Failed to parse nested function format tool call:`, nestedMatch[0], error);
      }
    }

    // If we found nested function calls, return them immediately
    if (toolCalls.length > 0) {
      console.log(`✅ Found ${toolCalls.length} nested function format tool calls, returning them`);
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
              console.log(`🔧 Fixed malformed empty JSON: ${jsonArgs} -> ${cleanJsonArgs}`);
            }

            const args = JSON.parse(cleanJsonArgs);
            toolCalls.push({ name: rawToolName, arguments: args });
            console.log(`✅ Found valid tool call: ${rawToolName} with args:`, args);
          } catch (error) {
            console.log(`⚠️ Failed to parse JSON arguments for ${rawToolName}:`, jsonArgs, error);
          }
        } else {
          console.log(`⚠️ Tool "${rawToolName}" not found. Available tools:`, availableTools.slice(0, 10), '...');
          // Return an error response that the LLM can see and correct
          return [{
            name: 'error_response',
            arguments: {
              error: `Tool "${rawToolName}" does not exist. Available tools include: ${availableTools.slice(0, 10).join(', ')}, and ${availableTools.length - 10} more. Please use an exact tool name from the available list.`
            }
          }];
        }
      } catch (error) {
        console.log(`⚠️ Failed to parse new model format tool call:`, newModelMatch[0], error);
      }
    }

    // If we found any new model format tool calls, return them
    if (toolCalls.length > 0) {
      console.log(`✅ Found ${toolCalls.length} new model format tool calls, returning them`);
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
          console.log(`✅ Found JSON-wrapped tool call: ${jsonObj.tool_call.name} with args:`, jsonObj.tool_call.arguments);
          return toolCalls; // Return early if we found the structured format
        }
      } catch {
        console.log(`⚠️ Failed to parse JSON-wrapped tool call:`, match[1]);
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
      } catch {
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
    } catch {
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

  private deduplicateToolCalls(toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>): Array<{ name: string; arguments: Record<string, unknown> }> {
    const seen = new Set<string>();
    const unique: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    for (const toolCall of toolCalls) {
      const key = `${toolCall.name}:${JSON.stringify(toolCall.arguments)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(toolCall);
      } else {
        console.log(`🔧 Removed duplicate tool call: ${toolCall.name}`);
      }
    }

    return unique;
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

    // STEP 1: STOP all streaming and execute tools completely
    console.log(`🛑 Ollama: Stopping stream to execute tools cleanly`);

    // Show tool execution start (this is the ONLY streaming during tool execution)
    const toolExecutionHeader = `\n\n<tool_execution>\n🔧 **Tool Execution Started**\n\nExecuting ${toolCalls.length} tool${toolCalls.length !== 1 ? 's' : ''}:\n${toolCalls.map(tc => `- ${tc.name}`).join('\n')}\n</tool_execution>\n\n`;
    onStream(toolExecutionHeader);

    // STEP 2: Execute ALL tools to completion WITHOUT streaming
    console.log(`🔧 Ollama: Executing ${toolCalls.length} tools to completion...`);
    const toolResults: Array<{ name: string; result: string; error?: boolean }> = [];

    for (const toolCall of toolCalls) {
      try {
        console.log(`🔧 Executing Ollama tool: ${toolCall.name} with args:`, toolCall.arguments);

        const result = await this.executeMCPTool(toolCall.name, toolCall.arguments);
        const resultString = typeof result === 'string' ? result : JSON.stringify(result);

        toolResults.push({
          name: toolCall.name,
          result: resultString,
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

  private removeThinkingContent(content: string): string {
    // Remove various thinking patterns and model template tags from content before parsing for tool calls
    let cleanedContent = content;

    // Remove <think>...</think> blocks
    cleanedContent = cleanedContent.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // Remove <thinking>...</thinking> blocks
    cleanedContent = cleanedContent.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

    // Remove unclosed thinking tags (in case they're at the end)
    cleanedContent = cleanedContent.replace(/<think>[\s\S]*$/gi, '');
    cleanedContent = cleanedContent.replace(/<thinking>[\s\S]*$/gi, '');

    // Remove model-specific template tags
    // New model format tags: <|start|>, <|message|>, <|channel|>, <|end|>, <|constrain|>
    cleanedContent = cleanedContent.replace(/<\|start\|>/gi, '');
    cleanedContent = cleanedContent.replace(/<\|message\|>/gi, '');
    cleanedContent = cleanedContent.replace(/<\|channel\|>/gi, '');
    cleanedContent = cleanedContent.replace(/<\|end\|>/gi, '');
    cleanedContent = cleanedContent.replace(/<\|constrain\|>/gi, '');

    // Qwen3 format tags: <|im_start|>, <|im_end|>
    cleanedContent = cleanedContent.replace(/<\|im_start\|>/gi, '');
    cleanedContent = cleanedContent.replace(/<\|im_end\|>/gi, '');

    // Remove role indicators that might appear after template tags
    cleanedContent = cleanedContent.replace(/^(system|user|assistant)\s*/gim, '');

    // Remove channel indicators that might appear after <|channel|> tags
    cleanedContent = cleanedContent.replace(/^(final|analysis|commentary)\s*/gim, '');

    // Clean up any remaining template-like patterns
    cleanedContent = cleanedContent.replace(/<\|[^|]*\|>/gi, '');

    // Clean up any extra whitespace
    cleanedContent = cleanedContent.trim();

    return cleanedContent;
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
