// Knowledge Base Migration Service for converting single KB to multi-KB system
import * as lancedb from 'vectordb';
import * as path from 'path';
import * as fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import {
  KnowledgeBase,
  MigrationOptions,
  MigrationResult,
  DocumentClassificationRule,
  DEFAULT_KB_TEMPLATES,
  CreateKnowledgeBaseRequest
} from '../types/knowledgeBase.js';
import { knowledgeBaseRegistry } from './KnowledgeBaseRegistry';

// Constants for frequently used strings
const UNKNOWN_ERROR_MESSAGE = 'Unknown error';
const PYTHON_FILE_PATTERN = '\\.(py|python)$|python|\\.py';

interface LegacyRecord {
  id: string;
  text: string;
  vector: number[];
  source: string;
  metadata?: Record<string, unknown>;
  chunkIndex?: number;
}

/**
 * Service for migrating from single knowledge base to multi-knowledge base system
 */
export class KnowledgeBaseMigrationService {
  private static instance: KnowledgeBaseMigrationService;

  private constructor() {}

  public static getInstance(): KnowledgeBaseMigrationService {
    if (!KnowledgeBaseMigrationService.instance) {
      KnowledgeBaseMigrationService.instance = new KnowledgeBaseMigrationService();
    }
    return KnowledgeBaseMigrationService.instance;
  }

  /**
   * Migrates existing single knowledge base to multi-KB system
   */
  public async migrateToMultiKB(
    dbPath: string,
    options: MigrationOptions,
    progressCallback?: (progress: { step: string; message: string; current?: number; total?: number }) => void
  ): Promise<MigrationResult> {
    const result: MigrationResult = {
      success: false,
      migratedRecords: 0,
      createdKnowledgeBases: [],
      errors: [],
      warnings: []
    };

    try {
      progressCallback?.({ step: 'init', message: 'Starting migration process...' });

      // 1. Check if migration is needed
      const needsMigration = await this.checkMigrationNeeded(dbPath);
      if (!needsMigration) {
        result.success = true;
        result.warnings.push('Migration not needed - multi-KB system already in place');
        return result;
      }

      // 2. Backup existing database if requested
      if (options.backupExisting) {
        progressCallback?.({ step: 'backup', message: 'Creating backup of existing database...' });
        result.backupPath = await this.createBackup(dbPath);
        progressCallback?.({ step: 'backup', message: `Backup created at: ${result.backupPath}` });
      }

      // 3. Load existing records
      progressCallback?.({ step: 'load', message: 'Loading existing knowledge base records...' });
      const existingRecords = await this.loadExistingRecords(dbPath);
      progressCallback?.({ step: 'load', message: `Loaded ${existingRecords.length} existing records` });

      // 4. Initialize registry
      const registryPath = path.join(path.dirname(dbPath), 'knowledge-base-registry.json');
      await knowledgeBaseRegistry.initialize(registryPath);

      // 5. Create knowledge bases
      progressCallback?.({ step: 'create_kbs', message: 'Creating knowledge bases...' });
      const knowledgeBases = await this.createKnowledgeBases(options, existingRecords);
      result.createdKnowledgeBases = knowledgeBases;
      progressCallback?.({ step: 'create_kbs', message: `Created ${knowledgeBases.length} knowledge bases` });

      // 6. Classify and migrate records
      progressCallback?.({ step: 'migrate', message: 'Migrating records to new knowledge bases...' });
      const migratedCount = await this.migrateRecords(
        dbPath,
        existingRecords,
        knowledgeBases,
        options.classificationRules || [],
        progressCallback
      );
      result.migratedRecords = migratedCount;

      // 7. Update document counts
      await this.updateDocumentCounts(knowledgeBases, dbPath);

      // 8. Clean up old table (rename to backup)
      await this.cleanupOldTable(dbPath);

      result.success = true;
      progressCallback?.({ step: 'complete', message: `Migration completed successfully! Migrated ${migratedCount} records.` });

    } catch (error) {
      console.error('❌ Migration failed:', error);
      result.errors.push(error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE);
      result.success = false;
    }

    return result;
  }

