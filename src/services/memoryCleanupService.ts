/**
 * Memory Cleanup Service for LiteLLM
 * Handles automatic memory maintenance, archiving, and optimization
 */

import { memoryService } from './memoryService';
import { MemoryEntry } from '../types/memory';

export interface CleanupConfig {
  maxMemories: number;
  maxAge: number; // days
  maxSize: number; // bytes
  archiveOldMemories: boolean;
  removeUnusedMemories: boolean;
  consolidateDuplicates: boolean;
  minAccessCount: number;
}

export interface CleanupResult {
  success: boolean;
  deleted: number;
  archived: number;
  consolidated: number;
  errors: string[];
  sizeBefore: number;
  sizeAfter: number;
}

class MemoryCleanupService {
  private readonly DEFAULT_CONFIG: CleanupConfig = {
    maxMemories: 1000,
    maxAge: 365, // 1 year
    maxSize: 50 * 1024 * 1024, // 50MB
    archiveOldMemories: true,
    removeUnusedMemories: false,
    consolidateDuplicates: true,
    minAccessCount: 0
  };

  /**
   * Perform automatic memory cleanup
   */
  async performCleanup(config: Partial<CleanupConfig> = {}): Promise<CleanupResult> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    const result: CleanupResult = {
      success: true,
      deleted: 0,
      archived: 0,
      consolidated: 0,
      errors: [],
      sizeBefore: 0,
      sizeAfter: 0
    };

