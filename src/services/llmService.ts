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
}

export type MessageContent = string | Array<any> | { text: string; images: string[] };

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



// No fallback models - force users to configure providers properly
const FALLBACK_MODELS: Record<string, string[]> = {
  openai: [],
  anthropic: [],
  gemini: [],
  mistral: [],
  deepseek: [],
  lmstudio: [],
  ollama: [],
  openrouter: [],
  requesty: [],
  replicate: [],
  n8n: []
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
        case 'anthropic':
          models = await this.fetchAnthropicModels(apiKey);
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
    if (!baseUrl) {
      return FALLBACK_MODELS.ollama;
    }
    const url = baseUrl;

    try {
      const response = await fetch(`${url}/api/tags`);

      if (!response.ok) {
        throw new Error(`Ollama API error: ${response.status}`);
      }

      const data = await response.json();
      const models = data.models?.map((model: any) => model.name) || [];

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

  private async fetchAnthropicModels(apiKey?: string): Promise<string[]> {
    if (!apiKey) {
      console.log('No Anthropic API key provided, using fallback models');
      return FALLBACK_MODELS.anthropic;
    }

    try {
      // Fetch models from Anthropic's models API endpoint
      const response = await fetch('https://api.anthropic.com/v1/models', {
        method: 'GET',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      });

      if (!response.ok) {
        console.warn('Failed to fetch Anthropic models, API response not ok:', response.status);
        return FALLBACK_MODELS.anthropic;
      }

      const data = await response.json();

      if (data.data && Array.isArray(data.data)) {
        // Extract model IDs from the response
        const models = data.data.map((model: any) => model.id);
        console.log('Successfully fetched Anthropic models:', models);
        return models;
      } else {
        console.warn('Unexpected Anthropic models API response format');
        return FALLBACK_MODELS.anthropic;
      }
    } catch (error) {
      console.warn('Failed to fetch Anthropic models, using fallback:', error);
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

      const data = await response.json();
      const models = data.models
        ?.filter((model: any) => model.name.includes('gemini') && model.supportedGenerationMethods?.includes('generateContent'))
        ?.map((model: any) => model.name.replace('models/', ''))
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

      const data = await response.json();
      console.log('Mistral API response:', data);

      // Mistral API returns models in data array with id field
      const models = data.data?.map((model: any) => model.id)?.sort() || [];

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

      const data = await response.json();
      const models = data.data?.map((model: any) => model.id)?.sort() || [];

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

      const data = await response.json();
      const models = data.data?.map((model: any) => model.id)?.sort() || [];

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
    } catch (error) {
      return null;
    }
  }

  async sendMessage(
    message: MessageContent,
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
        return this.sendReplicateMessage(message, settings, provider, conversationHistory, onStream, signal);
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
    conversationHistory: Array<{role: string, content: string | Array<any>}> = [],
    onStream?: (chunk: string) => void,
    _signal?: AbortSignal
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

  private async sendAnthropicMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<any>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const messages = [];

    // Add conversation history
    messages.push(...conversationHistory);

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

    const response = await fetch(`${provider.baseUrl}/messages`, {
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
        stream: !!onStream
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    if (onStream) {
      return this.handleAnthropicStreamResponse(response, onStream);
    } else {
      const data = await response.json();
      return {
        content: data.content[0].text,
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens
        } : undefined
      };
    }
  }

  private async sendGeminiMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<any>}> = [],
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
      const parts = [{ text: messageWithImages.text }];

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
        } as any);
      }
      contents.push({ role: 'user', parts });
    }

    const endpoint = onStream ? 'streamGenerateContent?alt=sse' : 'generateContent';
    const url = `${provider.baseUrl}/models/${settings.model}:${endpoint}${onStream ? '' : '?key=' + settings.apiKey}`;

    const requestBody: any = {
      contents,
      generationConfig: {
        temperature: settings.temperature,
        maxOutputTokens: settings.maxTokens
      }
    };

    if (settings.systemPrompt) {
      requestBody.system_instruction = {
        parts: [{ text: settings.systemPrompt }]
      };
    }

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

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    if (onStream) {
      return this.handleGeminiStreamResponse(response, onStream);
    } else {
      const data = await response.json();
      return {
        content: data.candidates[0].content.parts[0].text,
        usage: data.usageMetadata ? {
          promptTokens: data.usageMetadata.promptTokenCount,
          completionTokens: data.usageMetadata.candidatesTokenCount,
          totalTokens: data.usageMetadata.totalTokenCount
        } : undefined
      };
    }
  }

  private async sendMistralMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<any>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    // Mistral uses OpenAI-compatible API
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
      const content = [{ type: 'text', text: messageWithImages.text }];

      for (const imageUrl of messageWithImages.images) {
        content.push({
          type: 'image_url',
          image_url: { url: imageUrl }
        } as any);
      }
      messages.push({ role: 'user', content });
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: messages,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        stream: !!onStream
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Mistral API error: ${error}`);
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

  private async sendDeepSeekMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<any>}> = [],
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
      const content = [{ type: 'text', text: messageWithImages.text }];

      for (const imageUrl of messageWithImages.images) {
        content.push({
          type: 'image_url',
          image_url: { url: imageUrl }
        } as any);
      }
      messages.push({ role: 'user', content });
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: messages,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        stream: !!onStream
      }),
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
      return {
        content: data.choices[0].message.content,
        usage: data.usage
      };
    }
  }

  private async sendLMStudioMessage(
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<any>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    // LM Studio uses OpenAI-compatible API
    const baseUrl = settings.baseUrl || provider.baseUrl;
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
      const content = [{ type: 'text', text: messageWithImages.text }];

      for (const imageUrl of messageWithImages.images) {
        content.push({
          type: 'image_url',
          image_url: { url: imageUrl }
        } as any);
      }
      messages.push({ role: 'user', content });
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey || 'not-needed'}`
      },
      body: JSON.stringify({
        model: settings.model,
        messages: messages,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        stream: !!onStream
      }),
      signal
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LM Studio API error: ${error}`);
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
    message: MessageContent,
    settings: LLMSettings,
    provider: LLMProvider,
    conversationHistory: Array<{role: string, content: string | Array<any>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    const baseUrl = settings.baseUrl || provider.baseUrl;

    // Check if this is a vision model request (has images)
    const hasImages = typeof message === 'object' && !Array.isArray(message) && 'images' in message && message.images && message.images.length > 0;

    if (hasImages) {
      // Use Ollama's chat API for vision models (correct format)
      const messages = [];

      if (settings.systemPrompt) {
        messages.push({ role: 'system', content: settings.systemPrompt });
      }

      // Add conversation history
      messages.push(...conversationHistory);

      // Add current message with images in the correct Ollama format
      const messageWithImages = message as { text: string; images: string[] };
      messages.push({
        role: 'user',
        content: messageWithImages.text,
        images: messageWithImages.images // Array of base64 encoded images
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
    message: MessageContent,
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
    message: MessageContent,
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
    message: MessageContent,
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

    // Add current message (handle string, array, and object formats)
    let messageText: string;
    if (typeof message === 'string') {
      messageText = message;
    } else if (Array.isArray(message)) {
      messageText = message.map((item: any) => item.type === 'text' ? item.text : '[Image]').join(' ');
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
    conversationHistory: Array<{role: string, content: string | Array<any>}> = [],
    onStream?: (chunk: string) => void,
    signal?: AbortSignal
  ): Promise<LLMResponse> {
    // For n8n, the baseUrl should be the webhook URL from settings
    const webhookUrl = settings.baseUrl;

    if (!webhookUrl) {
      throw new Error('n8n webhook URL is required. Please configure it in the provider settings.');
    }

    // Prepare the payload for n8n webhook
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
      // n8n webhook expects GET request with query parameters
      const url = new URL(webhookUrl);
      url.searchParams.append('message', messageText);
      url.searchParams.append('conversationHistory', JSON.stringify(conversationHistory));
      url.searchParams.append('settings', JSON.stringify(payload.settings));
      url.searchParams.append('timestamp', payload.timestamp);

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`n8n webhook error: ${response.status} - ${error}`);
      }

      // Handle response - n8n webhooks might return empty responses
      let data = null;
      let content = '';

      const responseText = await response.text();
      if (responseText.trim()) {
        try {
          data = JSON.parse(responseText);

          // Handle different response formats from n8n
          if (typeof data === 'string') {
            content = data;
          } else if (data.output) {
            // n8n workflow returns content in 'output' field
            content = data.output;
          } else if (data.response) {
            content = data.response;
          } else if (data.message) {
            content = data.message;
          } else if (data.content) {
            content = data.content;
          } else {
            content = JSON.stringify(data);
          }
        } catch (parseError) {
          // If JSON parsing fails, use the raw text
          content = responseText;
        }
      } else {
        // Empty response - webhook processed successfully
        content = 'Message sent to n8n workflow successfully.';
      }

      return {
        content: content,
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

  private async handleAnthropicStreamResponse(
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

              // Handle content_block_delta events with text_delta
              if (parsed.type === 'content_block_delta' &&
                  parsed.delta?.type === 'text_delta' &&
                  parsed.delta?.text) {
                const content = parsed.delta.text;
                fullContent += content;
                onStream(content);
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { content: fullContent };
  }

  private async handleGeminiStreamResponse(
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
              if (parsed.candidates && parsed.candidates[0]?.content?.parts) {
                const content = parsed.candidates[0].content.parts[0]?.text || '';
                if (content) {
                  fullContent += content;
                  onStream(content);
                }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    return { content: fullContent };
  }
}

export const llmService = new LLMService();
