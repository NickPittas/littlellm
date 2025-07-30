'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from './ui/button';
import { parseTextWithContent } from '../lib/contentParser';

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
        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 p-0"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        {copied ? (
          <Check style={{ width: '16px', height: '16px' }} className="text-green-500" />
        ) : (
          <Copy style={{ width: '16px', height: '16px' }} />
        )}
      </Button>

      {/* Message Content */}
      {parseTextWithContent(
        content,
        "whitespace-pre-wrap select-text break-words text-sm",
        {
          WebkitAppRegion: 'no-drag',
          userSelect: 'text',
          WebkitUserSelect: 'text',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          maxWidth: '100%'
        } as React.CSSProperties & { WebkitAppRegion?: string }
      )}
    </div>
  );
}
