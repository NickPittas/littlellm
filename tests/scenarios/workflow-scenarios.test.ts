/**
 * Realistic workflow scenario tests for MCP Agentic Workflows
 * Tests complex real-world scenarios with tool chaining and error recovery
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LLMService } from '../../src/services/llmService';

// Scenario data generators
const generateSearchResults = (query: string, count: number = 3) => ({
  results: Array.from({ length: count }, (_, i) => ({
    title: `${query} Result ${i + 1}`,
    url: `https://example${i + 1}.com/${query.toLowerCase().replace(/\s+/g, '-')}`,
    content: `Detailed information about ${query} from source ${i + 1}. This contains relevant insights and data.`,
    snippet: `Brief snippet about ${query}...`
  }))
});

const generateMemoryResults = (query: string, count: number = 2) => ({
  success: true,
  memories: Array.from({ length: count }, (_, i) => ({
    id: `mem-${i}`,
    title: `Memory: ${query} ${i + 1}`,
    content: `Stored information about ${query} from previous interactions.`,
    type: 'user_preference',
    tags: [query.toLowerCase(), 'memory'],
    timestamp: Date.now() - (i * 86400000) // Days ago
  }))
});

// Mock electron API with realistic responses
const createScenarioMockAPI = () => ({
  callMCPTool: vi.fn(),
  callMultipleMCPTools: vi.fn(),
  getAllMCPTools: vi.fn().mockResolvedValue([
    { name: 'tavily-search', description: 'Search the web with Tavily', inputSchema: {} },
    { name: 'brave-search', description: 'Search the web with Brave', inputSchema: {} },
    { name: 'memory-search', description: 'Search stored memories', inputSchema: {} },
    { name: 'memory-store', description: 'Store information in memory', inputSchema: {} },
    { name: 'file-read', description: 'Read file contents', inputSchema: {} },
    { name: 'content-analyzer', description: 'Analyze content', inputSchema: {} },
    { name: 'summarizer', description: 'Summarize text', inputSchema: {} },
    { name: 'translator', description: 'Translate text', inputSchema: {} }
  ]),
  getMCPServers: vi.fn().mockResolvedValue({ servers: [] }),
  getConnectedMCPServerIds: vi.fn().mockResolvedValue(['server-1', 'server-2'])
});

describe('Realistic Workflow Scenarios', () => {
  let llmService: LLMService;
  let mockAPI: ReturnType<typeof createScenarioMockAPI>;

  beforeEach(() => {
    llmService = new LLMService();
    mockAPI = createScenarioMockAPI();
    Object.defineProperty(window, 'electronAPI', { value: mockAPI, writable: true });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Research Assistant Scenarios', () => {
    it('should execute a comprehensive research workflow', async () => {
      // Scenario: User asks "Research the latest developments in quantum computing and store key findings"
      
      // Mock parallel execution for initial research
      mockAPI.callMultipleMCPTools.mockResolvedValueOnce([
        {
          id: '1',
          name: 'tavily-search',
          result: generateSearchResults('quantum computing developments 2024', 5),
          success: true,
          executionTime: 150
        },
        {
          id: '2',
          name: 'memory-search',
          result: generateMemoryResults('quantum computing', 3),
          success: true,
          executionTime: 80
        }
      ]);

      // Mock chained execution for storing findings
      mockAPI.callMultipleMCPTools.mockResolvedValueOnce([
        {
          id: 'chain_1_memory-store',
          name: 'memory-store',
          result: { success: true, id: 'mem-quantum-2024', stored: true },
          success: true,
          executionTime: 60
        },
        {
          id: 'chain_1_summarizer',
          name: 'summarizer',
          result: { 
            summary: 'Key quantum computing developments in 2024 include advances in error correction, new qubit technologies, and commercial applications.',
            keyPoints: ['Error correction breakthroughs', 'Improved qubit stability', 'Commercial quantum advantage']
          },
          success: true,
          executionTime: 120
        }
      ]);

      const initialTools = [
        { id: '1', name: 'tavily-search', arguments: { query: 'quantum computing developments 2024', search_depth: 'advanced' } },
        { id: '2', name: 'memory-search', arguments: { query: 'quantum computing' } }
      ];

      const availableTools = await llmService.getMCPToolsForProvider('openai');
      
      // Execute workflow
      const workflowResult = await (llmService as any).executeAgenticWorkflow(
        initialTools,
        availableTools,
        3
      );

      expect(workflowResult.results.length).toBeGreaterThan(2);
      expect(workflowResult.workflow.length).toBeGreaterThan(1);
      expect(workflowResult.summary).toContain('Agentic Workflow Summary');
      
      // Verify chaining occurred
      const chainedResults = workflowResult.results.filter((r: any) => r.chainedFrom);
      expect(chainedResults.length).toBeGreaterThan(0);
    });

    it('should handle research with source verification', async () => {
      // Scenario: Research with cross-referencing multiple sources
      
      mockAPI.callMultipleMCPTools.mockResolvedValueOnce([
        {
          id: '1',
          name: 'tavily-search',
          result: generateSearchResults('climate change 2024 report', 4),
          success: true,
          executionTime: 180
        },
        {
          id: '2',
          name: 'brave-search',
          result: generateSearchResults('climate change 2024 scientific studies', 3),
          success: true,
          executionTime: 160
        }
      ]);

      // Mock content analysis chaining
      mockAPI.callMultipleMCPTools.mockResolvedValueOnce([
        {
          id: 'chain_1_content-analyzer',
          name: 'content-analyzer',
          result: {
            credibility: 'high',
            sources: ['IPCC', 'Nature', 'Science'],
            consensus: 'strong',
            reliability_score: 0.92
          },
          success: true,
          executionTime: 200
        }
      ]);

      const researchTools = [
        { id: '1', name: 'tavily-search', arguments: { query: 'climate change 2024 report' } },
        { id: '2', name: 'brave-search', arguments: { query: 'climate change 2024 scientific studies' } }
      ];

      const results = await (llmService as any).executeMultipleToolsParallel(researchTools);
      
      expect(results).toHaveLength(2);
      expect(results.every((r: any) => r.success)).toBe(true);
      
      // Verify cross-referencing capability
      const aggregated = (llmService as any).aggregateToolResults(results);
      expect(aggregated).toContain('tavily-search');
      expect(aggregated).toContain('brave-search');
    });
  });

  describe('Content Creation Scenarios', () => {
    it('should execute a blog post creation workflow', async () => {
      // Scenario: "Create a blog post about sustainable technology trends"
      
      mockAPI.callMultipleMCPTools.mockResolvedValueOnce([
        {
          id: '1',
          name: 'tavily-search',
          result: generateSearchResults('sustainable technology trends 2024', 6),
          success: true,
          executionTime: 140
        },
        {
          id: '2',
          name: 'memory-search',
          result: generateMemoryResults('user writing style preferences', 2),
          success: true,
          executionTime: 70
        }
      ]);

      // Mock content creation chaining
      mockAPI.callMultipleMCPTools.mockResolvedValueOnce([
        {
          id: 'chain_1_content-analyzer',
          name: 'content-analyzer',
          result: {
            outline: ['Introduction', 'Key Trends', 'Impact Analysis', 'Future Outlook', 'Conclusion'],
            tone: 'professional',
            target_audience: 'tech professionals'
          },
          success: true,
          executionTime: 100
        },
        {
          id: 'chain_1_memory-store',
          name: 'memory-store',
          result: { success: true, id: 'blog-research-2024' },
          success: true,
          executionTime: 50
        }
      ]);

      const contentTools = [
        { id: '1', name: 'tavily-search', arguments: { query: 'sustainable technology trends 2024' } },
        { id: '2', name: 'memory-search', arguments: { query: 'user writing style preferences' } }
      ];

      const workflowResult = await (llmService as any).executeAgenticWorkflow(
        contentTools,
        await llmService.getMCPToolsForProvider('anthropic'),
        2
      );

      expect(workflowResult.results.length).toBeGreaterThan(2);
      expect(workflowResult.summary).toContain('workflow');
    });

    it('should handle multilingual content creation', async () => {
      // Scenario: Create content in multiple languages
      
      mockAPI.callMultipleMCPTools.mockResolvedValueOnce([
        {
          id: '1',
          name: 'content-analyzer',
          result: {
            original_text: 'Technology innovation drives sustainable development.',
            language: 'en',
            readability: 'high'
          },
          success: true,
          executionTime: 80
        },
        {
          id: '2',
          name: 'translator',
          result: {
            translated_text: 'La innovación tecnológica impulsa el desarrollo sostenible.',
            target_language: 'es',
            confidence: 0.95
          },
          success: true,
          executionTime: 120
        },
        {
          id: '3',
          name: 'translator',
          result: {
            translated_text: 'L\'innovation technologique favorise le développement durable.',
            target_language: 'fr',
            confidence: 0.93
          },
          success: true,
          executionTime: 110
        }
      ]);

      const translationTools = [
        { id: '1', name: 'content-analyzer', arguments: { text: 'Technology innovation drives sustainable development.' } },
        { id: '2', name: 'translator', arguments: { text: 'source text', target_lang: 'es' } },
        { id: '3', name: 'translator', arguments: { text: 'source text', target_lang: 'fr' } }
      ];

      const results = await (llmService as any).executeMultipleToolsParallel(translationTools);
      
      expect(results).toHaveLength(3);
      expect(results.every((r: any) => r.success)).toBe(true);
      
      const aggregated = (llmService as any).aggregateToolResults(results);
      expect(aggregated).toContain('translator');
      expect(aggregated).toContain('content-analyzer');
    });
  });

  describe('Data Analysis Scenarios', () => {
    it('should execute a comprehensive data analysis workflow', async () => {
      // Scenario: Analyze data from multiple sources and generate insights
      
      mockAPI.callMultipleMCPTools.mockResolvedValueOnce([
        {
          id: '1',
          name: 'file-read',
          result: {
            filename: 'sales_data.csv',
            content: 'Date,Sales,Region\n2024-01-01,1000,North\n2024-01-02,1200,South',
            format: 'csv'
          },
          success: true,
          executionTime: 90
        },
        {
          id: '2',
          name: 'tavily-search',
          result: generateSearchResults('market trends Q1 2024', 4),
          success: true,
          executionTime: 130
        }
      ]);

      // Mock analysis chaining
      mockAPI.callMultipleMCPTools.mockResolvedValueOnce([
        {
          id: 'chain_1_content-analyzer',
          name: 'content-analyzer',
          result: {
            insights: ['Sales increased 20% in Q1', 'South region outperformed North'],
            trends: ['upward_trend', 'regional_variation'],
            recommendations: ['Focus on South region strategy', 'Investigate North region challenges']
          },
          success: true,
          executionTime: 180
        }
      ]);

      const analysisTools = [
        { id: '1', name: 'file-read', arguments: { path: 'sales_data.csv' } },
        { id: '2', name: 'tavily-search', arguments: { query: 'market trends Q1 2024' } }
      ];

      const workflowResult = await (llmService as any).executeAgenticWorkflow(
        analysisTools,
        await llmService.getMCPToolsForProvider('openai'),
        2
      );

      expect(workflowResult.results.length).toBeGreaterThan(2);
      expect(workflowResult.workflow.some((step: any) => step.chainedTools.length > 0)).toBe(true);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from search service failures', async () => {
      // Scenario: Primary search fails, backup search succeeds
      
      // Mock initial failure
      mockAPI.callMultipleMCPTools.mockResolvedValueOnce([
        {
          id: '1',
          name: 'tavily-search',
          result: null,
          success: false,
          error: 'Service temporarily unavailable',
          executionTime: 100
        }
      ]);

      // Mock successful recovery
      mockAPI.callMCPTool.mockResolvedValueOnce(
        generateSearchResults('backup search results', 3)
      );

      const searchTools = [
        { id: '1', name: 'tavily-search', arguments: { query: 'important research topic' } }
      ];

      const availableTools = [
        { function: { name: 'tavily-search', description: 'Primary search' } },
        { function: { name: 'brave-search', description: 'Backup search' } }
      ];

      const results = await (llmService as any).executeToolsWithRecovery(searchTools, availableTools);
      
      expect(results).toHaveLength(1);
      // Should have attempted recovery (exact behavior depends on implementation)
      expect(mockAPI.callMultipleMCPTools).toHaveBeenCalled();
    });

    it('should handle partial workflow failures gracefully', async () => {
      // Scenario: Some tools in workflow fail, others succeed
      
      mockAPI.callMultipleMCPTools.mockResolvedValueOnce([
        {
          id: '1',
          name: 'successful-tool',
          result: { data: 'success' },
          success: true,
          executionTime: 100
        },
        {
          id: '2',
          name: 'failing-tool',
          result: null,
          success: false,
          error: 'Tool malfunction',
          executionTime: 50
        },
        {
          id: '3',
          name: 'another-successful-tool',
          result: { data: 'also success' },
          success: true,
          executionTime: 120
        }
      ]);

      const mixedTools = [
        { id: '1', name: 'successful-tool', arguments: {} },
        { id: '2', name: 'failing-tool', arguments: {} },
        { id: '3', name: 'another-successful-tool', arguments: {} }
      ];

      const results = await (llmService as any).executeMultipleToolsParallel(mixedTools);
      
      expect(results).toHaveLength(3);
      expect(results.filter((r: any) => r.success)).toHaveLength(2);
      expect(results.filter((r: any) => !r.success)).toHaveLength(1);
      
      const aggregated = (llmService as any).aggregateToolResults(results);
      expect(aggregated).toContain('✅ Successful Results');
      expect(aggregated).toContain('❌ Failed Results');
      expect(aggregated).toContain('Success Rate: 67%');
    });
  });
});
