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
import { JSONUtils } from './utils';

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
    return hasToolIndicators ||
           hasActionVerbs ||
           hasFilePatterns ||
           hasCommandPatterns ||
           hasDataPatterns ||
           (hasQuestionWords && hasTimeReference);
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

    // Get tools only if needed (smart tool usage)
    let mcpTools: unknown[] = [];
    if (needsTools) {
      mcpTools = await this.getMCPToolsForProvider('lmstudio', settings);
    }

    // Use behavioral system prompt + tool descriptions (text-based approach)
    // Check for meaningful system prompt, not just empty string or generic default
    const hasCustomSystemPrompt = settings.systemPrompt &&
      settings.systemPrompt.trim() &&
      settings.systemPrompt !== "You are a helpful AI assistant. Please provide concise and helpful responses.";

    let systemPrompt = hasCustomSystemPrompt ? settings.systemPrompt! : this.getSystemPrompt();

    // Add tool descriptions to system prompt only if tools are needed
    if (mcpTools.length > 0) {


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

    }

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



      for (const imageUrl of messageWithImages.images) {


        // Extract base64 data if it's a data URL, otherwise assume it's raw base64
        let base64Data = imageUrl;
        if (imageUrl.startsWith('data:image/') || imageUrl.includes(',')) {
          base64Data = imageUrl.split(',')[1];
        }

        // Use exact format from working Python example: f"data:image/jpeg;base64,{base64_image}"
        const formattedImageUrl = `data:image/jpeg;base64,${base64Data}`;



        // Exact structure from working example
        content.push({
          type: 'image_url',
          image_url: { url: formattedImageUrl }
        });
      }

      messages.push({ role: 'user', content });

    }

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };



    // LM Studio uses text-based tool descriptions in system prompt (no structured tools)

    // NOTE: No requestBody.tools - LM Studio doesn't support structured tools
    // Tool descriptions are already included in the system prompt above

    // Use standard OpenAI-compatible endpoint
    const apiUrl = `${baseUrl}/chat/completions`;


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
      throw new Error(`Failed to connect to LM Studio at ${baseUrl}. Make sure LM Studio is running and the server is started. Error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
    }

    if (!response.ok) {
      const error = await response.text();

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

  async fetchModels(_apiKey: string, baseUrl?: string): Promise<string[]> {
    if (!baseUrl) {

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

        throw new Error(`Failed to connect to LM Studio at ${baseUrl}. Status: ${response.status} - ${errorText}. Make sure LM Studio is running and the server is started.`);
      }

      const data = await response.json() as APIResponseData;
      const models = data.data?.map((model) => model.id)?.sort() || [];

      if (models.length === 0) {
        throw new Error(`No models found in LM Studio at ${baseUrl}. Please load a model in LM Studio first.`);
      }

      return models;
    } catch (error) {

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
    _signal?: AbortSignal
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


                  // Accumulate tool calls (they might come in chunks)
                  for (const toolCall of delta.tool_calls) {
                    // Only process tool calls that have valid data
                    if (!toolCall.id || !toolCall.function?.name) {

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
              } catch {
                // Failed to parse stream chunk, continue
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }



    // If we detected native tool calls during streaming, validate and use them
    if (hasNativeToolCalls && nativeToolCalls.length > 0) {
      // Filter out incomplete tool calls and validate arguments
      const validToolCalls = nativeToolCalls.filter(tc => {
        // Check basic structure
        if (!tc.id || !tc.function?.name || tc.function?.name.trim() === '') {

          return false;
        }

        // Parse and validate arguments
        let parsedArgs: Record<string, unknown> = {};
        if (tc.function.arguments) {
          try {
            parsedArgs = JSON.parse(tc.function.arguments);
          } catch {

            return false;
          }
        }

        // Check if arguments are meaningful (not just empty object)
        const hasValidArgs = Object.keys(parsedArgs).length > 0;
        if (!hasValidArgs) {

          return false;
        }

        // Tool-specific validation
        const toolName = tc.function.name;
        if (toolName === 'web_search' && !parsedArgs.query) {

          return false;
        }

        if ((toolName === 'read_file' || toolName === 'write_file' || toolName === 'edit_file') && !parsedArgs.path) {

          return false;
        }

        if (toolName === 'fetch' && !parsedArgs.url) {

          return false;
        }


        return true;
      });

      if (validToolCalls.length > 0) {

        return this.executeNativeToolCalls(validToolCalls, fullContent, usage, settings, provider, conversationHistory, onStream);
      } else {

        // Reset the flag since we're not using native tool calls
        hasNativeToolCalls = false;
      }
    }

    // For text-based parsing, we now have the COMPLETE response
    // Parse it only after streaming is finished


    // Safety check: Only parse if we have substantial content (not partial)
    if (fullContent.length < 10) {

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

    return this.handleTextBasedToolCallingFromContent(fullContent, usage, settings, provider, conversationHistory, onStream);
  }

  private availableToolNames: string[] = [];

  // Method to inject actual tool names from MCP service
  setAvailableToolNames(toolNames: string[]): void {
    this.availableToolNames = toolNames;

  }

  private async handleTextBasedToolCallingFromContent(
    fullContent: string,
    usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {


    // Handle empty responses
    if (!fullContent || fullContent.trim().length === 0) {


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

    // Parse the response for tool calls (excluding thinking content)
    const toolCalls = this.parseToolCallsFromText(contentWithoutThinking);

    if (toolCalls.length > 0) {
      return this.executeTextBasedTools(toolCalls, fullContent, usage, settings, provider, conversationHistory, onStream);
    }

    // Return the original content (with thinking) for UI display
    // The UI component will handle parsing and displaying thinking content
    const usageInfo = usage ? {
      promptTokens: usage.promptTokens || 0,
      completionTokens: usage.completionTokens || 0,
      totalTokens: usage.totalTokens || 0
    } : undefined;

    // No cost calculation for local providers
    return {
      content: fullContent, // Keep original content with thinking for UI
      usage: usageInfo,
      cost: undefined
    };
  }

  private async executeNativeToolCalls(
    toolCalls: Array<{ id: string; type: string; function: { name: string; arguments: string } }>,
    _initialContent: string,
    _usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
    settings: LLMSettings,
    _provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {


    // Execute all tool calls
    const toolResults: Array<{ id: string; name: string; result: string; error?: boolean }> = [];

    for (const toolCall of toolCalls) {
      try {
        // Safely parse arguments with fallback
        let args: Record<string, unknown> = {};
        if (toolCall.function.arguments) {
          try {
            args = JSON.parse(toolCall.function.arguments);
          } catch {
            // Try to extract arguments using fallback parsing
            args = this.parseArgumentsFromText(toolCall.function.arguments);
          }
        }

        const result = await this.executeMCPTool(toolCall.function.name, args);
        toolResults.push({
          id: toolCall.id,
          name: toolCall.function.name,
          result: typeof result === 'string' ? result : JSON.stringify(result),
          error: false
        });
      } catch (error) {
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
          } catch {
            parsedArgs = this.parseArgumentsFromText(tc.function.arguments);
          }
        }

        // Attach execution results for UI parity with text-based tools
        const matched = toolResults.find(tr => tr.id === tc.id);

        return {
          id: tc.id,
          name: tc.function.name,
          arguments: parsedArgs,
          result: matched ? matched.result : undefined,
          error: matched ? matched.error : undefined
        };
      })
    };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  private async handleNonStreamResponse(
    response: Response,
    settings: LLMSettings,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    _conversationId?: string
  ): Promise<LLMResponse> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    const data = await response.json();
    const message = data.choices[0].message;

    // Handle tool calls if present - execute immediately like Anthropic
    if (message.tool_calls && message.tool_calls.length > 0) {

      // Check if we have the parallel execution method injected
      if ((this as unknown as {executeMultipleToolsParallel?: unknown, summarizeToolResultsForModel?: unknown}).executeMultipleToolsParallel && (this as unknown as {executeMultipleToolsParallel?: unknown, summarizeToolResultsForModel?: unknown}).summarizeToolResultsForModel) {

        
        // Format tool calls for execution
        const toolCallsForExecution = message.tool_calls.map((toolCall: { id: string; function: { name: string; arguments: string } }) => {
          // Safely parse arguments
          let parsedArgs: Record<string, unknown> = {};
          if (toolCall.function.arguments) {
            try {
              parsedArgs = JSON.parse(toolCall.function.arguments);
            } catch {
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


          // Get tool results summary for the model
          const toolSummary = (summarizeToolResultsForModel as (results: unknown[]) => string)(parallelResults);
          
          // Return response with tool results included
          const { usage, cost } = this.createUsageAndCost(settings.model, data.usage);
          return {
            content: (message.content || '') + '\n\n' + toolSummary,
            usage,
            cost
          };
        } catch {
          // Fall back to returning tool calls for external handling
          const { usage, cost } = this.createUsageAndCost(settings.model, data.usage);
          return {
            content: message.content || '',
            usage,
            cost,
            toolCalls: toolCallsForExecution
          };
        }
      } else {

        // Fall back to external handling if methods not injected
        const { usage, cost } = this.createUsageAndCost(settings.model, data.usage);
        return {
          content: message.content || '',
          usage,
          cost,
          toolCalls: message.tool_calls.map((tc: { id: string; function: { name: string; arguments: string } }) => {
            // Safely parse arguments
            let parsedArgs: Record<string, unknown> = {};
            if (tc.function.arguments) {
              try {
                parsedArgs = JSON.parse(tc.function.arguments);
              } catch {
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

      // For non-stream, we can't use onStream, so pass a no-op function
      return this.executeTextBasedTools(toolCalls, content, data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined, settings, { id: 'lmstudio', name: 'LM Studio' } as LLMProvider, conversationHistory, () => {});
    }

    const { usage, cost } = this.createUsageAndCost(settings.model, data.usage);
    return {
      content: content,
      usage,
      cost
    };
  }

  private parseToolCallsFromText(content: string): Array<{ name: string; arguments: Record<string, unknown> }> {

    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    // Get available tool names from MCP tools
    const availableTools = this.getAvailableToolNames();



    // STEP 1: Look for structured tool call formats first

    // Pattern 0: Fenced tool/function_call blocks (Harmony-style variations)
    // ```tool {"name":"web_search","arguments":{"query":"..."}} ```
    // ```function_call {"name":"...","arguments":{...}} ```
    // Also accept multiple JSON objects inside a single fenced block
    try {
      const fencedRegex = /```\s*(tool|tool_call|call|function_call)[^\n]*\n([\s\S]*?)```/gi;
      let fencedMatch: RegExpExecArray | null;
      while ((fencedMatch = fencedRegex.exec(content)) !== null) {
        const block = fencedMatch[2].trim();
        // Try to parse the block directly as JSON or detect multiple JSON objects
        // 1) Direct JSON object
        const tryParseSingle = (jsonStr: string) => {
          try {
            const obj = JSON.parse(jsonStr);
            if (obj.tool_call && obj.tool_call.name) {
              const tName = obj.tool_call.name;
              const tArgsRaw = obj.tool_call.arguments;
              const tArgs = typeof tArgsRaw === 'string' ? (JSON.parse(tArgsRaw) as Record<string, unknown>) : (tArgsRaw || {});
              if (availableTools.includes(tName)) {
                toolCalls.push({ name: tName, arguments: tArgs });
              }
              return true;
            } else if (obj.name && obj.arguments) {
              const tName = obj.name;
              const tArgsRaw = obj.arguments;
              const tArgs = typeof tArgsRaw === 'string' ? (JSON.parse(tArgsRaw) as Record<string, unknown>) : (tArgsRaw || {});
              if (availableTools.includes(tName)) {
                toolCalls.push({ name: tName, arguments: tArgs });
              }
              return true;
            } else if (Array.isArray(obj)) {
              // Array of tool calls
              for (const item of obj) {
                const tName = item?.tool_call?.name || item?.name;
                const tArgsRaw = item?.tool_call?.arguments ?? item?.arguments ?? {};
                const tArgs = typeof tArgsRaw === 'string' ? (JSON.parse(tArgsRaw) as Record<string, unknown>) : (tArgsRaw || {});
                if (tName && availableTools.includes(tName)) {
                  toolCalls.push({ name: tName, arguments: tArgs });
                }
              }
              return true;
            }
          } catch {
            // ignore
          }
          return false;
        };

        if (!tryParseSingle(block)) {
          // 2) Scan the fenced block for multiple JSON tool_call objects
          const toolCallPattern = /\{\s*"tool_call"\s*:\s*\{/gi;
          let dm: RegExpExecArray | null;
          while ((dm = toolCallPattern.exec(block)) !== null) {
            const start = dm.index;
            const extracted = JSONUtils.extractCompleteJSON(block, start);
            if (extracted) {
              try {
                const parsed = JSON.parse(extracted.jsonStr);
                if (parsed.tool_call?.name) {
                  const tName = parsed.tool_call.name;
                  const tArgsRaw = parsed.tool_call.arguments ?? {};
                  const tArgs = typeof tArgsRaw === 'string' ? (JSON.parse(tArgsRaw) as Record<string, unknown>) : tArgsRaw;
                  if (availableTools.includes(tName)) {
                    toolCalls.push({ name: tName, arguments: tArgs });
                  }
                }
              } catch {
                // ignore individual failures
              }
            }
          }
        }
      }
    } catch {
      // Fenced tool block parsing failed
    }

    if (toolCalls.length > 0) {
      return this.deduplicateToolCalls(toolCalls);
    }

    // Pattern 1: New model format with optional commentary prefix and to=tool_name and JSON arguments
    // Example: "commentary to=web_search json{"query":"dad joke", "topn":5}" or "to=list_directoryjson{...}"
    // Updated to handle nested JSON, multiple tool calls, hyphens, function namespace prefixes, and optional space before json
    // Made more robust to handle underscores and longer tool names
    const newModelFormatRegex = /(?:commentary\s+)?to=(?:functions\.)?([a-zA-Z_][a-zA-Z0-9_-]+)\s*json(\{(?:[^{}]|{[^{}]*})*\})/gi;

    // Pattern 1b: Nested function call format - to=functions json{"name":"tool_name","arguments":{...}}
    // CHECK THIS FIRST before the general pattern to avoid conflicts
    const nestedFunctionFormatRegex = /(?:commentary\s+)?to=functions\s*json\{[^}]*"name"\s*:\s*"([^"]+)"[^}]*"arguments"\s*:\s*(\{[^}]*\})[^}]*\}/gi;

    // Handle nested function format FIRST

    let nestedMatch;
    while ((nestedMatch = nestedFunctionFormatRegex.exec(content)) !== null) {
      try {
        const rawToolName = nestedMatch[1];
        const jsonArgs = nestedMatch[2];

        // Only parse tools that actually exist - no guessing or mapping
        if (availableTools.includes(rawToolName)) {
          try {
            const args = JSON.parse(jsonArgs);
            toolCalls.push({ name: rawToolName, arguments: args });
          } catch {
            // Failed to parse JSON arguments
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
        // Failed to parse nested function format tool call
      }
    }

    // If we found nested function calls, deduplicate and return them
    if (toolCalls.length > 0) {
      return this.deduplicateToolCalls(toolCalls);
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
            // Failed to parse JSON arguments
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
        // Failed to parse new model format tool call
      }
    }

    // If we found any new model format tool calls, deduplicate and return them
    if (toolCalls.length > 0) {
      return this.deduplicateToolCalls(toolCalls);
    }

    // Pattern 2: Enhanced tool_call format with ```json wrapper (Option 2)
    // ```json { "tool_call": { "name": "web_search", "arguments": {...} } } ```
    const jsonWrappedToolCallRegex = /```json\s*(\{[\s\S]*?"tool_call"[\s\S]*?\})\s*```/gi;
    const match = jsonWrappedToolCallRegex.exec(content);
    if (match) {
      try {
        const jsonObj = JSON.parse(match[1]);
        if (Array.isArray(jsonObj)) {
          for (const item of jsonObj) {
            const tName = item?.tool_call?.name || item?.name;
            if (!tName) continue;
            const tArgsRaw = item?.tool_call?.arguments ?? item?.arguments ?? {};
            const tArgs = typeof tArgsRaw === 'string' ? (JSON.parse(tArgsRaw) as Record<string, unknown>) : tArgsRaw;
            if (availableTools.includes(tName)) {
              toolCalls.push({ name: tName, arguments: tArgs });
            }
          }
          if (toolCalls.length > 0) {
            return this.deduplicateToolCalls(toolCalls);
          }
        } else if (jsonObj.tool_call && jsonObj.tool_call.name) {
          const tName = jsonObj.tool_call.name;
          const tArgsRaw = jsonObj.tool_call.arguments ?? {};
          const tArgs = typeof tArgsRaw === 'string' ? (JSON.parse(tArgsRaw) as Record<string, unknown>) : tArgsRaw;
          toolCalls.push({ name: tName, arguments: tArgs });

          return toolCalls; // Return early if we found the structured format
        }
      } catch {
        // Failed to parse JSON-wrapped tool call
      }
    }

    // Pattern 3: Direct JSON tool_call format (Option 1)
    // { "tool_call": { "name": "web_search", "arguments": {...} } }
    // Robust iterative scan for direct tool_call objects, including multiple occurrences
    const toolCallPattern = /\{\s*"tool_call"\s*:\s*\{/gi;
    let directMatch: RegExpExecArray | null;
    while ((directMatch = toolCallPattern.exec(content)) !== null) {
      try {
        const startIndex = directMatch.index;
        const extracted = JSONUtils.extractCompleteJSON(content, startIndex);
        if (extracted) {
          const parsed = JSON.parse(extracted.jsonStr);
          if (parsed.tool_call?.name) {
            const tName = parsed.tool_call.name;
            const tArgsRaw = parsed.tool_call.arguments ?? {};
            const tArgs = typeof tArgsRaw === 'string' ? (JSON.parse(tArgsRaw) as Record<string, unknown>) : tArgsRaw;
            toolCalls.push({ name: tName, arguments: tArgs });
          }
        }
      } catch {
        // Failed to parse direct tool_call JSON
      }
    }
    if (toolCalls.length > 0) {
      return this.deduplicateToolCalls(toolCalls);
    }

    // Pattern 4: Look for any JSON blocks and check if they contain tool calls
    const jsonBlockRegex = /```json\s*([\s\S]*?)\s*```/gi;
    let jsonMatch;
    while ((jsonMatch = jsonBlockRegex.exec(content)) !== null) {
      try {
        const jsonText = jsonMatch[1].trim();
        const jsonObj = JSON.parse(jsonText);
        if (Array.isArray(jsonObj)) {
          for (const item of jsonObj) {
            const tName = item?.tool_call?.name || item?.name;
            if (!tName) continue;
            const tArgsRaw = item?.tool_call?.arguments ?? item?.arguments ?? {};
            const tArgs = typeof tArgsRaw === 'string' ? (JSON.parse(tArgsRaw) as Record<string, unknown>) : tArgsRaw;
            if (availableTools.includes(tName)) {
              toolCalls.push({ name: tName, arguments: tArgs });
            }
          }
        } else if (jsonObj.tool_call && jsonObj.tool_call.name) {
          const tName = jsonObj.tool_call.name;
          const tArgsRaw = jsonObj.tool_call.arguments ?? {};
          const tArgs = typeof tArgsRaw === 'string' ? (JSON.parse(tArgsRaw) as Record<string, unknown>) : tArgsRaw;
          toolCalls.push({
            name: tName,
            arguments: tArgs
          });
        }
      } catch {
        // Failed to parse JSON block
      }
    }

    // If we found structured tool calls, return them
    if (toolCalls.length > 0) {

      return toolCalls;
    }

    // STEP 2: If no structured tool calls found, search for traces of tool usage in text


    return this.parseToolTracesFromText(content, availableTools);
  }

  private parseToolTracesFromText(content: string, availableTools: string[]): Array<{ name: string; arguments: Record<string, unknown> }> {
    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];



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

          continue;
        }
      }
    }


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

      if (Object.keys(args).length === 0) {
        // Last resort: attempt to salvage from malformed JSON
        const recovered = JSONUtils.extractArgumentsFromMalformedJson(argsText);
        if (Object.keys(recovered).length > 0) {

          return recovered;
        }
      }


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
    _originalContent: string,
    _usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined,
    settings: LLMSettings,
    _provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    // STEP 1: Show tool execution start but CONTINUE streaming thinking content

    // Show tool execution start
    const toolNames = toolCalls.map(tc => `- ${tc.name}`).join('\n');
    const toolExecutionHeader = `\n\n<tool_execution>\n🔧 **Tool Execution Started**\n\nExecuting ${toolCalls.length} tool${toolCalls.length !== 1 ? 's' : ''}:\n${toolNames}\n</tool_execution>\n\n`;
    onStream(toolExecutionHeader);

    // Execute all tool calls
    const toolResults: Array<{ name: string; result: string; error?: boolean }> = [];

    // STEP 2: Execute ALL tools to completion WITHOUT streaming

    for (const toolCall of toolCalls) {
      try {
        // Handle error responses from tool parsing
        if (toolCall.name === 'error_response') {
          const errVal = (toolCall.arguments as Record<string, unknown>)?.error;

          const errStr = typeof errVal === 'string' ? errVal : JSON.stringify(errVal ?? 'Tool parsing error');
          toolResults.push({
            name: 'error_response',
            result: errStr,
            error: true
          });
          continue;
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

    // STEP 3: Show tool execution completion and prepare for fresh LLM call
    const successCount = toolResults.filter(tr => !tr.error).length;
    const failureCount = toolResults.filter(tr => tr.error).length;



    // Show completion in UI
    const completionMessage = `<tool_execution>\n🏁 **Tool Execution Complete**\n\n✅ ${successCount} successful, ❌ ${failureCount} failed\n\nStarting fresh LLM call with results...\n</tool_execution>\n\n`;
    onStream(completionMessage);

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

    // STEP 4: Make completely fresh LLM call with clean conversation history

    // Make a follow-up call without tools (following official LM Studio pattern)
    const followUpResponse = await this.makeDirectFollowUpCall(
      properConversationHistory as Array<{role: string, content: string | Array<ContentItem>}>,
      settings,
      onStream
    );

    // According to LM Studio docs, we should return ONLY the final assistant response
    // Tool execution details are handled by the UI separately via toolCalls


    return {
      content: followUpResponse.content || '',
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

  private getLastUserMessage(conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>): string {
    const userMessages = conversationHistory.filter(msg => msg.role === 'user');
    if (userMessages.length === 0) return 'Please help me with the information provided.';

    const lastMessage = userMessages[userMessages.length - 1];
    return typeof lastMessage.content === 'string' ? lastMessage.content : 'Please help me with the information provided.';
  }

  /**
   * Builds proper conversation history following official LM Studio format
   * Format: User message → Assistant tool call message → Tool result messages → Final response
   * IMPORTANT: Filters out previous tool results to prevent prompt poisoning
   */
  private buildProperConversationHistory(
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    toolCalls: Array<{ id: string; name: string; result: string; error?: boolean }>,
    originalToolCallsFormat: Array<{ id: string; type: string; function: { name: string; arguments: string } }>
  ): Array<Record<string, unknown>> {

    // Include conversation history but filter out previous tool results to prevent prompt poisoning
    const cleanedHistory = conversationHistory.filter(msg => {
      // Keep user messages and assistant messages that don't contain tool execution results
      if (msg.role === 'user') return true;
      if (msg.role === 'assistant') {
        const content = typeof msg.content === 'string' ? msg.content : '';
        // Filter out messages that contain tool execution results from previous turns
        return !content.includes('<tool_execution>') && !content.includes('Tool Execution');
      }
      // Filter out tool role messages from previous turns
      return msg.role !== 'tool';
    });



    const messages: Array<Record<string, unknown>> = [...cleanedHistory];

    // Add the assistant message with tool calls (following official format)
    const assistantToolCallMessage = {
      role: 'assistant',
      content: '',
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
        tool_call_id: toolResult.id,
        name: toolResult.name
      };
      messages.push(toolResultMessage);
    }

    // Add a final instruction prompting the model to use the tool outputs
    const finalInstruction = {
      role: 'user',
      content: `Use the tool outputs above to produce the final answer to your previous request: "${this.getLastUserMessage(conversationHistory)}". Do not call tools again. Provide a concise answer grounded in those results.`
    };
    messages.push(finalInstruction);


    return messages;
  }

  private async makeDirectFollowUpCall(
    messages: Array<{role: string, content: string | Array<ContentItem>}>,
    settings: LLMSettings,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    // According to official LM Studio documentation, the follow-up call should NOT include tools
    // This prevents recursive tool calling and ensures proper synchronization

    // Use the original system prompt for follow-up calls (maintain consistency)
    const finalResponsePrompt = settings.systemPrompt || this.getSystemPrompt();

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



    // No recursive tool calling - following official LM Studio pattern
    // The follow-up call should provide the final response without calling more tools


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
    // Remove various thinking patterns and model template tags from content before parsing for tool calls
    let cleanedContent = content;

    // Remove <think>...</think> blocks
    cleanedContent = cleanedContent.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // Remove <thinking>...</thinking> blocks
    cleanedContent = cleanedContent.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '');

    // Remove unclosed thinking tags (in case they're at the end)
    cleanedContent = cleanedContent.replace(/<think>[\s\S]*$/gi, '');
    cleanedContent = cleanedContent.replace(/<thinking>[\s\S]*$/gi, '');

    // Remove model-specific template tags more aggressively
    // New model format tags: <|start|>, <|message|>, <|channel|>, <|end|>, <|constrain|>
    cleanedContent = cleanedContent.replace(/<\|start\|>/gi, '');
    cleanedContent = cleanedContent.replace(/<\|message\|>/gi, '');
    cleanedContent = cleanedContent.replace(/<\|channel\|>/gi, '');
    cleanedContent = cleanedContent.replace(/<\|end\|>/gi, '');
    cleanedContent = cleanedContent.replace(/<\|constrain\|>/gi, '');

    // Qwen3 format tags: <|im_start|>, <|im_end|>
    cleanedContent = cleanedContent.replace(/<\|im_start\|>/gi, '');
    cleanedContent = cleanedContent.replace(/<\|im_end\|>/gi, '');

    // Remove role indicators that might appear after template tags (only at start of lines or after colons)
    cleanedContent = cleanedContent.replace(/^(system|user|assistant):\s*/gim, '');
    cleanedContent = cleanedContent.replace(/\n(system|user|assistant):\s*/gi, '\n');

    // Remove channel indicators that might appear after <|channel|> tags (only at start of lines or after colons)
    cleanedContent = cleanedContent.replace(/^(final|analysis|commentary):\s*/gim, '');
    cleanedContent = cleanedContent.replace(/\n(final|analysis|commentary):\s*/gi, '\n');

    // Clean up any remaining template-like patterns
    cleanedContent = cleanedContent.replace(/<\|[^|]*\|>/gi, '');

    // Remove template sequences that span multiple tags
    cleanedContent = cleanedContent.replace(/<\|end\|><\|start\|>assistant<\|channel\|>commentary/gi, '');
    cleanedContent = cleanedContent.replace(/<\|constrain\|>json<\|message\|>/gi, ' json');

    // Remove tool execution blocks that might be mixed in the response
    cleanedContent = cleanedContent.replace(/<tool_execution>[\s\S]*?<\/tool_execution>/gi, '');

    // Remove any remaining tool execution indicators
    cleanedContent = cleanedContent.replace(/🔧\s*\*\*Tool Execution Started\*\*/gi, '');
    cleanedContent = cleanedContent.replace(/🏁\s*\*\*Tool Execution Complete\*\*/gi, '');
    cleanedContent = cleanedContent.replace(/Executing \d+ tools?:/gi, '');
    cleanedContent = cleanedContent.replace(/✅ \d+ successful, ❌ \d+ failed/gi, '');

    // Clean up any extra whitespace
    cleanedContent = cleanedContent.trim();

    return cleanedContent;
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

  /**
   * Create usage information from LM Studio API response (no cost calculation for local provider)
   */
  private createUsageAndCost(_model: string, usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) {
    if (!usage) return { usage: undefined, cost: undefined };

    const usageInfo = {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0
    };

    // No cost calculation for local providers
    return { usage: usageInfo, cost: undefined };
  }
}
