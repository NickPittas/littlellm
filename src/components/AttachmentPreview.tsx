'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { X, File, Image, FileText } from 'lucide-react';

interface AttachmentPreviewProps {
  files: File[];
  onRemoveFile: (index: number) => void;
}

export function AttachmentPreview({ files, onRemoveFile }: AttachmentPreviewProps) {
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
  }, [files]);

  if (files.length === 0) return null;

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="h-4 w-4" />;
    } else if (file.type.includes('text') || file.type.includes('pdf')) {
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
              <p className="text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </p>
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
