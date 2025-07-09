'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Minus, Square, Camera, Paperclip, History, Settings, ChevronDown } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { CommandPalette } from './CommandPalette';
import { ChatInterface } from './ChatInterface';
import { BottomToolbar } from './BottomToolbar';
import { promptsService } from '../services/promptsService';

interface VoilaInterfaceProps {
  onClose?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
}

export function VoilaInterface({ onClose, onMinimize, onMaximize }: VoilaInterfaceProps) {
  const [mode, setMode] = useState<'command' | 'chat'>('command');
  const [input, setInput] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 600, height: 400 });
  const [isResizing, setIsResizing] = useState(false);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === dragRef.current || dragRef.current?.contains(e.target as Node)) {
      setIsDragging(true);
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'k':
            e.preventDefault();
            setMode('command');
            setInput('');
            setShowActionMenu(false);
            break;
          case ',':
            e.preventDefault();
            // Open settings (could be implemented later)
            break;
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Handle input changes
  const handleInputChange = (value: string) => {
    setInput(value);
    if (value.trim() && mode === 'command') {
      setMode('chat');
    } else if (!value.trim() && mode === 'chat') {
      setMode('command');
    }
  };

  // Handle spacebar in chat mode and global shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' && mode === 'chat' && input.trim()) {
      e.preventDefault();
      setShowActionMenu(true);
    }
    if (e.key === 'Escape') {
      setShowActionMenu(false);
      if (mode === 'chat' && !input.trim()) {
        setMode('command');
      }
    }
    // Global shortcuts
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'k':
          e.preventDefault();
          setMode('command');
          setInput('');
          setShowActionMenu(false);
          break;
        case 'n':
          e.preventDefault();
          setMode('command');
          setInput('');
          setShowActionMenu(false);
          // Clear chat history if in chat mode
          break;
        case 'w':
          e.preventDefault();
          onClose?.();
          break;
      }
    }
  };

  // Handle prompt selection
  const handlePromptSelect = (prompt: string) => {
    setInput(prompt);
    setMode('chat');
    setShowActionMenu(false);
  };

  return (
    <div
      ref={containerRef}
      className="fixed bg-background border border-border rounded-lg shadow-2xl overflow-hidden z-50"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        minWidth: 400,
        minHeight: 300,
        maxWidth: 1200,
        maxHeight: 800,
      }}
    >
      {/* Custom Title Bar / Drag Area */}
      <div
        ref={dragRef}
        className="flex items-center justify-between p-2 bg-muted/50 cursor-move select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 hover:bg-red-600 cursor-pointer" onClick={onClose} />
          <div className="w-3 h-3 rounded-full bg-yellow-500 hover:bg-yellow-600 cursor-pointer" onClick={onMinimize} />
          <div className="w-3 h-3 rounded-full bg-green-500 hover:bg-green-600 cursor-pointer" onClick={onMaximize} />
        </div>
        <div className="text-sm text-muted-foreground font-medium">
          {mode === 'command' ? 'How can I help you?' : 'Chat'}
        </div>
        <div className="w-12" /> {/* Spacer for balance */}
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col h-full">
        {/* Input Area */}
        <div className="p-4 border-b border-border">
          <Input
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'command' ? 'How can I help you?' : 'Type your message...'}
            className="w-full text-lg border-none shadow-none focus-visible:ring-0 bg-transparent"
            autoFocus
          />
        </div>

        {/* Content Area */}
        <div className="flex-1 relative">
          {mode === 'command' ? (
            <CommandPalette onPromptSelect={handlePromptSelect} />
          ) : (
            <ChatInterface
              input={input}
              onInputChange={setInput}
              showActionMenu={showActionMenu}
              onActionMenuClose={() => setShowActionMenu(false)}
              onPromptSelect={handlePromptSelect}
              messages={messages}
              onMessagesChange={setMessages}
            />
          )}
        </div>

        {/* Bottom Toolbar */}
        <BottomToolbar
          onFileUpload={(files) => {
            // Pass files to chat interface if in chat mode
            if (mode === 'chat') {
              // This would need to be passed down to ChatInterface
              console.log('Files uploaded:', Array.from(files).map(f => f.name));
            }
          }}
        />
      </div>

      {/* Resize Handle */}
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-muted/50 hover:bg-muted"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
          const startX = e.clientX;
          const startY = e.clientY;
          const startWidth = size.width;
          const startHeight = size.height;

          const handleResize = (e: MouseEvent) => {
            const newWidth = Math.max(400, startWidth + (e.clientX - startX));
            const newHeight = Math.max(300, startHeight + (e.clientY - startY));
            setSize({ width: newWidth, height: newHeight });
          };

          const handleResizeEnd = () => {
            setIsResizing(false);
            document.removeEventListener('mousemove', handleResize);
            document.removeEventListener('mouseup', handleResizeEnd);
          };

          document.addEventListener('mousemove', handleResize);
          document.addEventListener('mouseup', handleResizeEnd);
        }}
      >
        <div className="absolute bottom-0 right-0 w-2 h-2 bg-border" />
      </div>
    </div>
  );
}
