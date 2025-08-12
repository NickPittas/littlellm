// Shared streaming implementation for OpenAI-compatible providers
// This can be used by OpenAI, OpenRouter, Mistral, DeepSeek, LM Studio, etc.



// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('../../debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}

import {
  LLMSettings,
  LLMResponse,
  ContentItem,
  LLMProvider
} from '../types';

export interface OpenAICompatibleToolCall {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface OpenAICompatibleUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

export class OpenAICompatibleStreaming {
  /**
   * Handle streaming response for OpenAI-compatible providers
   */
  static async handleStreamResponse(
    response: Response,
    onStream: (chunk: string) => void,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    providerName: string,
    executeToolsAndFollowUp: (
      toolCalls: OpenAICompatibleToolCall[],
      initialContent: string,
      initialUsage: OpenAICompatibleUsage | undefined,
      settings: LLMSettings,
      provider: LLMProvider,
      conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
      onStream: (chunk: string) => void
    ) => Promise<LLMResponse>
  ): Promise<LLMResponse> {
    safeDebugLog('info', 'OPENAICOMPATIBLESTREAMING', `🔍 Starting ${providerName} stream response handling...`);
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let fullContent = '';
    let usage: OpenAICompatibleUsage | undefined = undefined;
    let chunkCount = 0;
    const toolCalls: OpenAICompatibleToolCall[] = [];
    const decoder = new TextDecoder();

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        chunkCount++;
        if (chunkCount <= 3) {
          safeDebugLog('info', 'OPENAICOMPATIBLESTREAMING', `🔍 ${providerName} stream chunk ${chunkCount}:`, chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''));
        }
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (chunkCount <= 5) {
                safeDebugLog('info', 'OPENAICOMPATIBLESTREAMING', `🔍 ${providerName} parsed chunk ${chunkCount}:`, JSON.stringify(parsed, null, 2));
              }

              const choice = parsed.choices?.[0];
              const delta = choice?.delta;
              const content = delta?.content || '';

              if (content && typeof content === 'string') {
                fullContent += content;
                onStream(content);
                safeDebugLog('info', 'OPENAICOMPATIBLESTREAMING', `📝 ${providerName} content chunk: "${content}"`);
              } else if (content) {
                safeDebugLog('warn', 'OPENAICOMPATIBLESTREAMING', `⚠️ ${providerName} content chunk is not a string:`, typeof content, content);
              }

