/* eslint-disable no-console */
import React, { useState, useEffect } from 'react';
import { ProgressLogPanel } from './ProgressLogPanel';
import { Button } from './ui/button';
import { Input } from './ui/input';

// Constants for duplicate strings
const UNKNOWN_ERROR_MESSAGE = 'Unknown error';
const IMPORTING_TEXT = 'Importing...';
const IMPORT_TEXT = 'Import';
const PROCESSING_TEXT = 'Processing...';
const EXPORT_FAILED_MESSAGE = 'Export failed';
const IMPORT_FAILED_MESSAGE = 'Import failed';
const RECORDS_SKIPPED_MESSAGE = 'records skipped';
const TIME_UNIT = 's';

interface UploadProgress {
  fileName: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

interface DocumentWithMetadata {
  source: string;
  metadata: Record<string, unknown>;
  chunkCount: number;
  addedAt?: string;
}

interface KnowledgeBaseStats {
  totalRecords: number;
  totalDocuments: number;
  databaseSize: number;
}

const KnowledgeBaseSettings = () => {
  const [message, setMessage] = useState('');
  const [documents, setDocuments] = useState<DocumentWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [googleDocsUrl, setGoogleDocsUrl] = useState<string>('');
  const [isUrlImporting, setIsUrlImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [kbStats, setKbStats] = useState<KnowledgeBaseStats | null>(null);
  const [exportProgress, setExportProgress] = useState<{step: string, current: number, total: number, message: string} | null>(null);
  const [importProgress, setImportProgress] = useState<{step: string, current: number, total: number, message: string} | null>(null);
  const [progressEntries, setProgressEntries] = useState<Array<{
    id: string;
    timestamp: Date;
    level: 'info' | 'warning' | 'error' | 'success';
    operation: string;
    message: string;
    progress?: { current: number; total: number; percentage: number };
    metadata?: Record<string, unknown>;
  }>>([]);
  const [isProgressLogCollapsed, setIsProgressLogCollapsed] = useState(false);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const result = await window.electronAPI.getDocumentsWithMetadata();
      if (result.success) {
        setDocuments(result.documents);
      } else {
        console.error('Failed to load documents:', result.error);
        setDocuments([]);
      }
    } catch (error) {
      console.error('Error loading documents:', error);
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadKnowledgeBaseStats = async () => {
    try {
      const result = await window.electronAPI.getKnowledgeBaseStats();
      if (result.success && result.stats) {
        setKbStats(result.stats);
      }
    } catch (error) {
      console.error('Error loading knowledge base stats:', error);
    }
  };

  useEffect(() => {
    loadDocuments();
    loadKnowledgeBaseStats();

    // Set up progress listeners
    const exportUnsubscribe = window.electronAPI.onExportProgress((progress) => {
      setExportProgress(progress);
    });

    const importUnsubscribe = window.electronAPI.onImportProgress((progress) => {
      setImportProgress(progress);
    });

    const batchUnsubscribe = window.electronAPI.onBatchProgress((progress) => {
      // Add real-time progress entries for batch operations
      const operationId = `batch-upload-${Date.now()}`;

      if (progress.status === 'processing') {
        addProgressEntry(
          'info',
          operationId,
          progress.message,
          { current: progress.fileIndex, total: progress.totalFiles },
          {
            fileName: progress.fileName,
            step: progress.step,
            chunkCount: progress.chunkCount
          }
        );
      } else if (progress.status === 'success') {
        addProgressEntry(
          'success',
          operationId,
          progress.message,
          { current: progress.fileIndex, total: progress.totalFiles },
          {
            fileName: progress.fileName,
            chunkCount: progress.chunkCount
          }
        );
      } else if (progress.status === 'error') {
        addProgressEntry(
          'error',
          operationId,
          progress.message,
          { current: progress.fileIndex, total: progress.totalFiles },
          {
            fileName: progress.fileName,
            error: progress.error
          }
        );
      }

      // Update the upload progress state for the UI
      setUploadProgress(prev => {
        const newProgress = [...prev];
        const fileIndex = progress.fileIndex - 1; // Convert to 0-based index

        if (fileIndex >= 0 && fileIndex < newProgress.length) {
          newProgress[fileIndex] = {
            fileName: progress.fileName,
            status: progress.status === 'success' ? 'success' :
                   progress.status === 'error' ? 'error' : 'processing',
            error: progress.error
          };
        }

        return newProgress;
      });
    });

    return () => {
      exportUnsubscribe();
      importUnsubscribe();
      batchUnsubscribe();
    };
  }, []);

  const addProgressEntry = (
    level: 'info' | 'warning' | 'error' | 'success',
    operation: string,
    message: string,
    progress?: { current: number; total: number },
    metadata?: Record<string, unknown>
  ) => {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      operation,
      message,
      progress: progress ? {
        current: progress.current,
        total: progress.total,
        percentage: Math.round((progress.current / progress.total) * 100)
      } : undefined,
      metadata
    };

    setProgressEntries(prev => {
      const newEntries = [...prev, entry];
      // Limit to last 500 entries to prevent memory issues
      return newEntries.slice(-500);
    });
  };

  const clearProgressLog = () => {
    setProgressEntries([]);
    addProgressEntry('info', 'system', 'Progress log cleared');
  };

  const handleAddDocument = async () => {
    try {
      setIsLoading(true);
      const filePath = await window.electronAPI.openFileDialog();
      if (filePath) {
        const operationId = `single-upload-${Date.now()}`;
        const fileName = filePath.split(/[\\/]/).pop() || filePath;

        addProgressEntry('info', operationId, `Starting upload: ${fileName}`);
        setMessage(`Adding document: ${filePath}...`);

        const result = await window.electronAPI.addDocument(filePath);
        if (result.success) {
          setMessage(`Successfully added document: ${filePath}`);
          addProgressEntry('success', operationId, `Successfully uploaded: ${fileName}`);
          await loadDocuments(); // Refresh document list
          await loadKnowledgeBaseStats(); // Refresh stats
        } else {
          setMessage(`Failed to add document: ${result.error}`);
          addProgressEntry('error', operationId, `Failed to upload ${fileName}: ${result.error}`);
        }
      } else {
        setMessage('No file selected.');
        addProgressEntry('info', 'single-upload', 'Upload cancelled: No file selected');
      }
    } catch (error) {
      console.error('Error adding document:', error);
      const errorMessage = `Error adding document: ${error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE}`;
      setMessage(errorMessage);
      addProgressEntry('error', 'single-upload', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddDocumentsBatch = async () => {
    try {
      setIsLoading(true);
      setUploadProgress([]);
      const filePaths = await window.electronAPI.openKnowledgebaseFileDialog();

      if (filePaths && filePaths.length > 0) {
        const operationId = `batch-upload-${Date.now()}`;
        addProgressEntry('info', operationId, `Starting batch upload of ${filePaths.length} documents`);

        setMessage(`Adding ${filePaths.length} documents...`);

        // Initialize progress tracking
        const initialProgress = filePaths.map(path => ({
          fileName: path.split(/[\\/]/).pop() || path,
          status: 'pending' as const
        }));
        setUploadProgress(initialProgress);

        if (filePaths.length > 5) {
          setMessage(`Processing ${filePaths.length} documents. This may take several minutes for large documents...`);
          addProgressEntry('warning', operationId, `Large batch detected: ${filePaths.length} files may take several minutes to process`);
        }

        // The real-time progress updates will be handled by the batch progress listener
        const result = await window.electronAPI.addDocumentsBatch(filePaths);

        if (result.success) {
          setMessage(result.summary || `Successfully added ${filePaths.length} documents`);
          addProgressEntry('success', operationId, result.summary || `Batch upload completed: ${filePaths.length} documents processed`);

          // Log summary statistics
          if (result.results) {
            const successCount = result.results.filter(r => r.success).length;
            const errorCount = result.results.length - successCount;
            const totalChunks = result.results.reduce((sum, r) => sum + ((r as any).chunkCount || 0), 0);

            addProgressEntry('info', operationId, `Final statistics: ${successCount} successful, ${errorCount} failed, ${totalChunks} total chunks generated`, undefined, {
              successCount,
              errorCount,
              totalFiles: result.results.length,
              totalChunks
            });

            if (errorCount > 0) {
              addProgressEntry('warning', operationId, `${errorCount} files failed to process`, undefined, {
                successCount,
                errorCount,
                totalFiles: result.results.length
              });
            }
          }

          await loadDocuments(); // Refresh document list
          await loadKnowledgeBaseStats(); // Refresh stats
        } else {
          setMessage(`Failed to add documents: ${result.error}`);
          addProgressEntry('error', operationId, `Batch upload failed: ${result.error}`);
        }
      } else {
        setMessage('No files selected.');
        addProgressEntry('info', 'batch-upload', 'Upload cancelled: No files selected');
      }
    } catch (error) {
      console.error('Error adding documents:', error);
      setMessage(`Error adding documents: ${error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE}`);

      // Update progress to show error
      const errorProgress = uploadProgress.map(p => ({
        ...p,
        status: 'error' as const,
        error: error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE
      }));
      setUploadProgress(errorProgress);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddFromGoogleDocs = async () => {
    if (!googleDocsUrl.trim()) {
      setMessage('Please enter a Google Docs URL.');
      addProgressEntry('warning', 'google-docs-import', 'Import cancelled: No URL provided');
      return;
    }

    try {
      setIsUrlImporting(true);
      const operationId = `google-docs-import-${Date.now()}`;

      addProgressEntry('info', operationId, `Starting Google Docs import: ${googleDocsUrl}`);
      setMessage(`Importing document from Google Docs...`);

      const result = await window.electronAPI.addDocumentFromUrl(googleDocsUrl);

      if (result.success) {
        setMessage(`Successfully imported document from Google Docs`);
        addProgressEntry('success', operationId, 'Google Docs import completed successfully');
        setGoogleDocsUrl(''); // Clear the URL input
        await loadDocuments(); // Refresh document list
        await loadKnowledgeBaseStats(); // Refresh stats
      } else {
        setMessage(`Failed to import from Google Docs: ${result.error}`);
        addProgressEntry('error', operationId, `Google Docs import failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Error importing from Google Docs:', error);
      const errorMessage = `Error importing from Google Docs: ${error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE}`;
      setMessage(errorMessage);
      addProgressEntry('error', 'google-docs-import', errorMessage);
    } finally {
      setIsUrlImporting(false);
    }
  };

  const handleExportKnowledgeBase = async () => {
    try {
      setIsExporting(true);
      setExportProgress(null);
      const operationId = `export-${Date.now()}`;

      addProgressEntry('info', operationId, 'Starting knowledge base export...');
      setMessage('Starting knowledge base export...');

      const result = await window.electronAPI.exportKnowledgeBase();

      if (result.success && result.stats) {
        const sizeInMB = (result.stats.exportSize / (1024 * 1024)).toFixed(2);
        const timeInSeconds = (result.stats.exportTime / 1000).toFixed(1);
        const successMessage = `Export completed: ${result.stats.totalDocuments} documents, ${result.stats.totalRecords} chunks exported. File size: ${sizeInMB}MB, Time: ${timeInSeconds}s`;

        setMessage(`✅ ${successMessage}`);
        addProgressEntry('success', operationId, successMessage, undefined, {
          totalDocuments: result.stats.totalDocuments,
          totalRecords: result.stats.totalRecords,
          exportSize: result.stats.exportSize,
          exportTime: result.stats.exportTime,
          filePath: result.filePath
        });

        await loadKnowledgeBaseStats(); // Refresh stats
      } else {
        const errorMessage = `${EXPORT_FAILED_MESSAGE}: ${result.error}`;
        setMessage(`❌ ${errorMessage}`);
        addProgressEntry('error', operationId, errorMessage);
      }
    } catch (error) {
      console.error('Error exporting knowledge base:', error);
      const errorMessage = `Export error: ${error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE}`;
      setMessage(`❌ ${errorMessage}`);
      addProgressEntry('error', 'export', errorMessage);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const handleImportKnowledgeBase = async (mode: 'replace' | 'merge' = 'replace') => {
    try {
      setIsImporting(true);
      setImportProgress(null);
      const operationId = `import-${mode}-${Date.now()}`;

      addProgressEntry('info', operationId, `Starting knowledge base import (${mode} mode)...`);
      setMessage(`Starting knowledge base import (${mode} mode)...`);

      const result = await window.electronAPI.importKnowledgeBase({ mode });

      if (result.success && result.stats) {
        const timeInSeconds = (result.stats.importTime / 1000).toFixed(1);
        const skippedMessage = result.stats.skippedRecords > 0 
          ? `${result.stats.skippedRecords} ${RECORDS_SKIPPED_MESSAGE}. `
          : '';
        const successMessage = `Import completed: ${result.stats.importedDocuments} documents, ${result.stats.importedRecords} chunks imported. ${skippedMessage}Time: ${timeInSeconds}${TIME_UNIT}`;

        setMessage(`✅ ${successMessage}`);
        addProgressEntry('success', operationId, successMessage, undefined, {
          mode,
          importedDocuments: result.stats.importedDocuments,
          importedRecords: result.stats.importedRecords,
          skippedRecords: result.stats.skippedRecords,
          importTime: result.stats.importTime,
          filePath: result.filePath
        });

        if (result.stats.skippedRecords > 0) {
          addProgressEntry('warning', operationId, `${result.stats.skippedRecords} records were skipped during import`);
        }

        await loadDocuments(); // Refresh document list
        await loadKnowledgeBaseStats(); // Refresh stats
      } else {
        const errorMessage = `${IMPORT_FAILED_MESSAGE}: ${result.error}`;
        setMessage(`❌ ${errorMessage}`);
        addProgressEntry('error', operationId, errorMessage);
      }
    } catch (error) {
      console.error('Error importing knowledge base:', error);
      const errorMessage = `Import error: ${error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE}`;
      setMessage(`❌ ${errorMessage}`);
      addProgressEntry('error', 'import', errorMessage);
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  const handleRemoveDocument = async (documentSource: string) => {
    try {
      setIsLoading(true);
      setMessage(`Removing document: ${documentSource}...`);
      const result = await window.electronAPI.removeDocument(documentSource);
      if (result.success) {
        setMessage(`Successfully removed document: ${documentSource}`);
        await loadDocuments(); // Refresh document list
      } else {
        setMessage(`Failed to remove document: ${result.error}`);
      }
    } catch (error) {
      console.error('Error removing document:', error);
      setMessage(`Error removing document: ${error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium mb-2">Knowledge Base Management</h2>

      {/* Add Document Section */}
      <div className="space-y-2">
        <h3 className="text-xs font-medium mb-1">Add Documents</h3>

        {/* Single Document Upload */}
        <div className="flex items-center space-x-2 mb-2">
          <Button
            onClick={handleAddDocument}
            disabled={isLoading || isUrlImporting}
            size="sm"
            className="h-7 text-xs"
          >
            {isLoading ? PROCESSING_TEXT : 'Add Single PDF'}
          </Button>

          <Button
            onClick={handleAddDocumentsBatch}
            disabled={isLoading || isUrlImporting}
            variant="outline"
            size="sm"
            className="h-7 text-xs"
          >
            {isLoading ? PROCESSING_TEXT : 'Add Multiple Documents'}
          </Button>
        </div>

        {/* Supported file types info */}
        <div className="mb-2 p-3 bg-muted/50 border border-border rounded-md text-xs">
          <p className="font-medium mb-2 text-foreground">Supported file types:</p>
          <p className="text-muted-foreground leading-relaxed">
            • PDF documents (.pdf)<br/>
            • Text files (.txt)<br/>
            • Markdown files (.md)<br/>
            • Word documents (.docx, .doc)
          </p>
        </div>

        {/* Google Docs Import Section */}
        <div className="mb-4 p-4 border border-border rounded-lg bg-card">
          <h4 className="font-medium mb-3 text-card-foreground">Import from Google Docs</h4>
          <div className="flex items-center space-x-2 mb-3">
            <Input
              type="text"
              value={googleDocsUrl}
              onChange={(e) => setGoogleDocsUrl(e.target.value)}
              placeholder="Paste Google Docs URL here..."
              disabled={isLoading || isUrlImporting}
              className="flex-1"
            />
            <Button
              onClick={handleAddFromGoogleDocs}
              disabled={isLoading || isUrlImporting || !googleDocsUrl.trim()}
              size="default"
            >
              {isUrlImporting ? IMPORTING_TEXT : IMPORT_TEXT}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Note: The Google Docs document must be publicly accessible (shared with &quot;Anyone with the link can view&quot;)
          </p>
        </div>

        {/* Upload Progress */}
        {uploadProgress.length > 0 && (
          <div className="mb-4 p-3 border border-border rounded-lg bg-card">
            <h4 className="font-medium mb-2 text-card-foreground">Upload Progress</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {uploadProgress.map((progress, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1 text-foreground">{progress.fileName}</span>
                  <span className={`ml-2 px-2 py-1 rounded-md text-xs font-medium ${
                    progress.status === 'success' ? 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20' :
                    progress.status === 'error' ? 'bg-destructive/10 text-destructive border border-destructive/20' :
                    progress.status === 'processing' ? 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20' :
                    'bg-muted text-muted-foreground border border-border'
                  }`}>
                    {progress.status === 'success' ? '✓ Success' :
                     progress.status === 'error' ? '✗ Error' :
                     progress.status === 'processing' ? '⏳ Processing' :
                     '⏸ Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </div>

      {/* Knowledge Base Management Section */}
      <div className="mb-6">
        <h3 className="text-md font-semibold mb-3">Knowledge Base Management</h3>

        {/* Statistics Display */}
        {kbStats && (
          <div className="mb-4 p-4 bg-muted/50 border border-border rounded-lg text-sm">
            <p className="font-medium mb-3 text-foreground">Current Knowledge Base:</p>
            <div className="text-muted-foreground space-y-2">
              <div className="flex justify-between items-center">
                <span>Documents:</span>
                <span className="font-semibold text-foreground">{kbStats.totalDocuments.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Chunks:</span>
                <span className="font-semibold text-foreground">{kbStats.totalRecords.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span>Estimated Size:</span>
                <span className="font-semibold text-foreground">{(kbStats.databaseSize / (1024 * 1024)).toFixed(1)} MB</span>
              </div>
            </div>
          </div>
        )}

        {/* Export/Import Controls */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Button
            onClick={handleExportKnowledgeBase}
            disabled={isLoading || isExporting || isImporting || isUrlImporting}
            size="sm"
            variant="default"
          >
            {isExporting ? 'Exporting...' : 'Export Knowledge Base'}
          </Button>

          <Button
            onClick={() => handleImportKnowledgeBase('replace')}
            disabled={isLoading || isExporting || isImporting || isUrlImporting}
            size="sm"
            variant="destructive"
          >
            {isImporting ? IMPORTING_TEXT : 'Import (Replace)'}
          </Button>

          <Button
            onClick={() => handleImportKnowledgeBase('merge')}
            disabled={isLoading || isExporting || isImporting || isUrlImporting}
            size="sm"
            variant="secondary"
          >
            {isImporting ? IMPORTING_TEXT : 'Import (Merge)'}
          </Button>
        </div>

        {/* Export/Import Progress */}
        {(exportProgress || importProgress) && (
          <div className="mb-4 p-3 border border-border rounded-lg bg-card">
            <h4 className="font-medium mb-2 text-card-foreground">
              {exportProgress ? 'Export Progress' : 'Import Progress'}
            </h4>
            {(exportProgress || importProgress) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{(exportProgress || importProgress)?.message}</span>
                  <span className="font-medium text-foreground">
                    {(exportProgress || importProgress)?.current}% / {(exportProgress || importProgress)?.total}%
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(exportProgress || importProgress)?.current || 0}%` }}
                  ></div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Step: {(exportProgress || importProgress)?.step}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Import Mode Information */}
        <div className="mb-4 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg text-sm">
          <p className="font-medium mb-2 text-yellow-800 dark:text-yellow-300">Import Modes:</p>
          <div className="text-yellow-700 dark:text-yellow-400 space-y-1.5">
            <p><strong className="text-foreground">Replace:</strong> Clears existing knowledge base and imports new data</p>
            <p><strong className="text-foreground">Merge:</strong> Adds imported data to existing knowledge base</p>
          </div>
        </div>
      </div>

      {/* Progress Log Panel */}
      <div className="mb-6">
        <ProgressLogPanel
          entries={progressEntries}
          isCollapsed={isProgressLogCollapsed}
          onToggleCollapse={() => setIsProgressLogCollapsed(!isProgressLogCollapsed)}
          onClear={clearProgressLog}
          maxHeight="250px"
        />
      </div>

      {/* Documents List Section */}
      <div>
        <h3 className="text-md font-semibold mb-2 text-foreground">Documents in Knowledge Base</h3>
        {isLoading && uploadProgress.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading documents...</p>
        ) : documents.length === 0 ? (
          <div className="p-4 bg-muted rounded-lg text-center">
            <p className="text-sm text-muted-foreground mb-2">No documents added yet.</p>
            <p className="text-xs text-muted-foreground">
              Add documents using the buttons above to start building your knowledge base.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc, index) => {
              const fileExtension = doc.source.split('.').pop()?.toLowerCase();
              const format = doc.metadata.format as string || 'Unknown';
              const uploadDate = doc.addedAt ? new Date(doc.addedAt).toLocaleDateString() : 'Unknown';
              const characterCount = doc.metadata.characterCount as number;
              const fileSize = doc.metadata.fileSize as number;

              const getFileTypeIcon = (ext?: string, format?: string) => {
                if (format === 'Google Docs') return '📄';
                switch (ext) {
                  case 'pdf': return '📄';
                  case 'txt': return '📝';
                  case 'md': return '📋';
                  case 'docx':
                  case 'doc': return '📘';
                  default: return '📄';
                }
              };

              const formatFileSize = (bytes?: number) => {
                if (!bytes) return '';
                if (bytes < 1024) return `${bytes} B`;
                if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
                return `${Math.round(bytes / (1024 * 1024))} MB`;
              };

              return (
                <div key={index} className="flex items-center justify-between p-3 bg-card border border-border rounded-lg">
                  <div className="flex items-center flex-1">
                    <span className="mr-3 text-lg">{getFileTypeIcon(fileExtension, format)}</span>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-card-foreground block truncate">{doc.source}</span>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex items-center space-x-4">
                          <span>{format}</span>
                          <span>•</span>
                          <span>{doc.chunkCount} chunks</span>
                          {fileSize && (
                            <>
                              <span>•</span>
                              <span>{formatFileSize(fileSize)}</span>
                            </>
                          )}
                          {characterCount && (
                            <>
                              <span>•</span>
                              <span>{characterCount.toLocaleString()} chars</span>
                            </>
                          )}
                        </div>
                        <div>Added: {uploadDate}</div>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleRemoveDocument(doc.source)}
                    disabled={isLoading || isUrlImporting}
                    variant="destructive"
                    size="sm"
                    className="ml-2"
                  >
                    Remove
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBaseSettings;
