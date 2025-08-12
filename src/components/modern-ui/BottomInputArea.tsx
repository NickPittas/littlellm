'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Paperclip,
  Camera,
  Database,
  Wrench,
  ChevronDown,
  Plus,
  Send,
  Square
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import { debugLogger } from '../../services/debugLogger';
import { Agent } from '../../types/components';

interface BottomInputAreaProps {
  className?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSend?: (message: string) => void;
  onStop?: () => void;
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
  selectedAgent?: Agent;
  onAgentChange?: (agent: Agent) => void;
  availableAgents?: Agent[];
}

export function BottomInputArea({
  className,
  value = '',
  onChange,
  onSend,
  onStop,
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
  onStartNewChat,
  selectedAgent,
  onAgentChange,
  availableAgents = []
}: BottomInputAreaProps) {
  
  const [inputValue, setInputValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showAgentDropdown, setShowAgentDropdown] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelSearchRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local input value with prop value (for prompt selection)
  useEffect(() => {
    if (value !== undefined && value !== inputValue) {
      setInputValue(value);
      // Reset textarea height when value changes externally
      if (textareaRef.current) {
        textareaRef.current.style.height = '30px';
      }
    }
  }, [value, inputValue]);

  // Reset textarea height when input is cleared
  useEffect(() => {
    if (!inputValue && textareaRef.current) {
      textareaRef.current.style.height = '30px';
    }
  }, [inputValue]);

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onFileUpload?.(files);
    }
  };

  // Add global "/" key listener to focus textarea
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      // Only focus if no input/textarea is currently focused and the key is "/"
      if (event.key === '/' &&
          document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA' &&
          !event.ctrlKey && !event.metaKey && !event.altKey) {
        event.preventDefault();
        textareaRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Focus search input when dropdown opens - simplified
  useEffect(() => {
    if (showModelDropdown && modelSearchRef.current) {
      modelSearchRef.current.focus();
    }
  }, [showModelDropdown]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const minHeight = 30; // 1.25 rows
    const maxHeight = 120; // 5 rows

    if (scrollHeight <= maxHeight) {
      textarea.style.height = Math.max(minHeight, scrollHeight) + 'px';
    } else {
      textarea.style.height = maxHeight + 'px';
    }
  };

  // Handle send message
  const handleSend = () => {
    if (inputValue.trim() && !isLoading) {
      onSend?.(inputValue.trim());
      setInputValue('');
      onChange?.('');
    }
  };

  // Handle stop generation
  const handleStop = () => {
    if (isLoading) {
      onStop?.();
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

  // Auto-resize textarea - moved to input handler to avoid useEffect issues

  // Focus management removed - was causing input issues

  return (
    <div
      className={cn(
        "flex flex-col bg-gray-900/50 border-t border-gray-800/50",
        className
      )}
    >
      {/* Top Row - Model Dropdown Only */}
      <div className="flex items-center px-2 py-0.5 border-b border-gray-800/30">
        <div className="relative">
          {showModelDropdown && (
            <div className="absolute bottom-full left-0 mb-1 w-80 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 max-h-64 overflow-hidden">
              <div className="p-1 border-b border-gray-700">
                <Input
                  placeholder="Search models..."
                  value={modelSearchQuery}
                  onChange={(e) => setModelSearchQuery(e.target.value)}
                  className="h-6 text-xs bg-gray-700 border-gray-600"
                  autoFocus
                />
              </div>
              <div className="max-h-48 overflow-y-auto">
                {filteredModels.map((model) => (
                  <div
                    key={model}
                    className={cn(
                      "px-2 py-1 text-xs cursor-pointer transition-colors",
                      model === selectedModel
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:bg-gray-700"
                    )}
                    onClick={() => {
                      onModelChange?.(model);
                      setShowModelDropdown(false);
                      setModelSearchQuery('');
                    }}
                  >
                    {model}
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            onClick={() => {
              setShowModelDropdown(!showModelDropdown);
              if (!showModelDropdown) {
                setModelSearchQuery(''); // Clear search when opening
              }
            }}
            title={`Current Model: ${selectedModel}`}
          >
            <span className="text-xs mr-1">{selectedModel}</span>
            <ChevronDown className="w-2.5 h-2.5" />
          </Button>
        </div>
      </div>

      {/* Main Row - Text Input with Agent and Action Buttons */}
      <div className="flex items-center gap-1 p-2">
        {/* Text Input */}
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
              "w-full resize-none rounded-md border border-gray-700 bg-gray-800/50 px-2 py-1 text-sm text-white placeholder-gray-400",
              "focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50",
              "transition-all duration-200"
            )}
            style={{
              minHeight: '30px', // 1.25 rows (24px line height + 6px padding)
              maxHeight: '120px', // 5 rows (24px * 5 + padding)
              lineHeight: '24px'
            }}
            rows={1}
            disabled={isLoading}
          />
        </div>

        {/* Agent Button - Right of text input */}
        <div className="relative">
          {showAgentDropdown && (
            <div className="absolute bottom-full right-0 mb-1 w-64 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
              <div className="p-1">
                <div
                  className="px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 rounded cursor-pointer"
                  onClick={() => {
                    onAgentChange?.(null);
                    setShowAgentDropdown(false);
                  }}
                >
                  No Agent
                </div>
                {availableAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="px-2 py-1 text-xs text-gray-300 hover:bg-gray-700 rounded cursor-pointer flex items-center gap-1"
                    onClick={() => {
                      onAgentChange?.(agent);
                      setShowAgentDropdown(false);
                    }}
                  >
                    <span>{agent.icon || '🤖'}</span>
                    <span>{agent.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            onClick={() => setShowAgentDropdown(!showAgentDropdown)}
            title={selectedAgent ? `Current Agent: ${selectedAgent.name}` : 'No Agent Selected'}
          >
            <span className="text-xs mr-1">
              {selectedAgent ? `${selectedAgent.icon || '🤖'} ${selectedAgent.name}` : 'No Agent'}
            </span>
            <ChevronDown className="w-2.5 h-2.5" />
          </Button>
        </div>

        {/* Right side - All action buttons */}
        <div className="flex items-center gap-0.5">
          {/* Tool Calling Toggle */}
          <Button
            variant={(toolsEnabled && mcpEnabled) ? "default" : "ghost"}
            size="sm"
            onClick={() => {
              const newState = !(toolsEnabled && mcpEnabled);
              onToggleTools?.(newState);
              onToggleMCP?.(newState);
            }}
            className={cn(
              "h-7 w-7 p-0 transition-colors",
              (toolsEnabled && mcpEnabled)
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            )}
            title={(toolsEnabled && mcpEnabled) ? "Disable Tool Calling" : "Enable Tool Calling"}
          >
            <Wrench style={{ width: '16px', height: '16px', color: 'inherit', minWidth: '16px', minHeight: '16px' }} />
          </Button>

          {/* Knowledge Base Toggle */}
          <Button
            variant={knowledgeBaseEnabled ? "default" : "ghost"}
            size="sm"
            onClick={() => onToggleKnowledgeBase?.(!knowledgeBaseEnabled)}
            className={cn(
              "h-7 w-7 p-0 transition-colors",
              knowledgeBaseEnabled
                ? "bg-purple-600 text-white hover:bg-purple-700"
                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            )}
            title={knowledgeBaseEnabled ? "Disable Knowledge Base" : "Enable Knowledge Base"}
          >
            <Database style={{ width: '16px', height: '16px', color: 'inherit', minWidth: '16px', minHeight: '16px' }} />
          </Button>

          {/* Screenshot Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onScreenshot}
            className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            title="Take Screenshot"
          >
            <Camera style={{ width: '16px', height: '16px', color: 'inherit', minWidth: '16px', minHeight: '16px' }} />
          </Button>

          {/* File Upload Button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFileUpload}
            className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            title="Add Attachment"
          >
            <Paperclip style={{ width: '16px', height: '16px', color: 'inherit', minWidth: '16px', minHeight: '16px' }} />
          </Button>

          {/* New Chat Button */}
          <Button
            onClick={() => onStartNewChat?.()}
            className={cn(
              "h-7 w-7 rounded-md flex-shrink-0 transition-all duration-200",
              "bg-green-600 hover:bg-green-700 text-white"
            )}
            title="Start New Chat"
          >
            <Plus style={{ width: '16px', height: '16px', color: 'white', minWidth: '16px', minHeight: '16px' }} />
          </Button>

          {/* Send/Stop Button */}
          <Button
            onClick={isLoading ? handleStop : handleSend}
            disabled={!isLoading && !inputValue.trim()}
            className={cn(
              "h-7 w-7 rounded-md flex-shrink-0 transition-all duration-200",
              isLoading
                ? "bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-500/25"
                : inputValue.trim()
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-gray-700 text-gray-400 cursor-not-allowed"
            )}
            title={isLoading ? "Stop Generation" : "Send Message"}
          >
            {isLoading ? (
              <Square style={{ width: '16px', height: '16px', color: 'white', minWidth: '16px', minHeight: '16px' }} />
            ) : (
              <Send style={{ width: '16px', height: '16px', color: 'white', minWidth: '16px', minHeight: '16px' }} />
            )}
          </Button>
        </div>
      </div>

      {/* File input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.md,.pdf,.doc,.docx,.csv,.json,.xml,.html,.js,.ts,.py,.java,.cpp,.c,.h,.css,.scss,.less,.yaml,.yml,.toml,.ini,.cfg,.conf,.log,.sql,.sh,.bat,.ps1,.rb,.php,.go,.rs,.swift,.kt,.scala,.clj,.hs,.elm,.ex,.exs,.erl,.pl,.r,.m,.mm,.f,.f90,.f95,.pas,.ada,.cob,.cobol,.asm,.s,.vb,.vbs,.ps,.psm1,.psd1,.lua,.tcl,.awk,.sed,.vim,.emacs,.org,.tex,.bib,.rtf,.odt,.ods,.odp,.pages,.numbers,.key,.epub,.mobi,.azw,.azw3,.fb2,.lit,.pdb,.prc,.oxps,.xps,.cbr,.cbz,.cb7,.cbt,.cba"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
