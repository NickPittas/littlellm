'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Database, Check, Plus, Search, Settings, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';

// Types matching our knowledge base system
interface KnowledgeBase {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  documentCount: number;
  lastUpdated: Date;
  tags: string[];
}

interface KnowledgeBaseSelectorProps {
  selectedKnowledgeBaseIds: string[];
  onSelectionChange: (selectedIds: string[]) => void;
  availableKnowledgeBases: KnowledgeBase[];
  onManageKnowledgeBases?: () => void;
  onCreateKnowledgeBase?: () => void;
  className?: string;
  maxSelections?: number;
  disabled?: boolean;
  showCreateButton?: boolean;
  showManageButton?: boolean;
  placeholder?: string;
}

export function KnowledgeBaseSelector({
  selectedKnowledgeBaseIds = [],
  onSelectionChange,
  availableKnowledgeBases = [],
  onManageKnowledgeBases,
  onCreateKnowledgeBase,
  className,
  maxSelections = 5,
  disabled = false,
  showCreateButton = true,
  showManageButton = true,
  placeholder = "Select knowledge bases..."
}: KnowledgeBaseSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredKBId, setHoveredKBId] = useState<string | null>(null);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter knowledge bases based on search query
  const filteredKnowledgeBases = availableKnowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kb.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kb.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Get selected knowledge bases details
  const selectedKnowledgeBases = availableKnowledgeBases.filter(kb =>
    selectedKnowledgeBaseIds.includes(kb.id)
  );

  // Handle knowledge base selection
  const handleKnowledgeBaseToggle = (knowledgeBaseId: string) => {
    const isSelected = selectedKnowledgeBaseIds.includes(knowledgeBaseId);
    let newSelection: string[];

    if (isSelected) {
      // Remove from selection
      newSelection = selectedKnowledgeBaseIds.filter(id => id !== knowledgeBaseId);
    } else {
      // Add to selection (check max limit)
      if (selectedKnowledgeBaseIds.length >= maxSelections) {
        // Replace the first selected item if at max capacity
        newSelection = [...selectedKnowledgeBaseIds.slice(1), knowledgeBaseId];
      } else {
        newSelection = [...selectedKnowledgeBaseIds, knowledgeBaseId];
      }
    }

    onSelectionChange(newSelection);
  };

  // Handle clear all selections
  const handleClearAll = () => {
    onSelectionChange([]);
  };

  // Handle select all filtered results
  const handleSelectAllFiltered = () => {
    const filteredIds = filteredKnowledgeBases.map(kb => kb.id);
    const availableSlots = maxSelections - selectedKnowledgeBaseIds.length;
    
    if (availableSlots > 0) {
      const newIds = filteredIds.slice(0, availableSlots);
      const updatedSelection = [...selectedKnowledgeBaseIds, ...newIds.filter(id => !selectedKnowledgeBaseIds.includes(id))];
      onSelectionChange(updatedSelection);
    }
  };

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format display text for selected knowledge bases
  const getDisplayText = () => {
    if (selectedKnowledgeBases.length === 0) {
      return placeholder;
    } else if (selectedKnowledgeBases.length === 1) {
      return selectedKnowledgeBases[0].name;
    } else {
      return `${selectedKnowledgeBases.length} knowledge bases`;
    }
  };

  // Get button color based on selection
  const getButtonColor = () => {
    if (selectedKnowledgeBases.length === 0) {
      return "text-gray-400 hover:text-white hover:bg-gray-800/50";
    } else {
      return "bg-purple-600 text-white hover:bg-purple-700";
    }
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Main Button */}
      <Button
        variant={selectedKnowledgeBases.length > 0 ? "default" : "ghost"}
        size="sm"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "h-7 px-2 text-xs transition-colors flex items-center gap-1",
          getButtonColor()
        )}
        title={selectedKnowledgeBases.length > 0 
          ? `Selected: ${selectedKnowledgeBases.map(kb => kb.name).join(', ')}`
          : "Select knowledge bases"
        }
      >
        <Database style={{ width: '14px', height: '14px', color: 'inherit', minWidth: '14px', minHeight: '14px' }} />
        <span className="text-xs max-w-32 truncate">{getDisplayText()}</span>
        {selectedKnowledgeBases.length > 0 && (
          <span className="text-xs opacity-75">({selectedKnowledgeBases.length})</span>
        )}
      </Button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-80 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-50 max-h-96 overflow-hidden">
          {/* Header with search */}
          <div className="p-2 border-b border-gray-700">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-gray-400" />
              <Input
                ref={searchInputRef}
                placeholder="Search knowledge bases..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-7 text-xs bg-gray-700 border-gray-600 pl-7"
              />
            </div>
            
            {/* Selection info and actions */}
            {selectedKnowledgeBases.length > 0 && (
              <div className="flex items-center justify-between mt-1 text-xs text-gray-400">
                <span>{selectedKnowledgeBases.length}/{maxSelections} selected</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAll}
                  className="h-5 px-1 text-xs text-gray-400 hover:text-white"
                >
                  Clear all
                </Button>
              </div>
            )}
          </div>

          {/* Knowledge Base List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredKnowledgeBases.length === 0 ? (
              <div className="p-3 text-center text-gray-400 text-xs">
                {searchQuery ? 'No knowledge bases match your search' : 'No knowledge bases available'}
              </div>
            ) : (
              <>
                {/* Select all option for filtered results */}
                {searchQuery && filteredKnowledgeBases.length > 1 && (
                  <div className="p-1 border-b border-gray-700">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAllFiltered}
                      className="w-full justify-start h-6 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-gray-700"
                    >
                      Select all filtered ({Math.min(filteredKnowledgeBases.length, maxSelections - selectedKnowledgeBaseIds.length)})
                    </Button>
                  </div>
                )}

                {filteredKnowledgeBases.map((kb) => {
                  const isSelected = selectedKnowledgeBaseIds.includes(kb.id);
                  const isHovered = hoveredKBId === kb.id;
                  
                  return (
                    <div
                      key={kb.id}
                      className={cn(
                        "px-2 py-1.5 cursor-pointer transition-colors border-l-2",
                        isSelected
                          ? "bg-purple-900/30 border-l-purple-500"
                          : isHovered
                          ? "bg-gray-700 border-l-gray-600"
                          : "border-l-transparent hover:bg-gray-700/50"
                      )}
                      onClick={() => handleKnowledgeBaseToggle(kb.id)}
                      onMouseEnter={() => setHoveredKBId(kb.id)}
                      onMouseLeave={() => setHoveredKBId(null)}
                    >
                      <div className="flex items-center gap-2">
                        {/* Selection indicator */}
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0",
                          isSelected
                            ? "bg-purple-600 border-purple-600"
                            : "border-gray-500"
                        )}>
                          {isSelected && <Check className="w-3 h-3 text-white" />}
                        </div>

                        {/* Knowledge base icon */}
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center text-xs flex-shrink-0"
                          style={{ backgroundColor: kb.color + '20', color: kb.color }}
                        >
                          {kb.icon}
                        </div>

                        {/* Knowledge base info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-medium text-white truncate">
                              {kb.name}
                            </span>
                            <span className="text-xs text-gray-400">
                              ({kb.documentCount})
                            </span>
                          </div>
                          <div className="text-xs text-gray-400 truncate">
                            {kb.description}
                          </div>
                          {kb.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {kb.tags.slice(0, 3).map(tag => (
                                <span
                                  key={tag}
                                  className="text-xs px-1 py-0.5 bg-gray-700 text-gray-300 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Footer with action buttons */}
          <div className="p-1 border-t border-gray-700 flex items-center gap-1">
            {showCreateButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onCreateKnowledgeBase?.();
                  setIsOpen(false);
                }}
                className="h-6 px-2 text-xs text-green-400 hover:text-green-300 hover:bg-gray-700 flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Create
              </Button>
            )}
            
            {showManageButton && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  onManageKnowledgeBases?.();
                  setIsOpen(false);
                }}
                className="h-6 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-gray-700 flex items-center gap-1"
              >
                <Settings className="w-3 h-3" />
                Manage
              </Button>
            )}

            <div className="flex-1" />
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-700"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}