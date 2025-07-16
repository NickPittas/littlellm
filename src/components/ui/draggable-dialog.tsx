'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';

interface DraggableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  width?: string;
  height?: string;
}

export function DraggableDialog({
  isOpen,
  onClose,
  title,
  children,
  className = '',
  width = 'w-[600px]',
  height = 'max-h-[80vh]'
}: DraggableDialogProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);

  // Center the dialog when it opens
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      const rect = dialogRef.current.getBoundingClientRect();
      const centerX = (window.innerWidth - rect.width) / 2;
      const centerY = (window.innerHeight - rect.height) / 2;
      setPosition({ x: centerX, y: Math.max(50, centerY) });
    }
  }, [isOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;

      // Keep dialog within viewport bounds
      const maxX = window.innerWidth - (dialogRef.current?.offsetWidth || 0);
      const maxY = window.innerHeight - (dialogRef.current?.offsetHeight || 0);

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    }
  }, [isDragging, dragStart.x, dragStart.y]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div
        ref={dialogRef}
        className={`fixed z-50 bg-background border border-border rounded-lg shadow-lg ${width} ${height} ${className}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
      >
        {/* Draggable Header */}
        <div
          className="drag-handle flex items-center justify-between p-4 border-b border-border cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <h2 className="text-lg font-semibold text-foreground select-none">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
          {children}
        </div>
      </div>
    </>
  );
}
