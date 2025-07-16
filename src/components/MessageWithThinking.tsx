'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Brain, Copy, Check, Wrench } from 'lucide-react';
import { Button } from './ui/button';

interface MessageWithThinkingProps {
  content: string;
  className?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  timing?: {
    startTime: number;
    endTime: number;
    duration: number;
    tokensPerSecond?: number;
  };
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: Record<string, unknown>;
  }>;
}

interface ParsedMessage {
  thinking: string[];
  toolExecution: string[];
  response: string;
}

export function MessageWithThinking({ content, className = '', usage, timing, toolCalls }: MessageWithThinkingProps) {
  const [showThinking, setShowThinking] = useState(false);
  const [showToolExecution, setShowToolExecution] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [copied, setCopied] = useState(false);

  // Debug tool calls
  if (toolCalls && toolCalls.length > 0) {
    console.log('🔧 MessageWithThinking received toolCalls:', toolCalls);
  }

  // Parse the message content to extract thinking sections, tool execution, and response
  const parseMessage = (text: string): ParsedMessage => {
    const thinking: string[] = [];
    const toolExecution: string[] = [];
    let response = text;

    // Find all <think>...</think> blocks
    const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;
    let thinkMatch;

    while ((thinkMatch = thinkRegex.exec(text)) !== null) {
      thinking.push(thinkMatch[1].trim());
    }

    // Find all <tool_execution>...</tool_execution> blocks
    const toolRegex = /<tool_execution>([\s\S]*?)<\/tool_execution>/gi;
    let toolMatch;

    while ((toolMatch = toolRegex.exec(text)) !== null) {
      toolExecution.push(toolMatch[1].trim());
    }

    // Remove all thinking and tool execution blocks from the response
    response = text.replace(thinkRegex, '').replace(toolRegex, '').trim();

    return { thinking, toolExecution, response };
  };

  const parsed = parseMessage(content);
  const hasThinking = parsed.thinking.length > 0;
  const hasToolExecution = parsed.toolExecution.length > 0;

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

      {/* Tool Execution Section - Only show if there are tool execution blocks */}
      {hasToolExecution && (
        <div className="mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowToolExecution(!showToolExecution)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground p-1 h-auto"
          >
            {showToolExecution ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <Wrench className="h-3 w-3" />
            <span>Tool Execution ({parsed.toolExecution.length} section{parsed.toolExecution.length !== 1 ? 's' : ''})</span>
          </Button>

          {showToolExecution && (
            <div className="mt-2 space-y-2">
              {parsed.toolExecution.map((toolText, index) => (
                <div
                  key={index}
                  className="bg-muted/50 border border-border/50 rounded-md p-3 text-sm"
                >
                  <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                    <Wrench className="h-3 w-3" />
                    <span>Tool Execution {parsed.toolExecution.length > 1 ? `${index + 1}` : ''}</span>
                  </div>
                  <div
                    className="whitespace-pre-wrap text-muted-foreground select-text"
                    style={{
                      WebkitAppRegion: 'no-drag',
                      userSelect: 'text',
                      WebkitUserSelect: 'text'
                    } as React.CSSProperties & { WebkitAppRegion?: string }}
                  >
                    {toolText}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tool Usage Section - Only show if there are tool calls */}
      {toolCalls && toolCalls.length > 0 && (
        <div className="mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTools(!showTools)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground p-1 h-auto"
          >
            {showTools ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <Wrench className="h-3 w-3" />
            <span>Tools Used ({toolCalls.length} tool{toolCalls.length !== 1 ? 's' : ''})</span>
          </Button>

          {showTools && (
            <div className="mt-2 space-y-2">
              {toolCalls.map((toolCall, index) => (
                <div
                  key={toolCall.id || index}
                  className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50 rounded-md p-3 text-sm"
                >
                  <div className="flex items-center gap-2 mb-2 text-xs text-blue-600 dark:text-blue-400">
                    <Wrench className="h-3 w-3" />
                    <span className="font-medium">{toolCall.name}</span>
                    <span className="text-muted-foreground">#{toolCall.id}</span>
                  </div>

                  {/* Tool Arguments */}
                  <div className="mb-2">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Arguments:</div>
                    <div
                      className="bg-muted/50 rounded p-2 text-xs font-mono whitespace-pre-wrap text-muted-foreground select-text"
                      style={{
                        WebkitAppRegion: 'no-drag',
                        userSelect: 'text',
                        WebkitUserSelect: 'text'
                      } as React.CSSProperties & { WebkitAppRegion?: string }}
                    >
                      {JSON.stringify(toolCall.arguments, null, 2)}
                    </div>
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

      {/* Token Usage and Performance Info */}
      {(usage || timing) && (
        <div className="mt-3 pt-2 border-t border-border/30">
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {timing?.tokensPerSecond && (
              <div className="flex items-center gap-1">
                <span className="font-medium">⚡</span>
                <span>{timing.tokensPerSecond.toFixed(1)} tokens/sec</span>
              </div>
            )}
            {usage && (
              <div className="flex items-center gap-1">
                <span className="font-medium">📊</span>
                <span>{usage.totalTokens} tokens ({usage.promptTokens} in, {usage.completionTokens} out)</span>
              </div>
            )}
            {timing && (
              <div className="flex items-center gap-1">
                <span className="font-medium">⏱️</span>
                <span>{(timing.duration / 1000).toFixed(2)}s</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
