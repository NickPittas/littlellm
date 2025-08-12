/**
 * Tool Execution Manager - Centralizes tool execution logic across all providers
 * This reduces duplication by providing common tool execution patterns
 */

import { LLMSettings, LLMProvider, LLMResponse, ToolObject, ContentItem } from './types';

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('../debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}

export interface ToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  id?: string;
  name: string;
  result: string;
  success: boolean;
  executionTime: number;
}

export interface ToolExecutionConfig {
  maxParallelTools: number;
  timeoutMs: number;
  retryAttempts: number;
  enableDeduplication: boolean;
}

export class ToolExecutionManager {
  private static defaultConfig: ToolExecutionConfig = {
    maxParallelTools: 5,
    timeoutMs: 30000,
    retryAttempts: 2,
    enableDeduplication: true
  };

  /**
   * Execute multiple tools in parallel with proper error handling
   */
  static async executeToolsParallel(
    toolCalls: ToolCall[],
    executeTool: (name: string, args: Record<string, unknown>) => Promise<string>,
    config: Partial<ToolExecutionConfig> = {}
  ): Promise<ToolResult[]> {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    if (toolCalls.length === 0) {
      return [];
    }

    // Deduplicate tool calls if enabled
    const uniqueToolCalls = finalConfig.enableDeduplication 
      ? this.deduplicateToolCalls(toolCalls)
      : toolCalls;

    safeDebugLog('info', 'TOOLEXECUTIONMANAGER', `🔧 Executing ${uniqueToolCalls.length} tools in parallel`);

    // Split into batches to respect maxParallelTools limit
    const batches = this.createBatches(uniqueToolCalls, finalConfig.maxParallelTools);
    const allResults: ToolResult[] = [];

    for (const [batchIndex, batch] of batches.entries()) {
      safeDebugLog('info', 'TOOLEXECUTIONMANAGER', `🔧 Executing batch ${batchIndex + 1}/${batches.length} with ${batch.length} tools`);
      
      const batchPromises = batch.map(async (toolCall): Promise<ToolResult> => {
        const startTime = Date.now();
        
        try {
          const result = await this.executeWithTimeout(
            () => executeTool(toolCall.name, toolCall.arguments),
            finalConfig.timeoutMs
          );
          
          const executionTime = Date.now() - startTime;
          
          return {
            id: toolCall.id,
            name: toolCall.name,
            result,
            success: true,
            executionTime
          };
        } catch (error) {
          const executionTime = Date.now() - startTime;
          const errorMessage = error instanceof Error ? error.message : String(error);
          
          safeDebugLog('error', 'TOOLEXECUTIONMANAGER', `❌ Tool ${toolCall.name} failed:`, errorMessage);
          
          return {
            id: toolCall.id,
            name: toolCall.name,
            result: `Error: ${errorMessage}`,
            success: false,
            executionTime
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      allResults.push(...batchResults);
    }

    const successCount = allResults.filter(r => r.success).length;
    const totalTime = allResults.reduce((sum, r) => sum + r.executionTime, 0);
    
    safeDebugLog('info', 'TOOLEXECUTIONMANAGER', `✅ Tool execution completed: ${successCount}/${allResults.length} successful, total time: ${totalTime}ms`);

    return allResults;
  }

  /**
   * Format tool results for different providers
   */
  static formatToolResults(
    results: ToolResult[],
    format: 'openai' | 'anthropic' | 'gemini' | 'ollama'
  ): Array<{ role: string; content: string; tool_call_id?: string; name?: string }> {
    return results.map(result => {
      const baseMessage = {
        role: 'tool' as const,
        content: result.result,
        name: result.name
      };

      switch (format) {
        case 'openai':
          return {
            ...baseMessage,
            tool_call_id: result.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          };
        
        case 'anthropic':
          return {
            role: 'user' as const,
            content: `Tool "${result.name}" result: ${result.result}`
          };
        
        case 'gemini':
          return {
            role: 'function' as const,
            content: result.result,
            name: result.name
          };
        
        case 'ollama':
        default:
          return baseMessage;
      }
    });
  }

  /**
   * Create a summary of tool execution results
   */
  static summarizeToolResults(results: ToolResult[]): string {
    if (results.length === 0) {
      return 'No tools were executed.';
    }

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    let summary = `Executed ${results.length} tool(s): ${successful.length} successful, ${failed.length} failed.\n\n`;
    
    // Add successful results
    if (successful.length > 0) {
      summary += 'Successful executions:\n';
      for (const result of successful) {
        summary += `- ${result.name}: ${result.result.substring(0, 200)}${result.result.length > 200 ? '...' : ''}\n`;
      }
      summary += '\n';
    }
    
    // Add failed results
    if (failed.length > 0) {
      summary += 'Failed executions:\n';
      for (const result of failed) {
        summary += `- ${result.name}: ${result.result}\n`;
      }
    }
    
    return summary.trim();
  }

  /**
   * Validate tool calls before execution
   */
  static validateToolCalls(
    toolCalls: ToolCall[],
    availableTools: ToolObject[]
  ): { valid: ToolCall[]; invalid: Array<{ call: ToolCall; errors: string[] }> } {
    const valid: ToolCall[] = [];
    const invalid: Array<{ call: ToolCall; errors: string[] }> = [];
    
    const toolMap = new Map(availableTools.map(tool => [tool.name, tool]));
    
    for (const call of toolCalls) {
      const errors: string[] = [];
      
      // Check if tool exists
      const tool = toolMap.get(call.name);
      if (!tool) {
        errors.push(`Tool "${call.name}" not found`);
      } else {
        // Validate arguments against schema
        const validation = this.validateToolArguments(call.arguments, tool.parameters);
        if (!validation.valid) {
          errors.push(...validation.errors);
        }
      }
      
      if (errors.length === 0) {
        valid.push(call);
      } else {
        invalid.push({ call, errors });
      }
    }
    
    return { valid, invalid };
  }

  /**
   * Deduplicate tool calls based on name and arguments
   */
  private static deduplicateToolCalls(toolCalls: ToolCall[]): ToolCall[] {
    const seen = new Set<string>();
    const unique: ToolCall[] = [];
    
    for (const call of toolCalls) {
      const key = `${call.name}:${JSON.stringify(call.arguments)}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(call);
      }
    }
    
    if (unique.length < toolCalls.length) {
      safeDebugLog('info', 'TOOLEXECUTIONMANAGER', `🔧 Deduplicated ${toolCalls.length - unique.length} duplicate tool calls`);
    }
    
    return unique;
  }

  /**
   * Create batches of tool calls for parallel execution
   */
  private static createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Execute a function with timeout
   */
  private static async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Tool execution timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      fn()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Validate tool arguments against schema
   */
  private static validateToolArguments(
    args: Record<string, unknown>,
    schema: unknown
  ): { valid: boolean; errors: string[] } {
    // Basic validation - can be enhanced with JSON schema validation
    const errors: string[] = [];
    
    if (!args || typeof args !== 'object') {
      errors.push('Arguments must be an object');
      return { valid: false, errors };
    }
    
    // Add more sophisticated validation here if needed
    return { valid: true, errors: [] };
  }
}
