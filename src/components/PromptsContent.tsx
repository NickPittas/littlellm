'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Plus, Edit, Trash2, Download, Upload } from 'lucide-react';
import { promptsService, type Prompt } from '../services/promptsService';
import { renderIcon } from '../utils/iconMapping';

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
  const categories = promptsService.getCategories();
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
      promptsService.updateCustomPrompt(editingPrompt.id, {
        name: newPrompt.name,
        description: newPrompt.description,
        prompt: newPrompt.prompt,
        category: newPrompt.category,
        icon: newPrompt.icon
      });
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
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Prompt
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
            {editingPrompt ? 'Edit Prompt' : 'Add New Prompt'}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newPrompt.name}
                onChange={(e) => setNewPrompt(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Prompt name"
              />
            </div>
            <div>
              <Label htmlFor="icon">Icon</Label>
              <Input
                id="icon"
                value={newPrompt.icon}
                onChange={(e) => setNewPrompt(prev => ({ ...prev, icon: e.target.value }))}
                placeholder="📝"
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
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              value={newPrompt.category}
              onValueChange={(value) => setNewPrompt(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
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
              {editingPrompt ? 'Update' : 'Add'} Prompt
            </Button>
          </div>
        </div>
      )}

      {/* Prompts List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {filteredPrompts.map((prompt) => (
          <div
            key={prompt.id}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
            onClick={() => handlePromptSelect(prompt)}
          >
            <div className="flex items-center gap-3 flex-1">
              <span className="text-lg">{prompt.icon}</span>
              <div className="flex-1">
                <div className="font-medium">{prompt.name}</div>
                <div className="text-sm text-muted-foreground">{prompt.description}</div>
              </div>
            </div>
            {promptsService.isCustomPrompt(prompt.id) && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditPrompt(prompt);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePrompt(prompt.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
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
