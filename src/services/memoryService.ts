/* eslint-disable no-console */
/**
 * Memory Service for LiteLLM
 * Handles persistent memory storage, retrieval, and search functionality
 */

import {
  MemoryEntry, 
  MemoryIndex, 
  MemoryIndexEntry, 
  MemoryType, 
  SearchQuery, 
  SearchResult, 
  SearchResponse,
  MemoryStats,
  MemoryStoreRequest,
  MemorySearchRequest,
  MemoryRetrieveRequest,
  MemoryUpdateRequest,
  MemoryDeleteRequest,
  MemoryToolResponse
} from '../types/memory';

// Memory operations will be available on the existing ElectronAPI interface

class MemoryService {
  private memoryIndex: MemoryIndex | null = null;
  private initialized = false;
  private readonly MEMORY_VERSION = '1.0.0';

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load memory index from disk
      if (typeof window !== 'undefined' && window.electronAPI) {
        const index = await window.electronAPI.loadMemoryIndex();
        
        if (index) {
          this.memoryIndex = {
            ...index,
            lastUpdated: new Date(index.lastUpdated),
            entries: index.entries.map((entry: MemoryIndexEntry & {timestamp: string | Date}) => ({
              ...entry,
              timestamp: new Date(entry.timestamp)
            }))
          };
          console.log(`Loaded ${this.memoryIndex?.entries.length || 0} memory entries from disk`);
        } else {
          // Create new index if none exists
          this.memoryIndex = {
            entries: [],
            lastUpdated: new Date(),
            totalEntries: 0,
            version: this.MEMORY_VERSION
          };
          await this.saveIndex();
          console.log('Created new memory index');
        }
      } else {
        // Fallback for non-Electron environments
        this.memoryIndex = {
          entries: [],
          lastUpdated: new Date(),
          totalEntries: 0,
          version: this.MEMORY_VERSION
        };
      }
    } catch (error) {
      console.error('Failed to initialize memory service:', error);
      this.memoryIndex = {
        entries: [],
        lastUpdated: new Date(),
        totalEntries: 0,
        version: this.MEMORY_VERSION
      };
    }

    this.initialized = true;
  }

  private async saveIndex(): Promise<boolean> {
    if (!this.memoryIndex) return false;

    try {
      if (typeof window !== 'undefined' && window.electronAPI?.saveMemoryIndex) {
        const serializedIndex = {
          ...this.memoryIndex,
          lastUpdated: this.memoryIndex.lastUpdated.toISOString(),
          entries: this.memoryIndex.entries.map(entry => ({
            ...entry,
            timestamp: entry.timestamp.toISOString()
          }))
        };

        const success = await window.electronAPI.saveMemoryIndex(serializedIndex as unknown as MemoryIndex);
        if (success) {
          console.log('Memory index saved successfully');
        } else {
          console.error('Failed to save memory index');
        }
        return success;
      }
    } catch (error) {
      console.error('Error saving memory index:', error);
    }
    return false;
  }

  private generateId(): string {
    return `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private createSearchableText(title: string, content: string, tags: string[]): string {
    return [title, content, ...tags].join(' ').toLowerCase();
  }

  async storeMemory(request: MemoryStoreRequest): Promise<MemoryToolResponse<MemoryEntry>> {
    await this.initialize();

    try {
      const id = this.generateId();
      const now = new Date();
      
      const entry: MemoryEntry = {
        id,
        type: request.type,
        title: request.title,
        content: request.content,
        metadata: {
          tags: request.tags || [],
          timestamp: now,
          projectId: request.projectId,
          conversationId: request.conversationId,
          source: request.source,
          accessCount: 0
        },
        searchableText: this.createSearchableText(request.title, request.content, request.tags || []),
        createdAt: now,
        updatedAt: now
      };

      // Save entry to file
      if (typeof window !== 'undefined' && window.electronAPI?.saveMemoryEntry) {
        const success = await window.electronAPI.saveMemoryEntry(entry);
        if (!success) {
          return {
            success: false,
            error: 'Failed to save memory entry to disk'
          };
        }
      }

      // Add to index
      const indexEntry: MemoryIndexEntry = {
        id: entry.id,
        type: entry.type,
        title: entry.title,
        tags: entry.metadata.tags,
        timestamp: entry.metadata.timestamp,
        relevanceScore: entry.metadata.relevanceScore,
        projectId: entry.metadata.projectId,
        conversationId: entry.metadata.conversationId,
        fileSize: JSON.stringify(entry).length
      };

      this.memoryIndex!.entries.unshift(indexEntry);
      this.memoryIndex!.totalEntries = this.memoryIndex!.entries.length;
      this.memoryIndex!.lastUpdated = now;

      // Keep only last 1000 entries in index for performance
      if (this.memoryIndex!.entries.length > 1000) {
        this.memoryIndex!.entries = this.memoryIndex!.entries.slice(0, 1000);
      }

      await this.saveIndex();

      return {
        success: true,
        data: entry,
        message: `Memory stored successfully with ID: ${id}`
      };
    } catch (error) {
      console.error('Error storing memory:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async retrieveMemory(request: MemoryRetrieveRequest): Promise<MemoryToolResponse<MemoryEntry>> {
    await this.initialize();

    try {
      if (typeof window !== 'undefined' && window.electronAPI?.loadMemoryEntry) {
        const entry = await window.electronAPI.loadMemoryEntry(request.id);
        
        if (entry) {
          // Update access tracking
          entry.metadata.lastAccessed = new Date();
          entry.metadata.accessCount = (entry.metadata.accessCount || 0) + 1;
          
          // Save updated entry
          await window.electronAPI.saveMemoryEntry(entry);

          return {
            success: true,
            data: {
              ...entry,
              createdAt: new Date(entry.createdAt),
              updatedAt: new Date(entry.updatedAt),
              metadata: {
                ...entry.metadata,
                timestamp: new Date(entry.metadata.timestamp),
                lastAccessed: entry.metadata.lastAccessed
              }
            }
          };
        } else {
          return {
            success: false,
            error: `Memory entry with ID ${request.id} not found`
          };
        }
      }

      return {
        success: false,
        error: 'Memory retrieval not available in this environment'
      };
    } catch (error) {
      console.error('Error retrieving memory:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async searchMemories(request: MemorySearchRequest): Promise<MemoryToolResponse<SearchResponse>> {
    await this.initialize();

    try {
      const query = request.query;
      const startTime = performance.now();

      if (!this.memoryIndex) {
        return {
          success: false,
          error: 'Memory index not available'
        };
      }

      // Filter entries based on query criteria
      let filteredEntries = this.memoryIndex.entries;

      // Filter by type
      if (query.type) {
        filteredEntries = filteredEntries.filter(entry => entry.type === query.type);
      }

      // Filter by tags
      if (query.tags && query.tags.length > 0) {
        filteredEntries = filteredEntries.filter(entry =>
          query.tags!.some(tag => entry.tags.includes(tag))
        );
      }

      // Filter by project ID
      if (query.projectId) {
        filteredEntries = filteredEntries.filter(entry => entry.projectId === query.projectId);
      }

      // Filter by conversation ID
      if (query.conversationId) {
        filteredEntries = filteredEntries.filter(entry => entry.conversationId === query.conversationId);
      }

      // Filter by date range
      if (query.dateRange) {
        filteredEntries = filteredEntries.filter(entry => {
          const entryDate = entry.timestamp;
          return entryDate >= query.dateRange!.start && entryDate <= query.dateRange!.end;
        });
      }

      // Enhanced text search - search in title, tags, AND content
      if (query.text) {
        const searchText = query.text.toLowerCase();
        const searchTerms = searchText.split(/\s+/).filter(term => term.length > 0);

        filteredEntries = filteredEntries.filter(entry => {
          // Load full entry to search content
          const entryText = (entry.title + ' ' + entry.tags.join(' ')).toLowerCase();

          // Check if any search term matches title or tags
          const titleTagMatch = searchTerms.some(term =>
            entryText.includes(term)
          );

          if (titleTagMatch) return true;

          // For more thorough search, we need to load the full entry content
          // This is a simplified approach - in production, you'd want to index content
          return false; // Will be enhanced with content search below
        });

        // Enhanced search: Load full entries and search content
        const enhancedResults = [];
        for (const indexEntry of filteredEntries) {
          if (typeof window !== 'undefined' && window.electronAPI?.loadMemoryEntry) {
            const fullEntry = await window.electronAPI.loadMemoryEntry(indexEntry.id);
            if (fullEntry) {
              const fullText = (fullEntry.title + ' ' + fullEntry.content + ' ' + fullEntry.metadata.tags.join(' ')).toLowerCase();
              const hasMatch = searchTerms.some(term => fullText.includes(term));
              if (hasMatch) {
                enhancedResults.push(indexEntry);
              }
            }
          }
        }

        // Also search entries that didn't match title/tags but might match content
        const remainingEntries = this.memoryIndex.entries.filter(entry => !filteredEntries.includes(entry));
        for (const indexEntry of remainingEntries.slice(0, 50)) { // Limit to avoid performance issues
          if (typeof window !== 'undefined' && window.electronAPI?.loadMemoryEntry) {
            const fullEntry = await window.electronAPI.loadMemoryEntry(indexEntry.id);
            if (fullEntry) {
              const fullText = (fullEntry.title + ' ' + fullEntry.content + ' ' + fullEntry.metadata.tags.join(' ')).toLowerCase();
              const hasMatch = searchTerms.some(term => fullText.includes(term));
              if (hasMatch) {
                enhancedResults.push(indexEntry);
              }
            }
          }
        }

        filteredEntries = enhancedResults;
      }

      // Sort by relevance (timestamp for now, can be enhanced)
      filteredEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

      // Apply pagination
      const offset = query.offset || 0;
      const limit = query.limit || 50;
      const paginatedEntries = filteredEntries.slice(offset, offset + limit);

      // Load full entries for results
      const results: SearchResult[] = [];

      for (const indexEntry of paginatedEntries) {
        if (typeof window !== 'undefined' && window.electronAPI?.loadMemoryEntry) {
          const fullEntry = await window.electronAPI.loadMemoryEntry(indexEntry.id);
          if (fullEntry) {
            results.push({
              entry: {
                ...fullEntry,
                createdAt: new Date(fullEntry.createdAt),
                updatedAt: new Date(fullEntry.updatedAt),
                metadata: {
                  ...fullEntry.metadata,
                  timestamp: new Date(fullEntry.metadata.timestamp),
                  lastAccessed: fullEntry.metadata.lastAccessed ? new Date(fullEntry.metadata.lastAccessed) : undefined
                }
              },
              relevanceScore: indexEntry.relevanceScore || 1.0,
              matchedFields: this.getMatchedFields(fullEntry, query)
            });
          }
        }
      }

      const executionTime = performance.now() - startTime;

      return {
        success: true,
        data: {
          results,
          totalCount: filteredEntries.length,
          query,
          executionTime
        }
      };
    } catch (error) {
      console.error('Error searching memories:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private getMatchedFields(entry: MemoryEntry, query: SearchQuery): string[] {
    const matchedFields: string[] = [];

    if (query.text) {
      const searchText = query.text.toLowerCase();
      const searchTerms = searchText.split(/\s+/).filter(term => term.length > 0);

      // Check title matches
      const titleText = entry.title.toLowerCase();
      if (searchTerms.some(term => titleText.includes(term))) {
        matchedFields.push('title');
      }

      // Check content matches
      const contentText = entry.content.toLowerCase();
      if (searchTerms.some(term => contentText.includes(term))) {
        matchedFields.push('content');
      }

      // Check tag matches
      const tagText = entry.metadata.tags.join(' ').toLowerCase();
      if (searchTerms.some(term => tagText.includes(term))) {
        matchedFields.push('tags');
      }

      // Add fuzzy matching for better results
      if (matchedFields.length === 0) {
        // Try partial word matching
        const allText = (titleText + ' ' + contentText + ' ' + tagText);
        for (const term of searchTerms) {
          if (term.length >= 3) { // Only for terms 3+ chars
            // Check if any word starts with the search term
            const words = allText.split(/\s+/);
            if (words.some(word => word.startsWith(term))) {
              matchedFields.push('partial_match');
              break;
            }
          }
        }
      }
    }

    return matchedFields;
  }

  async updateMemory(request: MemoryUpdateRequest): Promise<MemoryToolResponse<MemoryEntry>> {
    await this.initialize();

    try {
      if (typeof window !== 'undefined' && window.electronAPI?.loadMemoryEntry) {
        const existingEntry = await window.electronAPI.loadMemoryEntry(request.id);

        if (!existingEntry) {
          return {
            success: false,
            error: `Memory entry with ID ${request.id} not found`
          };
        }

        // Update entry fields
        const updatedEntry: MemoryEntry = {
          ...existingEntry,
          title: request.title || existingEntry.title,
          content: request.content || existingEntry.content,
          type: request.type || existingEntry.type,
          metadata: {
            ...existingEntry.metadata,
            tags: request.tags || existingEntry.metadata.tags,
            timestamp: new Date(existingEntry.metadata.timestamp)
          },
          updatedAt: new Date(),
          createdAt: new Date(existingEntry.createdAt)
        };

        // Regenerate searchable text
        updatedEntry.searchableText = this.createSearchableText(
          updatedEntry.title,
          updatedEntry.content,
          updatedEntry.metadata.tags
        );

        // Save updated entry
        const success = await window.electronAPI.saveMemoryEntry(updatedEntry);
        if (!success) {
          return {
            success: false,
            error: 'Failed to save updated memory entry'
          };
        }

        // Update index entry
        const indexEntryIndex = this.memoryIndex!.entries.findIndex(e => e.id === request.id);
        if (indexEntryIndex !== -1) {
          this.memoryIndex!.entries[indexEntryIndex] = {
            ...this.memoryIndex!.entries[indexEntryIndex],
            title: updatedEntry.title,
            type: updatedEntry.type,
            tags: updatedEntry.metadata.tags,
            fileSize: JSON.stringify(updatedEntry).length
          };

          this.memoryIndex!.lastUpdated = new Date();
          await this.saveIndex();
        }

        return {
          success: true,
          data: updatedEntry,
          message: `Memory entry ${request.id} updated successfully`
        };
      }

      return {
        success: false,
        error: 'Memory update not available in this environment'
      };
    } catch (error) {
      console.error('Error updating memory:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async deleteMemory(request: MemoryDeleteRequest): Promise<MemoryToolResponse<void>> {
    await this.initialize();

    try {
      if (typeof window !== 'undefined' && window.electronAPI?.deleteMemoryEntry) {
        const success = await window.electronAPI.deleteMemoryEntry(request.id);

        if (success) {
          // Remove from index
          const indexEntryIndex = this.memoryIndex!.entries.findIndex(e => e.id === request.id);
          if (indexEntryIndex !== -1) {
            this.memoryIndex!.entries.splice(indexEntryIndex, 1);
            this.memoryIndex!.totalEntries = this.memoryIndex!.entries.length;
            this.memoryIndex!.lastUpdated = new Date();
            await this.saveIndex();
          }

          return {
            success: true,
            message: `Memory entry ${request.id} deleted successfully`
          };
        } else {
          return {
            success: false,
            error: `Failed to delete memory entry ${request.id}`
          };
        }
      }

      return {
        success: false,
        error: 'Memory deletion not available in this environment'
      };
    } catch (error) {
      console.error('Error deleting memory:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  async getMemoryStats(): Promise<MemoryToolResponse<MemoryStats>> {
    await this.initialize();

    try {
      if (!this.memoryIndex) {
        return {
          success: false,
          error: 'Memory index not available'
        };
      }

      const entriesByType: Record<string, number> = {};
      let oldestEntry: Date | undefined;
      let newestEntry: Date | undefined;
      let mostAccessedEntry: MemoryIndexEntry | undefined;

      for (const entry of this.memoryIndex.entries) {
        // Count by type
        entriesByType[entry.type] = (entriesByType[entry.type] || 0) + 1;

        // Find oldest and newest
        if (!oldestEntry || entry.timestamp < oldestEntry) {
          oldestEntry = entry.timestamp;
        }
        if (!newestEntry || entry.timestamp > newestEntry) {
          newestEntry = entry.timestamp;
        }

        // For now, use the most recent entry as "most accessed"
        // TODO: Implement proper access tracking in the future
        if (!mostAccessedEntry || entry.timestamp > mostAccessedEntry.timestamp) {
          mostAccessedEntry = entry;
        }
      }

      // Get total size from Electron API
      let totalSize = 0;
      if (typeof window !== 'undefined' && window.electronAPI?.getMemoryStats) {
        const stats = await window.electronAPI.getMemoryStats();
        totalSize = stats.totalSize;
      }

      const memoryStats: MemoryStats = {
        totalEntries: this.memoryIndex.totalEntries,
        entriesByType: entriesByType as Record<MemoryType, number>,
        totalSize,
        oldestEntry,
        newestEntry,
        mostAccessedEntry
      };

      return {
        success: true,
        data: memoryStats
      };
    } catch (error) {
      console.error('Error getting memory stats:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

// Export singleton instance
export const memoryService = new MemoryService();
