import * as lancedb from 'vectordb';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import * as path from 'path';
import * as fs from 'fs/promises';
import { documentParserService } from './DocumentParserService.js';
import { knowledgeBaseRegistry } from './KnowledgeBaseRegistry.js';
import {
  KnowledgeBase,
  KnowledgeBaseRecord,
  MultiKBSearchResult,
  SearchOptions,
  KnowledgeBaseOperationProgress,
  KnowledgeBaseStats
} from '../types/knowledgeBase.js';



interface ExportData {
  version: string;
  exportDate: string;
  records: KnowledgeBaseRecord[];
  metadata: {
    totalRecords: number;
    totalDocuments: number;
    exportSize: number;
  };
}

/**
 * Enhanced Knowledge Base Service for managing multiple topic-based knowledge bases.
 * This service handles the creation, management, and querying of multiple vector databases,
 * allowing AI models to access organized, topic-specific knowledge sources.
 */
export class KnowledgeBaseService {
  // Constants for frequently used error messages
  private static readonly KNOWLEDGE_BASE_NOT_FOUND_ERROR = 'Knowledge base with ID';
  private static readonly UNKNOWN_ERROR_FALLBACK = 'error instanceof Error ? error.message : \'Unknown error\'';
  private static readonly NO_DEFAULT_KNOWLEDGE_BASE_ERROR = 'No default knowledge base found. Please create a knowledge base first.';
  
