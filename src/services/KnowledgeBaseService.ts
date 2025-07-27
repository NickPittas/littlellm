import * as lancedb from 'vectordb';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import * as path from 'path';
import * as fs from 'fs/promises';
import { documentParserService } from './DocumentParserService.js';

/**
 * Manages the local knowledge base for the application.
 * This service handles the creation, management, and querying of a local vector database,
 * allowing AI models to access a shared, user-enrichable knowledge source.
 */
export class KnowledgeBaseService {
  private static instance: KnowledgeBaseService;
    private db: lancedb.Connection | undefined;
  private table: lancedb.Table | undefined;
  private embedder: FeatureExtractionPipeline | undefined;

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
   * Checks if the knowledge base is initialized.
   * @returns {boolean} True if the knowledge base is initialized, false otherwise.
   */
  public isInitialized(): boolean {
    return this.db !== undefined && this.table !== undefined && this.embedder !== undefined;
  }

  /**
   * Initializes the connection to the LanceDB vector database.
   * Creates the database and necessary tables if they don't exist.
   * @param dbPath - The local file system path to store the database.
   */
    public async initialize(dbPath: string): Promise<void> {
    this.db = await lancedb.connect(dbPath);
    // Using a pre-trained model for local embeddings
    this.embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

    const tableNames = await this.db.tableNames();
    if (!tableNames.includes('vectors')) {
      // The first time we create the table, we need to provide data.
      // We'll use a dummy entry to define the schema.
      const initialData = [{ 
        vector: await this.createEmbedding('initial'), 
        text: 'initial', 
        source: 'system' 
      }];
      this.table = await this.db.createTable('vectors', initialData);
      console.log('Knowledge base table "vectors" created.');
    } else {
      this.table = await this.db.openTable('vectors');
      console.log('Connected to existing knowledge base table "vectors".');
    }
  }

  /**
   * Safely imports pdf-parse module with comprehensive error handling
   */
  private async importPdfParseSafely(): Promise<(buffer: Buffer) => Promise<{ text: string; numpages: number; info: Record<string, unknown> }>> {
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
   * Adds a document to the knowledge base.
   * The document is processed, chunked, embedded, and stored in the vector database.
   * @param filePath - The path to the file to be added (e.g., a PDF).
   */
  public async addDocument(filePath: string): Promise<void>;

  /**
   * Adds a document to the knowledge base from a File object.
   * The document is processed, chunked, embedded, and stored in the vector database.
   * @param file - The File object to be added.
   * @param metadata - Optional metadata to include with the document.
   */
  public async addDocument(file: File, metadata?: Record<string, unknown>): Promise<void>;

  public async addDocument(filePathOrFile: string | File, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.table) {
      throw new Error('Knowledge base is not initialized.');
    }

    try {
      let text: string;
      let documentSource: string;
      let documentMetadata: Record<string, unknown> = metadata || {};

      if (typeof filePathOrFile === 'string') {
        // Handle file path (existing PDF functionality)
        const filePath = filePathOrFile;
        console.log(`Starting to process document from path: ${filePath}`);

        // Check if file exists
        const fileBuffer = await fs.readFile(filePath);
        console.log(`File read successfully, size: ${fileBuffer.length} bytes`);

        // Determine file type and parse accordingly
        const fileExtension = path.extname(filePath).toLowerCase();
        documentSource = path.basename(filePath);

        if (fileExtension === '.pdf') {
          // Use existing PDF parsing logic
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
          // For non-PDF files from file path, read as text
          const textContent = await fs.readFile(filePath, 'utf-8');
          text = textContent;
          documentMetadata = { ...documentMetadata, format: 'Text', characterCount: text.length };
        }
      } else {
        // Handle File object (new functionality)
        const file = filePathOrFile;
        console.log(`Starting to process document from File object: ${file.name}`);
        console.log(`File size: ${file.size} bytes, type: ${file.type}`);

        documentSource = file.name;

        // Use DocumentParserService to parse the file
        const parsedDocument = await documentParserService.parseDocument(file);
        text = parsedDocument.text;
        documentMetadata = {
          ...documentMetadata,
          ...parsedDocument.metadata,
          fileSize: file.size,
          fileType: file.type,
          uploadDate: new Date().toISOString()
        };

        console.log(`Document parsed successfully, text length: ${text.length} characters`);
      }

      if (!text || text.trim().length === 0) {
        throw new Error('No text content found in the document');
      }

      const chunks = this.chunkText(text);
      console.log(`Document chunked into ${chunks.length} pieces.`);

      const records = [];
      console.log(`Using document source: ${documentSource}`);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Processing chunk ${i + 1}/${chunks.length}`);
        const embedding = await this.createEmbedding(chunk);
        records.push({
          vector: embedding,
          text: chunk,
          source: documentSource,
          metadata: documentMetadata,
          chunkIndex: i
        });
      }

      console.log(`Adding ${records.length} records to the knowledge base...`);
      await this.table.add(records);
      console.log(`Successfully added ${records.length} records to the knowledge base for document: ${documentSource}`);

      // Verify the records were added by checking the count
      const dummyEmbedding = new Array(384).fill(0); // MiniLM-L6-v2 has 384 dimensions
      const allRecords = await this.table.search(dummyEmbedding).limit(10000).execute();
      const documentRecords = allRecords.filter(r => (r as {source: string}).source === documentSource);
      console.log(`Verification: Found ${documentRecords.length} records for document ${documentSource} in the database`);

    } catch (error) {
      const errorMessage = typeof filePathOrFile === 'string' ? filePathOrFile : filePathOrFile.name;
      console.error(`Error adding document ${errorMessage}:`, error);
      throw error;
    }
  }

  /**
   * Adds a document to the knowledge base from a Google Docs URL.
   * The document is processed, chunked, embedded, and stored in the vector database.
   * @param url - The Google Docs URL to import.
   * @param metadata - Optional metadata to include with the document.
   */
  public async addDocumentFromUrl(url: string, metadata?: Record<string, unknown>): Promise<void> {
    if (!this.table) {
      throw new Error('Knowledge base is not initialized.');
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

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Processing chunk ${i + 1}/${chunks.length}`);
        const embedding = await this.createEmbedding(chunk);
        records.push({
          vector: embedding,
          text: chunk,
          source: documentSource,
          metadata: documentMetadata,
          chunkIndex: i
        });
      }

