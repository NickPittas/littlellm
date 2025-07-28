'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Paperclip,
  Camera,
  Database,
  Wrench,
  ChevronDown,
  ArrowUp,
  Plus,
  Search
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';

interface BottomInputAreaProps {
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSend?: (message: string) => void;
  onFileUpload?: (files: FileList) => void;
  onScreenshot?: () => void;
  selectedModel?: string;
  onModelChange?: (model: string) => void;
  availableModels?: string[];
  selectedProvider?: string;
  isLoading?: boolean;
  toolsEnabled?: boolean;
  onToggleTools?: (enabled: boolean) => void;
  mcpEnabled?: boolean;
  onToggleMCP?: (enabled: boolean) => void;
  knowledgeBaseEnabled?: boolean;
  onToggleKnowledgeBase?: (enabled: boolean) => void;
  onStartNewChat?: () => void;
}

export function BottomInputArea({
  className,
  value = '',
  onChange,
  onSend,
  onFileUpload,
  onScreenshot,
  selectedModel = 'gemma3:gpu',
  onModelChange,
  availableModels = [],
  selectedProvider = 'ollama',
  isLoading = false,
  toolsEnabled = false,
  onToggleTools,
  mcpEnabled = false,
  onToggleMCP,
  knowledgeBaseEnabled = false,
  onToggleKnowledgeBase,
  onStartNewChat
}: BottomInputAreaProps) {
  
  const [inputValue, setInputValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelSearchRef = useRef<HTMLInputElement>(null);

  // Sync local input value with prop value (for prompt selection)
  useEffect(() => {
    if (value !== undefined) {
      setInputValue(value);
    }
  }, [value]);

  // Simple fuzzy search function
  const fuzzySearch = (query: string, text: string): number => {
    if (!query) return 1; // No query means perfect match

    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();

    // Exact match gets highest score
    if (textLower.includes(queryLower)) {
      return 1;
    }

    // Character-by-character fuzzy matching
    let queryIndex = 0;
    let score = 0;

    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
      if (textLower[i] === queryLower[queryIndex]) {
        score++;
        queryIndex++;
      }
    }

    // Return score as percentage of query characters found
    return queryIndex === queryLower.length ? score / queryLower.length : 0;
  };

  // Filter and sort models based on search query
  const filteredModels = availableModels
    .map(model => ({
      model,
      score: fuzzySearch(modelSearchQuery, model)
    }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.model);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (showModelDropdown && modelSearchRef.current) {
      setTimeout(() => {
        modelSearchRef.current?.focus();
      }, 100);
    }
  }, [showModelDropdown]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);
  };

  // Handle send message
  const handleSend = () => {
    if (inputValue.trim() && !isLoading) {
      onSend?.(inputValue.trim());
      setInputValue('');
      onChange?.('');
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    
    // Focus on "/" key press
    if (e.key === '/' && !isFocused) {
      e.preventDefault();
      textareaRef.current?.focus();
    }
  };

  // Handle file upload
  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,.pdf,.txt,.doc,.docx,.xlsx,.xls,.ods,.pptx,.ppt,.csv,.json,.html,.htm,.xml,.ics,.rtf,.jpg,.png,.md,.log';
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        onFileUpload?.(files);
      }
    };
    input.click();
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  return (
    <div
      className={cn(
        "flex flex-col bg-gray-900/50 border-t border-gray-800/50",
        className
      )}
    >
      {/* Input Area */}
      <div className="flex items-end gap-3 p-4">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Press / to focus here and start typing..."
            className={cn(
              "w-full resize-none rounded-lg border border-gray-700 bg-gray-800/50 px-4 py-3 text-white placeholder-gray-400",
              "focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50",
              "transition-all duration-200 min-h-[48px] max-h-[120px]"
            )}
            rows={1}
            disabled={isLoading}
          />
        </div>

        <Button
          onClick={() => onStartNewChat?.()}
          className={cn(
            "h-12 w-12 rounded-lg flex-shrink-0 transition-all duration-200",
            "bg-green-600 hover:bg-green-700 text-white"
          )}
          title="Start New Chat"
        >
          <Plus className="w-5 h-5" />
        </Button>

        <Button
          onClick={handleSend}
          disabled={!inputValue.trim() || isLoading}
          className={cn(
            "h-12 w-12 rounded-lg flex-shrink-0 transition-all duration-200",
            inputValue.trim() && !isLoading
              ? "bg-blue-600 hover:bg-blue-700 text-white"
              : "bg-gray-700 text-gray-400 cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <ArrowUp className="w-5 h-5" />
          )}
        </Button>
      </div>

      {/* Controls Row - Below textarea */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-gray-800/30">
        {/* Left side - Model selector and toggle buttons */}
        <div className="flex items-center gap-4">
          {/* Model selector */}
          <div className="flex flex-col items-start">
            <span className="text-xs text-gray-500 mb-1">Provider: {selectedProvider}</span>
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
                onClick={() => {
                  setShowModelDropdown(!showModelDropdown);
                  if (!showModelDropdown) {
                    setModelSearchQuery(''); // Clear search when opening
                  }
                }}
                title={`Current Model: ${selectedModel}`}
              >
                <span className="text-sm mr-2">{selectedModel}</span>
                <ChevronDown className="w-3 h-3" />
              </Button>

              {/* Model Dropdown */}
              {showModelDropdown && (
                <div className="absolute bottom-full left-0 mb-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50">
                  <div className="p-3 border-b border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">Available Models ({selectedProvider})</span>
                      <span className="text-xs text-gray-500">{filteredModels.length} of {availableModels.length}</span>
                    </div>

                    {/* Search Input */}
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
                      <Input
                        ref={modelSearchRef}
                        value={modelSearchQuery}
                        onChange={(e) => setModelSearchQuery(e.target.value)}
                        placeholder="Search models..."
                        className="pl-7 h-7 text-xs bg-gray-700 border-gray-600 focus:border-blue-500 text-white placeholder-gray-400"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            setShowModelDropdown(false);
                            setModelSearchQuery('');
                          } else if (e.key === 'Enter' && filteredModels.length > 0) {
                            onModelChange?.(filteredModels[0]);
                            setShowModelDropdown(false);
                            setModelSearchQuery('');
                          }
                        }}
                      />
                    </div>
                  </div>

                  <div className="max-h-48 overflow-y-auto">
                    {filteredModels.length > 0 ? (
                      filteredModels.map((model) => (
                        <button
                          key={model}
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors",
                            model === selectedModel ? "bg-blue-600/20 text-blue-400" : "text-gray-300"
                          )}
                          onClick={() => {
                            onModelChange?.(model);
                            setShowModelDropdown(false);
                            setModelSearchQuery('');
                          }}
                        >
                          {model}
                        </button>
                      ))
                    ) : modelSearchQuery ? (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        No models match &quot;{modelSearchQuery}&quot;
                      </div>
                    ) : availableModels.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        No models available. Select a provider first.
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Toggle buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant={(toolsEnabled && mcpEnabled) ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                const newState = !(toolsEnabled && mcpEnabled);
                onToggleTools?.(newState);
                onToggleMCP?.(newState);
              }}
              className={cn(
                "h-8 w-8 p-0 transition-colors",
                (toolsEnabled && mcpEnabled)
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50"
              )}
              title={(toolsEnabled && mcpEnabled) ? "Disable Tool Calling" : "Enable Tool Calling"}
            >
              <Wrench className="w-4 h-4" />
            </Button>

            <Button
              variant={knowledgeBaseEnabled ? "default" : "ghost"}
              size="sm"
              onClick={() => onToggleKnowledgeBase?.(!knowledgeBaseEnabled)}
              className={cn(
                "h-8 w-8 p-0 transition-colors",
                knowledgeBaseEnabled
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50"
              )}
              title={knowledgeBaseEnabled ? "Disable Knowledge Base" : "Enable Knowledge Base"}
            >
              <Database className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onScreenshot}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            title="Take Screenshot"
          >
            <Camera className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleFileUpload}
            className="h-8 w-8 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            title="Add Attachment"
          >
            <Paperclip className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
