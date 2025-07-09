export interface LLMProvider {
  id: string;
  name: string;
  baseUrl: string;
  requiresApiKey: boolean;
  models: string[];
}

export interface LLMSettings {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl?: string;
  temperature: number;
  maxTokens: number;
  systemPrompt?: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

const DEFAULT_PROVIDERS: LLMProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    requiresApiKey: true,
    models: [] // Will be fetched dynamically
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    baseUrl: 'http://localhost:11434',
    requiresApiKey: false,
    models: [] // Will be fetched dynamically
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    requiresApiKey: true,
    models: [] // Will be fetched dynamically
  },
  {
    id: 'requesty',
    name: 'Requesty',
    baseUrl: 'https://router.requesty.ai/v1',
    requiresApiKey: true,
    models: [] // Will be fetched dynamically
  },
  {
    id: 'replicate',
    name: 'Replicate',
    baseUrl: 'https://api.replicate.com/v1',
    requiresApiKey: true,
    models: [] // Will be fetched dynamically
  }
];



// Fallback models in case API calls fail
const FALLBACK_MODELS: Record<string, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'gpt-3.5-turbo-16k'],
  ollama: ['llama2', 'codellama', 'mistral', 'neural-chat', 'starling-lm'],
  openrouter: [
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'openai/gpt-4-turbo',
    'openai/gpt-4',
    'openai/gpt-3.5-turbo',
    'anthropic/claude-3.5-sonnet',
    'anthropic/claude-3-opus',
    'anthropic/claude-3-sonnet',
    'anthropic/claude-3-haiku',
    'google/gemini-pro-1.5',
    'google/gemini-flash-1.5',
    'meta-llama/llama-3.1-405b-instruct',
    'meta-llama/llama-3.1-70b-instruct',
    'meta-llama/llama-3.1-8b-instruct',
    'meta-llama/llama-3-70b-instruct',
    'meta-llama/llama-3-8b-instruct',
    'mistralai/mistral-large',
    'mistralai/mistral-medium',
    'mistralai/mistral-small',
    'mistralai/mistral-7b-instruct:free',
    'mistralai/mixtral-8x7b-instruct',
    'microsoft/wizardlm-2-8x22b',
    'qwen/qwen-2-72b-instruct',
    'deepseek/deepseek-coder',
    'perplexity/llama-3.1-sonar-large-128k-online',
    'perplexity/llama-3.1-sonar-small-128k-online'
  ],
  requesty: [
    // OpenAI Models
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'openai/gpt-4-turbo',
    'openai/gpt-4',
    'openai/gpt-3.5-turbo',
    'openai/gpt-3.5-turbo-16k',
    'openai/o1-preview',
    'openai/o1-mini',

    // Anthropic Models
    'anthropic/claude-3.5-sonnet',
    'anthropic/claude-3-opus',
    'anthropic/claude-3-sonnet',
    'anthropic/claude-3-haiku',
    'anthropic/claude-2.1',
    'anthropic/claude-2',
    'anthropic/claude-instant-1.2',

    // Google Models
    'google/gemini-pro-1.5',
    'google/gemini-flash-1.5',
    'google/gemini-pro',
    'google/gemini-pro-vision',
    'google/palm-2-chat-bison',
    'google/palm-2-codechat-bison',

    // Meta Llama Models
    'meta-llama/llama-3.1-405b-instruct',
    'meta-llama/llama-3.1-70b-instruct',
    'meta-llama/llama-3.1-8b-instruct',
    'meta-llama/llama-3-70b-instruct',
    'meta-llama/llama-3-8b-instruct',
    'meta-llama/llama-2-70b-chat',
    'meta-llama/llama-2-13b-chat',
    'meta-llama/llama-2-7b-chat',
    'meta-llama/codellama-34b-instruct',
    'meta-llama/codellama-13b-instruct',
    'meta-llama/codellama-7b-instruct',

    // Mistral Models
    'mistralai/mistral-large',
    'mistralai/mistral-medium',
    'mistralai/mistral-small',
    'mistralai/mistral-tiny',
    'mistralai/mistral-7b-instruct',
    'mistralai/mixtral-8x7b-instruct',
    'mistralai/mixtral-8x22b-instruct',
    'mistralai/codestral',

    // Cohere Models
    'cohere/command-r-plus',
    'cohere/command-r',
    'cohere/command',
    'cohere/command-light',

    // Perplexity Models
    'perplexity/llama-3.1-sonar-large-128k-online',
    'perplexity/llama-3.1-sonar-small-128k-online',
    'perplexity/llama-3.1-sonar-large-128k-chat',
    'perplexity/llama-3.1-sonar-small-128k-chat',

    // Microsoft Models
    'microsoft/wizardlm-2-8x22b',
    'microsoft/wizardlm-2-70b',
    'microsoft/phi-3-medium-128k-instruct',
    'microsoft/phi-3-mini-128k-instruct',

    // Qwen Models
    'qwen/qwen-2-72b-instruct',
    'qwen/qwen-2-7b-instruct',
    'qwen/qwen-1.5-72b-chat',
    'qwen/qwen-1.5-32b-chat',
    'qwen/qwen-1.5-14b-chat',
    'qwen/qwen-1.5-7b-chat',

    // DeepSeek Models
    'deepseek/deepseek-coder',
    'deepseek/deepseek-chat',
    'deepseek/deepseek-v2-chat',

    // Other Popular Models
    'databricks/dbrx-instruct',
    'nvidia/nemotron-4-340b-instruct',
    '01-ai/yi-large',
    '01-ai/yi-34b-chat',
    'huggingfaceh4/zephyr-7b-beta',
    'teknium/openhermes-2.5-mistral-7b',
    'openchat/openchat-7b',
    'togethercomputer/redpajama-incite-7b-chat',
    'nousresearch/nous-hermes-2-mixtral-8x7b-dpo',
    'nousresearch/nous-hermes-llama2-13b',
    'alpindale/goliath-120b',
    'gryphe/mythomist-7b',
    'undi95/toppy-m-7b'
  ],
  replicate: [
    'meta/llama-2-70b-chat',
    'meta/llama-2-13b-chat',
    'mistralai/mistral-7b-instruct-v0.1'
  ]
};