      console.log(`Adding ${records.length} records to the knowledge base...`);
      await this.table.add(records);
      console.log(`Successfully added ${records.length} records to the knowledge base for document: ${documentSource}`);

      // Verify the records were added by checking the count
      const dummyEmbedding = new Array(384).fill(0); // MiniLM-L6-v2 has 384 dimensions
      const allRecords = await this.table.search(dummyEmbedding).limit(10000).execute();
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
    const titleMatch = url.match(/\/document\/d\/[^\/]+\/edit.*[?&]title=([^&]+)/);
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
  private chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
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
   * Searches the knowledge base for content relevant to a given query.
   * @param queryText - The text to search for.
   * @param limit - The maximum number of relevant chunks to return.
   * @returns {Promise<Array<{text: string, source: string, score: number}>>} A promise that resolves to an array of relevant document chunks.
   */
    public async search(queryText: string, limit: number = 5): Promise<Array<{text: string, source: string, score: number}>> {
    if (!this.table) {
      throw new Error('Knowledge base is not initialized.');
    }

    const queryEmbedding = await this.createEmbedding(queryText);

    const results = await this.table
      .search(queryEmbedding)
      .limit(limit)
      .execute();

    return results.map(r => ({
      text: String(r.text),
      source: String(r.source),
      score: Number(r.score)
    }));
  }

  /**
   * Removes a document from the knowledge base.
   * @param documentId - The identifier of the document to remove (typically the file path or name).
   * @returns {Promise<void>} A promise that resolves when the document is removed.
   */
  public async removeDocument(documentId: string): Promise<void> {
    if (!this.table) {
      throw new Error('Knowledge base is not initialized.');
    }

    // Remove all chunks that belong to this document
    await this.table.delete(`source = '${documentId}'`);
    console.log(`Removed document: ${documentId}`);
  }

