/**
 * Memory MCP Tools for LiteLLM
 * Provides MCP tools for AI models to interact with the memory system
 */

import { memoryService } from './memoryService';
import {
  MemoryStoreRequest,
  MemorySearchRequest,
  MemoryRetrieveRequest,
  MemoryUpdateRequest,
  MemoryDeleteRequest,
  MemoryToolResponse
} from '../types/memory';

// MCP Tool definitions for memory operations
export const memoryMCPTools = [
  {
    name: 'memory-store',
    description: 'Store information in persistent memory for future reference. Use this to remember important user preferences, project details, successful solutions, or any information that should persist across conversations.',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['user_preference', 'conversation_context', 'project_knowledge', 'code_snippet', 'solution', 'general'],
          description: 'The type of memory being stored'
        },
        title: {
          type: 'string',
          description: 'A descriptive title for this memory entry'
        },
        content: {
          type: 'string',
          description: 'The detailed content to store in memory'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags to help categorize and search for this memory'
        },
        projectId: {
          type: 'string',
          description: 'Optional project identifier if this memory is project-specific'
        },
        conversationId: {
          type: 'string',
          description: 'Optional conversation identifier if this memory relates to a specific conversation'
        },
        source: {
          type: 'string',
          description: 'Optional source information (e.g., "user_input", "ai_solution", "documentation")'
        }
      },
      required: ['type', 'title', 'content']
    }
  },
  {
    name: 'memory-search',
    description: 'Search through stored memories to find relevant information. Use this to recall previous conversations, user preferences, project details, or solutions.',
    inputSchema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'Text to search for in memory titles, content, and tags'
        },
        type: {
          type: 'string',
          enum: ['user_preference', 'conversation_context', 'project_knowledge', 'code_snippet', 'solution', 'general'],
          description: 'Filter by memory type'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Filter by specific tags'
        },
        projectId: {
          type: 'string',
          description: 'Filter by project identifier'
        },
        conversationId: {
          type: 'string',
          description: 'Filter by conversation identifier'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 10)',
          default: 10
        },
        offset: {
          type: 'number',
          description: 'Number of results to skip for pagination (default: 0)',
          default: 0
        }
      }
    }
  },
  {
    name: 'memory-retrieve',
    description: 'Retrieve a specific memory entry by its ID. Use this when you have a memory ID from a search result and need the full details.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier of the memory entry to retrieve'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'memory-update',
    description: 'Update an existing memory entry. Use this to modify or enhance previously stored information.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier of the memory entry to update'
        },
        title: {
          type: 'string',
          description: 'New title for the memory entry'
        },
        content: {
          type: 'string',
          description: 'New content for the memory entry'
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'New tags for the memory entry'
        },
        type: {
          type: 'string',
          enum: ['user_preference', 'conversation_context', 'project_knowledge', 'code_snippet', 'solution', 'general'],
          description: 'New type for the memory entry'
        }
      },
      required: ['id']
    }
  },
  {
    name: 'memory-delete',
    description: 'Delete a memory entry permanently. Use this to remove outdated or incorrect information.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The unique identifier of the memory entry to delete'
        }
      },
      required: ['id']
    }
  }
];

// Tool execution functions
export async function executeMemoryTool(toolName: string, args: unknown): Promise<MemoryToolResponse<unknown>> {
  console.log(`🧠 Executing memory tool: ${toolName} with args:`, args);

  try {
    switch (toolName) {
      case 'memory-store':
        return await memoryService.storeMemory(args as MemoryStoreRequest);

      case 'memory-search':
        return await memoryService.searchMemories({ query: args } as MemorySearchRequest);

      case 'memory-retrieve':
        return await memoryService.retrieveMemory(args as MemoryRetrieveRequest);

      case 'memory-update':
        return await memoryService.updateMemory(args as MemoryUpdateRequest);

      case 'memory-delete':
        return await memoryService.deleteMemory(args as MemoryDeleteRequest);

      default:
        return {
          success: false,
          error: `Unknown memory tool: ${toolName}`
        };
    }
  } catch (error) {
    console.error(`❌ Memory tool ${toolName} failed:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}

// Helper function to get memory tools in MCP format
export function getMemoryMCPTools() {
  return memoryMCPTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));
}

// Helper function to check if a tool is a memory tool
export function isMemoryTool(toolName: string): boolean {
  return memoryMCPTools.some(tool => tool.name === toolName);
}
