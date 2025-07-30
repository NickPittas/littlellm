'use client';

import React, { useState, useEffect } from 'react';
import { X, Download, ExternalLink, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import { Button } from './ui/button';

interface ImageViewerProps {
  src: string;
  alt?: string;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Modal image viewer with zoom, rotate, and download functionality
 */
export function ImageViewer({ src, alt = 'Image', isOpen, onClose }: ImageViewerProps) {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case '+':
        case '=':
          e.preventDefault();
          setZoom(prev => Math.min(prev * 1.2, 5));
          break;
        case '-':
          e.preventDefault();
          setZoom(prev => Math.max(prev / 1.2, 0.1));
          break;
        case '0':
          e.preventDefault();
          setZoom(1);
          setPosition({ x: 0, y: 0 });
          setRotation(0);
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          setRotation(prev => (prev + 90) % 360);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Handle download
  const handleDownload = async () => {
    try {
      if (src.startsWith('data:')) {
        // Handle base64 data URLs
        const link = document.createElement('a');
        link.href = src;
        link.download = alt || 'image';
        link.click();
      } else {
        // Handle regular URLs
        const response = await fetch(src);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = alt || 'image';
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to download image:', error);
      // Fallback: open in new tab
      window.open(src, '_blank');
    }
  };

  // Handle external link
  const handleExternalLink = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.openExternal(src);
    } else {
      window.open(src, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
    >
      {/* Controls */}
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setZoom(prev => Math.min(prev * 1.2, 5));
          }}
          title="Zoom In (+)"
        >
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setZoom(prev => Math.max(prev / 1.2, 0.1));
          }}
          title="Zoom Out (-)"
        >
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            setRotation(prev => (prev + 90) % 360);
          }}
          title="Rotate (R)"
        >
          <RotateCw className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          title="Download"
        >
          <Download className="h-4 w-4" />
        </Button>
        {!src.startsWith('data:') && (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleExternalLink();
            }}
            title="Open in Browser"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="secondary"
          size="sm"
          onClick={onClose}
          title="Close (Esc)"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Zoom indicator */}
      {zoom !== 1 && (
        <div className="absolute top-4 left-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
          {Math.round(zoom * 100)}%
        </div>
      )}

      {/* Help text */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/50 text-white px-3 py-1 rounded text-sm">
        Use +/- to zoom, R to rotate, drag to pan, 0 to reset, Esc to close
      </div>

      {/* Image */}
      <div
        className="max-w-full max-h-full overflow-hidden cursor-move"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
        }}
      >
        <img
          src={src}
          alt={alt}
          className="max-w-none transition-transform duration-200"
          style={{
            transform: `scale(${zoom}) rotate(${rotation}deg) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
            transformOrigin: 'center center',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
          draggable={false}
        />
      </div>
    </div>
  );
}
