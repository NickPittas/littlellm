import React, { useState, useEffect } from 'react';

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

const KnowledgeBaseSettings = () => {
  const [message, setMessage] = useState('');
  const [documents, setDocuments] = useState<DocumentWithMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [googleDocsUrl, setGoogleDocsUrl] = useState<string>('');
  const [isUrlImporting, setIsUrlImporting] = useState(false);

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

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleAddDocument = async () => {
    try {
      setIsLoading(true);
      const filePath = await window.electronAPI.openFileDialog();
      if (filePath) {
        setMessage(`Adding document: ${filePath}...`);
        const result = await window.electronAPI.addDocument(filePath);
        if (result.success) {
          setMessage(`Successfully added document: ${filePath}`);
          await loadDocuments(); // Refresh document list
        } else {
          setMessage(`Failed to add document: ${result.error}`);
        }
      } else {
        setMessage('No file selected.');
      }
    } catch (error) {
      console.error('Error adding document:', error);
      setMessage(`Error adding document: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        setMessage(`Adding ${filePaths.length} documents...`);

        // Initialize progress tracking
        const initialProgress = filePaths.map(path => ({
          fileName: path.split(/[\\/]/).pop() || path,
          status: 'pending' as const
        }));
        setUploadProgress(initialProgress);

        // Show warning for large files
        const largeFiles = filePaths.filter(path => {
          // This is a rough estimate - we can't get file size from path alone
          return path.toLowerCase().includes('large') || filePaths.length > 10;
        });

        if (filePaths.length > 5) {
          setMessage(`Processing ${filePaths.length} documents. This may take several minutes for large documents...`);
        }

        const result = await window.electronAPI.addDocumentsBatch(filePaths);

        if (result.success) {
          setMessage(result.summary || `Successfully added ${filePaths.length} documents`);

          // Update progress with results
          if (result.results) {
            const finalProgress = result.results.map(r => ({
              fileName: r.filePath.split(/[\\/]/).pop() || r.filePath,
              status: r.success ? 'success' as const : 'error' as const,
              error: r.error
            }));
            setUploadProgress(finalProgress);
          }

          await loadDocuments(); // Refresh document list
        } else {
          setMessage(`Failed to add documents: ${result.error}`);

          // Update progress to show error
          const errorProgress = initialProgress.map(p => ({
            ...p,
            status: 'error' as const,
            error: result.error
          }));
          setUploadProgress(errorProgress);
        }
      } else {
        setMessage('No files selected.');
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
      return;
    }

    try {
      setIsUrlImporting(true);
      setMessage(`Importing document from Google Docs...`);

      const result = await window.electronAPI.addDocumentFromUrl(googleDocsUrl);

      if (result.success) {
        setMessage(`Successfully imported document from Google Docs`);
        setGoogleDocsUrl(''); // Clear the URL input
        await loadDocuments(); // Refresh document list
      } else {
        setMessage(`Failed to import from Google Docs: ${result.error}`);
      }
    } catch (error) {
      console.error('Error importing from Google Docs:', error);
      setMessage(`Error importing from Google Docs: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUrlImporting(false);
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
