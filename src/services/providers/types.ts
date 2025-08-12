// Shared types and interfaces for LLM providers

import { MemoryContext } from '../memoryContextService';
import { debugLogger } from '../debugLogger';

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
  promptCachingEnabled?: boolean; // Enable prompt caching when supported
  memoryContext?: MemoryContext; // Memory context for provider-specific integration
}

// Type for content array items used in vision API
export interface ContentItem {
  type: 'text' | 'image_url' | 'document' | 'file';
  text?: string;
  image_url?: {
    url: string;
  };
  document?: {
    name?: string;
    media_type?: string;
    data?: string;
  };
  fileName?: string;
  fileContent?: string;
  cache_control?: {
    type: 'ephemeral';
  }; // For prompt caching support (Anthropic/Gemini via OpenRouter)
}

export type MessageContent = string | Array<ContentItem> | { text: string; images: string[] };

// Type for tool call arguments
export type ToolCallArguments = Record<string, unknown>;

// Type for tool call with execution results
export interface ToolCall {
  id: string;
  name: string;
  arguments: ToolCallArguments;
  result?: string;
  error?: boolean;
}

// Type for tool objects
export interface ToolObject {
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
export interface APIResponseData {
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

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    currency: string;
    provider: string;
    model: string;
  };
  toolCalls?: ToolCall[];
}

// Type guards for tool types
export interface MCPTool {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  serverId?: string;
}

export interface MemoryTool {
  type: string;
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export type CombinedTool = MCPTool | MemoryTool;

export function isMCPTool(tool: CombinedTool): tool is MCPTool {
  return 'name' in tool && !('function' in tool);
}

export function isMemoryToolType(tool: CombinedTool): tool is MemoryTool {
  return 'function' in tool && 'type' in tool;
}

// Provider-specific request/response types
export interface OpenAIMessage {
  role: string;
  content: string | Array<ContentItem>;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

export interface AnthropicMessage {
  role: string;
  content: string | Array<{ type: string; text?: string; image?: { source: { type: string; media_type: string; data: string } } }>;
}

export interface GeminiMessage {
  role: string;
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
}

// Common provider configuration
export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  requiresApiKey: boolean;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  maxTokens: number;
  contextWindow: number;
}

// Tool execution result
export interface ToolExecutionResult {
  success: boolean;
  result: unknown;
  error?: string;
}

// Provider capabilities
export interface ProviderCapabilities {
  supportsVision: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  supportsSystemMessages: boolean;
  supportsPromptCaching?: boolean; // Whether provider supports prompt caching
  promptCachingType?: 'automatic' | 'manual' | 'both'; // Type of caching support
  maxToolNameLength?: number;
  toolFormat: 'openai' | 'anthropic' | 'gemini' | 'custom' | 'text' | 'adaptive';
}
