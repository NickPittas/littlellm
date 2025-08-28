'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle, Clock, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface UploadedFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'processing' | 'success' | 'error';
  progress?: number;
  error?: string;
  chunkCount?: number;
}

interface DocumentUploadProps {
  className?: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  onUploadComplete?: (files: UploadedFile[]) => void;
  onUploadProgress?: (file: UploadedFile) => void;
  onClose?: () => void;
  maxFiles?: number;
  maxFileSize?: number; // in MB
  acceptedFileTypes?: string[];
  showPreview?: boolean;
}

const DEFAULT_ACCEPTED_TYPES = [
  '.pdf', '.doc', '.docx', '.txt', '.md', '.xlsx', '.xls', 
  '.pptx', '.ppt', '.rtf', '.html', '.csv', '.json'
];

const DEFAULT_MAX_FILE_SIZE = 50; // 50MB

export function DocumentUpload({
  className,
  knowledgeBaseId,
  knowledgeBaseName,
  onUploadComplete,
  onUploadProgress,
  onClose,
  maxFiles,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  acceptedFileTypes = DEFAULT_ACCEPTED_TYPES,
  showPreview = true
}: DocumentUploadProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Get file type icon
  const getFileIcon = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return '📄';
      case 'doc':
      case 'docx': return '📝';
      case 'xls':
      case 'xlsx': return '📊';
      case 'ppt':
      case 'pptx': return '📊';
      case 'txt':
      case 'md': return '📃';
      case 'html':
      case 'htm': return '🌐';
      case 'csv': return '📋';
      case 'json': return '🔧';
      default: return '📄';
    }
  };

  // Validate file
  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file size
    if (file.size > maxFileSize * 1024 * 1024) {
      return { 
        valid: false, 
        error: `File size exceeds ${maxFileSize}MB limit` 
      };
    }

    // Check file type
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!acceptedFileTypes.includes(extension)) {
      return { 
        valid: false, 
        error: `File type ${extension} is not supported` 
      };
    }

    return { valid: true };
  };

  // Process uploaded files
  const processFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    // Check total file count only if maxFiles is defined
    if (maxFiles && uploadedFiles.length + files.length > maxFiles) {
      alert(`Cannot upload more than ${maxFiles} files at once`);
      return;
    }

    const newFiles: UploadedFile[] = [];
    
    // Validate and prepare files
    for (const file of files) {
      const validation = validateFile(file);
      if (!validation.valid) {
        alert(`${file.name}: ${validation.error}`);
        continue;
      }

      const uploadedFile: UploadedFile = {
        file,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: 'pending'
      };
      
      newFiles.push(uploadedFile);
    }

    if (newFiles.length === 0) return;

    // Add files to state
    setUploadedFiles(prev => [...prev, ...newFiles]);
    setIsUploading(true);

    // Process each file
    for (const uploadedFile of newFiles) {
      try {
        // Update status to uploading
        setUploadedFiles(prev => 
          prev.map(f => f.id === uploadedFile.id 
            ? { ...f, status: 'uploading' as const } 
            : f
          )
        );

        onUploadProgress?.(uploadedFile);

        // Here we integrate with the actual upload service
        // Check if we're in Electron environment and use the actual API
        if (typeof window !== 'undefined' && window.electronAPI) {
          try {
            // First, create a temporary file from the File object
            // Since Electron APIs expect file paths, we need to save the file temporarily
            const fileBuffer = await uploadedFile.file.arrayBuffer();
            const fileName = uploadedFile.file.name;
            
            // Update to processing
            setUploadedFiles(prev => 
              prev.map(f => f.id === uploadedFile.id 
                ? { ...f, status: 'processing' as const } 
                : f
              )
            );
            
            // Check if we have the addDocumentToKnowledgeBase method available
            if (window.electronAPI.addDocumentToKB) {
              // Use the new multi-KB API
              const result = await window.electronAPI.addDocumentToKB(
                knowledgeBaseId,
                fileBuffer,
                fileName,
                {
                  originalName: fileName,
                  uploadDate: new Date().toISOString(),
                  fileSize: uploadedFile.file.size,
                  fileType: uploadedFile.file.type
                }
              );
              
              if (result.success) {
                // Update to success with actual chunk count
                setUploadedFiles(prev => 
                  prev.map(f => f.id === uploadedFile.id 
                    ? { 
                        ...f, 
                        status: 'success' as const,
                        chunkCount: result.chunkCount || 1
                      } 
                    : f
                  )
                );
                
                console.log(`✅ Successfully processed ${fileName} into ${result.chunkCount || 1} chunks`);
                
                // Auto-remove completed file after 2 seconds with fade animation
                setTimeout(() => {
                  // Add fade-out class first
                  setUploadedFiles(prev => 
                    prev.map(f => f.id === uploadedFile.id 
                      ? { ...f, isRemoving: true } 
                      : f
                    )
                  );
                  
                  // Remove after fade animation
                  setTimeout(() => {
                    setUploadedFiles(prev => prev.filter(f => f.id !== uploadedFile.id));
                  }, 300); // 300ms fade duration
                }, 2000);
              } else {
                throw new Error(result.error || 'Upload failed');
              }
            } else if (window.electronAPI.addDocument) {
              // Fallback to legacy single KB API
              console.warn('Using legacy addDocument API - document will be added to default KB');
              
              // For legacy API, we need to save file to temp location first
              // This is a limitation of the current API design
              const tempPath = `temp_${Date.now()}_${fileName}`;
              
              // Convert File to a format the legacy API can handle
              // In practice, you might need to save to actual temp file
              const result = await window.electronAPI.addDocument(tempPath);
              
              if (result.success) {
                setUploadedFiles(prev => 
                  prev.map(f => f.id === uploadedFile.id 
                    ? { 
                        ...f, 
                        status: 'success' as const,
                        chunkCount: Math.floor(uploadedFile.file.size / 2000) || 1
                      } 
                    : f
                  )
                );
                console.log(`✅ Successfully processed ${fileName} using legacy API`);
                
                // Auto-remove completed file after 2 seconds with fade animation
                setTimeout(() => {
                  // Add fade-out class first
                  setUploadedFiles(prev => 
                    prev.map(f => f.id === uploadedFile.id 
                      ? { ...f, isRemoving: true } 
                      : f
                    )
                  );
                  
                  // Remove after fade animation
                  setTimeout(() => {
                    setUploadedFiles(prev => prev.filter(f => f.id !== uploadedFile.id));
                  }, 300); // 300ms fade duration
                }, 2000);
              } else {
                throw new Error(result.error || 'Legacy upload failed');
              }
            } else {
              // No upload API available
              throw new Error('No document upload API available in Electron');
            }
            
          } catch (apiError) {
            console.error('Electron API upload failed:', apiError);
            throw apiError;
          }
        } else {
          // This should only run in Electron environment
          throw new Error('Document upload is only available in Electron environment');
        }
        
      } catch (error) {
        console.error('Upload failed for file:', uploadedFile.file.name, error);
        
        setUploadedFiles(prev => 
          prev.map(f => f.id === uploadedFile.id 
            ? { 
                ...f, 
                status: 'error' as const, 
                error: error instanceof Error ? error.message : 'Upload failed' 
              } 
            : f
          )
        );
      }
    }

    setIsUploading(false);
    onUploadComplete?.(newFiles);
  }, [uploadedFiles.length, maxFiles, knowledgeBaseId, onUploadProgress, onUploadComplete]);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, [processFiles]);

  // Handle file input change
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      processFiles(files);
    }
  }, [processFiles]);

  // Remove file from list
  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Get status icon
  const getStatusIcon = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-gray-400" />;
      case 'uploading':
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
    }
  };

  // Get status color
  const getStatusColor = (status: UploadedFile['status']) => {
    switch (status) {
      case 'pending':
        return 'text-gray-400';
      case 'uploading':
      case 'processing':
        return 'text-blue-400';
      case 'success':
        return 'text-green-400';
      case 'error':
        return 'text-red-400';
    }
  };

  return (
    <div className={cn("flex flex-col h-full bg-gray-800 text-white", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Upload className="w-5 h-5 text-blue-400" />
          <h2 className="text-lg font-semibold">
            Upload Documents to &quot;{knowledgeBaseName}&quot;
          </h2>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Upload Area */}
      <div className="p-4 flex-1 overflow-y-auto flex flex-col">
        {/* Compact Drag & Drop Area */}
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-4 text-center transition-colors mb-4 flex-shrink-0",
            isDragOver
              ? "border-blue-500 bg-blue-500/10"
              : "border-gray-600 hover:border-gray-500"
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          <div className="flex items-center justify-center gap-4">
            <Upload className="w-8 h-8 text-gray-400" />
            <div className="text-left">
              <h3 className="text-md font-medium text-white">
                {isDragOver ? 'Drop files here' : 'Drag & drop files or click to browse'}
              </h3>
              <p className="text-xs text-gray-400">
                {maxFiles ? `Max ${maxFiles} files, ` : 'Unlimited files, '}{maxFileSize}MB each
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="text-blue-400 border-blue-400 hover:bg-blue-400/10"
            >
              <FileText className="w-4 h-4 mr-2" />
              Choose Files
            </Button>
          </div>
          
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedFileTypes.join(',')}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Overall Upload Progress Bar */}
        {isUploading && uploadedFiles.length > 0 && (
          <div className="mb-4 p-3 bg-gray-900 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-white">Upload Progress</span>
              <span className="text-xs text-gray-400">
                {uploadedFiles.filter(f => f.status === 'success').length} / {uploadedFiles.length} completed
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${uploadedFiles.length > 0 ? (uploadedFiles.filter(f => f.status === 'success').length / uploadedFiles.length) * 100 : 0}%`
                }}
              ></div>
            </div>
          </div>
        )}

        {/* File List - Expanded Area */}
        {showPreview && uploadedFiles.length > 0 && (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-md font-medium text-white">
                Uploaded Files ({uploadedFiles.length})
              </h3>
              <div className="text-xs text-gray-400">
                Supported: {acceptedFileTypes.slice(0, 3).join(', ')}{acceptedFileTypes.length > 3 ? '...' : ''}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {uploadedFiles.map((uploadedFile) => (
                <div
                  key={uploadedFile.id}
                  className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg hover:bg-gray-650 transition-colors"
                >
                  <span className="text-xl">{getFileIcon(uploadedFile.file.name)}</span>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-white truncate">
                        {uploadedFile.file.name}
                      </span>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {formatFileSize(uploadedFile.file.size)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {getStatusIcon(uploadedFile.status)}
                      <span className={cn("text-xs", getStatusColor(uploadedFile.status))}>
                        {uploadedFile.status === 'pending' && 'Pending'}
                        {uploadedFile.status === 'uploading' && 'Uploading...'}
                        {uploadedFile.status === 'processing' && 'Processing...'}
                        {uploadedFile.status === 'success' && 
                          `Complete${uploadedFile.chunkCount ? ` (${uploadedFile.chunkCount} chunks)` : ''}`
                        }
                        {uploadedFile.status === 'error' && (uploadedFile.error || 'Failed')}
                      </span>
                      
                      {/* Individual file progress for uploading files */}
                      {uploadedFile.status === 'uploading' && uploadedFile.progress !== undefined && (
                        <div className="ml-auto flex items-center gap-2">
                          <div className="w-16 bg-gray-600 rounded-full h-1">
                            <div
                              className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                              style={{ width: `${uploadedFile.progress}%` }}
                            ></div>
                          </div>
                          <span className="text-xs text-gray-400">{uploadedFile.progress}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(uploadedFile.id)}
                    className="h-6 w-6 p-0 text-gray-400 hover:text-red-400 flex-shrink-0"
                    disabled={uploadedFile.status === 'uploading' || uploadedFile.status === 'processing'}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Compact Information Section */}
        {uploadedFiles.length === 0 && (
          <div className="mt-4 p-3 bg-gray-900 rounded-lg">
            <h4 className="text-sm font-medium text-white mb-2">Processing Information</h4>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>• Documents will be automatically chunked for optimal search</li>
              <li>• Text will be extracted and embedded using AI models</li>
              <li>• Large documents may take several minutes to process</li>
              <li>• Supported formats: PDF, Word, Excel, PowerPoint, Text, Markdown, HTML, CSV, JSON</li>
            </ul>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-400">
            Knowledge Base: <span className="text-white">{knowledgeBaseName}</span>
          </div>
          
          <div className="flex gap-2">
            {onClose && (
              <Button 
                variant="ghost" 
                onClick={() => {
                  // Warn user if uploads are in progress
                  if (isUploading && uploadedFiles.some(f => f.status === 'uploading' || f.status === 'processing')) {
                    const confirm = window.confirm(
                      'Upload is still in progress. Closing will cancel the upload. Are you sure?'
                    );
                    if (confirm) {
                      onClose();
                    }
                  } else {
                    onClose();
                  }
                }}
                className={cn(
                  "transition-colors",
                  isUploading && uploadedFiles.some(f => f.status === 'uploading' || f.status === 'processing')
                    ? "text-yellow-400 hover:text-yellow-300"
                    : "text-gray-400 hover:text-white"
                )}
                title={isUploading && uploadedFiles.some(f => f.status === 'uploading' || f.status === 'processing') 
                  ? "Warning: Upload in progress" 
                  : "Close upload dialog"
                }
              >
                {isUploading && uploadedFiles.some(f => f.status === 'uploading' || f.status === 'processing') ? 'Cancel Upload' : 'Close'}
              </Button>
            )}
            
            <Button
              variant="default"
              disabled={isUploading || uploadedFiles.length === 0}
              onClick={() => {
                // Clear completed and failed files
                setUploadedFiles(prev => prev.filter(f => 
                  f.status !== 'success' && f.status !== 'error'
                ));
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUploading ? 'Processing...' : 
                uploadedFiles.some(f => f.status === 'error') ? 'Clear All' : 'Clear Completed'
              }
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Export the types for external use
export type { UploadedFile, DocumentUploadProps };
export default DocumentUpload;