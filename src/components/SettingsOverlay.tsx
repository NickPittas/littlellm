'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Badge } from './ui/badge';
import {
  Settings,
  Key,
  Keyboard,
  Wand2,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  Save,
  X,
  Palette,
  Cog
} from 'lucide-react';
import { settingsService, type AppSettings } from '../services/settingsService';
import { promptsService, type Prompt } from '../services/promptsService';
import { useTheme } from '../contexts/ThemeContext';

export function SettingsOverlay() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [customPrompts, setCustomPrompts] = useState<Prompt[]>([]);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [showAddPrompt, setShowAddPrompt] = useState(false);
  const [newPrompt, setNewPrompt] = useState({
    name: '',
    description: '',
    prompt: '',
    category: 'text',
    icon: '📝'
  });
  const { theme, setTheme, themes } = useTheme();

  // Load settings and prompts
  useEffect(() => {
    loadSettings();
    loadCustomPrompts();
  }, []);

  const loadSettings = async () => {
    try {
      const appSettings = await settingsService.getSettings();
      setSettings(appSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadCustomPrompts = () => {
    const allPrompts = promptsService.getAllPrompts();
    setCustomPrompts(allPrompts); // Show all prompts, not just custom ones
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    try {
      await settingsService.updateSettings(settings);

      // Force theme update in main window by triggering a settings change event
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.notifyThemeChange) {
        window.electronAPI.notifyThemeChange(theme.id);
      }

      handleClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleClose = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.closeSettingsOverlay();
    }
  };

  // Prompt management functions
  const handleAddPrompt = () => {
    if (newPrompt.name && newPrompt.prompt) {
      const prompt: Prompt = {
        id: `custom-${Date.now()}`,
        name: newPrompt.name,
        description: newPrompt.description,
        prompt: newPrompt.prompt,
        category: newPrompt.category,
        icon: newPrompt.icon
      };

      promptsService.addCustomPrompt(prompt);
      loadCustomPrompts();
      setNewPrompt({ name: '', description: '', prompt: '', category: 'text', icon: '📝' });
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

  const handleUpdatePrompt = () => {
    if (editingPrompt && newPrompt.name && newPrompt.prompt) {
      const updates = {
        name: newPrompt.name,
        description: newPrompt.description,
        prompt: newPrompt.prompt,
        category: newPrompt.category,
        icon: newPrompt.icon
      };

      promptsService.updateCustomPrompt(editingPrompt.id, updates);
      loadCustomPrompts();
      setEditingPrompt(null);
      setNewPrompt({ name: '', description: '', prompt: '', category: 'text', icon: '📝' });
      setShowAddPrompt(false);
    }
  };

  const handleDeletePrompt = (promptId: string) => {
    promptsService.deleteCustomPrompt(promptId);
    loadCustomPrompts();
  };

  const handleExportPrompts = () => {
    try {
      const exported = promptsService.exportPrompts();
      const blob = new Blob([exported], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'prompts.json';
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export prompts:', error);
    }
  };

  const handleImportPrompts = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        try {
          const text = await file.text();
          await promptsService.importPrompts(text);
          loadCustomPrompts();
        } catch (error) {
          console.error('Failed to import prompts:', error);
        }
      }
    };
    input.click();
  };

  return (
    <div className="h-full w-full bg-background border border-border rounded-lg shadow-2xl flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Settings</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClose}
          className="h-8 w-8 p-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar p-6">
        {!settings ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p>Loading settings...</p>
          </div>
        ) : (
          <Tabs defaultValue="api-keys" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="api-keys">API Keys</TabsTrigger>
              <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
              <TabsTrigger value="prompts">Prompts</TabsTrigger>
              <TabsTrigger value="appearance">Appearance</TabsTrigger>
              <TabsTrigger value="general">General</TabsTrigger>
            </TabsList>

            {/* API Keys Tab */}
            <TabsContent value="api-keys" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Key className="h-4 w-4" />
                  <h3 className="text-lg font-medium">API Configuration</h3>
                </div>

                {/* OpenAI */}
                <div className="space-y-2">
                  <Label htmlFor="openai-key">OpenAI API Key</Label>
                  <Input
                    id="openai-key"
                    type="password"
                    value={settings.chat.providers.openai.apiKey}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: {
                        ...settings.chat,
                        providers: {
                          ...settings.chat.providers,
                          openai: { ...settings.chat.providers.openai, apiKey: e.target.value }
                        }
                      }
                    })}
                    placeholder="sk-..."
                  />
                </div>

                {/* OpenRouter */}
                <div className="space-y-2">
                  <Label htmlFor="openrouter-key">OpenRouter API Key</Label>
                  <Input
                    id="openrouter-key"
                    type="password"
                    value={settings.chat.providers.openrouter.apiKey}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: {
                        ...settings.chat,
                        providers: {
                          ...settings.chat.providers,
                          openrouter: { ...settings.chat.providers.openrouter, apiKey: e.target.value }
                        }
                      }
                    })}
                    placeholder="sk-or-..."
                  />
                </div>

                {/* Requesty */}
                <div className="space-y-2">
                  <Label htmlFor="requesty-key">Requesty API Key</Label>
                  <Input
                    id="requesty-key"
                    type="password"
                    value={settings.chat.providers.requesty.apiKey}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: {
                        ...settings.chat,
                        providers: {
                          ...settings.chat.providers,
                          requesty: { ...settings.chat.providers.requesty, apiKey: e.target.value }
                        }
                      }
                    })}
                    placeholder="req-..."
                  />
                </div>

                {/* Replicate */}
                <div className="space-y-2">
                  <Label htmlFor="replicate-key">Replicate API Key</Label>
                  <Input
                    id="replicate-key"
                    type="password"
                    value={settings.chat.providers.replicate.apiKey}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: {
                        ...settings.chat,
                        providers: {
                          ...settings.chat.providers,
                          replicate: { ...settings.chat.providers.replicate, apiKey: e.target.value }
                        }
                      }
                    })}
                    placeholder="r8_..."
                  />
                </div>

                {/* Ollama */}
                <div className="space-y-2">
                  <Label htmlFor="ollama-url">Ollama Base URL</Label>
                  <Input
                    id="ollama-url"
                    value={settings.chat.providers.ollama.baseUrl || 'http://localhost:11434'}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: {
                        ...settings.chat,
                        providers: {
                          ...settings.chat.providers,
                          ollama: { ...settings.chat.providers.ollama, baseUrl: e.target.value }
                        }
                      }
                    })}
                    placeholder="http://localhost:11434"
                  />
                </div>

                {/* Default Model */}
                <div className="space-y-2">
                  <Label htmlFor="default-model">Default Model</Label>
                  <Select
                    value={settings.chat.model}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      chat: { ...settings.chat, model: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                      <SelectItem value="mistralai/mistral-7b-instruct:free">Mistral 7B (Free)</SelectItem>
                      <SelectItem value="anthropic/claude-3-sonnet">Claude 3 Sonnet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* System Prompt */}
                <div className="space-y-2">
                  <Label htmlFor="system-prompt">System Prompt</Label>
                  <Textarea
                    id="system-prompt"
                    value={settings.chat.systemPrompt}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: { ...settings.chat, systemPrompt: e.target.value }
                    })}
                    placeholder="You are a helpful AI assistant..."
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>

            {/* Shortcuts Tab */}
            <TabsContent value="shortcuts" className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Keyboard className="h-4 w-4" />
                  <h3 className="text-lg font-medium">Keyboard Shortcuts</h3>
                </div>

                <div className="space-y-2">
                  <Label>Toggle Window</Label>
                  <Input
                    value={settings.shortcuts.toggleWindow}
                    onChange={(e) => setSettings({
                      ...settings,
                      shortcuts: { ...settings.shortcuts, toggleWindow: e.target.value }
                    })}
                    placeholder="CommandOrControl+\\"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Process Clipboard</Label>
                  <Input
                    value={settings.shortcuts.processClipboard}
                    onChange={(e) => setSettings({
                      ...settings,
                      shortcuts: { ...settings.shortcuts, processClipboard: e.target.value }
                    })}
                    placeholder="CommandOrControl+Shift+V"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="action-menu-shortcut">Action Menu</Label>
                  <Input
                    id="action-menu-shortcut"
                    value={settings.shortcuts.actionMenu}
                    onChange={(e) => setSettings({
                      ...settings,
                      shortcuts: { ...settings.shortcuts, actionMenu: e.target.value }
                    })}
                    placeholder="CommandOrControl+Shift+Space"
                  />
                  <p className="text-xs text-muted-foreground">
                    Shortcut to open the action menu in chat mode
                  </p>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>Use modifiers: CommandOrControl, Alt, Shift</p>
                  <p>Examples: CommandOrControl+K, Alt+Space, Shift+F1</p>
                </div>
              </div>
            </TabsContent>

            {/* Appearance Tab */}
            <TabsContent value="appearance" className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="h-4 w-4" />
                  <h3 className="text-lg font-medium">Appearance</h3>
                </div>

                <div className="space-y-2">
                  <Label>Theme</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-64 overflow-y-auto hide-scrollbar">
                    {themes.map((themeOption) => (
                      <div
                        key={themeOption.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                          theme.id === themeOption.id
                            ? 'border-primary bg-primary/5 shadow-md'
                            : 'border-border hover:border-primary/50'
                        }`}
                        onClick={() => {
                        setTheme(themeOption);
                        // Notify main window about theme change
                        if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.notifyThemeChange) {
                          window.electronAPI.notifyThemeChange(themeOption.id);
                        }
                      }}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className="text-lg">
                            {typeof themeOption.icon === 'string' ? (
                              themeOption.icon
                            ) : (
                              <themeOption.icon className="w-4 h-4" />
                            )}
                          </div>
                          <div className="text-xs font-medium text-center">{themeOption.name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Window Opacity</Label>
                  <Input
                    type="number"
                    min="0.5"
                    max="1"
                    step="0.05"
                    value={settings.ui.opacity || 1}
                    onChange={(e) => setSettings({
                      ...settings,
                      ui: { ...settings.ui, opacity: parseFloat(e.target.value) }
                    })}
                  />
                  <p className="text-sm text-muted-foreground">
                    Adjust window transparency (0.5 = 50% transparent, 1 = fully opaque)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Font Size</Label>
                  <Select
                    value={settings.ui.fontSize || 'medium'}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      ui: { ...settings.ui, fontSize: value as 'small' | 'medium' | 'large' }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="large">Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Always on Top</Label>
                  <Select
                    value={settings.ui.alwaysOnTop ? 'true' : 'false'}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      ui: { ...settings.ui, alwaysOnTop: value === 'true' }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* General Tab */}
            <TabsContent value="general" className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Cog className="h-4 w-4" />
                  <h3 className="text-lg font-medium">General Settings</h3>
                </div>

                <div className="space-y-2">
                  <Label>Temperature</Label>
                  <Input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.chat.temperature}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: { ...settings.chat, temperature: parseFloat(e.target.value) }
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Controls randomness in responses (0 = deterministic, 2 = very creative)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    min="1"
                    max="32000"
                    value={settings.chat.maxTokens}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: { ...settings.chat, maxTokens: parseInt(e.target.value) }
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum number of tokens in the response
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Auto Start with System</Label>
                  <Select
                    value={settings.general.autoStartWithSystem ? 'true' : 'false'}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      general: { ...settings.general, autoStartWithSystem: value === 'true' }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Show Notifications</Label>
                  <Select
                    value={settings.general.showNotifications ? 'true' : 'false'}
                    onValueChange={(value) => setSettings({
                      ...settings,
                      general: { ...settings.general, showNotifications: value === 'true' }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Yes</SelectItem>
                      <SelectItem value="false">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            {/* Prompts Tab */}
            <TabsContent value="prompts" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-4 w-4" />
                    <h3 className="text-lg font-medium">Custom Prompts</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleImportPrompts}>
                      <Upload className="h-4 w-4 mr-2" />
                      Import
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPrompts}>
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                    <Button size="sm" onClick={() => setShowAddPrompt(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Prompt
                    </Button>
                  </div>
                </div>

                {/* All Prompts List */}
                <div className="space-y-2 max-h-64 overflow-y-auto hide-scrollbar">
                  {customPrompts.map((prompt) => {
                    const isCustom = promptsService.isCustomPrompt(prompt.id);
                    return (
                      <div key={prompt.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3 flex-1">
                          <span className="text-lg">{prompt.icon}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-medium">{prompt.name}</h4>
                              {!isCustom && (
                                <Badge variant="outline" className="text-xs">
                                  Built-in
                                </Badge>
                              )}
                              {isCustom && (
                                <Badge variant="secondary" className="text-xs">
                                  Custom
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">{prompt.description}</p>
                            <Badge variant="secondary" className="text-xs mt-1">
                              {prompt.category}
                            </Badge>
                            <div className="text-xs text-muted-foreground mt-1 bg-muted p-2 rounded max-h-16 overflow-y-auto">
                              {prompt.prompt.length > 150
                                ? `${prompt.prompt.substring(0, 150)}...`
                                : prompt.prompt}
                            </div>
                          </div>
                        </div>
                        {isCustom && (
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditPrompt(prompt)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePrompt(prompt.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add/Edit Prompt Dialog */}
                {showAddPrompt && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-background border rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                      <h3 className="text-lg font-medium mb-4">
                        {editingPrompt ? 'Edit Prompt' : 'Add New Prompt'}
                      </h3>

                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="prompt-name">Name</Label>
                            <Input
                              id="prompt-name"
                              value={newPrompt.name}
                              onChange={(e) => setNewPrompt({ ...newPrompt, name: e.target.value })}
                              placeholder="Prompt name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="prompt-icon">Icon</Label>
                            <Input
                              id="prompt-icon"
                              value={newPrompt.icon}
                              onChange={(e) => setNewPrompt({ ...newPrompt, icon: e.target.value })}
                              placeholder="📝"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="prompt-description">Description</Label>
                          <Input
                            id="prompt-description"
                            value={newPrompt.description}
                            onChange={(e) => setNewPrompt({ ...newPrompt, description: e.target.value })}
                            placeholder="Brief description of what this prompt does"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="prompt-category">Category</Label>
                          <Select
                            value={newPrompt.category}
                            onValueChange={(value) => setNewPrompt({ ...newPrompt, category: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text</SelectItem>
                              <SelectItem value="code">Code</SelectItem>
                              <SelectItem value="creative">Creative</SelectItem>
                              <SelectItem value="analysis">Analysis</SelectItem>
                              <SelectItem value="productivity">Productivity</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="prompt-content">Prompt Content</Label>
                          <Textarea
                            id="prompt-content"
                            value={newPrompt.prompt}
                            onChange={(e) => setNewPrompt({ ...newPrompt, prompt: e.target.value })}
                            placeholder="Enter your prompt here. Use {content} as a placeholder for clipboard content."
                            rows={6}
                          />
                          <p className="text-xs text-muted-foreground">
                            Tip: Use {'{content}'} as a placeholder that will be replaced with clipboard content when the prompt is used.
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 mt-6">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowAddPrompt(false);
                            setEditingPrompt(null);
                            setNewPrompt({ name: '', description: '', prompt: '', category: 'text', icon: '📝' });
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={editingPrompt ? handleUpdatePrompt : handleAddPrompt}
                          disabled={!newPrompt.name || !newPrompt.prompt}
                        >
                          {editingPrompt ? 'Update' : 'Add'} Prompt
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Save Button */}
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSaveSettings}>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </Button>
            </div>
          </Tabs>
        )}
      </div>
    </div>
  );
}
