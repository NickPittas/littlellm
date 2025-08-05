'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from './ui/button';
import { MessageContent } from './MessageContent';
import { ContentItem } from '../services/chatService';

interface UserMessageProps {
  content: string | ContentItem[];
  className?: string;
}

export function UserMessage({ content, className = '' }: UserMessageProps) {
  const [copied, setCopied] = useState(false);

  // Copy function for the message content
  const handleCopy = async () => {
    try {
      // Convert content to string for copying
      const textContent = typeof content === 'string'
        ? content
        : Array.isArray(content)
          ? content.map(item => item.type === 'text' ? item.text : `[${item.type}]`).join(' ')
          : String(content);

      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
      // Fallback for older browsers
      try {
        const textContent = typeof content === 'string'
          ? content
          : Array.isArray(content)
            ? content.map(item => item.type === 'text' ? item.text : `[${item.type}]`).join(' ')
            : String(content);

        const textArea = document.createElement('textarea');
        textArea.value = textContent;
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
      <MessageContent
        content={content}
        className="select-text break-words text-sm leading-relaxed"
        style={{
          WebkitAppRegion: 'no-drag',
          userSelect: 'text',
          WebkitUserSelect: 'text',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          maxWidth: '100%'
        } as React.CSSProperties & { WebkitAppRegion?: string }}
      />
    </div>
  );
}
