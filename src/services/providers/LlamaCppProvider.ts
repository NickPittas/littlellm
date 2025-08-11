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

import { LLAMACPP_SYSTEM_PROMPT } from './prompts/llamacpp';
import { OpenAICompatibleStreaming } from './shared/OpenAICompatibleStreaming';

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

  async sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
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

    // Get system prompt with tool descriptions if needed
    let systemPrompt = settings.systemPrompt || this.getSystemPrompt();
    if (needsTools && settings.toolCallingEnabled) {
      try {
        const tools = await this.getMCPToolsForProvider(this.id, settings);
        if (tools.length > 0) {
          systemPrompt = this.enhanceSystemPromptWithTools(systemPrompt, tools as ToolObject[]);
          console.log(`🔧 Llama.cpp: Enhanced system prompt with ${tools.length} tools`);
        }
      } catch (error) {
        console.warn('🚨 Llama.cpp: Failed to get tools:', error);
      }
    }

    // Add system message
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
    } else if (message.content) {
      messages.push({
        role: 'user',
        content: message.content
      });
    }

    const requestBody = {
      model: settings.model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };

    console.log(`🔍 Llama.cpp: Sending request to ${baseUrl}/chat/completions`);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey || 'no-key'}`
        },
        body: JSON.stringify(requestBody),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Llama.cpp API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      if (onStream) {
        return this.handleStreamResponse(response, onStream, settings, provider, conversationHistory, signal);
      } else {
        return this.handleNonStreamResponse(response, settings, provider, conversationHistory);
      }
    } catch (error) {
      console.error('🚨 Llama.cpp: Request failed:', error);
      throw error;
    }
  }

  async fetchModels(apiKey: string, baseUrl?: string): Promise<string[]> {
    try {
      const url = baseUrl || 'http://127.0.0.1:8080/v1';
      const modelsUrl = url.endsWith('/v1') ? `${url}/models` : `${url}/v1/models`;
      
      console.log(`🔍 Llama.cpp: Fetching models from ${modelsUrl}`);
      
      const response = await fetch(modelsUrl, {
        headers: {
          'Authorization': `Bearer ${apiKey || 'no-key'}`
        }
      });

      if (!response.ok) {
        console.warn(`⚠️ Llama.cpp: Failed to fetch models: ${response.status}`);
        return [];
      }

      const data = await response.json();
      const models = data.data?.map((model: any) => model.id) || [];
      
      console.log(`✅ Llama.cpp: Found ${models.length} models:`, models);
      return models;
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

    const toolObj = tool as any;
    
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
      const params = tool.parameters?.properties ? 
        Object.entries(tool.parameters.properties).map(([name, prop]: [string, any]) => 
          `  - ${name}: ${prop.description || 'No description'}`
        ).join('\n') : '';
      
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
    const messageText = typeof message === 'string' ? message : message.content || '';
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
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    return OpenAICompatibleStreaming.handleStreamResponse(
      response,
      onStream,
      (content, usage) => this.processResponseForTools(content, usage, settings, provider, conversationHistory, onStream),
      signal
    );
  }

  private async handleNonStreamResponse(
    response: Response,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>
  ): Promise<LLMResponse> {
    const data: APIResponseData = await response.json();
    const message = data.choices?.[0]?.message;
    const content = message?.content || '';

    return this.processResponseForTools(
      content,
      data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      } : undefined,
      settings,
      provider,
      conversationHistory
    );
  }

  private async processResponseForTools(
    content: string,
    usage: any,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream?: (chunk: string) => void
  ): Promise<LLMResponse> {
    // Check for tool calls in the response
    if (settings.toolCallingEnabled) {
      const toolCalls = this.parseToolCallsFromText(content);
      if (toolCalls.length > 0) {
        console.log(`🔧 Llama.cpp found ${toolCalls.length} tool calls`);
        return this.executeTextBasedTools(toolCalls, content, usage, settings, provider, conversationHistory, onStream);
      }
    }

    return {
      content,
      usage,
      toolCalls: []
    };
  }

  private parseToolCallsFromText(text: string): Array<{ name: string; arguments: Record<string, unknown> }> {
    const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];

    // Parse tool calls in the format:
    // <tool_call>
    // <tool_name>tool_name</tool_name>
    // <arguments>{"param": "value"}</arguments>
    // </tool_call>

    const toolCallRegex = /<tool_call>\s*<tool_name>(.*?)<\/tool_name>\s*<arguments>(.*?)<\/arguments>\s*<\/tool_call>/gs;
    let match;

    while ((match = toolCallRegex.exec(text)) !== null) {
      const toolName = match[1].trim();
      const argumentsText = match[2].trim();

      try {
        const args = JSON.parse(argumentsText);
        toolCalls.push({
          name: toolName,
          arguments: args
        });
      } catch (error) {
        console.warn(`🚨 Llama.cpp: Failed to parse tool arguments for ${toolName}:`, error);
      }
    }

    return toolCalls;
  }

  private async executeTextBasedTools(
    toolCalls: Array<{ name: string; arguments: Record<string, unknown> }>,
    originalContent: string,
    usage: any,
    settings: LLMSettings,
    provider: LLMProvider,
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

  private formatToolError(toolName: string, error: any): string {
    const errorMessage = error?.message || String(error);
    return `Error executing ${toolName}: ${errorMessage}`;
  }

  // This method is injected by the main service
  public executeMCPTool: (toolName: string, args: Record<string, unknown>) => Promise<string> = async (toolName: string, args: Record<string, unknown>) => {
    console.error('🚨 Llama.cpp: executeMCPTool called but not injected! This should not happen.');
    return JSON.stringify({ error: 'Tool execution not available - injection failed' });
  };
}
