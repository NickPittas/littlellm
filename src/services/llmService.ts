export interface LLMProvider {
  id: string;
  name: string;
  baseUrl: string;
  requiresApiKey: boolean;
  models: string[];
  logo: string; // Path to the provider logo (dark theme)
  logoLight?: string; // Path to the provider logo (light theme)
}

export interface LLMSettings {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
  toolCallingEnabled?: boolean;
}

import { mcpService } from './mcpService';

// Type for content array items used in vision API
interface ContentItem {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

// Type for tool call arguments
type ToolCallArguments = Record<string, unknown>;

// Type for tool objects
interface ToolObject {
  name?: string;
  description?: string;
  parameters?: unknown;
  function?: {
    name?: string;
    description?: string;
    parameters?: unknown;
  };
}



// Type for API response data
interface APIResponseData {
  data?: Array<{ id: string; name?: string }>;
  models?: Array<{ id?: string; name: string }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: Array<{
        id: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
}

export type MessageContent = string | Array<ContentItem> | { text: string; images: string[] };

// Response parser utility for cleaning up structured responses
class ResponseParser {
  // Parse XML-like tags (e.g., <Simple>content</Simple>)
  static parseXMLTags(text: string): string {
    // Remove XML-like tags and extract content
    return text.replace(/<[^>]+>/g, '').trim();
  }

  // Parse JSON arrays and extract meaningful content
  static parseJSONArray(data: unknown[]): string {
    if (!Array.isArray(data)) return '';

    const results: string[] = [];

    for (const item of data) {
      if (typeof item === 'string') {
        results.push(item);
      } else if (typeof item === 'object' && item !== null) {
        // Extract common fields
        const obj = item as Record<string, unknown>;
        const content = obj.output || obj.response || obj.message || obj.content || obj.text || obj.result;
        if (content) {
          results.push(typeof content === 'string' ? content : JSON.stringify(content));
        } else {
          results.push(JSON.stringify(item));
        }
      }
    }

    return results.join('\n\n');
  }

  // Parse structured responses and clean them up
  static parseStructuredResponse(responseText: string): string {
    try {
      // First try to parse as JSON
      const data = JSON.parse(responseText);

      if (Array.isArray(data)) {
        // Handle JSON arrays like [{"output":"<Simple>content</Simple>"}]
        const parsed = this.parseJSONArray(data);
        return this.parseXMLTags(parsed);
      } else if (typeof data === 'object' && data !== null) {
        // Handle single objects
        const content = data.output || data.response || data.message || data.content || data.text || data.result;
        if (content) {
          const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
          return this.parseXMLTags(contentStr);
        }
        return JSON.stringify(data);
      } else {
        // Handle primitive values
        const contentStr = String(data);
        return this.parseXMLTags(contentStr);
      }
    } catch {
      // If JSON parsing fails, try to clean up XML tags from raw text
      return this.parseXMLTags(responseText);
    }
  }

  // Main parsing function that handles various response formats
  static cleanResponse(responseText: string): string {
    if (!responseText || !responseText.trim()) {
      return '';
    }

    const trimmed = responseText.trim();

    // Check if it looks like a JSON response
    if ((trimmed.startsWith('[') && trimmed.endsWith(']')) ||
        (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
      return this.parseStructuredResponse(trimmed);
    }

    // Check if it contains XML-like tags
    if (trimmed.includes('<') && trimmed.includes('>')) {
      return this.parseXMLTags(trimmed);
    }

    // Return as-is if no special formatting detected
    return trimmed;
  }
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: ToolCallArguments;
  }>;
}

const DEFAULT_PROVIDERS: LLMProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    models: [], // Will be fetched dynamically
    logo: '/assets/providers/openai.png',
    logoLight: '/assets/providers/openai-light.png'
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    requiresApiKey: true,
    models: [], // Will be fetched dynamically
    logo: '/assets/providers/anthropic.png',
    logoLight: '/assets/providers/anthropic-light.png'
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    requiresApiKey: true,
    models: [], // Will be fetched dynamically
    logo: '/assets/providers/gemini.png',
    logoLight: '/assets/providers/gemini-light.png'
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    baseUrl: 'https://api.mistral.ai/v1',
    requiresApiKey: true,
    models: [], // Will be fetched dynamically
    logo: '/assets/providers/mistral.png'
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    requiresApiKey: true,
    models: [], // Will be fetched dynamically
    logo: '/assets/providers/deepseek.png'
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    baseUrl: 'http://localhost:1234/v1',
    requiresApiKey: false,
    models: [], // Will be fetched dynamically
    logo: '/assets/providers/lmstudio.png'
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: '',
    requiresApiKey: false,
    models: [], // Will be fetched dynamically
    logo: '/assets/providers/ollama.png'
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    models: [], // Will be fetched dynamically
    logo: '/assets/providers/openrouter.png'
  },
  {
    id: 'requesty',
    name: 'Requesty',
    baseUrl: 'https://router.requesty.ai/v1',
    requiresApiKey: true,
    models: [], // Will be fetched dynamically
    logo: '/assets/providers/requesty.svg'
  },
  {
    id: 'replicate',
    name: 'Replicate',
    baseUrl: 'https://api.replicate.com/v1',
    requiresApiKey: true,
    models: [], // Will be fetched dynamically
    logo: '/assets/providers/replicate.png'
  },
  {
    id: 'n8n',
    name: 'n8n Workflow',
    baseUrl: '', // Will be configured by user
    requiresApiKey: false,
    models: [], // Will be fetched dynamically
    logo: '/assets/providers/n8n.png'
  }
];



// Fallback models for when API fetching fails
const FALLBACK_MODELS: Record<string, string[]> = {
  openai: [
    'gpt-4o',
    'gpt-4o-mini',
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo'
  ],
  anthropic: [
    'claude-3-5-sonnet-20241022',
    'claude-3-5-haiku-20241022',
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ],
  gemini: [
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.0-pro'
  ],
  mistral: [
    'mistral-large-latest',
    'mistral-medium-latest',
    'mistral-small-latest',
    'open-mistral-7b',
    'open-mixtral-8x7b',
    'open-mixtral-8x22b'
  ],
  deepseek: [
    'deepseek-chat',
    'deepseek-coder'
  ],
  lmstudio: [
    'local-model'
  ],
  ollama: [
    'llama3.2',
    'llama3.1',
    'mistral',
    'codellama'
  ],
  openrouter: [
    'anthropic/claude-3.5-sonnet',
    'openai/gpt-4o',
    'meta-llama/llama-3.1-405b-instruct',
    'google/gemini-pro-1.5'
  ],
  requesty: [
    'openai/gpt-4o-mini',
    'openai/gpt-4o',
    'anthropic/claude-3-5-sonnet-latest',
    'anthropic/claude-3-5-haiku-latest',
    'deepinfra/meta-llama/Llama-3.2-90B-Vision-Instruct',
    'together/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo'
  ],
  replicate: [
    'meta/llama-2-70b-chat',
    'mistralai/mixtral-8x7b-instruct-v0.1'
  ],
  n8n: [
    'n8n-workflow'
  ]
};