  /**
   * Gets a list of all documents in the knowledge base.
   * @returns {Promise<string[]>} A promise that resolves to an array of document identifiers.
   */
  public async getDocuments(): Promise<string[]> {
    if (!this.table) {
      throw new Error('Knowledge base is not initialized.');
    }

    try {
      // Use search with a dummy embedding to get all records
      // This is the correct way to get all records from a LanceDB table
      const dummyEmbedding = new Array(384).fill(0); // MiniLM-L6-v2 has 384 dimensions
      const results = await this.table
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
    if (!this.table) {
      throw new Error('Knowledge base is not initialized.');
    }

    try {
      // Use search with a dummy embedding to get all records
      const dummyEmbedding = new Array(384).fill(0); // MiniLM-L6-v2 has 384 dimensions
      const results = await this.table
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
   * @returns {Promise<{data: any, stats: {totalRecords: number, totalDocuments: number, exportSize: number, exportTime: number}}>} The exported data and statistics.
   */
  public async exportKnowledgeBase(progressCallback?: (progress: {step: string, current: number, total: number, message: string}) => void): Promise<{data: any, stats: {totalRecords: number, totalDocuments: number, exportSize: number, exportTime: number}}> {
    if (!this.table) {
      throw new Error('Knowledge base is not initialized.');
    }

    const startTime = Date.now();
    progressCallback?.({step: 'initializing', current: 0, total: 100, message: 'Starting knowledge base export...'});

    try {
      // Get all records from the database
      progressCallback?.({step: 'fetching', current: 10, total: 100, message: 'Fetching all records from database...'});
      const dummyEmbedding = new Array(384).fill(0); // MiniLM-L6-v2 has 384 dimensions
      const allRecords = await this.table.search(dummyEmbedding).limit(50000).execute();

      progressCallback?.({step: 'processing', current: 30, total: 100, message: `Processing ${allRecords.length} records...`});

      // Filter out system entries and organize data
      const validRecords = allRecords.filter(r => (r as {source: string}).source !== 'system');

      // Create export structure
      const exportData = {
        version: '1.0.0',
        exportDate: new Date().toISOString(),
        embeddingDimensions: 384,
        records: validRecords.map(record => ({
          vector: (record as {vector: number[]}).vector,
          text: (record as {text: string}).text,
          source: (record as {source: string}).source,
          metadata: (record as {metadata?: Record<string, unknown>}).metadata || {},
          chunkIndex: (record as {chunkIndex?: number}).chunkIndex || 0
        }))
      };

      progressCallback?.({step: 'finalizing', current: 80, total: 100, message: 'Finalizing export data...'});

      // Calculate statistics
      const uniqueSources = new Set(exportData.records.map(r => r.source));
      const exportTime = Date.now() - startTime;
      const exportSize = JSON.stringify(exportData).length;

      const stats = {
        totalRecords: exportData.records.length,
        totalDocuments: uniqueSources.size,
        exportSize,
        exportTime
      };

      progressCallback?.({step: 'complete', current: 100, total: 100, message: `Export completed: ${stats.totalDocuments} documents, ${stats.totalRecords} chunks`});

      console.log(`✅ Knowledge base exported: ${stats.totalDocuments} documents, ${stats.totalRecords} records, ${Math.round(exportSize / 1024)}KB`);

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
    importData: any,
    options: {mode: 'replace' | 'merge', validateEmbeddings?: boolean} = {mode: 'replace', validateEmbeddings: true},
    progressCallback?: (progress: {step: string, current: number, total: number, message: string}) => void
  ): Promise<{success: boolean, stats: {importedRecords: number, importedDocuments: number, skippedRecords: number, importTime: number}}> {
    if (!this.table) {
      throw new Error('Knowledge base is not initialized.');
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
          const validBatch = batch.filter((record: any) => {
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
            await this.table.add(validBatch);
            importedRecords += validBatch.length;
            validBatch.forEach((record: any) => uniqueSources.add(record.source));
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
  private validateImportData(data: any): boolean {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check required fields
    if (!data.version || !data.records || !Array.isArray(data.records)) {
      return false;
    }

    // Check version compatibility
    if (data.version !== '1.0.0') {
      console.warn(`⚠️ Import data version ${data.version} may not be fully compatible with current version 1.0.0`);
    }

    // Validate a sample of records
    const sampleSize = Math.min(10, data.records.length);
    for (let i = 0; i < sampleSize; i++) {
      const record = data.records[i];
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
    if (!this.table) {
      throw new Error('Knowledge base is not initialized.');
    }

    try {
      // Get all records to delete them
      const dummyEmbedding = new Array(384).fill(0);
      const allRecords = await this.table.search(dummyEmbedding).limit(50000).execute();

      // Delete all non-system records
      for (const record of allRecords) {
        const source = (record as {source: string}).source;
        if (source !== 'system') {
          await this.table.delete(`source = '${source}'`);
        }
      }

      console.log('✅ Knowledge base cleared successfully');
    } catch (error) {
      console.error('❌ Failed to clear knowledge base:', error);
      throw error;
    }
  }

  /**
   * Gets statistics about the current knowledge base.
   * @returns {Promise<{totalRecords: number, totalDocuments: number, databaseSize: number}>} Knowledge base statistics.
   */
  public async getKnowledgeBaseStats(): Promise<{totalRecords: number, totalDocuments: number, databaseSize: number}> {
    if (!this.table) {
      throw new Error('Knowledge base is not initialized.');
    }

    try {
      const dummyEmbedding = new Array(384).fill(0);
      const allRecords = await this.table.search(dummyEmbedding).limit(50000).execute();

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
