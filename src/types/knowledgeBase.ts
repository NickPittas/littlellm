// Knowledge Base System Type Definitions for LittleLLM

export interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  color: string;          // UI color identifier (hex color)
  icon: string;           // Icon identifier or emoji
  tableName: string;      // LanceDB table name
  documentCount: number;
  lastUpdated: Date;
  createdAt: Date;
  tags: string[];
  metadata: Record<string, unknown>;
  isDefault?: boolean;    // Whether this is the default KB
}

export interface KnowledgeBaseRegistry {
  knowledgeBases: KnowledgeBase[];
  defaultKnowledgeBaseId: string;
  version: string;
  lastUpdated: Date;
}

export interface CreateKnowledgeBaseRequest {
  name: string;
  description: string;
  color?: string;
  icon?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  isDefault?: boolean;
}

export interface UpdateKnowledgeBaseRequest {
  id: string;
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface KnowledgeBaseStats {
  totalRecords: number;
  totalDocuments: number;
  databaseSize: number;
  lastUpdated: Date;
}

// Enhanced document record with KB reference
export interface KnowledgeBaseRecord {
  id: string;
  text: string;
  vector: number[];
  source: string;
  knowledgeBaseId: string;  // Reference to the knowledge base
  chunkIndex: number;       // Chunk position in document
  documentId: string;       // Groups chunks from same document
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Search results from multiple knowledge bases
export interface MultiKBSearchResult {
  text: string;
  source: string;
  knowledgeBaseName: string;
  knowledgeBaseId: string;
  relevanceScore: number;
  chunkIndex: number;
  documentId: string;
  metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  maxResultsPerKB: number;
  relevanceThreshold: number;
  includeSourceAttribution: boolean;
  contextWindowTokens: number;
}

export interface ContextResult {
  text: string;
  source: string;
  knowledgeBaseName: string;
  knowledgeBaseId: string;
  relevanceScore: number;
  chunkIndex: number;
  documentId: string;
  metadata?: Record<string, unknown>;
}

// RAG-specific options for multi-KB system
export interface RAGOptions {
  maxResultsPerKB: number;
  relevanceThreshold: number;
  includeSourceAttribution: boolean;
  contextWindowTokens: number;
  aggregationStrategy: 'relevance' | 'balanced' | 'comprehensive';
}

// Knowledge base export/import
export interface KnowledgeBaseExportData {
  knowledgeBase: KnowledgeBase;
  records: KnowledgeBaseRecord[];
  exportedAt: Date;
  version: string;
  metadata: {
    totalRecords: number;
    totalDocuments: number;
    exportSize: number;
  };
}

export interface KnowledgeBaseImportResult {
  success: boolean;
  knowledgeBaseId?: string;
  importedRecords: number;
  skippedRecords: number;
  errors: string[];
  warnings: string[];
}

// Migration types for converting from single to multi-KB
export interface MigrationOptions {
  createDefaultKB: boolean;
  defaultKBName: string;
  defaultKBDescription: string;
  classificationRules?: DocumentClassificationRule[];
  backupExisting: boolean;
}

export interface DocumentClassificationRule {
  pattern: string;           // Regex pattern for filename/source
  knowledgeBaseId: string;   // Target KB ID
  priority: number;          // Rule priority (higher = more priority)
}

export interface MigrationResult {
  success: boolean;
  migratedRecords: number;
  createdKnowledgeBases: KnowledgeBase[];
  errors: string[];
  warnings: string[];
  backupPath?: string;
}

// Knowledge base selection for UI components
export interface KnowledgeBaseSelection {
  selectedKnowledgeBaseIds: string[];
  maxSelections?: number;
  required?: boolean;
}

// Progress tracking for knowledge base operations
export interface KnowledgeBaseOperationProgress {
  step: string;
  message: string;
  current?: number;
  total?: number;
  knowledgeBaseId?: string;
  knowledgeBaseName?: string;
  documentCount?: number;
  chunkCount?: number;
  status: 'starting' | 'processing' | 'success' | 'error' | 'complete';
  error?: string;
}

// Batch operation results
export interface BatchKnowledgeBaseResult {
  success: boolean;
  results: Array<{
    knowledgeBaseId: string;
    success: boolean;
    error?: string;
    recordsProcessed?: number;
  }>;
  summary: string;
}

// Default knowledge base colors and icons
export const DEFAULT_KB_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#F59E0B', // Yellow
  '#EF4444', // Red
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#84CC16', // Lime
  '#F97316', // Orange
  '#EC4899', // Pink
  '#6B7280', // Gray
];

export const DEFAULT_KB_ICONS = [
  '📚', '📖', '📄', '📝', '🔬', '💻', '🎨', '📊', '🌟', '🚀',
  '🔧', '📋', '💡', '🎯', '📈', '🔍', '⚡', '🌊', '🎬', '🎵'
];

// Predefined knowledge base templates
export interface KnowledgeBaseTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  tags: string[];
  category: 'development' | 'research' | 'creative' | 'business' | 'education' | 'general';
}

export const DEFAULT_KB_TEMPLATES: KnowledgeBaseTemplate[] = [
  {
    id: 'python-development',
    name: 'Python Development',
    description: 'Python code examples, tutorials, and documentation',
    icon: '🐍',
    color: '#3B82F6',
    tags: ['python', 'coding', 'development'],
    category: 'development'
  },
  {
    id: 'web-development',
    name: 'Web Development',
    description: 'Web technologies, frameworks, and best practices',
    icon: '🌐',
    color: '#10B981',
    tags: ['web', 'javascript', 'html', 'css'],
    category: 'development'
  },
  {
    id: 'after-effects',
    name: 'After Effects',
    description: 'After Effects tutorials, tips, and techniques',
    icon: '🎬',
    color: '#8B5CF6',
    tags: ['after-effects', 'motion-graphics', 'video'],
    category: 'creative'
  },
  {
    id: 'nuke-compositing',
    name: 'Nuke Compositing',
    description: 'Nuke compositing workflows and documentation',
    icon: '⚡',
    color: '#F59E0B',
    tags: ['nuke', 'compositing', 'vfx'],
    category: 'creative'
  },
  {
    id: 'research-papers',
    name: 'Research Papers',
    description: 'Academic papers and research documents',
    icon: '🔬',
    color: '#06B6D4',
    tags: ['research', 'academic', 'papers'],
    category: 'research'
  },
  {
    id: 'general-information',
    name: 'General Information',
    description: 'Miscellaneous documents and information',
    icon: '📚',
    color: '#6B7280',
    tags: ['general', 'misc', 'information'],
    category: 'general'
  }
];