// Pricing service for calculating API costs across different providers
// Prices are in USD per 1M tokens unless otherwise specified

export interface ModelPricing {
  inputPrice: number;  // Price per 1M input tokens
  outputPrice: number; // Price per 1M output tokens
  currency: string;    // Currency (USD)
  lastUpdated: string; // Date when pricing was last updated
}

export interface ProviderPricing {
  [modelName: string]: ModelPricing;
}

export interface CostCalculation {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: string;
  provider: string;
  model: string;
}

// Pricing data for all providers (as of January 2025)
// Note: Prices may change frequently, especially for newer models
export const PROVIDER_PRICING: { [providerId: string]: ProviderPricing } = {
  openai: {
    // GPT-4 models
    'gpt-4': { inputPrice: 30.00, outputPrice: 60.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'gpt-4-turbo': { inputPrice: 10.00, outputPrice: 30.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'gpt-4-turbo-preview': { inputPrice: 10.00, outputPrice: 30.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'gpt-4-1106-preview': { inputPrice: 10.00, outputPrice: 30.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'gpt-4-0125-preview': { inputPrice: 10.00, outputPrice: 30.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'gpt-4-vision-preview': { inputPrice: 10.00, outputPrice: 30.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'gpt-4o': { inputPrice: 5.00, outputPrice: 15.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'gpt-4o-mini': { inputPrice: 0.15, outputPrice: 0.60, currency: 'USD', lastUpdated: '2025-01-01' },
    
    // GPT-3.5 models
    'gpt-3.5-turbo': { inputPrice: 0.50, outputPrice: 1.50, currency: 'USD', lastUpdated: '2025-01-01' },
    'gpt-3.5-turbo-16k': { inputPrice: 3.00, outputPrice: 4.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'gpt-3.5-turbo-1106': { inputPrice: 1.00, outputPrice: 2.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'gpt-3.5-turbo-0125': { inputPrice: 0.50, outputPrice: 1.50, currency: 'USD', lastUpdated: '2025-01-01' },
    
    // O1 models
    'o1-preview': { inputPrice: 15.00, outputPrice: 60.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'o1-mini': { inputPrice: 3.00, outputPrice: 12.00, currency: 'USD', lastUpdated: '2025-01-01' },
  },

  anthropic: {
    // Claude 3.5 models
    'claude-3-5-sonnet-20241022': { inputPrice: 3.00, outputPrice: 15.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'claude-3-5-sonnet-20240620': { inputPrice: 3.00, outputPrice: 15.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'claude-3-5-haiku-20241022': { inputPrice: 1.00, outputPrice: 5.00, currency: 'USD', lastUpdated: '2025-01-01' },
    
    // Claude 3 models
    'claude-3-opus-20240229': { inputPrice: 15.00, outputPrice: 75.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'claude-3-sonnet-20240229': { inputPrice: 3.00, outputPrice: 15.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'claude-3-haiku-20240307': { inputPrice: 0.25, outputPrice: 1.25, currency: 'USD', lastUpdated: '2025-01-01' },
  },

  gemini: {
    // Gemini Pro models
    'gemini-1.5-pro': { inputPrice: 3.50, outputPrice: 10.50, currency: 'USD', lastUpdated: '2025-01-01' },
    'gemini-1.5-pro-latest': { inputPrice: 3.50, outputPrice: 10.50, currency: 'USD', lastUpdated: '2025-01-01' },
    'gemini-1.5-flash': { inputPrice: 0.075, outputPrice: 0.30, currency: 'USD', lastUpdated: '2025-01-01' },
    'gemini-1.5-flash-latest': { inputPrice: 0.075, outputPrice: 0.30, currency: 'USD', lastUpdated: '2025-01-01' },
    'gemini-1.0-pro': { inputPrice: 0.50, outputPrice: 1.50, currency: 'USD', lastUpdated: '2025-01-01' },
    'gemini-pro': { inputPrice: 0.50, outputPrice: 1.50, currency: 'USD', lastUpdated: '2025-01-01' },
    'gemini-pro-vision': { inputPrice: 0.25, outputPrice: 0.50, currency: 'USD', lastUpdated: '2025-01-01' },
  },

  mistral: {
    // Mistral models
    'mistral-large-latest': { inputPrice: 4.00, outputPrice: 12.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'mistral-large-2407': { inputPrice: 4.00, outputPrice: 12.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'mistral-medium-latest': { inputPrice: 2.70, outputPrice: 8.10, currency: 'USD', lastUpdated: '2025-01-01' },
    'mistral-small-latest': { inputPrice: 1.00, outputPrice: 3.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'mistral-small-2402': { inputPrice: 1.00, outputPrice: 3.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'open-mistral-7b': { inputPrice: 0.25, outputPrice: 0.25, currency: 'USD', lastUpdated: '2025-01-01' },
    'open-mixtral-8x7b': { inputPrice: 0.70, outputPrice: 0.70, currency: 'USD', lastUpdated: '2025-01-01' },
    'open-mixtral-8x22b': { inputPrice: 2.00, outputPrice: 6.00, currency: 'USD', lastUpdated: '2025-01-01' },
  },

  deepseek: {
    // DeepSeek models
    'deepseek-chat': { inputPrice: 0.14, outputPrice: 0.28, currency: 'USD', lastUpdated: '2025-01-01' },
    'deepseek-coder': { inputPrice: 0.14, outputPrice: 0.28, currency: 'USD', lastUpdated: '2025-01-01' },
    'deepseek-v2.5': { inputPrice: 0.14, outputPrice: 0.28, currency: 'USD', lastUpdated: '2025-01-01' },
  },

  deepinfra: {
    // DeepInfra models (approximate pricing, varies by model)
    'meta-llama/Meta-Llama-3.1-70B-Instruct': { inputPrice: 0.52, outputPrice: 0.75, currency: 'USD', lastUpdated: '2025-01-01' },
    'meta-llama/Meta-Llama-3.1-8B-Instruct': { inputPrice: 0.055, outputPrice: 0.055, currency: 'USD', lastUpdated: '2025-01-01' },
    'microsoft/WizardLM-2-8x22B': { inputPrice: 0.50, outputPrice: 0.50, currency: 'USD', lastUpdated: '2025-01-01' },
    'mistralai/Mixtral-8x7B-Instruct-v0.1': { inputPrice: 0.24, outputPrice: 0.24, currency: 'USD', lastUpdated: '2025-01-01' },
    'mistralai/Mixtral-8x22B-Instruct-v0.1': { inputPrice: 0.65, outputPrice: 0.65, currency: 'USD', lastUpdated: '2025-01-01' },
  },

  // OpenRouter uses dynamic pricing based on underlying models
  // These are approximate averages
  openrouter: {
    'openai/gpt-4': { inputPrice: 30.00, outputPrice: 60.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'openai/gpt-4-turbo': { inputPrice: 10.00, outputPrice: 30.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'openai/gpt-4o': { inputPrice: 5.00, outputPrice: 15.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'openai/gpt-4o-mini': { inputPrice: 0.15, outputPrice: 0.60, currency: 'USD', lastUpdated: '2025-01-01' },
    'openai/gpt-3.5-turbo': { inputPrice: 0.50, outputPrice: 1.50, currency: 'USD', lastUpdated: '2025-01-01' },
    'anthropic/claude-3.5-sonnet': { inputPrice: 3.00, outputPrice: 15.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'anthropic/claude-3-opus': { inputPrice: 15.00, outputPrice: 75.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'anthropic/claude-3-sonnet': { inputPrice: 3.00, outputPrice: 15.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'anthropic/claude-3-haiku': { inputPrice: 0.25, outputPrice: 1.25, currency: 'USD', lastUpdated: '2025-01-01' },
    'google/gemini-pro-1.5': { inputPrice: 3.50, outputPrice: 10.50, currency: 'USD', lastUpdated: '2025-01-01' },
    'google/gemini-flash-1.5': { inputPrice: 0.075, outputPrice: 0.30, currency: 'USD', lastUpdated: '2025-01-01' },
    'mistralai/mistral-large': { inputPrice: 4.00, outputPrice: 12.00, currency: 'USD', lastUpdated: '2025-01-01' },
    'mistralai/mistral-medium': { inputPrice: 2.70, outputPrice: 8.10, currency: 'USD', lastUpdated: '2025-01-01' },
    'meta-llama/llama-3.1-70b-instruct': { inputPrice: 0.52, outputPrice: 0.75, currency: 'USD', lastUpdated: '2025-01-01' },
    'meta-llama/llama-3.1-8b-instruct': { inputPrice: 0.055, outputPrice: 0.055, currency: 'USD', lastUpdated: '2025-01-01' },
  },

  replicate: {
    // Replicate pricing is typically per-second, but we'll estimate per-token costs
    // These are rough estimates based on typical usage patterns
    'meta/meta-llama-3-70b-instruct': { inputPrice: 0.65, outputPrice: 2.75, currency: 'USD', lastUpdated: '2025-01-01' },
    'meta/meta-llama-3-8b-instruct': { inputPrice: 0.05, outputPrice: 0.25, currency: 'USD', lastUpdated: '2025-01-01' },
    'mistralai/mixtral-8x7b-instruct-v0.1': { inputPrice: 0.30, outputPrice: 1.00, currency: 'USD', lastUpdated: '2025-01-01' },
  },

  // N8N and Requesty pricing depends on the underlying service they're calling
  // We'll use estimated averages
  n8n: {
    'default': { inputPrice: 2.00, outputPrice: 6.00, currency: 'USD', lastUpdated: '2025-01-01' },
  },

  requesty: {
    'default': { inputPrice: 2.00, outputPrice: 6.00, currency: 'USD', lastUpdated: '2025-01-01' },
  },
};

// Default pricing for unknown models
export const DEFAULT_PRICING: ModelPricing = {
  inputPrice: 1.00,
  outputPrice: 3.00,
  currency: 'USD',
  lastUpdated: '2025-01-01'
};

export class PricingService {
  /**
   * Calculate the cost for a given provider, model, and token usage
   */
  static calculateCost(
    provider: string,
    model: string,
    promptTokens: number,
    completionTokens: number
  ): CostCalculation {
    const providerPricing = PROVIDER_PRICING[provider.toLowerCase()];
    let modelPricing: ModelPricing;

    if (providerPricing) {
      // Try exact model match first
      modelPricing = providerPricing[model] || 
                   // Try without version suffix (e.g., gpt-4-1106-preview -> gpt-4)
                   providerPricing[model.split('-').slice(0, 2).join('-')] ||
                   // Try first part only (e.g., gpt-4-turbo -> gpt-4)
                   providerPricing[model.split('-')[0]] ||
                   // Use default for this provider if available
                   providerPricing['default'] ||
                   DEFAULT_PRICING;
    } else {
      modelPricing = DEFAULT_PRICING;
    }

    // Calculate costs (prices are per 1M tokens)
    const inputCost = (promptTokens / 1_000_000) * modelPricing.inputPrice;
    const outputCost = (completionTokens / 1_000_000) * modelPricing.outputPrice;
    const totalCost = inputCost + outputCost;

    return {
      inputCost: Number(inputCost.toFixed(6)),
      outputCost: Number(outputCost.toFixed(6)),
      totalCost: Number(totalCost.toFixed(6)),
      currency: modelPricing.currency,
      provider,
      model
    };
  }

  /**
   * Check if a provider is local (no API costs)
   */
  static isLocalProvider(provider: string): boolean {
    const localProviders = ['ollama', 'lmstudio'];
    return localProviders.includes(provider.toLowerCase());
  }

  /**
   * Format cost for display
   */
  static formatCost(cost: number, currency: string = 'USD'): string {
    if (cost < 0.000001) {
      return `<$0.000001`;
    }
    if (cost < 0.01) {
      return `$${cost.toFixed(6)}`;
    }
    return `$${cost.toFixed(4)}`;
  }

  /**
   * Get pricing information for a specific model
   */
  static getModelPricing(provider: string, model: string): ModelPricing | null {
    const providerPricing = PROVIDER_PRICING[provider.toLowerCase()];
    if (!providerPricing) return null;

    return providerPricing[model] || 
           providerPricing[model.split('-').slice(0, 2).join('-')] ||
           providerPricing[model.split('-')[0]] ||
           providerPricing['default'] ||
           null;
  }

  /**
   * Get all available models for a provider with their pricing
   */
  static getProviderModels(provider: string): { [model: string]: ModelPricing } {
    return PROVIDER_PRICING[provider.toLowerCase()] || {};
  }
}
