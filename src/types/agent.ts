// Agent system type definitions for LittleLLM

export interface AgentTool {
  name: string;
  description: string;
  category: 'internal' | 'mcp' | 'memory' | 'web' | 'file' | 'system';
  serverId?: string; // For MCP tools
  enabled: boolean;
  inputSchema?: Record<string, unknown>;
}

export interface AgentConfiguration {
  id: string;
  name: string;
  description: string;
  icon?: string; // Icon identifier or emoji
  
  // LLM Configuration
  defaultProvider: string;
  defaultModel: string;
  
  // System Prompt
  systemPrompt: string;
  generatedPrompt?: string; // The AI-generated specialized prompt
  userDescription?: string; // Original user description used for generation
  
  // Tool Configuration
  selectedTools: AgentTool[];
  toolCallingEnabled: boolean;
  
  // MCP Configuration
  enabledMCPServers: string[]; // Server IDs to enable for this agent
  
  // Runtime Settings
  temperature?: number;
  maxTokens?: number;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  version: string;
  tags?: string[];
  isTemplate?: boolean; // For predefined templates
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'document' | 'web' | 'development' | 'research' | 'general';
  
  // Template configuration
  suggestedTools: string[]; // Tool names to pre-select
  suggestedMCPServers: string[]; // MCP server IDs to pre-enable
  promptTemplate: string; // Template for generating the system prompt
  
  // Default settings
  defaultProvider?: string;
  defaultModel?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface AgentData {
  agents: AgentConfiguration[];
  templates: AgentTemplate[];
  version: string;
  lastUpdated: string;
}

export interface CreateAgentRequest {
  name: string;
  description: string;
  icon?: string;
  userDescription: string; // Natural language description for prompt generation
  selectedTools: string[]; // Tool names
  enabledMCPServers: string[]; // Server IDs
  defaultProvider: string;
  defaultModel: string;
  temperature?: number;
  maxTokens?: number;
  tags?: string[];
}

export interface UpdateAgentRequest {
  id: string;
  name?: string;
  description?: string;
  icon?: string;
  userDescription?: string;
  selectedTools?: string[];
  enabledMCPServers?: string[];
  defaultProvider?: string;
  defaultModel?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tags?: string[];
}

export interface AgentRuntimeConfig {
  agent: AgentConfiguration;
  availableTools: AgentTool[];
  connectedMCPServers: string[];
  providerModels: Record<string, string[]>;
}

// Agent execution context for chat sessions
export interface AgentChatContext {
  agentId: string;
  agentName: string;
  systemPrompt: string;
  enabledTools: string[];
  enabledMCPServers: string[];
  provider: string;
  model: string;
  temperature: number;
  maxTokens: number;
  toolCallingEnabled: boolean;
}

// Agent import/export format
export interface AgentExport {
  agent: Omit<AgentConfiguration, 'id' | 'createdAt' | 'updatedAt'>;
  exportedAt: string;
  exportVersion: string;
  requiredTools: string[];
  requiredMCPServers: string[];
}

export interface AgentImportResult {
  success: boolean;
  agentId?: string;
  warnings?: string[];
  errors?: string[];
  missingTools?: string[];
  missingMCPServers?: string[];
}

// Prompt generation request/response
export interface PromptGenerationRequest {
  userDescription: string;
  selectedTools: AgentTool[];
  agentName: string;
  agentDescription: string;
  provider: string;
  model: string;
}

export interface PromptGenerationResponse {
  success: boolean;
  generatedPrompt?: string;
  error?: string;
  tokensUsed?: number;
}

// Agent statistics and analytics
export interface AgentUsageStats {
  agentId: string;
  totalChats: number;
  totalMessages: number;
  totalToolCalls: number;
  lastUsed: Date;
  averageResponseTime?: number;
  mostUsedTools: Array<{ toolName: string; count: number }>;
}

// Agent validation results
export interface AgentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  missingDependencies: {
    providers: string[];
    models: string[];
    tools: string[];
    mcpServers: string[];
  };
}

