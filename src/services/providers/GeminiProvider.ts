// Google Gemini provider implementation

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
import { FALLBACK_MODELS } from './constants';
import { GEMINI_SYSTEM_PROMPT, generateGeminiToolPrompt } from './prompts/gemini';
import { debugLogger } from '../../utils/debugLogger';

export class GeminiProvider extends BaseProvider {
  readonly id = 'gemini';
  readonly name = 'Google Gemini';
  readonly capabilities: ProviderCapabilities = {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'gemini'
  };

  async sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
    console.log('🧠 Gemini: Integrating memory context');

    // Use behavioral system prompt only (no tool descriptions)
    // System instruction will be set in request body, not as user/model messages
    // Check for meaningful system prompt, not just empty string or generic default
    const hasCustomSystemPrompt = settings.systemPrompt &&
      settings.systemPrompt.trim() &&
      settings.systemPrompt !== "You are a helpful AI assistant. Please provide concise and helpful responses.";

    const systemPrompt = hasCustomSystemPrompt ? settings.systemPrompt! : this.getSystemPrompt();

    console.log(`🔍 Gemini system prompt source:`, {
      hasCustom: hasCustomSystemPrompt,
      usingCustom: hasCustomSystemPrompt,
      promptLength: systemPrompt?.length || 0,
      promptStart: systemPrompt?.substring(0, 100) + '...'
    });

    const contents = [];

    // NO system prompt in contents - it goes in systemInstruction parameter

