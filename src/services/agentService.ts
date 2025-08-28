// Agent management service for LittleLLM
import { 
  AgentConfiguration, 
  AgentData, 
  AgentTemplate, 
  CreateAgentRequest, 
  UpdateAgentRequest,
  AgentExport,
  AgentImportResult,
  AgentValidationResult,
  AgentTool,
  PromptGenerationRequest,
  PromptGenerationResponse,
  DEFAULT_AGENT_TEMPLATES,
  AgentChatContext
} from '../types/agent';
import { KnowledgeBase, ContextResult, RAGOptions } from '../types/knowledgeBase';
import { mcpService } from './mcpService';
import { llmService } from './llmService';
import { secureApiKeyService } from './secureApiKeyService';
import { v4 as uuidv4 } from 'uuid';

// Conditionally import services only in Electron environment
let knowledgeBaseRegistry: {
  listKnowledgeBases: () => Promise<KnowledgeBase[]>;
} | null = null;

let ragService: {
  getRelevantContext: (query: string, kbIds: string[], options: RAGOptions) => Promise<ContextResult[]>;
} | null = null;

if (typeof window !== 'undefined') {
  import('./KnowledgeBaseRegistry').then(module => {
    knowledgeBaseRegistry = module.knowledgeBaseRegistry;
  }).catch(error => {
    console.warn('KnowledgeBaseRegistry not available in browser environment:', error);
  });

  import('./RAGService').then(module => {
    ragService = module.RAGService.getInstance();
  }).catch(error => {
    console.warn('RAGService not available in browser environment:', error);
  });
}

class AgentService {
  private agents: AgentConfiguration[] = [];
  private templates: AgentTemplate[] = [...DEFAULT_AGENT_TEMPLATES];
  private initialized = false;
  private listeners: Array<(agents: AgentConfiguration[]) => void> = [];

  constructor() {
    this.initialize();
  }

  private async initialize() {
    if (this.initialized) return;

    try {
      await this.loadAgents();
      this.initialized = true;
      console.log('✅ Agent service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize agent service:', error);
      this.agents = [];
      this.initialized = true;
    }
  }