class LLMService {
  private providers: LLMProvider[] = DEFAULT_PROVIDERS;
  private modelCache: Map<string, { models: string[], timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  getProviders(): LLMProvider[] {
    return this.providers;
  }

  getProvider(id: string): LLMProvider | undefined {
    return this.providers.find(p => p.id === id);
  }

  async fetchModels(providerId: string, apiKey?: string, baseUrl?: string): Promise<string[]> {
    const cacheKey = `${providerId}-${apiKey || 'no-key'}`;
    const cached = this.modelCache.get(cacheKey);

    // Return cached models if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.models;
    }

    try {
      let models: string[] = [];

      switch (providerId) {
        case 'openai':
          models = await this.fetchOpenAIModels(apiKey);
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

      const data = await response.json();
      const models = data.data
        .filter((model: any) => model.id.includes('gpt'))
        .map((model: any) => model.id)
        .sort();

      return models.length > 0 ? models : FALLBACK_MODELS.openai;
    } catch (error) {
      console.warn('Failed to fetch OpenAI models, using fallback:', error);
      return FALLBACK_MODELS.openai;
    }
  }

  private async fetchOllamaModels(baseUrl?: string): Promise<string[]> {
    const url = baseUrl || 'http://localhost:11434';

    try {
      const response = await fetch(`${url}/api/tags`);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      const models = data.models?.map((model: any) => model.name) || [];

      return models.length > 0 ? models : FALLBACK_MODELS.ollama;
    } catch (error) {
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

      const data = await response.json();
      const models = data.data?.map((model: any) => model.id) || [];

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

      const data = await response.json();
      const models = data.data?.map((model: any) => model.id) || [];

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

  async sendMessage(
    message: string | Array<any>,
    settings: LLMSettings,
    conversationHistory: Array<{role: string, content: string | Array<any>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const provider = this.getProvider(settings.provider);
    if (!provider) {
      throw new Error(`Provider ${settings.provider} not found`);
    }

    switch (settings.provider) {
      case 'openai':
        return this.sendOpenAIMessage(message, settings, provider, conversationHistory, onStream, signal);
      case 'ollama':
        return this.sendOllamaMessage(message, settings, provider, conversationHistory, onStream, signal);
      case 'openrouter':
        return this.sendOpenRouterMessage(message, settings, provider, conversationHistory, onStream, signal);
      case 'requesty':
        return this.sendRequestyMessage(message, settings, provider, conversationHistory, onStream, signal);
      case 'replicate':
        return this.sendReplicateMessage(message, settings, provider, conversationHistory, onStream, signal);
      default:
        throw new Error(`Provider ${settings.provider} not implemented`);
    }
  }

  private async sendOpenAIMessage(
    message: string | Array<any>,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<any>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const messages = [];

    if (settings.systemPrompt) {
      messages.push({ role: 'system', content: settings.systemPrompt });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Add current message (handle both string and array formats)
    messages.push({ role: 'user', content: message });

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        stream: !!onStream
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    if (onStream) {
      return this.handleStreamResponse(response, onStream);
    } else {
      const data = await response.json();
      return {
        content: data.choices[0].message.content,
        usage: data.usage
      };
    }
  }

  private async sendOllamaMessage(
    message: string | Array<any>,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<any>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const baseUrl = settings.baseUrl || provider.baseUrl;

    // Check if this is a vision model request (has images)
    const hasImages = typeof message === 'object' && message.images && message.images.length > 0;

    if (hasImages) {
      // Use Ollama's chat API for vision models (correct format)
      const messages = [];

      if (settings.systemPrompt) {
        messages.push({ role: 'system', content: settings.systemPrompt });
      }

      // Add conversation history
      messages.push(...conversationHistory);

      // Add current message with images in the correct Ollama format
      messages.push({
        role: 'user',
        content: message.text,
        images: message.images // Array of base64 encoded images
      });

      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: settings.model,
          messages: messages,
          stream: !!onStream,
          options: {
            temperature: settings.temperature,
            num_predict: settings.maxTokens
          }
        }),
        signal
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${error}`);
      }

      if (onStream) {
        return this.handleOllamaChatStreamResponse(response, onStream);
      } else {
        const data = await response.json();
        return {
          content: data.message?.content || data.response
        };
      }
    } else {
      // Use traditional generate API for text-only
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

      // Add current message
      prompt += `User: ${message}\nAssistant:`;

      let response;
      try {
        response = await fetch(`${baseUrl}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: settings.model,
            prompt: prompt,
            stream: !!onStream,
            options: {
              temperature: settings.temperature,
              num_predict: settings.maxTokens
            }
          })
        });
      } catch (error) {
        throw new Error(`Cannot connect to Ollama at ${baseUrl}. Please make sure Ollama is running and accessible.`);
      }

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 0 || error.includes('ECONNREFUSED')) {
        throw new Error(`Ollama is not running. Please start Ollama and try again. Visit https://ollama.ai for installation instructions.`);
      }
      throw new Error(`Ollama API error: ${error}`);
    }

    if (onStream) {
      return this.handleOllamaStreamResponse(response, onStream);
    } else {
      const data = await response.json();
      return {
        content: data.response
      };
    }
    }
  }

  private async sendOpenRouterMessage(
    message: string | Array<any>,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<any>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const messages = [];

    if (settings.systemPrompt) {
      messages.push({ role: 'system', content: settings.systemPrompt });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Handle both string and array content formats for vision support
    messages.push({ role: 'user', content: message });

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
        'HTTP-Referer': 'https://littlellm.app',
        'X-Title': 'LittleLLM'
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        stream: !!onStream
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    if (onStream) {
      return this.handleStreamResponse(response, onStream);
    } else {
      const data = await response.json();
      return {
        content: data.choices[0].message.content,
        usage: data.usage
      };
    }
  }

  private async sendRequestyMessage(
    message: string | Array<any>,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<any>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const messages = [];

    if (settings.systemPrompt) {
      messages.push({ role: 'system', content: settings.systemPrompt });
    }

    // Add conversation history
    messages.push(...conversationHistory);

    // Handle both string and array content formats for vision support
    messages.push({ role: 'user', content: message });

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        stream: !!onStream
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Requesty API error: ${error}`);
    }

    if (onStream) {
      return this.handleStreamResponse(response, onStream);
    } else {
      const data = await response.json();
      return {
        content: data.choices[0]?.message?.content || '',
        usage: data.usage
      };
    }
  }

  private async sendReplicateMessage(
    message: string | Array<any>,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<any>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
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

    // Add current message (handle both string and array formats)
    const messageText = typeof message === 'string' ? message :
      message.map(item => item.type === 'text' ? item.text : '[Image]').join(' ');
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

  private async handleStreamResponse(
    response: Response,
    onStream: (chunk: string) => void
  ): Promise<LLMResponse> {
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    let fullContent = '';
    const decoder = new TextDecoder();

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
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                onStream(content);
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

    return { content: fullContent };
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
          } catch {
            // Ignore parsing errors
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { content: fullContent };
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
            // Chat API returns message.content instead of response
            if (parsed.message?.content) {
              fullContent += parsed.message.content;
              onStream(parsed.message.content);
            }
          } catch {
            // Ignore parsing errors
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { content: fullContent };
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
}

export const llmService = new LLMService();