// Default agent templates
export const DEFAULT_AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'document-analyst',
    name: 'Document Analyst',
    description: 'Specialized for analyzing, summarizing, and extracting insights from documents',
    icon: '📄',
    category: 'document',
    suggestedTools: ['file-read', 'pdf-parse', 'document-search', 'knowledge-base-search'],
    suggestedMCPServers: [],
    promptTemplate: 'You are a specialized document analysis agent. Your primary role is to help users analyze, summarize, and extract insights from various types of documents including PDFs, Word documents, spreadsheets, and text files.',
    defaultProvider: 'anthropic',
    defaultModel: 'claude-3-sonnet-20240229',
    temperature: 0.3,
    maxTokens: 4000
  },
  {
    id: 'web-researcher',
    name: 'Web Researcher',
    description: 'Expert at web browsing, searching, and gathering information from online sources',
    icon: '🌐',
    category: 'web',
    suggestedTools: ['web-search', 'web-browse', 'url-fetch'],
    suggestedMCPServers: ['web-search', 'browser-automation'],
    promptTemplate: 'You are a specialized web research agent. Your expertise lies in efficiently searching the web, browsing websites, and gathering comprehensive information from online sources.',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4-turbo-preview',
    temperature: 0.4,
    maxTokens: 4000
  },
  {
    id: 'code-assistant',
    name: 'Code Assistant',
    description: 'Specialized for software development, code review, and programming assistance',
    icon: '💻',
    category: 'development',
    suggestedTools: ['file-read', 'file-write', 'code-execute', 'git-operations'],
    suggestedMCPServers: ['github', 'filesystem'],
    promptTemplate: 'You are a specialized software development agent. Your role is to assist with coding tasks, code review, debugging, and providing programming guidance across multiple languages and frameworks.',
    defaultProvider: 'anthropic',
    defaultModel: 'claude-3-sonnet-20240229',
    temperature: 0.2,
    maxTokens: 6000
  },
  {
    id: 'data-analyst',
    name: 'Data Analyst',
    description: 'Expert at analyzing data, creating visualizations, and generating insights',
    icon: '📊',
    category: 'research',
    suggestedTools: ['file-read', 'csv-parse', 'data-visualization', 'statistical-analysis'],
    suggestedMCPServers: [],
    promptTemplate: 'You are a specialized data analysis agent. Your expertise includes statistical analysis, data visualization, pattern recognition, and generating actionable insights from datasets.',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4-turbo-preview',
    temperature: 0.3,
    maxTokens: 4000
  },
  {
    id: 'creative-writer',
    name: 'Creative Writer',
    description: 'Specialized in creative writing, storytelling, and content creation',
    icon: '✍️',
    category: 'general',
    suggestedTools: ['file-write', 'web-search', 'memory-store'],
    suggestedMCPServers: [],
    promptTemplate: 'You are a specialized creative writing agent. Your role is to assist with creative writing projects, storytelling, content creation, and helping users develop their writing skills.',
    defaultProvider: 'anthropic',
    defaultModel: 'claude-3-sonnet-20240229',
    temperature: 0.8,
    maxTokens: 6000
  },
  {
    id: 'business-analyst',
    name: 'Business Analyst',
    description: 'Expert at business analysis, strategy, and market research',
    icon: '📈',
    category: 'research',
    suggestedTools: ['web-search', 'document-search', 'data-visualization', 'memory-store'],
    suggestedMCPServers: ['web-search'],
    promptTemplate: 'You are a specialized business analysis agent. Your expertise includes market research, competitive analysis, business strategy, and financial analysis.',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4-turbo-preview',
    temperature: 0.4,
    maxTokens: 4000
  },
  {
    id: 'technical-writer',
    name: 'Technical Writer',
    description: 'Specialized in creating technical documentation and guides',
    icon: '📝',
    category: 'document',
    suggestedTools: ['file-read', 'file-write', 'web-search', 'code-execute'],
    suggestedMCPServers: ['github'],
    promptTemplate: 'You are a specialized technical writing agent. Your role is to create clear, comprehensive technical documentation, user guides, API documentation, and help users communicate complex technical concepts effectively.',
    defaultProvider: 'anthropic',
    defaultModel: 'claude-3-sonnet-20240229',
    temperature: 0.3,
    maxTokens: 5000
  },
  {
    id: 'customer-support',
    name: 'Customer Support',
    description: 'Expert at providing helpful customer service and support',
    icon: '🎧',
    category: 'general',
    suggestedTools: ['knowledge-base-search', 'memory-recall', 'web-search'],
    suggestedMCPServers: [],
    promptTemplate: 'You are a specialized customer support agent. Your role is to provide helpful, empathetic, and efficient customer service, troubleshoot issues, and ensure customer satisfaction.',
    defaultProvider: 'openai',
    defaultModel: 'gpt-4-turbo-preview',
    temperature: 0.5,
    maxTokens: 3000
  }
];
