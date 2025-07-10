'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from './ui/button';

interface UserMessageProps {
  content: string;
  className?: string;
}

export function UserMessage({ content, className = '' }: UserMessageProps) {
  const [copied, setCopied] = useState(false);

  // Copy function for the message content
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = content;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackError) {
        console.error('Fallback copy also failed:', fallbackError);
      }
    }
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Copy Button - positioned in top right */}
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6 p-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </Button>

      {/* Message Content */}
      <div 
        className="whitespace-pre-wrap select-text"
        style={{ 
          WebkitAppRegion: 'no-drag',
          userSelect: 'text',
          WebkitUserSelect: 'text'
        } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        {content}
      </div>
    </div>
  );
}