  /**
   * Helper method to extract error message safely
   */
  private static getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }
  
  private static instance: KnowledgeBaseService;
  private db: lancedb.Connection | undefined;
  private tables: Map<string, lancedb.Table> = new Map(); // tableName -> table
  private embedder: FeatureExtractionPipeline | undefined;
  private dbPath = '';
  private initialized = false;

  private constructor() {}

  /**
   * Gets the singleton instance of the KnowledgeBaseService.
   * @returns {KnowledgeBaseService} The singleton instance.
   */
  public static getInstance(): KnowledgeBaseService {
    if (!KnowledgeBaseService.instance) {
      KnowledgeBaseService.instance = new KnowledgeBaseService();
    }
    return KnowledgeBaseService.instance;
  }

  /**
   * Checks if the knowledge base system is initialized.
   * @returns {boolean} True if the knowledge base system is initialized, false otherwise.
   */
  public isInitialized(): boolean {
    return this.initialized && this.db !== undefined && this.embedder !== undefined;
  }

  /**
   * Initializes the connection to the LanceDB vector database and knowledge base registry.
   * Creates the database and loads existing knowledge bases from the registry.
   * @param dbPath - The local file system path to store the database.
   */
  public async initialize(dbPath: string): Promise<void> {
    if (this.initialized) return;

    this.dbPath = dbPath;
    this.db = await lancedb.connect(dbPath);
    
    // Initialize embedding pipeline
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    // Initialize knowledge base registry
    const registryPath = path.join(path.dirname(dbPath), 'knowledge-base-registry.json');
    await knowledgeBaseRegistry.initialize(registryPath);

    // Load existing knowledge base tables
    await this.loadExistingTables();
    
    this.initialized = true;
    console.log('✅ Multi-Knowledge Base Service initialized');
  }

  /**
   * Loads existing knowledge base tables from the database
   */
  private async loadExistingTables(): Promise<void> {
    try {
      const tableNames = await this.db!.tableNames();
      const knowledgeBases = await knowledgeBaseRegistry.listKnowledgeBases();
      
      for (const kb of knowledgeBases) {
        if (tableNames.includes(kb.tableName)) {
          try {
            const table = await this.db!.openTable(kb.tableName);
            this.tables.set(kb.tableName, table);
            console.log(`📊 Loaded knowledge base table: ${kb.name} (${kb.tableName})`);
          } catch (error) {
            console.warn(`⚠️ Failed to load table for KB ${kb.name}:`, error);
          }
        }
      }
      
      console.log(`📋 Loaded ${this.tables.size} knowledge base tables`);
    } catch (error) {
      console.error('❌ Failed to load existing tables:', error);
    }
  }

  /**
   * Creates a new table for a knowledge base
   */
  private async createKnowledgeBaseTable(knowledgeBase: KnowledgeBase): Promise<lancedb.Table> {
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Create initial dummy record to define schema
    const initialRecord = {
      id: 'initial',
      vector: await this.createEmbedding('initial'),
      text: 'initial',
      source: 'system',
      knowledgeBaseId: knowledgeBase.id,
      chunkIndex: 0,
      documentId: 'initial_doc',
      metadata: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const table = await this.db.createTable(knowledgeBase.tableName, [initialRecord]);
    this.tables.set(knowledgeBase.tableName, table);
    
    console.log(`✅ Created knowledge base table: ${knowledgeBase.name} (${knowledgeBase.tableName})`);
    return table;
  }

  /**
   * Gets or creates a table for a knowledge base
   */
  private async getKnowledgeBaseTable(knowledgeBaseId: string): Promise<lancedb.Table> {
    const knowledgeBase = await knowledgeBaseRegistry.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      throw new Error(`Knowledge base with ID "${knowledgeBaseId}" not found`);
    }

    // Check if table is already loaded
    if (this.tables.has(knowledgeBase.tableName)) {
      return this.tables.get(knowledgeBase.tableName)!;
    }

    // Try to open existing table
    try {
      const table = await this.db!.openTable(knowledgeBase.tableName);
      this.tables.set(knowledgeBase.tableName, table);
      return table;
    } catch {
      // Table doesn't exist, create it
      return await this.createKnowledgeBaseTable(knowledgeBase);
    }
  }

  /**
   * Gets all available knowledge bases
   */
  public async getAvailableKnowledgeBases(): Promise<KnowledgeBase[]> {
    return await knowledgeBaseRegistry.listKnowledgeBases();
  }

  /**
   * Gets statistics for a specific knowledge base
   */
  public async getKnowledgeBaseStats(knowledgeBaseId: string): Promise<KnowledgeBaseStats> {
    const knowledgeBase = await knowledgeBaseRegistry.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      throw new Error(`${KnowledgeBaseService.KNOWLEDGE_BASE_NOT_FOUND_ERROR} "${knowledgeBaseId}" not found`);
    }

    try {
      const table = await this.getKnowledgeBaseTable(knowledgeBaseId);
      
      // Get all records to calculate stats
      const dummyEmbedding = new Array(384).fill(0);
      const records = await table.search(dummyEmbedding).limit(50000).execute();
      
      // Count unique documents
      const uniqueSources = new Set(records.map(r => (r as any).source));
      
      return {
        totalRecords: records.length,
        totalDocuments: uniqueSources.size,
        databaseSize: records.length * 1000, // Rough estimate
        lastUpdated: knowledgeBase.lastUpdated
      };
    } catch (error) {
      console.error(`Error getting stats for KB ${knowledgeBase.name}:`, error);
      return {
        totalRecords: 0,
        totalDocuments: 0,
        databaseSize: 0,
        lastUpdated: knowledgeBase.lastUpdated
      };
    }
  }

  /**
   * Safely imports pdf-parse module with comprehensive error handling
   */
  public async importPdfParseSafely(): Promise<(buffer: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>> {
    try {
      console.log('📄 Attempting to import pdf-parse with working directory fix...');

      // Change to the pdf-parse module directory to ensure test files are found
      const originalCwd = process.cwd();

      try {
        // Try to import pdf-parse with a timeout to prevent hanging
        const importPromise = import('pdf-parse');
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('PDF parse import timeout')), 5000)
        );

        const pdfParseModule = await Promise.race([importPromise, timeoutPromise]) as {
          default?: (buffer: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
        } & ((buffer: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>);
        console.log('✅ pdf-parse module imported successfully');

        // Handle both CommonJS and ES module exports
        const pdfParse = pdfParseModule.default;
        if (typeof pdfParse === 'function') {
          return pdfParse;
        } else if (typeof pdfParseModule === 'function') {
          return pdfParseModule as (buffer: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>;
        } else {
          throw new Error('pdf-parse module does not export a function');
        }
      } finally {
        // Always restore the original working directory
        process.chdir(originalCwd);
      }
    } catch (error) {
      console.error('❌ Failed to import pdf-parse:', error);

      // Return a fallback function that provides basic PDF info without parsing
      return async (buffer: Buffer) => {
        console.log('📄 Using fallback PDF handler (no text extraction)');
        return {
          text: `[PDF Document - ${buffer.length} bytes]\nNote: PDF text extraction is not available. The PDF parsing module could not be loaded.`,
          numpages: 1,
          info: {
            Title: 'PDF Document',
            Creator: 'Unknown',
            Producer: 'Fallback Handler'
          } as Record<string, unknown>
        };
      };
    }
  }

  /**
   * Adds a document to a specific knowledge base.
   * The document is processed, chunked, embedded, and stored in the vector database.
   * @param knowledgeBaseId - The ID of the knowledge base to add the document to.
   * @param filePath - The path to the file to be added.
   * @param metadata - Optional metadata to include with the document.
   * @param progressCallback - Optional callback for progress updates.
   */
  public async addDocumentToKnowledgeBase(
    knowledgeBaseId: string,
    filePath: string,
    metadata?: Record<string, unknown>,
    progressCallback?: (progress: KnowledgeBaseOperationProgress) => void
  ): Promise<void>;

  /**
   * Adds a document to a specific knowledge base from a File object.
   * The document is processed, chunked, embedded, and stored in the vector database.
   * @param knowledgeBaseId - The ID of the knowledge base to add the document to.
   * @param file - The File object to be added.
   * @param metadata - Optional metadata to include with the document.
   * @param progressCallback - Optional callback for progress updates.
   */
  public async addDocumentToKnowledgeBase(
    knowledgeBaseId: string,
    file: File,
    metadata?: Record<string, unknown>,
    progressCallback?: (progress: KnowledgeBaseOperationProgress) => void
  ): Promise<void>;

  public async addDocumentToKnowledgeBase(
    knowledgeBaseId: string,
    filePathOrFile: string | File,
    metadata?: Record<string, unknown>,
    progressCallback?: (progress: KnowledgeBaseOperationProgress) => void
  ): Promise<void> {
    const knowledgeBase = await knowledgeBaseRegistry.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      throw new Error(`${KnowledgeBaseService.KNOWLEDGE_BASE_NOT_FOUND_ERROR} "${knowledgeBaseId}" not found`);
    }

    const table = await this.getKnowledgeBaseTable(knowledgeBaseId);
    
    try {
      let text: string;
      let documentSource: string;
      let documentMetadata: Record<string, unknown> = metadata || {};

      progressCallback?.({
        step: 'starting',
        message: `Starting document processing for ${knowledgeBase.name}`,
        knowledgeBaseId,
        knowledgeBaseName: knowledgeBase.name,
        status: 'processing'
      });

      if (typeof filePathOrFile === 'string') {
        // Handle file path
        const filePath = filePathOrFile;
        documentSource = path.basename(filePath);
        progressCallback?.({
          step: 'reading',
          message: `Reading file: ${documentSource}`,
          knowledgeBaseId,
          knowledgeBaseName: knowledgeBase.name,
          status: 'processing'
        });
        console.log(`Starting to process document from path: ${filePath}`);

        const fileBuffer = await fs.readFile(filePath);
        console.log(`File read successfully, size: ${fileBuffer.length} bytes`);

        const fileExtension = path.extname(filePath).toLowerCase();
        progressCallback?.({
          step: 'parsing',
          message: `Parsing ${fileExtension.toUpperCase()} file: ${documentSource}`,
          knowledgeBaseId,
          knowledgeBaseName: knowledgeBase.name,
          status: 'processing'
        });

        if (fileExtension === '.pdf') {
          try {
            const pdfParse = await this.importPdfParseSafely();
            const pdfData = await pdfParse(fileBuffer);
            text = pdfData.text;
            console.log(`PDF parsed successfully, text length: ${text.length} characters`);
            documentMetadata = { ...documentMetadata, format: 'PDF', pages: pdfData.numpages };
          } catch (pdfError) {
            console.error('PDF parsing failed:', pdfError);
            throw new Error(`Failed to parse PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
          }
        } else {
          const textContent = await fs.readFile(filePath, 'utf-8');
          text = textContent;
          documentMetadata = { ...documentMetadata, format: 'Text', characterCount: text.length };
        }
      } else {
        // Handle File object
        const file = filePathOrFile;
        documentSource = file.name;
        progressCallback?.({
          step: 'reading',
          message: `Reading file: ${documentSource}`,
          knowledgeBaseId,
          knowledgeBaseName: knowledgeBase.name,
          status: 'processing'
        });
        console.log(`Starting to process document from File object: ${file.name}`);

        progressCallback?.({
          step: 'parsing',
          message: `Parsing file: ${documentSource}`,
          knowledgeBaseId,
          knowledgeBaseName: knowledgeBase.name,
          status: 'processing'
        });

        const parsedDocument = await documentParserService.parseDocument(file);
        text = parsedDocument.text;
        documentMetadata = {
          ...documentMetadata,
          ...parsedDocument.metadata,
          fileSize: file.size,
          fileType: file.type,
          uploadDate: new Date().toISOString()
        };
      }

      if (!text || text.trim().length === 0) {
        throw new Error('No text content found in the document');
      }

      progressCallback?.({
        step: 'chunking',
        message: `Chunking text for: ${documentSource}`,
        knowledgeBaseId,
        knowledgeBaseName: knowledgeBase.name,
        status: 'processing'
      });
      
      const chunks = this.chunkText(text);
      console.log(`Document chunked into ${chunks.length} pieces.`);
      
      progressCallback?.({
        step: 'chunking',
        message: `Generated ${chunks.length} chunks for: ${documentSource}`,
        knowledgeBaseId,
        knowledgeBaseName: knowledgeBase.name,
        chunkCount: chunks.length,
        status: 'processing'
      });

      const records: KnowledgeBaseRecord[] = [];
      const documentId = this.generateDocumentId(documentSource);
      const now = new Date();

      progressCallback?.({
        step: 'embedding',
        message: `Creating embeddings for: ${documentSource}`,
        knowledgeBaseId,
        knowledgeBaseName: knowledgeBase.name,
        current: 0,
        total: chunks.length,
        status: 'processing'
      });

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        progressCallback?.({
          step: 'embedding',
          message: `Processing chunk ${i + 1}/${chunks.length} for: ${documentSource}`,
          knowledgeBaseId,
          knowledgeBaseName: knowledgeBase.name,
          current: i + 1,
          total: chunks.length,
          status: 'processing'
        });

        const embedding = await this.createEmbedding(chunk);
        records.push({
          id: `${documentId}_chunk_${i}`,
          vector: embedding,
          text: chunk,
          source: documentSource,
          knowledgeBaseId,
          chunkIndex: i,
          documentId,
          metadata: documentMetadata,
          createdAt: now,
          updatedAt: now
        });
      }

      progressCallback?.({
        step: 'storing',
        message: `Storing ${records.length} records for: ${documentSource}`,
        knowledgeBaseId,
        knowledgeBaseName: knowledgeBase.name,
        status: 'processing'
      });
      
      console.log(`Adding ${records.length} records to knowledge base: ${knowledgeBase.name}`);
      await table.add(records as unknown as Record<string, unknown>[]);
      
      // Update document count
      await this.updateKnowledgeBaseDocumentCount(knowledgeBaseId);
      
      progressCallback?.({
        step: 'complete',
        message: `Successfully processed: ${documentSource}`,
        knowledgeBaseId,
        knowledgeBaseName: knowledgeBase.name,
        chunkCount: chunks.length,
        status: 'success'
      });
      
      console.log(`✅ Successfully added ${records.length} records to knowledge base: ${knowledgeBase.name}`);

    } catch (error) {
      const errorMessage = typeof filePathOrFile === 'string' ? filePathOrFile : filePathOrFile.name;
      console.error(`Error adding document ${errorMessage} to KB ${knowledgeBase.name}:`, error);
      
      progressCallback?.({
        step: 'error',
        message: `Failed to process: ${errorMessage} - ${KnowledgeBaseService.getErrorMessage(error)}`,
        knowledgeBaseId,
        knowledgeBaseName: knowledgeBase.name,
        status: 'error',
        error: KnowledgeBaseService.getErrorMessage(error)
      });
      
      throw error;
    }
  }

  /**
   * Generates a unique document ID
   */
  private generateDocumentId(source: string): string {
    const timestamp = Date.now();
    const sourceHash = Buffer.from(source).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
    return `doc_${sourceHash}_${timestamp}`;
  }

  /**
   * Updates the document count for a knowledge base
   */
  private async updateKnowledgeBaseDocumentCount(knowledgeBaseId: string): Promise<void> {
    try {
      const table = await this.getKnowledgeBaseTable(knowledgeBaseId);
      
      // Count unique documents by source
      const dummyEmbedding = new Array(384).fill(0);
      const records = await table.search(dummyEmbedding).limit(50000).execute();
      const uniqueSources = new Set(records.map(r => (r as any).source));
      
      await knowledgeBaseRegistry.updateDocumentCount(knowledgeBaseId, uniqueSources.size);
    } catch (error) {
      console.warn(`Failed to update document count for KB ${knowledgeBaseId}:`, error);
    }
  }

  /**
   * Legacy method for backward compatibility - adds document to default knowledge base
   */
  public async addDocument(
    filePathOrFile: string | File,
    metadata?: Record<string, unknown>,
    progressCallback?: (progress: {step: string, message: string, current?: number, total?: number, chunkCount?: number}) => void
  ): Promise<void> {
    // Get default knowledge base
    const defaultKB = await knowledgeBaseRegistry.getDefaultKnowledgeBase();
    if (!defaultKB) {
      throw new Error(KnowledgeBaseService.NO_DEFAULT_KNOWLEDGE_BASE_ERROR);
    }

    // Convert legacy progress callback to new format
    const enhancedProgressCallback = progressCallback ? (progress: KnowledgeBaseOperationProgress) => {
      progressCallback({
        step: progress.step,
        message: progress.message,
        current: progress.current,
        total: progress.total,
        chunkCount: progress.chunkCount
      });
    } : undefined;

    // Handle string vs File input appropriately
    if (typeof filePathOrFile === 'string') {
      await this.addDocumentToKnowledgeBase(defaultKB.id, filePathOrFile, metadata, enhancedProgressCallback);
    } else {
      await this.addDocumentToKnowledgeBase(defaultKB.id, filePathOrFile, metadata, enhancedProgressCallback);
    }
  }



  /**
   * Adds multiple documents to the knowledge base with real-time progress updates.
   * @param filePaths - Array of file paths to process.
   * @param progressCallback - Callback for real-time progress updates.
   * @returns Promise with batch processing results.
   */
  public async addDocumentsBatch(
    filePaths: string[],
    progressCallback?: (progress: {
      step: string;
      message: string;
      fileIndex: number;
      totalFiles: number;
      fileName: string;
      chunkCount?: number;
      status: 'processing' | 'success' | 'error';
      error?: string;
    }) => void
  ): Promise<{success: boolean, results: Array<{filePath: string, success: boolean, error?: string, chunkCount?: number}>, summary: string}> {
    if (!this.initialized) {
      throw new Error('Knowledge base service not initialized.');
    }

    const results: Array<{filePath: string, success: boolean, error?: string, chunkCount?: number}> = [];
    let successCount = 0;
    let errorCount = 0;

    progressCallback?.({
      step: 'starting',
      message: `Starting batch processing of ${filePaths.length} documents`,
      fileIndex: 0,
      totalFiles: filePaths.length,
      fileName: '',
      status: 'processing'
    });

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const fileName = path.basename(filePath);

      try {
        progressCallback?.({
          step: 'processing',
          message: `Processing file ${i + 1}/${filePaths.length}: ${fileName}`,
          fileIndex: i + 1,
          totalFiles: filePaths.length,
          fileName,
          status: 'processing'
        });

        // Process individual document with progress tracking
        let chunkCount = 0;
        await this.addDocument(filePath, undefined, (docProgress) => {
          if (docProgress.chunkCount) {
            chunkCount = docProgress.chunkCount;
          }

          progressCallback?.({
            step: docProgress.step,
            message: `File ${i + 1}/${filePaths.length}: ${docProgress.message}`,
            fileIndex: i + 1,
            totalFiles: filePaths.length,
            fileName,
            chunkCount: docProgress.chunkCount,
            status: 'processing'
          });
        });

        results.push({
          filePath,
          success: true,
          chunkCount
        });

        successCount++;

        progressCallback?.({
          step: 'complete',
          message: `Successfully processed ${fileName} (${chunkCount} chunks)`,
          fileIndex: i + 1,
          totalFiles: filePaths.length,
          fileName,
          chunkCount,
          status: 'success'
        });

      } catch (error) {
        const errorMessage = KnowledgeBaseService.getErrorMessage(error);

        results.push({
          filePath,
          success: false,
          error: errorMessage
        });

        errorCount++;

        progressCallback?.({
          step: 'error',
          message: `Failed to process ${fileName}: ${errorMessage}`,
          fileIndex: i + 1,
          totalFiles: filePaths.length,
          fileName,
          status: 'error',
          error: errorMessage
        });

        console.error(`Error processing file ${filePath}:`, error);
      }
    }

    const summary = `Batch processing completed: ${successCount} successful, ${errorCount} failed out of ${filePaths.length} total files`;

    progressCallback?.({
      step: 'finished',
      message: summary,
      fileIndex: filePaths.length,
      totalFiles: filePaths.length,
      fileName: '',
      status: successCount === filePaths.length ? 'success' : errorCount === filePaths.length ? 'error' : 'processing'
    });

    return {
      success: errorCount === 0,
      results,
      summary
    };
  }

  /**
   * Searches a specific knowledge base for content relevant to a given query.
   * @param knowledgeBaseId - The ID of the knowledge base to search.
   * @param queryText - The text to search for.
   * @param limit - The maximum number of relevant chunks to return.
   * @returns Promise resolving to an array of search results.
   */
  public async searchKnowledgeBase(
    knowledgeBaseId: string, 
    queryText: string, 
    limit = 5
  ): Promise<MultiKBSearchResult[]> {
    const knowledgeBase = await knowledgeBaseRegistry.getKnowledgeBase(knowledgeBaseId);
    if (!knowledgeBase) {
      throw new Error(`${KnowledgeBaseService.KNOWLEDGE_BASE_NOT_FOUND_ERROR} "${knowledgeBaseId}" not found`);
    }

    const table = await this.getKnowledgeBaseTable(knowledgeBaseId);
    const queryEmbedding = await this.createEmbedding(queryText);

    const results = await table
      .search(queryEmbedding)
      .limit(limit)
      .execute();

    return results.map(r => ({
      text: String(r.text),
      source: String(r.source),
      knowledgeBaseName: knowledgeBase.name,
      knowledgeBaseId: knowledgeBase.id,
      relevanceScore: Number(r.score || 0),
      chunkIndex: Number(r.chunkIndex || 0),
      documentId: String(r.documentId || ''),
      metadata: (r.metadata as Record<string, unknown>) || {}
    }));
  }

  /**
   * Searches multiple knowledge bases for content relevant to a given query.
   * @param knowledgeBaseIds - Array of knowledge base IDs to search.
   * @param queryText - The text to search for.
   * @param options - Search options including limits and thresholds.
   * @returns Promise resolving to aggregated and ranked search results.
   */
  public async searchMultipleKnowledgeBases(
    knowledgeBaseIds: string[], 
    queryText: string, 
    options: SearchOptions = {
      maxResultsPerKB: 3,
      relevanceThreshold: 0.1,
      includeSourceAttribution: true,
      contextWindowTokens: 2000
    }
  ): Promise<MultiKBSearchResult[]> {
    if (knowledgeBaseIds.length === 0) {
      return [];
    }

    const allResults: MultiKBSearchResult[] = [];
    
    // Search each knowledge base
    for (const kbId of knowledgeBaseIds) {
      try {
        const kbResults = await this.searchKnowledgeBase(kbId, queryText, options.maxResultsPerKB);
        allResults.push(...kbResults);
      } catch (error) {
        console.warn(`Failed to search knowledge base ${kbId}:`, error);
      }
    }

    // Filter by relevance threshold
    const filteredResults = allResults.filter(r => r.relevanceScore >= options.relevanceThreshold);
    
    // Sort by relevance score (descending)
    const sortedResults = filteredResults.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    // Estimate token count and truncate if needed
    if (options.contextWindowTokens > 0) {
      let totalTokens = 0;
      const finalResults: MultiKBSearchResult[] = [];
      
      for (const result of sortedResults) {
        const estimatedTokens = Math.ceil(result.text.length / 4); // Rough token estimation
        if (totalTokens + estimatedTokens <= options.contextWindowTokens) {
          finalResults.push(result);
          totalTokens += estimatedTokens;
        } else {
          break;
        }
      }
      
      return finalResults;
    }
    
    return sortedResults;
  }

  /**
   * Adds a document to the knowledge base from a Google Docs URL.
   * The document is processed, chunked, embedded, and stored in the vector database.
   * @param url - The Google Docs URL to import.
   * @param metadata - Optional metadata to include with the document.
   */
  public async addDocumentFromUrl(url: string, metadata?: Record<string, unknown>): Promise<void> {
    // Get default knowledge base
    const defaultKB = await knowledgeBaseRegistry.getDefaultKnowledgeBase();
    if (!defaultKB) {
      throw new Error(KnowledgeBaseService.NO_DEFAULT_KNOWLEDGE_BASE_ERROR);
    }

    try {
      console.log(`Starting to process document from URL: ${url}`);

      // Validate Google Docs URL
      if (!this.isValidGoogleDocsUrl(url)) {
        throw new Error('Invalid Google Docs URL. Please provide a valid Google Docs sharing URL.');
      }

      // Convert Google Docs URL to export format (plain text)
      const exportUrl = this.convertToGoogleDocsExportUrl(url);
      console.log(`Converted to export URL: ${exportUrl}`);

      // Fetch the document content
      const response = await fetch(exportUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch Google Docs content: ${response.status} ${response.statusText}. Make sure the document is publicly accessible.`);
      }

      const text = await response.text();
      console.log(`Google Docs content fetched successfully, text length: ${text.length} characters`);

      if (!text || text.trim().length === 0) {
        throw new Error('No text content found in the Google Docs document');
      }

      // Extract document title from URL or use a default
      const documentTitle = this.extractGoogleDocsTitle(url) || 'Google Docs Document';
      const documentSource = `${documentTitle}.txt`;

      const chunks = this.chunkText(text);
      console.log(`Document chunked into ${chunks.length} pieces.`);

      const documentMetadata = {
        ...metadata,
        format: 'Google Docs',
        sourceUrl: url,
        characterCount: text.length,
        uploadDate: new Date().toISOString(),
        title: documentTitle
      };

      const records = [];
      console.log(`Using document source: ${documentSource}`);

      const documentId = `googledocs-${Date.now()}`;
      const now = new Date();

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Processing chunk ${i + 1}/${chunks.length}`);
        const embedding = await this.createEmbedding(chunk);
        records.push({
          id: `${documentId}-chunk-${i}`,
          vector: embedding,
          text: chunk,
          source: documentSource,
          knowledgeBaseId: defaultKB.id,
          chunkIndex: i,
          documentId,
          metadata: documentMetadata,
          createdAt: now,
          updatedAt: now
        });
      }

      console.log(`Adding ${records.length} records to the knowledge base...`);
      const table = await this.getKnowledgeBaseTable(defaultKB.id);
      await table.add(records);
      console.log(`Successfully added ${records.length} records to the knowledge base for document: ${documentSource}`);

      // Verify the records were added by checking the count
      const dummyEmbedding = new Array(384).fill(0); // MiniLM-L6-v2 has 384 dimensions
      const allRecords = await table.search(dummyEmbedding).limit(10000).execute();
      const documentRecords = allRecords.filter(r => (r as {source: string}).source === documentSource);
      console.log(`Verification: Found ${documentRecords.length} records for document ${documentSource} in the database`);

    } catch (error) {
      console.error(`Error adding document from URL ${url}:`, error);
      throw error;
    }
  }

  /**
   * Validates if a URL is a valid Google Docs URL
   */
  private isValidGoogleDocsUrl(url: string): boolean {
    const googleDocsPattern = /^https:\/\/docs\.google\.com\/document\/d\/[a-zA-Z0-9-_]+/;
    return googleDocsPattern.test(url);
  }

  /**
   * Converts a Google Docs sharing URL to an export URL for plain text
   */
  private convertToGoogleDocsExportUrl(url: string): string {
    // Extract document ID from the URL
    const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
      throw new Error('Could not extract document ID from Google Docs URL');
    }

    const documentId = match[1];
    return `https://docs.google.com/document/d/${documentId}/export?format=txt`;
  }

  /**
   * Attempts to extract a title from the Google Docs URL
   */
  private extractGoogleDocsTitle(url: string): string | null {
    // Try to extract title from URL if it contains one
    const titleMatch = url.match(/\/document\/d\/[^/]+\/edit.*[?&]title=([^&]+)/);
    if (titleMatch) {
      return decodeURIComponent(titleMatch[1]);
    }
    return null;
  }

  /**
   * Generates a vector embedding for a given text.
   * @param text - The text to embed.
   * @returns {Promise<number[]>} A promise that resolves to the vector embedding.
   */
    /**
   * Splits a long text into smaller, overlapping chunks.
   * @param text - The text to chunk.
   * @param chunkSize - The size of each chunk.
   * @param overlap - The overlap between consecutive chunks.
   * @returns {string[]} An array of text chunks.
   */
  private chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      chunks.push(text.substring(i, i + chunkSize));
    }
    return chunks;
  }

  private async createEmbedding(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('Embedding pipeline is not initialized.');
    }
    const result = await this.embedder(text, { pooling: 'mean', normalize: true });
    return Array.from(result.data);
  }

  /**
   * Legacy search method for backward compatibility - searches the default knowledge base.
   * @param queryText - The text to search for.
   * @param limit - The maximum number of relevant chunks to return.
   * @returns Promise resolving to an array of relevant document chunks.
   */
  public async search(queryText: string, limit = 5): Promise<Array<{text: string, source: string, score: number}>> {
    // Get default knowledge base
    const defaultKB = await knowledgeBaseRegistry.getDefaultKnowledgeBase();
    if (!defaultKB) {
      console.warn('No default knowledge base found for legacy search');
      return [];
    }

    try {
      const results = await this.searchKnowledgeBase(defaultKB.id, queryText, limit);
      
      // Convert to legacy format
      return results.map(r => ({
        text: r.text,
        source: r.source,
        score: r.relevanceScore
      }));
    } catch (error) {
      console.error('Error in legacy search:', error);
      return [];
    }
  }

  /**
   * Removes a document from the knowledge base.
   * @param documentId - The identifier of the document to remove (typically the file path or name).
   * @returns {Promise<void>} A promise that resolves when the document is removed.
   */
  public async removeDocument(documentId: string): Promise<void> {
    // Get default knowledge base
    const defaultKB = await knowledgeBaseRegistry.getDefaultKnowledgeBase();
    if (!defaultKB) {
      throw new Error(KnowledgeBaseService.NO_DEFAULT_KNOWLEDGE_BASE_ERROR);
    }

    // Remove all chunks that belong to this document
    const table = await this.getKnowledgeBaseTable(defaultKB.id);
    await table.delete(`source = '${documentId}'`);
    console.log(`Removed document: ${documentId}`);
  }

  /**
   * Gets a list of all documents in the knowledge base.
   * @returns {Promise<string[]>} A promise that resolves to an array of document identifiers.
   */
  public async getDocuments(): Promise<string[]> {
    // Get default knowledge base
    const defaultKB = await knowledgeBaseRegistry.getDefaultKnowledgeBase();
    if (!defaultKB) {
      console.warn('No default knowledge base found for getDocuments');
      return [];
    }

    try {
      const table = await this.getKnowledgeBaseTable(defaultKB.id);
      
      // Use search with a dummy embedding to get all records
      // This is the correct way to get all records from a LanceDB table
      const dummyEmbedding = new Array(384).fill(0); // MiniLM-L6-v2 has 384 dimensions
      const results = await table
        .search(dummyEmbedding)
        .limit(10000)
        .execute();

      console.log(`Retrieved ${results.length} records from knowledge base`);

      // Extract unique sources and filter out system entries
      const sourceSet = new Set(results.map(r => (r as {source: string}).source as string));
      const uniqueSources = Array.from(sourceSet).filter(source => source !== 'system');

      console.log(`Found ${uniqueSources.length} unique documents:`, uniqueSources);
      return uniqueSources;
    } catch (error) {
      console.error('Error getting documents:', error);
      return [];
    }
  }

  /**
   * Gets a list of all documents in the knowledge base with their metadata.
   * @returns {Promise<Array<{source: string, metadata: Record<string, unknown>, chunkCount: number}>>} A promise that resolves to an array of documents with metadata.
   */
  public async getDocumentsWithMetadata(): Promise<Array<{source: string, metadata: Record<string, unknown>, chunkCount: number, addedAt?: string}>> {
    // Get default knowledge base
    const defaultKB = await knowledgeBaseRegistry.getDefaultKnowledgeBase();
    if (!defaultKB) {
      console.warn('No default knowledge base found for getDocumentsWithMetadata');
      return [];
    }

    try {
      const table = await this.getKnowledgeBaseTable(defaultKB.id);
      
      // Use search with a dummy embedding to get all records
      const dummyEmbedding = new Array(384).fill(0); // MiniLM-L6-v2 has 384 dimensions
      const results = await table
        .search(dummyEmbedding)
        .limit(10000)
        .execute();

      console.log(`Retrieved ${results.length} records from knowledge base`);

      // Group records by source and extract metadata
      const documentMap = new Map<string, {metadata: Record<string, unknown>, chunks: number}>();

      for (const record of results) {
        const source = (record as {source: string}).source;
        const metadata = (record as {metadata?: Record<string, unknown>}).metadata || {};

        // Skip system entries
        if (source === 'system') continue;

        if (documentMap.has(source)) {
          documentMap.get(source)!.chunks++;
        } else {
          documentMap.set(source, { metadata, chunks: 1 });
        }
      }

      // Convert to array format
      const documentsWithMetadata = Array.from(documentMap.entries()).map(([source, data]) => ({
        source,
        metadata: data.metadata,
        chunkCount: data.chunks,
        addedAt: data.metadata.uploadDate as string || new Date().toISOString()
      }));

      console.log(`Found ${documentsWithMetadata.length} unique documents with metadata`);
      return documentsWithMetadata;
    } catch (error) {
      console.error('Error getting documents with metadata:', error);
      return [];
    }
  }

  /**
   * Exports the entire knowledge base to a portable JSON format.
   * @param progressCallback - Optional callback to report export progress.
   * @returns {Promise<{data: ExportData, stats: {totalRecords: number, totalDocuments: number, exportSize: number, exportTime: number}}>} The exported data and statistics.
   */
  public async exportKnowledgeBase(progressCallback?: (progress: {step: string, current: number, total: number, message: string}) => void): Promise<{data: any, stats: {totalRecords: number, totalDocuments: number, exportSize: number, exportTime: number}}> {
    // Get default knowledge base
    const defaultKB = await knowledgeBaseRegistry.getDefaultKnowledgeBase();
    if (!defaultKB) {
      throw new Error(KnowledgeBaseService.NO_DEFAULT_KNOWLEDGE_BASE_ERROR);
    }

    const startTime = Date.now();
    progressCallback?.({step: 'initializing', current: 0, total: 100, message: 'Starting knowledge base export...'});

    try {
      // Get all records from the database
      progressCallback?.({step: 'fetching', current: 10, total: 100, message: 'Fetching all records from database...'});
      const table = await this.getKnowledgeBaseTable(defaultKB.id);
      const dummyEmbedding = new Array(384).fill(0); // MiniLM-L6-v2 has 384 dimensions
      const allRecords = await table.search(dummyEmbedding).limit(50000).execute();

      progressCallback?.({step: 'processing', current: 30, total: 100, message: `Processing ${allRecords.length} records...`});

      // Filter out system entries and organize data
      const validRecords = allRecords.filter(r => (r as {source: string}).source !== 'system');

      // Create export structure
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        records: validRecords.map(record => ({
          id: (record as {id?: string}).id || `${Date.now()}-${Math.random()}`,
          vector: (record as {vector: number[]}).vector,
          text: (record as {text: string}).text,
          source: (record as {source: string}).source,
          metadata: (record as {metadata?: Record<string, unknown>}).metadata || {},
          chunkIndex: (record as {chunkIndex?: number}).chunkIndex || 0
        })),
        metadata: {
          totalRecords: 0, // Will be calculated below
          totalDocuments: 0, // Will be calculated below
          exportSize: 0 // Will be calculated below
        }
      };

      progressCallback?.({step: 'finalizing', current: 80, total: 100, message: 'Finalizing export data...'});

      // Calculate statistics
      const uniqueSources = new Set(exportData.records.map(r => r.source));
      const exportTime = Date.now() - startTime;

      // Update metadata with calculated values
      exportData.metadata = {
        totalRecords: exportData.records.length,
        totalDocuments: uniqueSources.size,
        exportSize: JSON.stringify(exportData).length
      };

      const stats = {
        totalRecords: exportData.records.length,
        totalDocuments: uniqueSources.size,
        exportSize: exportData.metadata.exportSize,
        exportTime
      };

      progressCallback?.({step: 'complete', current: 100, total: 100, message: `Export completed: ${stats.totalDocuments} documents, ${stats.totalRecords} chunks`});

      console.log(`✅ Knowledge base exported: ${stats.totalDocuments} documents, ${stats.totalRecords} records, ${Math.round(stats.exportSize / 1024)}KB`);

      return { data: exportData, stats };
    } catch (error) {
      console.error('❌ Failed to export knowledge base:', error);
      throw error;
    }
  }

  /**
   * Imports knowledge base data from a previously exported format.
   * @param importData - The data to import.
   * @param options - Import options including merge vs replace mode.
   * @param progressCallback - Optional callback to report import progress.
   * @returns {Promise<{success: boolean, stats: {importedRecords: number, importedDocuments: number, skippedRecords: number, importTime: number}}>} Import results and statistics.
   */
  public async importKnowledgeBase(
    importData: ExportData | { records: KnowledgeBaseRecord[] },
    options: {mode: 'replace' | 'merge', validateEmbeddings?: boolean} = {mode: 'replace', validateEmbeddings: true},
    progressCallback?: (progress: {step: string, current: number, total: number, message: string}) => void
  ): Promise<{success: boolean, stats: {importedRecords: number, importedDocuments: number, skippedRecords: number, importTime: number}}> {
    // Get default knowledge base
    const defaultKB = await knowledgeBaseRegistry.getDefaultKnowledgeBase();
    if (!defaultKB) {
      throw new Error(KnowledgeBaseService.NO_DEFAULT_KNOWLEDGE_BASE_ERROR);
    }

    const startTime = Date.now();
    progressCallback?.({step: 'validating', current: 0, total: 100, message: 'Validating import data...'});

    try {
      // Validate import data structure
      if (!this.validateImportData(importData)) {
        throw new Error('Invalid import data format. Please ensure you are importing a valid knowledge base export file.');
      }

      const records = importData.records || [];
      progressCallback?.({step: 'preparing', current: 10, total: 100, message: `Preparing to import ${records.length} records...`});

      // Clear existing data if replace mode
      if (options.mode === 'replace') {
        progressCallback?.({step: 'clearing', current: 20, total: 100, message: 'Clearing existing knowledge base...'});
        await this.clearKnowledgeBase();
      }

      // Process records in batches for better performance
      const batchSize = 100;
      let importedRecords = 0;
      let skippedRecords = 0;
      const uniqueSources = new Set<string>();

      for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const progress = 30 + ((i / records.length) * 60);

        progressCallback?.({
          step: 'importing',
          current: Math.round(progress),
          total: 100,
          message: `Importing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}...`
        });

        try {
          // Validate and prepare batch records
          const validBatch = batch.filter((record: KnowledgeBaseRecord) => {
            if (options.validateEmbeddings && (!record.vector || record.vector.length !== 384)) {
              skippedRecords++;
              return false;
            }
            if (!record.text || !record.source) {
              skippedRecords++;
              return false;
            }
            return true;
          });

          if (validBatch.length > 0) {
            const table = await this.getKnowledgeBaseTable(defaultKB.id);
            await table.add(validBatch as unknown as Record<string, unknown>[]);
            importedRecords += validBatch.length;
            validBatch.forEach((record: KnowledgeBaseRecord) => uniqueSources.add(record.source));
          }
        } catch (batchError) {
          console.error(`❌ Failed to import batch ${Math.floor(i / batchSize) + 1}:`, batchError);
          skippedRecords += batch.length;
        }
      }

      const importTime = Date.now() - startTime;
      const stats = {
        importedRecords,
        importedDocuments: uniqueSources.size,
        skippedRecords,
        importTime
      };

      progressCallback?.({step: 'complete', current: 100, total: 100, message: `Import completed: ${stats.importedDocuments} documents, ${stats.importedRecords} records imported`});

      console.log(`✅ Knowledge base imported: ${stats.importedDocuments} documents, ${stats.importedRecords} records imported, ${stats.skippedRecords} skipped`);

      return { success: true, stats };
    } catch (error) {
      console.error('❌ Failed to import knowledge base:', error);
      throw error;
    }
  }

  /**
   * Validates the structure of import data.
   * @param data - The data to validate.
   * @returns {boolean} True if the data is valid for import.
   */
  private validateImportData(data: unknown): data is ExportData | { records: KnowledgeBaseRecord[] } {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const typedData = data as Record<string, unknown>;

    // Check required fields
    if (!typedData.version || !typedData.records || !Array.isArray(typedData.records)) {
      return false;
    }

    // Check version compatibility
    if (typedData.version !== '1.0.0') {
      console.warn(`⚠️ Import data version ${typedData.version} may not be fully compatible with current version 1.0.0`);
    }

    // Validate a sample of records
    const sampleSize = Math.min(10, typedData.records.length);
    for (let i = 0; i < sampleSize; i++) {
      const record = (typedData.records as unknown[])[i] as Record<string, unknown>;
      if (!record.text || !record.source || !Array.isArray(record.vector)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Clears all data from the knowledge base.
   * @returns {Promise<void>} A promise that resolves when the knowledge base is cleared.
   */
  public async clearKnowledgeBase(): Promise<void> {
    // Get default knowledge base
    const defaultKB = await knowledgeBaseRegistry.getDefaultKnowledgeBase();
    if (!defaultKB) {
      throw new Error(KnowledgeBaseService.NO_DEFAULT_KNOWLEDGE_BASE_ERROR);
    }

    try {
      const table = await this.getKnowledgeBaseTable(defaultKB.id);
      
      // Get all records to delete them
      const dummyEmbedding = new Array(384).fill(0);
      const allRecords = await table.search(dummyEmbedding).limit(50000).execute();

      // Delete all non-system records
      for (const record of allRecords) {
        const source = (record as {source: string}).source;
        if (source !== 'system') {
          await table.delete(`source = '${source}'`);
        }
      }

      console.log('✅ Knowledge base cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear knowledge base:', error);
      throw error;
    }
  }

  /**
   * Gets statistics about the current knowledge base (legacy method for backward compatibility).
   * @returns {Promise<{totalRecords: number, totalDocuments: number, databaseSize: number}>} Knowledge base statistics.
   */
  public async getLegacyKnowledgeBaseStats(): Promise<{totalRecords: number, totalDocuments: number, databaseSize: number}> {
    // Get default knowledge base
    const defaultKB = await knowledgeBaseRegistry.getDefaultKnowledgeBase();
    if (!defaultKB) {
      console.warn('No default knowledge base found for getKnowledgeBaseStats');
      return { totalRecords: 0, totalDocuments: 0, databaseSize: 0 };
    }

    try {
      const table = await this.getKnowledgeBaseTable(defaultKB.id);
      const dummyEmbedding = new Array(384).fill(0);
      const allRecords = await table.search(dummyEmbedding).limit(50000).execute();

      const validRecords = allRecords.filter(r => (r as {source: string}).source !== 'system');
      const uniqueSources = new Set(validRecords.map(r => (r as {source: string}).source));

      // Estimate database size (rough calculation)
      const estimatedSize = validRecords.length * (384 * 4 + 500); // 4 bytes per float + estimated text size

      return {
        totalRecords: validRecords.length,
        totalDocuments: uniqueSources.size,
        databaseSize: estimatedSize
      };
    } catch (error) {
      console.error('Error getting knowledge base stats:', error);
      return { totalRecords: 0, totalDocuments: 0, databaseSize: 0 };
    }
  }
}
