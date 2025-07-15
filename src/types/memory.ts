/**
 * Memory system types and interfaces for LiteLLM
 */

export type MemoryType = 
  | 'user_preference' 
  | 'conversation_context' 
  | 'project_knowledge' 
  | 'code_snippet' 
  | 'solution'
  | 'general';

export interface MemoryMetadata {
  tags: string[];
  timestamp: Date;
  relevanceScore?: number;
  projectId?: string;
  conversationId?: string;
  source?: string; // Where this memory came from
  lastAccessed?: Date;
  accessCount?: number;
}

export interface MemoryEntry {
  id: string;
  type: MemoryType;
  title: string;
  content: string;
  metadata: MemoryMetadata;
  searchableText: string; // Processed content for search optimization
  createdAt: Date;
  updatedAt: Date;
}

export interface MemoryIndex {
  entries: MemoryIndexEntry[];
  lastUpdated: Date;
  totalEntries: number;
  version: string;
}

export interface MemoryIndexEntry {
  id: string;
  type: MemoryType;
  title: string;
  tags: string[];
  timestamp: Date;
  relevanceScore?: number;
  projectId?: string;
  conversationId?: string;
  fileSize: number; // Size of the memory entry file
}

export interface SearchQuery {
  text?: string;
  type?: MemoryType;
  tags?: string[];
  projectId?: string;
  conversationId?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  entry: MemoryEntry;
  relevanceScore: number;
  matchedFields: string[]; // Which fields matched the search
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  query: SearchQuery;
  executionTime: number;
}

export interface MemoryStats {
  totalEntries: number;
  entriesByType: Record<MemoryType, number>;
  totalSize: number; // Total size in bytes
  oldestEntry?: Date;
  newestEntry?: Date;
  mostAccessedEntry?: MemoryIndexEntry;
}

// MCP Tool interfaces
export interface MemoryStoreRequest {
  type: MemoryType;
  title: string;
  content: string;
  tags?: string[];
  projectId?: string;
  conversationId?: string;
  source?: string;
}

export interface MemorySearchRequest {
  query: SearchQuery;
}

export interface MemoryRetrieveRequest {
  id: string;
}

export interface MemoryUpdateRequest {
  id: string;
  title?: string;
  content?: string;
  tags?: string[];
  type?: MemoryType;
}

export interface MemoryDeleteRequest {
  id: string;
}

// Response types for MCP tools
export interface MemoryToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
