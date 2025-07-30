'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from './ui/button';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import './CodeBlock.css';


interface CodeBlockProps {
  code: string;
  language?: string;
  className?: string;
}

// Map common language aliases to their proper syntax highlighter names
const languageMap: Record<string, string> = {
  'js': 'javascript',
  'jsx': 'javascript',
  'ts': 'typescript',
  'tsx': 'typescript',
  'py': 'python',
  'rb': 'ruby',
  'sh': 'bash',
  'shell': 'bash',
  'yml': 'yaml',
  'md': 'markdown',
  'htm': 'html',
  'xml': 'markup',
  'svg': 'markup',
  'vue': 'markup',
  'php': 'php',
  'c': 'c',
  'cpp': 'cpp',
  'c++': 'cpp',
  'cs': 'csharp',
  'java': 'java',
  'kt': 'kotlin',
  'swift': 'swift',
  'go': 'go',
  'rs': 'rust',
  'sql': 'sql',
  'json': 'json',
  'jsonc': 'json',
  'toml': 'toml',
  'ini': 'ini',
  'cfg': 'ini',
  'conf': 'ini',
  'dockerfile': 'docker',
  'makefile': 'makefile',
  'r': 'r',
  'scala': 'scala',
  'clj': 'clojure',
  'cljs': 'clojure',
  'elm': 'elm',
  'haskell': 'haskell',
  'hs': 'haskell',
  'lua': 'lua',
  'perl': 'perl',
  'pl': 'perl',
  'powershell': 'powershell',
  'ps1': 'powershell',
  'diff': 'diff',
  'patch': 'diff',
};

function normalizeLanguage(lang?: string): string {
  if (!lang) return 'text';
  const normalized = lang.toLowerCase().trim();
  return languageMap[normalized] || normalized;
}

export function CodeBlock({ code, language, className = '' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const normalizedLanguage = normalizeLanguage(language);

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
        className="bg-muted/30 rounded-b-lg overflow-x-auto"
        style={{
          WebkitAppRegion: 'no-drag',
          userSelect: 'text',
          WebkitUserSelect: 'text',
        } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        <div
          className="syntax-highlighter-isolated"
          style={{
            WebkitAppRegion: 'no-drag',
            userSelect: 'text',
            WebkitUserSelect: 'text',
          } as React.CSSProperties & { WebkitAppRegion?: string }}
        >
          <SyntaxHighlighter
            language={normalizedLanguage}
            style={{}} // Empty style object - we use CSS instead
            customStyle={{
              margin: 0,
              padding: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
            }}
            codeTagProps={{
              style: {
                margin: 0,
                padding: 0,
                background: 'transparent',
              }
            }}
            PreTag={({ children, ...props }) => (
              <pre {...props} style={{
                margin: 0,
                padding: 0,
                background: 'transparent',
              }}>
                {children}
              </pre>
            )}
          >
            {code}
          </SyntaxHighlighter>
        </div>
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
