'use client';

import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  Search,
  Wand2,
  FileText,
  Code,
  MessageSquare,
  Zap,
  Star,
  Clock
} from 'lucide-react';
import { promptsService, type Prompt } from '../services/promptsService';

interface ActionMenuPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPromptSelect: (prompt: string) => void;
}

interface ActionItem {
  id: string;
  title: string;
  description: string;
  category: 'prompt' | 'action' | 'recent';
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

export function ActionMenuPopup({ open, onOpenChange, onPromptSelect }: ActionMenuPopupProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load prompts when opened
  useEffect(() => {
    const loadPrompts = async () => {
      try {
        const allPrompts = await promptsService.getAllPrompts();
        setPrompts(allPrompts || []); // Ensure we always have an array
      } catch (error) {
        console.error('Failed to load prompts:', error);
        setPrompts([]); // Set empty array on error to prevent crashes
      }
    };

    if (open) {
      loadPrompts();
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  // Focus search input when opened
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Create action items from prompts and built-in actions
  const createActionItems = (): ActionItem[] => {
    const items: ActionItem[] = [];

    // Add ALL prompts from prompts service
    prompts.forEach(prompt => {
      items.push({
        id: `prompt-${prompt.id}`,
        title: prompt.name,
        description: prompt.description || prompt.prompt.substring(0, 100) + (prompt.prompt.length > 100 ? '...' : ''),
        category: 'prompt',
        icon: <Wand2 className="h-4 w-4" />,
        action: () => {
          onPromptSelect(prompt.prompt);
          onOpenChange(false);
        },
        keywords: [prompt.name, prompt.description, prompt.prompt, prompt.category]
      });
    });

    // Add built-in actions
    const builtInActions: ActionItem[] = [
      {
        id: 'action-summarize',
        title: 'Summarize Text',
        description: 'Summarize the provided text or document',
        category: 'action',
        icon: <FileText className="h-4 w-4" />,
        action: () => {
          onPromptSelect('Please summarize the following text: ');
          onOpenChange(false);
        },
        keywords: ['summarize', 'summary', 'text', 'document']
      },
      {
        id: 'action-explain',
        title: 'Explain Code',
        description: 'Explain how the provided code works',
        category: 'action',
        icon: <Code className="h-4 w-4" />,
        action: () => {
          onPromptSelect('Please explain how this code works: ');
          onOpenChange(false);
        },
        keywords: ['explain', 'code', 'programming', 'understand']
      },
      {
        id: 'action-translate',
        title: 'Translate Text',
        description: 'Translate text to another language',
        category: 'action',
        icon: <MessageSquare className="h-4 w-4" />,
        action: () => {
          onPromptSelect('Please translate the following text to [language]: ');
          onOpenChange(false);
        },
        keywords: ['translate', 'language', 'translation']
      },
      {
        id: 'action-improve',
        title: 'Improve Writing',
        description: 'Improve grammar, style, and clarity of text',
        category: 'action',
        icon: <Wand2 className="h-4 w-4" />,
        action: () => {
          onPromptSelect('Please improve the grammar, style, and clarity of this text: ');
          onOpenChange(false);
        },
        keywords: ['improve', 'writing', 'grammar', 'style', 'clarity']
      },
      {
        id: 'action-brainstorm',
        title: 'Brainstorm Ideas',
        description: 'Generate creative ideas for a topic',
        category: 'action',
        icon: <Zap className="h-4 w-4" />,
        action: () => {
          onPromptSelect('Please help me brainstorm ideas for: ');
          onOpenChange(false);
        },
        keywords: ['brainstorm', 'ideas', 'creative', 'generate']
      }
    ];

    items.push(...builtInActions);
    return items;
  };

  const actionItems = createActionItems();

  // Filter items based on search query
  const filteredItems = actionItems.filter(item => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.keywords?.some(keyword => keyword.toLowerCase().includes(query))
    );
  });

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onOpenChange(false);
        break;
    }
  };

  // Reset selected index when filtered items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'prompt':
        return <Wand2 className="h-3 w-3" />;
      case 'action':
        return <Zap className="h-3 w-3" />;
      case 'recent':
        return <Clock className="h-3 w-3" />;
      default:
        return <Search className="h-3 w-3" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'prompt':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'action':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'recent':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl max-h-[80vh] p-0 gap-0"
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search actions and prompts..."
              className="pl-10 text-base"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 max-h-[60vh] overflow-y-auto hide-scrollbar">
          <div className="p-2">
            {filteredItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No actions found</p>
                <p className="text-sm">Try a different search term</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredItems.map((item, index) => (
                  <Button
                    key={item.id}
                    variant={index === selectedIndex ? "secondary" : "ghost"}
                    className="w-full justify-start h-auto p-3 text-left"
                    onClick={item.action}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <div className="flex-shrink-0 mt-0.5">
                        {item.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{item.title}</span>
                          <span className={`text-xs px-2 py-1 rounded ${getCategoryColor(item.category)}`}>
                            {item.category}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Use ↑↓ to navigate, Enter to select, Esc to close</span>
            <span>{filteredItems.length} actions</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
