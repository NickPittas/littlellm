// Replicate provider implementation

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

import { REPLICATE_SYSTEM_PROMPT, generateReplicateToolPrompt } from './prompts/replicate';
import { PricingService } from '../pricingService';

export class ReplicateProvider extends BaseProvider {
  readonly id = 'replicate';
  readonly name = 'Replicate';
  readonly capabilities: ProviderCapabilities = {
    supportsVision: true,
    supportsTools: false, // Replicate doesn't have native tool calling
    supportsStreaming: true, // Replicate supports streaming via webhooks
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'custom'
  };

  /* eslint-disable @typescript-eslint/no-unused-vars */
  async sendMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<ContentItem>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal,
    _conversationId?: string
  ): Promise<LLMResponse> {
    /* eslint-enable @typescript-eslint/no-unused-vars */
    // Replicate has a different API structure
    let prompt = '';

    // Build prompt from conversation history and current message
    const systemPrompt = settings.systemPrompt || this.getSystemPrompt();
    if (systemPrompt) {
      prompt += `System: ${systemPrompt}\n\n`;
    }

    // Add conversation history
    for (const msg of conversationHistory) {
      const role = msg.role === 'assistant' ? 'Assistant' : 'User';
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
      prompt += `${role}: ${content}\n\n`;
    }

    // Add current message
    const currentContent = typeof message === 'string' ? message : JSON.stringify(message);
    prompt += `User: ${currentContent}\n\nAssistant:`;

    const requestBody = {
      input: {
        prompt: prompt,
        max_new_tokens: settings.maxTokens,
        temperature: settings.temperature,
        top_p: 0.9,
        top_k: 50,
        stop_sequences: "<|endoftext|>,<|im_end|>"
      }
    };

    const response = await fetch(`${provider.baseUrl}/predictions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Token ${settings.apiKey}`
      },
      body: JSON.stringify({
        version: settings.model,
        input: requestBody.input
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Replicate API error: ${error}`);
    }

    const data = await response.json();
    
    // Replicate returns a prediction object, we need to poll for completion
    if (data.status === 'starting' || data.status === 'processing') {
      // For simplicity, we'll wait for completion
      const completedData = await this.pollForCompletion(data.urls.get, settings.apiKey, signal);
      return this.parseReplicateResponse(completedData, prompt, settings);
    }

    return this.parseReplicateResponse(data, prompt, settings);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async fetchModels(apiKey: string): Promise<string[]> {
    if (!apiKey) {

      throw new Error('Replicate API key is required to fetch available models. Please add your API key in settings.');
    }

    // Replicate doesn't have a simple models endpoint like other providers
    // Users need to specify the exact model version hash they want to use
    throw new Error('Replicate requires specific model version hashes. Please specify the exact model version in the model field (e.g., "meta/llama-2-70b-chat:02e509c789964a7ea8736978a43525956ef40397be9033abf9fd2badfe68c9e3").');
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  formatTools(_tools: ToolObject[]): unknown[] {
    // Replicate doesn't support tools in the same way
    return [];
  }

  getSystemPrompt(): string {
    return REPLICATE_SYSTEM_PROMPT;
  }

  enhanceSystemPromptWithTools(basePrompt: string, tools: ToolObject[]): string {
    if (tools.length === 0) {
      return basePrompt;
    }

    const toolInstructions = generateReplicateToolPrompt(tools);
    return basePrompt + toolInstructions;
  }

  // Private helper methods
  private async pollForCompletion(getUrl: string, apiKey: string, signal?: AbortSignal): Promise<{status: string, output?: unknown}> {
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      
      const response = await fetch(getUrl, {
        headers: {
          'Authorization': `Token ${apiKey}`
        },
        signal
      });

      if (!response.ok) {
        throw new Error(`Failed to poll Replicate prediction: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.status === 'succeeded') {
        return data;
      } else if (data.status === 'failed') {
        throw new Error(`Replicate prediction failed: ${data.error}`);
      }
      
      attempts++;
    }
    
    throw new Error('Replicate prediction timed out');
  }

  private parseReplicateResponse(data: {output?: unknown}, prompt: string, settings: LLMSettings): LLMResponse {
    let content = '';
    
    if (data.output) {
      if (Array.isArray(data.output)) {
        content = data.output.join('');
      } else if (typeof data.output === 'string') {
        content = data.output;
      } else {
        content = JSON.stringify(data.output);
      }
    }

    // Estimate token usage
    const usage = this.createEstimatedUsage(prompt, content, 'Replicate estimated');
    const { usage: usageInfo, cost } = this.createUsageAndCost(settings.model, usage);

    return {
      content,
      usage: usageInfo,
      cost
    };
  }

  /**
   * Create usage and cost information from Replicate API response
   */
  private createUsageAndCost(model: string, usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }) {
    if (!usage) return { usage: undefined, cost: undefined };

    const usageInfo = {
      promptTokens: usage.promptTokens || 0,
      completionTokens: usage.completionTokens || 0,
      totalTokens: usage.totalTokens || 0
    };

    const costInfo = PricingService.calculateCost('replicate', model, usageInfo.promptTokens, usageInfo.completionTokens);

    return { usage: usageInfo, cost: costInfo };
  }
}
