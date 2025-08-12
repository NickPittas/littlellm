/**
 * Memory Export/Import Service for LiteLLM
 * Handles backup, restore, and migration of memory data
 */

import { memoryService } from './memoryService';
import { MemoryEntry, MemoryIndex, MemoryStats, MemoryType } from '../types/memory';

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('./debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}
interface ElectronSaveResult {
  success: boolean;
  filename?: string;
  error?: string;
}

interface ElectronLoadResult {
  success: boolean;
  data?: MemoryExport;
  error?: string;
}

export interface MemoryExport {
  version: string;
  exportDate: Date;
  totalEntries: number;
  memories: MemoryEntry[];
  index: MemoryIndex;
  stats: MemoryStats;
  metadata: {
    exportedBy: string;
    source: string;
    description?: string;
  };
}

export interface ExportOptions {
  includeTypes?: string[];
  excludeTypes?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  projectId?: string;
  tags?: string[];
  description?: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
  duplicates: number;
}

class MemoryExportService {
  private readonly EXPORT_VERSION = '1.0.0';

  /**
   * Export memories to a JSON file
   */
  async exportMemories(options: ExportOptions = {}): Promise<{ success: boolean; data?: MemoryExport; error?: string }> {
    try {
      // Get all memories based on filters
      const searchResult = await memoryService.searchMemories({
        query: {
          type: options.includeTypes?.[0] as MemoryType,
          tags: options.tags,
          projectId: options.projectId,
          dateRange: options.dateRange,
          limit: 10000 // Large limit to get all memories
        }
      });

      if (!searchResult.success || !searchResult.data) {
        return {
          success: false,
          error: 'Failed to retrieve memories for export'
        };
      }

      let memories = searchResult.data.results.map(r => r.entry);

      // Apply additional filters
      if (options.excludeTypes && options.excludeTypes.length > 0) {
        memories = memories.filter(memory => !options.excludeTypes!.includes(memory.type));
      }

      if (options.includeTypes && options.includeTypes.length > 0) {
        memories = memories.filter(memory => options.includeTypes!.includes(memory.type));
      }

      // Get current stats
      const statsResult = await memoryService.getMemoryStats();
      const stats: MemoryStats = statsResult.success ? statsResult.data! : {
        totalEntries: memories.length,
        entriesByType: {
          user_preference: 0,
          conversation_context: 0,
          project_knowledge: 0,
          code_snippet: 0,
          solution: 0,
          general: 0
        },
        totalSize: 0
      };

      // Create export data
      const exportData: MemoryExport = {
        version: this.EXPORT_VERSION,
        exportDate: new Date(),
        totalEntries: memories.length,
        memories,
        index: {
          entries: memories.map(memory => ({
            id: memory.id,
            type: memory.type,
            title: memory.title,
            tags: memory.metadata.tags,
            timestamp: memory.metadata.timestamp,
            relevanceScore: memory.metadata.relevanceScore,
            projectId: memory.metadata.projectId,
            conversationId: memory.metadata.conversationId,
            fileSize: JSON.stringify(memory).length
          })),
          lastUpdated: new Date(),
          totalEntries: memories.length,
          version: this.EXPORT_VERSION
        },
        stats,
        metadata: {
          exportedBy: 'LiteLLM Memory System',
          source: 'manual_export',
          description: options.description || `Memory export containing ${memories.length} entries`
        }
      };

      return {
        success: true,
        data: exportData
      };
    } catch (error) {
      safeDebugLog('error', 'MEMORYEXPORTSERVICE', 'Error exporting memories:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Import memories from exported data
   */
  async importMemories(exportData: MemoryExport, options: { 
    overwriteExisting?: boolean;
    skipDuplicates?: boolean;
    validateData?: boolean;
  } = {}): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: 0,
      skipped: 0,
      errors: [],
      duplicates: 0
    };

    try {
      // Validate export data
      if (options.validateData !== false) {
        const validation = this.validateExportData(exportData);
        if (!validation.valid) {
          result.success = false;
          result.errors = validation.errors;
          return result;
        }
      }

      // Process each memory
      for (const memory of exportData.memories) {
        try {
          // Check if memory already exists
          const existingResult = await memoryService.retrieveMemory({ id: memory.id });
          
          if (existingResult.success && existingResult.data) {
            // Memory exists
            if (options.skipDuplicates) {
              result.duplicates++;
              result.skipped++;
              continue;
            } else if (options.overwriteExisting) {
              // Update existing memory
              const updateResult = await memoryService.updateMemory({
                id: memory.id,
                title: memory.title,
                content: memory.content,
                tags: memory.metadata.tags,
                type: memory.type
              });

              if (updateResult.success) {
                result.imported++;
              } else {
                result.errors.push(`Failed to update memory ${memory.id}: ${updateResult.error}`);
              }
            } else {
              result.duplicates++;
              result.skipped++;
            }
          } else {
            // Memory doesn't exist, create new one
            const storeResult = await memoryService.storeMemory({
              type: memory.type,
              title: memory.title,
              content: memory.content,
              tags: memory.metadata.tags,
              projectId: memory.metadata.projectId,
              conversationId: memory.metadata.conversationId,
              source: 'import'
            });

            if (storeResult.success) {
              result.imported++;
            } else {
              result.errors.push(`Failed to import memory ${memory.id}: ${storeResult.error}`);
            }
          }
        } catch (error) {
          result.errors.push(`Error processing memory ${memory.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Set overall success based on whether any imports succeeded
      result.success = result.imported > 0 || result.errors.length === 0;

    } catch (error) {
      result.success = false;
      result.errors.push(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Save export data to file (Electron)
   */
  async saveExportToFile(exportData: MemoryExport, filename?: string): Promise<{ success: boolean; filename?: string; error?: string }> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const defaultFilename = filename || `littlellm-memories-${new Date().toISOString().split('T')[0]}.json`;
        
        // Use Electron's save dialog
        const result = await window.electronAPI.saveMemoryExport?.(exportData, defaultFilename) as unknown as ElectronSaveResult;
        
        if (result?.success) {
          return {
            success: true,
            filename: result.filename
          };
        } else {
          return {
            success: false,
            error: result?.error || 'Failed to save export file'
          };
        }
      } else {
        // Fallback for non-Electron environments
        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename || `littlellm-memories-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return {
          success: true,
          filename: link.download
        };
      }
    } catch (error) {
      safeDebugLog('error', 'MEMORYEXPORTSERVICE', 'Error saving export file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Load export data from file (Electron)
   */
  async loadExportFromFile(): Promise<{ success: boolean; data?: MemoryExport; error?: string }> {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const result = await window.electronAPI.loadMemoryExport?.() as unknown as ElectronLoadResult;
        
        if (result?.success) {
          return {
            success: true,
            data: result.data
          };
        } else {
          return {
            success: false,
            error: result?.error || 'Failed to load export file'
          };
        }
      } else {
        return {
          success: false,
          error: 'File loading not available in this environment'
        };
      }
    } catch (error) {
      safeDebugLog('error', 'MEMORYEXPORTSERVICE', 'Error loading export file:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Validate export data structure
   */
  private validateExportData(exportData: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!exportData || typeof exportData !== 'object') {
      errors.push('Export data is null, undefined, or not an object');
      return { valid: false, errors };
    }

    const data = exportData as Record<string, unknown>;

    if (!data.version) {
      errors.push('Missing version information');
    }

    if (!data.memories || !Array.isArray(data.memories)) {
      errors.push('Invalid or missing memories array');
    }

    if (!data.exportDate) {
      errors.push('Missing export date');
    }

    if (Array.isArray(data.memories)) {
      data.memories.forEach((memory: unknown, index: number) => {
        if (!memory || typeof memory !== 'object') {
          errors.push(`Memory at index ${index} is not a valid object`);
          return;
        }

        const memoryObj = memory as Record<string, unknown>;

        if (!memoryObj.id) {
          errors.push(`Memory at index ${index} missing ID`);
        }
        if (!memoryObj.type) {
          errors.push(`Memory at index ${index} missing type`);
        }
        if (!memoryObj.title) {
          errors.push(`Memory at index ${index} missing title`);
        }
        if (!memoryObj.content) {
          errors.push(`Memory at index ${index} missing content`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get export statistics
   */
  async getExportStats(exportData: MemoryExport): Promise<{
    totalSize: number;
    memoriesByType: Record<string, number>;
    dateRange: { oldest: Date; newest: Date };
    topTags: Array<{ tag: string; count: number }>;
  }> {
    const stats = {
      totalSize: JSON.stringify(exportData).length,
      memoriesByType: {} as Record<string, number>,
      dateRange: { oldest: new Date(), newest: new Date(0) },
      topTags: [] as Array<{ tag: string; count: number }>
    };

    const tagCounts: Record<string, number> = {};

    exportData.memories.forEach(memory => {
      // Count by type
      stats.memoriesByType[memory.type] = (stats.memoriesByType[memory.type] || 0) + 1;

      // Track date range
      const memoryDate = new Date(memory.createdAt);
      if (memoryDate < stats.dateRange.oldest) {
        stats.dateRange.oldest = memoryDate;
      }
      if (memoryDate > stats.dateRange.newest) {
        stats.dateRange.newest = memoryDate;
      }

      // Count tags
      memory.metadata.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });

    // Get top 10 tags
    stats.topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }));

    return stats;
  }
}

// Export singleton instance
export const memoryExportService = new MemoryExportService();
