// LM Studio provider implementation

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

import { LMSTUDIO_SYSTEM_PROMPT, generateLMStudioToolPrompt } from './prompts/lmstudio';

export class LMStudioProvider extends BaseProvider {
  readonly id = 'lmstudio';
  readonly name = 'LM Studio';
  readonly capabilities: ProviderCapabilities = {
    supportsVision: true,
    supportsTools: true, // Text-based tool descriptions only (no structured tools)
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'text' // Text-based tool descriptions in system prompt
  };

  /**
   * Determines if tools should be included based on query content
   * Includes tools for various types of tasks, not just external/current data
   */
  private shouldIncludeTools(message: MessageContent, conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>): boolean {
    // Extract text content from message
    let queryText = '';
    if (typeof message === 'string') {
      queryText = message.toLowerCase();
    } else if (Array.isArray(message)) {
      queryText = message
        .filter(item => item.type === 'text')
        .map(item => item.text)
        .join(' ')
        .toLowerCase();
    }

    // Also check recent conversation history for context
    const recentMessages = conversationHistory.slice(-3); // Last 3 messages
    const conversationContext = recentMessages
      .map(msg => typeof msg.content === 'string' ? msg.content : '')
      .join(' ')
      .toLowerCase();

    const fullContext = `${queryText} ${conversationContext}`;

    // Comprehensive tool indicators for various categories
    const toolIndicators = [
      // External/Current data (web search, news, weather)
      'current', 'latest', 'recent', 'today', 'now', 'weather', 'news', 'search for',
      'find information', 'look up', 'research', 'browse', 'stock price', 'market',

      // File operations
      'read file', 'write file', 'save file', 'open file', 'create file', 'delete file',
      'file content', 'file system', 'directory', 'folder', 'path', 'upload', 'download',

      // Memory operations
      'remember', 'store', 'recall', 'save this', 'note this', 'keep track', 'memory',
      'remind me', 'save for later', 'store information',

      // Terminal/System commands
      'run command', 'execute', 'terminal', 'command line', 'shell', 'process',
      'install', 'start server', 'kill process', 'system info',

      // Text editing operations
      'edit text', 'modify', 'replace text', 'find and replace', 'format text',
      'code formatting', 'syntax highlighting',

      // Screenshots and media
      'screenshot', 'capture screen', 'take picture', 'image', 'visual',

      // Data analysis and calculations
      'calculate', 'analyze', 'process data', 'statistics', 'chart', 'graph',

      // API and external integrations
      'api call', 'webhook', 'integration', 'connect to', 'fetch data'
    ];

    // Action verbs that often require tools
    const actionVerbs = [
      'create', 'make', 'build', 'generate', 'write', 'save', 'store', 'fetch',
      'get', 'retrieve', 'find', 'search', 'analyze', 'process', 'execute',
      'run', 'start', 'stop', 'install', 'configure', 'setup', 'connect'
    ];

    // Check for tool indicators
    const hasToolIndicators = toolIndicators.some(indicator =>
      fullContext.includes(indicator)
    );

    // Check for action verbs with objects (suggesting tool usage)
    const hasActionVerbs = actionVerbs.some(verb =>
      fullContext.includes(verb)
    );

    // Questions that might need tools
    const hasQuestionWords = /\b(what|when|where|who|how|why)\b/.test(fullContext);
    const hasTimeReference = /\b(today|yesterday|tomorrow|this|last|next|current|latest|recent|now)\b/.test(fullContext);

    // Specific patterns that suggest tool usage
    const hasFilePatterns = /\b(\.txt|\.json|\.csv|\.pdf|\.doc|\.md|file|folder|directory)\b/.test(fullContext);
    const hasCommandPatterns = /\b(npm|git|python|node|docker|curl|wget)\b/.test(fullContext);
    const hasDataPatterns = /\b(data|database|api|json|xml|csv|export|import)\b/.test(fullContext);

    // Combine all indicators - be more inclusive for tool usage
    const shouldInclude = hasToolIndicators ||
                         hasActionVerbs ||
                         hasFilePatterns ||
                         hasCommandPatterns ||
                         hasDataPatterns ||
                         (hasQuestionWords && hasTimeReference);

    console.log(`🔍 Comprehensive tool usage analysis:`, {
      queryText: queryText.substring(0, 100),
      hasToolIndicators,
      hasActionVerbs,
      hasFilePatterns,
      hasCommandPatterns,
      hasDataPatterns,
      hasQuestionWords,
      hasTimeReference,
      decision: shouldInclude
    });

    return shouldInclude;
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
    // LM Studio uses OpenAI-compatible API
    const baseUrl = settings.baseUrl || provider.baseUrl;
    const messages = [];

    // Determine if tools are needed based on query content
    const needsTools = this.shouldIncludeTools(message, conversationHistory);
    console.log(`🤔 LM Studio: Query analysis - Tools needed: ${needsTools}`);

    // Get tools only if needed (smart tool usage)
    let mcpTools: unknown[] = [];
    if (needsTools) {
      mcpTools = await this.getMCPToolsForProvider('lmstudio', settings);
      console.log(`🔧 LM Studio: Including ${mcpTools.length} tools for this query`);
    } else {
      console.log(`🚫 LM Studio: Skipping tools for this query - no external data needed`);
    }

    // Use behavioral system prompt + tool descriptions (text-based approach)
    // Check for meaningful system prompt, not just empty string or generic default
    const hasCustomSystemPrompt = settings.systemPrompt &&
      settings.systemPrompt.trim() &&
      settings.systemPrompt !== "You are a helpful AI assistant. Please provide concise and helpful responses.";

    let systemPrompt = hasCustomSystemPrompt ? settings.systemPrompt! : this.getSystemPrompt();

    // Add tool descriptions to system prompt only if tools are needed
    if (mcpTools.length > 0) {
      console.log(`🔍 [LM STUDIO DEBUG] Available tools being passed to model:`, mcpTools.map(t => {
        const tool = t as { name?: string; function?: { name?: string } };
        return tool.name || tool.function?.name || 'unknown';
      }));

      systemPrompt = this.enhanceSystemPromptWithTools(systemPrompt, mcpTools as ToolObject[]);
      systemPrompt += `\n\n## Tool Usage Guidance

Use tools strategically for:
- Current/real-time information (weather, news, stock prices)
- File operations (reading, writing, managing files)
- Memory operations (storing/recalling information)
- System commands (terminal, processes, installations)
- Data processing and analysis
- External integrations and API calls

Answer directly for general knowledge questions without tools.

CRITICAL: Only use the exact tool names listed above. DO NOT invent tools.`;

      console.log(`🔧 LM Studio enhanced system prompt with ${mcpTools.length} text-based tool descriptions`);
      console.log(`🔍 [LM STUDIO DEBUG] System prompt length: ${systemPrompt.length} characters`);
    } else if (needsTools) {
      console.warn(`⚠️ [LM STUDIO DEBUG] Tools were needed but none available!`);
    } else {
      console.log(`✅ [LM STUDIO DEBUG] No tools included - query can be answered directly`);
    }

    console.log(`🔍 LM Studio system prompt source:`, {
      hasCustom: hasCustomSystemPrompt,
      usingCustom: hasCustomSystemPrompt,
      promptLength: systemPrompt?.length || 0,
      promptStart: systemPrompt?.substring(0, 100) + '...',
      toolsIncluded: mcpTools.length > 0
    });

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Add current message
    if (typeof message === 'string') {
      messages.push({ role: 'user', content: message });
    } else if (Array.isArray(message)) {
      messages.push({ role: 'user', content: message });
    } else {
      // Handle vision format (exact format from working Python example)
      const messageWithImages = message as { text: string; images: string[] };
      const content: ContentItem[] = [{ type: 'text', text: messageWithImages.text }];

      console.log(`🖼️ LM Studio: Processing ${messageWithImages.images.length} images`);

      for (const imageUrl of messageWithImages.images) {
        console.log(`🖼️ LM Studio: Raw image data length:`, imageUrl.length);

        // Extract base64 data if it's a data URL, otherwise assume it's raw base64
        let base64Data = imageUrl;
        if (imageUrl.startsWith('data:image/')) {
          base64Data = imageUrl.split(',')[1];
          console.log(`🖼️ LM Studio: Extracted base64 from data URL`);
        } else if (imageUrl.includes(',')) {
          base64Data = imageUrl.split(',')[1];
          console.log(`🖼️ LM Studio: Extracted base64 from comma-separated data`);
        }

        // Use exact format from working Python example: f"data:image/jpeg;base64,{base64_image}"
        const formattedImageUrl = `data:image/jpeg;base64,${base64Data}`;

        console.log(`🖼️ LM Studio: Formatted image URL:`, formattedImageUrl.substring(0, 50) + '...');

        // Exact structure from working example
        content.push({
          type: 'image_url',
          image_url: { url: formattedImageUrl }
        });
      }

      messages.push({ role: 'user', content });
      console.log(`🖼️ LM Studio: Created message with ${content.length} content items`);
    }

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };

