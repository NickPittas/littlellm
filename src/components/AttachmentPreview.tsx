'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { X, File, Image, FileText, FileSpreadsheet, Presentation, Calendar, Code, Zap, FileSearch } from 'lucide-react';
import { PROVIDER_CAPABILITIES } from '../services/providers/constants';

interface AttachmentPreviewProps {
  files: File[];
  onRemoveFile: (index: number) => void;
  currentProvider?: string; // Current LLM provider to show processing indicators
}

export function AttachmentPreview({ files, onRemoveFile, currentProvider = 'openai' }: AttachmentPreviewProps) {
  const [previews, setPreviews] = useState<{ [key: number]: string }>({});

  useEffect(() => {
    // Generate previews for image files
    files.forEach((file, index) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviews(prev => ({
            ...prev,
            [index]: e.target?.result as string
          }));
        };
        reader.readAsDataURL(file);
      }
    });

    // Cleanup old previews
    return () => {
      Object.values(previews).forEach(url => {
        if (url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [files, previews]);

  if (files.length === 0) return null;

  const getFileExtension = (filename: string): string => {
    return filename.substring(filename.lastIndexOf('.')).toLowerCase().slice(1);
  };

  const getProcessingType = (file: File): 'native' | 'parsed' | 'unsupported' => {
    const extension = getFileExtension(file.name);
    const capabilities = PROVIDER_CAPABILITIES[currentProvider as keyof typeof PROVIDER_CAPABILITIES];

    if (!capabilities) return 'parsed';

    const nativeSupport = capabilities.nativeDocumentSupport as string[];
    const parsingRequired = capabilities.documentParsingRequired as string[];

    if (nativeSupport?.includes(extension)) {
      return 'native';
    } else if (parsingRequired?.includes(extension)) {
      return 'parsed';
    } else if (file.type.startsWith('image/')) {
      return capabilities.supportsVision ? 'native' : 'unsupported';
    }

    return 'unsupported';
  };

  const getProcessingIndicator = (file: File) => {
    const processingType = getProcessingType(file);

    switch (processingType) {
      case 'native':
        return (
          <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <Zap className="h-3 w-3" />
            <span>Native</span>
          </div>
        );
      case 'parsed':
        return (
          <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
            <FileSearch className="h-3 w-3" />
            <span>Parsed</span>
          </div>
        );
      case 'unsupported':
        return (
          <div className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
            <X className="h-3 w-3" />
            <span>Unsupported</span>
          </div>
        );
    }
  };

  const getFileIcon = (file: File) => {
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();

    if (file.type.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    } else if (['.xlsx', '.xls', '.ods', '.csv'].includes(extension)) {
      return <FileSpreadsheet className="h-4 w-4" />;
    } else if (['.pptx', '.ppt'].includes(extension)) {
      return <Presentation className="h-4 w-4" />;
    } else if (extension === '.ics') {
      return <Calendar className="h-4 w-4" />;
    } else if (['.html', '.htm', '.xml', '.json'].includes(extension)) {
      return <Code className="h-4 w-4" />;
    } else if (file.type.includes('text') || file.type.includes('pdf') || ['.txt', '.md', '.rtf', '.docx', '.doc'].includes(extension)) {
      return <FileText className="h-4 w-4" />;
    } else {
      return <File className="h-4 w-4" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="border-t border-border p-2 bg-muted/30">
      <div className="flex flex-wrap gap-2">
        {files.map((file, index) => (
          <div
            key={index}
            className="relative flex items-center gap-2 bg-background border border-border rounded-lg p-2 max-w-xs"
          >
            {/* File preview/icon */}
            <div className="flex-shrink-0">
              {file.type.startsWith('image/') && previews[index] ? (
                <img
                  src={previews[index]}
                  alt={file.name}
                  className="w-10 h-10 object-cover rounded border"
                />
              ) : (
                <div className="w-10 h-10 bg-muted rounded border flex items-center justify-center">
                  {getFileIcon(file)}
                </div>
              )}
            </div>

            {/* File info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" title={file.name}>
                {file.name}
              </p>
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
                {getProcessingIndicator(file)}
              </div>
            </div>

            {/* Remove button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => onRemoveFile(index)}
              title="Remove file"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
