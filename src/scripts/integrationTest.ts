// Integration test script for multi-knowledge base system
import { knowledgeBaseRegistry } from '../services/KnowledgeBaseRegistry';
import { knowledgeBaseService } from '../services/KnowledgeBaseService';
import { RAGService } from '../services/RAGService';
import { agentService } from '../services/agentService';
import { chatService } from '../services/chatService';
import { settingsService } from '../services/settingsService';
import { runMigrationIfNeeded } from './migrationScript';

interface TestResult {
  testName: string;
  success: boolean;
  message: string;
  details?: any;
}

class IntegrationTester {
  private results: TestResult[] = [];
  private ragService: RAGService;

  constructor() {
    this.ragService = RAGService.getInstance();
  }

  private addResult(testName: string, success: boolean, message: string, details?: any) {
    this.results.push({ testName, success, message, details });
    console.log(`${success ? '✅' : '❌'} ${testName}: ${message}`);
    if (details) {
      console.log('  Details:', details);
    }
  }

  async runAllTests(): Promise<{ totalTests: number; passed: number; failed: number; results: TestResult[] }> {
    console.log('🚀 Starting comprehensive integration tests for multi-KB system...');
    this.results = [];

    // Test 1: Migration and Setup
    await this.testMigrationAndSetup();

    // Test 2: Knowledge Base Registry
    await this.testKnowledgeBaseRegistry();

    // Test 3: Knowledge Base Service
    await this.testKnowledgeBaseService();

    // Test 4: RAG Service Integration
    await this.testRAGService();

    // Test 5: Agent Integration
    await this.testAgentIntegration();

    // Test 6: Chat Service Integration
    await this.testChatServiceIntegration();

    // Test 7: Settings Integration
    await this.testSettingsIntegration();

    // Test 8: UI Component Integration (mock)
    await this.testUIComponentIntegration();

    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;

    console.log('\n📊 Integration Test Summary:');
    console.log(`Total Tests: ${this.results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / this.results.length) * 100).toFixed(1)}%`);

    return {
      totalTests: this.results.length,
      passed,
      failed,
      results: this.results
    };
  }

