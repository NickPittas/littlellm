// OpenAI provider implementation

import { BaseProvider } from './BaseProvider';
import {
  LLMSettings,
  LLMResponse,
  MessageContent,
  ContentItem,
  LLMProvider,
  ToolObject,
  ProviderCapabilities,
  ToolCallArguments
} from './types';
import { FALLBACK_MODELS } from './constants';
import { OPENAI_SYSTEM_PROMPT, generateOpenAIToolPrompt } from './prompts/openai';
import { OpenAIFileService, OpenAIFileUpload } from '../OpenAIFileService';
// import { RAGService } from '../RAGService'; // Moved to Electron main process, accessed via IPC

export class OpenAIProvider extends BaseProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';
  readonly capabilities: ProviderCapabilities = {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: 64,
    toolFormat: 'openai'
  };

  private fileService?: OpenAIFileService;
  private assistantId?: string;
  private vectorStoreId?: string;
  private threadMap = new Map<string, string>(); // Maps conversationId to threadId

  async sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
    // Initialize file service if not already done
    if (!this.fileService && settings.apiKey) {
      this.fileService = new OpenAIFileService(settings.apiKey, provider.baseUrl);
    }
    const messages = [];

    // Get MCP tools for this provider first
    const mcpTools = await this.getMCPToolsForProvider('openai', settings);

    // Build enhanced system prompt with tool instructions
    let systemPrompt = settings.systemPrompt || this.getSystemPrompt();
    if (mcpTools.length > 0) {
      systemPrompt = this.enhanceSystemPromptWithTools(systemPrompt, mcpTools as ToolObject[]);
    }

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Add current message (handle both string and array formats)
    // Assistants API workflow
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
            console.error('Error uploading document to OpenAI:', error);
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

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: onStream && typeof onStream === 'function'
    };

    // Add tools if available and should be sent
    const shouldSendTools = await this.shouldSendTools(conversationId, mcpTools as ToolObject[]);
    if (mcpTools.length > 0 && shouldSendTools) {
      requestBody.tools = mcpTools;
      requestBody.tool_choice = 'auto';
      console.log(`🚀 OpenAI API call with ${mcpTools.length} tools:`, {
        model: settings.model,
        toolCount: mcpTools.length,
        conversationId: conversationId || 'none'
      });
    } else {
      console.log(`🚀 OpenAI API call without tools (${mcpTools.length} available, shouldSend: ${shouldSendTools})`);
    }

  }

  // OpenAI-specific tool calling methods
  private async getOpenAITools(settings: LLMSettings): Promise<unknown[]> {
    try {
      console.log(`🔍 Getting tools for OpenAI provider`);
      console.log(`🔍 Tool calling enabled:`, settings?.toolCallingEnabled !== false);

      // Check if tool calling is disabled
      if (settings?.toolCallingEnabled === false) {
        console.log(`🚫 Tool calling is disabled, returning empty tools array`);
        return [];
      }

      // Get raw tools from the centralized service (temporarily)
      const rawTools = await this.getMCPToolsForProvider('openai', settings);
      console.log(`📋 Raw tools received (${rawTools.length} tools):`, rawTools.map((t: any) => t.name || t.function?.name));

      // Format tools specifically for OpenAI Assistants API
      const formattedTools = this.formatToolsForOpenAI(rawTools);
      console.log(`🔧 Formatted ${formattedTools.length} tools for OpenAI Assistants API`);

      return formattedTools;
    } catch (error) {
      console.error('❌ Failed to get OpenAI tools:', error);
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
      
      console.warn(`⚠️ Skipping invalid tool (not in unified format):`, tool);
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
      console.warn(`⚠️ Model ${assistantModel} may not be compatible with Assistants API, using gpt-4o-mini as fallback`);
      assistantModel = 'gpt-4o-mini';
    }
    
    // Create a vector store
    console.log('Creating a new vector store...');
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
      console.error('❌ Vector store creation failed:', errorText);
      throw new Error(`Failed to create vector store: ${vectorStoreResponse.status} - ${errorText}`);
    }
    const vectorStore = await vectorStoreResponse.json();
    console.log(`Vector store created with ID: ${vectorStore.id}`);

    // Prepare tools array - start with file_search
    const tools: Array<{ type: string; function?: { name: string; description: string; parameters: any } }> = [{ type: 'file_search' }];
    
    // Add formatted OpenAI tools
    if (openAITools.length > 0) {
      console.log(`🔧 Adding ${openAITools.length} formatted tools to OpenAI assistant`);
      tools.push(...openAITools as any[]);
    }

    // Create an assistant linked to the vector store with OpenAI tools
    console.log(`Creating a new assistant with file search and ${tools.length - 1} OpenAI tools...`);
    console.log('🔧 Tools being sent to OpenAI:', JSON.stringify(tools, null, 2));
    
    const assistantPayload = {
      name: 'AI Assistant with MCP Tools',
      instructions: 'You are a helpful assistant that can search documents and use various tools to help users.',
      tools: tools,
      tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
      model: assistantModel
    };
    
    console.log('🔧 Assistant payload:', JSON.stringify(assistantPayload, null, 2));
    
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
      console.error('❌ OpenAI API Error:', {
        status: assistantResponse.status,
        statusText: assistantResponse.statusText,
        body: errorText,
        model: assistantModel,
        toolCount: tools.length
      });
      throw new Error(`Failed to create assistant: ${assistantResponse.status} ${assistantResponse.statusText} - ${errorText}`);
    }
    const assistant = await assistantResponse.json();
    console.log(`Assistant created with ID: ${assistant.id}`);

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
    console.log(`File ${fileId} added to vector store ${vectorStoreId}`);
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
        console.log('🔧 OpenAI run requires action - executing tools...');
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
    console.log('🔧 Handling required action for OpenAI run:', run.id);
    
    if (!run.required_action || !run.required_action.submit_tool_outputs) {
      console.warn('⚠️ No tool outputs required in required action');
      return;
    }

    const toolCalls = run.required_action.submit_tool_outputs.tool_calls;
    console.log(`🔧 Executing ${toolCalls.length} tool calls:`, toolCalls.map((tc: any) => tc.function.name));

    const toolOutputs = [];
    
    for (const toolCall of toolCalls) {
      try {
        console.log(`🔧 Executing tool: ${toolCall.function.name}`);
        const args = JSON.parse(toolCall.function.arguments);
        const result = await this.executeMCPTool!(toolCall.function.name, args);
        
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: result
        });
        
        console.log(`✅ Tool ${toolCall.function.name} executed successfully`);
      } catch (error) {
        console.error(`❌ Tool ${toolCall.function.name} failed:`, error);
        toolOutputs.push({
          tool_call_id: toolCall.id,
          output: `Error executing tool: ${error}`
        });
      }
    }

    // Submit tool outputs back to OpenAI
    console.log('🔧 Submitting tool outputs to OpenAI...');
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
      console.error('❌ Failed to submit tool outputs:', errorText);
      throw new Error(`Failed to submit tool outputs: ${submitResponse.status} - ${errorText}`);
    }
    
    console.log('✅ Tool outputs submitted successfully');
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
    // @ts-ignore
    return assistantMessage?.content[0]?.text?.value || 'No response from assistant.';
  }

  async fetchModels(apiKey: string): Promise<string[]> {
    if (!apiKey) {
      console.log('No OpenAI API key provided, using fallback models');
      return FALLBACK_MODELS.openai;
    }

    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`OpenAI API error: ${response.status}, using fallback models`);
        return FALLBACK_MODELS.openai;
      }

      const data = await response.json() as { data: Array<{ id: string }> };
      const models = data.data
        .filter((model) => model.id.includes('gpt'))
        .map((model) => model.id)
        .sort();

      return models.length > 0 ? models : FALLBACK_MODELS.openai;
    } catch (error) {
      console.warn('Failed to fetch OpenAI models, using fallback:', error);
      return FALLBACK_MODELS.openai;
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

    const toolInstructions = generateOpenAIToolPrompt(tools);
    return basePrompt + toolInstructions;
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
    console.log(`🔍 Starting OpenAI stream response handling...`);
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
          console.log(`🔍 OpenAI stream chunk ${chunkCount}:`, chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''));
        }
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (chunkCount <= 5) {
                console.log(`🔍 OpenAI parsed chunk ${chunkCount}:`, JSON.stringify(parsed, null, 2));
              }

              const choice = parsed.choices?.[0];
              const delta = choice?.delta;
              const content = delta?.content || '';

              if (content) {
                fullContent += content;
                onStream(content);
                console.log(`📝 OpenAI content chunk: "${content}"`);
              }

              // Check for tool calls and assemble them
              if (delta?.tool_calls) {
                console.log(`🔧 OpenAI tool calls detected:`, delta.tool_calls);

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
              console.error(`❌ OpenAI error parsing chunk:`, error, `Data: ${data.substring(0, 100)}...`);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Filter out empty tool calls and log final state
    const validToolCalls = toolCalls.filter(tc => tc && tc.function?.name);

    console.log('🔍 OpenAI stream response completed:', {
      contentLength: fullContent.length,
      hasUsage: !!usage,
      usage: usage,
      toolCallsCount: validToolCalls.length
    });

    if (validToolCalls.length > 0) {
      console.log(`🔧 OpenAI assembled ${validToolCalls.length} tool calls:`, validToolCalls.map(tc => ({
        name: tc.function?.name,
        arguments: tc.function?.arguments
      })));

      // Execute tools and make follow-up call
      return this.executeToolsAndFollowUp(validToolCalls, fullContent, usage, settings, provider, conversationHistory, onStream, conversationId);
    }

    return {
      content: fullContent,
      usage: usage ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      } : undefined,
      toolCalls: validToolCalls
        .filter(tc => tc.id && tc.function?.name) // Only include tool calls with valid id and name
        .map(tc => ({
          id: tc.id!,
          name: tc.function!.name!,
          arguments: JSON.parse(tc.function!.arguments || '{}')
        }))
    };
  }

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
    console.log(`🔧 OpenAI streaming detected ${toolCalls.length} tool calls, executing...`);

    // Check if we have parallel execution method injected (like Anthropic/Mistral)
    if ((this as any).executeMultipleToolsParallel && (this as any).summarizeToolResultsForModel) {
      console.log(`🚀 Using parallel execution for ${toolCalls.length} OpenAI tools`);
      
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
        console.log(`✅ OpenAI parallel execution completed: ${parallelResults.filter((r: any) => r.success).length}/${parallelResults.length} successful`);
        
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
        console.error(`❌ OpenAI parallel tool execution failed, falling back to sequential:`, error);
        // Fall back to sequential execution below
      }
    }

    // Fallback: Execute all tool calls sequentially (old method)
    console.log(`⚠️ Using sequential execution for ${toolCalls.length} OpenAI tools`);
    const toolResults = [];
    for (const toolCall of toolCalls) {
      try {
        console.log(`🔧 Executing OpenAI tool call: ${toolCall.function?.name}`);
        const toolName = toolCall.function?.name || '';
        const toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
        const toolResult = await (this as any).executeMCPTool(toolName, toolArgs);
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult)
        });
      } catch (error) {
        console.error(`❌ OpenAI tool execution failed:`, error);
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

    const followUpMessages = [
      { role: 'system', content: 'Based on the tool results provided, give a helpful and natural response to the user\'s question.' },
      ...userMessages,
      { role: 'assistant', content: initialContent, tool_calls: openaiToolCalls },
      ...toolResults
    ];

    console.log(`🔄 Making OpenAI follow-up call to process tool results...`);

    const followUpRequestBody = {
      model: settings.model,
      messages: followUpMessages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: false
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
      console.error(`❌ OpenAI follow-up call failed (${followUpResponse.status}):`, errorText);

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

  private async handleNonStreamResponse(
    response: Response,
    settings: LLMSettings,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    conversationId?: string
  ): Promise<LLMResponse> {
    const data = await response.json();
    const choice = data.choices[0];
    const message = choice.message;

    // Handle tool calls if present
    if (message.tool_calls && message.tool_calls.length > 0) {
      console.log(`🔧 OpenAI response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);
      let content = message.content || '';

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
