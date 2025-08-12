// OpenAI provider implementation

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
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

import { OPENAI_SYSTEM_PROMPT } from './prompts/openai';
import { OpenAIFileService } from '../OpenAIFileService';
import { PricingService } from '../pricingService';

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
// import { RAGService } from '../RAGService'; // Moved to Electron main process, accessed via IPC

export class OpenAIProvider extends BaseProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly capabilities: ProviderCapabilities = {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    supportsPromptCaching: true,
    promptCachingType: 'automatic', // Automatic caching for prompts ≥1024 tokens
    maxToolNameLength: 64,
    toolFormat: 'openai'
  };

  private fileService?: OpenAIFileService;
  private assistantId?: string;
  private vectorStoreId?: string;
  private threadMap = new Map<string, string>(); // Maps conversationId to threadId

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    // Smart routing: Use Assistants API for file uploads, Chat Completions API for everything else
    const hasFileUploads = this.hasDocumentUploads(message);

    if (hasFileUploads) {
      safeDebugLog('info', 'OPENAIPROVIDER', '🔧 OpenAI: Using Assistants API for file upload handling');
      return this.sendMessageWithAssistants(message, settings, provider, conversationHistory, onStream, signal, conversationId);
    } else {
      safeDebugLog('info', 'OPENAIPROVIDER', '🔧 OpenAI: Using Chat Completions API for fast tool calling');
      return this.sendMessageWithChatCompletions(message, settings, provider, conversationHistory, onStream, signal, conversationId);
    }
  }

  private hasDocumentUploads(message: MessageContent): boolean {
    safeDebugLog('info', 'OPENAIPROVIDER', `🔍 OpenAI checking for file uploads in message:`, {
      isArray: Array.isArray(message),
      messageType: typeof message,
      messageContent: Array.isArray(message) ? message.map(item => {
        const extendedItem = item as ContentItem & {file?: unknown, document?: unknown, attachment?: unknown};
        return {
          type: item.type,
          hasFile: !!extendedItem.file,
          hasDocument: !!extendedItem.document,
          hasAttachment: !!extendedItem.attachment
        };
      }) : 'not array'
    });

    if (Array.isArray(message)) {
      const hasFiles = message.some(item => {
        const extendedItem = item as ContentItem & {file?: unknown, document?: unknown, attachment?: unknown};
        const extendedType = (extendedItem as unknown as {type?: string}).type;
        return extendedType === 'document' ||
               extendedType === 'file' ||
               extendedType === 'attachment' ||
               !!extendedItem.file ||
               !!extendedItem.document ||
               !!extendedItem.attachment;
      });

      safeDebugLog('info', 'OPENAIPROVIDER', `🔍 OpenAI file detection result:`, { hasFiles });
      return hasFiles;
    }

    // Check if message has file properties (legacy format)
    const hasLegacyFiles = !!(message as {files?: unknown, attachments?: unknown}).files || !!(message as {files?: unknown, attachments?: unknown}).attachments;
    safeDebugLog('info', 'OPENAIPROVIDER', `🔍 OpenAI legacy file detection result:`, { hasLegacyFiles });
    return hasLegacyFiles;
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  private async sendMessageWithAssistants(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    // Initialize file service if not already done
    if (!this.fileService && settings.apiKey) {
      this.fileService = new OpenAIFileService(settings.apiKey, provider.baseUrl);
    }

    // Assistants API workflow for file uploads
    if (!this.assistantId || !this.vectorStoreId) {
      const { assistantId, vectorStoreId } = await this.getOrCreateAssistantAndVectorStore(settings);
      this.assistantId = assistantId;
      this.vectorStoreId = vectorStoreId;
    }

    const threadId = await this.getOrCreateThread(conversationId, settings);

    let textContent = '';
    const attachments: { file_id: string; tools: { type: string; }[] }[] = [];

    if (typeof message === 'string') {
      textContent = message; // RAG integration now handled in chatService
    } else if (Array.isArray(message)) {
      for (const item of message) {
        if (item.type === 'text') {
          textContent += item.text + '\n';
        } else if (item.type === 'document' && this.fileService && item.document?.data) {
          try {
            const binaryString = atob(item.document.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const file = new File([bytes], item.document.name || 'document', {
              type: item.document.media_type || 'application/octet-stream'
            });
            // Upload the file and add it to the vector store
            const uploadedFile = await this.fileService.uploadFile(file, 'assistants');
            await this.addFileToVectorStore(this.vectorStoreId!, uploadedFile.id, settings);
            attachments.push({ file_id: uploadedFile.id, tools: [{ type: 'file_search' }] });
          } catch (error) {
            safeDebugLog('error', 'OPENAIPROVIDER', 'Error uploading document to OpenAI:', error);
            textContent += `\n[Error uploading document: ${item.document.name}]`;
          }
        }
      }
    }

    await this.addMessageToThread(threadId, textContent.trim(), attachments, settings);

    const run = await this.createAndPollRun(threadId, this.assistantId!, settings);

    if (run.status !== 'completed') {
      throw new Error(`Run failed with status: ${run.status}`);
    }

    const responseContent = await this.getAssistantResponse(threadId, settings);

    return {
      content: responseContent,
      usage: {
        promptTokens: run.usage?.prompt_tokens || 0,
        completionTokens: run.usage?.completion_tokens || 0,
        totalTokens: run.usage?.total_tokens || 0
      }
    };
  }

  private async sendMessageWithChatCompletions(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
    const messages = [];

    // Get MCP tools for this provider first
    const mcpTools = await this.getMCPToolsForProvider('openai', settings);

    // Use behavioral system prompt only (no tool descriptions)
    // Tools are sent separately in the tools parameter
    // Check for meaningful system prompt, not just empty string or generic default
    const hasCustomSystemPrompt = settings.systemPrompt &&
      settings.systemPrompt.trim() &&
      settings.systemPrompt !== "You are a helpful AI assistant. Please provide concise and helpful responses.";

    const systemPrompt = hasCustomSystemPrompt ? settings.systemPrompt! : this.getSystemPrompt();
    const cachingEnabled = settings.promptCachingEnabled ?? true;

    safeDebugLog('info', 'OPENAIPROVIDER', `🔍 OpenAI Chat Completions system prompt source:`, {
      hasCustom: hasCustomSystemPrompt,
      usingCustom: hasCustomSystemPrompt,
      promptLength: systemPrompt?.length || 0,
      promptStart: systemPrompt?.substring(0, 100) + '...',
      cachingEnabled,
      automaticCaching: systemPrompt && systemPrompt.length > 4096 ? 'eligible' : 'too_small'
    });

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
      if (cachingEnabled && systemPrompt.length > 4096) {
        safeDebugLog('info', 'OPENAIPROVIDER', `🔧 OpenAI: System prompt eligible for automatic caching (${systemPrompt.length} chars, ≥1024 tokens)`);
      }
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Add current message (handle both string and array formats)
    if (typeof message === 'string') {
      messages.push({ role: 'user', content: message });
      if (cachingEnabled && message.length > 4096) {
        safeDebugLog('info', 'OPENAIPROVIDER', `🔧 OpenAI: User message eligible for automatic caching (${message.length} chars, ≥1024 tokens)`);
      }
    } else if (Array.isArray(message)) {
      // Handle ContentItem array format (images, text)
      messages.push({ role: 'user', content: message });
      if (cachingEnabled) {
        const totalTextLength = message.filter(item => item.type === 'text').reduce((sum, item) => sum + (item.text?.length || 0), 0);
        if (totalTextLength > 4096) {
          safeDebugLog('info', 'OPENAIPROVIDER', `🔧 OpenAI: User message content eligible for automatic caching (${totalTextLength} chars total text, ≥1024 tokens)`);
        }
      }
    } else {
      // Handle legacy vision format (convert to OpenAI format)
      const messageWithImages = message as { text: string; images: string[] };
      const content: ContentItem[] = [{ type: 'text', text: messageWithImages.text }];

      for (const imageUrl of messageWithImages.images) {
        content.push({
          type: 'image_url',
          image_url: { url: imageUrl }
        });
      }
      messages.push({ role: 'user', content });
    }

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };

    // Add tools if available
    if (mcpTools.length > 0) {
      requestBody.tools = mcpTools;
      requestBody.tool_choice = 'auto';
      safeDebugLog('info', 'OPENAIPROVIDER', `🚀 OpenAI Chat Completions API call with ${mcpTools.length} tools:`, {
        model: settings.model,
        toolCount: mcpTools.length,
        conversationId: conversationId || 'none'
      });
    } else {
      safeDebugLog('info', 'OPENAIPROVIDER', `🚀 OpenAI Chat Completions API call without tools`);
    }

    safeDebugLog('info', 'OPENAIPROVIDER', '🔍 OpenAI Chat Completions request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal
    });

    safeDebugLog('info', 'OPENAIPROVIDER', '🔍 OpenAI Chat Completions response status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      safeDebugLog('error', 'OPENAIPROVIDER', '❌ OpenAI Chat Completions API error response:', error);

      if (response.status === 401) {
        throw new Error(`OpenAI API authentication failed. Please check your API key in Settings. Error: ${error}`);
      }

      // Check if it's a token limit error - fallback to Assistants API
      if (response.status === 429 && error.includes('Request too large')) {
        safeDebugLog('info', 'OPENAIPROVIDER', '🔄 OpenAI Chat Completions request too large, falling back to Assistants API');
        return this.sendMessageWithAssistants(message, settings, provider, conversationHistory, onStream, signal, conversationId);
      }

      throw new Error(`OpenAI API error: ${error}`);
    }

    if (onStream) {
      return this.handleChatCompletionsStreamResponse(response, settings, provider, conversationHistory, onStream, signal);
    } else {
      return this.handleChatCompletionsNonStreamResponse(response, settings, conversationHistory);
    }
  }

  private async handleChatCompletionsStreamResponse(
    response: Response,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let fullContent = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined;
    const toolCalls: Array<{ id?: string; type?: string; function?: { name?: string; arguments?: string } }> = [];
    // Removed unused currentToolCall variable

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = new TextDecoder().decode(value);
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

              // Handle tool calls in streaming
              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  if (toolCall.index !== undefined) {
                    if (!toolCalls[toolCall.index]) {
                      toolCalls[toolCall.index] = { id: toolCall.id, type: toolCall.type };
                    }
                    if (toolCall.function) {
                      if (!toolCalls[toolCall.index].function) {
                        toolCalls[toolCall.index].function = { name: '', arguments: '' };
                      }
                      if (toolCall.function.name) {
                        toolCalls[toolCall.index].function!.name += toolCall.function.name;
                      }
                      if (toolCall.function.arguments) {
                        toolCalls[toolCall.index].function!.arguments += toolCall.function.arguments;
                      }
                    }
                  }
                }
              }

              if (parsed.usage) {
                usage = parsed.usage;
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Handle tool calls if present
    if (toolCalls.length > 0) {
      safeDebugLog('info', 'OPENAIPROVIDER', `🔧 OpenAI Chat Completions detected ${toolCalls.length} tool calls`);

      // Execute tools and make follow-up call
      return this.executeToolsAndFollowUpChatCompletions(
        toolCalls,
        fullContent,
        usage,
        settings,
        provider,
        conversationHistory,
        onStream,
        signal
      );
    }

    const { usage: usageInfo, cost } = this.createUsageAndCost(settings.model, usage);
    return {
      content: fullContent,
      usage: usageInfo,
      cost
    };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  private async handleChatCompletionsNonStreamResponse(
    response: Response,
    settings: LLMSettings,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>
  ): Promise<LLMResponse> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    const data = await response.json();
    safeDebugLog('info', 'OPENAIPROVIDER', '🔍 OpenAI Chat Completions raw response:', JSON.stringify(data, null, 2));

    const message = data.choices?.[0]?.message;
    const content = message?.content || '';
    const usage = data.usage;

    // Handle tool calls if present
    if (message?.tool_calls && message.tool_calls.length > 0) {
      safeDebugLog('info', 'OPENAIPROVIDER', `🔧 OpenAI Chat Completions detected ${message.tool_calls.length} tool calls`);
      // For non-streaming, we would need to implement tool execution here
      // For now, return the response as-is
    }

    return {
      content,
      usage: usage ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      } : undefined,
      toolCalls: message?.tool_calls?.map((tc: any) => ({
        id: tc.id,
        name: tc.function?.name,
        arguments: JSON.parse(tc.function?.arguments || '{}')
      }))
    };
  }

  private async executeToolsAndFollowUpChatCompletions(
    toolCalls: Array<{ id?: string; type?: string; function?: { name?: string; arguments?: string } }>,
    initialContent: string,
    initialUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    safeDebugLog('info', 'OPENAIPROVIDER', `🚀 Executing ${toolCalls.length} OpenAI Chat Completions tools in parallel`);

    // Check if parallel execution methods are available
    if (!(this as any).executeMultipleToolsParallel) {
      safeDebugLog('error', 'OPENAIPROVIDER', '❌ executeMultipleToolsParallel method not available');
      throw new Error('Tool execution method not available');
    }

    // Execute tools in parallel using the centralized service
    const executeMultipleToolsParallel = (this as any).executeMultipleToolsParallel;
    const parallelResults = await executeMultipleToolsParallel(
      toolCalls.map(tc => ({
        id: tc.id,
        name: tc.function?.name || '',
        arguments: JSON.parse(tc.function?.arguments || '{}')
      })),
      'openai'
    );

    safeDebugLog('info', 'OPENAIPROVIDER', `🏁 OpenAI Chat Completions tool execution completed: ${parallelResults.filter((r: {success: boolean}) => r.success).length}/${parallelResults.length} successful`);

    // Build messages for follow-up call
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

    // Convert tool results to OpenAI message format
    const toolResults = parallelResults.map((result: {id?: string, result: string}) => ({
      role: 'tool',
      tool_call_id: result.id || '',
      content: result.result
    }));

    // Use same behavioral system prompt as initial call (for consistency and caching)
    const hasCustomSystemPromptFollowUp = settings.systemPrompt &&
      settings.systemPrompt.trim() &&
      settings.systemPrompt !== "You are a helpful AI assistant. Please provide concise and helpful responses.";

    const baseSystemPrompt = hasCustomSystemPromptFollowUp ? settings.systemPrompt! : this.getSystemPrompt();
    const followUpSystemPrompt = baseSystemPrompt +
      `\n\n## Follow-up Context\n\nBased on the tool results provided above, continue the conversation naturally. If you need to use additional tools to better answer the user's question, feel free to do so.`;

    // Build proper assistant message - if no initial content, use a descriptive message
    const assistantContent = initialContent.trim() ||
      `I'll help you with that. Let me use the appropriate tools to get the information you need.`;

    const followUpMessages = [
      { role: 'system', content: followUpSystemPrompt },
      ...userMessages,
      { role: 'assistant', content: assistantContent, tool_calls: openaiToolCalls },
      ...toolResults
    ];

    safeDebugLog('info', 'OPENAIPROVIDER', `🔍 OpenAI Chat Completions follow-up messages:`, {
      messageCount: followUpMessages.length,
      systemPromptLength: followUpSystemPrompt.length,
      assistantContent: assistantContent.substring(0, 100) + '...',
      toolResultsCount: toolResults.length,
      toolResultsPreview: toolResults.map((tr: {tool_call_id: string, content: string}) => ({
        tool_call_id: tr.tool_call_id,
        contentLength: tr.content.length,
        contentPreview: tr.content.substring(0, 100) + '...'
      }))
    });

    // Get tools for continued agentic behavior in follow-up call
    const followUpTools = await this.getMCPToolsForProvider('openai', settings);
    safeDebugLog('info', 'OPENAIPROVIDER', `🔄 Making OpenAI Chat Completions follow-up call with ${followUpTools.length} tools available for continued agentic behavior`);

    const followUpRequestBody = {
      model: settings.model,
      messages: followUpMessages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: true,
      // Include tools to allow continued agentic behavior
      ...(followUpTools.length > 0 && {
        tools: followUpTools,
        tool_choice: 'auto'
      })
    };

    const followUpResponse = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(followUpRequestBody),
      signal
    });

    safeDebugLog('info', 'OPENAIPROVIDER', `🔍 OpenAI Chat Completions follow-up response status:`, followUpResponse.status, followUpResponse.statusText);

    if (followUpResponse.ok) {
      safeDebugLog('info', 'OPENAIPROVIDER', `✅ Starting OpenAI Chat Completions follow-up streaming response`);

      try {
        // Stream the follow-up response with updated conversation history for agentic behavior
        const followUpResult = await this.handleChatCompletionsStreamResponse(
          followUpResponse,
          settings,
          provider,
          followUpMessages, // Use updated messages that include tool results
          onStream,
          signal
        );

        safeDebugLog('info', 'OPENAIPROVIDER', `✅ OpenAI Chat Completions follow-up streaming completed:`, {
          contentLength: followUpResult.content?.length || 0,
          hasUsage: !!followUpResult.usage,
          hasToolCalls: !!followUpResult.toolCalls,
          content: followUpResult.content?.substring(0, 100) + '...'
        });

        // Combine tool calls from initial response AND follow-up response
        const initialToolCalls = toolCalls
          .filter(tc => tc.id && tc.function?.name)
          .map(tc => ({
            id: tc.id!,
            name: tc.function!.name!,
            arguments: JSON.parse(tc.function!.arguments || '{}')
          }));

        const followUpToolCalls = followUpResult.toolCalls || [];
        const allToolCalls = [...initialToolCalls, ...followUpToolCalls];

        safeDebugLog('info', 'OPENAIPROVIDER', `🔧 Combined OpenAI Chat Completions tool calls: ${initialToolCalls.length} initial + ${followUpToolCalls.length} follow-up = ${allToolCalls.length} total`);

        return {
          content: initialContent + followUpResult.content,
          usage: followUpResult.usage ? {
            promptTokens: (initialUsage?.prompt_tokens || 0) + (followUpResult.usage?.promptTokens || 0),
            completionTokens: (initialUsage?.completion_tokens || 0) + (followUpResult.usage?.completionTokens || 0),
            totalTokens: (initialUsage?.total_tokens || 0) + (followUpResult.usage?.totalTokens || 0)
          } : initialUsage ? {
            promptTokens: initialUsage.prompt_tokens || 0,
            completionTokens: initialUsage.completion_tokens || 0,
            totalTokens: initialUsage.total_tokens || 0
          } : undefined,
          toolCalls: allToolCalls
        };
      } catch (error) {
        safeDebugLog('error', 'OPENAIPROVIDER', `❌ OpenAI Chat Completions follow-up streaming failed:`, error);
        safeDebugLog('error', 'OPENAIPROVIDER', `❌ Falling back to original response without tool results`);
        // Fall through to return original response
      }
    } else {
      const errorText = await followUpResponse.text();
      safeDebugLog('error', 'OPENAIPROVIDER', `❌ OpenAI Chat Completions follow-up call failed (${followUpResponse.status}):`, errorText);
      safeDebugLog('error', 'OPENAIPROVIDER', `❌ Falling back to original response without tool results`);
    }

    // Return original response with tool calls if follow-up failed
    safeDebugLog('info', 'OPENAIPROVIDER', `⚠️ OpenAI Chat Completions returning original response without tool results:`, {
      contentLength: initialContent?.length || 0,
      toolCallsCount: toolCalls.length,
      content: initialContent?.substring(0, 100) + '...'
    });

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

  // OpenAI-specific tool calling methods
  private async getOpenAITools(settings: LLMSettings): Promise<unknown[]> {
    try {
      safeDebugLog('info', 'OPENAIPROVIDER', `🔍 Getting tools for OpenAI provider`);
      safeDebugLog('info', 'OPENAIPROVIDER', `🔍 Tool calling enabled:`, settings?.toolCallingEnabled !== false);

      // Check if tool calling is disabled
      if (settings?.toolCallingEnabled === false) {
        safeDebugLog('info', 'OPENAIPROVIDER', `🚫 Tool calling is disabled, returning empty tools array`);
        return [];
      }

      // Get raw tools from the centralized service (temporarily)
      const rawTools = await this.getMCPToolsForProvider('openai', settings);
      safeDebugLog('info', 'OPENAIPROVIDER', `📋 Raw tools received (${rawTools.length} tools):`, rawTools.map((t: any) => t.name || t.function?.name));

      // Format tools specifically for OpenAI Assistants API
      const formattedTools = this.formatToolsForOpenAI(rawTools);
      safeDebugLog('info', 'OPENAIPROVIDER', `🔧 Formatted ${formattedTools.length} tools for OpenAI Assistants API`);

      return formattedTools;
    } catch (error) {
      safeDebugLog('error', 'OPENAIPROVIDER', '❌ Failed to get OpenAI tools:', error);
      return [];
    }
  }

  private formatToolsForOpenAI(rawTools: any[]): unknown[] {
    return rawTools.map(tool => {
      // All tools now come in unified format with type: 'function' and function object
      if (tool.type === 'function' && tool.function) {
        // Sanitize tool name for OpenAI (replace hyphens with underscores)
        const sanitizedName = tool.function.name.replace(/-/g, '_');
        return {
          type: 'function',
          function: {
            name: sanitizedName,
            description: tool.function.description || 'No description',
            parameters: tool.function.parameters || {
              type: 'object',
              properties: {},
              required: []
            }
          }
        };
      }
      
      safeDebugLog('warn', 'OPENAIPROVIDER', `⚠️ Skipping invalid tool (not in unified format):`, tool);
      return null;
    }).filter(tool => tool !== null);
  }

  private async getOrCreateAssistantAndVectorStore(settings: LLMSettings): Promise<{ assistantId: string, vectorStoreId: string }> {
    // Get OpenAI-specific formatted tools
    const openAITools = await this.getOpenAITools(settings);
    
    // Ensure we're using a compatible model for assistants
    let assistantModel = settings.model;
    const compatibleModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'];
    if (!compatibleModels.some(model => assistantModel.includes(model))) {
      safeDebugLog('warn', 'OPENAIPROVIDER', `⚠️ Model ${assistantModel} may not be compatible with Assistants API, using gpt-4o-mini as fallback`);
      assistantModel = 'gpt-4o-mini';
    }
    
    // Create a vector store
    safeDebugLog('info', 'OPENAIPROVIDER', 'Creating a new vector store...');
    const vectorStoreResponse = await fetch('https://api.openai.com/v1/vector_stores', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({ name: 'Document Store' })
    });
    if (!vectorStoreResponse.ok) {
      const errorText = await vectorStoreResponse.text();
      safeDebugLog('error', 'OPENAIPROVIDER', '❌ Vector store creation failed:', errorText);
      throw new Error(`Failed to create vector store: ${vectorStoreResponse.status} - ${errorText}`);
    }
    const vectorStore = await vectorStoreResponse.json();
    safeDebugLog('info', 'OPENAIPROVIDER', `Vector store created with ID: ${vectorStore.id}`);

    // Prepare tools array - start with file_search
    const tools: Array<{ type: string; function?: { name: string; description: string; parameters: any } }> = [{ type: 'file_search' }];
    
    // Add formatted OpenAI tools
    if (openAITools.length > 0) {
      safeDebugLog('info', 'OPENAIPROVIDER', `🔧 Adding ${openAITools.length} formatted tools to OpenAI assistant`);
      tools.push(...openAITools as any[]);
    }

    // Create an assistant linked to the vector store with OpenAI tools
    safeDebugLog('info', 'OPENAIPROVIDER', `Creating a new assistant with file search and ${tools.length - 1} OpenAI tools...`);
    safeDebugLog('info', 'OPENAIPROVIDER', '🔧 Tools being sent to OpenAI:', JSON.stringify(tools, null, 2));
    
    const assistantPayload = {
      name: 'AI Assistant with MCP Tools',
      instructions: 'You are a helpful assistant that can search documents and use various tools to help users.',
      tools: tools,
      tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
      model: assistantModel
    };
    
    safeDebugLog('info', 'OPENAIPROVIDER', '🔧 Assistant payload:', JSON.stringify(assistantPayload, null, 2));
    
    const assistantResponse = await fetch('https://api.openai.com/v1/assistants', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify(assistantPayload)
    });
    
    if (!assistantResponse.ok) {
      const errorText = await assistantResponse.text();
      safeDebugLog('error', 'OPENAIPROVIDER', '❌ OpenAI API Error:', {
        status: assistantResponse.status,
        statusText: assistantResponse.statusText,
        body: errorText,
        model: assistantModel,
        toolCount: tools.length
      });
      throw new Error(`Failed to create assistant: ${assistantResponse.status} ${assistantResponse.statusText} - ${errorText}`);
    }
    const assistant = await assistantResponse.json();
    safeDebugLog('info', 'OPENAIPROVIDER', `Assistant created with ID: ${assistant.id}`);

    return { assistantId: assistant.id, vectorStoreId: vectorStore.id };
  }

  private async getOrCreateThread(conversationId: string | undefined, settings: LLMSettings): Promise<string> {
    if (conversationId && this.threadMap.has(conversationId)) {
      return this.threadMap.get(conversationId)!;
    }

    const response = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    const thread = await response.json();
    if (conversationId) {
      this.threadMap.set(conversationId, thread.id);
    }
    return thread.id;
  }

  private async addMessageToThread(threadId: string, content: string, attachments: any[], settings: LLMSettings) {
    await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({ role: 'user', content, attachments })
    });
  }

  private async addFileToVectorStore(vectorStoreId: string, fileId: string, settings: LLMSettings) {
    await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({ file_id: fileId })
    });
    safeDebugLog('info', 'OPENAIPROVIDER', `File ${fileId} added to vector store ${vectorStoreId}`);
  }

  private async createAndPollRun(threadId: string, assistantId: string, settings: LLMSettings): Promise<any> {
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({ assistant_id: assistantId })
    });

    let run = await runResponse.json();
    const pollInterval = 1000; // 1 second

    while (['queued', 'in_progress', 'requires_action'].includes(run.status)) {
      if (run.status === 'requires_action') {
        safeDebugLog('info', 'OPENAIPROVIDER', '🔧 OpenAI run requires action - executing tools...');
        await this.handleRequiredAction(threadId, run, settings);
      }
      
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      const pollResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${run.id}`, {
        headers: {
          'Authorization': `Bearer ${settings.apiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      run = await pollResponse.json();
    }

    return run;
  }

  private async handleRequiredAction(threadId: string, run: any, settings: LLMSettings): Promise<void> {
    safeDebugLog('info', 'OPENAIPROVIDER', '🔧 Handling required action for OpenAI run:', run.id);
    
    if (!run.required_action || !run.required_action.submit_tool_outputs) {
      safeDebugLog('warn', 'OPENAIPROVIDER', '⚠️ No tool outputs required in required action');
      return;
    }

    const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
    safeDebugLog('info', 'OPENAIPROVIDER', `🔧 Executing ${toolCalls.length} tool calls:`, toolCalls.map((tc: any) => tc.function.name));

    const toolOutputs = [];
    
    for (const toolCall of toolCalls) {
      try {
        safeDebugLog('info', 'OPENAIPROVIDER', `🔧 Executing tool: ${toolCall.function.name}`);
        const args = JSON.parse(toolCall.function.arguments);
        const result = await this.executeMCPTool!(toolCall.function.name, args);
        
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: result
        });
        
        safeDebugLog('info', 'OPENAIPROVIDER', `✅ Tool ${toolCall.function.name} executed successfully`);
      } catch (error) {
        safeDebugLog('error', 'OPENAIPROVIDER', `❌ Tool ${toolCall.function.name} failed:`, error);
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: `Error executing tool: ${error}`
        });
      }
    }

    // Submit tool outputs back to OpenAI
    safeDebugLog('info', 'OPENAIPROVIDER', '🔧 Submitting tool outputs to OpenAI...');
    const submitResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${run.id}/submit_tool_outputs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({ tool_outputs: toolOutputs })
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      safeDebugLog('error', 'OPENAIPROVIDER', '❌ Failed to submit tool outputs:', errorText);
      throw new Error(`Failed to submit tool outputs: ${submitResponse.status} - ${errorText}`);
    }
    
    safeDebugLog('info', 'OPENAIPROVIDER', '✅ Tool outputs submitted successfully');
  }

  private async getAssistantResponse(threadId: string, settings: LLMSettings): Promise<string> {
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    const messages = await messagesResponse.json();
    const assistantMessage = messages.data.find((m: any) => m.role === 'assistant');
    return assistantMessage?.content[0]?.text?.value || 'No response from assistant.';
  }

  async fetchModels(apiKey: string): Promise<string[]> {
    if (!apiKey) {
      safeDebugLog('info', 'OPENAIPROVIDER', '❌ No OpenAI API key provided - cannot fetch models');
      return [];
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        safeDebugLog('warn', 'OPENAIPROVIDER', `❌ OpenAI API error: ${response.status} - check API key`);
        return [];
      }

      const data = await response.json() as { data: Array<{ id: string }> };
      const models = data.data
        .filter((model) => model.id.includes('gpt'))
        .map((model) => model.id)
        .sort();

      return models;
    } catch (error) {
      safeDebugLog('warn', 'OPENAIPROVIDER', '❌ Failed to fetch OpenAI models:', error);
      return [];
    }
  }

  formatTools(tools: ToolObject[]): unknown[] {
    // OpenAI format - array of tool objects with type: 'function'
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
    return OPENAI_SYSTEM_PROMPT;
  }

  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string {
    if (tools.length === 0) {
      return basePrompt;
    }

    // OpenAI uses structured tool calling with tools parameter and tool_choice
    // Don't add XML tool instructions as they conflict with native function calling
    safeDebugLog('info', 'OPENAIPROVIDER', `🔧 OpenAI using structured tools, skipping XML tool instructions`);
    return basePrompt;
  }

  validateToolCall(toolCall: { id?: string; name: string; arguments: Record<string, unknown> }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!toolCall.id) {
      errors.push(`OpenAI tool call missing required id: ${toolCall.name}`);
    }

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
      errors.push('OpenAI tools must have type: "function"');
    }

    if (!toolObj.function || typeof toolObj.function !== 'object') {
      errors.push('OpenAI tools must have function object');
    } else {
      const func = toolObj.function as Record<string, unknown>;
      if (!func.name) {
        errors.push('OpenAI tools must have function.name');
      }
      if (func.name && typeof func.name === 'string' && func.name.length > 64) {
        errors.push('OpenAI function names must be ≤64 characters');
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Private helper methods
  // Note: These methods are injected by the ProviderAdapter from the LLMService
  private getMCPToolsForProvider!: (providerId: string, settings: LLMSettings) => Promise<unknown[]>;
  private shouldSendTools!: (conversationId: string | undefined, tools: ToolObject[]) => Promise<boolean>;
  private executeMCPTool!: (toolName: string, args: Record<string, unknown>) => Promise<string>;

  private async handleStreamResponse(
    response: Response,
    onStream: (chunk: string) => void,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    conversationId?: string
  ): Promise<LLMResponse> {
    safeDebugLog('info', 'OPENAIPROVIDER', `🔍 Starting OpenAI stream response handling...`);
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
          safeDebugLog('info', 'OPENAIPROVIDER', `🔍 OpenAI stream chunk ${chunkCount}:`, chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''));
        }
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (chunkCount <= 5) {
                safeDebugLog('info', 'OPENAIPROVIDER', `🔍 OpenAI parsed chunk ${chunkCount}:`, JSON.stringify(parsed, null, 2));
              }

              const choice = parsed.choices?.[0];
              const delta = choice?.delta;
              const content = delta?.content || '';

              if (content) {
                fullContent += content;
                onStream(content);
                safeDebugLog('info', 'OPENAIPROVIDER', `📝 OpenAI content chunk: "${content}"`);
              }

              // Check for tool calls and assemble them
              if (delta?.tool_calls) {
                safeDebugLog('info', 'OPENAIPROVIDER', `🔧 OpenAI tool calls detected:`, delta.tool_calls);

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
              safeDebugLog('error', 'OPENAIPROVIDER', `❌ OpenAI error parsing chunk:`, error, `Data: ${data.substring(0, 100)}...`);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Filter out empty tool calls and log final state
    const validToolCalls = toolCalls.filter(tc => tc && tc.function?.name);

    safeDebugLog('info', 'OPENAIPROVIDER', '🔍 OpenAI stream response completed:', {
      contentLength: fullContent.length,
      hasUsage: !!usage,
      usage: usage,
      toolCallsCount: validToolCalls.length
    });

    if (validToolCalls.length > 0) {
      safeDebugLog('info', 'OPENAIPROVIDER', `🔧 OpenAI assembled ${validToolCalls.length} tool calls:`, validToolCalls.map(tc => ({
        name: tc.function?.name,
        arguments: tc.function?.arguments
      })));

      // Execute tools and make follow-up call
      return this.executeToolsAndFollowUp(validToolCalls, fullContent, usage, settings, provider, conversationHistory, onStream, conversationId);
    }

    const { usage: usageInfo, cost } = this.createUsageAndCost(settings.model, usage);
    return {
      content: fullContent,
      usage: usageInfo,
      cost,
      toolCalls: validToolCalls
        .filter(tc => tc.id && tc.function?.name) // Only include tool calls with valid id and name
        .map(tc => ({
          id: tc.id!,
          name: tc.function!.name!,
          arguments: JSON.parse(tc.function!.arguments || '{}')
        }))
    };
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  private async executeToolsAndFollowUp(
    toolCalls: Array<{ id?: string; type?: string; function?: { name?: string; arguments?: string } }>,
    initialContent: string,
    initialUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void,
    conversationId?: string
  ): Promise<LLMResponse> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    safeDebugLog('info', 'OPENAIPROVIDER', `🔧 OpenAI streaming detected ${toolCalls.length} tool calls, executing...`);

    // Check if we have parallel execution method injected (like Anthropic/Mistral)
    if ((this as any).executeMultipleToolsParallel && (this as any).summarizeToolResultsForModel) {
      safeDebugLog('info', 'OPENAIPROVIDER', `🚀 Using parallel execution for ${toolCalls.length} OpenAI tools`);
      
      // Format tool calls for parallel execution
      const toolCallsForExecution = toolCalls.map(tc => ({
        id: tc.id || '',
        name: tc.function?.name || '',
        arguments: JSON.parse(tc.function?.arguments || '{}')
      }));

      try {
        // Execute tools in parallel immediately
        const executeMultipleToolsParallel = (this as any).executeMultipleToolsParallel;
        const summarizeToolResultsForModel = (this as any).summarizeToolResultsForModel;
        
        const parallelResults = await executeMultipleToolsParallel(toolCallsForExecution, 'openai');
        safeDebugLog('info', 'OPENAIPROVIDER', `✅ OpenAI parallel execution completed: ${parallelResults.filter((r: any) => r.success).length}/${parallelResults.length} successful`);
        
        // Get tool results summary for the model
        const toolSummary = summarizeToolResultsForModel(parallelResults);
        
        // Stream the tool results to user
        onStream('\n\n' + toolSummary);
        
        // Return response with tool results included
        return {
          content: initialContent + '\n\n' + toolSummary,
          usage: initialUsage ? {
            promptTokens: initialUsage.prompt_tokens || 0,
            completionTokens: initialUsage.completion_tokens || 0,
            totalTokens: initialUsage.total_tokens || 0
          } : undefined
        };
      } catch (error) {
        safeDebugLog('error', 'OPENAIPROVIDER', `❌ OpenAI parallel tool execution failed, falling back to sequential:`, error);
        // Fall back to sequential execution below
      }
    }

    // Fallback: Execute all tool calls sequentially (old method)
    safeDebugLog('info', 'OPENAIPROVIDER', `⚠️ Using sequential execution for ${toolCalls.length} OpenAI tools`);
    const toolResults = [];
    for (const toolCall of toolCalls) {
      try {
        safeDebugLog('info', 'OPENAIPROVIDER', `🔧 Executing OpenAI tool call: ${toolCall.function?.name}`);
        const toolName = toolCall.function?.name || '';
        const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
        const toolResult = await (this as any).executeMCPTool(toolName, toolArgs);
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
      } catch (error) {
        safeDebugLog('error', 'OPENAIPROVIDER', `❌ OpenAI tool execution failed:`, error);
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

    // Use same behavioral system prompt as initial call (for consistency and caching)
    const hasCustomSystemPromptFollowUp = settings.systemPrompt &&
      settings.systemPrompt.trim() &&
      settings.systemPrompt !== "You are a helpful AI assistant. Please provide concise and helpful responses.";

    const baseSystemPrompt = hasCustomSystemPromptFollowUp ? settings.systemPrompt! : this.getSystemPrompt();
    const followUpSystemPrompt = baseSystemPrompt +
      `\n\n## Follow-up Context\n\nBased on the tool results provided above, continue the conversation naturally. If you need to use additional tools to better answer the user's question, feel free to do so.`;

    const followUpMessages = [
      { role: 'system', content: followUpSystemPrompt },
      ...userMessages,
      { role: 'assistant', content: initialContent, tool_calls: openaiToolCalls },
      ...toolResults
    ];

    // Get tools for continued agentic behavior in follow-up call
    const followUpTools = await this.getMCPToolsForProvider('openai', settings);
    safeDebugLog('info', 'OPENAIPROVIDER', `🔄 Making OpenAI follow-up call with ${followUpTools.length} tools available for continued agentic behavior`);

    const followUpRequestBody = {
      model: settings.model,
      messages: followUpMessages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: false,
      // Include tools to allow continued agentic behavior
      ...(followUpTools.length > 0 && {
        tools: followUpTools,
        tool_choice: 'auto'
      })
    };

    const followUpResponse = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(followUpRequestBody)
    });

    if (followUpResponse.ok) {
      const followUpData = await followUpResponse.json();
      const followUpMessage = followUpData.choices[0]?.message;

      // Combine responses
      const combinedUsage = {
        promptTokens: (initialUsage?.prompt_tokens || 0) + (followUpData.usage?.prompt_tokens || 0),
        completionTokens: (initialUsage?.completion_tokens || 0) + (followUpData.usage?.completion_tokens || 0),
        totalTokens: (initialUsage?.total_tokens || 0) + (followUpData.usage?.total_tokens || 0)
      };

      // Stream the follow-up content
      if (followUpMessage?.content) {
        onStream(followUpMessage.content);
      }

      return {
        content: followUpMessage?.content || 'Tool execution completed.',
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
      safeDebugLog('error', 'OPENAIPROVIDER', `❌ OpenAI follow-up call failed (${followUpResponse.status}):`, errorText);

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

    // Handle tool calls if present
    if (message.tool_calls && message.tool_calls.length > 0) {
      safeDebugLog('info', 'OPENAIPROVIDER', `🔧 OpenAI response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);
      const content = message.content || '';

      // Tool execution will be handled by the main service
      // For now, just return the content with tool calls
      return {
        content,
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

    const { usage, cost } = this.createUsageAndCost(settings.model, data.usage);
    return {
      content: message.content,
      usage,
      cost
    };
  }

  /**
   * Calculate cost for OpenAI API usage
   */
  private calculateCost(model: string, promptTokens: number, completionTokens: number) {
    return PricingService.calculateCost('openai', model, promptTokens, completionTokens);
  }

  /**
   * Create usage and cost information from OpenAI API response
   */
  private createUsageAndCost(model: string, usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }) {
    if (!usage) return { usage: undefined, cost: undefined };

    const usageInfo = {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0
    };

    const costInfo = this.calculateCost(model, usageInfo.promptTokens, usageInfo.completionTokens);

    return { usage: usageInfo, cost: costInfo };
  }
}
