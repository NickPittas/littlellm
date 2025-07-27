import React, { useState, useEffect } from 'react';
import { ProgressLogPanel } from './ProgressLogPanel';

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
      const errorMessage = `Error adding document: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
            const totalChunks = result.results.reduce((sum, r) => sum + (r.chunkCount || 0), 0);

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
      setMessage(`Error adding documents: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Update progress to show error
      const errorProgress = uploadProgress.map(p => ({
        ...p,
        status: 'error' as const,
        error: error instanceof Error ? error.message : 'Unknown error'
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
      const errorMessage = `Error importing from Google Docs: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
        const errorMessage = `Export failed: ${result.error}`;
        setMessage(`❌ ${errorMessage}`);
        addProgressEntry('error', operationId, errorMessage);
      }
    } catch (error) {
      console.error('Error exporting knowledge base:', error);
      const errorMessage = `Export error: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
        const successMessage = `Import completed: ${result.stats.importedDocuments} documents, ${result.stats.importedRecords} chunks imported. ${result.stats.skippedRecords > 0 ? `${result.stats.skippedRecords} records skipped. ` : ''}Time: ${timeInSeconds}s`;

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
        const errorMessage = `Import failed: ${result.error}`;
        setMessage(`❌ ${errorMessage}`);
        addProgressEntry('error', operationId, errorMessage);
      }
    } catch (error) {
      console.error('Error importing knowledge base:', error);
      const errorMessage = `Import error: ${error instanceof Error ? error.message : 'Unknown error'}`;
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
      setMessage(`Error removing document: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Knowledge Base Management</h2>
      
      {/* Add Document Section */}
      <div className="mb-6">
        <h3 className="text-md font-semibold mb-3">Add Documents</h3>

        {/* Single Document Upload */}
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={handleAddDocument}
            disabled={isLoading || isUrlImporting}
            className="bg-blue-500 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
          >
            {isLoading ? 'Processing...' : 'Add Single PDF'}
          </button>

          <button
            onClick={handleAddDocumentsBatch}
            disabled={isLoading || isUrlImporting}
            className="bg-green-500 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
          >
            {isLoading ? 'Processing...' : 'Add Multiple Documents'}
          </button>
        </div>

        {/* Supported file types info */}
        <div className="mb-4 p-3 bg-muted rounded text-sm">
          <p className="font-medium mb-1 text-foreground">Supported file types:</p>
          <p className="text-muted-foreground">
            • PDF documents (.pdf)<br/>
            • Text files (.txt)<br/>
            • Markdown files (.md)<br/>
            • Word documents (.docx, .doc)
          </p>
        </div>

        {/* Google Docs Import Section */}
        <div className="mb-4 p-4 border border-gray-300 rounded">
          <h4 className="font-medium mb-2">Import from Google Docs</h4>
          <div className="flex items-center space-x-2 mb-2">
            <input
              type="text"
              value={googleDocsUrl}
              onChange={(e) => setGoogleDocsUrl(e.target.value)}
              placeholder="Paste Google Docs URL here..."
              disabled={isLoading || isUrlImporting}
              className="flex-1 px-3 py-2 border border-gray-300 rounded text-black"
            />
            <button
              onClick={handleAddFromGoogleDocs}
              disabled={isLoading || isUrlImporting || !googleDocsUrl.trim()}
              className="bg-purple-500 hover:bg-purple-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
            >
              {isUrlImporting ? 'Importing...' : 'Import'}
            </button>
          </div>
          <p className="text-xs text-gray-500">
            Note: The Google Docs document must be publicly accessible (shared with "Anyone with the link can view")
          </p>
        </div>

        {/* Upload Progress */}
        {uploadProgress.length > 0 && (
          <div className="mb-4 p-3 border border-gray-300 rounded">
            <h4 className="font-medium mb-2">Upload Progress</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {uploadProgress.map((progress, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="truncate flex-1">{progress.fileName}</span>
                  <span className={`ml-2 px-2 py-1 rounded text-xs ${
                    progress.status === 'success' ? 'bg-green-100 text-green-800' :
                    progress.status === 'error' ? 'bg-red-100 text-red-800' :
                    progress.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
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

        {message && <p className="text-sm text-gray-500">{message}</p>}
      </div>

      {/* Knowledge Base Management Section */}
      <div className="mb-6">
        <h3 className="text-md font-semibold mb-3">Knowledge Base Management</h3>

        {/* Statistics Display */}
        {kbStats && (
          <div className="mb-4 p-3 bg-muted rounded text-sm">
            <p className="font-medium mb-1 text-foreground">Current Knowledge Base:</p>
            <div className="text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>Documents:</span>
                <span className="font-medium">{kbStats.totalDocuments.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Chunks:</span>
                <span className="font-medium">{kbStats.totalRecords.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Size:</span>
                <span className="font-medium">{(kbStats.databaseSize / (1024 * 1024)).toFixed(1)} MB</span>
              </div>
            </div>
          </div>
        )}

        {/* Export/Import Controls */}
        <div className="flex items-center space-x-4 mb-4">
          <button
            onClick={handleExportKnowledgeBase}
            disabled={isLoading || isExporting || isImporting || isUrlImporting}
            className="bg-blue-500 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
          >
            {isExporting ? 'Exporting...' : 'Export Knowledge Base'}
          </button>

          <button
            onClick={() => handleImportKnowledgeBase('replace')}
            disabled={isLoading || isExporting || isImporting || isUrlImporting}
            className="bg-orange-500 hover:bg-orange-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
          >
            {isImporting ? 'Importing...' : 'Import (Replace)'}
          </button>

          <button
            onClick={() => handleImportKnowledgeBase('merge')}
            disabled={isLoading || isExporting || isImporting || isUrlImporting}
            className="bg-green-500 hover:bg-green-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
          >
            {isImporting ? 'Importing...' : 'Import (Merge)'}
          </button>
        </div>

        {/* Export/Import Progress */}
        {(exportProgress || importProgress) && (
          <div className="mb-4 p-3 border border-gray-300 rounded">
            <h4 className="font-medium mb-2">
              {exportProgress ? 'Export Progress' : 'Import Progress'}
            </h4>
            {(exportProgress || importProgress) && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>{(exportProgress || importProgress)?.message}</span>
                  <span className="font-medium">
                    {(exportProgress || importProgress)?.current}% / {(exportProgress || importProgress)?.total}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(exportProgress || importProgress)?.current || 0}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500">
                  Step: {(exportProgress || importProgress)?.step}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Import Mode Information */}
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
          <p className="font-medium mb-1 text-yellow-800">Import Modes:</p>
          <div className="text-yellow-700 space-y-1">
            <p><strong>Replace:</strong> Clears existing knowledge base and imports new data</p>
            <p><strong>Merge:</strong> Adds imported data to existing knowledge base</p>
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
        <h3 className="text-md font-semibold mb-2">Documents in Knowledge Base</h3>
        {isLoading && uploadProgress.length === 0 ? (
          <p className="text-sm text-gray-500">Loading documents...</p>
        ) : documents.length === 0 ? (
          <div className="p-4 bg-gray-50 rounded text-center">
            <p className="text-sm text-gray-500 mb-2">No documents added yet.</p>
            <p className="text-xs text-gray-400">
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
                <div key={index} className="flex items-center justify-between p-3 bg-muted border border-border rounded">
                  <div className="flex items-center flex-1">
                    <span className="mr-3 text-lg">{getFileTypeIcon(fileExtension, format)}</span>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-foreground block truncate">{doc.source}</span>
                      <div className="text-xs text-gray-500 space-y-1">
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
                  <button
                    onClick={() => handleRemoveDocument(doc.source)}
                    disabled={isLoading || isUrlImporting}
                    className="bg-red-500 hover:bg-red-700 disabled:bg-gray-400 text-white text-xs py-1 px-3 rounded ml-2"
                  >
                    Remove
                  </button>
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
