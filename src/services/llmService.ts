// Extend Window interface for tool thinking trigger
declare global {
  interface Window {
    triggerToolThinking?: (toolName: string) => void;
  }
}

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
  memoryContext?: MemoryContext; // Memory context for provider-specific integration
}

import { mcpService } from './mcpService';
import { getMemoryMCPTools, executeMemoryTool, isMemoryTool } from './memoryMCPTools';
import { memoryContextService, MemoryContext } from './memoryContextService';
import { automaticMemoryService } from './automaticMemoryService';

// Type guards for tool types
interface MCPTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  serverId?: string;
}

interface MemoryTool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

type CombinedTool = MCPTool | MemoryTool;

function isMCPTool(tool: CombinedTool): tool is MCPTool {
  return 'name' in tool && !('function' in tool);
}

function isMemoryToolType(tool: CombinedTool): tool is MemoryTool {
  return 'function' in tool && 'type' in tool;
}

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

  /**
   * Enhance system prompt with relevant memory context
   */
  private async enhancePromptWithMemory(
    originalPrompt: string,
    userMessage: string,
    conversationHistory: Array<{role: string, content: string}> = [],
    conversationId?: string,
    projectId?: string
  ): Promise<string> {
    try {
      // Get memory context for the current conversation
      const memoryContext = await memoryContextService.getMemoryContext(
        userMessage,
        conversationId,
        projectId,
        conversationHistory
      );

      // If no relevant memories found, return original prompt
      if (memoryContext.relevantMemories.length === 0) {
        return originalPrompt;
      }

      // Build enhanced prompt with memory context
      const enhancedPrompt = memoryContextService.buildMemoryEnhancedPrompt(
        originalPrompt,
        memoryContext
      );

      console.log(`🧠 Enhanced prompt with ${memoryContext.relevantMemories.length} relevant memories`);
      return enhancedPrompt;
    } catch (error) {
      console.error('Error enhancing prompt with memory:', error);
      return originalPrompt;
    }
  }

  /**
   * Create memory from conversation if appropriate
   */
  private async createMemoryFromConversation(
    userMessage: string,
    aiResponse: string,
    conversationHistory: Array<{role: string, content: string}> = [],
    conversationId?: string,
    projectId?: string
  ): Promise<void> {
    try {
      // Analyze the conversation to determine if memory should be created
      const analysis = memoryContextService.analyzeMessage(userMessage, conversationHistory);

      if (analysis.shouldCreateMemory) {
        const success = await memoryContextService.createMemoryFromConversation(
          userMessage,
          aiResponse,
          analysis,
          conversationId,
          projectId
        );

        if (success) {
          console.log(`🧠 Auto-created memory from conversation (type: ${analysis.suggestedMemoryType})`);
        }
      }
    } catch (error) {
      console.error('Error creating memory from conversation:', error);
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

  private generateToolInstructions(tools: unknown[], provider?: string): string {
    if (tools.length === 0) return '';

    // Type guard for tool objects
    const isToolObject = (t: unknown): t is { function?: { name?: string; description?: string; parameters?: Record<string, unknown> } } => {
      return typeof t === 'object' && t !== null;
    };

    // Use simplified instructions for local models (LM Studio, Ollama)
    const isLocalModel = provider === 'lmstudio' || provider === 'ollama';

    if (isLocalModel) {
      return this.generateSimpleToolInstructions(tools, isToolObject);
    }

    // Keep the complex instructions for cloud models
    return this.generateComplexToolInstructions(tools, isToolObject);
  }



  /**
   * Parse JSON tool call blocks from model output
   * Uses proper brace counting to handle nested JSON objects
   */
  private parseJSONToolCalls(content: string): Array<{ id?: string; name: string; arguments: Record<string, unknown> }> {
    const toolCalls: Array<{ id?: string; name: string; arguments: Record<string, unknown> }> = [];
    const parsedToolCalls = new Set<string>(); // Track duplicates

    console.log(`🔍 Searching for tool calls in content:`, content.substring(0, 200) + '...');

    // Find all potential JSON objects by looking for opening braces
    let i = 0;
    while (i < content.length) {
      if (content[i] === '{') {
        // Found opening brace, try to extract complete JSON object
        const jsonResult = this.extractCompleteJSON(content, i);
        if (jsonResult) {
          const { jsonStr, endIndex } = jsonResult;

          // Check if this JSON contains "tool_call"
          if (jsonStr.includes('"tool_call"')) {
            try {
              console.log(`🔍 Found potential tool call JSON:`, jsonStr);
              const parsed = JSON.parse(jsonStr);

              if (parsed.tool_call && parsed.tool_call.name) {
                const toolCallKey = `${parsed.tool_call.name}-${JSON.stringify(parsed.tool_call.arguments)}`;

                if (!parsedToolCalls.has(toolCallKey)) {
                  parsedToolCalls.add(toolCallKey);
                  toolCalls.push({
                    id: `extracted-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                    name: parsed.tool_call.name,
                    arguments: parsed.tool_call.arguments || {}
                  });
                  console.log(`✅ Successfully parsed tool call:`, parsed.tool_call.name);
                }
              }
            } catch (error) {
              console.warn('Failed to parse extracted JSON:', jsonStr, error);
            }
          }

          i = endIndex + 1;
        } else {
          i++;
        }
      } else {
        i++;
      }
    }

    console.log(`🔍 Parsed ${toolCalls.length} JSON tool calls from content`);
    return toolCalls;
  }

  /**
   * Extract a complete JSON object starting from a given position
   * Uses proper brace counting to handle nested objects
   */
  private extractCompleteJSON(content: string, startIndex: number): { jsonStr: string; endIndex: number } | null {
    let braceCount = 0;
    let inString = false;
    let escaped = false;
    let i = startIndex;

    while (i < content.length) {
      const char = content[i];

      if (escaped) {
        escaped = false;
      } else if (char === '\\' && inString) {
        escaped = true;
      } else if (char === '"') {
        inString = !inString;
      } else if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0) {
            // Found complete JSON object
            const jsonStr = content.substring(startIndex, i + 1);
            return { jsonStr, endIndex: i };
          }
        }
      }

      i++;
    }

    return null; // No complete JSON object found
  }

  /**
   * Remove JSON tool call blocks from content
   * Uses proper JSON extraction to remove complete objects
   */
  private removeJSONToolCalls(content: string): string {
    console.log(`🔍 Removing tool calls from content:`, content.substring(0, 200) + '...');

    let cleaned = content;
    const jsonObjectsToRemove: Array<{ start: number; end: number }> = [];

    // Find all JSON objects that contain "tool_call"
    let i = 0;
    while (i < cleaned.length) {
      if (cleaned[i] === '{') {
        const jsonResult = this.extractCompleteJSON(cleaned, i);
        if (jsonResult) {
          const { jsonStr, endIndex } = jsonResult;

          // Check if this JSON contains "tool_call"
          if (jsonStr.includes('"tool_call"')) {
            jsonObjectsToRemove.push({ start: i, end: endIndex + 1 });
            console.log(`🔍 Marking JSON for removal:`, jsonStr.substring(0, 100) + '...');
          }

          i = endIndex + 1;
        } else {
          i++;
        }
      } else {
        i++;
      }
    }

    // Remove JSON objects in reverse order to maintain indices
    for (let j = jsonObjectsToRemove.length - 1; j >= 0; j--) {
      const { start, end } = jsonObjectsToRemove[j];
      cleaned = cleaned.substring(0, start) + cleaned.substring(end);
    }

    // Clean up any remaining artifacts
    cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n'); // Multiple empty lines to double
    cleaned = cleaned.replace(/^\s+|\s+$/g, ''); // Trim start and end

    console.log(`🔍 Content after tool call removal:`, cleaned.substring(0, 200) + '...');

    return cleaned;
  }

  /**
   * Controlled Planning + Explicit Function-Only Output for local models
   * Forces linear reasoning and atomic tool calls with JSON-only output
   */
  private generateSimpleToolInstructions(tools: unknown[], isToolObject: (t: unknown) => t is { function?: { name?: string; description?: string; parameters?: Record<string, unknown> } }): string {
    const availableToolNames = tools
      .filter(isToolObject)
      .map(tool => tool.function?.name)
      .filter(Boolean);

    const instructions = `
[PLANNER MODE ACTIVE]

You are a reasoning assistant that can use tools (functions) to complete complex tasks.

You must always:
- First think step-by-step.
- Identify **each sub-task**.
- For each sub-task, if a tool is needed, call the tool using strict structured output in JSON.
- You may call **multiple tools in one response**, BUT each tool call must be a **separate JSON block**.

Never answer the user directly until tool results are received.

NEVER explain what you are doing before or after the tool call. Only respond with tool calls when needed.

### Available Tools:
${availableToolNames.length > 0 ? availableToolNames.join(', ') : 'No tools available'}

### When given a prompt like:
"Get the weather in Paris and today's news"

You MUST:

1. Think: "This requires two sub-tasks: (1) get weather, (2) get news"
2. Output BOTH tool calls in structured JSON, like this:

\`\`\`json
{
  "tool_call": {
    "name": "web_search",
    "arguments": {
      "query": "weather Paris current"
    }
  }
}

{
  "tool_call": {
    "name": "web_search",
    "arguments": {
      "query": "today news headlines"
    }
  }
}
\`\`\`

Only output tool call JSON blocks. DO NOT write normal text.

Once tools return results, THEN you may summarize and respond in natural language.

Be precise, ordered, and structured. Avoid combining tasks in one tool if they require separate calls.

**CRITICAL**: Only use tools from the available list above: ${availableToolNames.join(', ')}

`;

    return instructions;
  }

  /**
   * Complex tool instructions for cloud models (OpenAI, Anthropic, etc.)
   */
  private generateComplexToolInstructions(tools: unknown[], isToolObject: (t: unknown) => t is { function?: { name?: string; description?: string; parameters?: Record<string, unknown> } }): string {
    // Dynamic tool categorization based on actual tool names and descriptions
    const categorizeTools = (tools: unknown[]) => {
      const categories: Record<string, unknown[]> = {};

      tools.forEach(tool => {
        if (!isToolObject(tool) || !tool.function?.name) return;

        const name = tool.function.name.toLowerCase();
        const desc = (tool.function.description || '').toLowerCase();

        // Dynamic categorization based on keywords in names and descriptions
        let category = 'general';

        if (name.includes('search') || desc.includes('search') ||
            name.includes('web') || desc.includes('web') ||
            name.includes('internet') || desc.includes('internet')) {
          category = 'search';
        } else if (name.includes('memory') || desc.includes('memory') ||
                   name.includes('remember') || desc.includes('remember')) {
          category = 'memory';
        } else if (name.includes('file') || desc.includes('file') ||
                   name.includes('document') || desc.includes('document') ||
                   name.includes('read') || name.includes('write')) {
          category = 'files';
        } else if (name.includes('data') || desc.includes('data') ||
                   name.includes('database') || desc.includes('database') ||
                   name.includes('sql') || desc.includes('query')) {
          category = 'data';
        } else if (name.includes('api') || desc.includes('api') ||
                   name.includes('http') || desc.includes('http') ||
                   name.includes('request') || desc.includes('request')) {
          category = 'api';
        } else if (name.includes('code') || desc.includes('code') ||
                   name.includes('git') || desc.includes('git') ||
                   name.includes('repo') || desc.includes('repository')) {
          category = 'development';
        } else if (name.includes('time') || desc.includes('time') ||
                   name.includes('date') || desc.includes('date') ||
                   name.includes('calendar') || desc.includes('calendar')) {
          category = 'time';
        } else if (name.includes('image') || desc.includes('image') ||
                   name.includes('photo') || desc.includes('photo') ||
                   name.includes('visual') || desc.includes('visual')) {
          category = 'media';
        }

        if (!categories[category]) categories[category] = [];
        categories[category].push(tool);
      });

      return categories;
    };

    const toolCategories = categorizeTools(tools);

    let instructions = `
[PLANNER MODE ACTIVE]

You are a reasoning assistant that can use tools (functions) to complete complex tasks.

You must always:
- First think step-by-step.
- Identify **each sub-task**.
- For each sub-task, if a tool is needed, call the tool using strict structured output.
- You may call **multiple tools in one response**, BUT each tool call must be **separate and atomic**.

Never answer the user directly until tool results are received.

NEVER explain what you are doing before or after the tool call. Only respond with tool calls when needed.

## Strategic Tool Usage

**Use tools for**:
- Current information (weather, news, stock prices, etc.)
- File operations or system commands
- Complex calculations or data analysis
- Information beyond your training cutoff
- Real-time data that changes frequently

**Use conversation for**:
- General knowledge questions
- Casual conversation
- Explaining concepts or providing advice
- Historical information or established facts

## Multi-Tool Execution Rules

When given a complex request:

1. **Think**: Break down into sub-tasks
2. **Identify**: Which tools are needed for each sub-task
3. **Execute**: Call each tool separately and atomically
4. **Wait**: For all tool results before responding
5. **Summarize**: Provide final natural language response

Be precise, ordered, and structured. Avoid combining tasks in one tool if they require separate calls.

**CRITICAL**: Only use tools from the available list below. Do not invent tool names.

## Available Tools

You have access to ${tools.length} specialized tools:


`;

    // Add tool categories and descriptions
    const categoryIcons: Record<string, string> = {
      search: '🔍',
      memory: '🧠',
      files: '📁',
      data: '💾',
      api: '🌐',
      development: '💻',
      time: '⏰',
      media: '🎨',
      general: '⚡'
    };

    Object.entries(toolCategories).forEach(([category, categoryTools]) => {
      if (categoryTools.length === 0) return;

      const icon = categoryIcons[category] || '🔧';
      instructions += `\n### ${icon} ${category.toUpperCase()} (${categoryTools.length} tools)\n`;

      categoryTools.forEach(tool => {
        if (isToolObject(tool) && tool.function?.name) {
          instructions += `- **${tool.function.name}**: ${tool.function.description || 'No description'}\n`;
        }
      });
    });

    instructions += `

## Tool Usage Format

Use XML-style tags for tool calls:
\`\`\`xml
<tool_name>
<parameter>value</parameter>
</tool_name>
\`\`\`

## Multi-Tool Execution

You can call multiple tools simultaneously or in sequence to complete complex requests:

**Parallel Execution** (multiple tools at once):
- When user asks for multiple independent pieces of information
- Example: "Get weather and news" → call web_search twice with different queries
- Example: "Search for X and remember Y" → call search tool and memory_store

**Sequential Execution** (one after another):
- When one tool's output is needed for the next tool
- Example: Search for information, then store the results in memory
- Example: Get current time, then search for time-sensitive information

**Multi-Tool Patterns**:
- Information gathering: Use multiple search tools for comprehensive results
- Research + Storage: Search for information, then save key findings to memory
- Context + Action: Get current context (time, location) then perform relevant searches

`;

    return instructions;
  }



  /**
   * Get tools directly from enabled servers - force connect all enabled servers first
   */
  private async getToolsFromEnabledServers(): Promise<MCPTool[]> {
    try {
      // Get servers directly from JSON file
      const servers = await mcpService.getServers();
      console.log(`🔍 All servers from JSON:`, servers.map(s => ({ id: s.id, name: s.name, enabled: s.enabled })));

      // Filter only enabled servers
      const enabledServers = servers.filter(s => s.enabled);
      console.log(`✅ Found ${enabledServers.length} enabled servers:`, enabledServers.map(s => ({ id: s.id, name: s.name })));

      if (enabledServers.length === 0) {
        console.warn(`⚠️ No enabled servers found in JSON!`);
        return [];
      }

      // Force connect ALL enabled servers
      console.log(`🔌 Force connecting all enabled servers...`);
      await mcpService.connectEnabledServers();

      // Wait longer for connections to establish (some servers may take time to start)
      console.log(`⏳ Waiting 3 seconds for connections to establish...`);
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Now get all available tools
      const allTools = await mcpService.getAvailableTools();
      console.log(`📋 After force connection, got ${allTools.length} total tools`);

      // Log which servers are actually connected now
      const connectedIds = await mcpService.getConnectedServerIds();
      console.log(`🔗 Connected server IDs after force connect:`, connectedIds);

      // Check if all enabled servers are now connected
      const stillDisconnected = enabledServers.filter(s => !connectedIds.includes(s.id));
      if (stillDisconnected.length > 0) {
        console.error(`❌ STILL DISCONNECTED after force connect:`, stillDisconnected.map(s => ({ id: s.id, name: s.name })));

        // Try one more time with individual server connections
        console.log(`🔄 Attempting individual reconnection for failed servers...`);
        for (const server of stillDisconnected) {
          console.log(`🔌 Retrying connection to ${server.id} (${server.name})...`);
          try {
            await mcpService.connectServer(server.id);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between retries
          } catch (error) {
            console.error(`❌ Retry failed for ${server.id}:`, error);
          }
        }

        // Final check after retries
        const finalConnectedIds = await mcpService.getConnectedServerIds();
        const finalDisconnected = enabledServers.filter(s => !finalConnectedIds.includes(s.id));
        if (finalDisconnected.length > 0) {
          console.error(`❌ FINAL FAILURE: ${finalDisconnected.length} servers still disconnected after retries:`,
            finalDisconnected.map(s => ({ id: s.id, name: s.name })));
        } else {
          console.log(`✅ All servers connected after retries!`);
        }
      }

      return allTools;
    } catch (error) {
      console.error(`❌ Failed to get tools from enabled servers:`, error);
      return [];
    }
  }

  public async getMCPToolsForProvider(provider: string, settings?: LLMSettings): Promise<unknown[]> {
    try {
      console.log(`🔍 Getting MCP tools for provider: ${provider}`);
      console.log(`🔍 MCP Service available:`, !!mcpService);
      console.log(`🔍 Tool calling enabled:`, settings?.toolCallingEnabled !== false);

      // Check if tool calling is disabled
      if (settings?.toolCallingEnabled === false) {
        console.log(`🚫 Tool calling is disabled, returning empty tools array`);
        return [];
      }

      // Get tools directly from enabled servers in JSON - fuck the connection status
      console.log(`🔍 Reading MCP servers directly from JSON file...`);
      const mcpTools = await this.getToolsFromEnabledServers();
      console.log(`📋 Tools from enabled servers (${mcpTools.length} tools):`, mcpTools);

      // Add memory tools to the available tools
      const memoryTools = getMemoryMCPTools();
      console.log(`🧠 Memory tools available (${memoryTools.length} tools):`, memoryTools.map(t => t.function.name));

      // Combine MCP tools and memory tools
      const allTools: CombinedTool[] = [...mcpTools, ...memoryTools];
      console.log(`📋 Total tools available (${allTools.length} tools):`, allTools.map(t =>
        isMCPTool(t) ? t.name : t.function.name
      ));

      if (allTools.length > 0) {
        console.log(`📋 Tool details:`, allTools.map(t => {
          if (isMCPTool(t)) {
            return {
              name: t.name,
              description: t.description,
              serverId: t.serverId || 'mcp-server',
              hasInputSchema: !!t.inputSchema,
              inputSchemaType: t.inputSchema?.type,
              inputSchemaProps: t.inputSchema?.properties ? Object.keys(t.inputSchema.properties) : [],
              fullInputSchema: t.inputSchema
            };
          } else {
            return {
              name: t.function.name,
              description: t.function.description,
              serverId: 'memory-system',
              hasInputSchema: !!t.function.parameters,
              inputSchemaType: t.function.parameters?.type,
              inputSchemaProps: t.function.parameters?.properties ? Object.keys(t.function.parameters.properties) : [],
              fullInputSchema: t.function.parameters
            };
          }
        }));
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

          // Check for enabled but not connected servers
          const enabledServers = servers.filter(s => s.enabled);
          const disconnectedEnabledServers = enabledServers.filter(s => !connectedIds.includes(s.id));

          if (disconnectedEnabledServers.length > 0) {
            console.error(`❌ CRITICAL: ${disconnectedEnabledServers.length} enabled servers are NOT connected:`,
              disconnectedEnabledServers.map(s => ({ id: s.id, name: s.name })));
            console.error(`❌ This explains why tools are missing! Attempting to reconnect...`);

            // Try to reconnect enabled servers
            await mcpService.connectEnabledServers();

            // Check again after reconnection attempt
            const newConnectedIds = await mcpService.getConnectedServerIds();
            console.log(`🔄 After reconnection attempt, connected servers:`, newConnectedIds);
          }
        } catch (error) {
          console.error(`❌ Failed to get MCP server status:`, error);
        }
      }

      if (!allTools || allTools.length === 0) {
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

              const mcpTools = await mcpService.getAvailableTools();
              const memoryTools = getMemoryMCPTools();
              const allTools = [...mcpTools, ...memoryTools];
              console.log('🛠️ Available Tools:', allTools);

              return { detailedStatus, servers, tools: allTools };
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
        formattedTools = allTools.map(tool => {
          if (isMemoryToolType(tool)) {
            // Memory tool format (already in OpenAI format)
            return tool;
          } else {
            // MCP tool format (needs conversion)
            return {
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
            };
          }
        });
        console.log(`🔧 Formatted ${formattedTools.length} tools for OpenAI-compatible provider (${provider}):`, formattedTools);
      } else if (provider === 'gemini') {
        // Gemini format - single array of function declarations with cleaned schemas
        formattedTools = [{
          functionDeclarations: allTools.map(tool => ({
            name: isMCPTool(tool) ? tool.name : tool.function.name,
            description: isMCPTool(tool) ? tool.description : tool.function.description,
            parameters: this.cleanSchemaForGemini(isMCPTool(tool) ? tool.inputSchema : tool.function.parameters)
          }))
        }];
        console.log(`🔧 Formatted ${formattedTools.length} tools for Gemini:`, formattedTools);
        console.log(`🔧 Gemini tool schemas sample:`, (formattedTools[0] as { functionDeclarations?: unknown[] })?.functionDeclarations?.slice(0, 2));
      } else if (provider === 'anthropic') {
        // Anthropic format with name length validation (max 64 characters)
        formattedTools = allTools.map(tool => {
          const originalName = isMCPTool(tool) ? tool.name : tool.function.name;
          const truncatedName = originalName.length > 64
            ? this.truncateToolNameForAnthropic(originalName)
            : originalName;

          if (originalName !== truncatedName) {
            console.warn(`⚠️ Truncated tool name for Anthropic: "${originalName}" -> "${truncatedName}"`);
          }

          return {
            name: truncatedName,
            description: isMCPTool(tool) ? tool.description : tool.function.description,
            input_schema: isMCPTool(tool) ? tool.inputSchema : tool.function.parameters || {
              type: 'object',
              properties: {},
              required: []
            }
          };
        });
        console.log(`🔧 Formatted ${formattedTools.length} tools for Anthropic:`, formattedTools);
      } else {
        console.log(`⚠️ No tool formatting implemented for provider: ${provider}`);
      }

      if (formattedTools.length === 0 && allTools.length > 0) {
        console.error(`❌ Tool formatting failed! Raw tools exist but formatted tools is empty.`);
        console.log(`🔍 Raw tools that failed formatting:`, allTools);
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

      console.log(`🔧 Executing tool: ${toolName} with args:`, parsedArgs);

      // Check if this is a memory tool
      if (isMemoryTool(toolName)) {
        console.log(`🧠 Executing memory tool: ${toolName}`);
        const result = await executeMemoryTool(toolName, parsedArgs);
        console.log(`✅ Memory tool ${toolName} executed successfully:`, result);
        return JSON.stringify(result);
      } else {
        // Execute as MCP tool
        console.log(`🔧 Executing MCP tool: ${toolName}`);

        // Trigger thinking indicator for tool execution
        if (typeof window !== 'undefined' && window.triggerToolThinking) {
          window.triggerToolThinking(toolName);
        }

        const result = await mcpService.callTool(toolName, parsedArgs);
        console.log(`✅ MCP tool ${toolName} executed successfully:`, result);
        return JSON.stringify(result);
      }
    } catch (error) {
      console.error(`❌ Failed to execute tool ${toolName}:`, error);
      return `Error executing tool ${toolName}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Detect if a request is incomplete based on user message and executed tools
   */
  private detectIncompleteRequest(
    userMessage: string | unknown,
    executedResults: Array<{ name: string; success: boolean }>
  ): { incomplete: boolean; missing: string[] } {
    if (!userMessage || typeof userMessage !== 'string') {
      return { incomplete: false, missing: [] };
    }

    const message = userMessage.toLowerCase();

    // Enhanced multi-tool usage analysis
    const multiPartIndicators = [
      ' and ', ', ', ' also ', ' plus ', ' as well as ', ' tell me ', ' find ', ' get ', ' show me ', ' give me '
    ];
    const hasMultipleRequests = multiPartIndicators.some(indicator => message.includes(indicator));

    // Count potential information requests
    const informationKeywords = ['find', 'get', 'show', 'tell', 'what', 'how', 'when', 'where'];
    const keywordCount = informationKeywords.filter(keyword => message.includes(keyword)).length;

    // If user is asking for multiple things but only used one tool (or none), suggest more tools
    if (hasMultipleRequests && executedResults.length <= 1) {
      return {
        incomplete: true,
        missing: ['Use multiple tools to address all parts of your request - each piece of information may need a separate tool']
      };
    }

    // If multiple information keywords but few tools used
    if (keywordCount >= 2 && executedResults.length < keywordCount) {
      return {
        incomplete: true,
        missing: ['Consider using additional tools to gather all the requested information comprehensively']
      };
    }

    // If user is asking questions but no tools were used, suggest tool usage
    const questionWords = ['what', 'how', 'when', 'where', 'who', 'which', 'why'];
    const hasQuestions = questionWords.some(word => message.includes(word));

    if (hasQuestions && executedResults.length === 0) {
      return {
        incomplete: true,
        missing: ['Use available tools to provide accurate and current information instead of relying on training data']
      };
    }

    return { incomplete: false, missing: [] };
  }

  /**
   * Truncate tool names for Anthropic's 64-character limit while preserving meaning
   */
  private truncateToolNameForAnthropic(toolName: string): string {
    if (toolName.length <= 64) {
      return toolName;
    }

    // Strategy: Keep the most important parts and use abbreviations
    let truncated = toolName;

    // Dynamic abbreviations to reduce length
    const abbreviations: Record<string, string> = {
      'SEARCH': 'SRCH',
      'BROWSER': 'BRWS',
      'MEMORY': 'MEM',
      'DATETIME': 'DT',
      'ANALYSIS': 'ANLYS',
      'FUNCTION': 'FN',
      'REQUEST': 'REQ',
      'RESPONSE': 'RESP',
      'DATABASE': 'DB',
      'DOCUMENT': 'DOC'
    };

    // Apply abbreviations
    for (const [full, abbrev] of Object.entries(abbreviations)) {
      truncated = truncated.replace(new RegExp(full, 'gi'), abbrev);
    }

    // If still too long, truncate from the end but keep meaningful prefix
    if (truncated.length > 64) {
      truncated = truncated.substring(0, 61) + '...';
    }

    return truncated;
  }

  /**
   * Validate tool calls for provider-specific requirements
   */
  private validateToolCallsForProvider(
    toolCalls: Array<{ id?: string; name: string; arguments: Record<string, unknown> }>,
    provider: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const toolCall of toolCalls) {
      // Common validation
      if (!toolCall.name || typeof toolCall.name !== 'string') {
        errors.push(`Tool call missing or invalid name: ${JSON.stringify(toolCall)}`);
        continue;
      }

      // Provider-specific validation
      switch (provider.toLowerCase()) {
        case 'openai':
          if (!toolCall.id) {
            errors.push(`OpenAI tool call missing required id: ${toolCall.name}`);
          }
          break;

        case 'anthropic':
          // Anthropic uses tool_use blocks with specific format
          if (toolCall.arguments && typeof toolCall.arguments !== 'object') {
            errors.push(`Anthropic tool call arguments must be object: ${toolCall.name}`);
          }
          break;

        case 'ollama':
          // Ollama can use both native and OpenAI-compatible formats
          if (toolCall.arguments && typeof toolCall.arguments === 'string') {
            try {
              JSON.parse(toolCall.arguments);
            } catch {
              errors.push(`Ollama tool call has invalid JSON arguments: ${toolCall.name}`);
            }
          }
          break;

        case 'mistral':
          // Mistral follows OpenAI-compatible format
          if (!toolCall.id) {
            errors.push(`Mistral tool call missing required id: ${toolCall.name}`);
          }
          if (toolCall.arguments && typeof toolCall.arguments !== 'object') {
            errors.push(`Mistral tool call arguments must be object: ${toolCall.name}`);
          }
          break;

        case 'gemini':
        case 'google':
          // Google/Gemini has specific requirements
          if (toolCall.arguments && typeof toolCall.arguments !== 'object') {
            errors.push(`Google/Gemini tool call arguments must be object: ${toolCall.name}`);
          }
          break;

        case 'requesty':
          // Requesty provider validation
          if (!toolCall.id) {
            errors.push(`Requesty tool call missing required id: ${toolCall.name}`);
          }
          break;

        case 'n8n':
          // N8N provider validation
          if (toolCall.arguments && typeof toolCall.arguments !== 'object') {
            errors.push(`N8N tool call arguments must be object: ${toolCall.name}`);
          }
          break;

        default:
          // Generic validation for unknown providers
          if (toolCall.arguments && typeof toolCall.arguments === 'string') {
            try {
              JSON.parse(toolCall.arguments);
            } catch {
              errors.push(`Tool call has invalid JSON arguments: ${toolCall.name}`);
            }
          }
          break;
      }

      // Additional validation for tool name format
      if (toolCall.name.length > 64) {
        errors.push(`Tool name too long (max 64 chars): ${toolCall.name}`);
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(toolCall.name)) {
        errors.push(`Tool name contains invalid characters: ${toolCall.name}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate tool schema compatibility for specific providers
   */
  private validateToolSchemaForProvider(
    tool: {
      type?: string;
      name?: string;
      description?: string;
      function?: { name?: string; parameters?: Record<string, unknown> }
    },
    provider: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!tool || typeof tool !== 'object') {
      errors.push('Tool must be an object');
      return { valid: false, errors };
    }

    switch (provider.toLowerCase()) {
      case 'openai':
        if (!tool.type || tool.type !== 'function') {
          errors.push('OpenAI tools must have type: "function"');
        }
        if (!tool.function || !tool.function.name) {
          errors.push('OpenAI tools must have function.name');
        }
        if (tool.function?.name && tool.function.name.length > 64) {
          errors.push('OpenAI function names must be ≤64 characters');
        }
        break;

      case 'anthropic':
        if (!tool.name) {
          errors.push('Anthropic tools must have name property');
        }
        if (!tool.description) {
          errors.push('Anthropic tools must have description property');
        }
        break;

      case 'mistral':
        // Mistral uses OpenAI-compatible format
        if (!tool.type || tool.type !== 'function') {
          errors.push('Mistral tools must have type: "function"');
        }
        if (!tool.function || !tool.function.name) {
          errors.push('Mistral tools must have function.name');
        }
        break;

      case 'ollama':
        // Ollama supports both native and OpenAI-compatible formats
        if (tool.type === 'function') {
          if (!tool.function || !tool.function.name) {
            errors.push('Ollama OpenAI-format tools must have function.name');
          }
        } else if (!tool.name) {
          errors.push('Ollama native-format tools must have name property');
        }
        break;
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Execute multiple MCP tools in parallel with optimized performance and proper error handling
   */
  private async executeMultipleToolsParallel(
    toolCalls: Array<{
      id?: string;
      name: string;
      arguments: Record<string, unknown>;
    }>,
    provider: string = 'unknown'
  ): Promise<Array<{
    id?: string;
    name: string;
    result: string;
    success: boolean;
    executionTime: number;
  }>> {
    console.log(`🚀 Executing ${toolCalls.length} tools in parallel (optimized) for ${provider}:`, toolCalls.map(tc => tc.name));

    // Validate tool calls for provider-specific requirements
    const validation = this.validateToolCallsForProvider(toolCalls, provider);
    if (!validation.valid) {
      console.warn(`⚠️ Tool call validation failed for ${provider}:`, validation.errors);

      // For critical validation failures, return error results
      const criticalErrors = validation.errors.filter(error =>
        error.includes('missing required') || error.includes('invalid JSON')
      );

      if (criticalErrors.length > 0) {
        console.error(`🚨 Critical validation errors for ${provider}, aborting tool execution:`, criticalErrors);
        return toolCalls.map(tc => ({
          id: tc.id,
          name: tc.name,
          result: `Validation Error: ${criticalErrors.join(', ')}`,
          success: false,
          executionTime: 0
        }));
      }
    }

    const startTime = Date.now();

    try {
      // Try to use optimized concurrent execution via MCP service
      const optimizedToolCalls = toolCalls.map(tc => ({
        id: tc.id,
        name: tc.name,
        args: tc.arguments
      }));

      const mcpResults = await mcpService.callToolsOptimized(optimizedToolCalls);
      const totalTime = Date.now() - startTime;

      // Convert MCP results to expected format
      const processedResults = mcpResults.map(mcpResult => ({
        id: mcpResult.id,
        name: mcpResult.name,
        result: mcpResult.success ? JSON.stringify(mcpResult.result) : (mcpResult.error || 'Unknown error'),
        success: mcpResult.success,
        executionTime: mcpResult.executionTime
      }));

      const successCount = processedResults.filter(r => r.success).length;
      const failureCount = processedResults.length - successCount;

      console.log(`🏁 Optimized parallel execution completed in ${totalTime}ms: ${successCount} successful, ${failureCount} failed`);

      return processedResults;

    } catch (error) {
      console.warn(`⚠️ Optimized execution failed, falling back to legacy parallel execution:`, error);

      // Fallback to legacy parallel execution
      return await this.executeMultipleToolsLegacy(toolCalls);
    }
  }

  /**
   * Legacy parallel execution method (fallback)
   */
  private async executeMultipleToolsLegacy(toolCalls: Array<{
    id?: string;
    name: string;
    arguments: Record<string, unknown>;
  }>): Promise<Array<{
    id?: string;
    name: string;
    result: string;
    success: boolean;
    executionTime: number;
  }>> {
    console.log(`🔄 Using legacy parallel execution for ${toolCalls.length} tools`);

    const startTime = Date.now();

    // Execute all tools in parallel using Promise.allSettled for proper error handling
    const toolPromises = toolCalls.map(async (toolCall, index) => {
      const toolStartTime = Date.now();
      try {
        console.log(`🔧 [${index}] Starting legacy parallel execution of ${toolCall.name}`);

        // Trigger thinking indicator for tool execution
        if (typeof window !== 'undefined' && window.triggerToolThinking) {
          window.triggerToolThinking(toolCall.name);
        }

        const result = await this.executeMCPTool(toolCall.name, toolCall.arguments);
        const executionTime = Date.now() - toolStartTime;
        console.log(`✅ [${index}] Tool ${toolCall.name} completed in ${executionTime}ms`);

        return {
          id: toolCall.id,
          name: toolCall.name,
          result,
          success: true,
          executionTime
        };
      } catch (error) {
        const executionTime = Date.now() - toolStartTime;
        console.error(`❌ [${index}] Tool ${toolCall.name} failed after ${executionTime}ms:`, error);

        return {
          id: toolCall.id,
          name: toolCall.name,
          result: JSON.stringify({
            error: `Legacy parallel execution failed: ${error instanceof Error ? error.message : String(error)}`,
            toolName: toolCall.name,
            args: toolCall.arguments
          }),
          success: false,
          executionTime
        };
      }
    });

    // Wait for all tools to complete (successful or failed)
    const results = await Promise.allSettled(toolPromises);
    const totalTime = Date.now() - startTime;

    // Process results and extract values
    const processedResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        console.error(`❌ Promise rejected for tool ${toolCalls[index].name}:`, result.reason);
        return {
          id: toolCalls[index].id,
          name: toolCalls[index].name,
          result: JSON.stringify({
            error: `Promise execution failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
            toolName: toolCalls[index].name,
            args: toolCalls[index].arguments
          }),
          success: false,
          executionTime: 0
        };
      }
    });

    const successCount = processedResults.filter(r => r.success).length;
    const failureCount = processedResults.length - successCount;

    console.log(`🏁 Legacy parallel execution completed in ${totalTime}ms: ${successCount} successful, ${failureCount} failed`);

    return processedResults;
  }

  /**
   * Create user-friendly summary of tool execution results (for model context)
   */
  private summarizeToolResultsForModel(results: Array<{
    id?: string;
    name: string;
    result: string;
    success: boolean;
    executionTime: number;
  }>): string {
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    let summary = '';

    // Add collapsible tool execution details (similar to <think> blocks)
    summary += `<tool_execution>\n`;
    summary += `**Tool Execution Summary:** ${successfulResults.length}/${results.length} tools completed successfully.\n\n`;

    // Add formatted results for the model to work with
    successfulResults.forEach((result) => {
      summary += `**${result.name} Result:**\n`;

      try {
        const parsedResult = JSON.parse(result.result);
        const formattedResult = this.formatToolResult(result.name, parsedResult);
        summary += `${formattedResult}\n\n`;
      } catch {
        // If not JSON, add as plain text
        const cleanResult = result.result.replace(/^"|"$/g, '');
        summary += `${cleanResult}\n\n`;
      }
    });

    // Add failed results if any
    if (failedResults.length > 0) {
      summary += `**Failed Tools:**\n`;
      failedResults.forEach((result) => {
        summary += `- ${result.name}: ${result.result}\n`;
      });
    }

    summary += `</tool_execution>\n\n`;

    return summary;
  }

  /**
   * Enhanced aggregation and formatting of results from multiple tool executions (for debugging)
   */
  private aggregateToolResults(results: Array<{
    id?: string;
    name: string;
    result: string;
    success: boolean;
    executionTime: number;
  }>): string {
    const successfulResults = results.filter(r => r.success);
    const failedResults = results.filter(r => !r.success);

    let aggregatedContent = '';

    // Add execution summary with enhanced formatting
    aggregatedContent += `## 🛠️ Multi-Tool Execution Results\n`;
    aggregatedContent += `**Executed:** ${results.length} tools | **✅ Success:** ${successfulResults.length} | **❌ Failed:** ${failedResults.length}\n\n`;

    // Add successful results with intelligent formatting
    if (successfulResults.length > 0) {
      aggregatedContent += `### ✅ Successful Results\n\n`;
      successfulResults.forEach((result) => {
        aggregatedContent += `#### 🔧 **${result.name}** \`${result.executionTime}ms\`\n`;

        try {
          const parsedResult = JSON.parse(result.result);
          const formattedResult = this.formatToolResult(result.name, parsedResult);
          aggregatedContent += `${formattedResult}\n\n`;
        } catch {
          // If not JSON, add as plain text with basic formatting
          const cleanResult = result.result.replace(/^"|"$/g, ''); // Remove surrounding quotes
          aggregatedContent += `${cleanResult}\n\n`;
        }
      });
    }

    // Add failed results with error details
    if (failedResults.length > 0) {
      aggregatedContent += `### ❌ Failed Results\n\n`;
      failedResults.forEach((result) => {
        aggregatedContent += `#### 🚫 **${result.name}** \`${result.executionTime}ms\`\n`;
        try {
          const parsedError = JSON.parse(result.result);
          if (parsedError.error) {
            aggregatedContent += `**Error:** ${parsedError.error}\n\n`;
          } else {
            aggregatedContent += `**Error:** ${result.result}\n\n`;
          }
        } catch {
          aggregatedContent += `**Error:** ${result.result}\n\n`;
        }
      });
    }

    // Add performance insights
    const totalTime = Math.max(...results.map(r => r.executionTime));
    const avgTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;
    const successRate = Math.round((successfulResults.length / results.length) * 100);

    aggregatedContent += `### 📊 Execution Metrics\n`;
    aggregatedContent += `- **Parallel Execution Time:** ${totalTime}ms\n`;
    aggregatedContent += `- **Average Tool Time:** ${Math.round(avgTime)}ms\n`;
    aggregatedContent += `- **Success Rate:** ${successRate}%\n`;

    if (successRate < 100) {
      aggregatedContent += `- **Reliability:** ${failedResults.length} tool(s) failed - consider using alternative tools\n`;
    }

    return aggregatedContent;
  }

  /**
   * Format individual tool results based on tool type and content
   */
  private formatToolResult(toolName: string, result: unknown): string {
    const toolType = this.identifyToolType(toolName);

    switch (toolType) {
      case 'search':
        return this.formatSearchResult(result as { results?: Array<{ title?: string; content?: string; snippet?: string; url?: string }> });
      case 'memory':
        return this.formatMemoryResult(result as { success?: boolean; memories?: Array<{ title?: string; content?: string }>; id?: string });
      case 'file':
        return this.formatFileResult(result as { content?: string; [key: string]: unknown });
      case 'api':
        return this.formatApiResult(result as { status?: string; data?: unknown; [key: string]: unknown });
      case 'datetime':
        return this.formatDateTimeResult(result as string | { content?: Array<{ text?: string }>; [key: string]: unknown });
      case 'weather':
        return this.formatWeatherResult(result as string | { weather?: string; temperature?: string; condition?: string; [key: string]: unknown });
      default:
        return this.formatGenericResult(result);
    }
  }

  /**
   * Identify tool type based on tool name
   */
  private identifyToolType(toolName: string): string {
    const name = toolName.toLowerCase();

    if (name.includes('search') || name.includes('web')) {
      return 'search';
    } else if (name.includes('memory')) {
      return 'memory';
    } else if (name.includes('file') || name.includes('read') || name.includes('write')) {
      return 'file';
    } else if (name.includes('api') || name.includes('http') || name.includes('fetch')) {
      return 'api';
    } else if (name.includes('datetime') || name.includes('date') || name.includes('time')) {
      return 'datetime';
    } else if (name.includes('weather')) {
      return 'weather';
    }

    return 'generic';
  }

  /**
   * Format search tool results
   */
  private formatSearchResult(result: { results?: Array<{ title?: string; content?: string; snippet?: string; url?: string }> }): string {
    if (result.results && Array.isArray(result.results)) {
      let formatted = `**Found ${result.results.length} results:**\n\n`;
      result.results.slice(0, 5).forEach((item: { title?: string; content?: string; snippet?: string; url?: string }, index: number) => {
        formatted += `${index + 1}. **${item.title || 'No title'}**\n`;
        if (item.url) formatted += `   🔗 ${item.url}\n`;
        if (item.content || item.snippet) {
          const content = (item.content || item.snippet || '').substring(0, 200);
          formatted += `   ${content}${content.length >= 200 ? '...' : ''}\n\n`;
        }
      });
      if (result.results.length > 5) {
        formatted += `... and ${result.results.length - 5} more results\n`;
      }
      return formatted;
    }

    return this.formatGenericResult(result);
  }

  /**
   * Format memory tool results
   */
  private formatMemoryResult(result: { success?: boolean; memories?: Array<{ title?: string; content?: string }>; id?: string }): string {
    if (result.success && result.memories && Array.isArray(result.memories)) {
      let formatted = `**Retrieved ${result.memories.length} memory entries:**\n\n`;
      result.memories.forEach((memory: { title?: string; content?: string }, index: number) => {
        formatted += `${index + 1}. **${memory.title || 'Untitled'}**\n`;
        formatted += `   ${memory.content?.substring(0, 150)}${(memory.content?.length || 0) > 150 ? '...' : ''}\n\n`;
      });
      return formatted;
    } else if (result.success && result.id) {
      return `**Memory stored successfully** (ID: ${result.id})\n`;
    }

    return this.formatGenericResult(result);
  }

  /**
   * Format file tool results
   */
  private formatFileResult(result: { content?: string; [key: string]: unknown }): string {
    if (result.content) {
      const content = result.content.substring(0, 500);
      return `**File content:**\n\`\`\`\n${content}${content.length >= 500 ? '\n... (truncated)' : ''}\n\`\`\`\n`;
    }

    return this.formatGenericResult(result);
  }

  /**
   * Format API tool results
   */
  private formatApiResult(result: { status?: string; data?: unknown; [key: string]: unknown }): string {
    if (result.status && result.data) {
      return `**API Response (${result.status}):**\n\`\`\`json\n${JSON.stringify(result.data, null, 2)}\n\`\`\`\n`;
    }

    return this.formatGenericResult(result);
  }

  /**
   * Format datetime tool results
   */
  private formatDateTimeResult(result: string | { content?: Array<{ text?: string }>; [key: string]: unknown }): string {
    if (typeof result === 'string') {
      return `📅 **${result}**`;
    } else if (result.content && Array.isArray(result.content)) {
      // Handle MCP tool response format
      const content = result.content[0];
      if (content && content.text) {
        return `📅 **${content.text}**`;
      }
    } else if (result.date || result.time || result.datetime) {
      return `📅 **${result.date || result.time || result.datetime}**`;
    }

    return this.formatGenericResult(result);
  }

  /**
   * Format weather tool results
   */
  private formatWeatherResult(result: string | { weather?: string; temperature?: string; condition?: string; [key: string]: unknown }): string {
    if (typeof result === 'string') {
      return `🌤️ **Weather:** ${result}`;
    } else if (result.weather) {
      return `🌤️ **Weather:** ${result.weather}`;
    } else if (result.temperature && result.condition) {
      return `🌤️ **Weather:** ${result.temperature}, ${result.condition}`;
    }

    return this.formatGenericResult(result);
  }

  /**
   * Format generic tool results
   */
  private formatGenericResult(result: unknown): string {
    if (typeof result === 'string') {
      return result;
    } else if (typeof result === 'object' && result !== null) {
      const resultObj = result as Record<string, unknown>;

      // Handle MCP tool response format first
      if (resultObj.content && Array.isArray(resultObj.content)) {
        const content = resultObj.content[0] as { text?: string };
        if (content && content.text) {
          return content.text;
        }
      }

      // Try to extract meaningful content
      if (typeof resultObj.content === 'string') {
        return resultObj.content;
      } else if (typeof resultObj.message === 'string') {
        return resultObj.message;
      } else if (resultObj.data) {
        return `\`\`\`json\n${JSON.stringify(resultObj.data, null, 2)}\n\`\`\``;
      } else {
        return `\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``;
      }
    }

    return String(result);
  }

  /**
   * Execute tools with error recovery and fallback mechanisms
   */
  private async executeToolsWithRecovery(toolCalls: Array<{
    id?: string;
    name: string;
    arguments: Record<string, unknown>;
  }>, availableTools: unknown[] = []): Promise<Array<{
    id?: string;
    name: string;
    result: string;
    success: boolean;
    executionTime: number;
    retryCount?: number;
    fallbackUsed?: string;
  }>> {
    console.log(`🔄 Executing ${toolCalls.length} tools with recovery mechanisms`);

    // First attempt: parallel execution
    // eslint-disable-next-line prefer-const
    let results = await this.executeMultipleToolsParallel(toolCalls);

    // Identify failed tools for retry/fallback
    const failedTools = results.filter(r => !r.success);

    if (failedTools.length > 0) {
      console.log(`🔄 ${failedTools.length} tools failed, attempting recovery...`);

      // Attempt recovery for each failed tool
      for (const failedResult of failedTools) {
        const originalToolCall = toolCalls.find(tc => tc.id === failedResult.id || tc.name === failedResult.name);
        if (!originalToolCall) continue;

        // Try to find alternative tools
        const alternativeTools = this.findAlternativeTools(originalToolCall.name, availableTools);

        for (const altTool of alternativeTools) {
          console.log(`🔄 Retrying with alternative tool: ${altTool} for ${originalToolCall.name}`);

          try {
            const retryStartTime = Date.now();
            const retryResult = await this.executeMCPTool(altTool, originalToolCall.arguments);
            const retryTime = Date.now() - retryStartTime;

            // Update the failed result with successful retry
            const resultIndex = results.findIndex(r => r.id === failedResult.id || r.name === failedResult.name);
            if (resultIndex !== -1) {
              results[resultIndex] = {
                ...failedResult,
                result: retryResult,
                success: true,
                executionTime: retryTime,
                retryCount: 1,
                fallbackUsed: altTool
              } as {
                id?: string;
                name: string;
                result: string;
                success: boolean;
                executionTime: number;
                retryCount?: number;
                fallbackUsed?: string;
              };
              console.log(`✅ Recovery successful using ${altTool}`);
              break; // Success, no need to try more alternatives
            }
          } catch (error) {
            console.log(`❌ Alternative tool ${altTool} also failed:`, error);
            continue; // Try next alternative
          }
        }
      }
    }

    const finalSuccessCount = results.filter(r => r.success).length;
    const finalFailureCount = results.length - finalSuccessCount;

    console.log(`🏁 Tool execution with recovery completed: ${finalSuccessCount} successful, ${finalFailureCount} failed`);

    return results;
  }

  /**
   * Find alternative tools that can perform similar functions
   */
  private findAlternativeTools(failedToolName: string, availableTools: unknown[]): string[] {
    const alternatives: string[] = [];
    const failedToolLower = failedToolName.toLowerCase();

    // Type guard for tool objects
    const isToolObject = (t: unknown): t is { function?: { name?: string; description?: string } } => {
      return typeof t === 'object' && t !== null;
    };

    // Search for similar tools based on name patterns
    for (const tool of availableTools) {
      if (!isToolObject(tool) || !tool.function?.name) continue;

      const toolName = tool.function.name;
      const toolNameLower = toolName.toLowerCase();

      // Skip the same tool
      if (toolName === failedToolName) continue;

      // Find tools with similar functionality based on common words
      const failedWords = failedToolLower.split(/[-_\s]+/);
      const toolWords = toolNameLower.split(/[-_\s]+/);

      // Check if tools share common functionality words
      const hasCommonWords = failedWords.some(word =>
        word.length > 2 && toolWords.includes(word)
      );

      if (hasCommonWords) {
        alternatives.push(toolName);
      }
    }

    // Limit to top 3 alternatives to avoid excessive retries
    return alternatives.slice(0, 3);
  }

  /**
   * Advanced agentic workflow engine for multi-step tool execution
   */
  private async executeAgenticWorkflow(
    initialToolCalls: Array<{
      id?: string;
      name: string;
      arguments: Record<string, unknown>;
    }>,
    availableTools: unknown[],
    maxIterations: number = 3
  ): Promise<{
    results: Array<{
      id?: string;
      name: string;
      result: string;
      success: boolean;
      executionTime: number;
      iteration: number;
      chainedFrom?: string;
    }>;
    workflow: Array<{
      iteration: number;
      toolsExecuted: string[];
      chainedTools: string[];
      totalTime: number;
    }>;
    summary: string;
  }> {
    console.log(`🤖 Starting agentic workflow with ${initialToolCalls.length} initial tools, max ${maxIterations} iterations`);

    const allResults: Array<{
      id?: string;
      name: string;
      result: string;
      success: boolean;
      executionTime: number;
      iteration: number;
      chainedFrom?: string;
    }> = [];

    const workflowSteps: Array<{
      iteration: number;
      toolsExecuted: string[];
      chainedTools: string[];
      totalTime: number;
    }> = [];

    let currentToolCalls = initialToolCalls;
    let iteration = 0;

    while (iteration < maxIterations && currentToolCalls.length > 0) {
      iteration++;
      const iterationStartTime = Date.now();

      console.log(`🔄 Workflow iteration ${iteration}: executing ${currentToolCalls.length} tools`);

      // Execute current batch of tools with recovery
      const iterationResults = await this.executeToolsWithRecovery(currentToolCalls, availableTools);

      // Add iteration info to results
      const enhancedResults = iterationResults.map(result => ({
        ...result,
        iteration
      }));

      allResults.push(...enhancedResults);

      // Analyze results for potential chaining opportunities
      const chainedTools = this.analyzeForToolChaining(enhancedResults, availableTools);

      const iterationTime = Date.now() - iterationStartTime;
      workflowSteps.push({
        iteration,
        toolsExecuted: currentToolCalls.map(tc => tc.name),
        chainedTools: chainedTools.map(ct => ct.name),
        totalTime: iterationTime
      });

      // Prepare next iteration with chained tools
      currentToolCalls = chainedTools.map(ct => ({
        id: `chain_${iteration}_${ct.name}`,
        name: ct.name,
        arguments: ct.arguments
      }));

      // Add chaining information to results
      currentToolCalls.forEach((tc, index) => {
        const chainedTool = chainedTools[index];
        if (chainedTool) {
          const chainedResult = allResults.find(r => r.name === chainedTool.chainedFrom);
          if (chainedResult) {
            tc.arguments.chainedFrom = chainedTool.chainedFrom;
          }
        }
      });

      console.log(`✅ Iteration ${iteration} completed: ${enhancedResults.filter(r => r.success).length}/${enhancedResults.length} successful, ${chainedTools.length} tools chained for next iteration`);

      // Break if no new tools to chain
      if (chainedTools.length === 0) {
        console.log(`🏁 Workflow completed: no more tools to chain after iteration ${iteration}`);
        break;
      }
    }

    const summary = this.generateWorkflowSummary(allResults, workflowSteps);

    return {
      results: allResults,
      workflow: workflowSteps,
      summary
    };
  }

  /**
   * Analyze tool results for potential chaining opportunities
   */
  private analyzeForToolChaining(
    results: Array<{
      id?: string;
      name: string;
      result: string;
      success: boolean;
      executionTime: number;
    }>,
    availableTools: unknown[]
  ): Array<{
    name: string;
    arguments: Record<string, unknown>;
    chainedFrom: string;
  }> {
    const chainedTools: Array<{
      name: string;
      arguments: Record<string, unknown>;
      chainedFrom: string;
    }> = [];



    for (const result of results) {
      if (!result.success) continue;

      try {
        const parsedResult = JSON.parse(result.result);

        // Analyze search results for follow-up actions
        if (result.name.toLowerCase().includes('search')) {
          const searchChains = this.analyzeSearchForChaining(parsedResult, availableTools);
          chainedTools.push(...searchChains.map(chain => ({
            ...chain,
            chainedFrom: result.name
          })));
        }

        // Analyze memory results for follow-up actions
        if (result.name.toLowerCase().includes('memory')) {
          const memoryChains = this.analyzeMemoryForChaining(parsedResult, availableTools);
          chainedTools.push(...memoryChains.map(chain => ({
            ...chain,
            chainedFrom: result.name
          })));
        }

        // Analyze file results for follow-up actions
        if (result.name.toLowerCase().includes('file') || result.name.toLowerCase().includes('read')) {
          const fileChains = this.analyzeFileForChaining(parsedResult, availableTools);
          chainedTools.push(...fileChains.map(chain => ({
            ...chain,
            chainedFrom: result.name
          })));
        }

        // Generic analysis for API results
        if (result.name.toLowerCase().includes('api') || result.name.toLowerCase().includes('http')) {
          const apiChains = this.analyzeApiForChaining(parsedResult, availableTools);
          chainedTools.push(...apiChains.map(chain => ({
            ...chain,
            chainedFrom: result.name
          })));
        }

      } catch {
        // If result is not JSON, skip chaining analysis
        continue;
      }
    }

    // Remove duplicates and limit chaining to prevent infinite loops
    const uniqueChains = chainedTools.filter((chain, index, self) =>
      index === self.findIndex(c => c.name === chain.name && JSON.stringify(c.arguments) === JSON.stringify(chain.arguments))
    );

    return uniqueChains.slice(0, 5); // Limit to 5 chained tools per iteration
  }

  /**
   * Analyze results for potential tool chaining (generic approach)
   */
  private analyzeSearchForChaining(_searchResult: { results?: unknown[] }, _availableTools: unknown[]): Array<{
    name: string;
    arguments: Record<string, unknown>;
  }> {
    // Return empty array - let the LLM decide what tools to use next
    return [];
  }

  /**
   * Analyze memory results for potential tool chaining (generic approach)
   */
  private analyzeMemoryForChaining(_memoryResult: { memories?: unknown[] }, _availableTools: unknown[]): Array<{
    name: string;
    arguments: Record<string, unknown>;
  }> {
    // Return empty array - let the LLM decide what tools to use next
    return [];
  }

  /**
   * Analyze file results for potential tool chaining (generic approach)
   */
  private analyzeFileForChaining(_fileResult: { content?: string; filename?: string }, _availableTools: unknown[]): Array<{
    name: string;
    arguments: Record<string, unknown>;
  }> {
    // Return empty array - let the LLM decide what tools to use next
    return [];
  }

  /**
   * Analyze API results for potential tool chaining (generic approach)
   */
  private analyzeApiForChaining(_apiResult: { data?: unknown; endpoint?: string }, _availableTools: unknown[]): Array<{
    name: string;
    arguments: Record<string, unknown>;
  }> {
    // Return empty array - let the LLM decide what tools to use next
    return [];
  }

  /**
   * Extract key terms from text for follow-up searches
   */
  private extractKeyTermsFromText(text: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['this', 'that', 'with', 'from', 'they', 'have', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'will', 'about', 'would', 'there', 'could', 'other', 'more', 'very', 'what', 'know', 'just', 'first', 'into', 'over', 'think', 'also', 'your', 'work', 'life', 'only', 'can', 'still', 'should', 'after', 'being', 'now', 'made', 'before', 'here', 'through', 'when', 'where', 'much', 'some', 'these', 'many', 'then', 'them', 'well', 'were'].includes(word));

    // Count word frequency
    const wordCount: { [key: string]: number } = {};
    words.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    // Return top words by frequency
    return Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Generate workflow summary
   */
  private generateWorkflowSummary(
    results: Array<{
      id?: string;
      name: string;
      result: string;
      success: boolean;
      executionTime: number;
      iteration: number;
      chainedFrom?: string;
    }>,
    workflowSteps: Array<{
      iteration: number;
      toolsExecuted: string[];
      chainedTools: string[];
      totalTime: number;
    }>
  ): string {
    const totalTools = results.length;
    const successfulTools = results.filter(r => r.success).length;
    const totalTime = workflowSteps.reduce((sum, step) => sum + step.totalTime, 0);
    const iterations = workflowSteps.length;

    let summary = `## 🤖 Agentic Workflow Summary\n\n`;
    summary += `**Execution Overview:**\n`;
    summary += `- **Total Iterations:** ${iterations}\n`;
    summary += `- **Tools Executed:** ${totalTools}\n`;
    summary += `- **Success Rate:** ${Math.round((successfulTools / totalTools) * 100)}%\n`;
    summary += `- **Total Time:** ${totalTime}ms\n\n`;

    summary += `**Workflow Steps:**\n`;
    workflowSteps.forEach(step => {
      summary += `**Iteration ${step.iteration}** (${step.totalTime}ms):\n`;
      summary += `  - Executed: ${step.toolsExecuted.join(', ')}\n`;
      if (step.chainedTools.length > 0) {
        summary += `  - Chained: ${step.chainedTools.join(', ')}\n`;
      }
      summary += `\n`;
    });

    const chainedResults = results.filter(r => r.chainedFrom);
    if (chainedResults.length > 0) {
      summary += `**Tool Chaining:**\n`;
      chainedResults.forEach(result => {
        summary += `- ${result.name} ← chained from ${result.chainedFrom}\n`;
      });
      summary += `\n`;
    }

    return summary;
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
    conversationId?: string, // Add conversation ID for tool state tracking
    projectId?: string // Add project ID for memory context
  ): Promise<LLMResponse> {
    console.log('🧠🧠🧠 LLMService.sendMessage called - routing to automatic memory integration');
    console.log('🧠🧠🧠 Message:', typeof message === 'string' ? message.substring(0, 100) : 'complex message');
    console.log('🧠🧠🧠 ConversationId:', conversationId);
    console.log('🧠🧠🧠 ProjectId:', projectId);

    // Automatically enhance with memory and handle auto-save
    return this.sendMessageWithAutoMemory(
      message,
      settings,
      conversationHistory,
      onStream,
      signal,
      conversationId,
      projectId
    );
  }

  /**
   * Send message with automatic memory integration
   */
  private async sendMessageWithAutoMemory(
    message: MessageContent,
    settings: LLMSettings,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string,
    projectId?: string
  ): Promise<LLMResponse> {
    console.log('🧠🧠🧠 sendMessageWithAutoMemory called - AUTOMATIC MEMORY ACTIVE');
    const userMessage = typeof message === 'string' ? message :
      Array.isArray(message) ? message.map(item =>
        typeof item === 'string' ? item : item.text || ''
      ).join(' ') : '';

    try {
      console.log('🧠 Starting automatic memory integration...');

      // 1. Automatically enhance system prompt with relevant memories
      const originalSystemPrompt = settings.systemPrompt || '';
      console.log('🧠 Original system prompt length:', originalSystemPrompt.length);

      // Convert conversation history to simple string format for memory service
      const simpleHistory = conversationHistory.map(msg => ({
        role: msg.role,
        content: typeof msg.content === 'string' ? msg.content :
          Array.isArray(msg.content) ? msg.content.map(item =>
            typeof item === 'string' ? item : item.text || ''
          ).join(' ') : ''
      }));
      console.log('🧠 Converted conversation history:', simpleHistory.length, 'messages');

      console.log('🧠 Getting memory context for provider-specific integration...');
      const memoryContext = await memoryContextService.getMemoryContext(
        userMessage,
        conversationId,
        projectId,
        simpleHistory
      );

      console.log('🧠 Memory context retrieved:', {
        relevantMemoriesCount: memoryContext.relevantMemories.length,
        contextSummary: memoryContext.contextSummary.substring(0, 100)
      });

      // Pass memory context to provider-specific function (not enhanced prompt)
      const enhancedSettings = {
        ...settings,
        memoryContext // Add memory context for provider-specific integration
      };

      console.log(`🧠 Passing ${memoryContext.relevantMemories.length} memories to provider`);

      // 2. Send the message with enhanced context
      const response = await this.sendMessageInternal(
        message,
        enhancedSettings,
        conversationHistory,
        onStream,
        signal,
        conversationId
      );

      // 3. Automatically analyze and save useful information
      if (response.content) {
        console.log('🧠 Calling automaticMemoryService.autoSaveFromConversation...');
        const autoSaveResult = await automaticMemoryService.autoSaveFromConversation(
          userMessage,
          response.content,
          simpleHistory,
          conversationId,
          projectId
        );
        console.log('🧠 Auto-save result:', autoSaveResult);

        if (autoSaveResult.saved > 0) {
          console.log(`🧠 Auto-saved ${autoSaveResult.saved} memories from conversation`);
        } else {
          console.log('🧠 No memories auto-saved. Candidates:', autoSaveResult.candidates.length);
        }
      } else {
        console.log('🧠 No response content to analyze for auto-save');
      }

      return response;
    } catch (error) {
      console.error('Error in auto-memory integration:', error);
      // Fallback to normal message sending if memory integration fails
      return this.sendMessageInternal(
        message,
        settings,
        conversationHistory,
        onStream,
        signal,
        conversationId
      );
    }
  }

  /**
   * Internal message sending without memory integration
   */
  private async sendMessageInternal(
    message: MessageContent,
    settings: LLMSettings,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse> {
    const provider = this.getProvider(settings.provider);
    if (!provider) {
      throw new Error(`Provider ${settings.provider} not found`);
    }

    console.log(`🔍 ROUTING DEBUG: Provider is "${settings.provider}", conversation history length: ${conversationHistory.length}`);
    console.log(`🔍 ROUTING DEBUG: Provider object:`, { name: provider.name, baseUrl: provider.baseUrl });

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
        console.log(`🔍 ROUTING: Calling sendOllamaMessage with native API`);
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
      const toolInstructions = this.generateToolInstructions(mcpTools);
      systemPrompt += toolInstructions;
    }

    // Memory enhancement is now handled at the sendMessageWithAutoMemory level
    // No need to enhance here as it's already been done automatically

    // Extract user message text for memory operations
    const userMessageText = typeof message === 'string' ? message :
      (Array.isArray(message) ? JSON.stringify(message) :
      (message as { text?: string }).text || JSON.stringify(message));

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

      // Handle tool calls with enhanced parallel execution
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`🔧 OpenAI response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);
        let content = message.content || '';

        // Prepare tool calls for parallel execution
        const toolCallsForExecution = message.tool_calls.map((toolCall: { id: string; function: { name: string; arguments: string | Record<string, unknown> } }) => {
          let parsedArguments;
          try {
            parsedArguments = typeof toolCall.function.arguments === 'string'
              ? JSON.parse(toolCall.function.arguments)
              : toolCall.function.arguments;
          } catch (error) {
            console.warn(`⚠️ Failed to parse OpenAI tool arguments:`, toolCall.function.arguments, error);
            parsedArguments = {};
          }

          return {
            id: toolCall.id,
            name: toolCall.function.name,
            arguments: parsedArguments
          };
        });

        // Always use parallel execution for consistency and performance
        console.log(`🚀 Executing ${toolCallsForExecution.length} OpenAI tools in parallel`);
        const parallelResults = await this.executeMultipleToolsParallel(toolCallsForExecution, 'openai');

        // Use clean summary for user-facing content
        content += '\n\n' + this.summarizeToolResultsForModel(parallelResults);

        // Log execution summary
        const successCount = parallelResults.filter(r => r.success).length;
        console.log(`✅ OpenAI tool execution completed: ${successCount}/${parallelResults.length} successful`);

        // Create memory from conversation if appropriate
        await this.createMemoryFromConversation(
          userMessageText,
          content,
          conversationHistory.map(h => ({ role: h.role, content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content) })),
          conversationId
        );

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

      // Create memory from conversation if appropriate
      await this.createMemoryFromConversation(
        userMessageText,
        message.content,
        conversationHistory.map(h => ({ role: h.role, content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content) })),
        conversationId
      );

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
    console.log('🔍 [DEBUG] Getting MCP tools for Anthropic...');
    const mcpTools = await this.getMCPToolsForProvider('anthropic', settings);
    console.log('🔍 [DEBUG] MCP tools result:', { count: mcpTools.length, tools: mcpTools });

    // Enhanced debugging for tool availability
    if (mcpTools.length > 0) {
      console.log('🔍 [DEBUG] Available tool names:', mcpTools.map(t => {
        const tool = t as { name?: string };
        return tool.name || 'unknown';
      }));
      console.log('🔍 [DEBUG] Available tools:', mcpTools.map(t => {
        const tool = t as { name?: string; description?: string };
        return { name: tool.name || 'unknown', description: tool.description || 'no description' };
      }));
    } else {
      console.warn('🔍 [DEBUG] No MCP tools available! This explains why Claude can\'t search for news.');
    }

    // Build enhanced system prompt with tool instructions
    let systemPrompt = settings.systemPrompt || '';
    if (mcpTools.length > 0) {
      const toolInstructions = this.generateToolInstructions(mcpTools);
      systemPrompt += toolInstructions;

      // Add tool availability information
      systemPrompt += `\n\n## Available Tools Summary

You have access to ${mcpTools.length} specialized tools. Use them as needed to accomplish user objectives.`;
    }

    // Memory enhancement is now handled at the sendMessageWithAutoMemory level
    // No need to enhance here as it's already been done automatically

    // Extract user message text for memory operations
    const userMessageText = typeof message === 'string' ? message :
      (Array.isArray(message) ? JSON.stringify(message) :
      (message as { text?: string }).text || JSON.stringify(message));

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

      // For Claude 3.7 Sonnet, encourage parallel tool use
      if (settings.model.includes('claude-3-7-sonnet') || settings.model.includes('claude-sonnet-3-7')) {
        // Don't disable parallel tool use to encourage multiple tool calls
        // requestBody.disable_parallel_tool_use = false; // This is the default
      }

      // Use auto tool choice to allow Claude to decide when to use tools
      requestBody.tool_choice = { type: "auto" };

      console.log(`🚀 Anthropic API call with ${mcpTools.length} tools:`, {
        model: settings.model,
        toolCount: mcpTools.length,
        toolChoice: requestBody.tool_choice,
        tools: mcpTools.map(t => {
          const tool = t as { name?: string; description?: string };
          return { name: tool.name || 'unknown', description: tool.description || 'no description' };
        })
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

      // Handle tool calls in Anthropic format with parallel execution
      let content = '';
      const toolUseBlocks = [];

      // First pass: collect text content and tool use blocks
      for (const contentBlock of data.content) {
        if (contentBlock.type === 'text') {
          content += contentBlock.text;
        } else if (contentBlock.type === 'tool_use') {
          toolUseBlocks.push(contentBlock);
        }
      }

      // Execute tools in parallel if any are present
      let toolResults: Array<{ type: string; tool_use_id?: string; content: string; is_error?: boolean }> = [];
      if (toolUseBlocks.length > 0) {
        console.log(`🔧 Anthropic response contains ${toolUseBlocks.length} tool use blocks:`, toolUseBlocks);

        // Prepare tool calls for parallel execution
        const toolCallsForExecution = toolUseBlocks.map(block => ({
          id: block.id,
          name: block.name,
          arguments: block.input || {}
        }));

        // Execute tools in parallel
        console.log(`🚀 Executing ${toolCallsForExecution.length} Anthropic tools in parallel`);
        const parallelResults = await this.executeMultipleToolsParallel(toolCallsForExecution, 'anthropic');

        // Use clean summary for user-facing content
        content += '\n\n' + this.summarizeToolResultsForModel(parallelResults);

        // Log execution summary
        const successCount = parallelResults.filter(r => r.success).length;
        console.log(`✅ Anthropic tool execution completed: ${successCount}/${parallelResults.length} successful`);

        // Prepare tool results for potential follow-up call (Anthropic's two-call pattern)
        toolResults = parallelResults.map(result => ({
          type: 'tool_result',
          tool_use_id: result.id,
          content: result.result,
          is_error: !result.success
        }));
      }

      // Create toolCalls array for compatibility
      const toolCalls = toolUseBlocks.map(block => ({
        id: block.id,
        name: block.name,
        arguments: block.input || {}
      }));

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
          // Note: Don't include tools in follow-up call - Anthropic doesn't need them
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

      // Create memory from conversation if appropriate
      await this.createMemoryFromConversation(
        userMessageText,
        content,
        conversationHistory.map(h => ({ role: h.role, content: typeof h.content === 'string' ? h.content : JSON.stringify(h.content) }))
      );

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
    console.log('🧠 Gemini: Integrating memory context');

    // Build system prompt with memory context (Gemini-specific integration)
    let systemPrompt = settings.systemPrompt || '';
    console.log('🧠 Gemini original system prompt length:', systemPrompt.length);

    // Add memory context if available (Gemini-specific format)
    if (settings.memoryContext && settings.memoryContext.relevantMemories && settings.memoryContext.relevantMemories.length > 0) {
      console.log('🧠 Gemini integrating memory context with', settings.memoryContext.relevantMemories.length, 'memories');
      const memorySection = memoryContextService.buildMemoryEnhancedPrompt(
        systemPrompt,
        settings.memoryContext
      );
      systemPrompt = memorySection;
      console.log('🧠 Gemini system prompt enhanced with memory:', systemPrompt.length, 'characters');
      console.log('🧠 Gemini using', settings.memoryContext.relevantMemories.length, 'memories');
    } else {
      console.log('🧠 Gemini: No memory context to integrate');
    }

    const contents = [];

    // Add system prompt as first user message (Gemini doesn't have system role)
    if (systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: systemPrompt }]
      });
      contents.push({
        role: 'model',
        parts: [{ text: 'I understand. I will follow these instructions and use the memory context provided.' }]
      });
    }

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
      const toolInstructions = this.generateToolInstructions(mcpTools);
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

        // Execute tool calls in parallel and add results to conversation
        console.log(`🚀 Executing ${streamResult.toolCalls.length} Mistral tools in parallel for follow-up`);

        // Prepare tool calls for parallel execution
        const toolCallsForExecution = streamResult.toolCalls.map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments
        }));

        // Execute tools in parallel
        const parallelResults = await this.executeMultipleToolsParallel(toolCallsForExecution, 'mistral');

        // Add tool results to conversation history
        for (const result of parallelResults) {
          toolConversationHistory.push({
            role: 'tool',
            tool_call_id: result.id || '',
            content: result.result
          } as { role: string; tool_call_id: string; content: string });
        }

        // Log execution summary
        const successCount = parallelResults.filter(r => r.success).length;
        console.log(`✅ Mistral tool execution completed: ${successCount}/${parallelResults.length} successful`);

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

        // Execute tools in parallel and collect results
        const toolCallsForExecution = message.tool_calls.map((toolCall: { id: string; function: { name: string; arguments: string } }) => ({
          id: toolCall.id,
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments)
        }));

        const parallelResults = await this.executeMultipleToolsParallel(toolCallsForExecution);
        const toolResults = parallelResults.map(result => ({
          role: 'tool',
          name: result.name,
          content: result.result,
          tool_call_id: result.id || ''
        } as { role: string; content: string; tool_call_id: string }));

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
      console.log(`🔍 [LM STUDIO DEBUG] Available tools being passed to model:`, mcpTools.map(t => {
        const tool = t as { name?: string; function?: { name?: string } };
        return tool.name || tool.function?.name || 'unknown';
      }));

      const toolInstructions = this.generateToolInstructions(mcpTools, 'lmstudio');
      systemPrompt += toolInstructions;
      systemPrompt += `\n\nCRITICAL: Only use the tools listed above. DO NOT invent tool names like "get_weather" or "get_news" - they don't exist. If you need weather/news/current info, use web_search with appropriate queries.`;

      console.log(`🔍 [LM STUDIO DEBUG] System prompt length: ${systemPrompt.length} characters`);
      console.log(`🔍 [LM STUDIO DEBUG] Tool instructions preview:`, toolInstructions.substring(0, 500) + '...');
    } else {
      console.warn(`⚠️ [LM STUDIO DEBUG] No tools available for LM Studio!`);
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

    // MCP tools already retrieved above for system prompt

    const requestBody: Record<string, unknown> = {
      model: settings.model,
      messages: messages,
      temperature: settings.temperature,
      max_tokens: settings.maxTokens,
      stream: !!onStream
    };

    // Check if this request contains images
    const hasImages = (requestBody.messages as any[]).some(msg =>
      Array.isArray(msg.content) && msg.content.some((item: any) => item.type === 'image_url')
    );

    // Debug: Log the complete request being sent to LM Studio
    console.log(`🔍 LM Studio request body:`, {
      model: requestBody.model,
      messageCount: (requestBody.messages as any[]).length,
      hasImages: hasImages,
      stream: requestBody.stream
    });

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
      return this.handleLMStudioStreamResponse(response, onStream, settings, provider, conversationHistory, signal, message);
    } else {
      const data = await response.json();
      console.log(`🔍 LMStudio raw response:`, JSON.stringify(data, null, 2));
      const message = data.choices[0].message;
      console.log(`🔍 LMStudio message:`, message);

      // Parse JSON tool calls from content (new structured format)
      let parsedToolCalls: Array<{ id?: string; name: string; arguments: Record<string, unknown> }> = [];
      if (message?.content) {
        parsedToolCalls = this.parseJSONToolCalls(message.content);
        if (parsedToolCalls.length > 0) {
          console.log(`🔍 Parsed ${parsedToolCalls.length} JSON tool calls:`, parsedToolCalls);

          // Remove tool call JSON from content
          message.content = this.removeJSONToolCalls(message.content);
          console.log(`🔍 Cleaned content:`, message.content);

          // Convert parsed tool calls to native format
          message.tool_calls = parsedToolCalls.map(tc => ({
            id: tc.id || `json-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.arguments)
            }
          }));
          console.log(`🔍 Converted to native tool calls:`, message.tool_calls);
        }
      }

      // Handle tool calls (both native and converted from JSON)
      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`🔧 LMStudio response contains ${message.tool_calls.length} tool calls:`, message.tool_calls);

        // Log tool names for multi-tool debugging
        const toolNames = message.tool_calls.map((tc: any) => tc.function?.name || 'unknown').join(', ');
        console.log(`🔧 LMStudio executing tools: ${toolNames}`);

        // Execute each tool call and collect results
        const toolResults: any[] = [];
        for (const toolCall of message.tool_calls) {
          try {
            // Validate tool call structure
            if (!toolCall.id) {
              throw new Error('Tool call missing required id field');
            }
            if (!toolCall.function?.name) {
              throw new Error('Tool call missing required function name');
            }
            if (!toolCall.function.arguments) {
              console.warn(`⚠️ Tool call ${toolCall.function.name} has no arguments, using empty object`);
              toolCall.function.arguments = '{}';
            }

            console.log(`🔧 Executing LMStudio tool call:`, toolCall);
            const toolResult = await this.executeMCPTool(
              toolCall.function.name,
              JSON.parse(toolCall.function.arguments)
            );
            console.log(`✅ LMStudio tool result for ${toolCall.function.name}:`, toolResult);
            const toolResultMessage = {
              tool_call_id: toolCall.id,
              role: 'tool',
              content: JSON.stringify(toolResult)
            } as { tool_call_id: string; role: string; content: string };
            toolResults.push(toolResultMessage);
            console.log(`📝 Added tool result to conversation history:`, { tool_call_id: toolCall.id, contentLength: toolResultMessage.content.length });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`❌ LMStudio tool call failed for ${toolCall.function.name}:`, errorMessage);

            // Provide structured error response for the LLM
            const errorResponse = {
              error: true,
              tool_name: toolCall.function.name,
              error_message: errorMessage,
              error_type: error instanceof Error ? error.constructor.name : 'UnknownError'
            };

            toolResults.push({
              tool_call_id: toolCall.id,
              role: 'tool',
              content: JSON.stringify(errorResponse)
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
          {
            role: 'assistant',
            tool_calls: data.choices[0].message.tool_calls.map((tc: any) => ({
              id: tc.id,
              type: tc.type || 'function',
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments
              }
            }))
          },
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
          // Explicitly exclude tools from second call - LLM should provide final response
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
          console.error(`❌ LMStudio second API call failed (${secondResponse.status}):`, error);

          // Provide more specific error messages for common issues
          if (secondResponse.status === 400 && error.includes('tool')) {
            throw new Error(`LM Studio tool processing error: The model may not support the tool call format. Try a different model or check tool definitions. Error: ${error}`);
          }
          if (secondResponse.status === 400 && error.includes('context')) {
            throw new Error(`LM Studio context error: Tool results may be too large for the model's context window. Try reducing tool output size. Error: ${error}`);
          }

          throw new Error(`LM Studio second API call error (${secondResponse.status}): ${error}`);
        }

        const secondData = await secondResponse.json();
        console.log(`🔍 LMStudio second response:`, JSON.stringify(secondData, null, 2));
        const secondMessage = secondData.choices[0]?.message;
        console.log(`🔍 LMStudio final message:`, secondMessage);

        // Format tool execution results for UI display (like Anthropic)
        const toolExecutionResults = data.choices[0].message.tool_calls.map((tc: { id: string; function: { name: string; arguments: string } }) => ({
          id: tc.id,
          name: tc.function.name,
          result: JSON.stringify(toolResults.find(tr => tr.tool_call_id === tc.id)?.content || 'No result'),
          success: true,
          executionTime: 100 // Estimated
        }));

        const toolExecutionSummary = this.summarizeToolResultsForModel(toolExecutionResults);
        const finalContent = toolExecutionSummary + (secondMessage?.content || 'Tool execution completed.');

        return {
          content: finalContent,
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
                                   (content.includes('search') ||
                                    content.includes('function') ||
                                    content.includes('call'));

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
    const callId = Math.random().toString(36).substr(2, 9);
    console.log(`🧠 [${callId}] Ollama function called with message:`, typeof message === 'string' ? message.substring(0, 50) : 'complex');
    console.log(`🧠 [${callId}] Has memory context:`, !!settings.memoryContext?.relevantMemories?.length);
    const baseUrl = settings.baseUrl || provider.baseUrl;

    // Get MCP tools for Ollama
    const mcpTools = await this.getMCPToolsForProvider('ollama', settings);

    // Check if this is a vision model request (has images)
    const hasImages = typeof message === 'object' && !Array.isArray(message) && 'images' in message && message.images && message.images.length > 0;

    // Use Ollama's chat API (supports both vision and tools)
    const messages = [];

    // Build system prompt with memory context (Ollama-specific integration)
    let systemPrompt = settings.systemPrompt || '';
    console.log('🧠 Ollama original system prompt length:', systemPrompt.length);

    // Add memory context if available (Ollama-specific format)
    console.log('🧠 Ollama checking memory context:', {
      hasMemoryContext: !!settings.memoryContext,
      memoryContextType: typeof settings.memoryContext,
      memoryContextKeys: settings.memoryContext ? Object.keys(settings.memoryContext) : 'none'
    });

    if (settings.memoryContext && settings.memoryContext.relevantMemories && settings.memoryContext.relevantMemories.length > 0) {
      console.log('🧠 Ollama integrating memory context with', settings.memoryContext.relevantMemories.length, 'memories');
      const memorySection = memoryContextService.buildMemoryEnhancedPrompt(
        systemPrompt,
        settings.memoryContext
      );
      systemPrompt = memorySection;
      console.log('🧠 Ollama system prompt enhanced with memory:', systemPrompt.length, 'characters');
      console.log('🧠 Ollama using', settings.memoryContext.relevantMemories.length, 'memories');
      console.log('🧠 Ollama enhanced system prompt preview:', systemPrompt.substring(0, 500) + '...');
    } else {
      console.log('🧠 Ollama: No memory context to integrate');
    }

    // Add tool instructions if tools are available
    if (mcpTools.length > 0) {
      console.log(`🔍 [OLLAMA DEBUG] Available tools being passed to model:`, mcpTools.map(t => {
        const tool = t as { name?: string; function?: { name?: string } };
        return tool.name || tool.function?.name || 'unknown';
      }));

      const toolInstructions = this.generateToolInstructions(mcpTools, 'ollama');
      systemPrompt += toolInstructions;
      systemPrompt += `\n\nCRITICAL: Only use the tools listed above. DO NOT invent or hallucinate tool names. If you need current information and no specific tool exists, use web_search with appropriate queries.`;
      console.log('🧠 Ollama system prompt after adding tools:', systemPrompt.length);

      console.log(`🔍 [OLLAMA DEBUG] Tool instructions preview:`, toolInstructions.substring(0, 500) + '...');
    } else {
      console.warn(`⚠️ [OLLAMA DEBUG] No tools available for Ollama!`);
    }

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
      console.log('🧠 Ollama added system message, messages array length:', messages.length);
    } else {
      console.log('🧠 Ollama: No system prompt to add');
    }

    // Add conversation history
    console.log('🧠 Ollama adding conversation history:', conversationHistory.length, 'messages');
    conversationHistory.forEach((msg, index) => {
      console.log(`🧠 Ollama history[${index}]:`, {
        role: msg.role,
        contentLength: typeof msg.content === 'string' ? msg.content.length : 'complex',
        contentPreview: typeof msg.content === 'string' ? msg.content.substring(0, 50) + '...' : 'complex content'
      });
    });
    messages.push(...conversationHistory);
    console.log('🧠 Ollama after adding conversation history, messages array length:', messages.length);

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
    console.log('🧠 Ollama after adding current message, messages array length:', messages.length);

    // Debug: Show complete message structure being sent to Ollama
    console.log(`🧠 [${callId}] COMPLETE Ollama message structure being sent:`, messages.length, 'messages');
    if (messages.length > 0) {
      messages.forEach((msg, index) => {
        console.log(`🧠 [${callId}] Message[${index}]:`, {
          role: msg.role,
          contentType: typeof msg.content,
          contentPreview: typeof msg.content === 'string' ?
            msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : '') :
            'complex content'
        });
      });
    } else {
      console.log(`🧠 [${callId}] ERROR: Messages array is empty! This should not happen.`);
    }

    // Always use native Ollama API (supports both conversation state and tools)
    const useNativeAPI = true; // Native API supports tools according to official documentation
    console.log(`🔍 [${callId}] OLLAMA API CHOICE: useNativeAPI = ${useNativeAPI}`);

    // Build request body based on API type
    let requestBody: Record<string, unknown>;

    if (useNativeAPI) {
      // Native Ollama API format
      requestBody = {
        model: settings.model,
        messages: messages,
        stream: !!onStream,
        options: {
          temperature: settings.temperature,
          num_predict: settings.maxTokens
        }
      };
    } else {
      // OpenAI-compatible API format
      requestBody = {
        model: settings.model,
        messages: messages,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        stream: !!onStream
      };
    }

    // Add tools if available (native API supports tools!)
    if (mcpTools.length > 0) {
      requestBody.tools = mcpTools;
      console.log(`🚀 Ollama ${useNativeAPI ? 'native' : 'OpenAI-compatible'} API call with ${mcpTools.length} tools:`, {
        model: settings.model,
        toolCount: mcpTools.length,
        toolNames: mcpTools.map(t => (t as ToolObject).function?.name).filter(Boolean),
        baseUrl: baseUrl
      });
    } else {
      console.log(`🚀 Ollama API call without tools (no MCP tools available)`);
    }

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

      // Add tools if available for native API
      if (mcpTools.length > 0) {
        finalRequestBody.tools = mcpTools;
        console.log(`🔗 Native API: Added ${mcpTools.length} tools to request`);
      }

      console.log(`🔗 Using Ollama native API format`);
      console.log(`🔗 Full request body:`, JSON.stringify(finalRequestBody, null, 2));
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
      // Use the correct streaming handler based on API type
      const streamResult = useNativeAPI ?
        await this.handleOllamaStreamResponse(response, onStream) :
        await this.handleOllamaChatStreamResponse(response, onStream);

      // Check if there are tool calls that need follow-up processing
      if (streamResult.toolCalls && streamResult.toolCalls.length > 0) {
        console.log(`🔄 Ollama streaming: Processing ${streamResult.toolCalls.length} tool calls for follow-up`);

        // Build conversation history following Ollama's correct agentic workflow
        // Step 1: Add the assistant message with tool calls (following Ollama best practices)
        const toolConversationHistory = [
          ...messages,
          {
            role: 'assistant',
            tool_calls: streamResult.toolCalls.map(tc => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.name,
                arguments: useNativeAPI ? tc.arguments : JSON.stringify(tc.arguments)
              }
            }))
          }
        ];

        // Execute tool calls in parallel and add results to conversation
        console.log(`🚀 Executing ${streamResult.toolCalls.length} Ollama tools in parallel for follow-up`);

        // Prepare tool calls for parallel execution
        const toolCallsForExecution = streamResult.toolCalls.map(tc => ({
          id: tc.id,
          name: tc.name,
          arguments: tc.arguments
        }));

        // Execute tools in parallel
        const parallelResults = await this.executeMultipleToolsParallel(toolCallsForExecution, 'ollama');

        // Step 2: Add each tool result as a separate 'tool' role message (Ollama standard)
        for (const result of parallelResults) {
          toolConversationHistory.push({
            role: 'tool',
            content: result.result,
            tool_call_id: result.id || ''
          } as { role: string; content: string; tool_call_id: string }); // Cast to handle tool message type
        }

        // Log execution summary
        const successCount = parallelResults.filter(r => r.success).length;
        console.log(`✅ Ollama tool execution completed: ${successCount}/${parallelResults.length} successful`);

        // Make follow-up call to get LLM's processed response
        console.log(`🔄 Making follow-up Ollama call after streaming to process tool results...`);
        const followUpRequestBody = useNativeAPI ? {
          model: settings.model,
          messages: toolConversationHistory,
          stream: false, // Use non-streaming for follow-up
          options: {
            temperature: settings.temperature,
            num_predict: settings.maxTokens
          }
        } : {
          model: settings.model,
          messages: toolConversationHistory,
          temperature: settings.temperature,
          max_tokens: settings.maxTokens,
          stream: false // Use non-streaming for follow-up
        };

        const followUpApiUrl = useNativeAPI ? `${baseUrl}/api/chat` : `${baseUrl}/v1/chat/completions`;
        console.log(`🔄 Follow-up call using ${useNativeAPI ? 'native' : 'OpenAI-compatible'} API: ${followUpApiUrl}`);

        const followUpResponse = await fetch(followUpApiUrl, {
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

        // Handle both native and OpenAI-compatible response formats
        const followUpMessage = useNativeAPI ?
          followUpData.message :
          followUpData.choices?.[0]?.message;
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



      // Handle tool calls using two-call pattern with parallel execution
      if (parsedToolCalls.length > 0) {
        console.log(`🔧 Ollama response contains ${parsedToolCalls.length} tool calls:`, parsedToolCalls);

        // Prepare tool calls for parallel execution
        const toolCallsForExecution = parsedToolCalls.map((toolCall: { id?: string; function: { name: string; arguments: Record<string, unknown> } }) => ({
          id: toolCall.id || `ollama-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: toolCall.function.name,
          arguments: toolCall.function.arguments
        }));

        // Execute tools in parallel
        console.log(`🚀 Executing ${toolCallsForExecution.length} Ollama tools in parallel`);
        const parallelResults = await this.executeMultipleToolsParallel(toolCallsForExecution, 'ollama');

        // Convert parallel results to tool results format
        const toolResults = parallelResults.map(result => ({
          role: 'tool',
          content: result.result
        }));

        // Log execution summary
        const successCount = parallelResults.filter(r => r.success).length;
        console.log(`✅ Ollama tool execution completed: ${successCount}/${parallelResults.length} successful`);

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
      const toolInstructions = this.generateToolInstructions(mcpTools);
      systemPrompt += toolInstructions;

      // Add specific multi-tool execution instructions for OpenRouter
      systemPrompt += `\n\n🎯 **IMPORTANT: MULTIPLE TOOL CALLS IN SINGLE RESPONSE**

When a user request requires multiple pieces of information, you can make MULTIPLE tool calls in the SAME response:

1. **Identify all needed information** from the user's request
2. **Include ALL necessary tool calls** in your tool_calls array in ONE response
3. **Don't wait for results** - make all calls you need upfront

Example: For "tell me the date and last week's tech news":
- Include BOTH tool calls in your response:
  * Call datetime tool for current date
  * Call search tool for tech news
- Both will be executed and results returned to you
- Then provide a complete answer with both pieces of information

You can include multiple tool calls like this:
\`\`\`json
{
  "tool_calls": [
    {"id": "call_1", "function": {"name": "get_datetime", "arguments": "{}"}},
    {"id": "call_2", "function": {"name": "web_search", "arguments": "{\\"query\\": \\"tech news last week\\"}"}}
  ]
}
\`\`\`

This is more efficient than making one tool call, waiting, then making another.`;
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
        return await this.processOpenRouterToolCalls(streamResult, messages, settings, provider, onStream, signal);
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

        // Execute tools in parallel - same as other providers
        console.log(`🚀 Executing ${detectedToolCalls.length} OpenRouter tools in parallel`);

        // Filter and prepare tool calls for parallel execution
        const validToolCalls = detectedToolCalls
          .map((toolCall: any) => {
            try {
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

              return {
                id: toolCall.id,
                name: toolName,
                arguments: toolArgs
              };
            } catch (error) {
              console.error(`❌ Failed to parse OpenRouter tool call:`, toolCall, error);
              return null;
            }
          })
          .filter((tc: any) => tc !== null) as Array<{
            id: string;
            name: string;
            arguments: Record<string, unknown>;
          }>;

        // Execute all tools in parallel
        const parallelResults = await this.executeMultipleToolsParallel(validToolCalls, 'openrouter');

        // Convert parallel results to tool results format
        const toolResults = parallelResults.map(result => ({
          role: 'tool',
          tool_call_id: result.id || 'unknown',
          name: result.name,
          content: result.success ? JSON.stringify(result.result) : JSON.stringify({ error: 'Tool execution failed' })
        } as { tool_call_id: string; name: string; content: string }));

        // Log execution summary
        const successCount = parallelResults.filter(r => r.success).length;
        console.log(`✅ OpenRouter tool execution completed: ${successCount}/${parallelResults.length} successful`);

        // Build conversation history with tool calls and results
        // Include the complete conversation context for the follow-up call
        const toolConversationHistory = [
          ...conversationHistory, // Original conversation history including system prompt
          { role: 'user', content: typeof message === 'string' ? message : JSON.stringify(message) },
          {
            role: 'assistant',
            content: data.choices[0]?.message?.content || '',
            tool_calls: detectedToolCalls.map((tc: any) => ({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.function?.name || tc.name,
                arguments: typeof tc.function?.arguments === 'string' ? tc.function.arguments : JSON.stringify(tc.function?.arguments || tc.arguments || {})
              }
            }))
          },
          ...toolResults
        ];

        // Make second call to get LLM's processed response
        console.log(`🔄 Making second OpenRouter call to process tool results...`);
        console.log(`🔍 Tool conversation history for follow-up:`, JSON.stringify(toolConversationHistory, null, 2));

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

    // Detect the underlying provider from the model name and get appropriate tools
    let targetProvider = 'requesty'; // default to OpenAI format
    if (settings.model?.startsWith('google/')) {
      targetProvider = 'gemini';
    } else if (settings.model?.startsWith('anthropic/')) {
      targetProvider = 'anthropic';
    }

    console.log(`🔍 Requesty routing detected: model=${settings.model} → targetProvider=${targetProvider}`);
    const mcpTools = await this.getMCPToolsForProvider(targetProvider, settings);

    // Build enhanced system prompt with tool instructions
    let systemPrompt = settings.systemPrompt || '';
    if (mcpTools.length > 0) {
      const toolInstructions = this.generateToolInstructions(mcpTools);
      systemPrompt += toolInstructions;

      // Add specific multi-tool execution instructions for OpenAI models
      if (settings.model?.startsWith('openai/')) {
        systemPrompt += `\n\n🎯 **CRITICAL: MULTI-TOOL EXECUTION STRATEGY FOR COMPLEX REQUESTS**

Follow the systematic approach outlined in your system prompt. Use available tools strategically to accomplish user objectives effectively.

Use tools strategically to provide comprehensive and helpful responses.`;
      }
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
    // eslint-disable-next-line prefer-const
    let toolCalls: Array<{ id: string; function: { name?: string; arguments: string } }> = [];
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
            console.log('🔍 Native Ollama streaming chunk:', JSON.stringify(parsed, null, 2));

            // Native Ollama API uses message.content format
            if (parsed.message && parsed.message.content) {
              fullContent += parsed.message.content;
              onStream(parsed.message.content);
            } else if (parsed.response) {
              // Fallback for generate API format
              fullContent += parsed.response;
              onStream(parsed.response);
            }

            // Handle tool calls in native API format
            if (parsed.message && parsed.message.tool_calls) {
              console.log('🔧 Native Ollama tool calls detected:', parsed.message.tool_calls);
              // Convert native Ollama format to internal format and APPEND to existing tool calls
              const newToolCalls = parsed.message.tool_calls.map((tc: { id?: string; function?: { name?: string; arguments?: Record<string, unknown> } }) => ({
                id: tc.id || `call_${Math.random().toString(36).substr(2, 9)}`,
                function: {
                  name: tc.function?.name,
                  arguments: JSON.stringify(tc.function?.arguments || {})
                }
              }));

              // Append new tool calls instead of overwriting
              toolCalls.push(...newToolCalls);
              console.log('🔧 Accumulated tool calls:', toolCalls.length, 'total');
            } else if (!parsed.message?.content) {
              console.log('🔍 Native Ollama chunk with no content:', Object.keys(parsed));
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
      } : undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls
        .filter(tc => tc.function?.name) // Filter out tool calls without names
        .map(tc => ({
          id: tc.id,
          name: tc.function!.name!,
          arguments: JSON.parse(tc.function?.arguments || '{}') as ToolCallArguments
        })) : undefined
    };
  }

  /**
   * Process OpenRouter tool calls with recursive handling for multi-round execution
   */
  private async processOpenRouterToolCalls(
    streamResult: any,
    messages: any[],
    settings: LLMSettings,
    provider: LLMProvider,
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    // Get MCP tools for follow-up calls - CRITICAL: tools must be included in every request
    const mcpTools = await this.getMCPToolsForProvider('openrouter', settings);
    // Build conversation history with tool calls and results
    const toolConversationHistory = [
      ...messages,
      {
        role: 'assistant',
        content: streamResult.content || '',
        tool_calls: streamResult.toolCalls.map((tc: any) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments)
          }
        }))
      }
    ];

    // Execute tools in parallel
    console.log(`🚀 Executing ${streamResult.toolCalls.length} OpenRouter tools in parallel`);

    const parallelMessage = `\n🚀 Executing ${streamResult.toolCalls.length} tools in parallel...\n`;
    if (onStream) onStream(parallelMessage);

    const validToolCalls = streamResult.toolCalls
      .filter((tc: any) => tc.id && tc.name && tc.arguments !== undefined)
      .map((tc: any) => ({
        id: tc.id,
        name: tc.name,
        arguments: tc.arguments as Record<string, unknown>
      }));

    const parallelResults = await this.executeMultipleToolsParallel(validToolCalls, 'openrouter');

    const successCount = parallelResults.filter(r => r.success).length;
    const completionMessage = `✅ Parallel execution completed: ${successCount}/${parallelResults.length} successful\n\n`;
    if (onStream) onStream(completionMessage);

    // Add tool results to conversation history
    for (const result of parallelResults) {
      toolConversationHistory.push({
        role: 'tool',
        tool_call_id: result.id || 'unknown',
        content: result.success ? JSON.stringify(result.result) : JSON.stringify({ error: 'Tool execution failed' })
      });
    }

    // Make follow-up call
    const followUpResponse = await fetch(`${provider.baseUrl || 'https://openrouter.ai/api/v1'}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'HTTP-Referer': 'https://littlellm.app',
        'X-Title': 'LittleLLM'
      },
      body: JSON.stringify({
        model: settings.model,
        messages: toolConversationHistory,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        tools: mcpTools, // CRITICAL: Include tools so LLM can make additional tool calls
        tool_choice: 'auto',
        stream: false
      }),
      signal
    });

    if (!followUpResponse.ok) {
      const error = await followUpResponse.text();
      console.error(`❌ OpenRouter follow-up call failed:`, error);
      return streamResult;
    }

    const followUpData = await followUpResponse.json();
    const followUpMessage = followUpData.choices[0]?.message;
    const additionalToolCalls = followUpMessage?.tool_calls || [];

    if (additionalToolCalls.length > 0) {
      // Recursive case: more tool calls detected
      console.log(`🔄 OpenRouter follow-up contains ${additionalToolCalls.length} additional tool calls, processing recursively...`);

      const intermediateContent = followUpMessage?.content || '';
      if (onStream && intermediateContent) {
        onStream('\n\n' + intermediateContent);
      }

      const mockStreamResult = {
        content: intermediateContent,
        toolCalls: additionalToolCalls.map((tc: any) => ({
          id: tc.id,
          name: tc.function?.name || tc.name,
          arguments: typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : tc.function?.arguments || {}
        })),
        usage: {
          promptTokens: followUpData.usage?.prompt_tokens || 0,
          completionTokens: followUpData.usage?.completion_tokens || 0,
          totalTokens: followUpData.usage?.total_tokens || 0
        }
      };

      const additionalMessages = [
        ...toolConversationHistory,
        {
          role: 'assistant',
          content: intermediateContent,
          tool_calls: additionalToolCalls
        }
      ];

      const recursiveResult = await this.processOpenRouterToolCalls(
        mockStreamResult,
        additionalMessages,
        settings,
        provider,
        onStream,
        signal
      );

      return {
        content: (streamResult.content || '') + '\n\n' + (intermediateContent || '') + '\n\n' + (recursiveResult.content || ''),
        usage: {
          promptTokens: (streamResult.usage?.promptTokens || 0) + (recursiveResult.usage?.promptTokens || 0),
          completionTokens: (streamResult.usage?.completionTokens || 0) + (recursiveResult.usage?.completionTokens || 0),
          totalTokens: (streamResult.usage?.totalTokens || 0) + (recursiveResult.usage?.totalTokens || 0)
        },
        toolCalls: [...(streamResult.toolCalls || []), ...(recursiveResult.toolCalls || [])]
      };
    } else {
      // Base case: no more tool calls
      const followUpContent = followUpMessage?.content || 'Tool execution completed.';
      if (onStream && followUpContent) {
        onStream('\n\n' + followUpContent);
      }

      return {
        content: (streamResult.content || '') + '\n\n' + followUpContent,
        usage: {
          promptTokens: (streamResult.usage?.promptTokens || 0) + (followUpData.usage?.prompt_tokens || 0),
          completionTokens: (streamResult.usage?.completionTokens || 0) + (followUpData.usage?.completion_tokens || 0),
          totalTokens: (streamResult.usage?.totalTokens || 0) + (followUpData.usage?.total_tokens || 0)
        },
        toolCalls: streamResult.toolCalls
      };
    }
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
    const toolCallsBuffer: { [index: number]: { id?: string; function?: { name?: string; arguments?: string } } } = {};

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

              // Handle tool calls (accumulate by index)
              if (delta?.tool_calls) {
                for (const toolCallDelta of delta.tool_calls) {
                  const index = toolCallDelta.index || 0;

                  // Initialize tool call buffer for this index if not exists
                  if (!toolCallsBuffer[index]) {
                    toolCallsBuffer[index] = { id: '', function: { name: '', arguments: '' } };
                  }

                  // Accumulate tool call data
                  if (toolCallDelta.id) {
                    toolCallsBuffer[index].id = toolCallDelta.id;
                  }
                  if (toolCallDelta.function?.name) {
                    toolCallsBuffer[index].function!.name = toolCallDelta.function.name;
                    // Show tool usage in stream when we first get the name
                    const toolMessage = `\n\n🔧 Executing tools: ${toolCallDelta.function.name}\n`;
                    fullContent += toolMessage;
                    onStream(toolMessage);
                  }
                  if (toolCallDelta.function?.arguments) {
                    toolCallsBuffer[index].function!.arguments += toolCallDelta.function.arguments;
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

    // Convert buffered tool calls to final array
    for (const index in toolCallsBuffer) {
      const bufferedCall = toolCallsBuffer[index];
      if (bufferedCall.id && bufferedCall.function?.name) {
        toolCalls.push(bufferedCall);
      }
    }

    console.log('🔍 Requesty streaming completed:', {
      contentLength: fullContent.length,
      hasUsage: !!usage,
      usage: usage,
      toolCallsCount: toolCalls.length,
      bufferedToolCalls: Object.keys(toolCallsBuffer).length
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
    const toolCalls: Array<{ id?: string; name?: string; arguments?: unknown; result?: string; isError?: boolean; parseError?: string }> = [];
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
                  console.log(`🔧 Collected streaming tool for parallel execution:`, toolBlock.name, toolInput);

                  // Update assistant content with final input
                  if (assistantContent[index] && assistantContent[index].type === 'tool_use') {
                    assistantContent[index].input = toolInput;
                  }

                  // Collect tool for parallel execution (don't execute yet)
                  toolCalls.push({
                    id: toolBlock.id as string,
                    name: toolBlock.name as string,
                    arguments: toolInput
                  });

                  // Show that we're preparing the tool (don't execute yet)
                  const preparingMessage = `⚙️ Preparing ${toolBlock.name}...\n`;
                  fullContent += preparingMessage;
                  onStream(preparingMessage);

                } catch (error) {
                  console.error(`❌ Anthropic streaming tool input parsing failed:`, error);

                  // Show parsing error in chat
                  const errorMessage = `❌ Tool ${toolBlock.name} input parsing failed: ${error instanceof Error ? error.message : String(error)}\n`;
                  fullContent += errorMessage;
                  onStream(errorMessage);

                  // Still collect the tool call for potential execution
                  toolCalls.push({
                    id: toolBlock.id as string,
                    name: toolBlock.name as string,
                    arguments: {},
                    parseError: error instanceof Error ? error.message : String(error)
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

    // If we have tool calls, execute them in parallel and make a follow-up streaming call
    if (toolCalls.length > 0 && settings && provider) {
      console.log(`🚀 Executing ${toolCalls.length} Anthropic tools in parallel before follow-up`);

      // Show parallel execution message
      const parallelMessage = `\n🚀 Executing ${toolCalls.length} tools in parallel...\n`;
      fullContent += parallelMessage;
      onStream(parallelMessage);

      // Filter and prepare tool calls for parallel execution
      const validToolCalls = toolCalls
        .filter(tc => tc.id && tc.name && tc.arguments !== undefined)
        .map(tc => ({
          id: tc.id!,
          name: tc.name!,
          arguments: tc.arguments as Record<string, unknown>
        }));

      // Execute all tools in parallel
      const parallelResults = await this.executeMultipleToolsParallel(validToolCalls, 'anthropic');

      // Show completion message
      const successCount = parallelResults.filter(r => r.success).length;
      const completionMessage = `✅ Parallel execution completed: ${successCount}/${parallelResults.length} successful\n\n`;
      fullContent += completionMessage;
      onStream(completionMessage);

      // Add user-friendly summary for the model to work with (not the detailed debug output)
      const toolSummary = this.summarizeToolResultsForModel(parallelResults);

      // Log detailed results for debugging (not shown to user)
      console.log('🔧 Detailed tool execution results:', this.aggregateToolResults(parallelResults));

      // Only add the clean summary to the content stream
      fullContent += toolSummary;
      onStream(toolSummary);

      // Log tool execution for debugging
      console.log(`🔍 Executed tools:`, parallelResults.map(r => r.name));
      console.log(`🔍 Tool execution completed, proceeding with follow-up call`);

      console.log(`🔄 Making follow-up Anthropic streaming call with ${parallelResults.length} tool results`);

      // Reconstruct the conversation with tool results
      const messages = conversationHistory ? [...conversationHistory] : [];

      // Add the assistant's message with tool calls (proper Anthropic format)
      messages.push({
        role: 'assistant',
        content: assistantContent as unknown as Array<ContentItem>
      });

      // Add tool results as user message using parallel execution results (proper Anthropic format)
      const toolResults = parallelResults.map(result => {
        let content = result.result;

        // Parse JSON results and format them properly for Claude
        try {
          const parsedResult = JSON.parse(result.result);
          content = this.formatToolResult(result.name, parsedResult);
        } catch {
          // If not JSON, use as-is but clean up quotes
          content = result.result.replace(/^"|"$/g, '');
        }



        return {
          type: 'tool_result',
          tool_use_id: result.id || '',
          content: content,
          is_error: !result.success
        };
      });



      messages.push({
        role: 'user',
        content: toolResults as unknown as Array<ContentItem>
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

        // Use non-streaming follow-up call to prevent double replies
        const url = `${provider.baseUrl}/models/${settings.model}:generateContent?key=${settings.apiKey}`;
        const followupResponse = await fetch(url, {
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
          if (followupData.candidates && followupData.candidates[0]?.content?.parts) {
            const parts = followupData.candidates[0].content.parts;

            // Collect all text from the follow-up response
            let followupText = '';
            for (const part of parts) {
              if (part.text) {
                followupText += part.text;
              }
            }

            // Add the follow-up content as a single chunk to avoid double replies
            if (followupText.trim()) {
              fullContent += '\n\n' + followupText;
              onStream('\n\n' + followupText);
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

                // Don't stream JSON tool call blocks to avoid showing them to user
                if (!delta.content.includes('"tool_call"') &&
                    !delta.content.includes('```') &&
                    !delta.content.trim().startsWith('json')) {
                  onStream(delta.content);
                }
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

    // Parse JSON tool calls from the full content if no native tool calls
    let parsedToolCalls: Array<{ id?: string; name: string; arguments: Record<string, unknown> }> = [];
    if (fullContent && toolCalls.length === 0) {
      parsedToolCalls = this.parseJSONToolCalls(fullContent);
      if (parsedToolCalls.length > 0) {
        console.log(`🔍 Parsed ${parsedToolCalls.length} JSON tool calls from streaming:`, parsedToolCalls);

        // Remove tool call JSON from content
        fullContent = this.removeJSONToolCalls(fullContent);
        console.log(`🔍 Cleaned streaming content:`, fullContent);

        // Convert parsed tool calls to native format
        toolCalls.push(...parsedToolCalls.map(tc => ({
          id: tc.id || `json-stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.arguments)
          }
        })));
        console.log(`🔍 Converted streaming tool calls:`, toolCalls);
      }
    }

    if (usage) {
      console.log('📊 LM Studio raw usage data:', usage);
    } else {
      console.log('⚠️ LM Studio: No usage data received, will estimate tokens');
    }

    // If we have tool calls, execute them and get final response
    if (toolCalls.length > 0) {
      console.log(`🔧 LMStudio streaming found ${toolCalls.length} tool calls:`, toolCalls);

      // Log tool names for multi-tool debugging
      const toolNamesForLogging = toolCalls.map(tc => tc.function?.name || 'unknown').join(', ');
      console.log(`🔧 LMStudio streaming executing tools: ${toolNamesForLogging}`);

      // Show tool usage in the stream (without markdown formatting)
      const toolNames = toolCalls.map(tc => tc.function?.name || 'unknown').join(', ');
      const toolMessage = `\n\n🔧 Executing tools: ${toolNames}\n`;
      fullContent += toolMessage;
      onStream(toolMessage);

      // Execute each tool call and collect results
      const toolResults: Array<{ tool_call_id: string; role: string; content: string }> = [];
      for (const toolCall of toolCalls) {
        try {
          // Validate tool call structure
          if (!toolCall.id) {
            throw new Error('Tool call missing required id field');
          }
          if (!toolCall.function?.name) {
            throw new Error('Tool call missing required function name');
          }
          if (!toolCall.function.arguments) {
            console.warn(`⚠️ Streaming tool call ${toolCall.function.name} has no arguments, using empty object`);
            toolCall.function.arguments = '{}';
          }

          console.log(`🔧 Executing LMStudio streaming tool call:`, toolCall);
          const toolResult = await this.executeMCPTool(
            toolCall.function.name,
            JSON.parse(toolCall.function.arguments)
          );
          console.log(`✅ LMStudio streaming tool result for ${toolCall.function?.name || 'unknown'}:`, toolResult);
          const toolResultMessage = {
            tool_call_id: toolCall.id,
            role: 'tool',
            content: JSON.stringify(toolResult)
          } as { tool_call_id: string; role: string; content: string };
          toolResults.push(toolResultMessage);
          console.log(`📝 Added tool result to conversation history:`, { tool_call_id: toolCall.id, contentLength: toolResultMessage.content.length });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(`❌ LMStudio streaming tool call failed for ${toolCall.function?.name || 'unknown'}:`, errorMessage);

          // Provide structured error response for the LLM
          const errorResponse = {
            error: true,
            tool_name: toolCall.function?.name || 'unknown',
            error_message: errorMessage,
            error_type: error instanceof Error ? error.constructor.name : 'UnknownError'
          };

          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: JSON.stringify(errorResponse)
          } as { tool_call_id: string; role: string; content: string });
        }
      }

      // Build conversation history with tool calls and results
      const userMessage = typeof originalMessage === 'string' ? originalMessage :
        (typeof originalMessage === 'object' && 'text' in originalMessage) ? originalMessage.text : JSON.stringify(originalMessage);

      const toolConversationHistory = [
        ...conversationHistory,
        { role: 'user', content: userMessage },
        {
          role: 'assistant',
          tool_calls: toolCalls
            .filter(tc => tc.id && tc.function?.name)
            .map((tc: any) => ({
              id: tc.id,
              type: tc.type || 'function',
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments
              }
            }))
        },
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
        // Explicitly exclude tools from second call - LLM should provide final response
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
        console.error(`❌ LMStudio second streaming call failed (${secondResponse.status}):`, error);

        // Provide more specific error messages for common issues
        if (secondResponse.status === 400 && error.includes('tool')) {
          throw new Error(`LM Studio streaming tool processing error: The model may not support the tool call format. Try a different model or check tool definitions. Error: ${error}`);
        }
        if (secondResponse.status === 400 && error.includes('context')) {
          throw new Error(`LM Studio streaming context error: Tool results may be too large for the model's context window. Try reducing tool output size. Error: ${error}`);
        }

        throw new Error(`LM Studio second streaming call error (${secondResponse.status}): ${error}`);
      }

      // Format tool execution results for UI display (like Anthropic)
      const toolExecutionResults = toolCalls
        .filter(tc => tc.id && tc.function?.name)
        .map(tc => ({
          id: tc.id!,
          name: tc.function!.name!,
          result: JSON.stringify(toolResults.find(tr => tr.tool_call_id === tc.id)?.content || 'No result'),
          success: true,
          executionTime: 100 // Estimated
        }));

      const toolExecutionSummary = this.summarizeToolResultsForModel(toolExecutionResults);

      // Stream the tool execution summary first
      onStream(toolExecutionSummary);

      // Stream the final response
      const finalResult = await this.handleStreamResponse(secondResponse, onStream);

      const finalResponse = {
        content: fullContent + toolExecutionSummary + finalResult.content,
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

export { LLMService };
export const llmService = new LLMService();