  /**
   * Checks if migration is needed by looking for legacy 'vectors' table
   */
  private async checkMigrationNeeded(dbPath: string): Promise<boolean> {
    try {
      const db = await lancedb.connect(dbPath);
      const tableNames = await db.tableNames();
      
      // Check if we have the old 'vectors' table but no new KB tables
      const hasVectorsTable = tableNames.includes('vectors');
      const hasKBTables = tableNames.some(name => name.startsWith('kb_'));
      
      return hasVectorsTable && !hasKBTables;
    } catch (error) {
      console.error('Error checking migration status:', error);
      return false;
    }
  }

  /**
   * Creates a backup of the existing database
   */
  private async createBackup(dbPath: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${dbPath}_backup_${timestamp}`;
    
    try {
      // Copy the entire database directory
      await this.copyDirectory(dbPath, backupPath);
      return backupPath;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw new Error(`Failed to create backup: ${error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE}`);
    }
  }

  /**
   * Loads existing records from the legacy 'vectors' table
   */
  private async loadExistingRecords(dbPath: string): Promise<LegacyRecord[]> {
    try {
      const db = await lancedb.connect(dbPath);
      const table = await db.openTable('vectors');
      
      // Get all records
      const dummyEmbedding = new Array(384).fill(0); // MiniLM-L6-v2 dimensions
      const results = await table.search(dummyEmbedding).limit(50000).execute();
      
      return results.map(r => ({
        id: String(r.id || uuidv4()),
        text: String(r.text),
        vector: Array.from(r.vector as number[]),
        source: String(r.source),
        metadata: r.metadata as Record<string, unknown> || {},
        chunkIndex: Number(r.chunkIndex) || 0
      }));
    } catch (error) {
      console.error('Error loading existing records:', error);
      throw new Error(`Failed to load existing records: ${error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE}`);
    }
  }

  /**
   * Creates knowledge bases based on migration options
   */
  private async createKnowledgeBases(
    options: MigrationOptions,
    existingRecords: LegacyRecord[]
  ): Promise<KnowledgeBase[]> {
    const knowledgeBases: KnowledgeBase[] = [];

    // 1. Create default/general knowledge base
    if (options.createDefaultKB) {
      const defaultKBRequest: CreateKnowledgeBaseRequest = {
        name: options.defaultKBName,
        description: options.defaultKBDescription,
        isDefault: true,
        tags: ['general', 'default'],
        metadata: { migrated: true, isDefault: true }
      };
      const defaultKB = await knowledgeBaseRegistry.createKnowledgeBase(defaultKBRequest);
      knowledgeBases.push(defaultKB);
    }

    // 2. Analyze existing records to suggest knowledge bases
    const suggestedKBs = this.analyzeSources(existingRecords);
    
    // 3. Create knowledge bases for common patterns
    for (const suggestion of suggestedKBs) {
      // Check if we have a template match
      const template = DEFAULT_KB_TEMPLATES.find(t => 
        suggestion.name.toLowerCase().includes(t.name.toLowerCase()) ||
        t.tags.some(tag => suggestion.name.toLowerCase().includes(tag))
      );

      const kbRequest: CreateKnowledgeBaseRequest = {
        name: suggestion.name,
        description: suggestion.description,
        color: template?.color,
        icon: template?.icon,
        tags: template?.tags || suggestion.tags,
        metadata: { 
          migrated: true, 
          autoCreated: true,
          documentCount: suggestion.documentCount,
          templateId: template?.id
        }
      };

      try {
        const kb = await knowledgeBaseRegistry.createKnowledgeBase(kbRequest);
        knowledgeBases.push(kb);
      } catch (error) {
        console.warn(`Failed to create KB "${suggestion.name}":`, error);
      }
    }

    return knowledgeBases;
  }

  /**
   * Analyzes source patterns to suggest knowledge base categories
   */
  private analyzeSources(records: LegacyRecord[]): Array<{
    name: string;
    description: string;
    tags: string[];
    documentCount: number;
    sources: string[];
  }> {
    const sourceGroups = new Map<string, string[]>();
    
    // Group sources by patterns
    records.forEach(record => {
      const source = record.source;
      let category = 'General';

      // Pattern matching for common categories
      if (this.matchesPattern(source, ['python', 'py', '.py'])) {
        category = 'Python Development';
      } else if (this.matchesPattern(source, ['javascript', 'js', 'node', 'react', 'vue'])) {
        category = 'Web Development';
      } else if (this.matchesPattern(source, ['after', 'effects', 'ae', 'motion'])) {
        category = 'After Effects';
      } else if (this.matchesPattern(source, ['nuke', 'compositing', 'vfx'])) {
        category = 'Nuke Compositing';
      } else if (this.matchesPattern(source, ['research', 'paper', 'academic', 'study'])) {
        category = 'Research Papers';
      } else if (this.matchesPattern(source, ['tutorial', 'guide', 'howto', 'documentation'])) {
        category = 'Tutorials & Guides';
      }

      if (!sourceGroups.has(category)) {
        sourceGroups.set(category, []);
      }
      sourceGroups.get(category)!.push(source);
    });

    // Convert to suggestions, filtering out groups with too few documents
    return Array.from(sourceGroups.entries())
      .filter(([, sources]) => sources.length >= 3) // At least 3 documents
      .map(([category, sources]) => {
        const uniqueSources = [...new Set(sources)];
        return {
          name: category,
          description: `Knowledge base for ${category.toLowerCase()} related documents`,
          tags: this.generateTagsFromCategory(category),
          documentCount: uniqueSources.length,
          sources: uniqueSources
        };
      });
  }

  /**
   * Checks if a source matches any of the given patterns
   */
  private matchesPattern(source: string, patterns: string[]): boolean {
    const lowerSource = source.toLowerCase();
    return patterns.some(pattern => lowerSource.includes(pattern.toLowerCase()));
  }

  /**
   * Generates tags from category name
   */
  private generateTagsFromCategory(category: string): string[] {
    const categoryMap: Record<string, string[]> = {
      'Python Development': ['python', 'coding', 'development'],
      'Web Development': ['web', 'javascript', 'html', 'css'],
      'After Effects': ['after-effects', 'motion-graphics', 'video'],
      'Nuke Compositing': ['nuke', 'compositing', 'vfx'],
      'Research Papers': ['research', 'academic', 'papers'],
      'Tutorials & Guides': ['tutorial', 'guide', 'documentation']
    };

    return categoryMap[category] || [category.toLowerCase().replace(/\s+/g, '-')];
  }

  /**
   * Migrates records to appropriate knowledge bases
   */
  private async migrateRecords(
    dbPath: string,
    records: LegacyRecord[],
    knowledgeBases: KnowledgeBase[],
    classificationRules: DocumentClassificationRule[],
    progressCallback?: (progress: { step: string; message: string; current?: number; total?: number }) => void
  ): Promise<number> {
    const db = await lancedb.connect(dbPath);
    let migratedCount = 0;

    // Group records by target knowledge base
    const recordGroups = new Map<string, LegacyRecord[]>();
    
    records.forEach((record, index) => {
      progressCallback?.({
        step: 'classify',
        message: 'Classifying records...',
        current: index + 1,
        total: records.length
      });

      const targetKBId = this.classifyRecord(record, knowledgeBases, classificationRules);
      
      if (!recordGroups.has(targetKBId)) {
        recordGroups.set(targetKBId, []);
      }
      recordGroups.get(targetKBId)!.push(record);
    });

    // Migrate each group to its target knowledge base
    for (const [kbId, kbRecords] of recordGroups.entries()) {
      const kb = knowledgeBases.find(k => k.id === kbId);
      if (!kb) continue;

      progressCallback?.({
        step: 'migrate',
        message: `Migrating ${kbRecords.length} records to ${kb.name}...`
      });

      try {
        // Create table for this knowledge base
        const transformedRecords = kbRecords.map(record => ({
          id: record.id,
          text: record.text,
          vector: record.vector,
          source: record.source,
          knowledgeBaseId: kbId,
          chunkIndex: record.chunkIndex || 0,
          documentId: this.generateDocumentId(record.source),
          metadata: record.metadata || {},
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));

        await db.createTable(kb.tableName, transformedRecords);
        migratedCount += kbRecords.length;
        
        console.log(`✅ Migrated ${kbRecords.length} records to ${kb.name}`);
      } catch (error) {
        console.error(`❌ Failed to migrate records to ${kb.name}:`, error);
      }
    }

    return migratedCount;
  }

  /**
   * Classifies a record to determine which knowledge base it belongs to
   */
  private classifyRecord(
    record: LegacyRecord,
    knowledgeBases: KnowledgeBase[],
    classificationRules: DocumentClassificationRule[]
  ): string {
    // 1. Apply custom classification rules first (highest priority)
    for (const rule of classificationRules.sort((a, b) => b.priority - a.priority)) {
      const regex = new RegExp(rule.pattern, 'i');
      if (regex.test(record.source)) {
        const targetKB = knowledgeBases.find(kb => kb.id === rule.knowledgeBaseId);
        if (targetKB) {
          return targetKB.id;
        }
      }
    }

    // 2. Apply automatic classification based on source patterns
    const source = record.source.toLowerCase();
    
    for (const kb of knowledgeBases) {
      if (kb.isDefault) continue; // Skip default KB for now
      
      // Check if source matches any of the KB's tags
      const matchesTags = kb.tags.some(tag => source.includes(tag.toLowerCase()));
      if (matchesTags) {
        return kb.id;
      }
      
      // Check if source matches KB name
      const kbNameWords = kb.name.toLowerCase().split(' ');
      const matchesName = kbNameWords.some(word => word.length > 2 && source.includes(word));
      if (matchesName) {
        return kb.id;
      }
    }

    // 3. Default to the default/general knowledge base
    const defaultKB = knowledgeBases.find(kb => kb.isDefault);
    return defaultKB?.id || knowledgeBases[0]?.id || '';
  }

  /**
   * Generates a document ID from source and chunk index
   */
  private generateDocumentId(source: string): string {
    // Create a consistent document ID for chunks from the same source
    const sourceHash = Buffer.from(source).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
    return `doc_${sourceHash}`;
  }

  /**
   * Updates document counts for each knowledge base
   */
  private async updateDocumentCounts(knowledgeBases: KnowledgeBase[], dbPath: string): Promise<void> {
    const db = await lancedb.connect(dbPath);
    
    for (const kb of knowledgeBases) {
      try {
        const table = await db.openTable(kb.tableName);
        
        // Count unique documents (by source)
        const dummyEmbedding = new Array(384).fill(0);
        const records = await table.search(dummyEmbedding).limit(10000).execute();
        const uniqueSources = new Set(records.map(r => (r as any).source));
        
        await knowledgeBaseRegistry.updateDocumentCount(kb.id, uniqueSources.size);
      } catch (error) {
        console.warn(`Failed to update document count for ${kb.name}:`, error);
      }
    }
  }

  /**
   * Cleans up the old 'vectors' table by renaming it
   */
  private async cleanupOldTable(dbPath: string): Promise<void> {
    try {
      const db = await lancedb.connect(dbPath);
      const tableNames = await db.tableNames();
      
      if (tableNames.includes('vectors')) {
        // LanceDB doesn't support table renaming, so we'll just drop it
        // The backup should preserve the original data
        await db.dropTable('vectors');
        console.log('✅ Cleaned up legacy vectors table');
      }
    } catch (error) {
      console.warn('Failed to cleanup old table:', error);
    }
  }

  /**
   * Copies a directory recursively
   */
  private async copyDirectory(src: string, dest: string): Promise<void> {
    try {
      const stats = await fs.stat(src);
      if (stats.isDirectory()) {
        await fs.mkdir(dest, { recursive: true });
        const entries = await fs.readdir(src);
        
        for (const entry of entries) {
          const srcPath = path.join(src, entry);
          const destPath = path.join(dest, entry);
          await this.copyDirectory(srcPath, destPath);
        }
      } else {
        await fs.copyFile(src, dest);
      }
    } catch (error) {
      console.error(`Error copying ${src} to ${dest}:`, error);
      throw error;
    }
  }

  /**
   * Creates default migration options
   */
  public static createDefaultMigrationOptions(): MigrationOptions {
    return {
      createDefaultKB: true,
      defaultKBName: 'General Knowledge',
      defaultKBDescription: 'Default knowledge base for general documents and information',
      classificationRules: [
        {
          pattern: PYTHON_FILE_PATTERN,
          knowledgeBaseId: '', // Will be filled during migration
          priority: 10
        },
        {
          pattern: 'after[\\s_-]?effects|ae[\\s_-]|motion[\\s_-]?graphics',
          knowledgeBaseId: '',
          priority: 10
        },
        {
          pattern: 'nuke|compositing|vfx',
          knowledgeBaseId: '',
          priority: 10
        }
      ],
      backupExisting: true
    };
  }
}

// Export singleton instance
export const knowledgeBaseMigrationService = KnowledgeBaseMigrationService.getInstance();