'use client';

import { useState, useEffect, useRef } from 'react';
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
  X
} from 'lucide-react';
import { promptsService, type Prompt } from '../services/promptsService';

interface ActionItem {
  id: string;
  title: string;
  description: string;
  category: 'prompt' | 'action' | 'recent';
  icon: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

export function ActionMenuOverlay() {
  const [searchQuery, setSearchQuery] = useState('');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load prompts when component mounts
  useEffect(() => {
    const loadPrompts = async () => {
      try {
        const allPrompts = await promptsService.getAllPrompts();
        setPrompts(allPrompts || []);
      } catch (error) {
        console.error('Failed to load prompts:', error);
        setPrompts([]);
      }
    };

    loadPrompts();
    
    // Focus search input
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }, []);

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
          handlePromptSelect(prompt.prompt);
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
          handlePromptSelect('Please provide a concise summary of the following text:\n\n{content}\n\nYour summary should capture the main points, key ideas, and overall message of the text in a clear and concise manner. Aim to keep the summary around 100-200 words, depending on the length and complexity of the original text.');
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
          handlePromptSelect('Please analyze and explain the functionality of the following code snippet. Break down each part of the code to describe what it does, and explain how the code works as a whole.:\n\n{content}');
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
          handlePromptSelect('Please translate the following text to English:\n\n{content}\n\nIf the original text is not in English, provide the translation along with the original language if possible. Thank you!');
        },
        keywords: ['translate', 'language', 'convert']
      },
      {
        id: 'action-improve',
        title: 'Improve Writing',
        description: 'Improve grammar and style of text',
        category: 'action',
        icon: <Zap className="h-4 w-4" />,
        action: () => {
          handlePromptSelect('Please review and improve the grammar and style of the following text. Ensure that the improved version maintains the original meaning while enhancing clarity, readability, and overall quality.:\n\n{content}');
        },
        keywords: ['improve', 'grammar', 'writing', 'style']
      },
      {
        id: 'action-brainstorm',
        title: 'Brainstorm Ideas',
        description: 'Generate creative ideas for a topic',
        category: 'action',
        icon: <Star className="h-4 w-4" />,
        action: () => {
          handlePromptSelect('Please brainstorm creative ideas for:\n\n{content}');
        },
        keywords: ['brainstorm', 'ideas', 'creative', 'generate']
      }
    ];

    return [...items, ...builtInActions];
  };

  const handlePromptSelect = (promptText: string) => {
    // Send the prompt back to the main window and close overlay
    if (typeof window !== 'undefined' && window.electronAPI) {
      console.log('Selected prompt:', promptText);
      // Send the prompt to the main window
      window.electronAPI.sendPromptToMain(promptText);
    }
  };

  const handleClose = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.closeActionMenu();
    }
  };

  // Filter items based on search query
  const filteredItems = createActionItems().filter(item => {
    if (!searchQuery.trim()) return true;
    
    const query = searchQuery.toLowerCase();
    const searchableText = [
      item.title,
      item.description,
      ...(item.keywords || [])
    ].join(' ').toLowerCase();
    
    return searchableText.includes(query);
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
        handleClose();
        break;
    }
  };

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  return (
    <div className="h-full w-full bg-background border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <h2 className="text-lg font-semibold">Quick Actions</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search actions and prompts..."
            className="pl-10 text-base"
          />
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto hide-scrollbar">
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
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
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
    </div>
  );
}
