// Llama.cpp provider implementation with llama-swap integration

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

// import { LLAMACPP_SYSTEM_PROMPT } from './prompts/llamacpp';

const LLAMACPP_SYSTEM_PROMPT = `You are a helpful AI assistant powered by Llama.cpp. You have access to various tools and capabilities to help users with their requests.

Key capabilities:
- Answer questions and provide information
- Help with coding, writing, and analysis tasks
- Execute tools when needed to gather information or perform actions
- Provide clear, accurate, and helpful responses

When using tools:
- Use tools when you need to gather external information or perform specific actions
- Format tool calls exactly as specified in the tool documentation
- Wait for tool results before providing your final response
- Incorporate tool results naturally into your response

Guidelines:
- Be helpful, accurate, and concise
- Ask for clarification if a request is unclear
- Explain your reasoning when appropriate
- Acknowledge limitations when you encounter them
- Provide step-by-step guidance for complex tasks

You are running locally through Llama.cpp, which provides fast and efficient inference while maintaining privacy and control.`;
import { OpenAICompatibleStreaming } from './shared/OpenAICompatibleStreaming';
import { llamaCppPerformanceMonitor } from '../llamaCppPerformanceMonitor';
import { llamaCppModelCache } from '../llamaCppModelCache';

export class LlamaCppProvider extends BaseProvider {
  readonly id = 'llamacpp';
  readonly name = 'Llama.cpp';
  readonly capabilities: ProviderCapabilities = {
    supportsVision: true,
    supportsTools: true, // Text-based tool descriptions in system prompt
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsPromptCaching: false,
    maxToolNameLength: undefined,
    toolFormat: 'text' // Text-based tool descriptions in system prompt
  };

  // This method is injected by the ProviderAdapter from the LLMService
  private getMCPToolsForProvider!: (providerId: string, settings: LLMSettings) => Promise<unknown[]>;

  // Model switching state
  private currentModel: string | null = null;

  async sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    // Start performance monitoring
    const requestId = Math.random().toString(36).substring(2, 11);
    llamaCppPerformanceMonitor.startRequest(requestId);

    // Handle model switching if needed
    const targetModel = settings.model || 'default';
    console.log(`🔍 Llama.cpp: Target model: ${targetModel}, Current model: ${this.currentModel}`);

    // Normalize model ID for server compatibility
    const normalizedModel = this.normalizeModelId(targetModel);
    console.log(`🔍 Llama.cpp: Original model: ${targetModel}, Normalized: ${normalizedModel}`);

    if (this.currentModel !== targetModel) {
      console.log(`🔄 Llama.cpp: Switching from ${this.currentModel} to ${targetModel}`);

      try {
        // Try to load the model on the server first
        await this.ensureModelLoaded(targetModel);

        const switchResult = await llamaCppModelCache.switchToModel(targetModel);

        if (!switchResult.success) {
          llamaCppPerformanceMonitor.completeRequest(requestId, 'Model switch failed');
          console.error(`❌ Llama.cpp: Model switch failed for ${targetModel}`);
          throw new Error(`Failed to switch to model ${targetModel}. Model may not be available.`);
        }

        this.currentModel = targetModel;
        console.log(`✅ Llama.cpp: Model switch completed in ${switchResult.switchTime}ms (from cache: ${switchResult.fromCache})`);
      } catch (switchError) {
        console.error(`❌ Llama.cpp: Model switch error for ${targetModel}:`, switchError);
        llamaCppPerformanceMonitor.completeRequest(requestId, 'Model switch failed');
        throw new Error(`Failed to switch to model ${targetModel}. Please check if the model exists and the server is running.`);
      }
    }

    // Update model configuration for monitoring
    llamaCppPerformanceMonitor.updateModelConfig(
      targetModel,
      4096, // Default context size - could be extracted from settings
      512   // Default batch size - could be extracted from settings
    );
    // Llama.cpp uses OpenAI-compatible API through llama-swap proxy
    // Default to llama-swap proxy URL
    let baseUrl = settings.baseUrl || provider.baseUrl || 'http://127.0.0.1:8080/v1';
    
    // Ensure we have /v1 suffix for OpenAI compatibility
    if (!baseUrl.endsWith('/v1')) {
      baseUrl = baseUrl.replace(/\/$/, '') + '/v1';
    }

    const messages = [];

