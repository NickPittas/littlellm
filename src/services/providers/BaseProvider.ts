// Base provider interface and abstract class for LLM providers

import {
  LLMSettings,
  LLMResponse,
  MessageContent,
  ContentItem,
  LLMProvider,
  ToolObject,
  ProviderCapabilities
} from './types';
import { TokenEstimator } from './utils';
import { debugLogger } from '../debugLogger';

// Interface that all LLM providers must implement
export interface ILLMProvider {
  // Provider identification
  readonly id: string;
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  // Core messaging functionality
  sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse>;

  // Model management
  fetchModels(apiKey: string, baseUrl?: string): Promise<string[]>;

  // Tool management
  formatTools(tools: ToolObject[]): unknown[];
  validateToolCall(toolCall: { id?: string; name: string; arguments: Record<string, unknown> }): { valid: boolean; errors: string[] };
  validateTool(tool: unknown): { valid: boolean; errors: string[] };

  // Prompt management
  getSystemPrompt(): string;
  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string;
}

// Abstract base class providing common functionality
export abstract class BaseProvider implements ILLMProvider {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract readonly capabilities: ProviderCapabilities;

  // Abstract methods that must be implemented by each provider
  abstract sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}>,
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    conversationId?: string
  ): Promise<LLMResponse>;

  abstract fetchModels(apiKey: string, baseUrl?: string): Promise<string[]>;
  abstract formatTools(tools: ToolObject[]): unknown[];
  abstract getSystemPrompt(): string;

  // Common utility methods
  protected estimateTokens(text: string): number {
    return TokenEstimator.estimateTokens(text);
  }

  protected createEstimatedUsage(promptText: string, responseText: string, label = 'estimated') {
    return TokenEstimator.createEstimatedUsage(promptText, responseText, label);
  }

  // Default tool validation (can be overridden)
  validateToolCall(toolCall: { id?: string; name: string; arguments: Record<string, unknown> }): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

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
    }

    return { valid: errors.length === 0, errors };
  }

  // Abstract method for system prompt enhancement with tools
  // Each provider implements their own tool prompt generation
  abstract enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string;



  // Helper method to convert message content to string for processing
  protected messageContentToString(message: MessageContent): string {
    if (typeof message === 'string') {
      return message;
    }
    
    if (Array.isArray(message)) {
      return message.map(item => item.text || '').join(' ');
    }
    
    if (typeof message === 'object' && 'text' in message) {
      return message.text;
    }
    
    return JSON.stringify(message);
  }

  // Helper method to check if content has images
  protected hasImages(message: MessageContent): boolean {
    if (Array.isArray(message)) {
      return message.some(item => item.type === 'image_url');
    }
    
    if (typeof message === 'object' && 'images' in message) {
      return message.images && message.images.length > 0;
    }
    
    return false;
  }
}
