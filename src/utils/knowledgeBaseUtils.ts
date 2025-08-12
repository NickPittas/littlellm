import { debugLogger } from '../services/debugLogger';

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('../services/debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}



export interface ProgressEntry {
  id: string;
  timestamp: Date;
  type: 'info' | 'success' | 'error' | 'warning';
  operationId: string;
  message: string;
}

export interface UploadProgress {
  fileName: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  progress?: number;
  error?: string;
}

export interface DocumentOperationResult {
  success: boolean;
  error?: string;
  summary?: string;
  stats?: {
    importedRecords: number;
    importedDocuments: number;
    skippedRecords: number;
    importTime: number;
  };
}

/**
 * Creates a progress entry for tracking operations
 */
export function createProgressEntry(
  type: 'info' | 'success' | 'error' | 'warning',
  operationId: string,
  message: string
): ProgressEntry {
  return {
    id: `${operationId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    type,
    operationId,
    message
  };
}

/**
 * Generates a unique operation ID for tracking
 */
export function generateOperationId(operation: string): string {
  return `${operation}-${Date.now()}`;
}

/**
 * Extracts filename from a file path
 */
export function extractFileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() || filePath;
}

/**
 * Handles single document upload operation
 */
export async function handleSingleDocumentUpload(
  addProgressEntry: (type: 'info' | 'success' | 'error' | 'warning', operationId: string, message: string) => void,
  setMessage: (message: string) => void
): Promise<DocumentOperationResult> {
  try {
    const filePath = await window.electronAPI.openFileDialog();
    if (!filePath) {
      const message = 'No file selected.';
      setMessage(message);
      addProgressEntry('info', 'single-upload', 'Upload cancelled: No file selected');
      return { success: false, error: message };
    }

    const operationId = generateOperationId('single-upload');
    const fileName = extractFileName(filePath);

    addProgressEntry('info', operationId, `Starting upload: ${fileName}`);
    setMessage(`Adding document: ${filePath}...`);

    const result = await window.electronAPI.addDocument(filePath);
    
    if (result.success) {
      const successMessage = `Successfully added document: ${filePath}`;
      setMessage(successMessage);
      addProgressEntry('success', operationId, `Successfully uploaded: ${fileName}`);
      return { success: true };
    } else {
      const errorMessage = `Failed to add document: ${result.error}`;
      setMessage(errorMessage);
      addProgressEntry('error', operationId, `Failed to upload ${fileName}: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error) {
    safeDebugLog('error', 'KNOWLEDGEBASE_UTILS', 'Error adding document:', error);
    const errorMessage = `Error adding document: ${error instanceof Error ? error.message : 'Unknown error'}`;
    setMessage(errorMessage);
    addProgressEntry('error', 'single-upload', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Handles batch document upload operation
 */
export async function handleBatchDocumentUpload(
  addProgressEntry: (type: 'info' | 'success' | 'error' | 'warning', operationId: string, message: string) => void,
  setMessage: (message: string) => void,
  setUploadProgress: (progress: UploadProgress[]) => void
): Promise<DocumentOperationResult> {
  try {
    setUploadProgress([]);
    const filePaths = await window.electronAPI.openKnowledgebaseFileDialog();
    
    if (!filePaths || filePaths.length === 0) {
      const message = 'No files selected.';
      setMessage(message);
      addProgressEntry('info', 'batch-upload', 'Upload cancelled: No files selected');
      return { success: false, error: message };
    }

    const operationId = generateOperationId('batch-upload');
    
    addProgressEntry('info', operationId, `Starting batch upload: ${filePaths.length} files selected`);
    setMessage(`Adding ${filePaths.length} documents...`);

    // Initialize progress tracking
    const initialProgress = filePaths.map(filePath => ({
      fileName: extractFileName(filePath),
      status: 'pending' as const
    }));
    setUploadProgress(initialProgress);

    // The real-time progress updates will be handled by the batch progress listener
    const result = await window.electronAPI.addDocumentsBatch(filePaths);

    if (result.success) {
      const successMessage = result.summary || `Successfully added ${filePaths.length} documents`;
      setMessage(successMessage);
      addProgressEntry('success', operationId, result.summary || `Batch upload completed: ${filePaths.length} documents processed`);
      return { success: true, summary: result.summary };
    } else {
      const errorMessage = `Failed to add documents: ${result.error}`;
      setMessage(errorMessage);
      addProgressEntry('error', operationId, `Batch upload failed: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error) {
    safeDebugLog('error', 'KNOWLEDGEBASE_UTILS', 'Error adding documents:', error);
    const errorMessage = `Error adding documents: ${error instanceof Error ? error.message : 'Unknown error'}`;
    setMessage(errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Handles Google Docs import operation
 */
export async function handleGoogleDocsImport(
  googleDocsUrl: string,
  addProgressEntry: (type: 'info' | 'success' | 'error' | 'warning', operationId: string, message: string) => void,
  setMessage: (message: string) => void
): Promise<DocumentOperationResult> {
  if (!googleDocsUrl.trim()) {
    const message = 'Please enter a Google Docs URL.';
    setMessage(message);
    addProgressEntry('warning', 'google-docs-import', 'Import cancelled: No URL provided');
    return { success: false, error: message };
  }

  try {
    const operationId = generateOperationId('google-docs-import');

    addProgressEntry('info', operationId, `Starting Google Docs import: ${googleDocsUrl}`);
    setMessage(`Importing document from Google Docs...`);

    const result = await window.electronAPI.addDocumentFromUrl(googleDocsUrl);
    
    if (result.success) {
      const successMessage = `Successfully imported document from Google Docs: ${googleDocsUrl}`;
      setMessage(successMessage);
      addProgressEntry('success', operationId, `Successfully imported from Google Docs: ${googleDocsUrl}`);
      return { success: true };
    } else {
      const errorMessage = `Failed to import from Google Docs: ${result.error}`;
      setMessage(errorMessage);
      addProgressEntry('error', operationId, `Failed to import from Google Docs: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error) {
    safeDebugLog('error', 'KNOWLEDGEBASE_UTILS', 'Error importing from Google Docs:', error);
    const errorMessage = `Error importing from Google Docs: ${error instanceof Error ? error.message : 'Unknown error'}`;
    setMessage(errorMessage);
    addProgressEntry('error', 'google-docs-import', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Handles knowledge base export operation
 */
export async function handleKnowledgeBaseExport(
  addProgressEntry: (type: 'info' | 'success' | 'error' | 'warning', operationId: string, message: string) => void,
  setMessage: (message: string) => void
): Promise<DocumentOperationResult> {
  try {
    const operationId = generateOperationId('export');

    addProgressEntry('info', operationId, 'Starting knowledge base export...');
    setMessage('Starting knowledge base export...');

    const result = await window.electronAPI.exportKnowledgeBase();
    
    if (result.success) {
      const successMessage = `✅ Export completed successfully! Saved to: ${result.filePath}`;
      setMessage(successMessage);
      addProgressEntry('success', operationId, `Export completed: ${result.filePath}`);
      return { success: true };
    } else {
      const errorMessage = `Export failed: ${result.error}`;
      setMessage(`❌ ${errorMessage}`);
      addProgressEntry('error', operationId, errorMessage);
      return { success: false, error: result.error };
    }
  } catch (error) {
    safeDebugLog('error', 'KNOWLEDGEBASE_UTILS', 'Error exporting knowledge base:', error);
    const errorMessage = `Export error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    setMessage(`❌ ${errorMessage}`);
    addProgressEntry('error', 'export', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Handles knowledge base import operation
 */
export async function handleKnowledgeBaseImport(
  mode: 'replace' | 'merge',
  addProgressEntry: (type: 'info' | 'success' | 'error' | 'warning', operationId: string, message: string) => void,
  setMessage: (message: string) => void
): Promise<DocumentOperationResult> {
  try {
    const operationId = generateOperationId(`import-${mode}`);

    addProgressEntry('info', operationId, `Starting knowledge base import (${mode} mode)...`);
    setMessage(`Starting knowledge base import (${mode} mode)...`);

    const result = await window.electronAPI.importKnowledgeBase({ mode });
    
    if (result.success && result.stats) {
      const successMessage = `✅ Import completed! Imported ${result.stats.importedRecords} records from ${result.stats.importedDocuments} documents in ${(result.stats.importTime / 1000).toFixed(1)}s`;
      setMessage(successMessage);
      addProgressEntry('success', operationId, successMessage);

      if (result.stats.skippedRecords > 0) {
        addProgressEntry('warning', operationId, `${result.stats.skippedRecords} records were skipped during import`);
      }

      return { success: true, stats: result.stats };
    } else {
      const errorMessage = `Import failed: ${result.error}`;
      setMessage(`❌ ${errorMessage}`);
      addProgressEntry('error', operationId, errorMessage);
      return { success: false, error: result.error };
    }
  } catch (error) {
    safeDebugLog('error', 'KNOWLEDGEBASE_UTILS', 'Error importing knowledge base:', error);
    const errorMessage = `Import error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    setMessage(`❌ ${errorMessage}`);
    addProgressEntry('error', 'import', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Handles document removal operation
 */
export async function handleDocumentRemoval(
  documentSource: string,
  setMessage: (message: string) => void
): Promise<DocumentOperationResult> {
  try {
    setMessage(`Removing document: ${documentSource}...`);
    const result = await window.electronAPI.removeDocument(documentSource);
    
    if (result.success) {
      const successMessage = `Successfully removed document: ${documentSource}`;
      setMessage(successMessage);
      return { success: true };
    } else {
      const errorMessage = `Failed to remove document: ${result.error}`;
      setMessage(errorMessage);
      return { success: false, error: result.error };
    }
  } catch (error) {
    safeDebugLog('error', 'KNOWLEDGEBASE_UTILS', 'Error removing document:', error);
    const errorMessage = `Error removing document: ${error instanceof Error ? error.message : 'Unknown error'}`;
    setMessage(errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Formats file size in human-readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Gets file type icon based on extension and format
 */
export function getFileTypeIcon(fileExtension?: string, format?: string): string {
  if (format === 'Google Docs') return '📄';
  
  switch (fileExtension) {
    case 'pdf': return '📄';
    case 'doc':
    case 'docx': return '📝';
    case 'xls':
    case 'xlsx': return '📊';
    case 'ppt':
    case 'pptx': return '📈';
    case 'txt': return '📃';
    case 'md': return '📋';
    case 'csv': return '📊';
    default: return '📄';
  }
}
