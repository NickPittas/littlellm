// Shared constants for LLM providers

import { LLMProvider } from './types';

export const DEFAULT_PROVIDERS: LLMProvider[] = [
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
export const FALLBACK_MODELS: Record<string, string[]> = {
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
    // Vision-capable models (multimodal)
    'mistral-medium-latest',      // Mistral Medium 3 (multimodal)
    'pixtral-large-latest',       // Pixtral Large (vision)
    'pixtral-12b-2409',          // Pixtral 12B (vision)
    'mistral-small-2503',        // Mistral Small 3.1 (vision)

    // Text-only models
    'mistral-large-latest',       // Mistral Large 2.1
    'mistral-small-latest',       // Mistral Small 3.2
    'magistral-medium-latest',    // Magistral Medium (reasoning)
    'magistral-small-latest',     // Magistral Small (reasoning)
    'codestral-latest',          // Codestral 2 (coding)
    'devstral-medium-latest',    // Devstral Medium (development)
    'devstral-small-latest',     // Devstral Small (development)
    'ministral-8b-latest',       // Ministral 8B (edge)
    'ministral-3b-latest',       // Ministral 3B (edge)
    'open-mistral-nemo',         // Mistral Nemo 12B
    'open-codestral-mamba'       // Codestral Mamba
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

// Provider capabilities mapping
export const PROVIDER_CAPABILITIES = {
  openai: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: 64,
    toolFormat: 'openai' as const
  },
  anthropic: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: 64,
    toolFormat: 'anthropic' as const
  },
  gemini: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'gemini' as const
  },
  mistral: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: 64,
    toolFormat: 'openai' as const
  },
  deepseek: {
    supportsVision: false,
    supportsTools: false,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'openai' as const
  },
  lmstudio: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'openai' as const
  },
  ollama: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'openai' as const
  },
  openrouter: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: 64,
    toolFormat: 'openai' as const
  },
  requesty: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: 64,
    toolFormat: 'openai' as const
  },
  replicate: {
    supportsVision: false,
    supportsTools: false,
    supportsStreaming: false,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'custom' as const
  },
  n8n: {
    supportsVision: false,
    supportsTools: false,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'custom' as const
  }
};

// Common HTTP headers
export const COMMON_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent': 'LittleLLM/1.0'
};

// Default settings
export const DEFAULT_SETTINGS = {
  temperature: 0.7,
  maxTokens: 4000,
  toolCallingEnabled: true
};

// Cache duration for model lists (5 minutes)
export const MODEL_CACHE_DURATION = 5 * 60 * 1000;
