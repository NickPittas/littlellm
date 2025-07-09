'use client';

import { useState, useEffect } from 'react';
import { promptsService, type Prompt } from '../services/promptsService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { renderIcon } from '../utils/iconMapping';
import {
  Search,
  Wand2,
  Clock
} from 'lucide-react';

interface CommandPaletteProps {
  onPromptSelect: (prompt: string) => void;
}



const recentActions = [
  { name: 'Fix Grammar & Spelling', icon: '✓', category: 'writing' },
  { name: 'Write a creative story about myself', icon: '📝', category: 'creative' },
  { name: 'Improve Writing', icon: '✨', category: 'writing' },
  { name: 'Make Longer', icon: '📏', category: 'text' },
  { name: 'Summarize', icon: '📋', category: 'text' }
];

export function CommandPalette({ onPromptSelect }: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [prompts, setPrompts] = useState<Prompt[]>([]);

  useEffect(() => {
    const allPrompts = promptsService.getAllPrompts();
    setPrompts(allPrompts);
  }, []);

  const filteredPrompts = prompts.filter(prompt => {
    const matchesSearch = searchQuery === '' ||
      prompt.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prompt.description.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
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
    <div className="flex flex-col h-full min-h-0">
      {/* Search Bar */}
      <div className="relative flex-shrink-0 p-4 pb-2">
        <Search className="absolute left-7 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search actions..."
          className="pl-10 text-base"
        />
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0 hide-scrollbar px-4">
        <div className="space-y-4 pb-4">
          {/* Recent Actions (shown when no search) */}
          {searchQuery === '' && (
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
                    className="justify-start h-auto p-3 text-left min-h-[3rem]"
                    onClick={() => {
                      // Find the corresponding prompt
                      const prompt = prompts.find(p => p.name === action.name);
                      if (prompt) {
                        handlePromptClick(prompt);
                      }
                    }}
                  >
                    <div className="flex items-center gap-3 w-full min-w-0">
                      <div className="flex-shrink-0">{renderIcon(action.icon, "h-5 w-5")}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{action.name}</div>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Actions Grid */}
          <div className="space-y-2">
            {filteredPrompts.map((prompt) => (
              <Button
                key={prompt.id}
                variant="ghost"
                className="justify-start h-auto p-3 text-left hover:bg-accent min-h-[4rem] w-full"
                onClick={() => handlePromptClick(prompt)}
              >
                <div className="flex items-center gap-3 w-full min-w-0">
                  <div className="flex-shrink-0">{renderIcon(prompt.icon, "h-5 w-5")}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{prompt.name}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {prompt.description}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {prompt.prompt.includes('{content}') && (
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        {renderIcon('📋', "h-3 w-3")}
                      </Badge>
                    )}
                  </div>
                </div>
              </Button>
            ))}

            {filteredPrompts.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                <Wand2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-base">No actions found</p>
                <p className="text-sm">Try adjusting your search</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
