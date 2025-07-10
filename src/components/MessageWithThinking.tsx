'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain, Copy, Check } from 'lucide-react';
import { Button } from './ui/button';

interface MessageWithThinkingProps {
  content: string;
  className?: string;
}

interface ParsedMessage {
  thinking: string[];
  response: string;
}

export function MessageWithThinking({ content, className = '' }: MessageWithThinkingProps) {
  const [showThinking, setShowThinking] = useState(false);
  const [copied, setCopied] = useState(false);

  // Parse the message content to extract thinking sections and response
  const parseMessage = (text: string): ParsedMessage => {
    const thinking: string[] = [];
    let response = text;

    // Find all <think>...</think> blocks
    const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
    let match;

    while ((match = thinkRegex.exec(text)) !== null) {
      thinking.push(match[1].trim());
    }

    // Remove all thinking blocks from the response
    response = text.replace(thinkRegex, '').trim();

    return { thinking, response };
  };

  const parsed = parseMessage(content);
  const hasThinking = parsed.thinking.length > 0;

  // Copy function for the entire message content
  const handleCopy = async () => {
    try {
      // Copy the full original content (including thinking sections)
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
      {/* Thinking Section - Only show if there are thinking blocks */}
      {hasThinking && (
        <div className="mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowThinking(!showThinking)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground p-1 h-auto"
          >
            {showThinking ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <Brain className="h-3 w-3" />
            <span>Model Thinking ({parsed.thinking.length} section{parsed.thinking.length !== 1 ? 's' : ''})</span>
          </Button>
          
          {showThinking && (
            <div className="mt-2 space-y-2">
              {parsed.thinking.map((thinkingText, index) => (
                <div
                  key={index}
                  className="bg-muted/50 border border-border/50 rounded-md p-3 text-sm"
                >
                  <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                    <Brain className="h-3 w-3" />
                    <span>Thinking {parsed.thinking.length > 1 ? `${index + 1}` : ''}</span>
                  </div>
                  <div
                    className="whitespace-pre-wrap text-muted-foreground select-text"
                    style={{
                      WebkitAppRegion: 'no-drag',
                      userSelect: 'text',
                      WebkitUserSelect: 'text'
                    } as React.CSSProperties & { WebkitAppRegion?: string }}
                  >
                    {thinkingText}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

      {/* Main Response */}
      {parsed.response && (
        <div
          className="whitespace-pre-wrap select-text"
          style={{
            WebkitAppRegion: 'no-drag',
            userSelect: 'text',
            WebkitUserSelect: 'text'
          } as React.CSSProperties & { WebkitAppRegion?: string }}
        >
          {parsed.response}
        </div>
      )}
    </div>
  );
}
