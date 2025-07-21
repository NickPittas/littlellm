'use client';
// Test page for Mistral file upload functionality
import React, { useState } from 'react';
import { MistralFileService } from '../services/mistralFileService';

export default function TestMistral() {
  const [apiKey, setApiKey] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      console.log('File selected:', selectedFile.name, selectedFile.type, selectedFile.size);
    }
  };

  const testFileValidation = () => {
    if (!file) {
      setResult('Please select a file first');
      return;
    }

    const validation = MistralFileService.isFileSupported(file);
    setResult(`File validation: ${validation.supported ? 'SUPPORTED' : 'NOT SUPPORTED'}${validation.reason ? ` - ${validation.reason}` : ''}`);
  };

  const testFileUpload = async () => {
    if (!file || !apiKey) {
      setResult('Please provide API key and select a file');
      return;
    }

    setLoading(true);
    try {
      const fileService = new MistralFileService(apiKey);

      // Determine purpose based on file type
      const purpose = (file.type === 'application/pdf' || file.type.includes('document')) ? 'ocr' : 'batch';

      console.log('Testing file upload...');
      const uploadResult = await fileService.uploadFile(file, purpose);
      setResult(`Upload successful: ${JSON.stringify(uploadResult, null, 2)}`);
    } catch (error) {
      console.error('Upload failed:', error);
      setResult(`Upload failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const testOCR = async () => {
    if (!file || !apiKey) {
      setResult('Please provide API key and select a file');
      return;
    }

    setLoading(true);
    try {
      const fileService = new MistralFileService(apiKey);

      console.log('Testing OCR...');
      const ocrResult = await fileService.processDocumentOCR(file);
      setResult(`OCR successful: ${JSON.stringify({
        contentLength: ocrResult.content?.length || 0,
        contentPreview: ocrResult.content?.substring(0, 500) + '...',
        hasMetadata: !!ocrResult.metadata
      }, null, 2)}`);
    } catch (error) {
      console.error('OCR failed:', error);
      setResult(`OCR failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const testLocalProcessing = async () => {
    if (!file) {
      setResult('Please select a file');
      return;
    }

    setLoading(true);
    try {
      const fileService = new MistralFileService('test-key'); // API key not needed for local processing

      console.log('Testing local file processing...');
      const processResult = await fileService.prepareFileForVision(file);
      setResult(`Local processing successful: ${JSON.stringify({
        type: processResult.type,
        hasImageUrl: !!processResult.image_url,
        hasText: !!processResult.text,
        textLength: processResult.text?.length || 0,
        imageUrlLength: processResult.image_url?.url?.length || 0
      }, null, 2)}`);
    } catch (error) {
      console.error('Local processing failed:', error);
      setResult(`Local processing failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const testVisionPrep = async () => {
    if (!file) {
      setResult('Please select a file');
      return;
    }

    setLoading(true);
    try {
      const fileService = new MistralFileService('test-key'); // API key not needed for local processing

      console.log('Testing vision preparation...');
      const prepResult = await fileService.prepareFileForVision(file);
      setResult(`Vision prep successful: ${JSON.stringify({
        type: prepResult.type,
        hasImageUrl: !!prepResult.image_url,
        hasText: !!prepResult.text,
        textLength: prepResult.text?.length || 0,
        imageUrlLength: prepResult.image_url?.url?.length || 0
      }, null, 2)}`);
    } catch (error) {
      console.error('Vision prep failed:', error);
      setResult(`Vision prep failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Mistral File Upload Test</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <label>
          Mistral API Key:
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{ marginLeft: '10px', padding: '5px', width: '300px' }}
            placeholder="Enter your Mistral API key"
          />
        </label>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label>
          Select File:
          <input
            type="file"
            onChange={handleFileChange}
            style={{ marginLeft: '10px' }}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv,.json,.docx,.xlsx,.pptx,.doc,.xls,.ppt,.md"
          />
        </label>
        {file && (
          <div style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
            Selected: {file.name} ({file.type}, {Math.round(file.size / 1024)}KB)
          </div>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button onClick={testFileValidation} style={{ marginRight: '10px', padding: '10px' }}>
          Test File Validation
        </button>
        <button 
          onClick={testFileUpload} 
          disabled={loading}
          style={{ marginRight: '10px', padding: '10px' }}
        >
          {loading ? 'Uploading...' : 'Test File Upload'}
        </button>
        <button
          onClick={testOCR}
          disabled={loading}
          style={{ marginRight: '10px', padding: '10px' }}
        >
          {loading ? 'Processing...' : 'Test OCR'}
        </button>
        <button
          onClick={testLocalProcessing}
          disabled={loading}
          style={{ marginRight: '10px', padding: '10px' }}
        >
          {loading ? 'Processing...' : 'Test Local Processing'}
        </button>
        <button 
          onClick={testVisionPrep} 
          disabled={loading}
          style={{ marginRight: '10px', padding: '10px' }}
        >
          {loading ? 'Processing...' : 'Test Vision Prep'}
        </button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Result:</h3>
        <pre style={{ 
          background: '#f5f5f5', 
          padding: '10px', 
          border: '1px solid #ddd',
          whiteSpace: 'pre-wrap',
          maxHeight: '400px',
          overflow: 'auto'
        }}>
          {result || 'No result yet'}
        </pre>
      </div>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <h4>Instructions:</h4>
        <ol>
          <li>Select a PDF, image, document, or text file</li>
          <li>Click "Test File Validation" to check if the file is supported</li>
          <li>Enter your Mistral API key for the following tests:</li>
          <li>Click "Test OCR" to test document processing with Mistral's OCR (for PDFs/documents)</li>
          <li>Click "Test Local Processing" to test local file processing</li>
          <li>Click "Test Vision Prep" to test file preparation for vision models</li>
          <li>Click "Test File Upload" to upload the file to Mistral servers</li>
        </ol>
        <p>Check the browser console for detailed logs.</p>
      </div>
    </div>
  );
}