    // Determine if tools are needed based on query content
    const needsTools = this.shouldIncludeTools(message, conversationHistory);
    console.log(`🤔 Llama.cpp: Query analysis - Tools needed: ${needsTools}`);

    // Get system prompt - don't add tool descriptions for native tool calling
    let systemPrompt = settings.systemPrompt || this.getSystemPrompt();

    // Add system message (will be updated with tools if needed)
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // Add conversation history
    for (const historyItem of conversationHistory) {
      messages.push({
        role: historyItem.role,
        content: historyItem.content
      });
    }

    // Add current message
    if (typeof message === 'string') {
      messages.push({
        role: 'user',
        content: message
      });
    } else if (Array.isArray(message)) {
      // Handle ContentItem array
      const textContent = message
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join('\n');
      messages.push({
        role: 'user',
        content: textContent
      });
    } else if (message && typeof message === 'object' && 'text' in message) {
      // Handle { text: string; images: string[] } format
      messages.push({
        role: 'user',
        content: message.text
      });
    }

    // Ensure messages have string content for jinja compatibility
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string' ? msg.content :
               Array.isArray(msg.content) ? msg.content.map(item =>
                 typeof item === 'string' ? item : item.text || ''
               ).join('') : String(msg.content || '')
    }));

    const requestBody: Record<string, unknown> = {
      model: normalizedModel,
      messages: formattedMessages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };

    // Add tools if tool calling is enabled
    if (needsTools && settings.toolCallingEnabled) {
      try {
        const tools = await this.getMCPToolsForProvider(this.id, settings);
        if (tools.length > 0) {
          const formattedTools = tools.filter((tool: any) => {
            const hasName = tool.function?.name || tool.name;
            const hasDescription = tool.function?.description || tool.description;
            return hasName && hasDescription;
          }).map((tool: any) => {
            return {
              type: 'function',
              function: {
                name: tool.function?.name || tool.name,
                description: tool.function?.description || tool.description,
                parameters: tool.function?.parameters || tool.inputSchema || tool.parameters || {
                  type: 'object',
                  properties: {},
                  required: []
                }
              }
            };
          });

          if (formattedTools.length > 0) {
            // Send tools in OpenAI-compatible format (requires --jinja flag)
            requestBody.tools = formattedTools;
            requestBody.tool_choice = 'auto';
          }
        }
      } catch (error) {
        // If tools fail, continue without them rather than failing the entire request
      }
    }

    console.log(`🔍 Llama.cpp: Sending request to ${baseUrl}/chat/completions`);
    console.log(`🔍 Llama.cpp: Request body:`, JSON.stringify(requestBody, null, 2));

    // Validate request body before sending
    if (!requestBody.messages || !Array.isArray(requestBody.messages) || requestBody.messages.length === 0) {
      throw new Error('Invalid request: messages array is required and cannot be empty');
    }

    // Check if tools are properly formatted
    if (requestBody.tools && Array.isArray(requestBody.tools)) {
      console.log(`🔍 Llama.cpp: Sending ${requestBody.tools.length} tools`);
      for (const tool of requestBody.tools) {
        if (!tool.function?.name) {
          console.warn(`🚨 Llama.cpp: Invalid tool detected - missing function.name:`, tool);
        }
      }
    }

    // Check if model is loaded before sending request
    await this.waitForModelToLoad(baseUrl, signal);

    try {
      // Build headers - don't include Authorization for local llama.cpp server
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Only add Authorization if an API key is explicitly provided
      if (settings.apiKey && settings.apiKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${settings.apiKey}`;
      }

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Llama.cpp API error (${response.status}):`, errorText);

        // Handle specific model not found errors
        if (response.status === 400 && errorText.includes('could not find real modelID')) {
          const modelName = settings.model;
          throw new Error(`Model "${modelName}" not found on direct llama.cpp server. Please check:\n1. The model file exists in your models directory\n2. The direct llama.cpp server is running\n3. Try selecting the model again to restart the server`);
        }

        // Handle model loading status with retry
        if (response.status === 503 && errorText.includes('Loading model')) {
          // Wait a moment and retry once
          await new Promise(resolve => setTimeout(resolve, 2000));

          const retryResponse = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal
          });

          if (retryResponse.ok) {
            // Retry succeeded, continue with the retry response
            return onStream ?
              this.handleStreamResponse(retryResponse, onStream, settings, provider, messages) :
              this.handleNonStreamResponse(retryResponse, settings, provider, messages);
          } else {
            throw new Error(`Model is still loading. Please wait a moment and try again.`);
          }
        }

        // Handle tool calling errors
        if (response.status === 400 && requestBody.tools) {
          if (errorText.includes('tools') || errorText.includes('Unsupported param')) {
            throw new Error(`Tool calling failed. Ensure the llama.cpp server was started with the --jinja flag and the 'Jinja Templates' option is enabled in model parameters.`);
          }
        }

        // Handle server connection errors
        if (response.status === 502) {
          throw new Error(`Direct llama.cpp server connection failed. The server may have crashed or exited. Please try selecting the model again to restart the server.`);
        }

        throw new Error(`Llama.cpp API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      if (onStream) {
        return this.handleStreamResponse(response, onStream, settings, provider, conversationHistory, signal, requestId);
      } else {
        return this.handleNonStreamResponse(response, settings, provider, conversationHistory, requestId);
      }
    } catch (error) {
      console.error('🚨 Llama.cpp: Request failed:', error);
      llamaCppPerformanceMonitor.completeRequest(requestId, error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  async fetchModels(apiKey: string, baseUrl?: string): Promise<string[]> {
    try {
      // Import llamaCppService dynamically to avoid circular dependencies
      const { llamaCppService } = await import('../llamaCppService');

      console.log('🔍 Llama.cpp: Fetching local models from file system...');

      // Get local models from file system first
      const localModels = await llamaCppService.getModels();
      console.log(`📁 Llama.cpp: Found ${localModels.length} local models`);

      if (localModels.length === 0) {
        console.log('📭 Llama.cpp: No local models found');
        return [];
      }

      // Check if direct server is running
      const isServerRunning = await llamaCppService.isDirectServerRunning();
      console.log(`🔍 Llama.cpp: Direct server running: ${isServerRunning}`);

      if (!isServerRunning) {
        console.log('🚀 Llama.cpp: Direct server not running - models will be available when server starts...');
        // Note: Direct server requires a specific model to start, so we can't auto-start here
        // Return local models for now
        return localModels.map(model => model.id);
      }

      // Try to fetch models from the running server to verify it's working
      try {
        const url = baseUrl || 'http://127.0.0.1:8080/v1';
        const modelsUrl = url.endsWith('/v1') ? `${url}/models` : `${url}/v1/models`;

        console.log(`🔍 Llama.cpp: Verifying server at ${modelsUrl}`);

        // Use AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(modelsUrl, {
          headers: {
            'Authorization': `Bearer ${apiKey || 'no-key'}`
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const serverModels = data.data?.map((model: { id: string }) => model.id) || [];
          console.log(`✅ Llama.cpp: Server verified with ${serverModels.length} models`);

          // Return server models if available, otherwise local models
          const finalModels = serverModels.length > 0 ? serverModels : localModels.map(model => model.id);
          console.log('✅ Llama.cpp: Final models to return:', finalModels);
          return finalModels;
        } else {
          console.warn(`⚠️ Llama.cpp: Server not responding properly: ${response.status}`);
        }
      } catch (serverError) {
        console.warn('⚠️ Llama.cpp: Server verification failed:', serverError);
      }

      // Fallback to local models
      console.log('📁 Llama.cpp: Using local models as fallback');
      const modelIds = localModels.map(model => model.id);
      console.log('📁 Llama.cpp: Returning model IDs:', modelIds);
      return modelIds;

    } catch (error) {
      console.error('🚨 Llama.cpp: Error fetching models:', error);
      return [];
    }
  }

  formatTools(tools: ToolObject[]): unknown[] {
    // Llama.cpp uses text-based tool descriptions in system prompt
    return tools;
  }

  validateToolCall(toolCall: { id?: string; name: string; arguments: Record<string, unknown> }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!toolCall.name || typeof toolCall.name !== 'string') {
      errors.push('Tool call must have a valid name');
    }

    if (!toolCall.arguments || typeof toolCall.arguments !== 'object') {
      errors.push('Tool call must have valid arguments object');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateTool(tool: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!tool || typeof tool !== 'object') {
      errors.push('Tool must be an object');
      return { valid: false, errors };
    }

    const toolObj = tool as { name?: string; description?: string; parameters?: unknown };
    
    if (!toolObj.name || typeof toolObj.name !== 'string') {
      errors.push('Tool must have a valid name');
    }

    if (!toolObj.description || typeof toolObj.description !== 'string') {
      errors.push('Tool must have a valid description');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  getSystemPrompt(): string {
    return LLAMACPP_SYSTEM_PROMPT;
  }

  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string {
    if (!tools || tools.length === 0) {
      return basePrompt;
    }

    const toolDescriptions = tools.map(tool => {
      const toolParams = tool.parameters as { properties?: Record<string, { description?: string }> } | undefined;
      const params = toolParams?.properties ?
        Object.entries(toolParams.properties).map(([name, prop]) => {
          return `  - ${name}: ${prop.description || 'No description'}`;
        }).join('\n') : '';

      return `**${tool.name}**: ${tool.description}\nParameters:\n${params}`;
    }).join('\n\n');

    return `${basePrompt}

## Available Tools

You have access to the following tools. To use a tool, format your response with the tool name and arguments in this exact format:

<tool_call>
<tool_name>tool_name_here</tool_name>
<arguments>
{
  "parameter_name": "parameter_value"
}
</arguments>
</tool_call>

Available tools:

${toolDescriptions}

When you need to use a tool, include the tool call in your response and I will execute it for you.`;
  }

  // Private helper methods
  private shouldIncludeTools(message: MessageContent, conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>): boolean {
    let messageText = '';
    if (typeof message === 'string') {
      messageText = message;
    } else if (Array.isArray(message)) {
      messageText = message.filter(item => item.type === 'text').map(item => item.text).join('\n');
    } else if (message && typeof message === 'object' && 'text' in message) {
      messageText = message.text;
    }

    const recentHistory = conversationHistory.slice(-3).map(h =>
      typeof h.content === 'string' ? h.content : JSON.stringify(h.content)
    ).join(' ');

    const combinedText = `${recentHistory} ${messageText}`.toLowerCase();

    // Tool-related keywords
    const toolKeywords = [
      'search', 'find', 'look up', 'google', 'web',
      'weather', 'temperature', 'forecast',
      'calculate', 'math', 'compute',
      'file', 'read', 'write', 'save',
      'time', 'date', 'current',
      'tool', 'function', 'execute'
    ];

    return toolKeywords.some(keyword => combinedText.includes(keyword));
  }

  private async handleStreamResponse(
    response: Response,
    onStream: (chunk: string) => void,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    _signal?: AbortSignal,
    requestId?: string
  ): Promise<LLMResponse> {
    let firstTokenReceived = false;

    const wrappedOnStream = (chunk: string) => {
      if (!firstTokenReceived && requestId) {
        llamaCppPerformanceMonitor.recordFirstToken(requestId);
        firstTokenReceived = true;
      }
      if (requestId) {
        llamaCppPerformanceMonitor.recordToken(requestId);
      }
      onStream(chunk);
    };

    try {
      const result = await OpenAICompatibleStreaming.handleStreamResponse(
        response,
        wrappedOnStream,
        settings,
        provider,
        conversationHistory,
        'Llama.cpp',
        async (_toolCalls, initialContent, initialUsage, settings, provider, conversationHistory, onStream) => {
          return this.processResponseForTools(initialContent, initialUsage, settings, provider, conversationHistory, onStream);
        }
      );

      if (requestId) {
        llamaCppPerformanceMonitor.completeRequest(requestId);
      }

      return result;
    } catch (error) {
      if (requestId) {
        llamaCppPerformanceMonitor.completeRequest(requestId, error instanceof Error ? error.message : String(error));
      }
      throw error;
    }
  }

  private async handleNonStreamResponse(
    response: Response,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    requestId?: string
  ): Promise<LLMResponse> {
    try {
      const data: APIResponseData = await response.json();
      const message = data.choices?.[0]?.message;
      const content = message?.content || '';

      // Record tokens for performance monitoring
      if (requestId && data.usage?.completion_tokens) {
        for (let i = 0; i < data.usage.completion_tokens; i++) {
          llamaCppPerformanceMonitor.recordToken(requestId);
        }
      }

      // Check for OpenAI-compatible tool calls first
      if (settings.toolCallingEnabled && message?.tool_calls && message.tool_calls.length > 0) {
        console.log(`🔧 Llama.cpp found ${message.tool_calls.length} OpenAI-compatible tool calls`);

        const toolCalls = message.tool_calls.map((tc: any) => ({
          name: tc.function?.name,
          arguments: JSON.parse(tc.function?.arguments || '{}')
        }));

        return this.executeTextBasedTools(
          toolCalls,
          content,
          data.usage ? {
            prompt_tokens: data.usage.prompt_tokens,
            completion_tokens: data.usage.completion_tokens,
            total_tokens: data.usage.total_tokens
          } : undefined,
          settings,
          provider,
          conversationHistory
        );
      }

      // Fallback to text-based parsing for models that don't support native tool calls
      const result = await this.processResponseForTools(
        content,
        data.usage ? {
          prompt_tokens: data.usage.prompt_tokens,
          completion_tokens: data.usage.completion_tokens,
          total_tokens: data.usage.total_tokens
        } : undefined,
        settings,
        provider,
        conversationHistory
      );

      if (requestId) {
        llamaCppPerformanceMonitor.completeRequest(requestId);
      }

      return result;
    } catch (error) {
      if (requestId) {
        llamaCppPerformanceMonitor.completeRequest(requestId, error instanceof Error ? error.message : String(error));
      }
      throw error;
    }
  }

  private async processResponseForTools(
    content: string,
    usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream?: (chunk: string) => void
  ): Promise<LLMResponse> {
    // Check for tool calls in the response (fallback text-based parsing)
    if (settings.toolCallingEnabled) {
      const toolCalls = this.parseToolCallsFromText(content);
      if (toolCalls.length > 0) {
        console.log(`🔧 Llama.cpp found ${toolCalls.length} text-based tool calls`);
        return this.executeTextBasedTools(toolCalls, content, usage, settings, provider, conversationHistory, onStream);
      }
    }

    return {
      content,
      usage: usage ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      } : undefined,
      toolCalls: []
    };
  }

  private mapToolName(toolName: string): string {
    // Map common tool names to actual MCP tool names
    const toolMapping: Record<string, string> = {
      'weather': 'web-search', // Use web search for weather queries
      'search': 'web-search',
      'web_search': 'web-search',
      'browse': 'web-search',
      'fetch': 'fetch',
      'get_url': 'fetch',
      'terminal': 'start_process',
      'command': 'start_process',
      'shell': 'start_process',
      'memory': 'remember',
      'remember': 'remember',
      'save': 'remember'
    };

    return toolMapping[toolName.toLowerCase()] || toolName;
  }

  private transformToolArguments(toolName: string, args: Record<string, unknown>): Record<string, unknown> {
    // Transform arguments based on tool requirements
    switch (toolName) {
      case 'web-search':
        // Convert location to search query for weather
        if (args.location) {
          return { query: `weather in ${args.location}` };
        }
        return args;

      case 'start_process':
        // Ensure command is provided
        if (!args.command && args.cmd) {
          return { ...args, command: args.cmd, timeout_ms: 30000 };
        }
        return { ...args, timeout_ms: args.timeout_ms || 30000 };

      default:
        return args;
    }
  }

  private async waitForModelToLoad(baseUrl: string, signal?: AbortSignal): Promise<void> {
    const maxAttempts = 30; // 30 seconds max wait
    let attempts = 0;

    while (attempts < maxAttempts) {
      if (signal?.aborted) {
        throw new Error('Request cancelled');
      }

      try {
        // Test with a simple request to see if model is ready
        const testResponse = await fetch(`${baseUrl}/v1/models`, {
          method: 'GET',
          signal
        });

        if (testResponse.ok) {
          // Model is ready
          return;
        }

        if (testResponse.status === 503) {
          // Model still loading, show progress and wait
          const errorData = await testResponse.text();
          if (errorData.includes('Loading model')) {
            // Show loading progress
            const progress = Math.min((attempts / maxAttempts) * 100, 95);
            console.log(`🔄 Model loading... (${progress.toFixed(0)}%)`);

            // Emit progress event for UI
            if (typeof window !== 'undefined' && window.dispatchEvent) {
              window.dispatchEvent(new CustomEvent('model-loading-progress', {
                detail: { progress, message: 'Loading model...' }
              }));
            }

            attempts++;
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
            continue;
          }
        }

        // Other error, break out
        break;

      } catch (error) {
        if (signal?.aborted) {
          throw new Error('Request cancelled');
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Final check - if we get here, either model is ready or we timed out
    if (attempts >= maxAttempts) {
      throw new Error('Model loading timed out. Please try again.');
    }
  }

  private parseToolCallsFromText(text: string): Array<{ name: string; arguments: Record<string, unknown> }> {
    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    // Parse tool calls in multiple formats:

    // Format 1: XML format (most common for llama.cpp)
    // <tool_call> <tool_name>tool_name</tool_name> <arguments> {"param": "value"} </arguments> </tool_call>
    const xmlToolCallRegex = /<tool_call>\s*<tool_name>(.*?)<\/tool_name>\s*<arguments>\s*(.*?)\s*<\/arguments>\s*<\/tool_call>/g;
    let match;

    while ((match = xmlToolCallRegex.exec(text)) !== null) {
      const toolName = match[1].trim();
      const argumentsText = match[2].trim();

      try {
        const args = JSON.parse(argumentsText);
        toolCalls.push({
          name: toolName,
          arguments: args
        });
        // Success - tool call parsed
      } catch (error) {
        // Try to parse as simple object if JSON parsing fails
        try {
          const simpleArgs = { query: argumentsText.replace(/[{}'"]/g, '') };
          toolCalls.push({
            name: toolName,
            arguments: simpleArgs
          });
        } catch (fallbackError) {
          // Complete parsing failure - skip this tool call
        }
      }
    }

    // Format 2: JSON function call format
    // {"function": "tool_name", "arguments": {"param": "value"}}
    const jsonFunctionRegex = /\{"function":\s*"([^"]+)",\s*"arguments":\s*(\{[^}]*\})\}/g;
    while ((match = jsonFunctionRegex.exec(text)) !== null) {
      const toolName = match[1].trim();
      const argumentsText = match[2].trim();

      try {
        const args = JSON.parse(argumentsText);
        toolCalls.push({
          name: toolName,
          arguments: args
        });
        console.log(`✅ Llama.cpp: Parsed JSON function call: ${toolName}`);
      } catch (error) {
        console.warn(`🚨 Llama.cpp: Failed to parse JSON function arguments for ${toolName}:`, error);
      }
    }

    // Format 3: Function call syntax
    // tool_name({"param": "value"})
    const functionCallRegex = /(\w+)\s*\(\s*(\{[^}]*\})\s*\)/g;
    while ((match = functionCallRegex.exec(text)) !== null) {
      const toolName = match[1].trim();
      const argumentsText = match[2].trim();

      try {
        const args = JSON.parse(argumentsText);
        toolCalls.push({
          name: toolName,
          arguments: args
        });
        console.log(`✅ Llama.cpp: Parsed function call syntax: ${toolName}`);
      } catch (error) {
        console.warn(`🚨 Llama.cpp: Failed to parse function call arguments for ${toolName}:`, error);
      }
    }

    // Format 4: Simple XML-like format without proper closing tags
    // <tool_call> <tool_name>get_weather</tool_name> <arguments> { "location": "Paris" } </arguments> </tool_call>
    const simpleXmlRegex = /<tool_call>\s*<tool_name>([^<]+)<\/tool_name>\s*<arguments>\s*([^<]+)\s*<\/arguments>\s*<\/tool_call>/g;
    while ((match = simpleXmlRegex.exec(text)) !== null) {
      const toolName = match[1].trim();
      const argumentsText = match[2].trim();

      try {
        const args = JSON.parse(argumentsText);
        toolCalls.push({
          name: toolName,
          arguments: args
        });
        // Success - tool call parsed
      } catch (error) {
        // Failed to parse - skip this tool call
      }
    }

    // Format 5: Hermes 2 Pro format - JSON object with "tool" field
    // {"tool": "weather", "location": "Athens, Greece"}
    const hermesJsonRegex = /\{[^}]*"tool"\s*:\s*"([^"]+)"[^}]*\}/g;
    while ((match = hermesJsonRegex.exec(text)) !== null) {
      const fullMatch = match[0];

      try {
        const parsed = JSON.parse(fullMatch);
        const toolName = parsed.tool;

        // Remove the "tool" field and use the rest as arguments
        const args = { ...parsed };
        delete args.tool;

        // Map common tool names to actual MCP tool names
        const mappedToolName = this.mapToolName(toolName);

        // Transform arguments for specific tools
        const transformedArgs = this.transformToolArguments(mappedToolName, args);

        toolCalls.push({
          name: mappedToolName,
          arguments: transformedArgs
        });
      } catch (error) {
        // Failed to parse - skip this tool call
      }
    }

    return toolCalls;
  }

  private async executeTextBasedTools(
    toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>,
    originalContent: string,
    _usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
    settings: LLMSettings,
    _provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream?: (chunk: string) => void
  ): Promise<LLMResponse> {
    const toolResults: Array<{ name: string; result: string; error: boolean }> = [];

    // Execute all tool calls
    for (const toolCall of toolCalls) {
      try {
        console.log(`🔧 Executing Llama.cpp tool: ${toolCall.name} with args:`, toolCall.arguments);

        const result = await this.executeMCPTool(toolCall.name, toolCall.arguments);
        const resultString = typeof result === 'string' ? result : JSON.stringify(result);

        toolResults.push({
          name: toolCall.name,
          result: resultString,
          error: false
        });

        console.log(`✅ Llama.cpp tool ${toolCall.name} executed successfully`);
      } catch (error) {
        console.error(`❌ Llama.cpp tool ${toolCall.name} failed:`, error);
        const userFriendlyError = this.formatToolError(toolCall.name, error);

        toolResults.push({
          name: toolCall.name,
          result: userFriendlyError,
          error: true
        });
      }
    }

    // Create follow-up message with tool results
    const toolResultsText = toolResults.map(result =>
      `Tool: ${result.name}\nResult: ${result.result}`
    ).join('\n\n');

    const followUpMessages = [
      ...conversationHistory,
      { role: 'user', content: typeof originalContent === 'string' ? originalContent : JSON.stringify(originalContent) },
      { role: 'assistant', content: originalContent },
      { role: 'user', content: `Tool execution results:\n\n${toolResultsText}\n\nPlease provide a response based on these tool results.` }
    ];

    // Make follow-up call to get final response
    return this.makeFollowUpCall(followUpMessages, settings, onStream || (() => {}));
  }

  private async makeFollowUpCall(
    messages: Array<{role: string, content: string | Array<ContentItem>}>,
    settings: LLMSettings,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    const baseUrl = settings.baseUrl || 'http://127.0.0.1:8080/v1';

    const requestBody = {
      model: settings.model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey || 'no-key'}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`Llama.cpp follow-up API error: ${response.status}`);
      }

      if (onStream) {
        return this.handleStreamResponse(response, onStream, settings, { id: 'llamacpp', name: 'Llama.cpp' } as LLMProvider, messages);
      } else {
        return this.handleNonStreamResponse(response, settings, { id: 'llamacpp', name: 'Llama.cpp' } as LLMProvider, messages);
      }
    } catch (error) {
      console.error('🚨 Llama.cpp follow-up call failed:', error);
      return {
        content: 'I apologize, but I encountered an error while processing the tool results. Please try again.',
        usage: undefined,
        toolCalls: []
      };
    }
  }

  private formatToolError(toolName: string, error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return `Error executing ${toolName}: ${errorMessage}`;
  }

  // Normalize model ID for server compatibility
  private normalizeModelId(modelId: string): string {
    // For llama-swap, we should use the exact model ID as it appears in the file system
    // The llama-swap configuration should match the file names exactly
    console.log(`🔍 Llama.cpp: Using exact model ID for llama-swap: ${modelId}`);
    return modelId;
  }

  // Ensure a model is loaded on the direct server
  private async ensureModelLoaded(modelId: string): Promise<void> {
    try {
      console.log(`🔄 Llama.cpp: Ensuring model ${modelId} is loaded on direct server`);

      // Use the llamaCppService to start the direct server with the specific model
      const { llamaCppService } = await import('../llamaCppService');

      // This will start the direct llama.cpp server with the specified model
      await llamaCppService.startServerWithModel(modelId);

      console.log(`✅ Llama.cpp: Model ${modelId} loaded successfully on direct server`);
    } catch (error) {
      console.error(`❌ Llama.cpp: Failed to load model ${modelId}:`, error);
      // Don't throw error - continue with the request, but log the issue
    }
  }

  // This method is injected by the main service
  public executeMCPTool: (toolName: string, args: Record<string, unknown>) => Promise<string> = async (toolName: string, args: Record<string, unknown>) => {
    console.error('🚨 Llama.cpp: executeMCPTool called but not injected! This should not happen.');
    console.error('Tool:', toolName, 'Args:', args);
    return JSON.stringify({ error: 'Tool execution not available - injection failed' });
  };
}
