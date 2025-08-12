// Tests for the Agent Service
import { agentService } from '../services/agentService';
import { CreateAgentRequest } from '../types/agent';
import { debugLogger } from '../services/debugLogger';

// Mock the dependencies
jest.mock('../services/mcpService', () => ({
  mcpService: {
    getAvailableTools: jest.fn().mockResolvedValue([
      {
        name: 'test-tool',
        description: 'Test tool',
        category: 'mcp',
        serverId: 'test-server',
        enabled: true
      }
    ]),
    getServers: jest.fn().mockResolvedValue([
      {
        id: 'test-server',
        name: 'Test Server',
        description: 'Test MCP Server'
      }
    ])
  }
}));

jest.mock('../services/llmService', () => ({
  llmService: {
    sendMessage: jest.fn().mockResolvedValue({
      success: true,
      content: 'Generated test prompt for the agent',
      usage: { totalTokens: 100 }
    }),
    getProviders: jest.fn().mockResolvedValue([
      {
        id: 'test-provider',
        name: 'Test Provider'
      }
    ])
  }
}));

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    getStateFile: jest.fn().mockResolvedValue(null),
    saveStateFile: jest.fn().mockResolvedValue(true)
  },
  writable: true
});

describe('AgentService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Agent CRUD Operations', () => {
    test('should create a new agent', async () => {
      const createRequest: CreateAgentRequest = {
        name: 'Test Agent',
        description: 'A test agent for unit testing',
        icon: '🧪',
        userDescription: 'This agent is for testing purposes',
        selectedTools: ['test-tool'],
        enabledMCPServers: ['test-server'],
        defaultProvider: 'test-provider',
        defaultModel: 'test-model',
        temperature: 0.7,
        maxTokens: 4000,
        tags: ['test']
      };

      const agentId = await agentService.createAgent(createRequest);
      
      expect(agentId).toBeDefined();
      expect(typeof agentId).toBe('string');
    });

    test('should retrieve all agents', async () => {
      const agents = await agentService.getAgents();
      
      expect(Array.isArray(agents)).toBe(true);
    });

    test('should get agent by ID', async () => {
      // First create an agent
      const createRequest: CreateAgentRequest = {
        name: 'Test Agent 2',
        description: 'Another test agent',
        icon: '🔬',
        userDescription: 'This is another test agent',
        selectedTools: [],
        enabledMCPServers: [],
        defaultProvider: 'test-provider',
        defaultModel: 'test-model'
      };

      const agentId = await agentService.createAgent(createRequest);
      const agent = await agentService.getAgent(agentId);
      
      expect(agent).toBeDefined();
      expect(agent?.id).toBe(agentId);
      expect(agent?.name).toBe('Test Agent 2');
    });

    test('should update an existing agent', async () => {
      // First create an agent
      const createRequest: CreateAgentRequest = {
        name: 'Test Agent 3',
        description: 'Agent to be updated',
        icon: '⚗️',
        userDescription: 'This agent will be updated',
        selectedTools: [],
        enabledMCPServers: [],
        defaultProvider: 'test-provider',
        defaultModel: 'test-model'
      };

      const agentId = await agentService.createAgent(createRequest);
      
      // Update the agent
      const updateResult = await agentService.updateAgent({
        id: agentId,
        name: 'Updated Test Agent',
        description: 'This agent has been updated'
      });
      
      expect(updateResult).toBe(true);
      
      // Verify the update
      const updatedAgent = await agentService.getAgent(agentId);
      expect(updatedAgent?.name).toBe('Updated Test Agent');
      expect(updatedAgent?.description).toBe('This agent has been updated');
    });

    test('should delete an agent', async () => {
      // First create an agent
      const createRequest: CreateAgentRequest = {
        name: 'Agent to Delete',
        description: 'This agent will be deleted',
        icon: '🗑️',
        userDescription: 'Temporary agent',
        selectedTools: [],
        enabledMCPServers: [],
        defaultProvider: 'test-provider',
        defaultModel: 'test-model'
      };

      const agentId = await agentService.createAgent(createRequest);
      
      // Delete the agent
      const deleteResult = await agentService.deleteAgent(agentId);
      expect(deleteResult).toBe(true);
      
      // Verify deletion
      const deletedAgent = await agentService.getAgent(agentId);
      expect(deletedAgent).toBeNull();
    });

    test('should duplicate an agent', async () => {
      // First create an agent
      const createRequest: CreateAgentRequest = {
        name: 'Original Agent',
        description: 'Agent to be duplicated',
        icon: '📋',
        userDescription: 'Original agent for duplication',
        selectedTools: ['test-tool'],
        enabledMCPServers: ['test-server'],
        defaultProvider: 'test-provider',
        defaultModel: 'test-model',
        tags: ['original']
      };

      const originalId = await agentService.createAgent(createRequest);
      
      // Duplicate the agent
      const duplicateId = await agentService.duplicateAgent(originalId, 'Duplicated Agent');
      
      expect(duplicateId).toBeDefined();
      expect(duplicateId).not.toBe(originalId);
      
      // Verify the duplicate
      const duplicate = await agentService.getAgent(duplicateId!);
      expect(duplicate?.name).toBe('Duplicated Agent');
      expect(duplicate?.description).toBe('Agent to be duplicated');
      expect(duplicate?.selectedTools).toHaveLength(1);
    });
  });

  describe('Agent Templates', () => {
    test('should return available templates', async () => {
      const templates = await agentService.getTemplates();
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      
      // Check for default templates
      const documentAnalyst = templates.find(t => t.id === 'document-analyst');
      expect(documentAnalyst).toBeDefined();
      expect(documentAnalyst?.name).toBe('Document Analyst');
    });
  });

  describe('Tool Management', () => {
    test('should return available tools', async () => {
      const tools = await agentService.getAvailableTools();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // Should include both MCP and internal tools
      const mcpTool = tools.find(t => t.category === 'mcp');
      const internalTool = tools.find(t => t.category === 'file');
      
      expect(mcpTool).toBeDefined();
      expect(internalTool).toBeDefined();
    });
  });

  describe('Prompt Generation', () => {
    test('should generate a prompt for an agent', async () => {
      const tools = await agentService.getAvailableTools();
      
      const response = await agentService.generatePrompt({
        userDescription: 'Create an agent that helps with testing',
        selectedTools: tools.slice(0, 2),
        agentName: 'Test Helper',
        agentDescription: 'Helps with testing tasks',
        provider: 'test-provider',
        model: 'test-model'
      });
      
      expect(response.success).toBe(true);
      expect(response.generatedPrompt).toBeDefined();
      expect(typeof response.generatedPrompt).toBe('string');
      expect(response.tokensUsed).toBe(100);
    });
  });

  describe('Import/Export', () => {
    test('should export an agent', async () => {
      // First create an agent
      const createRequest: CreateAgentRequest = {
        name: 'Export Test Agent',
        description: 'Agent for export testing',
        icon: '📤',
        userDescription: 'This agent will be exported',
        selectedTools: ['test-tool'],
        enabledMCPServers: ['test-server'],
        defaultProvider: 'test-provider',
        defaultModel: 'test-model',
        tags: ['export', 'test']
      };

      const agentId = await agentService.createAgent(createRequest);
      
      // Export the agent
      const exportData = await agentService.exportAgent(agentId);
      
      expect(exportData).toBeDefined();
      expect(exportData?.agent.name).toBe('Export Test Agent');
      expect(exportData?.requiredTools).toContain('test-tool');
      expect(exportData?.requiredMCPServers).toContain('test-server');
      expect(exportData?.exportVersion).toBe('1.0.0');
    });

    test('should import an agent', async () => {
      const exportData = {
        agent: {
          name: 'Imported Agent',
          description: 'Agent imported from JSON',
          icon: '📥',
          defaultProvider: 'test-provider',
          defaultModel: 'test-model',
          systemPrompt: 'You are an imported agent.',
          userDescription: 'This agent was imported',
          selectedTools: [],
          toolCallingEnabled: true,
          enabledMCPServers: [],
          temperature: 0.7,
          maxTokens: 4000,
          version: '1.0.0',
          tags: ['imported']
        },
        exportedAt: new Date().toISOString(),
        exportVersion: '1.0.0',
        requiredTools: [],
        requiredMCPServers: []
      };
      
      const result = await agentService.importAgent(exportData);
      
      expect(result.success).toBe(true);
      expect(result.agentId).toBeDefined();
      
      // Verify the imported agent
      const importedAgent = await agentService.getAgent(result.agentId!);
      expect(importedAgent?.name).toBe('Imported Agent');
      expect(importedAgent?.description).toBe('Agent imported from JSON');
    });
  });

  describe('Agent Validation', () => {
    test('should validate an agent configuration', async () => {
      // First create an agent
      const createRequest: CreateAgentRequest = {
        name: 'Validation Test Agent',
        description: 'Agent for validation testing',
        icon: '✅',
        userDescription: 'This agent will be validated',
        selectedTools: ['test-tool'],
        enabledMCPServers: ['test-server'],
        defaultProvider: 'test-provider',
        defaultModel: 'test-model'
      };

      const agentId = await agentService.createAgent(createRequest);
      
      // Validate the agent
      const validation = await agentService.validateAgent(agentId);
      
      expect(validation).toBeDefined();
      expect(typeof validation.isValid).toBe('boolean');
      expect(Array.isArray(validation.errors)).toBe(true);
      expect(Array.isArray(validation.warnings)).toBe(true);
    });
  });
});