    // Check if this request contains images
    const hasImages = (requestBody.messages as Array<{content: unknown}>).some(msg =>
      Array.isArray(msg.content) && msg.content.some((item: {type?: string}) => item.type === 'image_url')
    );

    // Debug: Log the complete request being sent to LM Studio
    console.log(`🔍 LM Studio request body:`, {
      model: requestBody.model,
      messageCount: (requestBody.messages as Array<unknown>).length,
      hasImages: hasImages,
      stream: requestBody.stream
    });

    // LM Studio uses text-based tool descriptions in system prompt (no structured tools)
    console.log(`🚀 LM Studio API call with text-based tools:`, {
      model: settings.model,
      toolDescriptionsInSystemPrompt: mcpTools.length > 0,
      toolCount: mcpTools.length,
      note: 'Tools are included as text descriptions in system prompt, not as structured tools parameter'
    });

    // NOTE: No requestBody.tools - LM Studio doesn't support structured tools
    // Tool descriptions are already included in the system prompt above

    // Use standard OpenAI-compatible endpoint
    const apiUrl = `${baseUrl}/chat/completions`;
    console.log(`🔗 LMStudio request URL: ${apiUrl}`);
    console.log(`🔗 LMStudio request headers:`, {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey || 'not-needed'}`
    });

    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey || 'not-needed'}`
        },
        body: JSON.stringify(requestBody),
        signal
      });
    } catch (fetchError) {
      console.error(`❌ LMStudio connection failed:`, fetchError);
      throw new Error(`Failed to connect to LM Studio at ${baseUrl}. Make sure LM Studio is running and the server is started. Error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
    }

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ LMStudio API error (${response.status}):`, error);

      // Check for common LMStudio issues
      if (response.status === 404) {
        throw new Error(`LM Studio API endpoint not found. Make sure you have started the local server in LM Studio (Developer tab → Start Server). URL: ${apiUrl}`);
      }
      if (response.status === 400 && error.includes('No model loaded')) {
        throw new Error(`No model loaded in LM Studio. Please load a model in LM Studio before sending messages.`);
      }
      if (error.includes('Only user and assistant roles are supported')) {
        throw new Error(`LM Studio model doesn't support system messages. Try a different model or remove system prompt. Error: ${error}`);
      }
      if (error.includes('context length') || error.includes('context overflow')) {
        throw new Error(`LM Studio model context limit exceeded. Try a shorter conversation or a model with larger context. Error: ${error}`);
      }

      throw new Error(`LM Studio API error (${response.status}): ${error}`);
    }

    if (onStream) {
      return this.handleStreamResponse(response, onStream, settings, provider, conversationHistory, signal);
    } else {
      return this.handleNonStreamResponse(response, settings, conversationHistory, conversationId);
    }
  }

  async fetchModels(apiKey: string, baseUrl?: string): Promise<string[]> {
    if (!baseUrl) {
      console.error('❌ No LM Studio base URL provided - cannot fetch models');
      throw new Error('LM Studio base URL is required to fetch available models. Please add the base URL in settings (e.g., http://localhost:1234).');
    }

    try {
      // LM Studio models endpoint (OpenAI-compatible)
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ LM Studio API error: ${response.status}`, errorText);
        throw new Error(`Failed to connect to LM Studio at ${baseUrl}. Status: ${response.status} - ${errorText}. Make sure LM Studio is running and the server is started.`);
      }

      const data = await response.json() as APIResponseData;
      const models = data.data?.map((model) => model.id)?.sort() || [];

      if (models.length === 0) {
        throw new Error(`No models found in LM Studio at ${baseUrl}. Please load a model in LM Studio first.`);
      }

      return models;
    } catch (error) {
      console.error('❌ Failed to fetch LM Studio models:', error);
      throw error instanceof Error ? error : new Error(`Failed to fetch LM Studio models: ${String(error)}`);
    }
  }

  formatTools(tools: ToolObject[]): unknown[] {
    // LM Studio uses OpenAI-compatible format
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
    return LMSTUDIO_SYSTEM_PROMPT;
  }

  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string {
    if (tools.length === 0) {
      return basePrompt;
    }

    const toolInstructions = generateLMStudioToolPrompt(tools);
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
      errors.push('LM Studio tools must have type: "function"');
    }

    if (!toolObj.function || typeof toolObj.function !== 'object') {
      errors.push('LM Studio tools must have function object');
    } else {
      const func = toolObj.function as Record<string, unknown>;
      if (!func.name) {
        errors.push('LM Studio tools must have function.name');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Private helper methods
  // This method is injected by the ProviderAdapter from the LLMService
  private getMCPToolsForProvider!: (providerId: string, settings: LLMSettings) => Promise<unknown[]>;

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
    // Try native OpenAI-compatible tool calling first, then fallback to text-based
    return this.handleHybridToolCalling(
      response,
      onStream,
      settings,
      provider,
      conversationHistory
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async executeMCPTool(_toolName: string, _args: Record<string, unknown>): Promise<string> {
    // This will be injected by the main service
    return JSON.stringify({ error: 'Tool execution not available' });
  }

  private async handleHybridToolCalling(
    response: Response,
    onStream: (chunk: string) => void,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>
  ): Promise<LLMResponse> {
    let fullContent = '';
    let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;
    const nativeToolCalls: Array<{ id: string; type: string; function: { name: string; arguments: string } }> = [];
    let hasNativeToolCalls = false;

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
                const delta = parsed.choices?.[0]?.delta;

                // Check for native tool calls
                if (delta?.tool_calls) {
                  hasNativeToolCalls = true;
                  console.log(`🔧 LM Studio detected native tool calls:`, delta.tool_calls);

                  // Accumulate tool calls (they might come in chunks)
                  for (const toolCall of delta.tool_calls) {
                    // Only process tool calls that have valid data
                    if (!toolCall.id || !toolCall.function?.name) {
                      console.warn(`⚠️ Skipping incomplete tool call:`, toolCall);
                      continue;
                    }

                    const existingIndex = nativeToolCalls.findIndex(tc => tc.id === toolCall.id);
                    if (existingIndex >= 0) {
                      // Update existing tool call
                      if (toolCall.function?.name) {
                        nativeToolCalls[existingIndex].function.name = toolCall.function.name;
                      }
                      if (toolCall.function?.arguments) {
                        nativeToolCalls[existingIndex].function.arguments += toolCall.function.arguments;
                      }
                    } else {
                      // New tool call - only add if it has a name
                      if (toolCall.function?.name) {
                        nativeToolCalls.push({
                          id: toolCall.id,
                          type: toolCall.type || 'function',
                          function: {
                            name: toolCall.function.name,
                            arguments: toolCall.function?.arguments || ''
                          }
                        });
                      }
                    }
                  }
                }

                // Handle regular content
                const content = delta?.content || '';
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
                console.warn('Failed to parse LM Studio stream chunk:', error);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    console.log(`🔍 LM Studio hybrid analysis:`, {
      hasNativeToolCalls,
      nativeToolCallsCount: nativeToolCalls.length,
      contentLength: fullContent.length
    });

    // If we detected native tool calls during streaming, validate and use them
    if (hasNativeToolCalls && nativeToolCalls.length > 0) {
      // Filter out incomplete tool calls and validate arguments
      const validToolCalls = nativeToolCalls.filter(tc => {
        // Check basic structure
        if (!tc.id || !tc.function?.name || tc.function?.name.trim() === '') {
          console.warn(`⚠️ Filtering out tool call with missing name:`, tc);
          return false;
        }

        // Parse and validate arguments
        let parsedArgs: Record<string, unknown> = {};
        if (tc.function.arguments) {
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {
            console.warn(`⚠️ Filtering out tool call with invalid JSON arguments:`, tc);
            return false;
          }
        }

        // Check if arguments are meaningful (not just empty object)
        const hasValidArgs = Object.keys(parsedArgs).length > 0;
        if (!hasValidArgs) {
          console.warn(`⚠️ Filtering out tool call with empty arguments:`, tc);
          return false;
        }

        // Tool-specific validation
        const toolName = tc.function.name;
        if (toolName === 'web_search' && !parsedArgs.query) {
          console.warn(`⚠️ Filtering out web_search without query parameter:`, tc);
          return false;
        }

        if ((toolName === 'read_file' || toolName === 'write_file' || toolName === 'edit_file') && !parsedArgs.path) {
          console.warn(`⚠️ Filtering out ${toolName} without path parameter:`, tc);
          return false;
        }

        if (toolName === 'fetch' && !parsedArgs.url) {
          console.warn(`⚠️ Filtering out fetch without url parameter:`, tc);
          return false;
        }

        console.log(`✅ Valid tool call: ${toolName} with args:`, parsedArgs);
        return true;
      });

      if (validToolCalls.length > 0) {
        console.log(`🔧 LM Studio using native tool calling with ${validToolCalls.length} valid tool calls`);
        return this.executeNativeToolCalls(validToolCalls, fullContent, usage, settings, provider, conversationHistory, onStream);
      } else {
        console.log(`⚠️ All ${nativeToolCalls.length} native tool calls were invalid, falling back to text parsing`);
        // Reset the flag since we're not using native tool calls
        hasNativeToolCalls = false;
      }
    }

    // For text-based parsing, we now have the COMPLETE response
    // Parse it only after streaming is finished
    console.log(`🔍 LM Studio parsing complete response for text-based tool calls`);
    return this.handleTextBasedToolCallingFromContent(fullContent, usage, settings, provider, conversationHistory, onStream);
  }

  private availableToolNames: string[] = [];

  // Method to inject actual tool names from MCP service
  setAvailableToolNames(toolNames: string[]): void {
    this.availableToolNames = toolNames;
    console.log(`🔧 LM Studio: Updated available tool names:`, toolNames);
  }

  private async handleTextBasedToolCallingFromContent(
    fullContent: string,
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    console.log(`🔍 LM Studio parsing complete response for tool calls`);

    // Handle empty responses
    if (!fullContent || fullContent.trim().length === 0) {
      console.warn(`⚠️ LM Studio returned empty response. This might indicate:`);
      console.warn(`   - Model failed to generate content`);
      console.warn(`   - Network/connection issues`);
      console.warn(`   - Model overloaded or timeout`);
      console.warn(`   - Model not properly loaded in LM Studio`);

      return {
        content: "I apologize, but I didn't receive a proper response from the LM Studio model. This could be due to the model being overloaded, not properly loaded, or a connection issue. Please check that the model is running in LM Studio and try again.",
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

    console.log(`🔍 Text parsing result: found ${toolCalls.length} tool calls:`, toolCalls);

    if (toolCalls.length > 0) {
      console.log(`🔧 LM Studio found ${toolCalls.length} tool calls in complete response`);
      return this.executeTextBasedTools(toolCalls, fullContent, usage, settings, provider, conversationHistory, onStream);
    }

    // Return the original content (with thinking) for UI display
    // The UI component will handle parsing and displaying thinking content
    const result = {
      content: fullContent, // Keep original content with thinking for UI
      usage: usage ? {
        promptTokens: usage.promptTokens || 0,
        completionTokens: usage.completionTokens || 0,
        totalTokens: usage.totalTokens || 0
      } : undefined
    };

    console.log(`🔍 LM Studio returning result without tool calls:`, {
      contentLength: result.content.length,
      hasUsage: !!result.usage,
      hasToolCalls: false
    });

    return result;
  }

  private async executeNativeToolCalls(
    toolCalls: Array<{ id: string; type: string; function: { name: string; arguments: string } }>,
    initialContent: string,
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    console.log(`🔧 LM Studio executing ${toolCalls.length} native tool calls`);

    // Execute all tool calls
    const toolResults: Array<{ id: string; name: string; result: string; error?: boolean }> = [];

    for (const toolCall of toolCalls) {
      try {
        // Safely parse arguments with fallback
        let args: Record<string, unknown> = {};
        if (toolCall.function.arguments) {
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch (parseError) {
            console.warn(`⚠️ Failed to parse tool arguments: ${toolCall.function.arguments}`, parseError);
            // Try to extract arguments using fallback parsing
            args = this.parseArgumentsFromText(toolCall.function.arguments);
          }
        }

        console.log(`🔧 Executing LM Studio native tool: ${toolCall.function.name} with args:`, args);

        const result = await this.executeMCPTool(toolCall.function.name, args);
        toolResults.push({
          id: toolCall.id,
          name: toolCall.function.name,
          result: typeof result === 'string' ? result : JSON.stringify(result),
          error: false
        });
        console.log(`✅ LM Studio native tool ${toolCall.function.name} executed successfully`);
      } catch (error) {
        console.error(`❌ LM Studio native tool ${toolCall.function.name} failed:`, error);
        const userFriendlyError = this.formatToolError(toolCall.function.name, error);
        toolResults.push({
          id: toolCall.id,
          name: toolCall.function.name,
          result: userFriendlyError,
          error: true
        });
      }
    }

    // Build proper conversation history following official LM Studio format
    const properConversationHistory = this.buildProperConversationHistory(
      conversationHistory,
      toolResults,
      toolCalls
    );

    console.log(`🔄 LM Studio making native follow-up call with proper conversation format`);

    // Make a follow-up call without tools (following official LM Studio pattern)
    const followUpResponse = await this.makeDirectFollowUpCall(
      properConversationHistory as Array<{role: string, content: string | Array<ContentItem>}>,
      settings,
      onStream
    );

    return {
      content: followUpResponse.content,
      usage: followUpResponse.usage,
      toolCalls: toolCalls.map(tc => {
        // Safely parse arguments for the return value
        let parsedArgs: Record<string, unknown> = {};
        if (tc.function.arguments) {
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch (parseError) {
            console.warn(`⚠️ Failed to parse tool arguments for return: ${tc.function.arguments}`, parseError);
            parsedArgs = this.parseArgumentsFromText(tc.function.arguments);
          }
        }

        return {
          id: tc.id,
          name: tc.function.name,
          arguments: parsedArgs
        };
      })
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
    console.log(`🔍 LMStudio raw response:`, JSON.stringify(data, null, 2));
    const message = data.choices[0].message;
    console.log(`🔍 LMStudio message:`, message);

    // Handle tool calls if present - execute immediately like Anthropic
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`🔧 LMStudio response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);

      // Check if we have the parallel execution method injected
      if ((this as unknown as {executeMultipleToolsParallel?: unknown, summarizeToolResultsForModel?: unknown}).executeMultipleToolsParallel && (this as unknown as {executeMultipleToolsParallel?: unknown, summarizeToolResultsForModel?: unknown}).summarizeToolResultsForModel) {
        console.log(`🚀 Executing ${message.tool_calls.length} LMStudio tools immediately`);
        
        // Format tool calls for execution
        const toolCallsForExecution = message.tool_calls.map((toolCall: { id: string; function: { name: string; arguments: string } }) => {
          // Safely parse arguments
          let parsedArgs: Record<string, unknown> = {};
          if (toolCall.function.arguments) {
            try {
              parsedArgs = JSON.parse(toolCall.function.arguments);
            } catch (parseError) {
              console.warn(`⚠️ Failed to parse tool arguments in non-stream: ${toolCall.function.arguments}`, parseError);
              parsedArgs = this.parseArgumentsFromText(toolCall.function.arguments);
            }
          }

          return {
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: parsedArgs
          };
        });

        // Execute tools in parallel immediately
        const executeMultipleToolsParallel = (this as unknown as {executeMultipleToolsParallel: unknown}).executeMultipleToolsParallel;
        const summarizeToolResultsForModel = (this as unknown as {summarizeToolResultsForModel: unknown}).summarizeToolResultsForModel;
        
        try {
          const parallelResults = await (executeMultipleToolsParallel as (calls: unknown[], provider: string) => Promise<Array<{success: boolean}>>)(toolCallsForExecution, 'lmstudio');
          console.log(`✅ LMStudio tool execution completed: ${parallelResults.filter(r => r.success).length}/${parallelResults.length} successful`);

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
          console.error(`❌ LMStudio tool execution failed:`, error);
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
        console.warn(`⚠️ LMStudio provider missing tool execution methods - falling back to external handling`);
        // Fall back to external handling if methods not injected
        return {
          content: message.content || '',
          usage: data.usage ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
            totalTokens: data.usage.total_tokens
          } : undefined,
          toolCalls: message.tool_calls.map((tc: { id: string; function: { name: string; arguments: string } }) => {
            // Safely parse arguments
            let parsedArgs: Record<string, unknown> = {};
            if (tc.function.arguments) {
              try {
                parsedArgs = JSON.parse(tc.function.arguments);
              } catch (parseError) {
                console.warn(`⚠️ Failed to parse tool arguments in non-stream: ${tc.function.arguments}`, parseError);
                parsedArgs = this.parseArgumentsFromText(tc.function.arguments);
              }
            }

            return {
              id: tc.id,
              name: tc.function.name,
              arguments: parsedArgs
            };
          })
        };
      }
    }

    // Use text-based tool calling for non-stream responses too
    const content = message.content || '';
    const toolCalls = this.parseToolCallsFromText(content);

    if (toolCalls.length > 0) {
      console.log(`🔧 LM Studio found ${toolCalls.length} tool calls in non-stream response`);
      // For non-stream, we can't use onStream, so pass a no-op function
      return this.executeTextBasedTools(toolCalls, content, data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined, settings, { id: 'lmstudio', name: 'LM Studio' } as LLMProvider, conversationHistory, () => {});
    }

    return {
      content: content,
      usage: data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined
    };
  }

  private parseToolCallsFromText(content: string): Array<{ name: string; arguments: Record<string, unknown> }> {
    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    // Get available tool names from MCP tools
    const availableTools = this.getAvailableToolNames();

    console.log(`🔍 LM Studio parsing text for tools. Available tools:`, availableTools);
    console.log(`🔍 Content to parse:`, content);

    // STEP 1: Look for structured tool call formats first

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
      } catch {
        console.log(`⚠️ Failed to parse JSON-wrapped tool call:`, match[1]);
      }
    }

    // Pattern 2: Direct JSON tool_call format (Option 1)
    // { "tool_call": { "name": "web_search", "arguments": {...} } }
    const directToolCallRegex = /\{\s*"tool_call"\s*:\s*\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}\s*\}/gi;
    match = directToolCallRegex.exec(content);
    if (match) {
      try {
        const toolName = match[1];
        const args = JSON.parse(match[2]);
        toolCalls.push({ name: toolName, arguments: args });
        console.log(`✅ Found direct tool call: ${toolName} with args:`, args);
        return toolCalls; // Return early if we found the structured format
      } catch {
        console.log(`⚠️ Failed to parse direct tool call arguments:`, match[2]);
        // Try fallback parsing
        const toolName = match[1];
        const args = this.parseArgumentsFromText(match[2]);
        if (Object.keys(args).length > 0) {
          toolCalls.push({ name: toolName, arguments: args });
          console.log(`✅ Found direct tool call (fallback): ${toolName} with args:`, args);
          return toolCalls;
        }
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

    // If we found structured tool calls, return them
    if (toolCalls.length > 0) {
      console.log(`✅ Found ${toolCalls.length} structured tool calls, returning them`);
      return toolCalls;
    }

    // STEP 2: If no structured tool calls found, search for traces of tool usage in text
    console.log(`🔍 No structured tool calls found, searching for tool usage traces in text...`);

    return this.parseToolTracesFromText(content, availableTools);
  }

  private parseToolTracesFromText(content: string, availableTools: string[]): Array<{ name: string; arguments: Record<string, unknown> }> {
    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    console.log(`🔍 Searching for tool usage traces in content...`);

    for (const toolName of availableTools) {
      // Pattern 1: Direct tool mentions with intent to use
      // "I'll use web_search to find..." or "Let me search using web_search"
      const intentPatterns = [
        new RegExp(`I(?:'ll|\\s+will)\\s+use\\s+${toolName}\\s+(?:to\\s+|with\\s+|for\\s+)([^.!?]+)`, 'gi'),
        new RegExp(`Let\\s+me\\s+(?:use\\s+)?${toolName}\\s+(?:to\\s+|with\\s+|for\\s+)([^.!?]+)`, 'gi'),
        new RegExp(`Using\\s+${toolName}\\s+(?:to\\s+|with\\s+|for\\s+)([^.!?]+)`, 'gi'),
        new RegExp(`I\\s+(?:need\\s+to\\s+|should\\s+)?${toolName}\\s+(?:to\\s+|with\\s+|for\\s+)([^.!?]+)`, 'gi'),
        new RegExp(`I\\s+should\\s+use\\s+${toolName}\\s+(?:to\\s+|with\\s+|for\\s+)([^.!?]+)`, 'gi'),
        new RegExp(`(?:So,?\\s+)?I'll\\s+call\\s+${toolName}\\s+(?:with\\s+|to\\s+|for\\s+)([^.!?]+)`, 'gi'),
        new RegExp(`The\\s+best\\s+approach\\s+is\\s+to\\s+use\\s+${toolName}\\s+(?:with\\s+|to\\s+|for\\s+)([^.!?]+)`, 'gi')
      ];

      for (const pattern of intentPatterns) {
        const match = pattern.exec(content);
        if (match) {
          const intent = match[1].trim();
          const args = this.extractArgumentsFromIntent(toolName, intent);
          if (Object.keys(args).length > 0) {
            toolCalls.push({ name: toolName, arguments: args });
            console.log(`✅ Found tool usage intent: ${toolName} with intent "${intent}" -> args:`, args);
            break; // Found this tool, move to next
          }
        }
      }

      // Pattern 2: Function call style mentions
      // "web_search('weather Paris')" or "web_search(query='weather Paris')"
      const functionCallPattern = new RegExp(`${toolName}\\s*\\(([^)]+)\\)`, 'gi');
      const funcMatch = functionCallPattern.exec(content);
      if (funcMatch && !toolCalls.find(tc => tc.name === toolName)) {
        const argsText = funcMatch[1].trim();
        const args = this.parseArgumentsFromText(argsText);
        if (Object.keys(args).length > 0) {
          toolCalls.push({ name: toolName, arguments: args });
          console.log(`✅ Found function call: ${toolName}(${argsText}) -> args:`, args);
          continue;
        }
      }

      // Pattern 3: Tool name mentioned with quoted parameters
      // "web_search with query 'weather Paris'" or 'web_search "current weather"'
      const quotedParamsPattern = new RegExp(`${toolName}\\s+(?:with\\s+|using\\s+)?(?:query\\s+)?['"]([^'"]+)['"]`, 'gi');
      const quotedMatch = quotedParamsPattern.exec(content);
      if (quotedMatch && !toolCalls.find(tc => tc.name === toolName)) {
        const query = quotedMatch[1].trim();
        const args = this.createArgumentsForTool(toolName, query);
        if (Object.keys(args).length > 0) {
          toolCalls.push({ name: toolName, arguments: args });
          console.log(`✅ Found quoted params: ${toolName} with "${query}" -> args:`, args);
          continue;
        }
      }
    }

    console.log(`🔍 Tool trace parsing found ${toolCalls.length} tool calls:`, toolCalls);
    return toolCalls;
  }

  private extractArgumentsFromIntent(toolName: string, intent: string): Record<string, unknown> {
    // Extract meaningful arguments from natural language intent
    const args: Record<string, unknown> = {};

    // Common patterns for different tools
    if (toolName === 'web_search' || toolName === 'search') {
      // Extract search query from intent
      const searchPatterns = [
        /(?:search\s+for\s+|find\s+|look\s+up\s+|get\s+)(.+)/i,
        /(.+?)(?:\s+information|\s+details|\s+data)?$/i
      ];

      for (const pattern of searchPatterns) {
        const match = pattern.exec(intent);
        if (match) {
          args.query = match[1].trim();
          break;
        }
      }
    } else if (toolName === 'read_file') {
      // Extract file path from intent
      const filePatterns = [
        /(?:read\s+|open\s+|check\s+)(?:the\s+file\s+)?['"]?([^'"]+)['"]?/i,
        /file\s+['"]?([^'"]+)['"]?/i
      ];

      for (const pattern of filePatterns) {
        const match = pattern.exec(intent);
        if (match) {
          args.path = match[1].trim();
          break;
        }
      }
    } else if (toolName === 'write_file') {
      // Extract file path and content hints
      const writePatterns = [
        /(?:write\s+to\s+|save\s+to\s+|create\s+)(?:file\s+)?['"]?([^'"]+)['"]?/i
      ];

      for (const pattern of writePatterns) {
        const match = pattern.exec(intent);
        if (match) {
          args.path = match[1].trim();
          break;
        }
      }
    }

    // If no specific patterns matched, use the intent as a general query/input
    if (Object.keys(args).length === 0 && intent.length > 0) {
      // Use common parameter names based on tool
      if (toolName.includes('search')) {
        args.query = intent;
      } else if (toolName.includes('file') || toolName.includes('read')) {
        args.path = intent;
      } else {
        args.input = intent;
      }
    }

    return args;
  }

  private createArgumentsForTool(toolName: string, value: string): Record<string, unknown> {
    const args: Record<string, unknown> = {};

    // Map tool names to their expected parameter names
    if (toolName === 'web_search' || toolName === 'search') {
      args.query = value;
    } else if (toolName === 'read_file' || toolName === 'write_file' || toolName === 'edit_file') {
      args.path = value;
    } else if (toolName === 'fetch' || toolName === 'fetch_content') {
      args.url = value;
    } else {
      // Default to common parameter names
      args.query = value;
    }

    return args;
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
    console.log(`🔧 LM Studio executing ${toolCalls.length} text-based tool calls`);

    // Execute all tool calls
    const toolResults: Array<{ name: string; result: string; error?: boolean }> = [];

    for (const toolCall of toolCalls) {
      try {
        console.log(`🔧 Executing LM Studio tool: ${toolCall.name} with args:`, toolCall.arguments);
        const result = await this.executeMCPTool(toolCall.name, toolCall.arguments);
        toolResults.push({
          name: toolCall.name,
          result: typeof result === 'string' ? result : JSON.stringify(result),
          error: false
        });
        console.log(`✅ LM Studio tool ${toolCall.name} executed successfully`);
      } catch (error) {
        console.error(`❌ LM Studio tool ${toolCall.name} failed:`, error);
        const userFriendlyError = this.formatToolError(toolCall.name, error);
        toolResults.push({
          name: toolCall.name,
          result: userFriendlyError,
          error: true
        });
      }
    }

    // For text-based tools, create a simulated proper conversation history
    // Since text-based tools don't have structured IDs, we'll create them
    const simulatedToolCalls = toolCalls.map((tc, index) => ({
      id: `text_tool_${index}`,
      type: 'function',
      function: {
        name: tc.name,
        arguments: JSON.stringify(tc.arguments)
      }
    }));

    const simulatedToolResults = toolResults.map((tr, index) => ({
      id: `text_tool_${index}`,
      name: tr.name,
      result: tr.result,
      error: tr.error
    }));

    // Build proper conversation history for text-based tools
    const properConversationHistory = this.buildProperConversationHistory(
      conversationHistory,
      simulatedToolResults,
      simulatedToolCalls
    );

    console.log(`🔄 LM Studio making follow-up call with proper text-based tool conversation format`);

    // Make a follow-up call without tools (following official LM Studio pattern)
    const followUpResponse = await this.makeDirectFollowUpCall(
      properConversationHistory as Array<{role: string, content: string | Array<ContentItem>}>,
      settings,
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

  private getLastUserMessage(conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>): string {
    const userMessages = conversationHistory.filter(msg => msg.role === 'user');
    if (userMessages.length === 0) return 'Please help me with the information provided.';

    const lastMessage = userMessages[userMessages.length - 1];
    return typeof lastMessage.content === 'string' ? lastMessage.content : 'Please help me with the information provided.';
  }

  /**
   * Builds proper conversation history following official LM Studio format
   * Format: User message → Assistant tool call message → Tool result messages → Final response
   */
  private buildProperConversationHistory(
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    toolCalls: Array<{ id: string; name: string; result: string; error?: boolean }>,
    originalToolCallsFormat: Array<{ id: string; type: string; function: { name: string; arguments: string } }>
  ): Array<Record<string, unknown>> {

    // Start with the original conversation history
    const messages: Array<Record<string, unknown>> = [...conversationHistory];

    // Add the assistant message with tool calls (following official format)
    const assistantToolCallMessage = {
      role: 'assistant',
      tool_calls: originalToolCallsFormat.map(tc => ({
        id: tc.id,
        type: tc.type,
        function: tc.function
      }))
    };
    messages.push(assistantToolCallMessage);

    // Add tool result messages (following official format)
    for (const toolResult of toolCalls) {
      const toolResultMessage = {
        role: 'tool',
        content: toolResult.result,
        tool_call_id: toolResult.id
      };
      messages.push(toolResultMessage);
    }

    console.log(`🔧 Built proper conversation history with ${messages.length} messages (${toolCalls.length} tool results)`);
    return messages;
  }

  private async makeDirectFollowUpCall(
    messages: Array<{role: string, content: string | Array<ContentItem>}>,
    settings: LLMSettings,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    console.log(`🔄 Making follow-up call without tools (following official LM Studio pattern)`);

    // According to official LM Studio documentation, the follow-up call should NOT include tools
    // This prevents recursive tool calling and ensures proper synchronization
    console.log(`✅ LM Studio follow-up call without tools - following official pattern for final response`);

    // Use a clean final response prompt (no tools)
    const finalResponsePrompt = `You are a helpful AI assistant. Based on the conversation history and any tool results provided, give a comprehensive and helpful response to the user's question. Do not call any tools - just provide a natural response based on the information available.`;

    // Always update system message for final response (no tools)
    const systemMessageIndex = messages.findIndex(msg => msg.role === 'system');
    if (systemMessageIndex >= 0) {
      messages[systemMessageIndex].content = finalResponsePrompt;
    } else {
      messages.unshift({ role: 'system', content: finalResponsePrompt });
    }

    const requestBody = {
      model: settings.model,
      messages: messages,
      stream: true,
      temperature: settings.temperature || 0.7,
      max_tokens: settings.maxTokens || 4000
      // No tools included - following official LM Studio pattern for final response
    };

    // Construct the correct URL - baseUrl might already include /v1
    const baseUrl = settings.baseUrl || 'http://localhost:1234';
    const endpoint = baseUrl.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions';
    const fullUrl = `${baseUrl}${endpoint}`;

    console.log(`🔗 Follow-up call URL: ${fullUrl}`);

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer not-needed'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`LM Studio follow-up API error (${response.status}): ${await response.text()}`);
    }

    if (response.body) {
      // Handle the streaming response directly without recursion
      return this.handleFollowUpStreamResponse(response, onStream);
    } else {
      throw new Error('No response body received from LM Studio follow-up call');
    }
  }

  private async handleFollowUpStreamResponse(
    response: Response,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    console.log(`🔄 Processing follow-up stream response`);

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              if (delta?.content) {
                fullContent += delta.content;
                onStream(delta.content);
              }
            } catch {
              // Skip invalid JSON lines
              continue;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log(`✅ Follow-up response completed. Content length: ${fullContent.length}`);

    // No recursive tool calling - following official LM Studio pattern
    // The follow-up call should provide the final response without calling more tools
    console.log(`🎯 LM Studio final response ready - no additional tool calls needed`);

    return {
      content: fullContent,
      usage: undefined // Follow-up calls don't need usage tracking
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
}
