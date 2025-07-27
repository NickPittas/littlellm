'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ChevronDown, ChevronRight, Brain, Copy, Check, Wrench } from 'lucide-react';
import { Button } from './ui/button';
import { parseTextWithContent } from '../lib/contentParser';
import { SourceAttribution } from './SourceAttribution';
import type { Source } from '../services/chatService';
import { debugLogger } from '../services/debugLogger';

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
  sources?: Source[];
}

interface ParsedMessage {
  thinking: string[];
  toolExecution: string[];
  response: string;
}

export function MessageWithThinking({ content, className = '', usage, timing, toolCalls, sources }: MessageWithThinkingProps) {
  const [showThinking, setShowThinking] = useState(false);
  const [showToolExecution, setShowToolExecution] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [copied, setCopied] = useState(false);

  // Debug tool calls - now handled in useEffect to prevent spam

  // Parse the message content to extract thinking sections, tool execution, and response
  const parseMessage = (text: string): ParsedMessage => {
    const thinking: string[] = [];
    const toolExecution: string[] = [];
    let response = text;

    // Find all <think>...</think> blocks (structured thinking)
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

    // Enhanced parsing for thinking models - ONLY for explicit thinking patterns
    // Look for content that appears before tool calls AND has strong thinking indicators
    const beforeToolCallMatch = text.match(/^([\s\S]*?)(?=```json)/);
    if (beforeToolCallMatch) {
      const potentialThinking = beforeToolCallMatch[1].trim();

      // Very specific thinking indicators - must be explicit reasoning language
      const strongThinkingIndicators = [
        'okay let me think through this', 'let me think through', 'i need to think about',
        'let me analyze this', 'let me break this down', 'thinking through this',
        'let me consider the', 'i should think about', 'let me reason through',
        'okay let me think', 'let me think carefully', 'i need to consider'
      ];

      // Check for multiple strong indicators or very explicit thinking language
      const strongIndicatorCount = strongThinkingIndicators.filter(indicator =>
        potentialThinking.toLowerCase().includes(indicator)
      ).length;

      // Very strict criteria: must have strong thinking language AND be substantial content
      // AND appear before a tool call (not standalone responses)
      const hasToolCall = text.includes('```json');
      const isExplicitThinking = strongIndicatorCount > 0 && potentialThinking.length > 100;
      const startsWithThinking = /^(okay let me think|let me think|i need to think|thinking through)/i.test(potentialThinking);

      if (hasToolCall && (isExplicitThinking || startsWithThinking)) {
        thinking.push(potentialThinking);
      }
    }

    // Clean the response by removing unwanted content
    response = text;

    // Remove structured thinking and tool execution blocks
    response = response.replace(thinkRegex, '').replace(toolRegex, '');

    // Remove JSON tool call blocks (these should be in Tools Used section)
    response = response.replace(/```json[\s\S]*?```/gi, '');

    // Remove tool result markers
    response = response.replace(/\[TOOL_RESULT\][\s\S]*?\[END_TOOL_RESULT\]/gi, '');

    // Remove extracted thinking content from response
    for (const thinkingContent of thinking) {
      response = response.replace(thinkingContent, '');
    }

    // Clean up extra whitespace and empty lines
    response = response.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

    return { thinking, toolExecution, response };
  };

  // Helper function to extract complete JSON object from text starting at a given index
  const extractCompleteJSON = (text: string, startIndex: number): string | null => {
    let braceCount = 0;
    let inString = false;
    let escaped = false;
    let jsonStart = -1;

    for (let i = startIndex; i < text.length; i++) {
      const char = text[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === '\\' && inString) {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') {
          if (jsonStart === -1) jsonStart = i;
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          if (braceCount === 0 && jsonStart !== -1) {
            return text.substring(jsonStart, i + 1);
          }
        }
      }
    }

    return null;
  };

  // Extract tool calls from content if not provided via props
  const extractToolCallsFromContent = (text: string): Array<{id: string, name: string, arguments: Record<string, unknown>}> => {
    const toolCalls: Array<{id: string, name: string, arguments: Record<string, unknown>}> = [];

    // Pattern 1: JSON-wrapped tool calls (```json wrapper)
    const jsonMatches = text.match(/```json\s*([\s\S]*?)\s*```/gi);
    if (jsonMatches) {
      for (const match of jsonMatches) {
        try {
          const jsonContent = match.replace(/```json\s*|\s*```/gi, '').trim();
          const parsed = JSON.parse(jsonContent);

          if (parsed.tool_call && parsed.tool_call.name) {
            // Create deterministic ID based on content to prevent re-render loops
            const contentHash = btoa(JSON.stringify(parsed.tool_call)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
            toolCalls.push({
              id: `extracted_json_${contentHash}`,
              name: parsed.tool_call.name,
              arguments: parsed.tool_call.arguments || {}
            });
          }
        } catch (error) {
          console.warn('Failed to parse JSON-wrapped tool call:', error);
        }
      }
    }

    // Pattern 2: Direct tool_call format (without ```json wrapper)
    // Use a more robust approach to find complete JSON objects
    const toolCallPattern = /\{\s*"tool_call"\s*:\s*\{/gi;
    let match;
    while ((match = toolCallPattern.exec(text)) !== null) {
      try {
        // Find the complete JSON object starting from the match
        const startIndex = match.index;
        const jsonStr = extractCompleteJSON(text, startIndex);

        if (jsonStr) {
          const parsed = JSON.parse(jsonStr);
          if (parsed.tool_call && parsed.tool_call.name) {
            // Create deterministic ID based on content to prevent re-render loops
            const contentHash = btoa(JSON.stringify(parsed.tool_call)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
            toolCalls.push({
              id: `extracted_direct_${contentHash}`,
              name: parsed.tool_call.name,
              arguments: parsed.tool_call.arguments || {}
            });
          }
        }
      } catch (error) {
        console.warn('Failed to parse direct tool call:', error);
      }
    }

    // Pattern 3: Native OpenAI format (tool_calls array)
    const nativeToolCallRegex = /"tool_calls"\s*:\s*\[([\s\S]*?)\]/gi;
    const nativeMatch = nativeToolCallRegex.exec(text);
    if (nativeMatch) {
      try {
        const toolCallsArray = JSON.parse(`[${nativeMatch[1]}]`);
        for (const tc of toolCallsArray) {
          if (tc.function && tc.function.name) {
            let args = {};
            if (tc.function.arguments) {
              try {
                args = typeof tc.function.arguments === 'string'
                  ? JSON.parse(tc.function.arguments)
                  : tc.function.arguments;
              } catch (error) {
                console.warn('Failed to parse native tool call arguments:', error);
              }
            }

            // Create deterministic ID based on content to prevent re-render loops
            const contentHash = btoa(JSON.stringify({name: tc.function.name, args})).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
            toolCalls.push({
              id: tc.id || `extracted_native_${contentHash}`,
              name: tc.function.name,
              arguments: args
            });
          }
        }
      } catch (error) {
        console.warn('Failed to parse native tool calls:', error);
      }
    }

    return toolCalls;
  };

  const parsed = useMemo(() => parseMessage(content), [content]);
  const hasThinking = parsed.thinking.length > 0;
  const hasToolExecution = parsed.toolExecution.length > 0;

  // Extract tool calls from content if not provided via props - MEMOIZED to prevent infinite loops
  const extractedToolCalls = useMemo(() => {
    // Only extract if no tool calls provided via props
    if (toolCalls && toolCalls.length > 0) {
      return [];
    }
    return extractToolCallsFromContent(content);
  }, [content, toolCalls]);

  const allToolCalls = toolCalls && toolCalls.length > 0 ? toolCalls : extractedToolCalls;
  const hasTools = allToolCalls.length > 0;

  // Ensure we always show tool execution section if we have tool calls
  // This fixes inconsistencies across providers
  const shouldShowToolExecution = hasToolExecution || hasTools;

  // Log tool calls only once per unique set to prevent spam
  const toolCallsKey = useMemo(() => {
    if (allToolCalls.length === 0) return '';
    return allToolCalls.map(tc => `${tc.name}:${JSON.stringify(tc.arguments)}`).join('|');
  }, [allToolCalls]);

  const [loggedToolCallsKey, setLoggedToolCallsKey] = useState<string>('');

  useEffect(() => {
    if (toolCallsKey && toolCallsKey !== loggedToolCallsKey && allToolCalls.length > 0) {
      debugLogger.info('MESSAGE', 'MessageWithThinking received toolCalls:', allToolCalls);
      setLoggedToolCallsKey(toolCallsKey);
    }
  }, [toolCallsKey, loggedToolCallsKey, allToolCalls]);

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
                  className="bg-muted rounded-2xl p-3 text-sm"
                  style={{ border: 'none' }}
                >
                  <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                    <Brain className="h-3 w-3" />
                    <span>Thinking {parsed.thinking.length > 1 ? `${index + 1}` : ''}</span>
                  </div>
                  <div
                    className="whitespace-pre-wrap text-foreground select-text break-words text-sm"
                    style={{
                      WebkitAppRegion: 'no-drag',
                      userSelect: 'text',
                      WebkitUserSelect: 'text',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      maxWidth: '100%'
                    } as React.CSSProperties & { WebkitAppRegion?: string }}
                  >
                    {parseTextWithContent(thinkingText)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tool Execution Section - Show if there are tool execution blocks OR tool calls */}
      {shouldShowToolExecution && (
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
            <span>Tool Execution ({Math.max(parsed.toolExecution.length, hasTools ? 1 : 0)} section{(parsed.toolExecution.length !== 1 || hasTools) ? 's' : ''})</span>
          </Button>

          {showToolExecution && (
            <div className="mt-2 space-y-2">
              {parsed.toolExecution.map((toolText, index) => {
                // Parse the tool execution text to extract structured information
                const parseToolExecution = (text: string) => {
                  const lines = text.split('\n');
                  const tools: Array<{name: string, result: string, status: 'success' | 'failed', executionTime?: string}> = [];
                  let currentTool: {name: string, result: string, status: 'success' | 'failed', executionTime?: string} | null = null;
                  let inResult = false;
                  let resultLines: string[] = [];

                  for (const line of lines) {
                    // Check for tool execution summary
                    const summaryMatch = line.match(/🏁.*?(\d+)\s*successful,\s*(\d+)\s*failed/);
                    if (summaryMatch) {
                      return {
                        summary: line,
                        tools,
                        successCount: parseInt(summaryMatch[1]),
                        failureCount: parseInt(summaryMatch[2])
                      };
                    }

                    // Check for tool result headers
                    const toolMatch = line.match(/\*\*(.+?)\s+Result:\*\*/);
                    if (toolMatch) {
                      // Save previous tool if exists
                      if (currentTool) {
                        currentTool.result = resultLines.join('\n').trim();
                        tools.push(currentTool);
                      }
                      // Start new tool
                      currentTool = {
                        name: toolMatch[1],
                        result: '',
                        status: 'success'
                      };
                      resultLines = [];
                      inResult = true;
                      continue;
                    }

                    // Check for failed tools section
                    if (line.includes('**Failed Tools:**')) {
                      inResult = false;
                      continue;
                    }

                    // Collect result lines
                    if (inResult && currentTool && line.trim()) {
                      resultLines.push(line);
                    }
                  }

                  // Save last tool
                  if (currentTool) {
                    currentTool.result = resultLines.join('\n').trim();
                    tools.push(currentTool);
                  }

                  return { summary: '', tools, successCount: 0, failureCount: 0 };
                };

                const executionData = parseToolExecution(toolText);

                return (
                  <div
                    key={index}
                    className="bg-muted border border-border rounded-2xl p-3 text-sm"
                  >
                    <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                      <Wrench className="h-3 w-3" />
                      <span>Tool Execution {parsed.toolExecution.length > 1 ? `${index + 1}` : ''}</span>
                      {executionData.summary && (
                        <span className="ml-auto text-xs">
                          ✅ {executionData.successCount} success, ❌ {executionData.failureCount} failed
                        </span>
                      )}
                    </div>

                    {/* Show individual tool results if parsed */}
                    {executionData.tools.length > 0 ? (
                      <div className="space-y-3">
                        {executionData.tools.map((tool, toolIndex) => (
                          <div key={toolIndex} className={`border rounded-lg p-2 ${
                            tool.status === 'success'
                              ? 'border-border/50'
                              : 'border-red-500/30 bg-red-500/5'
                          }`}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-medium text-foreground">{tool.name}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                tool.status === 'success'
                                  ? 'bg-green-500/20 text-green-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}>
                                {tool.status === 'success' ? '✓ Success' : '✗ Failed'}
                              </span>
                              {tool.status === 'failed' && (
                                <span className="text-xs text-red-400 ml-auto">
                                  Error occurred during execution
                                </span>
                              )}
                            </div>
                            <div
                              className={`text-xs whitespace-pre-wrap select-text rounded p-2 break-words ${
                                tool.status === 'success'
                                  ? 'text-muted-foreground bg-background/50'
                                  : 'text-red-300 bg-red-500/10'
                              }`}
                              style={{
                                WebkitAppRegion: 'no-drag',
                                userSelect: 'text',
                                WebkitUserSelect: 'text',
                                border: 'none',
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word',
                                maxWidth: '100%'
                              } as React.CSSProperties & { WebkitAppRegion?: string }}
                            >
                              {parseTextWithContent(tool.result || '(no result)')}
                            </div>
                            {tool.status === 'failed' && (
                              <div className="mt-2 text-xs text-red-400/80">
                                💡 This error has been reported. You can try again or contact support if the issue persists.
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      // Fallback to showing raw text if parsing failed
                      <div
                        className="whitespace-pre-wrap text-foreground select-text break-words text-sm"
                        style={{
                          WebkitAppRegion: 'no-drag',
                          userSelect: 'text',
                          WebkitUserSelect: 'text',
                          textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                          wordWrap: 'break-word',
                          overflowWrap: 'break-word',
                          maxWidth: '100%'
                        } as React.CSSProperties & { WebkitAppRegion?: string }}
                      >
                        {parseTextWithContent(toolText)}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Fallback: Show tool execution info when we have tool calls but no parsed tool execution blocks */}
              {parsed.toolExecution.length === 0 && hasTools && (
                <div className="bg-muted border border-border rounded-2xl p-3 text-sm">
                  <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
                    <Wrench className="h-3 w-3" />
                    <span>Tool Execution</span>
                    <span className="ml-auto text-xs">
                      ✅ {allToolCalls.length} tool{allToolCalls.length !== 1 ? 's' : ''} executed
                    </span>
                  </div>

                  <div className="space-y-3">
                    {allToolCalls.map((tool, toolIndex) => (
                      <div key={toolIndex} className="border border-border/50 rounded-lg p-2">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-foreground">{tool.name}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
                            ✓ Success
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          **Tool executed successfully.** Results are shown in the Tool Usage section below if available.
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tool Usage Section - Only show if there are tool calls */}
      {hasTools && (
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
            <span>Tools Used ({allToolCalls.length} tool{allToolCalls.length !== 1 ? 's' : ''})</span>
          </Button>

          {showTools && (
            <div className="mt-2 space-y-2">
              {allToolCalls.map((toolCall, index) => (
                <div
                  key={toolCall.id || index}
                  className="bg-card rounded-2xl p-3 text-sm"
                  style={{
                    backgroundColor: 'rgba(79, 193, 255, 0.1)',
                    border: 'none'
                  }}
                >
                  <div className="flex items-center gap-2 mb-2 text-xs" style={{ color: 'var(--info)' }}>
                    <Wrench className="h-3 w-3" />
                    <span className="font-medium">{toolCall.name}</span>
                    <span className="text-muted-foreground">#{toolCall.id}</span>
                  </div>

                  {/* Tool Arguments */}
                  <div className="mb-2">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Arguments:</div>
                    <div
                      className="bg-muted rounded p-2 text-xs font-mono whitespace-pre-wrap text-foreground select-text break-words"
                      style={{
                        WebkitAppRegion: 'no-drag',
                        userSelect: 'text',
                        WebkitUserSelect: 'text',
                        textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                        border: 'none',
                        wordWrap: 'break-word',
                        overflowWrap: 'break-word',
                        maxWidth: '100%'
                      } as React.CSSProperties & { WebkitAppRegion?: string }}
                    >
                      {Object.keys(toolCall.arguments).length > 0
                        ? JSON.stringify(toolCall.arguments, null, 2)
                        : '(no arguments)'}
                    </div>
                  </div>

                  {/* Tool Execution Status */}
                  <div className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Status:</span>
                      <span className="text-green-400">✓ Executed</span>
                    </div>
                    <div className="mt-1 text-xs">
                      Results are shown in the Tool Execution section above if available.
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
          className="whitespace-pre-wrap select-text break-words text-sm"
          style={{
            WebkitAppRegion: 'no-drag',
            userSelect: 'text',
            WebkitUserSelect: 'text',
            wordWrap: 'break-word',
            overflowWrap: 'break-word',
            maxWidth: '100%'
          } as React.CSSProperties & { WebkitAppRegion?: string }}
        >
          {parseTextWithContent(parsed.response)}
        </div>
      )}

      {/* Token Usage and Performance Info */}
      {(usage || timing) && (
        <div className="mt-3 pt-2">
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

      {/* Source Attribution */}
      {sources && sources.length > 0 && (
        <SourceAttribution sources={sources} />
      )}
    </div>
  );
}
