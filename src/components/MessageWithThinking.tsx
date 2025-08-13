'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { ChevronDown, ChevronRight, Brain, Copy, Check, Wrench, Volume2, VolumeX } from 'lucide-react';
import { Button } from './ui/button';
import { parseTextWithContent } from '../lib/contentParser';
import { SourceAttribution } from './SourceAttribution';
import type { Source } from '../services/chatService';
import { debugLogger } from '../services/debugLogger';
import { getTTSService } from '../services/textToSpeechService';
import { settingsService } from '../services/settingsService';

interface MessageWithThinkingProps {
  content: string;
  className?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost?: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
    currency: string;
    provider: string;
    model: string;
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
    result?: string;
    error?: boolean;
  }>;
  sources?: Source[];
  isStreaming?: boolean;
}

interface ParsedMessage {
  thinking: string[];
  toolExecution: string[];
  response: string;
  modeSwitch?: {
    mode: string;
    reason: string;
  };
}

export function MessageWithThinking({ content, className = '', usage, cost, timing, toolCalls, sources, isStreaming = false }: MessageWithThinkingProps) {
  const [showThinking, setShowThinking] = useState(false);
  const [showToolExecution, setShowToolExecution] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const autoPlayTriggeredRef = useRef(false);

  // Debug tool calls - now handled in useEffect to prevent spam
  useEffect(() => {
    if (toolCalls && toolCalls.length > 0) {
      console.log(`🔧 MessageWithThinking received ${toolCalls.length} tool calls:`, toolCalls);
      toolCalls.forEach((tc, index) => {
        console.log(`🔧 Tool ${index}: ${tc.name}, has result: ${!!tc.result}, result length: ${tc.result?.length || 0}, error: ${tc.error}`);
        if (tc.result) {
          console.log(`🔧 Tool ${index} result preview:`, tc.result.substring(0, 100) + '...');
        }
      });
    }
  }, [toolCalls]);

  // Helper function to remove model-specific template tags
  const removeTemplateTags = (text: string): string => {
    let cleanedText = text;

    // Remove new model format tags: <|start|>, <|message|>, <|channel|>, <|end|>, <|constrain|>
    cleanedText = cleanedText.replace(/<\|start\|>/gi, '');
    cleanedText = cleanedText.replace(/<\|message\|>/gi, '');
    cleanedText = cleanedText.replace(/<\|channel\|>/gi, '');
    cleanedText = cleanedText.replace(/<\|end\|>/gi, '');
    cleanedText = cleanedText.replace(/<\|constrain\|>/gi, '');

    // Remove Qwen3 format tags: <|im_start|>, <|im_end|>
    cleanedText = cleanedText.replace(/<\|im_start\|>/gi, '');
    cleanedText = cleanedText.replace(/<\|im_end\|>/gi, '');

    // Remove concatenated role and channel indicators (e.g., "assistantfinal", "systemcommentary")
    cleanedText = cleanedText.replace(/(system|user|assistant)(final|analysis|commentary)/gi, '');

    // Remove standalone role indicators
    cleanedText = cleanedText.replace(/\b(system|user|assistant)\b/gi, '');

    // Remove standalone channel indicators
    cleanedText = cleanedText.replace(/\b(final|analysis|commentary)\b/gi, '');

    // Remove tool call commands (e.g., "to=web_search json{...}", "to=list_directoryjson{...}") - handles nested JSON, hyphens, function prefixes, optional space, and multiple calls
    cleanedText = cleanedText.replace(/(?:commentary\s+)?to=(?:functions\.)?[a-zA-Z_][a-zA-Z0-9_-]*\s*json\{(?:[^{}]|{[^{}]*})*\}/gi, '');

    // Clean up any remaining template-like patterns
    cleanedText = cleanedText.replace(/<\|[^|]*\|>/gi, '');

    return cleanedText;
  };

  // Parse the message content to extract thinking sections, tool execution, mode switches, and response
  const parseMessage = (text: string): ParsedMessage => {
    const thinking: string[] = [];
    const toolExecution: string[] = [];
    let response = text;
    let modeSwitch: { mode: string; reason: string } | undefined;

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

    // No mode switch parsing - just show original content

    // Enhanced parsing for thinking models - ONLY for explicit thinking patterns
    // Look for content that appears before tool calls AND has strong thinking indicators
    // Support both ```json and new model format (to=tool_name json{...} or to=tool_namejson{...})
    const beforeToolCallMatch = text.match(/^([\s\S]*?)(?=```json|(?:commentary\s+)?to=[a-zA-Z_][a-zA-Z0-9_-]*\s*json)/);
    if (beforeToolCallMatch) {
      const potentialThinking = beforeToolCallMatch[1].trim();

      // Very specific thinking indicators - must be explicit reasoning language
      const strongThinkingIndicators = [
        'okay let me think through this', 'let me think through', 'i need to think about',
        'let me analyze this', 'let me break this down', 'thinking through this',
        'let me consider the', 'i should think about', 'let me reason through',
        'okay let me think', 'let me think carefully', 'i need to consider',
        'commentary', 'commentarythe', 'according to developer instruction'
      ];

      // Check for multiple strong indicators or very explicit thinking language
      const strongIndicatorCount = strongThinkingIndicators.filter(indicator =>
        potentialThinking.toLowerCase().includes(indicator)
      ).length;

      // Very strict criteria: must have strong thinking language AND be substantial content
      // AND appear before a tool call (not standalone responses)
      const hasToolCall = text.includes('```json') || /(?:commentary\s+)?to=[a-zA-Z_][a-zA-Z0-9_-]*\s*json/.test(text);
      const isExplicitThinking = strongIndicatorCount > 0 && potentialThinking.length > 100;
      const startsWithThinking = /^(okay let me think|let me think|i need to think|thinking through|commentary)/i.test(potentialThinking);

      if (hasToolCall && (isExplicitThinking || startsWithThinking)) {
        thinking.push(potentialThinking);
      }
    }

    // Clean the response by removing unwanted content
    response = text;

    // Remove structured thinking and tool execution blocks
    response = response.replace(thinkRegex, '').replace(toolRegex, '');

    // Show original content - no cleaning

    // Remove tool result markers
    response = response.replace(/\[TOOL_RESULT\][\s\S]*?\[END_TOOL_RESULT\]/gi, '');

    // Remove extracted thinking content from response
    for (const thinkingContent of thinking) {
      response = response.replace(thinkingContent, '');
    }

    // Remove model-specific template tags
    response = removeTemplateTags(response);

    // Clean up extra whitespace and empty lines
    response = response.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

    return { thinking, toolExecution, response, modeSwitch };
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

  // Tool parsing is now handled by the provider, not the UI component

  const parsed = useMemo(() => parseMessage(content), [content]);
  const hasThinking = parsed.thinking.length > 0;
  const hasToolExecution = parsed.toolExecution.length > 0;

  // TTS function for speaking the message
  const handleSpeak = useCallback(async () => {
    try {
      const settings = settingsService.getSettings();
      const ttsSettings = settings.ui?.textToSpeech;

      if (!ttsSettings?.enabled) {
        console.log('🔊 TTS is disabled in settings');
        return;
      }

      if (isSpeaking) {
        // Stop current speech
        const ttsService = getTTSService(ttsSettings);
        ttsService.stop();
        setIsSpeaking(false);
        console.log('🔊 TTS stopped');
      } else {
        // Start speaking
        const ttsService = getTTSService(ttsSettings);

        // Use the parsed response text for cleaner speech
        const textToSpeak = parsed.response || content;

        if (!textToSpeak || textToSpeak.trim().length === 0) {
          console.log('🔊 No text to speak');
          return;
        }

        console.log('🔊 Starting TTS for text:', textToSpeak.substring(0, 100) + '...');
        setIsSpeaking(true);
        ttsService.speak(textToSpeak);

        // Monitor speech status
        const checkSpeechStatus = () => {
          if (!ttsService.isSpeaking()) {
            setIsSpeaking(false);
            console.log('🔊 TTS finished');
          } else {
            setTimeout(checkSpeechStatus, 100);
          }
        };
        setTimeout(checkSpeechStatus, 100);
      }
    } catch (error) {
      console.error('🔊 Failed to speak text:', error);
      setIsSpeaking(false);
    }
  }, [content, parsed.response, isSpeaking]);

  // Auto-play TTS for new AI messages if enabled
  useEffect(() => {
    // Reset auto-play trigger when content changes (new message)
    autoPlayTriggeredRef.current = false;
  }, [content]);

  useEffect(() => {
    const settings = settingsService.getSettings();
    const ttsSettings = settings.ui?.textToSpeech;

    // Only auto-play if:
    // 1. TTS is enabled
    // 2. Auto-play is enabled
    // 3. There's content to speak
    // 4. We haven't already triggered auto-play for this message
    // 5. This appears to be an AI response (has parsed response content)
    if (ttsSettings?.enabled &&
        ttsSettings?.autoPlay &&
        content &&
        !autoPlayTriggeredRef.current &&
        parsed.response &&
        parsed.response.trim().length > 0) {

      console.log('🔊 Auto-play TTS triggered for new AI message');
      autoPlayTriggeredRef.current = true;

      // Small delay to ensure the message is fully rendered
      const timer = setTimeout(() => {
        handleSpeak();
      }, 1000); // Increased delay to ensure message is complete

      return () => clearTimeout(timer);
    }
  }, [content, parsed.response, handleSpeak]);

  // Tool calls should ALWAYS be provided by the provider, never extracted from content
  // This prevents "xml undefined" issues during streaming and ensures clean architecture
  const allToolCalls = toolCalls || [];

  // Debug tool calls to find where "undefined" is coming from
  if (allToolCalls.length > 0) {
    console.log('🔧 MessageWithThinking allToolCalls:', allToolCalls);
    console.log('🔧 toolCalls prop:', toolCalls);
    console.log('🔧 isStreaming:', isStreaming);
  }
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

  // Helper function to get mode color
  const getModeColor = (mode: string): string => {
    const modeColors: Record<string, string> = {
      'Research Mode': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      'Creative Mode': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      'Analytical Mode': 'bg-green-500/20 text-green-300 border-green-500/30',
      'Productivity Mode': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      'Collaborative Mode': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
    };
    return modeColors[mode] || 'bg-gray-500/20 text-gray-300 border-gray-500/30';
  };

  return (
    <div className={`relative group ${className}`}>
      {/* Mode Switch Indicator - Show when mode is switched */}
      {parsed.modeSwitch && (
        <div className="mb-3">
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${getModeColor(parsed.modeSwitch.mode)}`}>
            <div className="w-2 h-2 rounded-full bg-current animate-pulse"></div>
            <span>{parsed.modeSwitch.mode} Activated</span>
          </div>
          {parsed.modeSwitch.reason && (
            <div className="mt-1 text-xs text-muted-foreground italic">
              {parsed.modeSwitch.reason}
            </div>
          )}
        </div>
      )}

      {/* Thinking Section - Only show if there are thinking blocks */}
      {hasThinking && (
        <div className="mb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowThinking(!showThinking)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground p-0.5 h-auto"
          >
            {showThinking ? (
              <ChevronDown style={{ width: '16px', height: '16px' }} />
            ) : (
              <ChevronRight style={{ width: '16px', height: '16px' }} />
            )}
            <Brain style={{ width: '16px', height: '16px' }} />
            <span>Model Thinking ({parsed.thinking.length} section{parsed.thinking.length !== 1 ? 's' : ''})</span>
          </Button>
          
          {showThinking && (
            <div className="mt-1 space-y-1">
              {parsed.thinking.map((thinkingText, index) => (
                <div
                  key={index}
                  className="bg-muted rounded-2xl p-2 text-xs"
                  style={{ border: 'none' }}
                >
                  <div className="flex items-center gap-1 mb-1 text-xs text-muted-foreground">
                    <Brain style={{ width: '16px', height: '16px' }} />
                    <span>Thinking {parsed.thinking.length > 1 ? `${index + 1}` : ''}</span>
                  </div>
                  {parseTextWithContent(
                    thinkingText,
                    "whitespace-pre-wrap text-foreground select-text break-words text-sm",
                    {
                      WebkitAppRegion: 'no-drag',
                      userSelect: 'text',
                      WebkitUserSelect: 'text',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      maxWidth: '100%'
                    } as React.CSSProperties & { WebkitAppRegion?: string }
                  )}
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
                            {parseTextWithContent(
                              tool.result || '(no result)',
                              `text-xs whitespace-pre-wrap select-text rounded p-2 break-words ${
                                tool.status === 'success'
                                  ? 'text-muted-foreground bg-background/50'
                                  : 'text-red-300 bg-red-500/10'
                              }`,
                              {
                                WebkitAppRegion: 'no-drag',
                                userSelect: 'text',
                                WebkitUserSelect: 'text',
                                border: 'none',
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word',
                                maxWidth: '100%'
                              } as React.CSSProperties & { WebkitAppRegion?: string }
                            )}
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
                        {toolText}
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
                      <div key={toolIndex} className={`border rounded-lg p-3 ${
                        tool.error ? 'border-red-500/30 bg-red-500/5' : 'border-border/50'
                      }`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-medium text-foreground">{tool.name}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded ${
                            tool.error
                              ? 'bg-red-500/20 text-red-400'
                              : 'bg-green-500/20 text-green-400'
                          }`}>
                            {tool.error ? '✗ Failed' : '✓ Success'}
                          </span>
                        </div>

                        {/* Show actual tool results */}
                        {tool.result !== undefined ? (
                          <div className="mt-2">
                            <div className="text-xs font-medium text-muted-foreground mb-1">Result:</div>
                            <div className="bg-muted rounded p-2 text-xs whitespace-pre-wrap text-foreground select-text break-words max-h-40 overflow-y-auto"
                                 style={{
                                   WebkitAppRegion: 'no-drag',
                                   userSelect: 'text',
                                   WebkitUserSelect: 'text',
                                   wordWrap: 'break-word',
                                   overflowWrap: 'break-word'
                                 } as React.CSSProperties & { WebkitAppRegion?: string }}>
                              {tool.result || '(empty result)'}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            Tool executed successfully. No detailed results available.
                          </div>
                        )}
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

                  {/* Tool Status and Summary */}
                  <div className="text-xs text-muted-foreground">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="font-medium">Status:</span>
                      <span className={toolCall.error ? 'text-red-400' : 'text-green-400'}>
                        {toolCall.error ? '✗ Failed' : '✓ Executed'}
                      </span>
                    </div>

                    {/* Show arguments summary */}
                    {Object.keys(toolCall.arguments).length > 0 && (
                      <div className="mt-1">
                        <span className="font-medium">Arguments: </span>
                        <span className="text-xs">
                          {Object.entries(toolCall.arguments).map(([key, value]) => {
                            const valueStr = value !== undefined && value !== null ? String(value) : '(empty)';
                            return `${key}: ${valueStr.substring(0, 50)}${valueStr.length > 50 ? '...' : ''}`;
                          }).join(', ')}
                        </span>
                      </div>
                    )}

                    <div className="mt-1 text-xs">
                      Full results are shown in the Tool Execution section above.
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons - positioned in top right */}
      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        {/* TTS Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSpeak}
          className="h-6 w-6 p-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
          title={isSpeaking ? "Stop speaking" : "Speak text"}
        >
          {isSpeaking ? (
            <VolumeX className="h-3 w-3 text-blue-500" />
          ) : (
            <Volume2 className="h-3 w-3" />
          )}
        </Button>

        {/* Copy Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-6 w-6 p-0"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
          title="Copy message"
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Main Response */}
      {parsed.response && parseTextWithContent(
        parsed.response,
        "select-text break-words text-sm leading-relaxed",
        {
          WebkitAppRegion: 'no-drag',
          userSelect: 'text',
          WebkitUserSelect: 'text',
          wordWrap: 'break-word',
          overflowWrap: 'break-word',
          maxWidth: '100%'
        } as React.CSSProperties & { WebkitAppRegion?: string }
      )}

      {/* Token Usage, Cost, and Performance Info */}
      {(usage || cost || timing) && (
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
            {cost && (
              <div className="flex items-center gap-1">
                <span className="font-medium">💰</span>
                <span>
                  {cost.totalCost < 0.000001 ? '<$0.000001' :
                   cost.totalCost < 0.01 ? `$${cost.totalCost.toFixed(6)}` :
                   `$${cost.totalCost.toFixed(4)}`}
                  {cost.provider && ` (${cost.provider})`}
                </span>
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