  // Load agents from storage
  private async loadAgents() {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.getStateFile) {
        const agentData = await window.electronAPI.getStateFile('agents.json') as AgentData | null;
        
        if (agentData) {
          this.agents = agentData.agents.map(agent => ({
            ...agent,
            createdAt: new Date(agent.createdAt),
            updatedAt: new Date(agent.updatedAt)
          }));
          
          // Merge templates (user templates + defaults)
          if (agentData.templates) {
            this.templates = [...DEFAULT_AGENT_TEMPLATES, ...agentData.templates];
          }
          
          console.log(`📋 Loaded ${this.agents.length} agents from storage`);
        } else {
          console.log('📋 No existing agents found, starting fresh');
        }
      }
    } catch (error) {
      console.error('❌ Failed to load agents:', error);
      throw error;
    }
  }

  // Save agents to storage
  private async saveAgents() {
    try {
      if (typeof window !== 'undefined' && window.electronAPI?.saveStateFile) {
        const agentData: AgentData = {
          agents: this.agents.map(agent => ({
            ...agent,
            createdAt: agent.createdAt,
            updatedAt: agent.updatedAt
          })),
          templates: this.templates.filter(t => !DEFAULT_AGENT_TEMPLATES.find(dt => dt.id === t.id)),
          version: '1.0.0',
          lastUpdated: new Date().toISOString()
        };

        const success = await window.electronAPI.saveStateFile('agents.json', agentData);
        if (success) {
          console.log('✅ Agents saved successfully');
          this.notifyListeners();
        } else {
          console.error('❌ Failed to save agents');
        }
        return success;
      }
      return false;
    } catch (error) {
      console.error('❌ Error saving agents:', error);
      return false;
    }
  }

  // Notify listeners of changes
  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.agents]));
  }

  // Subscribe to agent changes
  subscribe(listener: (agents: AgentConfiguration[]) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  // Get all agents
  async getAgents(): Promise<AgentConfiguration[]> {
    await this.initialize();
    return [...this.agents];
  }

  // Get agent by ID
  async getAgent(id: string): Promise<AgentConfiguration | null> {
    await this.initialize();
    return this.agents.find(agent => agent.id === id) || null;
  }

  // Get all templates
  async getTemplates(): Promise<AgentTemplate[]> {
    return [...this.templates];
  }

  // Get available tools for agent creation
  async getAvailableTools(): Promise<AgentTool[]> {
    const tools: AgentTool[] = [];

    try {
      // Get MCP tools
      const mcpTools = await mcpService.getAvailableTools();
      mcpTools.forEach(tool => {
        tools.push({
          name: tool.name,
          description: tool.description,
          category: 'mcp',
          serverId: tool.serverId,
          enabled: true,
          inputSchema: tool.inputSchema
        });
      });

      // Add internal tools (these would be defined based on your internal command system)
      const internalTools = [
        { name: 'file-read', description: 'Read files from the filesystem', category: 'file' as const },
        { name: 'file-write', description: 'Write files to the filesystem', category: 'file' as const },
        { name: 'web-search', description: 'Search the web for information', category: 'web' as const },
        { name: 'screenshot', description: 'Take screenshots', category: 'system' as const },
        { name: 'memory-store', description: 'Store information in memory', category: 'memory' as const },
        { name: 'memory-recall', description: 'Recall stored memories', category: 'memory' as const }
      ];

      internalTools.forEach(tool => {
        tools.push({
          name: tool.name,
          description: tool.description,
          category: tool.category,
          enabled: true
        });
      });

    } catch (error) {
      console.error('❌ Failed to get available tools:', error);
    }

    return tools;
  }

  // Generate specialized prompt using LLM
  async generatePrompt(request: PromptGenerationRequest): Promise<PromptGenerationResponse> {
    try {
      const metaPrompt = this.createMetaPrompt(request);

      // Get API key from secure storage (same pattern as chatService)
      const apiKeyData = secureApiKeyService?.getApiKeyData(request.provider);
      const apiKey = apiKeyData?.apiKey || '';
      const baseUrl = apiKeyData?.baseUrl || '';

      console.log(`🤖 Agent prompt generation for ${request.provider}:`, {
        hasApiKey: !!apiKey,
        keyLength: apiKey?.length || 0,
        model: request.model
      });

      // Check if API key is required and missing (same logic as chatService)
      if (request.provider !== 'ollama' && request.provider !== 'lmstudio' && request.provider !== 'n8n' && !apiKey) {
        return {
          success: false,
          error: `API key is required for ${request.provider}. Please configure it in Settings.`
        };
      }

      // Use the LLM service to generate the prompt
      const response = await llmService.sendMessage(
        metaPrompt,
        {
          provider: request.provider,
          model: request.model,
          apiKey: apiKey,
          baseUrl: baseUrl,
          temperature: 0.3,
          maxTokens: 2000,
          toolCallingEnabled: false
        },
        [] // Empty conversation history
      );

      if (response.content) {
        return {
          success: true,
          generatedPrompt: response.content,
          tokensUsed: response.usage?.totalTokens
        };
      } else {
        return {
          success: false,
          error: 'No content in LLM response'
        };
      }
    } catch (error) {
      console.error('❌ Error generating prompt:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Create meta-prompt for agent prompt generation
  private createMetaPrompt(request: PromptGenerationRequest): string {
    const toolDescriptions = request.selectedTools
      .map(tool => `- ${tool.name}: ${tool.description}`)
      .join('\n');

    return `You are an expert AI prompt engineer. Your task is to create a specialized system prompt for an AI agent based on the following requirements:

**Agent Name:** ${request.agentName}
**Agent Description:** ${request.agentDescription}
**User's Purpose Description:** ${request.userDescription}

**Available Tools:**
${toolDescriptions}

**Requirements:**
1. Create a comprehensive system prompt that defines the agent's role, expertise, and behavior
2. The prompt should be specific to the agent's intended purpose
3. Include guidance on how to use the available tools effectively
4. Maintain a professional but helpful tone
5. Include any relevant best practices for the agent's domain
6. The prompt should be 200-500 words

**Output Format:**
Provide only the system prompt text, without any additional commentary or formatting.`;
  }

  // Create new agent with knowledge base support
  async createAgent(request: CreateAgentRequest): Promise<string> {
    await this.initialize();

    const agentId = uuidv4();
    const now = new Date();

    // Get available tools and filter selected ones
    const availableTools = await this.getAvailableTools();
    const selectedTools = availableTools.filter(tool => 
      request.selectedTools.includes(tool.name)
    );

    // Validate knowledge base IDs if provided
    const validKBIds = await this.validateKnowledgeBaseIds(request.selectedKnowledgeBases || []);

    // Set default RAG settings if not provided
    const defaultRAGSettings = {
      maxResultsPerKB: 3,
      relevanceThreshold: 0.1,
      contextWindowTokens: 2000,
      aggregationStrategy: 'relevance' as const
    };

    const agent: AgentConfiguration = {
      id: agentId,
      name: request.name,
      description: request.description,
      icon: request.icon || '🤖',
      defaultProvider: request.defaultProvider,
      defaultModel: request.defaultModel,
      systemPrompt: '', // Will be generated
      userDescription: request.userDescription,
      selectedTools,
      toolCallingEnabled: selectedTools.length > 0,
      enabledMCPServers: request.enabledMCPServers,
      // Knowledge Base Configuration
      selectedKnowledgeBases: validKBIds,
      ragEnabled: request.ragEnabled || false,
      ragSettings: request.ragSettings || defaultRAGSettings,
      // Runtime Settings
      temperature: request.temperature || 0.7,
      maxTokens: request.maxTokens || 4000,
      createdAt: now,
      updatedAt: now,
      version: '1.0.0',
      tags: request.tags || []
    };

    this.agents.push(agent);
    await this.saveAgents();

    console.log(`✅ Created agent with KB support: ${agent.name} (${agentId})`);
    return agentId;
  }

  // Update existing agent
  async updateAgent(request: UpdateAgentRequest): Promise<boolean> {
    await this.initialize();

    const agentIndex = this.agents.findIndex(agent => agent.id === request.id);
    if (agentIndex === -1) {
      console.error(`❌ Agent not found: ${request.id}`);
      return false;
    }

    const agent = this.agents[agentIndex];
    const updates: Partial<AgentConfiguration> = {
      updatedAt: new Date()
    };

    // Update fields if provided
    if (request.name !== undefined) updates.name = request.name;
    if (request.description !== undefined) updates.description = request.description;
    if (request.icon !== undefined) updates.icon = request.icon;
    if (request.userDescription !== undefined) updates.userDescription = request.userDescription;
    if (request.defaultProvider !== undefined) updates.defaultProvider = request.defaultProvider;
    if (request.defaultModel !== undefined) updates.defaultModel = request.defaultModel;
    if (request.systemPrompt !== undefined) updates.systemPrompt = request.systemPrompt;
    if (request.temperature !== undefined) updates.temperature = request.temperature;
    if (request.maxTokens !== undefined) updates.maxTokens = request.maxTokens;
    if (request.tags !== undefined) updates.tags = request.tags;
    if (request.enabledMCPServers !== undefined) updates.enabledMCPServers = request.enabledMCPServers;

    // Update selected tools if provided
    if (request.selectedTools !== undefined) {
      const availableTools = await this.getAvailableTools();
      updates.selectedTools = availableTools.filter(tool => 
        request.selectedTools!.includes(tool.name)
      );
      updates.toolCallingEnabled = updates.selectedTools.length > 0;
    }

    // Update knowledge base configuration if provided
    if (request.selectedKnowledgeBases !== undefined) {
      const validKBIds = await this.validateKnowledgeBaseIds(request.selectedKnowledgeBases);
      updates.selectedKnowledgeBases = validKBIds;
    }
    if (request.ragEnabled !== undefined) updates.ragEnabled = request.ragEnabled;
    if (request.ragSettings !== undefined) updates.ragSettings = request.ragSettings;

    this.agents[agentIndex] = { ...agent, ...updates };
    await this.saveAgents();

    console.log(`✅ Updated agent: ${agent.name} (${request.id})`);
    return true;
  }

  // ========================================
  // KNOWLEDGE BASE INTEGRATION METHODS
  // ========================================

  /**
   * Gets all available knowledge bases for agent selection
   */
  async getAvailableKnowledgeBases(): Promise<KnowledgeBase[]> {
    try {
      if (!knowledgeBaseRegistry) {
        console.warn('Knowledge base registry not available');
        return [];
      }
      
      return await knowledgeBaseRegistry.listKnowledgeBases();
    } catch (error) {
      console.error('❌ Failed to get available knowledge bases:', error);
      return [];
    }
  }

  /**
   * Updates an agent's knowledge base selection
   */
  async updateAgentKnowledgeBases(
    agentId: string,
    selectedKBIds: string[],
    ragEnabled?: boolean,
    ragSettings?: AgentConfiguration['ragSettings']
  ): Promise<boolean> {
    await this.initialize();

    const agentIndex = this.agents.findIndex(agent => agent.id === agentId);
    if (agentIndex === -1) {
      console.error(`❌ Agent not found: ${agentId}`);
      return false;
    }

    const agent = this.agents[agentIndex];
    
    // Validate knowledge base IDs
    const validKBIds = await this.validateKnowledgeBaseIds(selectedKBIds);

    // Update agent configuration
    this.agents[agentIndex] = {
      ...agent,
      selectedKnowledgeBases: validKBIds,
      ragEnabled: ragEnabled !== undefined ? ragEnabled : agent.ragEnabled,
      ragSettings: ragSettings || agent.ragSettings,
      updatedAt: new Date()
    };

    await this.saveAgents();
    
    console.log(`✅ Updated KB selection for agent: ${agent.name} (${agentId})`);
    return true;
  }

  /**
   * Gets RAG context for an agent based on its knowledge base selection
   */
  async getAgentRAGContext(
    agentId: string,
    query: string
  ): Promise<ContextResult[]> {
    const agent = await this.getAgent(agentId);
    if (!agent || !agent.ragEnabled || agent.selectedKnowledgeBases.length === 0) {
      return [];
    }

    try {
      if (!ragService) {
        console.warn('RAG service not available');
        return [];
      }
      
      // Use agent's RAG settings for search
      const ragOptions: RAGOptions = {
        maxResultsPerKB: agent.ragSettings.maxResultsPerKB,
        relevanceThreshold: agent.ragSettings.relevanceThreshold,
        contextWindowTokens: agent.ragSettings.contextWindowTokens,
        aggregationStrategy: agent.ragSettings.aggregationStrategy,
        includeSourceAttribution: true
      };

      return await ragService.getRelevantContext(query, agent.selectedKnowledgeBases, ragOptions);
    } catch (error) {
      console.error(`❌ Failed to get RAG context for agent ${agentId}:`, error);
      return [];
    }
  }

  /**
   * Gets an agent's chat context including knowledge base configuration
   */
  async getAgentChatContext(agentId: string): Promise<AgentChatContext | null> {
    const agent = await this.getAgent(agentId);
    if (!agent) {
      return null;
    }

    return {
      agentId: agent.id,
      agentName: agent.name,
      systemPrompt: agent.systemPrompt,
      enabledTools: agent.selectedTools.map(t => t.name),
      enabledMCPServers: agent.enabledMCPServers,
      selectedKnowledgeBases: agent.selectedKnowledgeBases,
      ragEnabled: agent.ragEnabled,
      ragSettings: agent.ragSettings,
      provider: agent.defaultProvider,
      model: agent.defaultModel,
      temperature: agent.temperature || 0.7,
      maxTokens: agent.maxTokens || 4000,
      toolCallingEnabled: agent.toolCallingEnabled
    };
  }

  /**
   * Validates that knowledge base IDs exist and are accessible
   */
  private async validateKnowledgeBaseIds(kbIds: string[]): Promise<string[]> {
    if (!kbIds || kbIds.length === 0) {
      return [];
    }

    try {
      if (!knowledgeBaseRegistry) {
        console.warn('Knowledge base registry not available');
        return [];
      }
      
      const availableKBs = await knowledgeBaseRegistry.listKnowledgeBases();
      const availableIds = new Set(availableKBs.map((kb: KnowledgeBase) => kb.id));
      
      return kbIds.filter(id => {
        if (availableIds.has(id)) {
          return true;
        } else {
          console.warn(`❌ Knowledge base with ID "${id}" not found or not accessible`);
          return false;
        }
      });
    } catch (error) {
      console.error('❌ Failed to validate knowledge base IDs:', error);
      return [];
    }
  }

  // Delete agent
  async deleteAgent(id: string): Promise<boolean> {
    await this.initialize();

    const agentIndex = this.agents.findIndex(agent => agent.id === id);
    if (agentIndex === -1) {
      console.error(`❌ Agent not found: ${id}`);
      return false;
    }

    const agent = this.agents[agentIndex];
    this.agents.splice(agentIndex, 1);
    await this.saveAgents();

    console.log(`✅ Deleted agent: ${agent.name} (${id})`);
    return true;
  }

  // Duplicate agent
  async duplicateAgent(id: string, newName?: string): Promise<string> {
    await this.initialize();

    const originalAgent = this.agents.find(agent => agent.id === id);
    if (!originalAgent) {
      const error = `Agent not found: ${id}`;
      console.error(`❌ ${error}`);
      throw new Error(error);
    }

    const duplicateRequest: CreateAgentRequest = {
      name: newName || `${originalAgent.name} (Copy)`,
      description: originalAgent.description,
      icon: originalAgent.icon,
      userDescription: originalAgent.userDescription || '',
      selectedTools: originalAgent.selectedTools.map(tool => tool.name),
      enabledMCPServers: [...originalAgent.enabledMCPServers],
      selectedKnowledgeBases: [...originalAgent.selectedKnowledgeBases],
      ragEnabled: originalAgent.ragEnabled,
      ragSettings: originalAgent.ragSettings,
      defaultProvider: originalAgent.defaultProvider,
      defaultModel: originalAgent.defaultModel,
      temperature: originalAgent.temperature,
      maxTokens: originalAgent.maxTokens,
      tags: [...(originalAgent.tags || [])]
    };

    const newAgentId = await this.createAgent(duplicateRequest);
    
    // Copy the system prompt if it exists
    if (originalAgent.systemPrompt) {
      await this.updateAgent({
        id: newAgentId,
        systemPrompt: originalAgent.systemPrompt
      });
    }

    console.log(`✅ Duplicated agent: ${originalAgent.name} -> ${duplicateRequest.name}`);
    return newAgentId;
  }

  // Export agent to JSON
  async exportAgent(id: string): Promise<AgentExport | null> {
    await this.initialize();

    const agent = this.agents.find(a => a.id === id);
    if (!agent) {
      console.error(`❌ Agent not found: ${id}`);
      return null;
    }

    const exportData: AgentExport = {
      agent: {
        name: agent.name,
        description: agent.description,
        icon: agent.icon,
        defaultProvider: agent.defaultProvider,
        defaultModel: agent.defaultModel,
        systemPrompt: agent.systemPrompt,
        generatedPrompt: agent.generatedPrompt,
        userDescription: agent.userDescription,
        selectedTools: agent.selectedTools,
        toolCallingEnabled: agent.toolCallingEnabled,
        enabledMCPServers: agent.enabledMCPServers,
        selectedKnowledgeBases: agent.selectedKnowledgeBases,
        ragEnabled: agent.ragEnabled,
        ragSettings: agent.ragSettings,
        temperature: agent.temperature,
        maxTokens: agent.maxTokens,
        version: agent.version,
        tags: agent.tags,
        isTemplate: agent.isTemplate
      },
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0.0',
      requiredTools: agent.selectedTools.map(tool => tool.name),
      requiredMCPServers: agent.enabledMCPServers
    };

    console.log(`✅ Exported agent: ${agent.name}`);
    return exportData;
  }

  // Import agent from JSON
  async importAgent(exportData: AgentExport, options?: { overwriteName?: string }): Promise<AgentImportResult> {
    await this.initialize();

    try {
      // Validate export data
      if (!exportData.agent || !exportData.agent.name) {
        return {
          success: false,
          errors: ['Invalid export data: missing agent information']
        };
      }

      // Check for missing tools and MCP servers
      const availableTools = await this.getAvailableTools();
      const availableToolNames = availableTools.map(tool => tool.name);
      const missingTools = exportData.requiredTools.filter(tool => !availableToolNames.includes(tool));

      const mcpServers = await mcpService.getServers();
      const availableMCPServers = mcpServers.map(server => server.id);
      const missingMCPServers = exportData.requiredMCPServers.filter(server => !availableMCPServers.includes(server));

      // Create import request
      const importRequest: CreateAgentRequest = {
        name: options?.overwriteName || exportData.agent.name,
        description: exportData.agent.description,
        icon: exportData.agent.icon,
        userDescription: exportData.agent.userDescription || '',
        selectedTools: exportData.agent.selectedTools
          .filter(tool => availableToolNames.includes(tool.name))
          .map(tool => tool.name),
        enabledMCPServers: exportData.agent.enabledMCPServers.filter(server => availableMCPServers.includes(server)),
        selectedKnowledgeBases: exportData.agent.selectedKnowledgeBases || [],
        ragEnabled: exportData.agent.ragEnabled || false,
        ragSettings: exportData.agent.ragSettings,
        defaultProvider: exportData.agent.defaultProvider,
        defaultModel: exportData.agent.defaultModel,
        temperature: exportData.agent.temperature,
        maxTokens: exportData.agent.maxTokens,
        tags: exportData.agent.tags
      };

      // Create the agent
      const agentId = await this.createAgent(importRequest);

      // Update with system prompt if available
      if (exportData.agent.systemPrompt) {
        await this.updateAgent({
          id: agentId,
          systemPrompt: exportData.agent.systemPrompt
        });
      }

      const warnings: string[] = [];
      if (missingTools.length > 0) {
        warnings.push(`Some tools are not available: ${missingTools.join(', ')}`);
      }
      if (missingMCPServers.length > 0) {
        warnings.push(`Some MCP servers are not configured: ${missingMCPServers.join(', ')}`);
      }

      console.log(`✅ Imported agent: ${importRequest.name} (${agentId})`);
      return {
        success: true,
        agentId,
        warnings,
        missingTools,
        missingMCPServers
      };

    } catch (error) {
      console.error('❌ Error importing agent:', error);
      return {
        success: false,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  // Validate agent configuration
  async validateAgent(id: string): Promise<AgentValidationResult> {
    await this.initialize();

    const agent = this.agents.find(a => a.id === id);
    if (!agent) {
      return {
        isValid: false,
        errors: ['Agent not found'],
        warnings: [],
        missingDependencies: { providers: [], models: [], tools: [], mcpServers: [] }
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    const missingDependencies = {
      providers: [] as string[],
      models: [] as string[],
      tools: [] as string[],
      mcpServers: [] as string[]
    };

    // Validate basic fields
    if (!agent.name.trim()) errors.push('Agent name is required');
    if (!agent.description.trim()) warnings.push('Agent description is empty');
    if (!agent.systemPrompt.trim()) warnings.push('Agent system prompt is empty');

    // Validate tools
    const availableTools = await this.getAvailableTools();
    const availableToolNames = availableTools.map(tool => tool.name);
    agent.selectedTools.forEach(tool => {
      if (!availableToolNames.includes(tool.name)) {
        missingDependencies.tools.push(tool.name);
      }
    });

    // Validate MCP servers
    const mcpServers = await mcpService.getServers();
    const availableMCPServers = mcpServers.map(server => server.id);
    agent.enabledMCPServers.forEach(serverId => {
      if (!availableMCPServers.includes(serverId)) {
        missingDependencies.mcpServers.push(serverId);
      }
    });

    // Add warnings for missing dependencies
    if (missingDependencies.tools.length > 0) {
      warnings.push(`Missing tools: ${missingDependencies.tools.join(', ')}`);
    }
    if (missingDependencies.mcpServers.length > 0) {
      warnings.push(`Missing MCP servers: ${missingDependencies.mcpServers.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      missingDependencies
    };
  }
}

export const agentService = new AgentService();