class LLMService {
  private providers: LLMProvider[] = DEFAULT_PROVIDERS;
  private modelCache: Map<string, { models: string[], timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Simple token estimation (roughly 4 characters per token for most models)
  private estimateTokens(text: string): number {
    if (!text) return 0;
    // More accurate estimation: count words, punctuation, and apply scaling
    const words = text.split(/\s+/).length;
    const chars = text.length;
    // Rough estimation: 0.75 tokens per word + 0.25 tokens per 4 characters
    return Math.ceil(words * 0.75 + chars * 0.25 / 4);
  }

  private createEstimatedUsage(promptText: string, responseText: string, label: string = 'estimated'): {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  } {
    const promptTokens = this.estimateTokens(promptText);
    const completionTokens = this.estimateTokens(responseText);
    const totalTokens = promptTokens + completionTokens;

    console.log(`📊 ${label} token usage:`, {
      promptTokens,
      completionTokens,
      totalTokens,
      promptChars: promptText.length,
      responseChars: responseText.length
    });

    return { promptTokens, completionTokens, totalTokens };
  }

  // MCP Integration


  // Helper to determine if tools should be sent based on conversation state
  private async shouldSendTools(conversationId: string | undefined, tools: ToolObject[]): Promise<boolean> {
    if (!conversationId || tools.length === 0) {
      return tools.length > 0; // Send tools if available and no conversation tracking
    }

    try {
      // Import conversation service dynamically to avoid circular dependencies
      const { conversationHistoryService } = await import('./conversationHistoryService');

      // Generate current tools hash
      const currentToolsHash = conversationHistoryService.generateToolsHash(tools);

      // Get stored tools hash for this conversation
      const storedToolsHash = await conversationHistoryService.getToolsHashForConversation(conversationId);

      // Send tools if:
      // 1. No stored hash (first message in conversation)
      // 2. Tools have changed (different hash)
      const shouldSend = !storedToolsHash || storedToolsHash !== currentToolsHash;

      if (shouldSend) {
        // Update stored hash for this conversation
        await conversationHistoryService.setToolsHashForConversation(conversationId, currentToolsHash);
        console.log(`🔧 Sending tools to ${conversationId}: ${tools.length} tools (hash: ${currentToolsHash})`);
      } else {
        console.log(`🔧 Skipping tools for ${conversationId}: no changes (hash: ${currentToolsHash})`);
      }

      return shouldSend;
    } catch (error) {
      console.error('Error checking tool state:', error);
      return tools.length > 0; // Fallback to always send tools
    }
  }

  private extractArgumentsFromMalformedJson(jsonString: string): Record<string, unknown> {
    try {
      console.log(`🔧 Attempting to extract arguments from malformed JSON:`, jsonString);

      // Try to fix common JSON issues
      let fixedJson = jsonString;

      // Fix unterminated strings by adding closing quotes
      const openQuotes = (fixedJson.match(/"/g) || []).length;
      if (openQuotes % 2 !== 0) {
        fixedJson += '"';
      }

      // Try to close unclosed braces
      const openBraces = (fixedJson.match(/\{/g) || []).length;
      const closeBraces = (fixedJson.match(/\}/g) || []).length;
      for (let i = 0; i < openBraces - closeBraces; i++) {
        fixedJson += '}';
      }

      // Try parsing the fixed JSON
      try {
        return JSON.parse(fixedJson);
      } catch {
        console.warn('Failed to parse fixed JSON, trying regex extraction');
      }

      // Fallback: extract key-value pairs using regex
      const args: Record<string, unknown> = {};

      // Extract "key": "value" patterns
      const keyValueRegex = /"([^"]+)":\s*"([^"]*)"/g;
      let match;
      while ((match = keyValueRegex.exec(jsonString)) !== null) {
        args[match[1]] = match[2];
      }

      // Extract "key": value patterns (without quotes on value)
      const keyValueNoQuotesRegex = /"([^"]+)":\s*([^,}\s]+)/g;
      while ((match = keyValueNoQuotesRegex.exec(jsonString)) !== null) {
        if (!args[match[1]]) { // Don't overwrite existing values
          args[match[1]] = match[2];
        }
      }

      console.log(`🔧 Extracted arguments from malformed JSON:`, args);
      return args;

    } catch (error) {
      console.error('Failed to extract arguments from malformed JSON:', error);
      return {};
    }
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
    const cleanedSchema: Record<string, unknown> = {
      type: schemaObj.type || 'object'
    };

    // Only include properties that Gemini supports
    if (schemaObj.properties && typeof schemaObj.properties === 'object') {
      cleanedSchema.properties = {};
      for (const [key, value] of Object.entries(schemaObj.properties)) {
        if (value && typeof value === 'object') {
          const valueObj = value as Record<string, unknown>;
          const cleanedProperty: Record<string, unknown> = {};

          // Copy basic properties that Gemini supports
          if (valueObj.type) cleanedProperty.type = valueObj.type;
          if (valueObj.description) cleanedProperty.description = valueObj.description;
          if (valueObj.enum) cleanedProperty.enum = valueObj.enum;
          if (valueObj.items) {
            cleanedProperty.items = this.cleanSchemaForGemini(valueObj.items);
          }
          if (valueObj.properties && typeof valueObj.properties === 'object') {
            cleanedProperty.properties = {};
            for (const [nestedKey, nestedValue] of Object.entries(valueObj.properties)) {
              (cleanedProperty.properties as Record<string, unknown>)[nestedKey] = this.cleanSchemaForGemini(nestedValue);
            }
          }

          // Handle minimum/maximum (but not exclusive versions)
          if (typeof valueObj.minimum === 'number') cleanedProperty.minimum = valueObj.minimum;
          if (typeof valueObj.maximum === 'number') cleanedProperty.maximum = valueObj.maximum;

          (cleanedSchema.properties as Record<string, unknown>)[key] = cleanedProperty;
        }
      }
    }

    // Include required array if it exists
    if (Array.isArray(schemaObj.required)) {
      cleanedSchema.required = schemaObj.required;
    }

    return cleanedSchema;
  }

  private checkModelToolSupport(model: string): boolean {
    // Be permissive - assume most modern models support tools
    // Only exclude models that are known NOT to support tools
    const unsupportedModels = [
      'text-davinci',
      'text-curie',
      'text-babbage',
      'text-ada',
      'code-davinci',
      'gpt-3.5-turbo-instruct'
    ];

    // Check if the model is in the unsupported list
    const isUnsupported = unsupportedModels.some(unsupportedModel =>
      model.toLowerCase().includes(unsupportedModel.toLowerCase())
    );

    // Default to supporting tools unless explicitly unsupported
    return !isUnsupported;
  }

  private generateToolInstructions(tools: unknown[], provider: string): string {
    if (tools.length === 0) return '';

    // Type guard for tool objects
    const isToolObject = (t: unknown): t is { function?: { name?: string; description?: string } } => {
      return typeof t === 'object' && t !== null;
    };

    // Group tools by functionality to identify redundant services
    const searchTools = tools.filter(t => {
      if (!isToolObject(t)) return false;
      const name = t.function?.name?.toLowerCase() || '';
      const desc = t.function?.description?.toLowerCase() || '';
      return name.includes('search') || desc.includes('search') ||
             name.includes('brave') || name.includes('tavily') || name.includes('searx');
    });

    const fetchTools = tools.filter(t => {
      if (!isToolObject(t)) return false;
      const name = t.function?.name?.toLowerCase() || '';
      const desc = t.function?.description?.toLowerCase() || '';
      return name.includes('fetch') || name.includes('get') || name.includes('request') ||
             desc.includes('fetch') || desc.includes('retrieve');
    });

    const otherTools = tools.filter(t =>
      !searchTools.includes(t) && !fetchTools.includes(t)
    );

    let instructions = `\n\nYou have access to the following tools. Use them when appropriate to help answer the user's question:\n\n`;

    // Add search tools with redundancy information
    if (searchTools.length > 0) {
      instructions += `**Search Tools** (multiple services available for redundancy):\n`;
      searchTools.forEach(tool => {
        if (isToolObject(tool) && tool.function && tool.function.name) {
          instructions += `- ${tool.function.name}: ${tool.function.description || 'No description available'}\n`;
        }
      });
      if (searchTools.length > 1) {
        instructions += `  → If one search service fails, try another search tool as they provide similar functionality.\n`;
      }
      instructions += `\n`;
    }

    // Add fetch tools with redundancy information
    if (fetchTools.length > 0) {
      instructions += `**Data Retrieval Tools** (multiple services available for redundancy):\n`;
      fetchTools.forEach(tool => {
        if (isToolObject(tool) && tool.function && tool.function.name) {
          instructions += `- ${tool.function.name}: ${tool.function.description || 'No description available'}\n`;
        }
      });
      if (fetchTools.length > 1) {
        instructions += `  → If one fetch service fails, try another retrieval tool as they provide similar functionality.\n`;
      }
      instructions += `\n`;
    }

    // Add other tools
    if (otherTools.length > 0) {
      instructions += `**Other Tools**:\n`;
      otherTools.forEach(tool => {
        if (isToolObject(tool) && tool.function && tool.function.name) {
          instructions += `- ${tool.function.name}: ${tool.function.description || 'No description available'}\n`;
        }
      });
      instructions += `\n`;
    }

    // Add provider-specific instructions
    if (provider === 'ollama') {
      instructions += `
**CRITICAL: Tool Calling Instructions for Ollama**
When you need to use a tool, you MUST respond with a proper tool call. Do NOT just talk about using tools.

Example of correct tool calling format:
If you need to search for weather, you must make an actual tool call like this:

\`\`\`json
{
  "tool": "tavily-search",
  "query": "weather in athens greece today",
  "search_depth": "basic",
  "topic": "general"
}
\`\`\`

IMPORTANT: Use the exact tool names with hyphens (tavily-search, brave-search, etc.), not underscores.

OR use the standard OpenAI format if your model supports it.

DO NOT just say "I'll search for weather" - you must actually call the tool!`;
    } else {
      instructions += `**Tool Usage Guidelines:**
- Use tools when they can help provide better, more accurate, or more current information
- If a tool fails, try an alternative tool with similar functionality when available
- Multiple search and fetch tools are provided for redundancy - use them as backups
- Always explain what tools you're using and why`;
    }

    return instructions;
  }

  private async getMCPToolsForProvider(provider: string, settings?: LLMSettings): Promise<unknown[]> {
    try {
      console.log(`🔍 Getting MCP tools for provider: ${provider}`);
      console.log(`🔍 MCP Service available:`, !!mcpService);
      console.log(`🔍 Tool calling enabled:`, settings?.toolCallingEnabled !== false);

      // Check if tool calling is disabled
      if (settings?.toolCallingEnabled === false) {
        console.log(`🚫 Tool calling is disabled, returning empty tools array`);
        return [];
      }

      const tools = await mcpService.getAvailableTools();
      console.log(`📋 Raw MCP tools discovered (${tools.length} tools):`, tools);

      if (tools.length > 0) {
        console.log(`📋 Tool details:`, tools.map(t => ({
          name: t.name,
          description: t.description,
          serverId: t.serverId,
          hasInputSchema: !!t.inputSchema,
          inputSchemaType: t.inputSchema?.type,
          inputSchemaProps: t.inputSchema?.properties ? Object.keys(t.inputSchema.properties) : [],
          fullInputSchema: t.inputSchema
        })));
      } else {
        console.warn(`⚠️ No MCP tools discovered! Checking MCP service status...`);
        // Try to get server status
        try {
          const servers = await mcpService.getServers();
          console.log(`📊 MCP Servers:`, servers.map(s => ({
            id: s.id,
            name: s.name,
            enabled: s.enabled
          })));

          const connectedIds = await mcpService.getConnectedServerIds();
          console.log(`🔗 Connected server IDs:`, connectedIds);
        } catch (error) {
          console.error(`❌ Failed to get MCP server status:`, error);
        }
      }

      if (!tools || tools.length === 0) {
        console.log(`⚠️ No MCP tools available for provider: ${provider}`);

        // Add a global test function for debugging
        if (typeof window !== 'undefined') {
          (window as Window & { testMCPConnectivity?: () => Promise<unknown> }).testMCPConnectivity = async () => {
            console.log('🧪 Testing MCP connectivity...');
            try {
              const detailedStatus = await mcpService.getDetailedStatus();
              console.log('📊 MCP Detailed Status:', detailedStatus);

              const servers = await mcpService.getServers();
              console.log('📋 MCP Servers:', servers);

              const tools = await mcpService.getAvailableTools();
              console.log('🛠️ Available Tools:', tools);

              return { detailedStatus, servers, tools };
            } catch (error) {
              console.error('❌ MCP connectivity test failed:', error);
              return { error: error instanceof Error ? error.message : String(error) };
            }
          };
          console.log('💡 Run window.testMCPConnectivity() in console to test MCP servers');
        }

        return [];
      }

      let formattedTools: unknown[] = [];

      // Format tools based on provider requirements
      if (provider === 'openai' || provider === 'openrouter' || provider === 'requesty' ||
          provider === 'mistral' || provider === 'deepseek' ||
          provider === 'lmstudio' || provider === 'ollama' || provider === 'replicate') {
        // OpenAI-compatible format (most providers use this)
        formattedTools = tools.map(tool => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.inputSchema || {
              type: 'object',
              properties: {},
              required: []
            }
          }
        }));
        console.log(`🔧 Formatted ${formattedTools.length} tools for OpenAI-compatible provider (${provider}):`, formattedTools);
      } else if (provider === 'gemini') {
        // Gemini format - single array of function declarations with cleaned schemas
        formattedTools = [{
          functionDeclarations: tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: this.cleanSchemaForGemini(tool.inputSchema)
          }))
        }];
        console.log(`🔧 Formatted ${formattedTools.length} tools for Gemini:`, formattedTools);
        console.log(`🔧 Gemini tool schemas sample:`, (formattedTools[0] as { functionDeclarations?: unknown[] })?.functionDeclarations?.slice(0, 2));
      } else if (provider === 'anthropic') {
        // Anthropic format
        formattedTools = tools.map(tool => ({
          name: tool.name,
          description: tool.description,
          input_schema: tool.inputSchema || {
            type: 'object',
            properties: {},
            required: []
          }
        }));
        console.log(`🔧 Formatted ${formattedTools.length} tools for Anthropic:`, formattedTools);
      } else {
        console.log(`⚠️ No tool formatting implemented for provider: ${provider}`);
      }

      if (formattedTools.length === 0 && tools.length > 0) {
        console.error(`❌ Tool formatting failed! Raw tools exist but formatted tools is empty.`);
        console.log(`🔍 Raw tools that failed formatting:`, tools);
        console.log(`🔍 Provider:`, provider);
      }

      console.log(`✅ Returning ${formattedTools.length} formatted tools for ${provider}`);
      return formattedTools;
    } catch (error) {
      console.error('❌ Failed to get MCP tools:', error);
      return [];
    }
  }

  private async executeMCPTool(toolName: string, args: Record<string, unknown>): Promise<string> {
    try {
      // Parse arguments if they're a JSON string
      let parsedArgs = args;
      if (typeof args === 'string') {
        try {
          parsedArgs = JSON.parse(args);
        } catch {
          console.warn(`⚠️ Failed to parse tool arguments as JSON, using as-is:`, args);
        }
      }

      console.log(`🔧 Executing MCP tool: ${toolName} with args:`, parsedArgs);
      const result = await mcpService.callTool(toolName, parsedArgs);
      console.log(`✅ MCP tool ${toolName} executed successfully:`, result);
      return JSON.stringify(result);
    } catch (error) {
      console.error(`❌ Failed to execute MCP tool ${toolName}:`, error);
      return `Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  getProviders(): LLMProvider[] {
    return this.providers;
  }

  getProvider(id: string): LLMProvider | undefined {
    return this.providers.find(p => p.id === id);
  }



  async fetchModels(providerId: string, apiKey?: string, baseUrl?: string): Promise<string[]> {
    console.log('🚀 fetchModels called with:', { providerId, hasApiKey: !!apiKey, baseUrl });
    const cacheKey = `${providerId}-${apiKey || 'no-key'}`;
    const cached = this.modelCache.get(cacheKey);

    // Return cached models if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log('🔄 Returning cached models for', providerId, ':', cached.models.slice(0, 3));
      return cached.models;
    }

    try {
      let models: string[] = [];

      switch (providerId) {
        case 'openai':
          models = await this.fetchOpenAIModels(apiKey);
          break;
        case 'anthropic':
          console.log('🔍 Fetching models for Anthropic provider');
          models = await this.fetchAnthropicModels(apiKey);
          console.log('🔍 Anthropic models fetched:', models);
          break;
        case 'gemini':
          models = await this.fetchGeminiModels(apiKey);
          break;
        case 'mistral':
          models = await this.fetchMistralModels(apiKey);
          break;
        case 'deepseek':
          models = await this.fetchDeepSeekModels(apiKey);
          break;
        case 'lmstudio':
          models = await this.fetchLMStudioModels(baseUrl);
          break;
        case 'ollama':
          models = await this.fetchOllamaModels(baseUrl);
          break;
        case 'openrouter':
          models = await this.fetchOpenRouterModels(apiKey);
          break;
        case 'requesty':
          models = await this.fetchRequestyModels(apiKey);
          break;
        case 'replicate':
          models = await this.fetchReplicateModels(apiKey);
          break;
        case 'n8n':
          models = await this.fetchN8nModels(baseUrl);
          break;
        default:
          models = FALLBACK_MODELS[providerId] || [];
      }

      // Cache the results
      this.modelCache.set(cacheKey, {
        models,
        timestamp: Date.now()
      });

      // Update the provider's models
      const provider = this.getProvider(providerId);
      if (provider) {
        provider.models = models;
      }

      return models;
    } catch (error) {
      console.error(`Failed to fetch models for ${providerId}:`, error);
      // Return fallback models
      const fallback = FALLBACK_MODELS[providerId] || [];

      // Update the provider's models with fallback
      const provider = this.getProvider(providerId);
      if (provider) {
        provider.models = fallback;
      }

      return fallback;
    }
  }

  private async fetchOpenAIModels(apiKey?: string): Promise<string[]> {
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

  private async fetchOllamaModels(baseUrl?: string): Promise<string[]> {
    if (!baseUrl) {
      return FALLBACK_MODELS.ollama;
    }
    const url = baseUrl;

    try {
      const response = await fetch(`${url}/api/tags`);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json() as { models?: Array<{ name: string }> };
      const models = data.models?.map((model) => model.name) || [];

      return models.length > 0 ? models : FALLBACK_MODELS.ollama;
    } catch {
      // Ollama might not be running
      return FALLBACK_MODELS.ollama;
    }
  }

  private async fetchOpenRouterModels(apiKey?: string): Promise<string[]> {
    if (!apiKey) {
      console.log('No OpenRouter API key provided, using fallback models');
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
        console.warn(`OpenRouter API error: ${response.status}, using fallback models`);
        return FALLBACK_MODELS.openrouter;
      }

      const data = await response.json() as APIResponseData;
      const models = data.data?.map((model) => model.id) || [];

      return models.length > 0 ? models : FALLBACK_MODELS.openrouter;
    } catch (error) {
      console.warn('Failed to fetch OpenRouter models, using fallback:', error);
      return FALLBACK_MODELS.openrouter;
    }
  }

  private async fetchRequestyModels(apiKey?: string): Promise<string[]> {
    if (!apiKey) {
      console.log('No Requesty API key provided, using fallback models');
      return FALLBACK_MODELS.requesty;
    }

    try {
      // Try to fetch models from Requesty's API (OpenAI-compatible endpoint)
      const response = await fetch('https://router.requesty.ai/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`Requesty models API error: ${response.status}, using fallback models`);
        return FALLBACK_MODELS.requesty;
      }

      const data = await response.json() as APIResponseData;
      const models = data.data?.map((model) => model.id) || [];

      if (models.length > 0) {
        console.log(`Fetched ${models.length} models from Requesty API`);
        return models;
      } else {
        console.log('No models returned from Requesty API, using fallback');
        return FALLBACK_MODELS.requesty;
      }
    } catch (error) {
      console.warn('Failed to fetch Requesty models, using fallback:', error);
      return FALLBACK_MODELS.requesty;
    }
  }

  private async fetchReplicateModels(apiKey?: string): Promise<string[]> {
    if (!apiKey) {
      return FALLBACK_MODELS.replicate;
    }

    // Replicate doesn't have a simple models endpoint, so we'll use popular models
    // In a real implementation, you might want to fetch from specific collections
    const popularModels = [
      'meta/llama-2-70b-chat',
      'meta/llama-2-13b-chat',
      'meta/llama-2-7b-chat',
      'mistralai/mistral-7b-instruct-v0.1',
      'mistralai/mixtral-8x7b-instruct-v0.1'
    ];

    return popularModels;
  }

  private async fetchAnthropicModels(apiKey?: string): Promise<string[]> {
    if (!apiKey) {
      console.log('🔍 No Anthropic API key provided, using fallback models');
      return FALLBACK_MODELS.anthropic;
    }

    try {
      console.log('🔍 Fetching Anthropic models from API...');
      const response = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`Anthropic API error: ${response.status} ${response.statusText}, using fallback models`);
        return FALLBACK_MODELS.anthropic;
      }

      const data = await response.json() as { data: Array<{ id: string; display_name: string }> };
      const models = data.data?.map((model) => model.id)?.sort() || [];

      console.log(`🔍 Fetched ${models.length} Anthropic models from API:`, models);
      return models.length > 0 ? models : FALLBACK_MODELS.anthropic;
    } catch (error) {
      console.warn('Failed to fetch Anthropic models from API, using fallback:', error);
      return FALLBACK_MODELS.anthropic;
    }
  }

  private async fetchGeminiModels(apiKey?: string): Promise<string[]> {
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

  private async fetchMistralModels(apiKey?: string): Promise<string[]> {
    if (!apiKey) {
      console.log('No Mistral API key provided, using fallback models');
      return FALLBACK_MODELS.mistral;
    }

    try {
      // Mistral AI models endpoint - correct API endpoint from their documentation
      const response = await fetch('https://api.mistral.ai/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`Mistral API error: ${response.status} ${response.statusText}, using fallback models`);
        return FALLBACK_MODELS.mistral;
      }

      const data = await response.json() as APIResponseData;
      console.log('Mistral API response:', data);

      // Mistral API returns models in data array with id field
      const models = data.data?.map((model) => model.id)?.sort() || [];

      console.log(`Fetched ${models.length} Mistral models:`, models);
      return models.length > 0 ? models : FALLBACK_MODELS.mistral;
    } catch (error) {
      console.warn('Failed to fetch Mistral models, using fallback:', error);
      return FALLBACK_MODELS.mistral;
    }
  }

  private async fetchDeepSeekModels(apiKey?: string): Promise<string[]> {
    if (!apiKey) {
      console.log('No DeepSeek API key provided, using fallback models');
      return FALLBACK_MODELS.deepseek;
    }

    try {
      // DeepSeek models endpoint (OpenAI-compatible)
      const response = await fetch('https://api.deepseek.com/v1/models', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`DeepSeek API error: ${response.status}, using fallback models`);
        return FALLBACK_MODELS.deepseek;
      }

      const data = await response.json() as APIResponseData;
      const models = data.data?.map((model) => model.id)?.sort() || [];

      return models.length > 0 ? models : FALLBACK_MODELS.deepseek;
    } catch (error) {
      console.warn('Failed to fetch DeepSeek models, using fallback:', error);
      return FALLBACK_MODELS.deepseek;
    }
  }

  private async fetchLMStudioModels(baseUrl?: string): Promise<string[]> {
    if (!baseUrl) {
      console.log('No LM Studio base URL provided, using fallback models');
      return FALLBACK_MODELS.lmstudio;
    }

    try {
      // LM Studio models endpoint (OpenAI-compatible)
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        console.warn(`LM Studio API error: ${response.status}, using fallback models`);
        return FALLBACK_MODELS.lmstudio;
      }

      const data = await response.json() as APIResponseData;
      const models = data.data?.map((model) => model.id)?.sort() || [];

      return models.length > 0 ? models : FALLBACK_MODELS.lmstudio;
    } catch (error) {
      console.warn('Failed to fetch LM Studio models, using fallback:', error);
      return FALLBACK_MODELS.lmstudio;
    }
  }

  private async fetchN8nModels(baseUrl?: string): Promise<string[]> {
    if (!baseUrl) {
      console.log('No n8n webhook URL provided, using fallback models');
      return FALLBACK_MODELS.n8n;
    }

    try {
      // For n8n workflows, we don't fetch models from an endpoint
      // Instead, we return a list of workflow names/IDs that the user can configure
      // This is a placeholder - in a real implementation, you might want to:
      // 1. Parse the webhook URL to extract workflow info
      // 2. Allow users to configure custom workflow names
      // 3. Store workflow configurations in settings

      const workflowName = this.extractWorkflowNameFromUrl(baseUrl);
      return workflowName ? [workflowName] : ['n8n-workflow'];
    } catch (error) {
      console.warn('Failed to process n8n workflow URL, using fallback:', error);
      return FALLBACK_MODELS.n8n;
    }
  }

  private extractWorkflowNameFromUrl(url: string): string | null {
    try {
      // Extract a meaningful name from the webhook URL
      // This is a simple implementation - you might want to make this more sophisticated
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);

      // Look for webhook ID or workflow name in the path
      if (pathParts.length > 0) {
        const lastPart = pathParts[pathParts.length - 1];
        return `n8n-${lastPart}`;
      }

      return 'n8n-workflow';
    } catch {
      return null;
    }
  }

  async sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string // Add conversation ID for tool state tracking
  ): Promise<LLMResponse> {
    const provider = this.getProvider(settings.provider);
    if (!provider) {
      throw new Error(`Provider ${settings.provider} not found`);
    }

    switch (settings.provider) {
      case 'openai':
        return this.sendOpenAIMessage(message, settings, provider, conversationHistory, onStream, signal, conversationId);
      case 'anthropic':
        return this.sendAnthropicMessage(message, settings, provider, conversationHistory, onStream, signal);
      case 'gemini':
        return this.sendGeminiMessage(message, settings, provider, conversationHistory, onStream, signal);
      case 'mistral':
        return this.sendMistralMessage(message, settings, provider, conversationHistory, onStream, signal);
      case 'deepseek':
        return this.sendDeepSeekMessage(message, settings, provider, conversationHistory, onStream, signal);
      case 'lmstudio':
        return this.sendLMStudioMessage(message, settings, provider, conversationHistory, onStream, signal);
      case 'ollama':
        return this.sendOllamaMessage(message, settings, provider, conversationHistory, onStream, signal);
      case 'openrouter':
        return this.sendOpenRouterMessage(message, settings, provider, conversationHistory, onStream, signal);
      case 'requesty':
        return this.sendRequestyMessage(message, settings, provider, conversationHistory, onStream, signal);
      case 'replicate':
        return this.sendReplicateMessage(message, settings, provider, conversationHistory, onStream);
      case 'n8n':
        return this.sendN8nMessage(message, settings, provider, conversationHistory, onStream, signal);
      default:
        throw new Error(`Provider ${settings.provider} not implemented`);
    }
  }

  private async sendOpenAIMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    _signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
    const messages = [];

    // Get MCP tools for this provider first
    const mcpTools = await this.getMCPToolsForProvider('openai', settings);

    // Build enhanced system prompt with tool instructions
    let systemPrompt = settings.systemPrompt || '';
    if (mcpTools.length > 0) {
      const toolInstructions = this.generateToolInstructions(mcpTools, 'openai');
      systemPrompt += toolInstructions;
    }

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Add current message (handle both string and array formats)
    messages.push({ role: 'user', content: message });

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };

    // Add tools if available and should be sent (conversation-level optimization)
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

    console.log(`🔍 OpenAI request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`🔍 OpenAI response status:`, response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();



      throw new Error(`OpenAI API error: ${error}`);
    }

    if (onStream) {
      const streamResult = await this.handleStreamResponse(response, onStream);

      // If tool calls were detected in the stream, execute them
      if (streamResult.toolCalls && streamResult.toolCalls.length > 0) {
        console.log(`🔧 OpenAI streaming detected ${streamResult.toolCalls.length} tool calls, executing...`);

        // Execute all tool calls
        const toolResults = [];
        for (const toolCall of streamResult.toolCalls) {
          try {
            console.log(`🔧 Executing OpenAI tool call: ${toolCall.name}`);
            const toolName = toolCall.name;
            const toolArgs = typeof toolCall.arguments === 'string' ? JSON.parse(toolCall.arguments) : toolCall.arguments;
            const toolResult = await this.executeMCPTool(toolName, toolArgs);
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult)
            });
          } catch (error) {
            console.error(`❌ Tool execution failed:`, error);
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
            });
          }
        }

        // Make follow-up call with tool results (clean context)
        const userMessages = messages.filter(msg => msg.role !== 'system');

        // Convert tool calls to OpenAI format for follow-up
        const openaiToolCalls = streamResult.toolCalls.map((tc: { id: string; name: string; arguments: ToolCallArguments }) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: typeof tc.arguments === 'string' ? tc.arguments : JSON.stringify(tc.arguments)
          }
        }));

        const followUpMessages = [
          { role: 'system', content: 'Based on the tool results provided, give a helpful and natural response to the user\'s question.' },
          ...userMessages,
          { role: 'assistant', content: streamResult.content, tool_calls: openaiToolCalls },
          ...toolResults
        ];

        console.log(`🔄 Making OpenAI follow-up call to process tool results...`);
        console.log(`🔍 Follow-up messages:`, JSON.stringify(followUpMessages, null, 2));

        const followUpRequestBody = {
          model: settings.model,
          messages: followUpMessages,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          stream: false
        };

        console.log(`🔍 Follow-up request body:`, JSON.stringify(followUpRequestBody, null, 2));

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
            promptTokens: (streamResult.usage?.promptTokens || 0) + (followUpData.usage?.prompt_tokens || 0),
            completionTokens: (streamResult.usage?.completionTokens || 0) + (followUpData.usage?.completion_tokens || 0),
            totalTokens: (streamResult.usage?.totalTokens || 0) + (followUpData.usage?.total_tokens || 0)
          };

          return {
            content: followUpMessage?.content || 'Tool execution completed.',
            usage: combinedUsage,
            toolCalls: streamResult.toolCalls
          };
        } else {
          const errorText = await followUpResponse.text();
          console.error(`❌ OpenAI follow-up call failed (${followUpResponse.status}):`, errorText);
          console.error(`❌ Follow-up request that failed:`, JSON.stringify(followUpRequestBody, null, 2));
        }
      }

      return streamResult;
    } else {
      const data = await response.json();
      const choice = data.choices[0];
      const message = choice.message;

      // Handle tool calls
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`🔧 OpenAI response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);
        let content = message.content || '';

        // Execute each tool call
        for (const toolCall of message.tool_calls) {
          try {
            console.log(`🔧 Executing tool call:`, toolCall);
            const toolResult = await this.executeMCPTool(
              toolCall.function.name,
              JSON.parse(toolCall.function.arguments)
            );
            content += `\n\n**Tool: ${toolCall.function.name}**\n${toolResult}`;
          } catch (error) {
            console.error(`❌ Tool call failed:`, error);
            content += `\n\n**Tool Error: ${toolCall.function.name}**\n${error instanceof Error ? error.message : String(error)}`;
          }
        }

        return {
          content,
          usage: data.usage,
          toolCalls: message.tool_calls.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments)
          }))
        };
      }

      return {
        content: message.content,
        usage: data.usage
      };
    }
  }

  private async sendAnthropicMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    // Debug API key details
    console.log('🔍 Anthropic API key debug:', {
      hasApiKey: !!settings.apiKey,
      keyLength: settings.apiKey?.length || 0,
      keyStart: settings.apiKey?.substring(0, 10) || 'undefined',
      keyType: typeof settings.apiKey,
      startsWithSkAnt: settings.apiKey?.startsWith('sk-ant-') || false
    });

    // Validate API key format
    if (!settings.apiKey || !settings.apiKey.startsWith('sk-ant-')) {
      console.error('❌ Anthropic API key validation failed:', {
        apiKey: settings.apiKey,
        hasApiKey: !!settings.apiKey,
        startsWithSkAnt: settings.apiKey?.startsWith('sk-ant-')
      });
      throw new Error('Invalid Anthropic API key format. Key should start with "sk-ant-"');
    }

    // Adjust max_tokens based on Claude model limits
    let maxTokens = settings.maxTokens;
    if (settings.model.includes('claude-3-5-haiku')) {
      maxTokens = Math.min(maxTokens, 8192);
    } else if (settings.model.includes('claude-3-opus') || settings.model.includes('claude-3-sonnet') || settings.model.includes('claude-3-haiku')) {
      // Claude 3 models have 4096 max output tokens
      maxTokens = Math.min(maxTokens, 4096);
    } else if (settings.model.includes('claude-3-5-sonnet')) {
      maxTokens = Math.min(maxTokens, 8192);
    } else {
      // Default Claude limit
      maxTokens = Math.min(maxTokens, 4096);
    }

    const messages = [];

    // Add conversation history - filter out empty messages for Anthropic
    for (const historyMessage of conversationHistory) {
      let content: string;
      if (typeof historyMessage.content === 'string') {
        content = historyMessage.content.trim();
      } else if (Array.isArray(historyMessage.content)) {
        // Extract text from array format
        content = historyMessage.content.map((item: ContentItem | string) => {
          if (typeof item === 'string') return item;
          if (item.type === 'text') return item.text;
          return '[Non-text content]';
        }).join(' ').trim();
      } else {
        content = String(historyMessage.content).trim();
      }

      // Only add messages with non-empty content
      if (content) {
        messages.push({
          role: historyMessage.role,
          content: content
        });
      } else {
        console.warn(`⚠️ Skipping empty message in Anthropic conversation history:`, historyMessage);
      }
    }

    // Add current message
    if (typeof message === 'string') {
      messages.push({ role: 'user', content: message });
    } else if (Array.isArray(message)) {
      messages.push({ role: 'user', content: message });
    } else {
      // Handle vision format
      const messageWithImages = message as { text: string; images: string[] };
      const content = [];
      content.push({ type: 'text', text: messageWithImages.text });

      // Add images in Anthropic format
      for (const imageUrl of messageWithImages.images) {
        // Determine media type from data URL
        const mediaType = imageUrl.includes('data:image/png') ? 'image/png' :
                         imageUrl.includes('data:image/gif') ? 'image/gif' :
                         imageUrl.includes('data:image/webp') ? 'image/webp' : 'image/jpeg';

        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: imageUrl.split(',')[1] // Remove data:image/jpeg;base64, prefix
          }
        });
      }
      messages.push({ role: 'user', content });
    }

    // Get MCP tools for Anthropic
    const mcpTools = await this.getMCPToolsForProvider('anthropic', settings);

    // Build enhanced system prompt with tool instructions
    let systemPrompt = settings.systemPrompt || '';
    if (mcpTools.length > 0) {
      const toolInstructions = this.generateToolInstructions(mcpTools, 'anthropic');
      systemPrompt += toolInstructions;
    }

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      max_tokens: maxTokens,
      temperature: settings.temperature,
      system: systemPrompt || undefined,
      messages: messages,
      stream: !!onStream
    };

    // Add tools if available
    if (mcpTools.length > 0) {
      requestBody.tools = mcpTools;
      console.log(`🚀 Anthropic API call with ${mcpTools.length} tools:`, {
        model: settings.model,
        toolCount: mcpTools.length,
        tools: mcpTools
      });
    } else {
      console.log(`🚀 Anthropic API call without tools (no MCP tools available)`);
    }

    console.log('🔍 Anthropic request body:', JSON.stringify(requestBody, null, 2));

    const response = await fetch(`${provider.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(requestBody),
      signal
    });

    console.log('🔍 Anthropic response status:', response.status, response.statusText);

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Anthropic API error response:', error);
      if (response.status === 401) {
        throw new Error(`Anthropic API authentication failed. Please check your API key in Settings. The key may be expired or invalid. Error: ${error}`);
      }
      throw new Error(`Anthropic API error: ${error}`);
    }

    if (onStream) {
      return this.handleAnthropicStreamResponse(response, onStream, settings, provider, conversationHistory, signal);
    } else {
      const data = await response.json();
      console.log('🔍 Anthropic raw response:', JSON.stringify(data, null, 2));

      // Handle tool calls in Anthropic format
      let content = '';
      const toolCalls = [];
      const toolResults = [];

      for (const contentBlock of data.content) {
        if (contentBlock.type === 'text') {
          content += contentBlock.text;
        } else if (contentBlock.type === 'tool_use') {
          console.log(`🔧 Anthropic response contains tool use:`, contentBlock);
          try {
            const toolResult = await this.executeMCPTool(
              contentBlock.name,
              contentBlock.input
            );

            // Store tool result for follow-up call
            toolResults.push({
              type: 'tool_result',
              tool_use_id: contentBlock.id,
              content: toolResult
            });

            toolCalls.push({
              id: contentBlock.id,
              name: contentBlock.name,
              arguments: contentBlock.input
            });
          } catch (error) {
            console.error(`❌ Anthropic tool call failed:`, error);
            // Store error result for follow-up call
            toolResults.push({
              type: 'tool_result',
              tool_use_id: contentBlock.id,
              content: `Error: ${error instanceof Error ? error.message : String(error)}`,
              is_error: true
            });
          }
        }
      }

      // If we have tool results, make a follow-up call to get the final response
      if (toolResults.length > 0) {
        console.log(`🔄 Making follow-up Anthropic call with ${toolResults.length} tool results`);

        // Add the assistant's tool use message to conversation
        const updatedMessages = [...messages, {
          role: 'assistant',
          content: data.content
        }];

        // Add tool results as user message
        updatedMessages.push({
          role: 'user',
          content: toolResults
        });

        const followUpRequestBody = {
          model: settings.model,
          max_tokens: maxTokens,
          temperature: settings.temperature,
          system: settings.systemPrompt || undefined,
          messages: updatedMessages
        };

        const followUpResponse = await fetch(`${provider.baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': settings.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(followUpRequestBody),
          signal
        });

        if (followUpResponse.ok) {
          const followUpData = await followUpResponse.json();
          console.log(`✅ Anthropic follow-up response received`);

          // Extract final content from follow-up response
          let finalContent = content; // Start with initial content
          for (const block of followUpData.content) {
            if (block.type === 'text') {
              finalContent += '\n\n' + block.text;
            }
          }

          return {
            content: finalContent,
            usage: followUpData.usage ? {
              promptTokens: (data.usage?.input_tokens || 0) + (followUpData.usage?.input_tokens || 0),
              completionTokens: (data.usage?.output_tokens || 0) + (followUpData.usage?.output_tokens || 0),
              totalTokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0) +
                          (followUpData.usage?.input_tokens || 0) + (followUpData.usage?.output_tokens || 0)
            } : undefined,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined
          };
        } else {
          console.error(`❌ Anthropic follow-up call failed:`, await followUpResponse.text());
          // Fall back to showing tool results directly
          content += '\n\n**Tool Results:**\n' + toolResults.map(tr => tr.content).join('\n\n');
        }
      }

      console.log('🔍 Anthropic raw usage data:', data.usage);

      return {
        content,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens
        } : undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined
      };
    }
  }

  private async sendGeminiMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const contents = [];

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
      contents.push({
        role: 'user',
        parts: [{ text: JSON.stringify(message) }]
      });
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
    const mcpTools = await this.getMCPToolsForProvider('gemini', settings);

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
    if (mcpTools.length > 0) {
      requestBody.tools = mcpTools;
      console.log(`🚀 Gemini API call with ${mcpTools.length} tools:`, {
        model: settings.model,
        toolCount: mcpTools.length,
        tools: mcpTools
      });
    } else {
      console.log(`🚀 Gemini API call without tools (no MCP tools available)`);
    }

    if (settings.systemPrompt) {
      requestBody.system_instruction = {
        parts: [{ text: settings.systemPrompt }]
      };
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
      return this.handleGeminiStreamResponse(response, onStream, settings, provider);
    } else {
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
            try {
              const toolResult = await this.executeMCPTool(
                part.functionCall.name,
                part.functionCall.args
              );
              content += `\n\n**Tool: ${part.functionCall.name}**\n${toolResult}`;
              toolCalls.push({
                id: `gemini-${Date.now()}`,
                name: part.functionCall.name,
                arguments: part.functionCall.args
              });
            } catch (error) {
              console.error(`❌ Gemini tool call failed:`, error);
              content += `\n\n**Tool Error: ${part.functionCall.name}**\n${error instanceof Error ? error.message : String(error)}`;
            }
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

  private async sendMistralMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    // Mistral uses OpenAI-compatible API
    const messages = [];

    // Get MCP tools for Mistral first
    const mcpTools = await this.getMCPToolsForProvider('mistral', settings);

    // Build enhanced system prompt with tool instructions
    let systemPrompt = settings.systemPrompt || '';
    if (mcpTools.length > 0) {
      const toolInstructions = this.generateToolInstructions(mcpTools, 'mistral');
      systemPrompt += toolInstructions;
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
      // Handle vision format (convert to OpenAI format)
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
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };

    // Add tools if available
    if (mcpTools.length > 0) {
      requestBody.tools = mcpTools;
      requestBody.tool_choice = 'auto';
      console.log(`🚀 Mistral API call with ${mcpTools.length} tools:`, {
        model: settings.model,
        toolCount: mcpTools.length,
        tools: mcpTools
      });
    } else {
      console.log(`🚀 Mistral API call without tools (no MCP tools available)`);
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral API error: ${error}`);
    }

    if (onStream) {
      const streamResult = await this.handleMistralStreamResponse(response, onStream);

      // Check if there are tool calls that need follow-up processing
      if (streamResult.toolCalls && streamResult.toolCalls.length > 0) {
        console.log(`🔄 Mistral streaming: Processing ${streamResult.toolCalls.length} tool calls for follow-up`);

        // Build conversation history with tool calls and results
        // Mistral requires assistant message to have EITHER content OR tool_calls, not both
        const toolConversationHistory = [
          ...messages,
          { role: 'assistant', tool_calls: streamResult.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments)
            }
          })) }
        ];

        // Execute tool calls and add results to conversation
        for (const toolCall of streamResult.toolCalls) {
          try {
            console.log(`🔧 Executing tool for Mistral follow-up:`, toolCall);
            const toolResult = await this.executeMCPTool(toolCall.name, toolCall.arguments);
            toolConversationHistory.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult)
            } as { role: string; tool_call_id: string; content: string });
          } catch (error) {
            console.error(`❌ Tool execution failed in Mistral follow-up:`, error);
            toolConversationHistory.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
            } as { role: string; tool_call_id: string; content: string });
          }
        }

        // Make follow-up call to get LLM's processed response
        console.log(`🔄 Making follow-up Mistral call after streaming to process tool results...`);
        const followUpRequestBody = {
          model: settings.model,
          messages: toolConversationHistory,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          stream: false // Use non-streaming for follow-up
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

        if (!followUpResponse.ok) {
          const error = await followUpResponse.text();
          console.error(`❌ Mistral follow-up call failed:`, error);
          // Return original response if follow-up fails
          return streamResult;
        }

        const followUpData = await followUpResponse.json();
        const followUpMessage = followUpData.choices[0]?.message;

        // Combine the original response with the follow-up
        const combinedUsage = {
          promptTokens: (streamResult.usage?.promptTokens || 0) + (followUpData.usage?.prompt_tokens || 0),
          completionTokens: (streamResult.usage?.completionTokens || 0) + (followUpData.usage?.completion_tokens || 0),
          totalTokens: (streamResult.usage?.totalTokens || 0) + (followUpData.usage?.total_tokens || 0)
        };

        return {
          content: (streamResult.content || '') + '\n\n' + (followUpMessage?.content || 'Tool execution completed.'),
          usage: combinedUsage,
          toolCalls: streamResult.toolCalls
        };
      }

      return streamResult;
    } else {
      const data = await response.json();
      console.log(`🔍 Mistral raw response:`, JSON.stringify(data, null, 2));
      const choice = data.choices[0];
      const message = choice.message;
      console.log(`🔍 Mistral message:`, message);

      // Handle tool calls using two-call pattern (like Anthropic/Gemini)
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`🔧 Mistral response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);

        // Execute each tool call and collect results
        const toolResults = [];
        for (const toolCall of message.tool_calls) {
          try {
            console.log(`🔧 Executing Mistral tool call:`, toolCall);
            const toolResult = await this.executeMCPTool(
              toolCall.function.name,
              JSON.parse(toolCall.function.arguments)
            );
            console.log(`✅ Mistral tool result:`, toolResult);
            toolResults.push({
              role: 'tool',
              name: toolCall.function.name,
              content: JSON.stringify(toolResult),
              tool_call_id: toolCall.id
            } as { role: string; content: string; tool_call_id: string });
          } catch (error) {
            console.error(`❌ Mistral tool call failed:`, error);
            toolResults.push({
              role: 'tool',
              name: toolCall.function.name,
              content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
              tool_call_id: toolCall.id
            } as { role: string; content: string; tool_call_id: string });
          }
        }

        // Build conversation history with tool calls and results
        // Get the original user message from the messages array
        const originalUserMessage = messages[messages.length - 1];

        const toolConversationHistory = [
          ...messages.slice(0, -1), // All messages except the last user message
          originalUserMessage, // The original user message
          { role: 'assistant', tool_calls: message.tool_calls },
          ...toolResults
        ];

        // Make second call to get LLM's processed response
        console.log(`🔄 Making second Mistral call to process tool results...`);
        console.log(`🔍 Tool conversation history:`, JSON.stringify(toolConversationHistory, null, 2));
        const secondRequestBody = {
          model: settings.model,
          messages: toolConversationHistory,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          stream: false
        };

        const secondResponse = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`
          },
          body: JSON.stringify(secondRequestBody),
          signal
        });

        if (!secondResponse.ok) {
          const error = await secondResponse.text();
          throw new Error(`Mistral second API call error: ${error}`);
        }

        const secondData = await secondResponse.json();
        const secondMessage = secondData.choices[0]?.message;

        return {
          content: secondMessage?.content || 'Tool execution completed.',
          usage: {
            promptTokens: (data.usage?.prompt_tokens || 0) + (secondData.usage?.prompt_tokens || 0),
            completionTokens: (data.usage?.completion_tokens || 0) + (secondData.usage?.completion_tokens || 0),
            totalTokens: (data.usage?.total_tokens || 0) + (secondData.usage?.total_tokens || 0)
          },
          toolCalls: message.tool_calls.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments)
          }))
        };
      }

      // Check for empty content
      const content = message.content || '';
      if (!content && mcpTools.length > 0) {
        console.warn(`⚠️ Mistral returned empty content but tools were available. This might indicate a tool calling issue.`);
        console.log(`🔧 Available tools:`, mcpTools.map(t => (t as ToolObject).function?.name).filter(Boolean));
        console.log(`🔍 Full message object:`, message);
      }

      return {
        content: content,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0
        } : undefined
      };
    }
  }

  private async sendDeepSeekMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    // DeepSeek uses OpenAI-compatible API
    const messages = [];

    if (settings.systemPrompt) {
      messages.push({ role: 'system', content: settings.systemPrompt });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Add current message
    if (typeof message === 'string') {
      messages.push({ role: 'user', content: message });
    } else if (Array.isArray(message)) {
      messages.push({ role: 'user', content: message });
    } else {
      // Handle vision format (convert to OpenAI format)
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

    // Get MCP tools for DeepSeek
    const mcpTools = await this.getMCPToolsForProvider('deepseek', settings);

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };

    // Add tools if available
    if (mcpTools.length > 0) {
      requestBody.tools = mcpTools;
      requestBody.tool_choice = 'auto';
      console.log(`🚀 DeepSeek API call with ${mcpTools.length} tools:`, {
        model: settings.model,
        toolCount: mcpTools.length,
        tools: mcpTools
      });
    } else {
      console.log(`🚀 DeepSeek API call without tools (no MCP tools available)`);
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek API error: ${error}`);
    }

    if (onStream) {
      return this.handleStreamResponse(response, onStream);
    } else {
      const data = await response.json();
      console.log('🔍 DeepSeek non-streaming response:', {
        hasUsage: !!data.usage,
        usage: data.usage,
        responseKeys: Object.keys(data)
      });

      const choice = data.choices[0];
      const message = choice.message;

      // Handle tool calls (same as OpenAI format)
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`🔧 DeepSeek response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);
        let content = message.content || '';

        // Execute each tool call
        for (const toolCall of message.tool_calls) {
          try {
            console.log(`🔧 Executing DeepSeek tool call:`, toolCall);
            const toolResult = await this.executeMCPTool(
              toolCall.function.name,
              JSON.parse(toolCall.function.arguments)
            );
            content += `\n\n**Tool: ${toolCall.function.name}**\n${toolResult}`;
          } catch (error) {
            console.error(`❌ DeepSeek tool call failed:`, error);
            content += `\n\n**Tool Error: ${toolCall.function.name}**\n${error instanceof Error ? error.message : String(error)}`;
          }
        }

        return {
          content,
          usage: data.usage,
          toolCalls: message.tool_calls.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments)
          }))
        };
      }

      return {
        content: message.content,
        usage: data.usage
      };
    }
  }

  private async sendLMStudioMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    // LM Studio uses OpenAI-compatible API
    const baseUrl = settings.baseUrl || provider.baseUrl;
    const messages = [];

    // Get MCP tools for LMStudio
    const mcpTools = await this.getMCPToolsForProvider('lmstudio', settings);

    // Build system prompt with tool instructions if tools are available
    let systemPrompt = settings.systemPrompt || '';
    if (mcpTools.length > 0) {
      const toolInstructions = this.generateToolInstructions(mcpTools, 'lmstudio');
      systemPrompt += toolInstructions;
      systemPrompt += `\n\nIMPORTANT: Only use the tools listed above. Do not use any other tools like 'get_weather' or similar tools that are not in the list. If you need weather information, use the search tools provided.`;
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
      // Handle vision format (convert to OpenAI format)
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

    // MCP tools already retrieved above for system prompt

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };

    // Add tools if available
    if (mcpTools.length > 0) {
      requestBody.tools = mcpTools;
      // Try different tool_choice strategies for LMStudio
      requestBody.tool_choice = 'auto'; // Could also try 'required' or specific tool
      console.log(`🚀 LMStudio API call with ${mcpTools.length} tools:`, {
        model: settings.model,
        toolCount: mcpTools.length,
        toolNames: mcpTools.map(t => (t as ToolObject).function?.name).filter(Boolean)
      });
      console.log(`🔧 LMStudio request body:`, JSON.stringify(requestBody, null, 2));
    } else {
      console.log(`🚀 LMStudio API call without tools (no MCP tools available)`);
    }

    // Fix URL - baseUrl already includes /v1, so just add /chat/completions
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
      return this.handleLMStudioStreamResponse(response, onStream, settings, provider, conversationHistory, signal, message);
    } else {
      const data = await response.json();
      console.log(`🔍 LMStudio raw response:`, JSON.stringify(data, null, 2));
      const message = data.choices[0].message;
      console.log(`🔍 LMStudio message:`, message);

      // Handle tool calls using two-call pattern (like Anthropic/Gemini)
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`🔧 LMStudio response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);

        // Execute each tool call and collect results
        const toolResults = [];
        for (const toolCall of message.tool_calls) {
          try {
            console.log(`🔧 Executing LMStudio tool call:`, toolCall);
            const toolResult = await this.executeMCPTool(
              toolCall.function.name,
              JSON.parse(toolCall.function.arguments)
            );
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              content: JSON.stringify(toolResult)
            } as { tool_call_id: string; role: string; content: string });
          } catch (error) {
            console.error(`❌ LMStudio tool call failed:`, error);
            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
            } as { tool_call_id: string; role: string; content: string });
          }
        }

        // Build conversation history with tool calls and results
        // Extract the original user message from the function parameters
        const userMessage = typeof message === 'string' ? message :
          (typeof message === 'object' && 'text' in message) ? message.text : JSON.stringify(message);

        const toolConversationHistory = [
          ...conversationHistory,
          { role: 'user', content: userMessage },
          { role: 'assistant', tool_calls: data.choices[0].message.tool_calls }, // Use tool_calls from LLM response
          ...toolResults
        ];

        // Make second call to get LLM's processed response
        console.log(`🔄 Making second LMStudio call to process tool results...`);
        console.log(`🔄 Tool conversation history:`, JSON.stringify(toolConversationHistory, null, 2));

        const secondRequestBody = {
          model: settings.model,
          messages: toolConversationHistory,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          stream: false
        };

        const secondResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey || 'not-needed'}`
          },
          body: JSON.stringify(secondRequestBody),
          signal
        });

        if (!secondResponse.ok) {
          const error = await secondResponse.text();
          throw new Error(`LMStudio second API call error: ${error}`);
        }

        const secondData = await secondResponse.json();
        console.log(`🔍 LMStudio second response:`, JSON.stringify(secondData, null, 2));
        const secondMessage = secondData.choices[0]?.message;
        console.log(`🔍 LMStudio final message:`, secondMessage);

        return {
          content: secondMessage?.content || 'Tool execution completed.',
          usage: {
            promptTokens: (data.usage?.prompt_tokens || 0) + (secondData.usage?.prompt_tokens || 0),
            completionTokens: (data.usage?.completion_tokens || 0) + (secondData.usage?.completion_tokens || 0),
            totalTokens: (data.usage?.total_tokens || 0) + (secondData.usage?.total_tokens || 0)
          },
          toolCalls: data.choices[0].message.tool_calls.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments)
          }))
        };
      }

      // Check if the model is thinking about tools but not using them
      const content = message.content || '';
      const isThinkingAboutTools = content.toLowerCase().includes('tool') &&
                                   (content.includes('brave_web_search') ||
                                    content.includes('send_notification') ||
                                    content.includes('search') ||
                                    content.includes('function'));

      if (isThinkingAboutTools && mcpTools.length > 0) {
        console.log(`⚠️ LMStudio model is thinking about tools but not using them. Response:`, content.substring(0, 200));
        console.log(`🔧 Available tools:`, mcpTools.map(t => (t as ToolObject).function?.name).filter(Boolean));
      }

      return {
        content: message.content,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0
        } : undefined
      };
    }
  }

  private async sendOllamaMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const baseUrl = settings.baseUrl || provider.baseUrl;

    // Get MCP tools for Ollama
    const mcpTools = await this.getMCPToolsForProvider('ollama', settings);

    // Check if this is a vision model request (has images)
    const hasImages = typeof message === 'object' && !Array.isArray(message) && 'images' in message && message.images && message.images.length > 0;

    // Use Ollama's chat API (supports both vision and tools)
    const messages = [];

    // Build system prompt with tool instructions if tools are available
    let systemPrompt = settings.systemPrompt || '';
    if (mcpTools.length > 0) {
      const toolInstructions = this.generateToolInstructions(mcpTools, 'ollama');
      systemPrompt += toolInstructions;
      systemPrompt += `\n\nIMPORTANT: Only use the tools listed above. Do not use any other tools like 'get_weather' or similar tools that are not in the list. If you need weather information, use the search tools provided.`;
    }

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Add current message
    if (hasImages) {
      const messageWithImages = message as { text: string; images: string[] };
      messages.push({
        role: 'user',
        content: messageWithImages.text,
        images: messageWithImages.images // Array of base64 encoded images
      });
    } else {
      messages.push({
        role: 'user',
        content: typeof message === 'string' ? message : JSON.stringify(message)
      });
    }

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };

    // Add tools if available
    if (mcpTools.length > 0) {
      requestBody.tools = mcpTools;
      console.log(`🚀 Ollama API call with ${mcpTools.length} tools:`, {
        model: settings.model,
        toolCount: mcpTools.length,
        toolNames: mcpTools.map(t => (t as ToolObject).function?.name).filter(Boolean),
        baseUrl: baseUrl
      });
    } else {
      console.log(`🚀 Ollama API call without tools (no MCP tools available)`);
    }

    // Use native Ollama API for vision models, OpenAI-compatible for others
    const useNativeAPI = hasImages;
    const apiUrl = useNativeAPI ? `${baseUrl}/api/chat` : `${baseUrl}/v1/chat/completions`;
    console.log(`🔗 Ollama request URL: ${apiUrl} (${useNativeAPI ? 'native' : 'OpenAI-compatible'} API)`);

    // Adjust request body format for native API
    let finalRequestBody = requestBody;
    if (useNativeAPI) {
      finalRequestBody = {
        model: settings.model,
        messages: messages,
        stream: !!onStream,
        options: {
          temperature: settings.temperature,
          num_predict: settings.maxTokens
        }
      };
      console.log(`🔗 Using Ollama native API format for vision model`);
    }

    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(finalRequestBody),
        signal
      });
    } catch (fetchError) {
      console.error(`❌ Ollama connection failed:`, fetchError);
      throw new Error(`Failed to connect to Ollama at ${baseUrl}. Make sure Ollama is running and accessible. Error: ${fetchError instanceof Error ? fetchError.message : String(fetchError)}`);
    }

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Ollama API error (${response.status}):`, error);



      // Check if model not found and provide helpful error
      if (response.status === 404 && error.includes('not found')) {
        const modelName = settings.model;
        throw new Error(`Ollama model "${modelName}" not found. Please pull the model first using: ollama pull ${modelName}`);
      }

      if (response.status === 404) {
        throw new Error(`Ollama API endpoint not found. Make sure you're using a compatible version of Ollama that supports the OpenAI-compatible API. URL: ${apiUrl}`);
      }
      if (response.status === 0 || error.includes('ECONNREFUSED')) {
        throw new Error(`Ollama is not running. Please start Ollama and try again. Visit https://ollama.ai for installation instructions.`);
      }
      throw new Error(`Ollama API error (${response.status}): ${error}`);
    }

    if (onStream) {
      const streamResult = await this.handleOllamaChatStreamResponse(response, onStream);

      // Check if there are tool calls that need follow-up processing
      if (streamResult.toolCalls && streamResult.toolCalls.length > 0) {
        console.log(`🔄 Ollama streaming: Processing ${streamResult.toolCalls.length} tool calls for follow-up`);

        // Build conversation history with tool calls and results
        // Ollama: Use only tool_calls without content to avoid conflicts
        const toolConversationHistory = [
          ...messages,
          { role: 'assistant', tool_calls: streamResult.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments)
            }
          })) }
        ];

        // Execute tool calls and add results to conversation
        for (const toolCall of streamResult.toolCalls) {
          try {
            console.log(`🔧 Executing tool for follow-up:`, toolCall);
            const toolResult = await this.executeMCPTool(toolCall.name, toolCall.arguments);
            toolConversationHistory.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify(toolResult)
            } as { role: string; tool_call_id: string; content: string });
          } catch (error) {
            console.error(`❌ Tool execution failed in follow-up:`, error);
            toolConversationHistory.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
            } as { role: string; tool_call_id: string; content: string });
          }
        }

        // Make follow-up call to get LLM's processed response
        console.log(`🔄 Making follow-up Ollama call after streaming to process tool results...`);
        const followUpRequestBody = {
          model: settings.model,
          messages: toolConversationHistory,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          stream: false // Use non-streaming for follow-up
        };

        const followUpResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(followUpRequestBody),
          signal
        });

        if (!followUpResponse.ok) {
          const error = await followUpResponse.text();
          console.error(`❌ Ollama follow-up call failed:`, error);
          // Return original response if follow-up fails
          return streamResult;
        }

        const followUpData = await followUpResponse.json();
        console.log(`🔍 Ollama follow-up response:`, JSON.stringify(followUpData, null, 2));
        const followUpMessage = followUpData.choices[0]?.message;
        console.log(`🔍 Ollama follow-up message:`, followUpMessage);

        // Combine the original response with the follow-up
        const combinedUsage = {
          promptTokens: (streamResult.usage?.promptTokens || 0) + (followUpData.usage?.prompt_tokens || 0),
          completionTokens: (streamResult.usage?.completionTokens || 0) + (followUpData.usage?.completion_tokens || 0),
          totalTokens: (streamResult.usage?.totalTokens || 0) + (followUpData.usage?.total_tokens || 0)
        };

        return {
          content: (streamResult.content || '') + '\n\n' + (followUpMessage?.content || 'Tool execution completed.'),
          usage: combinedUsage,
          toolCalls: streamResult.toolCalls
        };
      }

      return streamResult;
    } else {
      const data = await response.json();

      // Handle both native Ollama and OpenAI-compatible response formats
      let responseMessage;
      if (data.message) {
        // Native Ollama format
        responseMessage = data.message;
      } else if (data.choices && data.choices[0]) {
        // OpenAI-compatible format
        responseMessage = data.choices[0].message;
      } else {
        throw new Error('Unexpected Ollama response format');
      }

      // Get standard tool calls from response
      const parsedToolCalls = responseMessage.tool_calls || [];



      // Handle tool calls using two-call pattern
      if (parsedToolCalls.length > 0) {
        console.log(`🔧 Ollama response contains ${parsedToolCalls.length} tool calls:`, parsedToolCalls);

        // Execute each tool call and collect results
        const toolResults = [];
        for (const toolCall of parsedToolCalls) {
          try {
            console.log(`🔧 Executing Ollama tool call:`, toolCall);
            const toolResult = await this.executeMCPTool(
              toolCall.function.name,
              toolCall.function.arguments
            );
            toolResults.push({
              role: 'tool',
              content: JSON.stringify(toolResult)
            });
          } catch (error) {
            console.error(`❌ Ollama tool call failed:`, error);
            toolResults.push({
              role: 'tool',
              content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
            });
          }
        }

        // Build conversation history with tool calls and results
        const toolConversationHistory = [
          ...messages,
          { role: 'assistant', tool_calls: parsedToolCalls },
          ...toolResults
        ];

        // Make second call to get LLM's processed response
        console.log(`🔄 Making second Ollama call to process tool results...`);
        const secondRequestBody = {
          model: settings.model,
          messages: toolConversationHistory,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          stream: false
        };

        const secondResponse = await fetch(`${baseUrl}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(secondRequestBody),
          signal
        });

        if (!secondResponse.ok) {
          const error = await secondResponse.text();
          throw new Error(`Ollama second API call error: ${error}`);
        }

        const secondData = await secondResponse.json();
        const secondMessage = secondData.choices[0]?.message;

        const combinedUsage = (data.usage || secondData.usage) ? {
          promptTokens: (data.usage?.prompt_tokens || 0) + (secondData.usage?.prompt_tokens || 0),
          completionTokens: (data.usage?.completion_tokens || 0) + (secondData.usage?.completion_tokens || 0),
          totalTokens: (data.usage?.total_tokens || 0) + (secondData.usage?.total_tokens || 0)
        } : this.createEstimatedUsage(
          messages.map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n'),
          (responseMessage?.content || '') + (secondMessage?.content || ''),
          'Ollama estimated (with tools)'
        );

        return {
          content: secondMessage?.content || 'Tool execution completed.',
          usage: combinedUsage,
          toolCalls: parsedToolCalls.map((tc: { id?: string; function: { name: string; arguments: ToolCallArguments } }) => ({
            id: tc.id || 'ollama-tool-call',
            name: tc.function.name,
            arguments: tc.function.arguments
          }))
        };
      }

      // Return normal response when no tool calls
      let finalUsage;
      if (data.usage) {
        // OpenAI-compatible format
        finalUsage = {
          promptTokens: data.usage.prompt_tokens || 0,
          completionTokens: data.usage.completion_tokens || 0,
          totalTokens: data.usage.total_tokens || 0
        };
      } else if (data.prompt_eval_count || data.eval_count) {
        // Native Ollama format
        finalUsage = {
          promptTokens: data.prompt_eval_count || 0,
          completionTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0)
        };
      } else {
        // Fallback to estimation
        finalUsage = this.createEstimatedUsage(
          messages.map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n'),
          responseMessage?.content || '',
          'Ollama estimated'
        );
      }

      return {
        content: responseMessage?.content || '',
        usage: finalUsage
      };
    }
  }

  private async sendOpenRouterMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const messages = [];

    // Get MCP tools for OpenRouter first
    const mcpTools = await this.getMCPToolsForProvider('openrouter', settings);

    // Build enhanced system prompt with tool instructions
    let systemPrompt = settings.systemPrompt || '';
    if (mcpTools.length > 0) {
      const toolInstructions = this.generateToolInstructions(mcpTools, 'openrouter');
      systemPrompt += toolInstructions;
    }

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Handle both string and array content formats for vision support
    messages.push({ role: 'user', content: message });

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };

    // Add tools if available
    if (mcpTools.length > 0) {
      // Check if the model likely supports tool calling
      const modelSupportsTools = this.checkModelToolSupport(settings.model);

      if (modelSupportsTools) {
        requestBody.tools = mcpTools;
        requestBody.tool_choice = 'auto';
        console.log(`🚀 OpenRouter API call with ${mcpTools.length} tools:`, {
          model: settings.model,
          toolCount: mcpTools.length,
          toolNames: mcpTools.map(t => (t as ToolObject).function?.name).filter(Boolean),
          baseUrl: provider.baseUrl || 'https://openrouter.ai/api/v1'
        });
        console.log(`🔧 OpenRouter tools sample:`, mcpTools.slice(0, 2));
      } else {
        console.log(`⚠️ Model ${settings.model} may not support tool calling, proceeding without tools`);
      }
    } else {
      console.log(`🚀 OpenRouter API call without tools (no MCP tools available)`);
    }

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
      const streamResult = await this.handleOpenRouterStreamResponse(response, onStream);

      // Check if there are tool calls that need follow-up processing
      if (streamResult.toolCalls && streamResult.toolCalls.length > 0) {
        console.log(`🔄 OpenRouter streaming: Processing ${streamResult.toolCalls.length} tool calls for follow-up`);

        // Build conversation history with tool calls and results
        const toolConversationHistory = [
          ...messages,
          { role: 'assistant', content: streamResult.content, tool_calls: streamResult.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments)
            }
          })) }
        ];

        // Execute tool calls and add results to conversation
        for (const toolCall of streamResult.toolCalls) {
          try {
            console.log(`🔧 Executing tool for OpenRouter follow-up:`, toolCall);
            console.log(`🔧 Tool arguments being passed:`, JSON.stringify(toolCall.arguments, null, 2));
            const toolResult = await this.executeMCPTool(toolCall.name, toolCall.arguments);
            toolConversationHistory.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: toolResult
            } as { role: string; tool_call_id: string; content: string });
          } catch (error) {
            console.error(`❌ Tool execution failed in OpenRouter follow-up:`, error);
            toolConversationHistory.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
            } as { role: string; tool_call_id: string; content: string });
          }
        }

        // Make follow-up call to get LLM's processed response
        console.log(`🔄 Making follow-up OpenRouter call after streaming to process tool results...`);
        const followUpRequestBody = {
          model: settings.model,
          messages: toolConversationHistory,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          stream: false // Use non-streaming for follow-up
        };

        const followUpResponse = await fetch(`${provider.baseUrl || 'https://openrouter.ai/api/v1'}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`,
            'HTTP-Referer': 'https://littlellm.app',
            'X-Title': 'LittleLLM'
          },
          body: JSON.stringify(followUpRequestBody),
          signal
        });

        if (!followUpResponse.ok) {
          const error = await followUpResponse.text();
          console.error(`❌ OpenRouter follow-up call failed:`, error);
          // Return original response if follow-up fails
          return streamResult;
        }

        const followUpData = await followUpResponse.json();
        const followUpMessage = followUpData.choices[0]?.message;

        // Combine the original response with the follow-up
        const combinedUsage = {
          promptTokens: (streamResult.usage?.promptTokens || 0) + (followUpData.usage?.prompt_tokens || 0),
          completionTokens: (streamResult.usage?.completionTokens || 0) + (followUpData.usage?.completion_tokens || 0),
          totalTokens: (streamResult.usage?.totalTokens || 0) + (followUpData.usage?.total_tokens || 0)
        };

        return {
          content: (streamResult.content || '') + '\n\n' + (followUpMessage?.content || 'Tool execution completed.'),
          usage: combinedUsage,
          toolCalls: streamResult.toolCalls
        };
      }

      return streamResult;
    } else {
      const data = await response.json();
      console.log(`🔍 OpenRouter raw response:`, JSON.stringify(data, null, 2));
      const choice = data.choices[0];
      const message = choice?.message;

      if (!message) {
        console.warn(`⚠️ OpenRouter response missing message:`, data);
        return {
          content: '',
          usage: data.usage ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0
          } : undefined
        };
      }

      console.log(`🔍 OpenRouter message:`, message);
      console.log(`🔍 OpenRouter tool_calls:`, message.tool_calls);

      // Check for tool calls in standard format first
      const detectedToolCalls = message.tool_calls || [];



      // Handle tool calls using two-call pattern (like Anthropic/Gemini)
      if (detectedToolCalls && detectedToolCalls.length > 0) {
        console.log(`🔧 OpenRouter response contains ${detectedToolCalls.length} tool calls:`, detectedToolCalls);

        // Execute each tool call and collect results
        const toolResults = [];
        for (const toolCall of detectedToolCalls) {
          try {
            console.log(`🔧 Executing OpenRouter tool call:`, toolCall);

            // Handle different tool call formats
            let toolName: string;
            let toolArgs: Record<string, unknown>;

            if (toolCall.function) {
              // Standard OpenAI format
              toolName = toolCall.function.name;
              toolArgs = typeof toolCall.function.arguments === 'string'
                ? JSON.parse(toolCall.function.arguments)
                : toolCall.function.arguments;
            } else if (toolCall.name) {
              // Alternative format
              toolName = toolCall.name;
              toolArgs = toolCall.arguments || {};
            } else {
              throw new Error('Unknown tool call format');
            }

            const toolResult = await this.executeMCPTool(toolName, toolArgs);
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolName,
              content: JSON.stringify(toolResult)
            } as { tool_call_id: string; name: string; content: string });
          } catch (error) {
            console.error(`❌ OpenRouter tool call failed:`, error);
            const errorToolName = toolCall.function?.name || toolCall.name || 'unknown_tool';
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: errorToolName,
              content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
            } as { tool_call_id: string; name: string; content: string });
          }
        }

        // Build conversation history with tool calls and results
        const toolConversationHistory = [
          ...conversationHistory,
          { role: 'user', content: typeof message === 'string' ? message : JSON.stringify(message) },
          { role: 'assistant', tool_calls: message.tool_calls },
          ...toolResults
        ];

        // Make second call to get LLM's processed response
        console.log(`🔄 Making second OpenRouter call to process tool results...`);
        const secondRequestBody = {
          model: settings.model,
          messages: toolConversationHistory,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          stream: false
        };

        const secondResponse = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`,
            'HTTP-Referer': 'https://littlellm.app',
            'X-Title': 'LittleLLM'
          },
          body: JSON.stringify(secondRequestBody),
          signal
        });

        if (!secondResponse.ok) {
          const error = await secondResponse.text();
          throw new Error(`OpenRouter second API call error: ${error}`);
        }

        const secondData = await secondResponse.json();
        const secondMessage = secondData.choices[0]?.message;

        return {
          content: secondMessage?.content || 'Tool execution completed.',
          usage: {
            promptTokens: (data.usage?.prompt_tokens || 0) + (secondData.usage?.prompt_tokens || 0),
            completionTokens: (data.usage?.completion_tokens || 0) + (secondData.usage?.completion_tokens || 0),
            totalTokens: (data.usage?.total_tokens || 0) + (secondData.usage?.total_tokens || 0)
          },
          toolCalls: message.tool_calls.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments)
          }))
        };
      }

      return {
        content: message.content,
        usage: data.usage
      };
    }
  }

  private async sendRequestyMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    // Requesty uses OpenAI-compatible API
    const messages = [];

    // Get MCP tools for Requesty first
    const mcpTools = await this.getMCPToolsForProvider('requesty', settings);

    // Build enhanced system prompt with tool instructions
    let systemPrompt = settings.systemPrompt || '';
    if (mcpTools.length > 0) {
      const toolInstructions = this.generateToolInstructions(mcpTools, 'requesty');
      systemPrompt += toolInstructions;
    }

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    // Add conversation history - ensure all content is strings
    for (const historyMessage of conversationHistory) {
      let content: string;
      if (typeof historyMessage.content === 'string') {
        content = historyMessage.content;
      } else if (Array.isArray(historyMessage.content)) {
        // Extract text from array format
        content = historyMessage.content.map((item: ContentItem | string) => {
          if (typeof item === 'string') return item;
          if (item.type === 'text') return item.text;
          return '[Non-text content]';
        }).join(' ');
      } else {
        content = String(historyMessage.content);
      }

      messages.push({
        role: historyMessage.role,
        content: content.trim()
      });
    }

    // Process current message - ensure it's a string
    let messageContent: string;
    if (typeof message === 'string') {
      messageContent = message.trim();
    } else if (Array.isArray(message)) {
      // Extract text from array format
      messageContent = message.map((item: ContentItem | string) => {
        if (typeof item === 'string') return item;
        if (item.type === 'text') return item.text;
        return '[Non-text content]';
      }).join(' ').trim();
    } else if (message && typeof message === 'object' && 'text' in message) {
      // Handle vision format with text and images
      messageContent = String(message.text).trim();
    } else {
      messageContent = String(message).trim();
    }

    // Validate final message content
    if (!messageContent) {
      throw new Error('Message content cannot be empty');
    }

    messages.push({ role: 'user', content: messageContent });

    // Adjust max_tokens based on model limits for Claude models
    let maxTokens = settings.maxTokens;
    if (settings.model.includes('claude-3-5-haiku')) {
      maxTokens = Math.min(maxTokens, 8192);
    } else if (settings.model.includes('claude')) {
      // Most Claude models have 4096 max output tokens
      maxTokens = Math.min(maxTokens, 4096);
    }

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages,
      temperature: settings.temperature,
      max_tokens: maxTokens,
      stream: !!onStream
    };

    // Add tools if available
    if (mcpTools.length > 0) {
      requestBody.tools = mcpTools;
      requestBody.tool_choice = 'auto';
      console.log(`🚀 Requesty API call with ${mcpTools.length} tools:`, {
        model: settings.model,
        toolCount: mcpTools.length,
        toolNames: mcpTools.map(t => (t as ToolObject).function?.name).filter(Boolean),
        baseUrl: provider.baseUrl
      });
    } else {
      console.log(`🚀 Requesty API call without tools (no MCP tools available)`);
    }

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
      throw new Error(`Requesty API error: ${error}`);
    }

    if (onStream) {
      const streamResult = await this.handleRequestyStreamResponse(response, onStream);

      // Check if there are tool calls that need follow-up processing
      if (streamResult.toolCalls && streamResult.toolCalls.length > 0) {
        console.log(`🔄 Requesty streaming: Processing ${streamResult.toolCalls.length} tool calls for follow-up`);

        // Build conversation history with tool calls and results
        const toolConversationHistory = [
          ...messages,
          { role: 'assistant', content: streamResult.content, tool_calls: streamResult.toolCalls.map(tc => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments)
            }
          })) }
        ];

        // Execute tool calls and add results to conversation
        for (const toolCall of streamResult.toolCalls) {
          try {
            console.log(`🔧 Executing tool for Requesty follow-up:`, toolCall);
            const toolResult = await this.executeMCPTool(toolCall.name, toolCall.arguments);
            toolConversationHistory.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: toolResult
            } as { role: string; tool_call_id: string; content: string });
          } catch (error) {
            console.error(`❌ Tool execution failed in Requesty follow-up:`, error);
            toolConversationHistory.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
            } as { role: string; tool_call_id: string; content: string });
          }
        }

        // Make follow-up call to get LLM's processed response
        console.log(`🔄 Making follow-up Requesty call after streaming to process tool results...`);
        const followUpRequestBody = {
          model: settings.model,
          messages: toolConversationHistory,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          stream: false // Use non-streaming for follow-up
        };

        const followUpResponse = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`,
            'HTTP-Referer': 'https://littlellm.app',
            'X-Title': 'LittleLLM'
          },
          body: JSON.stringify(followUpRequestBody),
          signal
        });

        if (!followUpResponse.ok) {
          const error = await followUpResponse.text();
          console.error(`❌ Requesty follow-up call failed:`, error);
          // Return original response if follow-up fails
          return streamResult;
        }

        const followUpData = await followUpResponse.json();
        const followUpMessage = followUpData.choices[0]?.message;

        // Combine the original response with the follow-up
        const combinedUsage = {
          promptTokens: (streamResult.usage?.promptTokens || 0) + (followUpData.usage?.prompt_tokens || 0),
          completionTokens: (streamResult.usage?.completionTokens || 0) + (followUpData.usage?.completion_tokens || 0),
          totalTokens: (streamResult.usage?.totalTokens || 0) + (followUpData.usage?.total_tokens || 0)
        };

        return {
          content: (streamResult.content || '') + '\n\n' + (followUpMessage?.content || 'Tool execution completed.'),
          usage: combinedUsage,
          toolCalls: streamResult.toolCalls
        };
      }

      return streamResult;
    } else {
      const data = await response.json();
      const choice = data.choices[0];
      const message = choice?.message;

      if (!message) {
        return {
          content: '',
          usage: data.usage
        };
      }

      // Handle tool calls using two-call pattern (like Anthropic/Gemini)
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`🔧 Requesty response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);

        // Execute each tool call and collect results
        const toolResults = [];
        for (const toolCall of message.tool_calls) {
          try {
            console.log(`🔧 Executing Requesty tool call:`, toolCall);
            const toolResult = await this.executeMCPTool(
              toolCall.function.name,
              JSON.parse(toolCall.function.arguments)
            );
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify(toolResult)
            } as { role: string; name: string; content: string });
          } catch (error) {
            console.error(`❌ Requesty tool call failed:`, error);
            toolResults.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
            } as { role: string; name: string; content: string });
          }
        }

        // Build conversation history with tool calls and results
        const toolConversationHistory = [
          ...conversationHistory,
          { role: 'user', content: typeof message === 'string' ? message : JSON.stringify(message) },
          { role: 'assistant', tool_calls: message.tool_calls },
          ...toolResults
        ];

        // Make second call to get LLM's processed response
        console.log(`🔄 Making second Requesty call to process tool results...`);
        const secondRequestBody = {
          model: settings.model,
          messages: toolConversationHistory,
          temperature: settings.temperature,
          max_tokens: maxTokens,
          stream: false
        };

        const secondResponse = await fetch(`${provider.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`,
            'HTTP-Referer': 'https://littlellm.app',
            'X-Title': 'LittleLLM'
          },
          body: JSON.stringify(secondRequestBody),
          signal
        });

        if (!secondResponse.ok) {
          const error = await secondResponse.text();
          throw new Error(`Requesty second API call error: ${error}`);
        }

        const secondData = await secondResponse.json();
        const secondMessage = secondData.choices[0]?.message;

        return {
          content: secondMessage?.content || 'Tool execution completed.',
          usage: {
            promptTokens: (data.usage?.prompt_tokens || 0) + (secondData.usage?.prompt_tokens || 0),
            completionTokens: (data.usage?.completion_tokens || 0) + (secondData.usage?.completion_tokens || 0),
            totalTokens: (data.usage?.total_tokens || 0) + (secondData.usage?.total_tokens || 0)
          },
          toolCalls: message.tool_calls.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
            id: tc.id,
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments)
          }))
        };
      }

      return {
        content: message.content || '',
        usage: data.usage
      };
    }
  }

  private async sendReplicateMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void
  ): Promise<LLMResponse> {
    // Build conversation context for Replicate
    let prompt = '';
    if (settings.systemPrompt) {
      prompt += `${settings.systemPrompt}\n\n`;
    }

    // Add conversation history
    for (const msg of conversationHistory) {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      if (msg.role === 'user') {
        prompt += `User: ${content}\n`;
      } else if (msg.role === 'assistant') {
        prompt += `Assistant: ${content}\n`;
      }
    }

    // Add current message (handle string, array, and object formats)
    let messageText: string;
    if (typeof message === 'string') {
      messageText = message;
    } else if (Array.isArray(message)) {
      messageText = message.map((item: ContentItem) => item.type === 'text' ? item.text : '[Image]').join(' ');
    } else {
      // Object with text and images
      messageText = message.text;
    }
    prompt += `User: ${messageText}\nAssistant:`;

    const response = await fetch(`${provider.baseUrl}/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${settings.apiKey}`
      },
      body: JSON.stringify({
        version: settings.model, // In Replicate, this would be a version hash
        input: {
          prompt,
          temperature: settings.temperature,
          max_new_tokens: settings.maxTokens
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Replicate API error: ${error}`);
    }

    const data = await response.json();
    
    // Replicate returns a prediction that we need to poll
    if (onStream) {
      return this.pollReplicatePrediction(data.id, settings.apiKey, onStream);
    } else {
      return this.pollReplicatePrediction(data.id, settings.apiKey);
    }
  }

  private async sendN8nMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    // For n8n, the baseUrl should be the webhook URL from settings
    const webhookUrl = settings.baseUrl;

    if (!webhookUrl) {
      throw new Error('n8n webhook URL is required. Please configure it in the provider settings.');
    }

    // Check if message contains images
    const hasImages = typeof message === 'object' && !Array.isArray(message) && 'images' in message && message.images && message.images.length > 0;

    // Prepare the message text
    let messageText = '';
    if (typeof message === 'string') {
      messageText = message;
    } else if (Array.isArray(message)) {
      messageText = JSON.stringify(message);
    } else if (message && typeof message === 'object' && 'text' in message) {
      messageText = (message as { text: string }).text;
    } else {
      messageText = JSON.stringify(message);
    }

    const payload = {
      message: messageText,
      conversationHistory: conversationHistory,
      settings: {
        model: settings.model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        systemPrompt: settings.systemPrompt
      },
      timestamp: new Date().toISOString()
    };

    try {
      let response: Response;

      if (hasImages) {
        // Send as multipart/form-data for images
        console.log('🖼️ n8n: Sending message with images using multipart/form-data');

        const formData = new FormData();

        // Add text data
        formData.append('message', messageText);
        formData.append('conversationHistory', JSON.stringify(conversationHistory));
        formData.append('settings', JSON.stringify(payload.settings));
        formData.append('timestamp', payload.timestamp);

        // Add images as binary data
        const messageWithImages = message as { text: string; images: string[] };
        for (let i = 0; i < messageWithImages.images.length; i++) {
          const imageDataUrl = messageWithImages.images[i];

          // Convert data URL to blob
          const response = await fetch(imageDataUrl);
          const blob = await response.blob();

          // Add to form data with a descriptive name
          formData.append(`image_${i}`, blob, `image_${i}.${blob.type.split('/')[1] || 'jpg'}`);
        }

        response = await fetch(webhookUrl, {
          method: 'POST',
          body: formData,
          signal
        });
      } else {
        // Send as JSON POST for text-only messages
        console.log('📝 n8n: Sending text-only message using JSON POST');

        response = await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(payload),
          signal
        });
      }

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`n8n webhook error: ${response.status} - ${error}`);
      }

      // Handle response - n8n webhooks might return empty responses
      const responseText = await response.text();
      let content = '';

      if (responseText.trim()) {
        console.log('🔍 n8n raw response:', responseText);

        // Use the ResponseParser to clean up structured responses
        content = ResponseParser.cleanResponse(responseText);

        console.log('🔍 n8n cleaned response:', content);

        // If the cleaned response is empty or just whitespace, fall back to raw
        if (!content.trim()) {
          content = responseText.trim();
        }
      } else {
        // Empty response - webhook processed successfully
        content = 'Message sent to n8n workflow successfully.';
      }

      // Apply additional cleaning for common formatting issues
      const finalContent = ResponseParser.cleanResponse(content);

      return {
        content: finalContent || content, // Fallback to original if cleaning fails
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`n8n workflow error: ${error.message}`);
      }
      throw new Error('n8n workflow error: Unknown error occurred');
    }
  }

  private async handleStreamResponse(
    response: Response,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    console.log(`🔍 Starting stream response handling...`);
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
          console.log(`🔍 Stream chunk ${chunkCount}:`, chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''));
        }
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              if (chunkCount <= 5) {
                console.log(`🔍 Parsed chunk ${chunkCount}:`, JSON.stringify(parsed, null, 2));
              }

              const choice = parsed.choices?.[0];
              const delta = choice?.delta;
              const content = delta?.content || '';

              if (content) {
                fullContent += content;
                onStream(content);
                console.log(`📝 Content chunk: "${content}"`);
              }

              // Check for tool calls and assemble them
              if (delta?.tool_calls) {
                console.log(`🔧 Tool calls detected:`, delta.tool_calls);

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
              console.error(`❌ Error parsing chunk:`, error, `Data: ${data.substring(0, 100)}...`);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Filter out empty tool calls and log final state
    const validToolCalls = toolCalls.filter(tc => tc && tc.function?.name);

    console.log('🔍 Stream response completed:', {
      contentLength: fullContent.length,
      hasUsage: !!usage,
      usage: usage,
      toolCallsCount: validToolCalls.length
    });

    if (validToolCalls.length > 0) {
      console.log(`🔧 Assembled ${validToolCalls.length} tool calls:`, validToolCalls.map(tc => ({
        name: tc.function?.name,
        arguments: tc.function?.arguments
      })));
    }

    return {
      content: fullContent,
      usage: usage ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      } : this.createEstimatedUsage('', fullContent, 'OpenAI estimated'),
      toolCalls: validToolCalls
        .filter(tc => tc.id && tc.function?.name) // Only include tool calls with valid id and name
        .map(tc => ({
          id: tc.id!,
          name: tc.function!.name!,
          arguments: JSON.parse(tc.function!.arguments || '{}')
        }))
    };
  }

  private async handleOllamaStreamResponse(
    response: Response,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let fullContent = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined = undefined;
    const decoder = new TextDecoder();

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.response) {
              fullContent += parsed.response;
              onStream(parsed.response);
            }

            // Ollama provides token counts in the final response
            if (parsed.done && parsed.prompt_eval_count && parsed.eval_count) {
              usage = {
                prompt_tokens: parsed.prompt_eval_count,
                completion_tokens: parsed.eval_count,
                total_tokens: parsed.prompt_eval_count + parsed.eval_count
              };
            }
          } catch {
            // Ignore parsing errors
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return {
      content: fullContent,
      usage: usage ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      } : undefined
    };
  }

  private async handleOpenRouterStreamResponse(
    response: Response,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let fullContent = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined = undefined;
    const decoder = new TextDecoder();
    const toolCallsMap = new Map<string, { id?: string; index?: number; type?: string; name?: string; function?: { name?: string; arguments?: string } }>(); // Use Map to accumulate tool calls by ID

    console.log('🔍 OpenRouter streaming response started');

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            // Handle SSE format (data: prefix)
            let jsonData = line;
            if (line.startsWith('data: ')) {
              jsonData = line.slice(6).trim();
              if (!jsonData || jsonData === '[DONE]') continue;
            }

            // Skip OpenRouter status messages that aren't JSON
            if (jsonData.includes('OPENROUTER PROCESSING') || jsonData.startsWith(':')) {
              console.log('🔍 Skipping OpenRouter status message:', jsonData);
              continue;
            }

            const parsed = JSON.parse(jsonData);
            console.log('🔍 OpenRouter streaming chunk:', parsed);

            // Handle OpenAI-compatible streaming format
            if (parsed.choices && parsed.choices[0]) {
              const choice = parsed.choices[0];
              const delta = choice.delta;

              // Handle content
              if (delta?.content) {
                fullContent += delta.content;
                onStream(delta.content);
              }

              // Handle tool calls - accumulate fragments by index/id
              if (delta?.tool_calls) {
                console.log(`🔧 OpenRouter delta tool_calls:`, delta.tool_calls);
                for (const toolCallDelta of delta.tool_calls) {
                  console.log(`🔧 Processing OpenRouter tool call delta:`, toolCallDelta);

                  const index = toolCallDelta.index || 0;
                  // Use index as the primary key to group fragments, not the ID
                  const toolCallKey = `tool_${index}`;

                  // Get or create the accumulated tool call
                  if (!toolCallsMap.has(toolCallKey)) {
                    toolCallsMap.set(toolCallKey, {
                      id: toolCallDelta.id || toolCallKey, // Use the first ID we see, or fallback
                      index: index,
                      type: toolCallDelta.type || 'function',
                      function: {
                        name: '',
                        arguments: ''
                      }
                    });
                  }

                  const accumulatedToolCall = toolCallsMap.get(toolCallKey);

                  if (accumulatedToolCall) {
                    // Update ID if we get a real ID (prefer real IDs over fallback)
                    if (toolCallDelta.id && accumulatedToolCall.id && !accumulatedToolCall.id.startsWith('tool_')) {
                      accumulatedToolCall.id = toolCallDelta.id;
                    }

                    // Accumulate function name
                    if (toolCallDelta.function?.name && accumulatedToolCall.function) {
                      accumulatedToolCall.function.name += toolCallDelta.function.name;
                    }

                    // Accumulate function arguments
                    if (toolCallDelta.function?.arguments && accumulatedToolCall.function) {
                      accumulatedToolCall.function.arguments += toolCallDelta.function.arguments;
                    }
                  }

                  console.log(`🔧 Accumulated tool call for ${toolCallKey}:`, accumulatedToolCall);
                }
              }

              // Handle finish reason and usage
              if (choice.finish_reason === 'stop' && parsed.usage) {
                usage = {
                  prompt_tokens: parsed.usage.prompt_tokens || 0,
                  completion_tokens: parsed.usage.completion_tokens || 0,
                  total_tokens: parsed.usage.total_tokens || 0
                };
              }
            }
          } catch (parseError) {
            console.warn('🔍 OpenRouter streaming parse error:', parseError, 'Line:', line);
            // Ignore parsing errors
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Convert accumulated tool calls to array
    const assembledToolCalls = Array.from(toolCallsMap.values());

    // Log the assembled tool calls for debugging
    console.log(`🔧 Assembled tool calls from streaming:`, assembledToolCalls.map(tc => ({
      id: tc.id,
      name: tc.function?.name,
      argumentsLength: tc.function?.arguments?.length || 0,
      argumentsPreview: tc.function?.arguments?.substring(0, 100) + '...',
      fullArguments: tc.function?.arguments
    })));

    // Log the full assembled tool calls for detailed debugging
    console.log(`🔧 Full assembled tool calls:`, assembledToolCalls);

    console.log('🔍 OpenRouter streaming completed:', {
      contentLength: fullContent.length,
      hasUsage: !!usage,
      usage: usage,
      toolCallsCount: assembledToolCalls.length
    });

    console.log(`🔍 OpenRouter streaming tool calls summary:`, {
      totalToolCalls: assembledToolCalls.length,
      toolCallsWithNames: assembledToolCalls.filter(tc => tc.function?.name || tc.name).length,
      toolCallsWithoutNames: assembledToolCalls.filter(tc => !tc.function?.name && !tc.name).length,
      toolNames: assembledToolCalls.map(tc => tc.function?.name || tc.name || 'undefined'),
      assembledToolCalls: assembledToolCalls
    });



    // Add token estimation fallback if no usage data
    const finalUsage = usage ? {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0
    } : this.createEstimatedUsage(
      // We don't have access to the original conversation here, so estimate based on content
      'Estimated conversation context',
      fullContent,
      'OpenRouter streaming estimated'
    );

    // Handle tool calls if present
    if (assembledToolCalls.length > 0) {
      console.log(`🔧 OpenRouter streaming: Processing ${assembledToolCalls.length} tool calls`);

      // Return with tool calls for further processing
      return {
        content: fullContent,
        usage: finalUsage,
        toolCalls: assembledToolCalls
          .map((tc: { id?: string; name?: string; arguments?: string; function?: { name?: string; arguments?: string } }) => {
            try {
              let parsedArgs = {};

              if (tc.function?.arguments) {
                if (typeof tc.function.arguments === 'string') {
                  try {
                    parsedArgs = JSON.parse(tc.function.arguments);
                  } catch (parseError) {
                    console.warn(`Failed to parse tool arguments as JSON:`, tc.function.arguments, parseError);
                    // Try to extract arguments from malformed JSON
                    parsedArgs = this.extractArgumentsFromMalformedJson(tc.function.arguments);
                  }
                } else {
                  parsedArgs = tc.function.arguments;
                }
              } else if (tc.arguments) {
                parsedArgs = tc.arguments;
              }

              const toolName = tc.function?.name || tc.name;

              // Skip tool calls without a valid name
              if (!toolName || toolName === 'undefined' || toolName === '') {
                console.warn(`Skipping tool call with invalid name:`, tc);
                return null;
              }

              return {
                id: tc.id || `openrouter-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
                name: toolName,
                arguments: parsedArgs
              };
            } catch (error) {
              console.error(`Error processing tool call:`, tc, error);
              return null;
            }
          })
          .filter((tc: unknown) => tc !== null) as Array<{id: string, name: string, arguments: ToolCallArguments}> // Remove null entries and cast type
      };
    }

    return {
      content: fullContent,
      usage: finalUsage
    };
  }

  private async handleRequestyStreamResponse(
    response: Response,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let fullContent = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined = undefined;
    const decoder = new TextDecoder();
    const toolCalls: Array<{ id?: string; function?: { name?: string; arguments?: string } }> = [];

    console.log('🔍 Requesty streaming response started');

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            // Handle SSE format (data: prefix)
            let jsonData = line;
            if (line.startsWith('data: ')) {
              jsonData = line.slice(6).trim();
              if (!jsonData || jsonData === '[DONE]') continue;
            }

            const parsed = JSON.parse(jsonData);
            console.log('🔍 Requesty streaming chunk:', parsed);

            // Handle OpenAI-compatible streaming format
            if (parsed.choices && parsed.choices[0]) {
              const choice = parsed.choices[0];
              const delta = choice.delta;

              // Handle content
              if (delta?.content) {
                fullContent += delta.content;
                onStream(delta.content);
              }

              // Handle tool calls
              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  if (toolCall.function) {
                    toolCalls.push(toolCall);
                    // Show tool usage in stream
                    const toolMessage = `\n\n🔧 Executing tools: ${toolCall.function.name}\n`;
                    fullContent += toolMessage;
                    onStream(toolMessage);
                  }
                }
              }

              // Handle finish reason and usage
              if (choice.finish_reason === 'stop' && parsed.usage) {
                usage = {
                  prompt_tokens: parsed.usage.prompt_tokens || 0,
                  completion_tokens: parsed.usage.completion_tokens || 0,
                  total_tokens: parsed.usage.total_tokens || 0
                };
              }
            }
          } catch (parseError) {
            console.warn('🔍 Requesty streaming parse error:', parseError, 'Line:', line);
            // Ignore parsing errors
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log('🔍 Requesty streaming completed:', {
      contentLength: fullContent.length,
      hasUsage: !!usage,
      usage: usage,
      toolCallsCount: toolCalls.length
    });

    // Add token estimation fallback if no usage data
    const finalUsage = usage ? {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0
    } : this.createEstimatedUsage(
      // We don't have access to the original conversation here, so estimate based on content
      'Estimated conversation context',
      fullContent,
      'Requesty streaming estimated'
    );

    // Handle tool calls if present
    if (toolCalls.length > 0) {
      console.log(`🔧 Requesty streaming: Processing ${toolCalls.length} tool calls`);

      // Return with tool calls for further processing
      return {
        content: fullContent,
        usage: finalUsage,
        toolCalls: toolCalls
          .filter(tc => tc.id && tc.function?.name)
          .map((tc: { id?: string; function?: { name?: string; arguments?: string } }) => ({
            id: tc.id!,
            name: tc.function!.name!,
            arguments: JSON.parse(tc.function!.arguments || '{}')
          }))
      };
    }

    return {
      content: fullContent,
      usage: finalUsage
    };
  }

  private async handleMistralStreamResponse(
    response: Response,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let fullContent = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined = undefined;
    const decoder = new TextDecoder();
    const toolCalls: Array<{ id?: string; function?: { name?: string; arguments?: string } }> = [];

    console.log('🔍 Mistral streaming response started');

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            // Handle SSE format (data: prefix)
            let jsonData = line;
            if (line.startsWith('data: ')) {
              jsonData = line.slice(6).trim();
              if (!jsonData || jsonData === '[DONE]') continue;
            }

            const parsed = JSON.parse(jsonData);
            console.log('🔍 Mistral streaming chunk:', parsed);

            // Handle OpenAI-compatible streaming format
            if (parsed.choices && parsed.choices[0]) {
              const choice = parsed.choices[0];
              const delta = choice.delta;

              // Handle content
              if (delta?.content) {
                fullContent += delta.content;
                onStream(delta.content);
              }

              // Handle tool calls
              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  if (toolCall.function) {
                    toolCalls.push(toolCall);
                    // Show tool usage in stream
                    const toolMessage = `\n\n🔧 Executing tools: ${toolCall.function.name}\n`;
                    fullContent += toolMessage;
                    onStream(toolMessage);
                  }
                }
              }

              // Handle finish reason and usage
              if (choice.finish_reason === 'stop' && parsed.usage) {
                usage = {
                  prompt_tokens: parsed.usage.prompt_tokens || 0,
                  completion_tokens: parsed.usage.completion_tokens || 0,
                  total_tokens: parsed.usage.total_tokens || 0
                };
              }
            }
          } catch (parseError) {
            console.warn('🔍 Mistral streaming parse error:', parseError, 'Line:', line);
            // Ignore parsing errors
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log('🔍 Mistral streaming completed:', {
      contentLength: fullContent.length,
      hasUsage: !!usage,
      usage: usage,
      toolCallsCount: toolCalls.length
    });

    // Add token estimation fallback if no usage data
    const finalUsage = usage ? {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0
    } : this.createEstimatedUsage(
      // We don't have access to the original conversation here, so estimate based on content
      'Estimated conversation context',
      fullContent,
      'Mistral streaming estimated'
    );

    // Handle tool calls if present
    if (toolCalls.length > 0) {
      console.log(`🔧 Mistral streaming: Processing ${toolCalls.length} tool calls`);

      // Return with tool calls for further processing
      return {
        content: fullContent,
        usage: finalUsage,
        toolCalls: toolCalls
          .filter(tc => tc.id && tc.function?.name)
          .map((tc: { id?: string; function?: { name?: string; arguments?: string } }) => ({
            id: tc.id!,
            name: tc.function!.name!,
            arguments: JSON.parse(tc.function!.arguments || '{}')
          }))
      };
    }

    return {
      content: fullContent,
      usage: finalUsage
    };
  }

  private async handleOllamaChatStreamResponse(
    response: Response,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let fullContent = '';
    let usage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined = undefined;
    const decoder = new TextDecoder();
    const toolCalls: Array<{ id?: string; function?: { name?: string; arguments?: string } }> = [];

    console.log('🔍 Ollama streaming response started');

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            // Handle SSE format (data: prefix)
            let jsonData = line;
            if (line.startsWith('data: ')) {
              jsonData = line.slice(6).trim();
              if (!jsonData || jsonData === '[DONE]') continue;
            }

            const parsed = JSON.parse(jsonData);
            console.log('🔍 Ollama streaming chunk:', parsed);

            // Handle native Ollama streaming format
            if (parsed.message) {
              const content = parsed.message.content;
              if (content) {
                fullContent += content;
                onStream(content);
              }

              // Check if this is the final chunk
              if (parsed.done) {
                console.log('🔍 Ollama native streaming completed');
                break;
              }
            }
            // Handle OpenAI-compatible streaming format
            else if (parsed.choices && parsed.choices[0]) {
              const choice = parsed.choices[0];
              const delta = choice.delta;

              // Handle content
              if (delta?.content) {
                fullContent += delta.content;
                onStream(delta.content);
              }

              // Handle tool calls
              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  if (toolCall.function) {
                    toolCalls.push(toolCall);
                    // Show tool usage in stream
                    const toolMessage = `\n\n🔧 Executing tools: ${toolCall.function.name}\n`;
                    fullContent += toolMessage;
                    onStream(toolMessage);
                  }
                }
              }

              // Handle finish reason and usage
              if (choice.finish_reason === 'stop' && parsed.usage) {
                usage = {
                  promptTokens: parsed.usage.prompt_tokens || 0,
                  completionTokens: parsed.usage.completion_tokens || 0,
                  totalTokens: parsed.usage.total_tokens || 0
                };
              }
            }

            // Fallback: Handle Ollama's native format if OpenAI format not available
            if (parsed.message?.content) {
              fullContent += parsed.message.content;
              onStream(parsed.message.content);
            }

            // Ollama native token counts
            if (parsed.done && parsed.prompt_eval_count && parsed.eval_count) {
              usage = {
                promptTokens: parsed.prompt_eval_count,
                completionTokens: parsed.eval_count,
                totalTokens: parsed.prompt_eval_count + parsed.eval_count
              };
            }
          } catch (parseError) {
            console.warn('🔍 Ollama streaming parse error:', parseError, 'Line:', line);
            // Ignore parsing errors
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log('🔍 Ollama streaming completed:', {
      contentLength: fullContent.length,
      hasUsage: !!usage,
      usage: usage,
      toolCallsCount: toolCalls.length
    });



    // Add token estimation fallback if no usage data
    const finalUsage = usage || this.createEstimatedUsage(
      // We don't have access to the original conversation here, so estimate based on content
      'Estimated conversation context',
      fullContent,
      'Ollama streaming estimated'
    );

    // Handle tool calls if present
    if (toolCalls.length > 0) {
      console.log(`🔧 Ollama streaming: Processing ${toolCalls.length} tool calls`);

      // Return tool calls for the main function to handle follow-up
      // Don't execute tools here to avoid duplication
      console.log(`🔄 Returning tool calls for main function to handle follow-up...`);
      return {
        content: fullContent,
        usage: finalUsage,
        toolCalls: toolCalls
          .filter(tc => tc.id && tc.function?.name)
          .map((tc: { id?: string; function?: { name?: string; arguments?: string } }) => ({
            id: tc.id!,
            name: tc.function!.name!,
            arguments: JSON.parse(tc.function!.arguments || '{}')
          })),

      };
    }

    return {
      content: fullContent,
      usage: finalUsage
    };
  }

  private async pollReplicatePrediction(
    predictionId: string,
    apiKey: string,
    onStream?: (chunk: string) => void
  ): Promise<LLMResponse> {
    // This is a simplified implementation
    // In a real app, you'd want to implement proper polling with exponential backoff
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max

    while (attempts < maxAttempts) {
      const response = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
        headers: {
          'Authorization': `Token ${apiKey}`
        }
      });

      const data = await response.json();

      if (data.status === 'succeeded') {
        const content = Array.isArray(data.output) ? data.output.join('') : data.output;
        if (onStream) {
          onStream(content);
        }
        return { content };
      } else if (data.status === 'failed') {
        throw new Error(`Replicate prediction failed: ${data.error}`);
      }

      // Wait 5 seconds before polling again
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }

    throw new Error('Replicate prediction timed out');
  }

  async testConnection(settings: LLMSettings): Promise<boolean> {
    try {
      await this.sendMessage('Hello', settings);
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  private async handleAnthropicStreamResponse(
    response: Response,
    onStream: (chunk: string) => void,
    settings?: LLMSettings,
    provider?: LLMProvider,
    conversationHistory?: Array<{role: string, content: string | Array<ContentItem>}>,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let fullContent = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined = undefined;
    const decoder = new TextDecoder();
    const toolCalls: Array<{ id?: string; name?: string; arguments?: unknown; result?: string; isError?: boolean }> = [];
    const toolInputBuffers: { [index: number]: string } = {};
    const currentToolBlocks: { [index: number]: Record<string, unknown> } = {};
    const assistantContent: Array<Record<string, unknown>> = [];

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            // Skip event type lines
            continue;
          }

          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (!data || data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);

              // Handle content_block_start for text
              if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'text') {
                assistantContent.push({ type: 'text', text: '' });
              }

              // Handle content_block_start for tool_use
              if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
                console.log(`🔧 Anthropic streaming tool use started:`, parsed.content_block);
                currentToolBlocks[parsed.index] = parsed.content_block;
                toolInputBuffers[parsed.index] = '';
                assistantContent.push({
                  type: 'tool_use',
                  id: parsed.content_block.id,
                  name: parsed.content_block.name,
                  input: {}
                });

                // Show tool usage in chat
                const toolMessage = `\n\n🔧 **Using tool: ${parsed.content_block.name}**\n`;
                fullContent += toolMessage;
                onStream(toolMessage);
              }

              // Handle content_block_delta events with text_delta
              if (parsed.type === 'content_block_delta' &&
                  parsed.delta?.type === 'text_delta' &&
                  parsed.delta?.text) {
                const content = parsed.delta.text;
                fullContent += content;
                onStream(content);

                // Update assistant content
                if (assistantContent[parsed.index] && assistantContent[parsed.index].type === 'text') {
                  assistantContent[parsed.index].text += content;
                }
              }

              // Handle content_block_delta events with input_json_delta (tool parameters)
              if (parsed.type === 'content_block_delta' &&
                  parsed.delta?.type === 'input_json_delta' &&
                  parsed.delta?.partial_json !== undefined) {
                const index = parsed.index;
                toolInputBuffers[index] += parsed.delta.partial_json;
                console.log(`🔧 Anthropic streaming tool input:`, { index, partial: parsed.delta.partial_json });
              }

              // Handle content_block_stop for tool_use
              if (parsed.type === 'content_block_stop' && currentToolBlocks[parsed.index]?.type === 'tool_use') {
                const index = parsed.index;
                const toolBlock = currentToolBlocks[index];
                const inputJson = toolInputBuffers[index];

                console.log(`🔧 Anthropic streaming tool use completed:`, { toolBlock, inputJson });

                try {
                  const toolInput = JSON.parse(inputJson);
                  console.log(`🔧 Executing streaming tool:`, toolBlock.name, toolInput);

                  // Show tool execution in chat
                  const executingMessage = `⚙️ Executing ${toolBlock.name}...\n`;
                  fullContent += executingMessage;
                  onStream(executingMessage);

                  // Execute the tool
                  const toolResult = await this.executeMCPTool(toolBlock.name as string, toolInput as Record<string, unknown>);

                  // Show tool completion in chat
                  const completedMessage = `✅ Tool ${toolBlock.name} completed\n`;
                  fullContent += completedMessage;
                  onStream(completedMessage);

                  // Update assistant content with final input
                  if (assistantContent[index] && assistantContent[index].type === 'tool_use') {
                    assistantContent[index].input = toolInput;
                  }

                  toolCalls.push({
                    id: toolBlock.id as string,
                    name: toolBlock.name as string,
                    arguments: toolInput,
                    result: toolResult
                  });
                } catch (error) {
                  console.error(`❌ Anthropic streaming tool call failed:`, error);

                  // Show tool error in chat
                  const errorMessage = `❌ Tool ${toolBlock.name} failed: ${error instanceof Error ? error.message : String(error)}\n`;
                  fullContent += errorMessage;
                  onStream(errorMessage);

                  toolCalls.push({
                    id: toolBlock.id as string,
                    name: toolBlock.name as string,
                    arguments: JSON.parse(inputJson),
                    result: `Error: ${error instanceof Error ? error.message : String(error)}`,
                    isError: true
                  });
                }

                // Clean up
                delete currentToolBlocks[index];
                delete toolInputBuffers[index];
              }

              // Handle message_delta events with usage data
              if (parsed.type === 'message_delta' && parsed.usage) {
                usage = {
                  prompt_tokens: parsed.usage.input_tokens,
                  completion_tokens: parsed.usage.output_tokens,
                  total_tokens: parsed.usage.input_tokens + parsed.usage.output_tokens
                };
              }
            } catch (e) {
              // Skip invalid JSON
              console.warn('Failed to parse streaming event:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // If we have tool calls, make a follow-up streaming call to get the final response
    if (toolCalls.length > 0 && settings && provider) {
      console.log(`🔄 Making follow-up Anthropic streaming call with ${toolCalls.length} tool results`);

      // Reconstruct the conversation with tool results
      const messages = conversationHistory ? [...conversationHistory] : [];

      // Add the assistant's message with tool calls
      messages.push({
        role: 'assistant',
        content: JSON.stringify(assistantContent)
      });

      // Add tool results as user message
      const toolResults = toolCalls.map(tc => ({
        type: 'tool_result',
        tool_use_id: tc.id,
        content: tc.result,
        is_error: tc.isError || false
      }));

      messages.push({
        role: 'user',
        content: JSON.stringify(toolResults)
      });

      // Make follow-up streaming call
      const followUpResponse = await fetch(`${provider.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': settings.apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: settings.model,
          max_tokens: settings.maxTokens,
          temperature: settings.temperature,
          system: settings.systemPrompt || undefined,
          messages: messages,
          stream: true
        }),
        signal
      });

      if (followUpResponse.ok) {
        console.log(`✅ Starting follow-up streaming response`);

        // Stream the follow-up response
        const followUpResult = await this.handleAnthropicStreamResponse(
          followUpResponse,
          (chunk: string) => {
            onStream(chunk);
          }
        );

        return {
          content: fullContent + followUpResult.content,
          usage: followUpResult.usage ? {
            promptTokens: (usage?.prompt_tokens || 0) + (followUpResult.usage?.promptTokens || 0),
            completionTokens: (usage?.completion_tokens || 0) + (followUpResult.usage?.completionTokens || 0),
            totalTokens: (usage?.total_tokens || 0) + (followUpResult.usage?.totalTokens || 0)
          } : usage ? {
            promptTokens: usage.prompt_tokens || 0,
            completionTokens: usage.completion_tokens || 0,
            totalTokens: usage.total_tokens || 0
          } : undefined,
          toolCalls: toolCalls
            .filter(tc => tc.id && tc.name)
            .map(tc => ({
              id: tc.id!,
              name: tc.name!,
              arguments: tc.arguments as ToolCallArguments
            }))
        };
      } else {
        console.error(`❌ Anthropic follow-up streaming call failed:`, await followUpResponse.text());
      }
    }

    return {
      content: fullContent,
      usage: usage ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      } : undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls
        .filter(tc => tc.id && tc.name)
        .map(tc => ({
          id: tc.id!,
          name: tc.name!,
          arguments: tc.arguments as ToolCallArguments
        })) : undefined
    };
  }

  private async handleGeminiStreamResponse(
    response: Response,
    onStream: (chunk: string) => void,
    settings?: LLMSettings,
    provider?: LLMProvider
  ): Promise<LLMResponse> {
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

                    // Show tool usage in chat
                    const toolMessage = `\n\n🔧 **Using tool: ${part.functionCall.name}**\n`;
                    fullContent += toolMessage;
                    onStream(toolMessage);

                    try {
                      // Show tool execution in chat
                      const executingMessage = `⚙️ Executing ${part.functionCall.name}...\n`;
                      fullContent += executingMessage;
                      onStream(executingMessage);

                      // Execute the tool
                      const toolResult = await this.executeMCPTool(
                        part.functionCall.name,
                        part.functionCall.args
                      );

                      // Show tool completion in chat
                      const completedMessage = `✅ Tool ${part.functionCall.name} completed\n\n`;
                      fullContent += completedMessage;
                      onStream(completedMessage);

                      toolCalls.push({
                        id: `gemini-${Date.now()}`,
                        name: part.functionCall.name,
                        arguments: part.functionCall.args,
                        result: toolResult
                      });

                      // Store tool call for follow-up
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
                        result: `Error: ${error instanceof Error ? error.message : String(error)}`,
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
    if (toolCalls.length > 0 && settings && provider) {
      console.log(`🔄 Making follow-up Gemini streaming call with ${toolCalls.length} tool results`);

      try {
        if (!settings.apiKey) {
          throw new Error('No Gemini API key available for follow-up');
        }

        // Prepare follow-up request with tool results in Gemini format
        const followupContents = [
          {
            role: "user",
            parts: [{ text: "Please analyze and summarize the search results to answer my original question." }]
          },
          {
            role: "model",
            parts: toolCalls.map(tc => ({
              functionCall: {
                name: tc.name,
                args: tc.arguments
              }
            }))
          },
          {
            role: "function",
            parts: toolCalls.map(tc => ({
              functionResponse: {
                name: tc.name,
                response: {
                  content: typeof tc.result === 'string' ? tc.result : JSON.stringify(tc.result)
                }
              }
            }))
          }
        ];

        const followupBody = {
          contents: followupContents,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 4096
          }
        };

        console.log('🔍 Gemini follow-up request:', JSON.stringify(followupBody, null, 2));

        const url = `${provider.baseUrl}/models/${settings.model}:streamGenerateContent?alt=sse`;
        const followupResponse = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': settings.apiKey
          },
          body: JSON.stringify(followupBody)
        });

        if (followupResponse.ok) {
          console.log(`✅ Starting Gemini follow-up streaming response`);

          // Stream the follow-up response
          const followupReader = followupResponse.body?.getReader();
          if (followupReader) {
            const followupDecoder = new TextDecoder();

            try {
              // eslint-disable-next-line no-constant-condition
              while (true) {
                const { done, value } = await followupReader.read();
                if (done) break;

                const chunk = followupDecoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                  if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (!data || data === '[DONE]') continue;

                    try {
                      const parsed = JSON.parse(data);
                      if (parsed.candidates && parsed.candidates[0]?.content?.parts) {
                        const parts = parsed.candidates[0].content.parts;

                        for (const part of parts) {
                          if (part.text) {
                            fullContent += part.text;
                            onStream(part.text);
                          }
                        }
                      }
                    } catch (e) {
                      console.warn('Failed to parse Gemini follow-up chunk:', e);
                    }
                  }
                }
              }
            } finally {
              followupReader.releaseLock();
            }
          }
        } else {
          console.error(`❌ Gemini follow-up call failed:`, await followupResponse.text());
          // Fall back to showing raw tool results
          const fallbackMessage = `\n\n📊 **Search Results:**\n${JSON.stringify(toolCalls[0]?.result, null, 2)}\n`;
          fullContent += fallbackMessage;
          onStream(fallbackMessage);
        }
      } catch (error) {
        console.error('❌ Gemini follow-up call error:', error);
        // Fall back to showing raw tool results
        const fallbackMessage = `\n\n📊 **Search Results:**\n${JSON.stringify(toolCalls[0]?.result, null, 2)}\n`;
        fullContent += fallbackMessage;
        onStream(fallbackMessage);
      }
    }

    return {
      content: fullContent,
      usage: usage ? {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      } : undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls
        .filter(tc => tc.id && tc.name)
        .map(tc => ({
          id: tc.id!,
          name: tc.name!,
          arguments: tc.arguments as ToolCallArguments
        })) : undefined
    };
  }

  private async handleLMStudioStreamResponse(
    response: Response,
    onStream: (chunk: string) => void,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    signal?: AbortSignal,
    originalMessage?: MessageContent
  ): Promise<LLMResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let fullContent = '';
    let usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | undefined = undefined;
    const decoder = new TextDecoder();
    const toolCalls: Array<{ id?: string; type?: string; function?: { name?: string; arguments?: string } }> = [];

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;

              // Handle regular text content
              if (delta?.content) {
                fullContent += delta.content;
                onStream(delta.content);
              }

              // Handle tool calls (LM Studio streaming format)
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  // Ensure we have enough tool call slots
                  while (toolCalls.length <= tc.index) {
                    toolCalls.push({
                      id: '',
                      type: 'function',
                      function: { name: '', arguments: '' }
                    });
                  }

                  // Accumulate tool call data
                  const toolCall = toolCalls[tc.index];
                  if (tc.id) toolCall.id += tc.id;
                  if (tc.function?.name && toolCall.function) toolCall.function.name += tc.function.name;
                  if (tc.function?.arguments && toolCall.function) toolCall.function.arguments += tc.function.arguments;
                }
              }

              // Capture usage data if available
              if (parsed.usage) {
                usage = parsed.usage;
              }
            } catch {
              // Ignore parsing errors for malformed chunks
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    console.log('🔍 LM Studio stream completed:', {
      contentLength: fullContent.length,
      hasUsage: !!usage,
      usage: usage,
      toolCallsCount: toolCalls.length
    });

    if (usage) {
      console.log('📊 LM Studio raw usage data:', usage);
    } else {
      console.log('⚠️ LM Studio: No usage data received, will estimate tokens');
    }

    // If we have tool calls, execute them and get final response
    if (toolCalls.length > 0) {
      console.log(`🔧 LMStudio streaming found ${toolCalls.length} tool calls:`, toolCalls);

      // Show tool usage in the stream (without markdown formatting)
      const toolNames = toolCalls.map(tc => tc.function?.name || 'unknown').join(', ');
      const toolMessage = `\n\n🔧 Executing tools: ${toolNames}\n`;
      fullContent += toolMessage;
      onStream(toolMessage);

      // Execute each tool call and collect results
      const toolResults = [];
      for (const toolCall of toolCalls) {
        try {
          console.log(`🔧 Executing LMStudio streaming tool call:`, toolCall);
          const toolResult = await this.executeMCPTool(
            toolCall.function?.name || 'unknown',
            JSON.parse(toolCall.function?.arguments || '{}')
          );
          console.log(`✅ LMStudio tool result for ${toolCall.function?.name || 'unknown'}:`, toolResult);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: JSON.stringify(toolResult)
          } as { tool_call_id: string; role: string; content: string });
        } catch (error) {
          console.error(`❌ LMStudio streaming tool call failed:`, error);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: JSON.stringify({ error: error instanceof Error ? error.message : String(error) })
          } as { tool_call_id: string; role: string; content: string });
        }
      }

      // Build conversation history with tool calls and results
      const userMessage = typeof originalMessage === 'string' ? originalMessage :
        (typeof originalMessage === 'object' && 'text' in originalMessage) ? originalMessage.text : JSON.stringify(originalMessage);

      const toolConversationHistory = [
        ...conversationHistory,
        { role: 'user', content: userMessage },
        { role: 'assistant', tool_calls: toolCalls },
        ...toolResults
      ];

      // Make second call to get LLM's processed response (streaming)
      console.log(`🔄 Making second LMStudio streaming call to process tool results...`);

      const baseUrl = settings.baseUrl || provider.baseUrl;
      const apiUrl = `${baseUrl}/chat/completions`;
      const secondRequestBody = {
        model: settings.model,
        messages: toolConversationHistory,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        stream: true // Keep streaming for final response
      };

      const secondResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey || 'not-needed'}`
        },
        body: JSON.stringify(secondRequestBody),
        signal
      });

      if (!secondResponse.ok) {
        const error = await secondResponse.text();
        throw new Error(`LMStudio second streaming call error: ${error}`);
      }

      // Stream the final response
      const finalResult = await this.handleStreamResponse(secondResponse, onStream);

      const finalResponse = {
        content: fullContent + finalResult.content,
        usage: (() => {
          // If we have usage data from both calls, combine them
          if (usage && finalResult.usage) {
            return {
              promptTokens: (usage.prompt_tokens || 0) + (finalResult.usage.promptTokens || 0),
              completionTokens: (usage.completion_tokens || 0) + (finalResult.usage.completionTokens || 0),
              totalTokens: (usage.total_tokens || 0) + (finalResult.usage.totalTokens || 0)
            };
          }
          // If we have usage from first call only, convert it
          if (usage) {
            return {
              promptTokens: usage.prompt_tokens || 0,
              completionTokens: usage.completion_tokens || 0,
              totalTokens: usage.total_tokens || 0
            };
          }
          // If we have usage from second call only, use it
          if (finalResult.usage) {
            return finalResult.usage;
          }
          // Fallback to estimation
          return this.createEstimatedUsage(
            conversationHistory.map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n'),
            fullContent + finalResult.content,
            'LM Studio estimated (with tools)'
          );
        })(),
        toolCalls: toolCalls
          .filter(tc => tc.id && tc.function?.name)
          .map((tc: { id?: string; function?: { name?: string; arguments?: string } }) => {
          const mappedTool = {
            id: tc.id!,
            name: tc.function!.name!,
            arguments: JSON.parse(tc.function!.arguments || '{}')
          };
          console.log('🔧 Mapped tool call:', mappedTool);
          return mappedTool;
        })
      };

      console.log('🎯 LM Studio streaming final response:', {
        contentLength: finalResponse.content.length,
        toolCallsCount: finalResponse.toolCalls.length,
        toolNames: finalResponse.toolCalls.map(tc => tc.name),
        usage: finalResponse.usage
      });

      return finalResponse;
    }

    const finalUsage = usage ? {
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0
    } : this.createEstimatedUsage(
      // Estimate prompt from conversation history
      conversationHistory.map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)).join('\n'),
      fullContent,
      'LM Studio estimated'
    );

    console.log('🎯 LM Studio streaming (no tools) final response:', {
      contentLength: fullContent.length,
      usage: finalUsage
    });

    return {
      content: fullContent,
      usage: finalUsage,
      toolCalls: undefined
    };
  }


}

export const llmService = new LLMService();
