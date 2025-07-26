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
      // For models without structured tools, use enhanced system prompt with proper tool calling instructions
      const enhancedSystemPrompt = this.enhanceSystemPromptWithTools(systemPrompt, tools as ToolObject[], underlyingProvider);
      console.log(`🔧 OpenRouter enhanced system prompt for ${underlyingProvider} (${enhancedSystemPrompt.length - systemPrompt.length} chars added)`);

      if (underlyingProvider === 'anthropic') {
        requestBody.system = enhancedSystemPrompt;
      } else {
        // Update system message in messages array
        const systemMessageIndex = (messages as Array<{role: string, content: string}>).findIndex(m => m.role === 'system');
        if (systemMessageIndex >= 0) {
          (messages as Array<{role: string, content: string}>)[systemMessageIndex].content = enhancedSystemPrompt;
        }
      }
      console.log(`🚀 OpenRouter API call with ${tools.length} text-based tools for ${underlyingProvider} model (enhanced system prompt)`);
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

  /**
   * Parse text-based tool calls from model response content
   * Handles various formats that models might use when structured tool calling isn't supported
   */
  private parseTextBasedToolCalls(content: string, availableTools: string[] = []): Array<{ name: string; arguments: Record<string, unknown> }> {
    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    console.log(`🔍 OpenRouter parsing text for tool calls in content:`, content.substring(0, 200) + '...');

    // Pattern 0: Simple functions.tool_name:id format (most common)
    // functions.list_processes:0, functions.write_file:1, etc.
    const simpleFunctionRegex = /functions\.([a-zA-Z_][a-zA-Z0-9_]*):(\d+)/gi;
    let simpleMatch = simpleFunctionRegex.exec(content);
    while (simpleMatch) {
      const toolName = simpleMatch[1];
      const toolId = simpleMatch[2];

      // Check if this tool is available
      if (availableTools.length === 0 || availableTools.includes(toolName)) {
        // For simple format, we need to extract arguments from context or use empty object
        const args = this.extractArgumentsForSimpleToolCall(content, toolName, toolId);
        toolCalls.push({ name: toolName, arguments: args });
        console.log(`✅ Found simple function format tool call: ${toolName}:${toolId} with args:`, args);
      } else {
        console.log(`⚠️ Tool ${toolName} not in available tools list:`, availableTools);
      }
      simpleMatch = simpleFunctionRegex.exec(content);
    }

    // Pattern 1: Custom OpenRouter/model-specific format with delimiters
    // <|tool_calls_section_begin|><|tool_call_begin|>functions.tool_name:1<|tool_call_argument_begin|>{"arg": "value"}<|tool_call_end|><|tool_calls_section_end|>
    const customFormatRegex = /<\|tool_call_begin\|>(?:functions\.)?([^:]+):\d+<\|tool_call_argument_begin\|>(\{[\s\S]*?\})<\|tool_call_end\|>/gi;
    let match = customFormatRegex.exec(content);
    while (match) {
      try {
        const toolName = match[1];
        let args = JSON.parse(match[2]);

        // Handle nested input structure: {"input": {"path": "..."}} -> {"path": "..."}
        if (args.input && typeof args.input === 'object' && Object.keys(args).length === 1) {
          args = args.input;
          console.log(`🔧 Unwrapped nested input structure for ${toolName}`);
        }

        toolCalls.push({ name: toolName, arguments: args });
        console.log(`✅ Found custom format tool call: ${toolName} with args:`, args);
      } catch (error) {
        console.warn(`⚠️ Failed to parse custom format tool call:`, match[0], error);
      }
      match = customFormatRegex.exec(content);
    }

    // Pattern 2: Enhanced tool_call format with ```json wrapper (Option 2)
    // ```json { "tool_call": { "name": "web_search", "arguments": {...} } } ```
    const jsonWrappedToolCallRegex = /```json\s*(\{[\s\S]*?"tool_call"[\s\S]*?\})\s*```/gi;
    match = jsonWrappedToolCallRegex.exec(content);
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
        console.log(`⚠️ Failed to parse JSON-wrapped tool call:`, match[1], error);
      }
    }

    // Pattern 3: Direct JSON tool_call format (Option 1)
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
      } catch (error) {
        console.log(`⚠️ Failed to parse direct tool call arguments:`, match[2], error);
        // Try fallback parsing
        const toolName = match[1];
        const args = this.parseArgumentsFromText(match[2]);
        if (Object.keys(args).length > 0) {
          toolCalls.push({ name: toolName, arguments: args });
          console.log(`✅ Found direct tool call with fallback parsing: ${toolName} with args:`, args);
          return toolCalls;
        }
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

  /**
   * Extract arguments for simple tool calls (functions.tool_name:id format)
   * Looks for JSON objects or argument patterns near the tool call
   */
  private extractArgumentsForSimpleToolCall(content: string, toolName: string, toolId: string): Record<string, unknown> {
    // Look for JSON objects near the tool call
    const toolCallPattern = `functions\\.${toolName}:${toolId}`;
    const toolCallIndex = content.search(new RegExp(toolCallPattern));

    if (toolCallIndex === -1) {
      return {};
    }

    // Search for JSON objects in the surrounding context (500 chars before and after)
    const contextStart = Math.max(0, toolCallIndex - 500);
    const contextEnd = Math.min(content.length, toolCallIndex + 500);
    const context = content.substring(contextStart, contextEnd);

    // Look for JSON objects in the context
    const jsonRegex = /\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g;
    let match;
    while ((match = jsonRegex.exec(context)) !== null) {
      try {
        const parsed = JSON.parse(match[0]);
        // If it's a valid object with reasonable properties, use it
        if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 0) {
          console.log(`🔧 Extracted arguments for ${toolName} from context:`, parsed);
          return parsed;
        }
      } catch {
        // Continue searching
      }
    }

    // If no JSON found, return empty object (tool will use defaults)
    console.log(`🔧 No arguments found for ${toolName}, using empty object`);
    return {};
  }

  /**
   * Parse tool usage traces from natural language text
   */
  private parseToolTracesFromText(content: string, availableTools: string[]): Array<{ name: string; arguments: Record<string, unknown> }> {
    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    console.log(`🔍 Searching for tool usage traces in content...`);

    for (const toolName of availableTools) {
      // Pattern 1: Direct tool mentions with arguments
      // "I'll use web_search with query 'weather Paris'"
      const directMentionPattern = new RegExp(`(?:use|using|call|calling)\\s+${toolName}\\s+(?:with|for)\\s+([^.!?]+)`, 'gi');
      const directMatch = directMentionPattern.exec(content);
      if (directMatch && !toolCalls.find(tc => tc.name === toolName)) {
        const argsText = directMatch[1].trim();
        const args = this.parseArgumentsFromText(argsText);
        if (Object.keys(args).length > 0) {
          toolCalls.push({ name: toolName, arguments: args });
          console.log(`✅ Found direct mention: ${toolName} with args:`, args);
          continue;
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

      // Pattern 3: Action descriptions
      // "I'll search for weather in Paris" (for web_search tool)
      if (toolName === 'web_search' || toolName === 'web-search') {
        const searchPattern = /(?:search|find|look up|query)(?:\s+for)?\s+([^.!?]+)/gi;
        const searchMatch = searchPattern.exec(content);
        if (searchMatch && !toolCalls.find(tc => tc.name === toolName)) {
          const query = searchMatch[1].trim().replace(/['"]/g, '');
          if (query.length > 2) {
            toolCalls.push({ name: toolName, arguments: { query } });
            console.log(`✅ Found search action: ${toolName} with query: "${query}"`);
            continue;
          }
        }
      }
    }

    console.log(`🔍 Found ${toolCalls.length} tool usage traces`);
    return toolCalls;
  }

  /**
   * Parse arguments from text using various heuristics
   */
  private parseArgumentsFromText(text: string): Record<string, unknown> {
    const args: Record<string, unknown> = {};

    try {
      // Try to parse as JSON first
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Continue with other parsing methods
    }

    // Parse key=value pairs
    const keyValuePattern = /(\w+)\s*[=:]\s*['"]?([^'",]+)['"]?/g;
    let match;
    while ((match = keyValuePattern.exec(text)) !== null) {
      args[match[1]] = match[2].trim();
    }

    // If no key-value pairs found, treat as single query parameter
    if (Object.keys(args).length === 0) {
      const cleanText = text.replace(/['"]/g, '').trim();
      if (cleanText.length > 0) {
        args.query = cleanText;
      }
    }

    return args;
  }

  /**
   * Get available tool names for text-based parsing
   */
  private async getAvailableToolNames(settings: LLMSettings): Promise<string[]> {
    try {
      const tools = await this.getOpenRouterTools(settings);
      return tools.map((tool: unknown) => {
        const typedTool = tool as { function?: { name?: string } };
        return typedTool.function?.name || 'unknown_tool';
      }).filter(name => name !== 'unknown_tool');
    } catch (error) {
      console.error('❌ Failed to get tool names for parsing:', error);
      return [];
    }
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
    const supportsStructuredTools = this.modelSupportsStructuredTools(underlyingProvider);
    console.log(`🔍 OpenRouter model "${settings.model}" detected as underlying provider: ${underlyingProvider}`);
    console.log(`🔍 OpenRouter structured tools support: ${supportsStructuredTools} for provider: ${underlyingProvider}`);

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

  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[], underlyingProvider?: string): string {
    if (tools.length === 0) {
      return basePrompt;
    }

    // For structured tool calling providers, don't add XML tool instructions
    // The tools are sent via the tools parameter and the LLM should use native function calling
    const provider = underlyingProvider || 'openai'; // Default to openai if not specified
    const supportsStructuredTools = this.modelSupportsStructuredTools(provider);

    if (supportsStructuredTools) {
      // For structured tools, just return the base prompt
      // The LLM will use native function calling based on the tools parameter
      console.log(`🔧 OpenRouter using structured tools for ${provider}, skipping XML tool instructions`);
      return basePrompt;
    } else {
      // For text-based tool calling, add the complex tool instructions with XML format
      console.log(`🔧 OpenRouter using text-based tools for ${provider}, adding XML tool instructions`);
      const toolInstructions = generateOpenRouterToolPrompt(tools);
      return basePrompt + toolInstructions;
    }
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
        console.log(`🔧 Executing OpenRouter tool call: ${toolCall.name} with args:`, toolCall.arguments);
        console.log(`🔧 OpenRouter executeMCPTool method available:`, typeof this.executeMCPTool);

        const toolResult = await this.executeMCPTool(toolCall.name, toolCall.arguments);
        console.log(`✅ OpenRouter tool execution successful for ${toolCall.name}:`, toolResult?.substring(0, 100) + '...');

        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.name,
          content: toolResult
        });
      } catch (error) {
        console.error(`❌ OpenRouter tool execution failed for ${toolCall.name}:`, error);
        console.error(`❌ Error details:`, {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        });

        const errorMessage = `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`;
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.name,
          content: JSON.stringify({ error: errorMessage })
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
      ...toolResults,
      {
        role: 'user',
        content: 'Please provide a final response based on the tool execution results above. Analyze the data and answer the user\'s most recent question directly. Do not repeat previous responses or refer to earlier requests in this conversation.'
      }
    ];

    console.log(`🔄 Making OpenRouter follow-up call to process tool results...`);

    // Get tools for follow-up call to maintain structured tool calling context
    const tools = await this.getOpenRouterTools(settings);
    const underlyingProvider = this.detectUnderlyingProvider(settings.model);
    const supportsStructuredTools = this.modelSupportsStructuredTools(underlyingProvider);

    const followUpRequestBody: Record<string, unknown> = {
      model: settings.model,
      messages: followUpMessages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: false
    };

    // Include tools in follow-up call to maintain structured tool calling context
    if (supportsStructuredTools && tools.length > 0) {
      followUpRequestBody.tools = tools;
      followUpRequestBody.tool_choice = 'auto';
      console.log(`🔧 OpenRouter follow-up call includes ${tools.length} structured tools to maintain context`);
    }

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

    console.log(`🔍 Starting OpenRouter stream response handling...`);
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
          console.log(`🔍 OpenRouter stream chunk ${chunkCount}:`, chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''));
        }
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

              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  const index = toolCall.index || 0;
                  if (!toolCalls[index]) {
                    toolCalls[index] = {
                      id: toolCall.id,
                      type: toolCall.type,
                      function: { name: '', arguments: '' }
                    };
                  }

                  if (toolCall.function?.name) {
                    toolCalls[index].function!.name = toolCall.function.name;
                  }
                  if (toolCall.function?.arguments) {
                    toolCalls[index].function!.arguments += toolCall.function.arguments;
                  }
                }
              }

              if (parsed.usage) {
                usage = parsed.usage;
              }
            } catch (error) {
              console.error(`❌ OpenRouter error parsing chunk:`, error, `Data: ${data.substring(0, 100)}...`);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Filter out empty tool calls and log final state
    const validToolCalls = toolCalls.filter(tc => tc && tc.function?.name);

    console.log(`🔍 OpenRouter stream response completed:`, {
      contentLength: fullContent.length,
      hasUsage: !!usage,
      usage: usage,
      toolCallsCount: validToolCalls.length
    });

    // Check for text-based tool calls if no structured tool calls found
    if (validToolCalls.length === 0 && fullContent && (fullContent.includes('tool_call') || fullContent.includes('<|tool_call') || fullContent.includes('functions.'))) {
      console.log(`🔍 OpenRouter: No structured tool calls found in stream, checking for text-based tool calls...`);

      // Get available tool names for parsing
      const availableTools = await this.getAvailableToolNames(settings);
      const textBasedToolCalls = this.parseTextBasedToolCalls(fullContent, availableTools);

      if (textBasedToolCalls.length > 0) {
        console.log(`🔧 OpenRouter: Found ${textBasedToolCalls.length} text-based tool calls in stream:`, textBasedToolCalls);

        // Convert to structured format and execute
        const structuredToolCalls = textBasedToolCalls.map((tc, index) => ({
          id: `call_${Date.now()}_${index}`,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments)
          }
        }));

        // Execute tools and get follow-up response
        return this.executeToolsAndFollowUp(
          structuredToolCalls,
          fullContent,
          usage,
          settings,
          provider,
          conversationHistory,
          onStream
        );
      }
    }

    if (validToolCalls.length > 0) {
      console.log(`🔧 OpenRouter assembled ${validToolCalls.length} structured tool calls:`, validToolCalls.map(tc => ({
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
    const choice = data.choices[0];
    const message = choice.message;

    console.log('🔍 OpenRouter non-stream response:', {
      hasToolCalls: !!(message.tool_calls && message.tool_calls.length > 0),
      toolCallsCount: message.tool_calls?.length || 0,
      content: message.content,
      usage: data.usage
    });

    // Check for text-based tool calls if no structured tool calls found
    if (!message.tool_calls || message.tool_calls.length === 0) {
      if (message.content && (message.content.includes('tool_call') || message.content.includes('<|tool_call') || message.content.includes('functions.'))) {
        console.log(`🔍 OpenRouter: No structured tool calls found, checking for text-based tool calls...`);

        // Get available tool names for parsing
        const availableTools = await this.getAvailableToolNames(settings);
        const textBasedToolCalls = this.parseTextBasedToolCalls(message.content, availableTools);

        if (textBasedToolCalls.length > 0) {
          console.log(`🔧 OpenRouter: Found ${textBasedToolCalls.length} text-based tool calls:`, textBasedToolCalls);

          // Convert to structured format and execute
          const structuredToolCalls = textBasedToolCalls.map((tc, index) => ({
            id: `call_${Date.now()}_${index}`,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments)
            }
          }));

          // Execute tools and get follow-up response
          return this.executeToolsAndFollowUp(
            structuredToolCalls,
            message.content || '',
            data.usage,
            settings,
            { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' } as LLMProvider,
            conversationHistory
          );
        }
      }
    }

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