    // Add conversation history
    for (const msg of conversationHistory) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }]
      });
    }

    // Add current message
    if (typeof message === 'string') {
      contents.push({
        role: 'user',
        parts: [{ text: message }]
      });
    } else if (Array.isArray(message)) {
      // Handle ContentItem array format (from chatService.ts)
      const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [];

      for (const item of message as ContentItem[]) {
        if (item.type === 'text') {
          parts.push({ text: item.text || '' });
        } else if (item.type === 'image_url') {
          // Convert OpenAI format to Gemini format
          const imageUrl = item.image_url?.url || '';

          // Determine mime type from data URL
          const mimeType = imageUrl.includes('data:image/png') ? 'image/png' :
                          imageUrl.includes('data:image/gif') ? 'image/gif' :
                          imageUrl.includes('data:image/webp') ? 'image/webp' : 'image/jpeg';

          parts.push({
            inline_data: {
              mime_type: mimeType,
              data: imageUrl.split(',')[1] // Remove data:image/jpeg;base64, prefix
            }
          });
        } else if (item.type === 'document') {
          // For documents, convert to text or handle as needed
          // Gemini doesn't have native document support like Anthropic
          parts.push({
            text: `[Document: ${item.document?.name || 'document'}]`
          });
        }
      }

      contents.push({ role: 'user', parts });
    } else {
      // Handle vision format
      const messageWithImages = message as { text: string; images: string[] };
      const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [{ text: messageWithImages.text }];

      // Add images in Gemini format
      for (const imageUrl of messageWithImages.images) {
        // Determine mime type from data URL
        const mimeType = imageUrl.includes('data:image/png') ? 'image/png' :
                        imageUrl.includes('data:image/gif') ? 'image/gif' :
                        imageUrl.includes('data:image/webp') ? 'image/webp' : 'image/jpeg';

        parts.push({
          inline_data: {
            mime_type: mimeType,
            data: imageUrl.split(',')[1] // Remove data:image/jpeg;base64, prefix
          }
        } as { inline_data: { mime_type: string; data: string } });
      }
      contents.push({ role: 'user', parts });
    }

    // Get MCP tools for Gemini
    const rawMcpTools = await this.getMCPToolsForProvider('gemini', settings);

    // Format tools for Gemini (clean schemas)
    const formattedTools = rawMcpTools.length > 0 ? this.formatTools(rawMcpTools as ToolObject[]) : [];

    const endpoint = onStream ? 'streamGenerateContent?alt=sse' : 'generateContent';
    const url = `${provider.baseUrl}/models/${settings.model}:${endpoint}${onStream ? '' : '?key=' + settings.apiKey}`;

    const requestBody: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: settings.temperature,
        maxOutputTokens: settings.maxTokens
      }
    };

    // Add tools if available (Gemini uses its own format)
    if (formattedTools.length > 0) {
      requestBody.tools = formattedTools;
      console.log(`🚀 Gemini API call with ${rawMcpTools.length} raw tools formatted to ${formattedTools.length} Gemini tools:`, {
        model: settings.model,
        rawToolCount: rawMcpTools.length,
        formattedToolCount: formattedTools.length,
        tools: formattedTools
      });
    } else {
      console.log(`🚀 Gemini API call without tools (no MCP tools available)`);
    }

    // Set system instruction (behavioral prompt only - no tool descriptions)
    if (systemPrompt) {
      requestBody.system_instruction = {
        parts: [{ text: systemPrompt }]
      };
      console.log(`🔧 Gemini system instruction set:`, {
        length: systemPrompt.length,
        preview: systemPrompt.substring(0, 100) + '...'
      });
    }

    console.log('🔍 Gemini request body:', JSON.stringify(requestBody, null, 2));

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (onStream) {
      headers['x-goog-api-key'] = settings.apiKey;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
      signal
    });

    console.log('🔍 Gemini response status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Gemini API error response:', error);
      throw new Error(`Gemini API error: ${error}`);
    }

    if (onStream) {
      return this.handleStreamResponse(response, onStream, settings, provider, conversationHistory, signal);
    } else {
      return this.handleNonStreamResponse(response, settings, conversationHistory, conversationId);
    }
  }

  async fetchModels(apiKey: string): Promise<string[]> {
    if (!apiKey) {
      console.log('No Gemini API key provided, using fallback models');
      return FALLBACK_MODELS.gemini;
    }

    try {
      // Google Gemini models endpoint
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

      if (!response.ok) {
        console.warn(`Gemini API error: ${response.status}, using fallback models`);
        return FALLBACK_MODELS.gemini;
      }

      const data = await response.json() as { models?: Array<{ name: string; supportedGenerationMethods?: string[] }> };
      const models = data.models
        ?.filter((model) => model.name.includes('gemini') && model.supportedGenerationMethods?.includes('generateContent'))
        ?.map((model) => model.name.replace('models/', ''))
        ?.sort() || [];

      return models.length > 0 ? models : FALLBACK_MODELS.gemini;
    } catch (error) {
      console.warn('Failed to fetch Gemini models, using fallback:', error);
      return FALLBACK_MODELS.gemini;
    }
  }

  formatTools(tools: ToolObject[]): unknown[] {
    console.log(`🔧 Gemini formatTools received ${tools.length} tools:`, tools.map(t => ({
      keys: Object.keys(t),
      name: t.name,
      functionName: t.function?.name,
      type: (t as {type?: string}).type,
      structure: JSON.stringify(t, null, 2).substring(0, 200) + '...'
    })));

    // Gemini format - single array of function declarations with cleaned schemas
    const formattedTools = [{
      functionDeclarations: tools.map(tool => {
        // Try multiple ways to get the tool name
        const originalName = tool.name || tool.function?.name || (tool as {function_name?: string}).function_name || (tool as {toolName?: string}).toolName || 'unknown_tool';
        const sanitizedName = this.sanitizeToolNameForGemini(originalName);

        // Try multiple ways to get the description
        const description = tool.description || tool.function?.description || (tool as {function_description?: string}).function_description || `Tool: ${sanitizedName}`;

        // Try multiple ways to get the parameters
        const parameters = tool.parameters || tool.function?.parameters || (tool as {input_schema?: unknown}).input_schema || (tool as {parameters?: unknown}).parameters;
        const cleanedParameters = this.cleanSchemaForGemini(parameters);

        console.log(`🔧 Gemini tool formatting - ${originalName} -> ${sanitizedName}:`, {
          originalTool: tool,
          cleanedParameters: JSON.stringify(cleanedParameters, null, 2)
        });

        return {
          name: sanitizedName,
          description: description,
          parameters: cleanedParameters
        };
      })
    }];

    console.log(`🔧 Gemini formatted tools:`, JSON.stringify(formattedTools, null, 2));
    return formattedTools;
  }

  private sanitizeToolNameForGemini(name: string): string {
    if (!name) return 'unknown_tool';

    // Gemini requirements: Must start with letter or underscore, alphanumeric + _ . -, max 64 chars
    let sanitized = name;

    // Replace invalid characters with underscores
    sanitized = sanitized.replace(/[^a-zA-Z0-9_.-]/g, '_');

    // Ensure it starts with letter or underscore
    if (!/^[a-zA-Z_]/.test(sanitized)) {
      sanitized = '_' + sanitized;
    }

    // Truncate to 64 characters
    if (sanitized.length > 64) {
      sanitized = sanitized.substring(0, 64);
    }

    // Ensure it's not empty
    if (!sanitized) {
      sanitized = 'tool';
    }

    console.log(`🔧 Gemini tool name sanitization: "${name}" -> "${sanitized}"`);
    return sanitized;
  }

  private safeParseJSON(jsonString: string): unknown {
    try {
      return JSON.parse(jsonString);
    } catch {
      console.warn(`🚫 Gemini: Failed to parse JSON "${jsonString}", returning as string`);
      return { result: jsonString };
    }
  }

  getSystemPrompt(): string {
    return GEMINI_SYSTEM_PROMPT;
  }

  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string {
    if (tools.length === 0) {
      return basePrompt;
    }

    // Gemini uses structured tool calling with tools parameter
    // Don't add XML tool instructions as they conflict with native function calling
    console.log(`🔧 Gemini using structured tools, skipping XML tool instructions`);
    return basePrompt;
  }

  validateToolCall(toolCall: { id?: string; name: string; arguments: Record<string, unknown> }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!toolCall.name || typeof toolCall.name !== 'string') {
      errors.push('Tool call must have a valid name');
    }

    // Google/Gemini has specific requirements
    if (toolCall.arguments && typeof toolCall.arguments !== 'object') {
      errors.push(`Google/Gemini tool call arguments must be object: ${toolCall.name}`);
    }

    return { valid: errors.length === 0, errors };
  }

  validateTool(tool: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!tool || typeof tool !== 'object') {
      errors.push('Tool must be an object');
      return { valid: false, errors };
    }

    // Gemini-specific validation would go here
    return { valid: errors.length === 0, errors };
  }

  // Private helper methods
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async getMCPToolsForProvider(_providerId: string, _settings: LLMSettings): Promise<unknown[]> {
    // This will be injected by the main service
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async executeMCPTool(_toolName: string, _args: Record<string, unknown>): Promise<string> {
    // This will be injected by the main service
    return JSON.stringify({ error: 'Tool execution not available' });
  }

  private async executeGeminiFollowUp(
    toolCalls: Array<{ id?: string; name?: string; arguments?: unknown; result?: string; isError?: boolean }>,
    initialContent: string,
    initialUsage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    console.log(`🔄 Making follow-up Gemini streaming call with ${toolCalls.length} tool results`);

    try {
      if (!settings.apiKey) {
        throw new Error('No Gemini API key available for follow-up');
      }

      // Build follow-up request with tool results
      const userMessages = conversationHistory.filter(msg => msg.role === 'user');
      const userParts = userMessages.length > 0
        ? userMessages.map(msg => ({ text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) }))
        : [{ text: 'Please provide a response based on the tool results.' }];

      const followupContents = [
        {
          role: 'user',
          parts: userParts
        },
        {
          role: 'model',
          parts: [
            { text: initialContent },
            ...toolCalls.map(tc => ({
              functionResponse: {
                name: tc.name,
                response: tc.isError ? { error: tc.result } : this.safeParseJSON(tc.result || '{}')
              }
            }))
          ]
        }
      ];

      const followupBody = {
        contents: followupContents,
        generationConfig: {
          temperature: settings.temperature,
          maxOutputTokens: settings.maxTokens
        }
      };

      const followupResponse = await fetch(`${provider.baseUrl}/models/${settings.model}:generateContent?key=${settings.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(followupBody)
      });

      if (followupResponse.ok) {
        console.log(`✅ Getting Gemini follow-up response (non-streaming)`);

        // Get the follow-up response as JSON instead of streaming
        const followupData = await followupResponse.json();

        // Process the follow-up response as a single chunk to prevent double replies
        if (followupData.candidates?.[0]?.content?.parts) {
          const followupText = followupData.candidates[0].content.parts
            .filter((part: { text?: string }) => part.text)
            .map((part: { text: string }) => part.text)
            .join('');

          if (followupText) {
            console.log(`🔄 Gemini streaming follow-up response:`, followupText.substring(0, 100) + '...');
            debugLogger.logStreaming('Gemini', followupText, true);
            onStream(followupText);
          } else {
            console.warn(`⚠️ Gemini follow-up response has no text content`);
            debugLogger.warn('FOLLOW_UP', 'Gemini follow-up response has no text content');
          }

          // Combine usage data
          const combinedUsage = {
            promptTokens: (initialUsage?.prompt_tokens || 0) + (followupData.usageMetadata?.promptTokenCount || 0),
            completionTokens: (initialUsage?.completion_tokens || 0) + (followupData.usageMetadata?.candidatesTokenCount || 0),
            totalTokens: (initialUsage?.total_tokens || 0) + (followupData.usageMetadata?.totalTokenCount || 0)
          };

          return {
            content: initialContent + followupText,
            usage: combinedUsage,
            toolCalls: toolCalls.map(tc => ({
              id: tc.id || `gemini-${Date.now()}`,
              name: tc.name || '',
              arguments: tc.arguments as Record<string, unknown> || {}
            }))
          };
        }
      } else {
        const errorText = await followupResponse.text();
        console.error(`❌ Gemini follow-up call failed (${followupResponse.status}):`, errorText);
      }
    } catch (error) {
      console.error(`❌ Gemini follow-up call error:`, error);
    }

    // Return original response if follow-up fails
    return {
      content: initialContent,
      usage: initialUsage ? {
        promptTokens: initialUsage.prompt_tokens || 0,
        completionTokens: initialUsage.completion_tokens || 0,
        totalTokens: initialUsage.total_tokens || 0
      } : undefined,
      toolCalls: toolCalls.map(tc => ({
        id: tc.id || `gemini-${Date.now()}`,
        name: tc.name || '',
        arguments: tc.arguments as Record<string, unknown> || {}
      }))
    };
  }

  private cleanSchemaForGemini(schema: unknown): Record<string, unknown> {
    if (!schema || typeof schema !== 'object') {
      return {
        type: 'object',
        properties: {},
        required: []
      };
    }

    const schemaObj = schema as Record<string, unknown>;

    // Check if this schema has complex features that Gemini doesn't support
    const hasComplexFeatures = this.hasUnsupportedFeatures(schemaObj);

    if (hasComplexFeatures) {
      console.log(`🚫 Gemini schema has complex features, using simplified fallback`);
      // Return a very simple fallback schema
      return {
        type: 'object',
        description: (schemaObj.description as string) || 'Tool parameters',
        properties: {},
        required: []
      };
    }

    // Recursively clean the schema to remove all unsupported properties
    const cleanedSchema = this.deepCleanForGemini(schemaObj);

    console.log(`🧹 Gemini schema cleaning:`, {
      original: JSON.stringify(schemaObj, null, 2),
      cleaned: JSON.stringify(cleanedSchema, null, 2)
    });

    return cleanedSchema;
  }

  private hasUnsupportedFeatures(obj: unknown): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    const input = obj as Record<string, unknown>;

    // Check for unsupported top-level properties
    const unsupportedProps = [
      '$ref', '$defs', '$schema', '$id', '$comment',
      'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
      'minLength', 'maxLength', 'pattern', 'format',
      'minItems', 'maxItems', 'uniqueItems', 'contains',
      'minProperties', 'maxProperties', 'additionalProperties',
      'patternProperties', 'dependencies', 'propertyNames',
      'const', 'if', 'then', 'else', 'allOf', 'anyOf', 'oneOf', 'not'
    ];

    for (const prop of unsupportedProps) {
      if (prop in input) {
        console.log(`🚫 Found unsupported feature: ${prop}`);
        return true;
      }
    }

    // Recursively check nested objects
    for (const [, value] of Object.entries(input)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (this.hasUnsupportedFeatures(value)) {
          return true;
        }
      }
    }

    return false;
  }

  private deepCleanForGemini(obj: unknown): Record<string, unknown> {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      return { type: 'object' };
    }

    const input = obj as Record<string, unknown>;
    const cleaned: Record<string, unknown> = {};

    // Gemini-supported properties ONLY - very restrictive list
    const supportedSchemaProps = ['type', 'description', 'properties', 'required', 'items', 'enum', 'minimum', 'maximum'];

    // Properties to explicitly reject (JSON Schema advanced features)
    const rejectedProps = [
      '$ref', '$defs', '$schema', '$id', '$comment',
      'exclusiveMinimum', 'exclusiveMaximum', 'multipleOf',
      'minLength', 'maxLength', 'pattern', 'format',
      'minItems', 'maxItems', 'uniqueItems', 'contains',
      'minProperties', 'maxProperties', 'additionalProperties',
      'patternProperties', 'dependencies', 'propertyNames',
      'const', 'if', 'then', 'else', 'allOf', 'anyOf', 'oneOf', 'not'
    ];

    for (const [key, value] of Object.entries(input)) {
      // Skip rejected properties entirely
      if (rejectedProps.includes(key)) {
        console.log(`🚫 Gemini schema cleaning: Removing unsupported property '${key}'`);
        continue;
      }

      if (supportedSchemaProps.includes(key)) {
        if (key === 'properties' && value && typeof value === 'object') {
          // Recursively clean nested properties
          cleaned.properties = {};
          for (const [propKey, propValue] of Object.entries(value as Record<string, unknown>)) {
            (cleaned.properties as Record<string, unknown>)[propKey] = this.deepCleanForGemini(propValue);
          }
        } else if (key === 'items' && value) {
          // Recursively clean array items schema
          cleaned.items = this.deepCleanForGemini(value);
        } else if (key === 'required' && Array.isArray(value)) {
          // Keep required array as-is
          cleaned.required = value;
        } else if (key === 'enum' && Array.isArray(value)) {
          // Keep enum array as-is
          cleaned.enum = value;
        } else if ((key === 'minimum' || key === 'maximum') && typeof value === 'number') {
          // Keep numeric constraints (but not exclusive versions)
          cleaned[key] = value;
        } else if (key === 'type' || key === 'description') {
          // Keep basic properties
          cleaned[key] = value;
        }
      } else {
        // Log any other properties we're skipping
        console.log(`🚫 Gemini schema cleaning: Skipping unknown property '${key}'`);
      }
    }

    // Ensure we always have a type
    if (!cleaned.type) {
      cleaned.type = 'object';
    }

    // If we have properties but no required array, add an empty one
    if (cleaned.properties && !cleaned.required) {
      cleaned.required = [];
    }

    return cleaned;
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
    console.log(`🔍 Starting Gemini stream response handling...`);
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let fullContent = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined = undefined;
    const decoder = new TextDecoder();
    const toolCalls: Array<{ id?: string; name?: string; arguments?: unknown; result?: string; isError?: boolean; function?: { name?: string; arguments?: string } }> = [];

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
              console.log('🔍 Gemini streaming chunk:', JSON.stringify(parsed, null, 2));

              if (parsed.candidates && parsed.candidates[0]?.content?.parts) {
                const parts = parsed.candidates[0].content.parts;

                for (const part of parts) {
                  // Handle text content
                  if (part.text) {
                    fullContent += part.text;
                    onStream(part.text);
                  }

                  // Handle function calls
                  if (part.functionCall) {
                    console.log(`🔧 Gemini streaming function call:`, part.functionCall);

                    // Show minimal tool usage in chat
                    const toolMessage = `\n\n🔧 **Using tool: ${part.functionCall.name}**\n⚙️ Executing...\n`;
                    fullContent += toolMessage;
                    onStream(toolMessage);

                    try {
                      // Execute the tool
                      const toolResult = await this.executeMCPTool(
                        part.functionCall.name,
                        part.functionCall.args
                      );

                      // Show brief completion in chat
                      const completedMessage = `✅ Completed\n\n`;
                      fullContent += completedMessage;
                      onStream(completedMessage);

                      toolCalls.push({
                        id: `gemini-${Date.now()}`,
                        name: part.functionCall.name,
                        arguments: part.functionCall.args,
                        result: toolResult
                      });

                    } catch (error) {
                      console.error(`❌ Gemini streaming tool call failed:`, error);

                      // Show tool error in chat
                      const errorMessage = `❌ Tool ${part.functionCall.name} failed: ${error instanceof Error ? error.message : String(error)}\n`;
                      fullContent += errorMessage;
                      onStream(errorMessage);

                      toolCalls.push({
                        id: `gemini-${Date.now()}`,
                        name: part.functionCall.name,
                        arguments: part.functionCall.args,
                        result: error instanceof Error ? error.message : String(error),
                        isError: true
                      });
                    }
                  }
                }
              }

              // Gemini provides usage metadata in streaming responses
              if (parsed.usageMetadata) {
                usage = {
                  prompt_tokens: parsed.usageMetadata.promptTokenCount,
                  completion_tokens: parsed.usageMetadata.candidatesTokenCount,
                  total_tokens: parsed.usageMetadata.totalTokenCount
                };
              }
            } catch (e) {
              console.warn('Failed to parse Gemini streaming chunk:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // If we have tool calls, make a follow-up call to get Gemini's analysis
    if (toolCalls.length > 0) {
      return this.executeGeminiFollowUp(toolCalls, fullContent, usage, settings, provider, conversationHistory, onStream);
    }

    return {
      content: fullContent,
      usage: usage ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      } : undefined,
      toolCalls: toolCalls.map(tc => ({
        id: tc.id || `gemini-${Date.now()}`,
        name: tc.name || '',
        arguments: tc.arguments as Record<string, unknown> || {}
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
    try {
      console.log('🔍 About to parse Gemini response...');
      const data = await response.json();
      console.log('🔍 Gemini raw response:', JSON.stringify(data, null, 2));

      const candidate = data.candidates[0];
      if (!candidate || !candidate.content || !candidate.content.parts) {
        console.error('❌ Gemini response missing expected structure:', data);
        return { content: 'Error: Invalid response structure from Gemini' };
      }

      // Handle tool calls in Gemini format
      let content = '';
      const toolCalls = [];

      console.log('🔍 Gemini candidate parts:', candidate.content.parts);
      for (const part of candidate.content.parts) {
        if (part.text) {
          content += part.text;
        } else if (part.functionCall) {
          console.log(`🔧 Gemini response contains function call:`, part.functionCall);
          // Tool execution will be handled by the main service
          toolCalls.push({
            id: `gemini-${Date.now()}`,
            name: part.functionCall.name,
            arguments: part.functionCall.args
          });
        }
      }

      return {
        content,
        usage: data.usageMetadata ? {
          promptTokens: data.usageMetadata.promptTokenCount,
          completionTokens: data.usageMetadata.candidatesTokenCount,
          totalTokens: data.usageMetadata.totalTokenCount
        } : undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined
      };
    } catch (error) {
      console.error('❌ Failed to parse Gemini response:', error);
      return { content: 'Error: Failed to parse response from Gemini' };
    }
  }
}