              // Check for tool calls and assemble them
              if (delta?.tool_calls) {
                safeDebugLog('info', 'OPENAICOMPATIBLESTREAMING', `🔧 ${providerName} tool calls detected:`, delta.tool_calls);

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
              safeDebugLog('error', 'OPENAICOMPATIBLESTREAMING', `❌ ${providerName} error parsing chunk:`, error, `Data: ${data.substring(0, 100)}...`);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Filter out empty tool calls and log final state
    const validToolCalls = toolCalls.filter(tc => tc && tc.function?.name);

    safeDebugLog('info', 'OPENAICOMPATIBLESTREAMING', `🔍 ${providerName} stream response completed:`, {
      contentLength: fullContent.length,
      hasUsage: !!usage,
      usage: usage,
      toolCallsCount: validToolCalls.length
    });

    if (validToolCalls.length > 0) {
      safeDebugLog('info', 'OPENAICOMPATIBLESTREAMING', `🔧 ${providerName} assembled ${validToolCalls.length} tool calls:`, validToolCalls.map(tc => ({
        name: tc.function?.name,
        arguments: tc.function?.arguments
      })));

      // Execute tools and make follow-up call
      return executeToolsAndFollowUp(validToolCalls, fullContent, usage, settings, provider, conversationHistory, onStream);
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

  /**
   * Execute tools and make follow-up call for OpenAI-compatible providers
   */
  static async executeToolsAndFollowUp(
    toolCalls: OpenAICompatibleToolCall[],
    initialContent: string,
    initialUsage: OpenAICompatibleUsage | undefined,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void,
    providerName: string,
    executeMCPTool: (toolName: string, args: Record<string, unknown>) => Promise<string>,
    additionalHeaders: Record<string, string> = {},
    getMCPTools?: () => Promise<unknown[]>,
    getEnhancedSystemPrompt?: (tools: unknown[]) => string
  ): Promise<LLMResponse> {
    safeDebugLog('info', 'OPENAICOMPATIBLESTREAMING', `🔧 ${providerName} streaming detected ${toolCalls.length} tool calls, executing...`);

    // Execute all tool calls
    const toolResults = [];
    for (const toolCall of toolCalls) {
      try {
        safeDebugLog('info', 'OPENAICOMPATIBLESTREAMING', `🔧 Executing ${providerName} tool call: ${toolCall.function?.name}`);
        const toolName = toolCall.function?.name || '';
        const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
        const toolResult = await executeMCPTool(toolName, toolArgs);
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
      } catch (error) {
        safeDebugLog('error', 'OPENAICOMPATIBLESTREAMING', `❌ ${providerName} tool execution failed:`, error);
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
        });
      }
    }

    // Make follow-up call with tool results
    const userMessages = conversationHistory.filter(msg => msg.role !== 'system');

    // Convert tool calls to OpenAI format for follow-up
    const openaiToolCalls = toolCalls.map(tc => ({
      id: tc.id || '',
      type: 'function',
      function: {
        name: tc.function?.name || '',
        arguments: tc.function?.arguments || '{}'
      }
    }));

    // Get available tools for potential additional tool calls
    const availableTools = getMCPTools ? await getMCPTools() : [];

    // Use behavioral system prompt only for follow-up (no tool descriptions)
    // Tools are sent separately in the tools parameter
    const followUpSystemPrompt = 'You are a helpful AI assistant. Based on the tool results provided, continue the conversation naturally. If you need to use additional tools to better answer the user\'s question, feel free to do so.';

    const followUpMessages = [
      { role: 'system', content: followUpSystemPrompt },
      ...userMessages,
      { role: 'assistant', content: initialContent, tool_calls: openaiToolCalls },
      ...toolResults
    ];

    safeDebugLog('info', 'OPENAICOMPATIBLESTREAMING', `🔄 Making ${providerName} follow-up call to process tool results...`);

    const followUpRequestBody = {
      model: settings.model,
      messages: followUpMessages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: true, // Enable streaming for immediate response
      // Include tools to allow continued agentic behavior
      ...(availableTools.length > 0 && {
        tools: availableTools,
        tool_choice: 'auto'
      })
    };

    safeDebugLog('info', 'OPENAICOMPATIBLESTREAMING', `🔧 ${providerName} follow-up call with ${availableTools.length} tools available for continued agentic behavior`);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`,
      ...additionalHeaders
    };

    const followUpResponse = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(followUpRequestBody)
    });

    if (followUpResponse.ok) {
      // Handle streaming response
      const reader = followUpResponse.body?.getReader();
      if (!reader) {
        throw new Error(`${providerName} follow-up response has no readable stream`);
      }

      let followUpContent = '';
      let followUpUsage: OpenAICompatibleUsage | undefined = undefined;
      const followUpToolCalls: OpenAICompatibleToolCall[] = [];
      const decoder = new TextDecoder();

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (!data || data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;

                if (delta?.content) {
                  followUpContent += delta.content;
                  onStream(delta.content); // Stream immediately
                }

                if (delta?.tool_calls) {
                  // Handle additional tool calls in streaming response
                  for (const toolCall of delta.tool_calls) {
                    if (toolCall.function?.name) {
                      followUpToolCalls.push(toolCall);
                    }
                  }
                }

                if (parsed.usage) {
                  followUpUsage = parsed.usage;
                }
              } catch (e) {
                safeDebugLog('warn', 'OPENAICOMPATIBLESTREAMING', `Failed to parse ${providerName} streaming chunk:`, e);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // Combine usage data
      const combinedUsage = {
        promptTokens: (initialUsage?.prompt_tokens || 0) + (followUpUsage?.prompt_tokens || 0),
        completionTokens: (initialUsage?.completion_tokens || 0) + (followUpUsage?.completion_tokens || 0),
        totalTokens: (initialUsage?.total_tokens || 0) + (followUpUsage?.total_tokens || 0)
      };

      // Check if the follow-up response contains additional tool calls (agentic behavior)
      if (followUpToolCalls.length > 0) {
        safeDebugLog('info', 'OPENAICOMPATIBLESTREAMING', `🔄 ${providerName} follow-up response contains ${followUpToolCalls.length} additional tool calls - continuing agentic workflow`);

        // Recursively execute additional tool calls
        return this.executeToolsAndFollowUp(
          followUpToolCalls,
          followUpContent,
          followUpUsage,
          settings,
          provider,
          [...conversationHistory, { role: 'assistant', content: initialContent } as {role: string, content: string | Array<ContentItem>}, ...toolResults],
          onStream,
          providerName,
          executeMCPTool,
          additionalHeaders,
          getMCPTools,
          getEnhancedSystemPrompt
        );
      }

      safeDebugLog('info', 'OPENAICOMPATIBLESTREAMING', `✅ ${providerName} follow-up streaming completed with tool results integrated`);

      return {
        content: followUpContent || 'Tool execution completed.',
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
      safeDebugLog('error', 'OPENAICOMPATIBLESTREAMING', `❌ ${providerName} follow-up call failed (${followUpResponse.status}):`, errorText);
      
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
  }
}
