'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Edit, Trash2, Download, Upload } from 'lucide-react';
import { promptsService, type Prompt } from '../services/promptsService';


interface PromptsContentProps {
  onPromptSelect: (processedPrompt: string) => void;
  clipboardContent?: string;
}

export function PromptsContent({ onPromptSelect, clipboardContent = '' }: PromptsContentProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [isReadingClipboard, setIsReadingClipboard] = useState(false);
  const [newPrompt, setNewPrompt] = useState({
    name: '',
    description: '',
    prompt: '',
    category: 'text',
    icon: '✏️'
  });

  const allPrompts = promptsService.getAllPrompts();
  const categories = promptsService.getCategories().filter(category => category && typeof category === 'string');
  const filteredPrompts = selectedCategory === 'all' 
    ? allPrompts 
    : promptsService.getPromptsByCategory(selectedCategory);

  const handlePromptSelect = async (prompt: Prompt) => {
    setIsReadingClipboard(true);
    let processedPrompt = prompt.prompt;
    let currentClipboardContent = clipboardContent;

    // If no clipboard content is available, try to read it now
    if (!currentClipboardContent) {
      try {
        if (typeof window !== 'undefined' && window.electronAPI) {
          currentClipboardContent = (await window.electronAPI.readClipboard()).trim();
        } else if (navigator.clipboard) {
          currentClipboardContent = (await navigator.clipboard.readText()).trim();
        }
      } catch (error) {
        console.warn('Failed to read clipboard:', error);
        currentClipboardContent = '';
      }
    }

    // Replace {content} placeholder with clipboard content
    if (processedPrompt.includes('{content}')) {
      if (currentClipboardContent) {
        processedPrompt = processedPrompt.replace(/{content}/g, currentClipboardContent);
      } else {
        processedPrompt = processedPrompt.replace(/{content}/g, '[No clipboard content available]');
      }
    }

    setIsReadingClipboard(false);
    onPromptSelect(processedPrompt);
  };

  const handleAddPrompt = () => {
    if (newPrompt.name && newPrompt.prompt) {
      promptsService.addCustomPrompt({
        name: newPrompt.name,
        description: newPrompt.description,
        prompt: newPrompt.prompt,
        category: newPrompt.category,
        icon: newPrompt.icon
      });
      setNewPrompt({ name: '', description: '', prompt: '', category: 'text', icon: '✏️' });
      setShowAddPrompt(false);
    }
  };

  const handleUpdatePrompt = () => {
    if (editingPrompt && newPrompt.name && newPrompt.prompt) {
      if (promptsService.isCustomPrompt(editingPrompt.id)) {
        // Update existing custom prompt
        promptsService.updateCustomPrompt(editingPrompt.id, {
          name: newPrompt.name,
          description: newPrompt.description,
          prompt: newPrompt.prompt,
          category: newPrompt.category,
          icon: newPrompt.icon
        });
      } else {
        // Convert built-in prompt to custom prompt by creating a new one
        promptsService.addCustomPrompt({
          name: newPrompt.name,
          description: newPrompt.description,
          prompt: newPrompt.prompt,
          category: newPrompt.category,
          icon: newPrompt.icon
        });
      }
      setEditingPrompt(null);
      setNewPrompt({ name: '', description: '', prompt: '', category: 'text', icon: '✏️' });
      setShowAddPrompt(false);
    }
  };

  const handleEditPrompt = (prompt: Prompt) => {
    setEditingPrompt(prompt);
    setNewPrompt({
      name: prompt.name,
      description: prompt.description,
      prompt: prompt.prompt,
      category: prompt.category,
      icon: prompt.icon
    });
    setShowAddPrompt(true);
  };

  const handleDeletePrompt = (promptId: string) => {
    promptsService.deleteCustomPrompt(promptId);
  };

  const handleExportPrompts = () => {
    const customPrompts = promptsService.getCustomPrompts();
    const dataStr = JSON.stringify(customPrompts, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'custom-prompts.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPrompts = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const prompts = JSON.parse(e.target?.result as string);
            if (Array.isArray(prompts)) {
              prompts.forEach(prompt => {
                if (prompt.name && prompt.prompt) {
                  promptsService.addCustomPrompt(prompt);
                }
              });
            }
          } catch (error) {
            console.error('Failed to import prompts:', error);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  return (
    <div className="space-y-4">
      {/* Category Filter */}
      <div className="flex items-center gap-4">
        <Label>Category:</Label>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="flex gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddPrompt(true)}
            className="bg-blue-600/20 border-blue-400/50 text-blue-300 hover:bg-blue-600/30 hover:border-blue-400/70"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Custom Prompt
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPrompts}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportPrompts}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
        </div>
      </div>

      {/* Add/Edit Prompt Form */}
      {showAddPrompt && (
        <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
          <h3 className="font-semibold">
            {editingPrompt
              ? (promptsService.isCustomPrompt(editingPrompt.id)
                  ? 'Edit Custom Prompt'
                  : 'Edit Built-in Prompt (will create custom copy)')
              : 'Add New Custom Prompt'
            }
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newPrompt.name}
                onChange={(e) => setNewPrompt(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Prompt name"
                className="bg-muted border-2 border-border focus:bg-card hover:bg-muted/80 focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
              />
            </div>
            <div>
              <Label htmlFor="icon">Icon</Label>
              <Input
                id="icon"
                value={newPrompt.icon}
                onChange={(e) => setNewPrompt(prev => ({ ...prev, icon: e.target.value }))}
                placeholder="📝"
                className="bg-muted border-2 border-border focus:bg-card hover:bg-muted/80 focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              value={newPrompt.description}
              onChange={(e) => setNewPrompt(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description"
              className="bg-slate-900 border-2 border-slate-600 focus:bg-slate-800 hover:bg-slate-850 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={newPrompt.category}
              onValueChange={(value) => setNewPrompt(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger className="bg-slate-900 border-2 border-slate-600 focus:bg-slate-800 hover:bg-slate-850 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="prompt">Prompt Template</Label>
            <Textarea
              id="prompt"
              value={newPrompt.prompt}
              onChange={(e) => setNewPrompt(prev => ({ ...prev, prompt: e.target.value }))}
              placeholder="Your prompt template. Use {content} where the clipboard content should be inserted."
              rows={4}
              className="bg-muted border-2 border-border focus:bg-card hover:bg-muted/80 focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddPrompt(false);
                setEditingPrompt(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={editingPrompt ? handleUpdatePrompt : handleAddPrompt}
            >
              {editingPrompt
                ? (promptsService.isCustomPrompt(editingPrompt.id)
                    ? 'Update Prompt'
                    : 'Save as Custom Prompt')
                : 'Add Prompt'
              }
            </Button>
          </div>
        </div>
      )}

      {/* Prompts List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredPrompts.map((prompt) => (
          <div
            key={prompt.id}
            className="group flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
            style={{ border: '1px solid var(--border)' }}
            onClick={() => handlePromptSelect(prompt)}
          >
            <div className="flex items-center gap-3 flex-1">
              <span className="text-lg">{prompt.icon}</span>
              <div className="flex-1">
                <div className="font-medium">{prompt.name}</div>
                <div className="text-sm text-muted-foreground">{prompt.description}</div>
              </div>
            </div>
            {/* Always show edit button for ALL prompts, delete only for custom prompts */}
            <div className="flex gap-1 items-center">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditPrompt(prompt);
                }}
                className="text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 border border-blue-400/30 opacity-80 hover:opacity-100"
                title="Edit prompt"
              >
                <Edit className="h-4 w-4" />
              </Button>

              {/* Only show delete button for custom prompts */}
              {promptsService.isCustomPrompt(prompt.id) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePrompt(prompt.id);
                  }}
                  className="text-red-400 hover:text-red-300 hover:bg-red-400/10 border border-red-400/30 opacity-80 hover:opacity-100"
                  title="Delete prompt"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}

              {/* Show indicator for custom prompts */}
              {promptsService.isCustomPrompt(prompt.id) && (
                <div className="text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded border border-green-400/30 ml-1">
                  CUSTOM
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isReadingClipboard && (
        <div className="text-center text-sm text-muted-foreground">
          Reading clipboard...
        </div>
      )}
    </div>
  );
}
