import React, { useState, useEffect } from 'react';

const KnowledgeBaseSettings = () => {
  const [message, setMessage] = useState('');
  const [documents, setDocuments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadDocuments = async () => {
    try {
      setIsLoading(true);
      const result = await window.electronAPI.getDocuments();
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
    } catch (error: any) {
      console.error('Error adding document:', error);
      setMessage(`Error adding document: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveDocument = async (documentId: string) => {
    try {
      setIsLoading(true);
      setMessage(`Removing document: ${documentId}...`);
      const result = await window.electronAPI.removeDocument(documentId);
      if (result.success) {
        setMessage(`Successfully removed document: ${documentId}`);
        await loadDocuments(); // Refresh document list
      } else {
        setMessage(`Failed to remove document: ${result.error}`);
      }
    } catch (error: any) {
      console.error('Error removing document:', error);
      setMessage(`Error removing document: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">Knowledge Base Management</h2>
      
      {/* Add Document Section */}
      <div className="mb-6">
        <div className="flex items-center space-x-4 mb-2">
          <button
            onClick={handleAddDocument}
            disabled={isLoading}
            className="bg-blue-500 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
          >
            {isLoading ? 'Processing...' : 'Add PDF Document'}
          </button>
        </div>
        {message && <p className="text-sm text-gray-500">{message}</p>}
      </div>

      {/* Documents List Section */}
      <div>
        <h3 className="text-md font-semibold mb-2">Documents in Knowledge Base</h3>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading documents...</p>
        ) : documents.length === 0 ? (
          <p className="text-sm text-gray-500">No documents added yet. Add a PDF document to get started.</p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-muted border border-border rounded">
                <span className="text-sm truncate flex-1 text-foreground">{doc}</span>
                <button
                  onClick={() => handleRemoveDocument(doc)}
                  disabled={isLoading}
                  className="bg-red-500 hover:bg-red-700 disabled:bg-gray-400 text-white text-xs py-1 px-2 rounded ml-2"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default KnowledgeBaseSettings;
