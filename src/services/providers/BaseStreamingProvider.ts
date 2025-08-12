/**
 * Base Streaming Provider - Provides common streaming functionality for all providers
 * This reduces duplication across the 13+ providers by centralizing streaming logic
 */

import { BaseProvider } from './BaseProvider';
import { LLMSettings, LLMProvider, LLMResponse, MessageContent, ContentItem, ToolObject } from './types';

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

export interface StreamingConfig {
  endpoint: string;
  headers: Record<string, string>;
  requestBody: Record<string, unknown>;
  parseChunk: (chunk: string) => string | null;
  parseToolCalls?: (content: string) => Array<{ id?: string; name: string; arguments: Record<string, unknown> }>;
  handleError?: (error: unknown) => string;
}

export abstract class BaseStreamingProvider extends BaseProvider {
  // Abstract methods for provider-specific configuration
  abstract createStreamingConfig(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    tools: ToolObject[]
  ): Promise<StreamingConfig>;

  abstract parseStreamChunk(chunk: string): string | null;
  abstract extractToolCalls(content: string): Array<{ id?: string; name: string; arguments: Record<string, unknown> }>;

  /**
   * Common streaming implementation used by all providers
   */
  protected async handleStreaming(
    config: StreamingConfig,
    onStream: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<{ content: string; toolCalls: Array<{ id?: string; name: string; arguments: Record<string, unknown> }> }> {
    let fullContent = '';
    let buffer = '';

    try {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify(config.requestBody),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = config.handleError ? config.handleError(errorText) : `API Error: ${response.status} - ${errorText}`;
        throw new Error(errorMessage);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body reader available');
      }

      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim() === '') continue;

          try {
            const chunk = config.parseChunk(line);
            if (chunk) {
              fullContent += chunk;
              onStream(chunk);
            }
          } catch (error) {
            safeDebugLog('warn', `${this.id.toUpperCase()}PROVIDER`, 'Failed to parse chunk:', line, error);
          }
        }
      }

      // Parse tool calls from the complete content
      const toolCalls = config.parseToolCalls ? config.parseToolCalls(fullContent) : this.extractToolCalls(fullContent);

      return { content: fullContent, toolCalls };
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('Request was aborted');
      }
      throw error;
    }
  }

  /**
   * Common non-streaming implementation
   */
  protected async handleNonStreaming(
    config: StreamingConfig,
    signal?: AbortSignal
  ): Promise<{ content: string; toolCalls: Array<{ id?: string; name: string; arguments: Record<string, unknown> }> }> {
    try {
      // Remove stream property for non-streaming requests
      const requestBody = { ...config.requestBody };
      delete requestBody.stream;

      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify(requestBody),
        signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        const errorMessage = config.handleError ? config.handleError(errorText) : `API Error: ${response.status} - ${errorText}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const content = this.extractContentFromResponse(data);
      const toolCalls = this.extractToolCallsFromResponse(data);

      return { content, toolCalls };
    } catch (error) {
      if (signal?.aborted) {
        throw new Error('Request was aborted');
      }
      throw error;
    }
  }

  /**
   * Extract content from non-streaming response - override in subclasses
   */
  protected extractContentFromResponse(data: unknown): string {
    // Default implementation - override in subclasses
    const response = data as { choices?: Array<{ message?: { content?: string } }> };
    return response.choices?.[0]?.message?.content || '';
  }

  /**
   * Extract tool calls from non-streaming response - override in subclasses
   */
  protected extractToolCallsFromResponse(data: unknown): Array<{ id?: string; name: string; arguments: Record<string, unknown> }> {
    // Default implementation - override in subclasses
    const response = data as { choices?: Array<{ message?: { tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> } }> };
    const toolCalls = response.choices?.[0]?.message?.tool_calls || [];
    
    return toolCalls.map(call => ({
      id: call.id,
      name: call.function?.name || '',
      arguments: call.function?.arguments ? JSON.parse(call.function.arguments) : {}
    }));
  }

  /**
   * Common sendMessage implementation that uses streaming/non-streaming handlers
   */
  async sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
    const startTime = Date.now();

    try {
      // Get tools for this provider
      const tools = await this.getToolsForProvider(provider.id, settings);
      
      // Create provider-specific streaming configuration
      const config = await this.createStreamingConfig(message, settings, provider, conversationHistory, tools);

      let result: { content: string; toolCalls: Array<{ id?: string; name: string; arguments: Record<string, unknown> }> };

      if (onStream) {
        // Use streaming
        result = await this.handleStreaming(config, onStream, signal);
      } else {
        // Use non-streaming
        result = await this.handleNonStreaming(config, signal);
      }

      const processingTime = Date.now() - startTime;

      // Handle tool execution if needed
      if (result.toolCalls.length > 0) {
        return this.executeToolsAndFollowUp(
          result.toolCalls,
          result.content,
          undefined, // usage will be estimated
          settings,
          provider,
          conversationHistory,
          onStream || (() => {}),
          signal
        );
      }

      return {
        content: result.content,
        usage: this.createEstimatedUsage(
          this.formatConversationForEstimation(conversationHistory, message),
          result.content,
          'estimated'
        ),
        processingTime
      };
    } catch (error) {
      safeDebugLog('error', `${this.id.toUpperCase()}PROVIDER`, 'Error in sendMessage:', error);
      throw error;
    }
  }

  // Abstract methods that subclasses must implement
  protected abstract getToolsForProvider(providerId: string, settings: LLMSettings): Promise<ToolObject[]>;
  protected abstract executeToolsAndFollowUp(
    toolCalls: Array<{ id?: string; name: string; arguments: Record<string, unknown> }>,
    initialContent: string,
    initialUsage: unknown,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse>;

  // Helper method for token estimation
  protected formatConversationForEstimation(
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    currentMessage: MessageContent
  ): string {
    const historyText = conversationHistory.map(msg => {
      if (typeof msg.content === 'string') {
        return `${msg.role}: ${msg.content}`;
      } else {
        return `${msg.role}: [complex content]`;
      }
    }).join('\n');

    const currentText = typeof currentMessage === 'string' ? currentMessage : '[complex content]';
    return `${historyText}\nuser: ${currentText}`;
  }
}