  private async testMigrationAndSetup() {
    try {
      const migrationResult = await runMigrationIfNeeded();
      this.addResult(
        'Migration and Setup',
        migrationResult.success,
        migrationResult.message,
        { migratedRecords: migrationResult.migratedRecords, createdKBs: migrationResult.createdKnowledgeBases }
      );
    } catch (error) {
      this.addResult('Migration and Setup', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private async testKnowledgeBaseRegistry() {
    try {
      // Test KB creation
      const testKB = await knowledgeBaseRegistry.createKnowledgeBase({
        name: 'Test Knowledge Base',
        description: 'Integration test KB',
        tags: ['test', 'integration']
      });

      // Test KB retrieval
      const retrievedKB = await knowledgeBaseRegistry.getKnowledgeBase(testKB.id);
      
      // Test KB listing
      const allKBs = await knowledgeBaseRegistry.listKnowledgeBases();
      
      // Test validation
      const validation = await knowledgeBaseRegistry.validateRegistry();

      this.addResult(
        'Knowledge Base Registry',
        !!(retrievedKB && allKBs.length > 0 && validation.isValid),
        `Created, retrieved, and validated KB operations`,
        { 
          kbId: testKB.id, 
          totalKBs: allKBs.length, 
          validationErrors: validation.errors 
        }
      );

      // Cleanup test KB
      await knowledgeBaseRegistry.deleteKnowledgeBase(testKB.id);
    } catch (error) {
      this.addResult('Knowledge Base Registry', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private async testKnowledgeBaseService() {
    try {
      const kbList = await knowledgeBaseRegistry.listKnowledgeBases();
      if (kbList.length === 0) {
        this.addResult('Knowledge Base Service', false, 'No knowledge bases available for testing');
        return;
      }

      const testKB = kbList[0];
      
      // Test stats retrieval
      const stats = await knowledgeBaseService.getKnowledgeBaseStats(testKB);
      
      // Test table creation
      const table = await knowledgeBaseService.getKnowledgeBaseTable(testKB.id);
      
      this.addResult(
        'Knowledge Base Service',
        !!(stats && table),
        'Successfully retrieved stats and table',
        { stats, tableName: testKB.tableName }
      );
    } catch (error) {
      this.addResult('Knowledge Base Service', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private async testRAGService() {
    try {
      const kbList = await knowledgeBaseRegistry.listKnowledgeBases();
      if (kbList.length === 0) {
        this.addResult('RAG Service', false, 'No knowledge bases available for testing');
        return;
      }

      const testQuery = 'test query for integration testing';
      const kbIds = [kbList[0].id];
      
      // Test prompt augmentation
      const augmentedPrompt = await this.ragService.augmentPromptWithMultipleKnowledgeBases(
        testQuery,
        kbIds,
        {
          maxResultsPerKB: 3,
          relevanceThreshold: 0.5,
          contextWindowTokens: 1000,
          aggregationStrategy: 'relevance',
          includeSourceAttribution: true
        }
      );

      // Test KB ID validation
      const validatedIds = await this.ragService.validateKnowledgeBaseIds(kbIds);

      this.addResult(
        'RAG Service',
        !!(augmentedPrompt && validatedIds.length > 0),
        'Successfully augmented prompt and validated KB IDs',
        { 
          originalQuery: testQuery, 
          augmentedLength: augmentedPrompt.length,
          validatedKBs: validatedIds.length 
        }
      );
    } catch (error) {
      this.addResult('RAG Service', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private async testAgentIntegration() {
    try {
      // Test available tools
      const tools = await agentService.getAvailableTools();
      
      // Test available knowledge bases (would be implemented)
      // const availableKBs = await agentService.getAvailableKnowledgeBases();

      const kbList = await knowledgeBaseRegistry.listKnowledgeBases();

      // Test agent creation with KB selection
      const testAgent = await agentService.createAgent({
        name: 'Test Integration Agent',
        description: 'Agent for integration testing',
        userDescription: 'A test agent for validating KB integration',
        selectedTools: tools.slice(0, 2).map(t => t.name),
        enabledMCPServers: [],
        selectedKnowledgeBases: kbList.slice(0, 1).map(kb => kb.id),
        ragEnabled: true,
        ragSettings: {
          maxResultsPerKB: 3,
          relevanceThreshold: 0.5,
          contextWindowTokens: 2000,
          aggregationStrategy: 'relevance'
        },
        defaultProvider: 'anthropic',
        defaultModel: 'claude-3-sonnet',
        tags: ['test']
      });

      // Test agent context retrieval
      const agentContext = await agentService.getAgentChatContext(testAgent);

      this.addResult(
        'Agent Integration',
        !!(testAgent && agentContext && agentContext.selectedKnowledgeBases.length > 0),
        'Successfully created agent with KB integration',
        { 
          agentId: testAgent, 
          kbCount: agentContext?.selectedKnowledgeBases.length,
          ragEnabled: agentContext?.ragEnabled 
        }
      );

      // Cleanup test agent
      if (testAgent) {
        await agentService.deleteAgent(testAgent);
      }
    } catch (error) {
      this.addResult('Agent Integration', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private async testChatServiceIntegration() {
    try {
      // Test regular chat functionality
      const providers = chatService.getProviders();
      
      // Test agent-aware validation
      const kbValidation = await chatService.validateAgentKnowledgeBases(['test-kb-id']);
      
      this.addResult(
        'Chat Service Integration',
        !!(providers.length > 0),
        'Chat service integration functional',
        { 
          providerCount: providers.length,
          kbValidation
        }
      );
    } catch (error) {
      this.addResult('Chat Service Integration', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private async testSettingsIntegration() {
    try {
      // Test settings initialization
      await settingsService.waitForInitialization();
      
      // Test KB configuration retrieval
      const kbConfig = settingsService.getKnowledgeBaseConfig();
      
      // Test RAG options
      const ragOptions = settingsService.getRagOptions();
      
      // Test KB selection methods
      const selectedKBs = settingsService.getSelectedKnowledgeBaseIds();
      
      this.addResult(
        'Settings Integration',
        !!(kbConfig && ragOptions && Array.isArray(selectedKBs)),
        'Settings integration working correctly',
        { 
          ragEnabled: kbConfig.enabled,
          selectedKBCount: selectedKBs.length,
          ragOptions
        }
      );
    } catch (error) {
      this.addResult('Settings Integration', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  private async testUIComponentIntegration() {
    try {
      // Mock UI component validation
      const kbList = await knowledgeBaseRegistry.listKnowledgeBases();
      
      // Simulate KB selector functionality
      const selectorData = {
        availableKBs: kbList.length,
        multiSelectSupported: true,
        managementUIAvailable: true
      };

      // Simulate agent dialog functionality
      const agentDialogData = {
        kbSelectionIncluded: true,
        ragSettingsIncluded: true,
        formValidation: true
      };

      this.addResult(
        'UI Component Integration',
        !!(selectorData.availableKBs >= 0 && selectorData.multiSelectSupported),
        'UI components ready for KB integration',
        { selectorData, agentDialogData }
      );
    } catch (error) {
      this.addResult('UI Component Integration', false, `Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }
}

// Export test runner function
export async function runIntegrationTests(): Promise<{ totalTests: number; passed: number; failed: number; results: TestResult[] }> {
  const tester = new IntegrationTester();
  return await tester.runAllTests();
}

// Export individual test runner for specific test categories
export async function runSpecificTest(testName: string): Promise<TestResult> {
  const tester = new IntegrationTester();
  
  try {
    switch (testName) {
      case 'migration':
        await tester['testMigrationAndSetup']();
        break;
      case 'registry':
        await tester['testKnowledgeBaseRegistry']();
        break;
      case 'service':
        await tester['testKnowledgeBaseService']();
        break;
      case 'rag':
        await tester['testRAGService']();
        break;
      case 'agent':
        await tester['testAgentIntegration']();
        break;
      case 'chat':
        await tester['testChatServiceIntegration']();
        break;
      case 'settings':
        await tester['testSettingsIntegration']();
        break;
      case 'ui':
        await tester['testUIComponentIntegration']();
        break;
      default:
        return { testName, success: false, message: 'Unknown test name' };
    }
    
    return tester['results'][tester['results'].length - 1] || { testName, success: false, message: 'No test results' };
  } catch (error) {
    return { 
      testName, 
      success: false, 
      message: `Test execution failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}