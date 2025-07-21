'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from './ui/button';

interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

export function CodeBlock({ code, language, className = '' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
      // Fallback for older browsers
      try {
        const textArea = document.createElement('textarea');
        textArea.value = code;
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
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between bg-muted/50 px-3 py-2 border-b border-border rounded-t-lg">
        <span className="text-xs text-muted-foreground font-medium">
          {language || 'code'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
          title="Copy code"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Code content */}
      <div
        className="bg-muted/30 p-3 rounded-b-lg overflow-x-auto"
        style={{
          WebkitAppRegion: 'no-drag',
          userSelect: 'text',
          WebkitUserSelect: 'text',
        } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        <pre className="text-sm font-mono whitespace-pre-wrap break-words m-0">
          <code className={`language-${language || 'text'}`}>
            {code}
          </code>
        </pre>
      </div>
    </div>
  );
}

interface InlineCodeProps {
  code: string;
  className?: string;
}

export function InlineCode({ code, className = '' }: InlineCodeProps) {
  return (
    <code 
      className={`bg-muted/50 px-1.5 py-0.5 rounded text-sm font-mono ${className}`}
      style={{
        WebkitAppRegion: 'no-drag',
        userSelect: 'text',
        WebkitUserSelect: 'text',
      } as React.CSSProperties & { WebkitAppRegion?: string }}
    >
      {code}
    </code>
  );
}
