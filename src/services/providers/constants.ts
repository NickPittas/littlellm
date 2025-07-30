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
    id: 'deepinfra',
    name: 'Deepinfra',
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    requiresApiKey: true,
    models: [], // Will be fetched dynamically
    logo: '/assets/providers/deepinfra.png',
    logoLight: '/assets/providers/deepinfra-light.png'
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

// FALLBACK_MODELS removed - providers now properly throw errors instead of masking failures

// Provider capabilities mapping
export const PROVIDER_CAPABILITIES = {
  openai: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: 64,
    toolFormat: 'openai' as const,
    nativeDocumentSupport: ['pdf', 'txt', 'md'], // Via Assistants API
    documentParsingRequired: ['docx', 'doc', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'csv', 'json', 'html', 'htm', 'xml', 'ics', 'rtf']
  },
  anthropic: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: 64,
    toolFormat: 'anthropic' as const,
    nativeDocumentSupport: ['pdf', 'txt', 'md', 'csv'], // Native document API
    documentParsingRequired: ['docx', 'doc', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'json', 'html', 'htm', 'xml', 'ics', 'rtf']
  },
  gemini: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'gemini' as const,
    nativeDocumentSupport: ['pdf', 'txt'], // Limited native support
    documentParsingRequired: ['docx', 'doc', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'csv', 'json', 'html', 'htm', 'xml', 'ics', 'rtf', 'md']
  },
  mistral: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: 64,
    toolFormat: 'openai' as const,
    nativeDocumentSupport: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'ppt', 'txt', 'md', 'csv', 'json'], // Comprehensive native support
    documentParsingRequired: ['ods', 'html', 'htm', 'xml', 'ics', 'rtf']
  },
  deepseek: {
    supportsVision: false,
    supportsTools: false,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'openai' as const,
    nativeDocumentSupport: [], // No native document support
    documentParsingRequired: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'csv', 'json', 'html', 'htm', 'xml', 'ics', 'rtf', 'txt', 'md']
  },
  deepinfra: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: 64,
    toolFormat: 'openai' as const,
    nativeDocumentSupport: ['txt', 'md'], // Basic text support
    documentParsingRequired: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'csv', 'json', 'html', 'htm', 'xml', 'ics', 'rtf']
  },
  lmstudio: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'openai' as const,
    nativeDocumentSupport: ['txt', 'md'], // Basic text support
    documentParsingRequired: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'csv', 'json', 'html', 'htm', 'xml', 'ics', 'rtf']
  },
  ollama: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'openai' as const,
    nativeDocumentSupport: ['txt', 'md'], // Basic text support
    documentParsingRequired: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'csv', 'json', 'html', 'htm', 'xml', 'ics', 'rtf']
  },
  openrouter: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: 64,
    toolFormat: 'openai' as const,
    nativeDocumentSupport: ['txt', 'md'], // Depends on underlying model
    documentParsingRequired: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'csv', 'json', 'html', 'htm', 'xml', 'ics', 'rtf']
  },
  requesty: {
    supportsVision: true,
    supportsTools: true,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: 64,
    toolFormat: 'openai' as const,
    nativeDocumentSupport: ['txt', 'md'], // Depends on underlying model
    documentParsingRequired: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'csv', 'json', 'html', 'htm', 'xml', 'ics', 'rtf']
  },
  replicate: {
    supportsVision: false,
    supportsTools: false,
    supportsStreaming: false,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'custom' as const,
    nativeDocumentSupport: [], // No native document support
    documentParsingRequired: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'csv', 'json', 'html', 'htm', 'xml', 'ics', 'rtf', 'txt', 'md']
  },
  n8n: {
    supportsVision: false,
    supportsTools: false,
    supportsStreaming: true,
    supportsSystemMessages: true,
    maxToolNameLength: undefined,
    toolFormat: 'custom' as const,
    nativeDocumentSupport: [], // No native document support
    documentParsingRequired: ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'ods', 'pptx', 'ppt', 'csv', 'json', 'html', 'htm', 'xml', 'ics', 'rtf', 'txt', 'md']
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
