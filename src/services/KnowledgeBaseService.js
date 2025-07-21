"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeBaseService = void 0;
const lancedb = __importStar(require("vectordb"));
const transformers_1 = require("@xenova/transformers");
const path = __importStar(require("path"));
const fs = __importStar(require("fs/promises"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
/**
 * Manages the local knowledge base for the application.
 * This service handles the creation, management, and querying of a local vector database,
 * allowing AI models to access a shared, user-enrichable knowledge source.
 */
class KnowledgeBaseService {
    constructor() { }
    /**
     * Gets the singleton instance of the KnowledgeBaseService.
     * @returns {KnowledgeBaseService} The singleton instance.
     */
    static getInstance() {
        if (!KnowledgeBaseService.instance) {
            KnowledgeBaseService.instance = new KnowledgeBaseService();
        }
        return KnowledgeBaseService.instance;
    }
    /**
     * Initializes the connection to the LanceDB vector database.
     * Creates the database and necessary tables if they don't exist.
     * @param dbPath - The local file system path to store the database.
     */
    async initialize(dbPath) {
        this.db = await lancedb.connect(dbPath);
        // Using a pre-trained model for local embeddings
        this.embedder = await (0, transformers_1.pipeline)('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
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
        }
        else {
            this.table = await this.db.openTable('vectors');
            console.log('Connected to existing knowledge base table "vectors".');
        }
    }
    /**
     * Adds a document to the knowledge base.
     * The document is processed, chunked, embedded, and stored in the vector database.
     * @param filePath - The path to the file to be added (e.g., a PDF).
     */
    async addDocument(filePath) {
        if (!this.table) {
            throw new Error('Knowledge base is not initialized.');
        }
        console.log(`Starting to process document: ${filePath}`);
        const fileBuffer = await fs.readFile(filePath);
        const pdfData = await (0, pdf_parse_1.default)(fileBuffer);
        const text = pdfData.text;
        const chunks = this.chunkText(text);
        console.log(`Document chunked into ${chunks.length} pieces.`);
        const records = [];
        for (const chunk of chunks) {
            const embedding = await this.createEmbedding(chunk);
            records.push({ vector: embedding, text: chunk, source: path.basename(filePath) });
        }
        await this.table.add(records);
        console.log(`Successfully added ${records.length} records to the knowledge base.`);
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
    chunkText(text, chunkSize = 1000, overlap = 200) {
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize - overlap) {
            chunks.push(text.substring(i, i + chunkSize));
        }
        return chunks;
    }
    async createEmbedding(text) {
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
     * @returns {Promise<any[]>} A promise that resolves to an array of relevant document chunks.
     */
    async search(queryText, limit = 5) {
        if (!this.table) {
            throw new Error('Knowledge base is not initialized.');
        }
        const queryEmbedding = await this.createEmbedding(queryText);
        const results = await this.table
            .search(queryEmbedding)
            .limit(limit)
            .execute();
        return results.map(r => ({ text: r.text, source: r.source, score: r.score }));
    }
}
exports.KnowledgeBaseService = KnowledgeBaseService;
