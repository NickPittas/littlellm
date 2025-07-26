'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Wand2, Plus, Edit, Trash2, Download, Upload } from 'lucide-react';
import { promptsService, type Prompt } from '../services/promptsService';

import { renderIcon } from '../utils/iconMapping';

interface PromptsSelectorProps {
  onPromptSelect: (processedPrompt: string) => void;
  clipboardContent?: string;
}

export function PromptsSelector({ onPromptSelect, clipboardContent = '' }: PromptsSelectorProps) {
  const [showDialog, setShowDialog] = useState(false);
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
        console.error('Failed to read clipboard:', error);
        // Continue without clipboard content
      }
    }

    if (currentClipboardContent) {
      // Use the service to process placeholders
      processedPrompt = promptsService.processPrompt(prompt.id, currentClipboardContent);

      // If clipboard content exists and prompt doesn't already include it, append it
      if (!processedPrompt.includes(currentClipboardContent)) {
        processedPrompt = `${processedPrompt}\n\n--- Clipboard Content ---\n${currentClipboardContent}`;
      }
    } else {
      // If no clipboard content, show a helpful message
      if (processedPrompt.includes('{content}')) {
        processedPrompt = processedPrompt.replace('{content}', '[No clipboard content available - please copy some text first]');
      }
    }

    setIsReadingClipboard(false);
    onPromptSelect(processedPrompt);
    setShowDialog(false);
  };

  const handleAddPrompt = () => {
    if (newPrompt.name && newPrompt.description && newPrompt.prompt) {
      promptsService.addCustomPrompt(newPrompt);
      setNewPrompt({
        name: '',
        description: '',
        prompt: '',
        category: 'text',
        icon: '📝'
      });
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
  };

  const handleUpdatePrompt = () => {
    if (editingPrompt && newPrompt.name && newPrompt.description && newPrompt.prompt) {
      promptsService.updateCustomPrompt(editingPrompt.id, newPrompt);
      setEditingPrompt(null);
      setNewPrompt({
        name: '',
        description: '',
        prompt: '',
        category: 'text',
        icon: '📝'
      });
    }
  };

  const handleDeletePrompt = (promptId: string) => {
    if (promptsService.isCustomPrompt(promptId)) {
      promptsService.deleteCustomPrompt(promptId);
    }
  };

  const handleExportPrompts = () => {
    const data = promptsService.exportPrompts();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'custom-prompts.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportPrompts = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const content = e.target?.result as string;
        try {
          const success = await promptsService.importPrompts(content);
          if (success) {
            alert('Prompts imported successfully!');
          } else {
            alert('Failed to import prompts. Please check the file format.');
          }
        } catch (error) {
          console.error('Failed to import prompts:', error);
          alert('Failed to import prompts. Please check the file format.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        title="Use pre-made prompt"
        onClick={() => {
          console.log('Button clicked, setting showDialog to true');
          setShowDialog(true);
        }}
      >
        <Wand2 className="h-4 w-4" />
      </Button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent
          className="max-w-4xl max-h-[80vh] overflow-hidden"
          style={{
            backgroundColor: 'hsl(var(--background))',
            color: 'hsl(var(--foreground))',
            border: 'none'
          }}
        >
          <DialogHeader>
            <DialogTitle>{`Select a Prompt Template${isReadingClipboard ? ' (Reading clipboard...)' : ''}`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4" style={{ color: 'hsl(var(--foreground))' }}>
            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <Label>Category:</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category.charAt(0).toUpperCase() + category.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="ml-auto flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddPrompt(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPrompts}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Export
                </Button>
                <label>
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-1" />
                      Import
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportPrompts}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            {/* Prompts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
              {filteredPrompts.map((prompt) => (
                <div
                  key={prompt.id}
                  className={`p-3 rounded-lg border hover:bg-muted/50 cursor-pointer group ${isReadingClipboard ? 'opacity-50 pointer-events-none' : ''}`}
                  style={{
                    backgroundColor: 'transparent',
                    color: 'hsl(var(--foreground))',
                    borderColor: 'hsl(var(--border))'
                  }}
                  onClick={() => handlePromptSelect(prompt)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {renderIcon(prompt.icon, "h-5 w-5")}
                        <h3 className="font-medium text-sm" style={{ color: 'hsl(var(--foreground))' }}>{prompt.name}</h3>
                        {prompt.prompt.includes('{content}') && (
                          <span className="text-xs bg-primary/20 text-primary px-1 py-0.5 rounded flex items-center gap-1" title="Uses clipboard content">
                            {renderIcon('📋', "h-3 w-3")}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2" style={{ color: 'hsl(var(--muted-foreground))' }}>{prompt.description}</p>
                      <div className="text-xs text-muted-foreground bg-muted p-2 rounded" style={{ color: 'hsl(var(--muted-foreground))', backgroundColor: 'hsl(var(--muted))' }}>
                        {prompt.prompt.length > 100
                          ? `${prompt.prompt.substring(0, 100)}...`
                          : prompt.prompt}
                      </div>
                    </div>

                    {promptsService.isCustomPrompt(prompt.id) && (
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditPrompt(prompt);
                          }}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePrompt(prompt.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Prompt Dialog - Separate dialog, not nested */}
      <Dialog open={showAddPrompt || !!editingPrompt} onOpenChange={(open) => {
        if (!open) {
          setShowAddPrompt(false);
          setEditingPrompt(null);
          setNewPrompt({
            name: '',
            description: '',
            prompt: '',
            category: 'text',
            icon: '📝'
          });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPrompt ? 'Edit Prompt' : 'Add New Prompt'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
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
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="code">Code</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="icon">Icon (emoji)</Label>
              <Input
                id="icon"
                value={newPrompt.icon}
                onChange={(e) => setNewPrompt(prev => ({ ...prev, icon: e.target.value }))}
                placeholder="✏️"
                maxLength={2}
              />
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
        </DialogContent>
      </Dialog>
    </>
  );
}
