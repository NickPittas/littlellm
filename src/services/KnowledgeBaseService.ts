import * as lancedb from 'vectordb';
import { pipeline, FeatureExtractionPipeline } from '@xenova/transformers';
import * as path from 'path';
import * as fs from 'fs/promises';
import pdf from 'pdf-parse';

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
   * Adds a document to the knowledge base.
   * The document is processed, chunked, embedded, and stored in the vector database.
   * @param filePath - The path to the file to be added (e.g., a PDF).
   */
      public async addDocument(filePath: string): Promise<void> {
    if (!this.table) {
      throw new Error('Knowledge base is not initialized.');
    }

    try {
      console.log(`Starting to process document: ${filePath}`);
      
      // Check if file exists
      const fileBuffer = await fs.readFile(filePath);
      console.log(`File read successfully, size: ${fileBuffer.length} bytes`);
      
      const pdfData = await pdf(fileBuffer);
      const text = pdfData.text;
      console.log(`PDF parsed successfully, text length: ${text.length} characters`);

      if (!text || text.trim().length === 0) {
        throw new Error('No text content found in the PDF document');
      }

      const chunks = this.chunkText(text);
      console.log(`Document chunked into ${chunks.length} pieces.`);

      const records = [];
      const documentSource = path.basename(filePath);
      console.log(`Using document source: ${documentSource}`);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Processing chunk ${i + 1}/${chunks.length}`);
        const embedding = await this.createEmbedding(chunk);
        records.push({ vector: embedding, text: chunk, source: documentSource });
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
      console.error(`Error adding document ${filePath}:`, error);
      throw error;
    }
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
      const uniqueSources = [...new Set(results.map(r => (r as {source: string}).source as string))]
        .filter(source => source !== 'system');
      
      console.log(`Found ${uniqueSources.length} unique documents:`, uniqueSources);
      return uniqueSources;
    } catch (error) {
      console.error('Error getting documents:', error);
      return [];
    }
  }
}