    try {
      // Get current stats
      const statsResult = await memoryService.getMemoryStats();
      if (statsResult.success && statsResult.data) {
        result.sizeBefore = statsResult.data.totalSize;
      }

      // Get all memories for analysis
      const searchResult = await memoryService.searchMemories({
        query: { limit: 10000 }
      });

      if (!searchResult.success || !searchResult.data) {
        result.success = false;
        result.errors.push('Failed to retrieve memories for cleanup');
        return result;
      }

      const memories = searchResult.data.results.map(r => r.entry);
      console.log(`🧹 Starting cleanup of ${memories.length} memories`);

      // 1. Remove old memories
      if (finalConfig.maxAge > 0) {
        const oldMemories = this.findOldMemories(memories, finalConfig.maxAge);
        for (const memory of oldMemories) {
          if (finalConfig.archiveOldMemories) {
            // Archive instead of delete
            await this.archiveMemory(memory);
            result.archived++;
          } else {
            const deleteResult = await memoryService.deleteMemory({ id: memory.id });
            if (deleteResult.success) {
              result.deleted++;
            } else {
              result.errors.push(`Failed to delete old memory ${memory.id}: ${deleteResult.error}`);
            }
          }
        }
      }

      // 2. Remove unused memories
      if (finalConfig.removeUnusedMemories) {
        const unusedMemories = this.findUnusedMemories(memories, finalConfig.minAccessCount);
        for (const memory of unusedMemories) {
          const deleteResult = await memoryService.deleteMemory({ id: memory.id });
          if (deleteResult.success) {
            result.deleted++;
          } else {
            result.errors.push(`Failed to delete unused memory ${memory.id}: ${deleteResult.error}`);
          }
        }
      }

      // 3. Consolidate duplicates
      if (finalConfig.consolidateDuplicates) {
        const duplicateGroups = this.findDuplicateMemories(memories);
        for (const group of duplicateGroups) {
          const consolidateResult = await this.consolidateDuplicates(group);
          if (consolidateResult.success) {
            result.consolidated += consolidateResult.consolidated;
          } else {
            result.errors.push(`Failed to consolidate duplicates: ${consolidateResult.error}`);
          }
        }
      }

      // 4. Enforce memory limits
      if (finalConfig.maxMemories > 0) {
        const remainingMemories = memories.length - result.deleted;
        if (remainingMemories > finalConfig.maxMemories) {
          const excessCount = remainingMemories - finalConfig.maxMemories;
          const oldestMemories = this.findOldestMemories(memories, excessCount);
          
          for (const memory of oldestMemories) {
            if (finalConfig.archiveOldMemories) {
              await this.archiveMemory(memory);
              result.archived++;
            } else {
              const deleteResult = await memoryService.deleteMemory({ id: memory.id });
              if (deleteResult.success) {
                result.deleted++;
              } else {
                result.errors.push(`Failed to delete excess memory ${memory.id}: ${deleteResult.error}`);
              }
            }
          }
        }
      }

      // Get final stats
      const finalStatsResult = await memoryService.getMemoryStats();
      if (finalStatsResult.success && finalStatsResult.data) {
        result.sizeAfter = finalStatsResult.data.totalSize;
      }

      console.log(`🧹 Cleanup completed: ${result.deleted} deleted, ${result.archived} archived, ${result.consolidated} consolidated`);

    } catch (error) {
      result.success = false;
      result.errors.push(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Find memories older than specified days
   */
  private findOldMemories(memories: MemoryEntry[], maxAgeDays: number): MemoryEntry[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

    return memories.filter(memory => {
      const memoryDate = new Date(memory.createdAt);
      return memoryDate < cutoffDate;
    });
  }

  /**
   * Find memories with low access counts
   */
  private findUnusedMemories(memories: MemoryEntry[], minAccessCount: number): MemoryEntry[] {
    return memories.filter(memory => {
      const accessCount = memory.metadata.accessCount || 0;
      return accessCount < minAccessCount;
    });
  }

  /**
   * Find oldest memories for removal
   */
  private findOldestMemories(memories: MemoryEntry[], count: number): MemoryEntry[] {
    return memories
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      .slice(0, count);
  }

  /**
   * Find duplicate memories based on content similarity
   */
  private findDuplicateMemories(memories: MemoryEntry[]): MemoryEntry[][] {
    const duplicateGroups: MemoryEntry[][] = [];
    const processed = new Set<string>();

    for (const memory of memories) {
      if (processed.has(memory.id)) continue;

      const duplicates = memories.filter(other => 
        other.id !== memory.id && 
        !processed.has(other.id) &&
        this.areSimilar(memory, other)
      );

      if (duplicates.length > 0) {
        const group = [memory, ...duplicates];
        duplicateGroups.push(group);
        
        // Mark all as processed
        group.forEach(m => processed.add(m.id));
      }
    }

    return duplicateGroups;
  }

  /**
   * Check if two memories are similar enough to be considered duplicates
   */
  private areSimilar(memory1: MemoryEntry, memory2: MemoryEntry): boolean {
    // Same type and similar title
    if (memory1.type === memory2.type && 
        this.calculateSimilarity(memory1.title, memory2.title) > 0.8) {
      return true;
    }

    // Similar content
    if (this.calculateSimilarity(memory1.content, memory2.content) > 0.9) {
      return true;
    }

    return false;
  }

  /**
   * Calculate text similarity (simple implementation)
   */
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    
    const set1 = new Set(words1);
    const set2 = new Set(words2);
    
    const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
    const union = new Set([...Array.from(set1), ...Array.from(set2)]);
    
    return intersection.size / union.size;
  }

  /**
   * Consolidate duplicate memories
   */
  private async consolidateDuplicates(duplicates: MemoryEntry[]): Promise<{ success: boolean; consolidated: number; error?: string }> {
    try {
      if (duplicates.length < 2) {
        return { success: true, consolidated: 0 };
      }

      // Find the best memory to keep (most recent or most accessed)
      const keeper = duplicates.reduce((best, current) => {
        const bestAccess = best.metadata.accessCount || 0;
        const currentAccess = current.metadata.accessCount || 0;
        
        if (currentAccess > bestAccess) return current;
        if (currentAccess === bestAccess) {
          return new Date(current.updatedAt) > new Date(best.updatedAt) ? current : best;
        }
        return best;
      });

      // Merge tags from all duplicates
      const allTags = new Set<string>();
      duplicates.forEach(memory => {
        memory.metadata.tags.forEach(tag => allTags.add(tag));
      });

      // Update the keeper with merged information
      const updateResult = await memoryService.updateMemory({
        id: keeper.id,
        title: keeper.title,
        content: keeper.content,
        tags: Array.from(allTags),
        type: keeper.type
      });

      if (!updateResult.success) {
        return { success: false, consolidated: 0, error: updateResult.error };
      }

      // Delete the duplicates
      let consolidated = 0;
      for (const duplicate of duplicates) {
        if (duplicate.id !== keeper.id) {
          const deleteResult = await memoryService.deleteMemory({ id: duplicate.id });
          if (deleteResult.success) {
            consolidated++;
          }
        }
      }

      return { success: true, consolidated };
    } catch (error) {
      return {
        success: false,
        consolidated: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Archive a memory (mark as archived instead of deleting)
   */
  private async archiveMemory(memory: MemoryEntry): Promise<boolean> {
    try {
      // Add archive tag and update
      const archiveTags = [...memory.metadata.tags, 'archived'];
      const updateResult = await memoryService.updateMemory({
        id: memory.id,
        title: `[ARCHIVED] ${memory.title}`,
        content: memory.content,
        tags: archiveTags,
        type: memory.type
      });

      return updateResult.success;
    } catch (error) {
      console.error('Failed to archive memory:', error);
      return false;
    }
  }

  /**
   * Get cleanup recommendations
   */
  async getCleanupRecommendations(): Promise<{
    oldMemories: number;
    unusedMemories: number;
    duplicateGroups: number;
    totalSize: number;
    recommendations: string[];
  }> {
    const recommendations: string[] = [];
    
    try {
      // Get all memories
      const searchResult = await memoryService.searchMemories({
        query: { limit: 10000 }
      });

      if (!searchResult.success || !searchResult.data) {
        return {
          oldMemories: 0,
          unusedMemories: 0,
          duplicateGroups: 0,
          totalSize: 0,
          recommendations: ['Unable to analyze memories for cleanup recommendations']
        };
      }

      const memories = searchResult.data.results.map(r => r.entry);
      
      // Analyze old memories
      const oldMemories = this.findOldMemories(memories, 365);
      if (oldMemories.length > 0) {
        recommendations.push(`${oldMemories.length} memories are older than 1 year and could be archived`);
      }

      // Analyze unused memories
      const unusedMemories = this.findUnusedMemories(memories, 1);
      if (unusedMemories.length > 0) {
        recommendations.push(`${unusedMemories.length} memories have never been accessed`);
      }

      // Analyze duplicates
      const duplicateGroups = this.findDuplicateMemories(memories);
      if (duplicateGroups.length > 0) {
        const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.length - 1, 0);
        recommendations.push(`${duplicateGroups.length} groups of duplicates found (${totalDuplicates} duplicates total)`);
      }

      // Get size info
      const statsResult = await memoryService.getMemoryStats();
      const totalSize = statsResult.success ? statsResult.data!.totalSize : 0;

      if (totalSize > 10 * 1024 * 1024) { // 10MB
        recommendations.push(`Memory storage is ${Math.round(totalSize / 1024 / 1024)}MB - consider cleanup`);
      }

      if (memories.length > 500) {
        recommendations.push(`${memories.length} total memories - consider setting limits`);
      }

      if (recommendations.length === 0) {
        recommendations.push('No cleanup needed - memory system is well maintained');
      }

      return {
        oldMemories: oldMemories.length,
        unusedMemories: unusedMemories.length,
        duplicateGroups: duplicateGroups.length,
        totalSize,
        recommendations
      };
    } catch (error) {
      return {
        oldMemories: 0,
        unusedMemories: 0,
        duplicateGroups: 0,
        totalSize: 0,
        recommendations: [`Error analyzing memories: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
}

// Export singleton instance
export const memoryCleanupService = new MemoryCleanupService();
