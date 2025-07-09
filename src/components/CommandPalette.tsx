'use client';

import { useState, useEffect } from 'react';
import { promptsService, type Prompt } from '../services/promptsService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { 
  Search, 
  Wand2, 
  FileText, 
  Mail, 
  Code, 
  MessageSquare,
  Edit3,
  CheckSquare,
  Lightbulb,
  Zap,
  Star,
  Clock
} from 'lucide-react';

interface CommandPaletteProps {
  onPromptSelect: (prompt: string) => void;
}

const categoryIcons: Record<string, React.ReactNode> = {
  text: <FileText className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  code: <Code className="h-4 w-4" />,
  chat: <MessageSquare className="h-4 w-4" />,
  writing: <Edit3 className="h-4 w-4" />,
  productivity: <CheckSquare className="h-4 w-4" />,
  creative: <Lightbulb className="h-4 w-4" />,
  other: <Zap className="h-4 w-4" />
};

const recentActions = [
  { name: 'Fix Grammar & Spelling', icon: '✓', category: 'writing' },
  { name: 'Write a creative story about myself', icon: '📝', category: 'creative' },
  { name: 'Improve Writing', icon: '✨', category: 'writing' },
  { name: 'Make Longer', icon: '📏', category: 'text' },
  { name: 'Summarize', icon: '📋', category: 'text' }
];

export function CommandPalette({ onPromptSelect }: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    const allPrompts = promptsService.getAllPrompts();
    const allCategories = promptsService.getCategories();
    setPrompts(allPrompts);
    setCategories(allCategories);
  }, []);

  const filteredPrompts = prompts.filter(prompt => {
    const matchesSearch = searchQuery === '' || 
      prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || prompt.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handlePromptClick = async (prompt: Prompt) => {
    let processedPrompt = prompt.prompt;
    
    // Try to get clipboard content if prompt uses it
    if (prompt.prompt.includes('{content}')) {
      try {
        let clipboardContent = '';
        if (typeof window !== 'undefined' && window.electronAPI) {
          clipboardContent = (await window.electronAPI.readClipboard()).trim();
        } else if (navigator.clipboard) {
          clipboardContent = (await navigator.clipboard.readText()).trim();
        }
        
        if (clipboardContent) {
          processedPrompt = promptsService.processPrompt(prompt.id, clipboardContent);
        } else {
          processedPrompt = processedPrompt.replace('{content}', '[No clipboard content available]');
        }
      } catch (error) {
        console.error('Failed to read clipboard:', error);
        processedPrompt = processedPrompt.replace('{content}', '[Clipboard access failed]');
      }
    }
    
    onPromptSelect(processedPrompt);
  };

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search actions..."
          className="pl-10"
        />
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedCategory('all')}
        >
          All
        </Button>
        {categories.map(category => (
          <Button
            key={category}
            variant={selectedCategory === category ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedCategory(category)}
            className="flex items-center gap-1"
          >
            {categoryIcons[category] || <Zap className="h-4 w-4" />}
            {category.charAt(0).toUpperCase() + category.slice(1)}
          </Button>
        ))}
      </div>

      {/* Recent Actions (shown when no search) */}
      {searchQuery === '' && selectedCategory === 'all' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" />
            Recently Used
          </div>
          <div className="grid grid-cols-1 gap-2">
            {recentActions.map((action, index) => (
              <Button
                key={index}
                variant="ghost"
                className="justify-start h-auto p-3 text-left"
                onClick={() => {
                  // Find the corresponding prompt
                  const prompt = prompts.find(p => p.name === action.name);
                  if (prompt) {
                    handlePromptClick(prompt);
                  }
                }}
              >
                <div className="flex items-center gap-3 w-full">
                  <span className="text-lg">{action.icon}</span>
                  <div className="flex-1">
                    <div className="font-medium">{action.name}</div>
                  </div>
                  {categoryIcons[action.category] && (
                    <div className="text-muted-foreground">
                      {categoryIcons[action.category]}
                    </div>
                  )}
                </div>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Actions Grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 gap-2">
          {filteredPrompts.map((prompt) => (
            <Button
              key={prompt.id}
              variant="ghost"
              className="justify-start h-auto p-3 text-left hover:bg-accent"
              onClick={() => handlePromptClick(prompt)}
            >
              <div className="flex items-center gap-3 w-full">
                <span className="text-lg">{prompt.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{prompt.name}</div>
                  <div className="text-sm text-muted-foreground truncate">
                    {prompt.description}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {prompt.prompt.includes('{content}') && (
                    <Badge variant="secondary" className="text-xs">
                      📋
                    </Badge>
                  )}
                  {categoryIcons[prompt.category] && (
                    <div className="text-muted-foreground">
                      {categoryIcons[prompt.category]}
                    </div>
                  )}
                </div>
              </div>
            </Button>
          ))}
        </div>
        
        {filteredPrompts.length === 0 && (
          <div className="text-center text-muted-foreground py-8">
            <Wand2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No actions found</p>
            <p className="text-sm">Try adjusting your search or category filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
