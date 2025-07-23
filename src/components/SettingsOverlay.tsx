'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ToggleSwitch } from './ui/toggle-switch';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { settingsService, type AppSettings } from '../services/settingsService';
import { MemoryManagement } from './MemoryManagement';
import KnowledgeBaseSettings from './KnowledgeBaseSettings';
import { mcpService, type MCPServer } from '../services/mcpService';
import { PromptsContent } from './PromptsContent';
import { Plus, Trash2, Server, Zap, Edit, FileText, Palette, RotateCcw } from 'lucide-react';
import { ColorPicker } from './ui/color-picker';
import { ThemeSelector } from './ui/theme-selector';
import { useTheme } from '../contexts/ThemeContext';

export function SettingsOverlay() {
  const [activeTab, setActiveTab] = useState('api-keys');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [formData, setFormData] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const {
    customColors,
    setCustomColors,
    useCustomColors,
    setUseCustomColors,
    resetToDefaults,
    selectedThemePreset,
    setSelectedThemePreset,
    colorMode,
    setColorMode,
    themePresets
  } = useTheme();
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [showAddMcpServer, setShowAddMcpServer] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState<MCPServer | null>(null);
  const [showMcpJsonEditor, setShowMcpJsonEditor] = useState(false);
  const [mcpJsonContent, setMcpJsonContent] = useState('');
  const [newMcpServer, setNewMcpServer] = useState({
    name: '',
    command: '',
    args: [] as string[],
    description: '',
    enabled: true,
    env: {} as Record<string, string>
  });

  const handleClose = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.closeSettingsOverlay();
    }
  };

  const handleTitleBarMouseDown = () => {
    // Enable window dragging via CSS
    // The title bar will use -webkit-app-region: drag
  };

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      let loadedSettings: AppSettings;
      if (typeof window !== 'undefined' && window.electronAPI) {
        const electronSettings = await window.electronAPI.getAppSettings();
        loadedSettings = electronSettings as AppSettings;
      } else {
        loadedSettings = settingsService.getSettings();
      }
      setSettings(loadedSettings);
      setFormData(JSON.parse(JSON.stringify(loadedSettings))); // Deep copy
      setHasChanges(false);

      // Load MCP servers
      await loadMcpServers();
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadMcpServers = async () => {
    try {
      const servers = await mcpService.getServers();
      setMcpServers(servers);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    }
  };

  const handleAddMcpServer = async () => {
    try {
      const server = await mcpService.addServer({
        name: newMcpServer.name,
        command: newMcpServer.command,
        args: newMcpServer.args,
        description: newMcpServer.description,
        enabled: newMcpServer.enabled,
        env: newMcpServer.env
      });
      setMcpServers(prev => [...prev, server]);
      setNewMcpServer({
        name: '',
        command: '',
        args: [],
        description: '',
        enabled: true,
        env: {}
      });
      setShowAddMcpServer(false);
    } catch (error) {
      console.error('Failed to add MCP server:', error);
    }
  };

  const handleRemoveMcpServer = async (serverId: string) => {
    try {
      const success = await mcpService.removeServer(serverId);
      if (success) {
        setMcpServers(prev => prev.filter(s => s.id !== serverId));
      }
    } catch (error) {
      console.error('Failed to remove MCP server:', error);
    }
  };

  const handleToggleMcpServer = async (serverId: string, enabled: boolean) => {
    try {
      const success = await mcpService.updateServer(serverId, { enabled });
      if (success) {
        setMcpServers(prev => prev.map(s =>
          s.id === serverId ? { ...s, enabled } : s
        ));
      }
    } catch (error) {
      console.error('Failed to toggle MCP server:', error);
    }
  };

  const handleEditMcpServer = (server: MCPServer) => {
    setEditingMcpServer(server);
    setNewMcpServer({
      name: server.name,
      command: server.command,
      args: server.args || [],
      description: server.description || '',
      enabled: server.enabled,
      env: ('env' in server && typeof server.env === 'object' && server.env !== null) ? server.env as Record<string, string> : {}
    });
    setShowAddMcpServer(true);
  };

  const handleUpdateMcpServer = async () => {
    if (!editingMcpServer) return;

    try {
      const success = await mcpService.updateServer(editingMcpServer.id, {
        name: newMcpServer.name,
        command: newMcpServer.command,
        args: newMcpServer.args,
        description: newMcpServer.description,
        enabled: newMcpServer.enabled,
        env: newMcpServer.env
      });

      if (success) {
        setMcpServers(prev => prev.map(s =>
          s.id === editingMcpServer.id
            ? { ...s, ...newMcpServer }
            : s
        ));
        setEditingMcpServer(null);
        setNewMcpServer({
          name: '',
          command: '',
          args: [],
          description: '',
          enabled: true,
          env: {}
        });
        setShowAddMcpServer(false);
      }
    } catch (error) {
      console.error('Failed to update MCP server:', error);
    }
  };

  const handleOpenMcpJsonEditor = async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const mcpData = await window.electronAPI.getMCPServers();
        setMcpJsonContent(JSON.stringify(mcpData, null, 2));
        setShowMcpJsonEditor(true);
      }
    } catch (error) {
      console.error('Failed to load MCP JSON:', error);
    }
  };

  const handleSaveMcpJson = async () => {
    try {
      const parsedData = JSON.parse(mcpJsonContent);
      if (typeof window !== 'undefined' && window.electronAPI) {
        const success = await window.electronAPI.saveMCPServers(parsedData);
        if (success) {
          setShowMcpJsonEditor(false);
          await loadMcpServers(); // Reload the servers list
        }
      }
    } catch (error) {
      console.error('Failed to save MCP JSON:', error);
      alert('Invalid JSON format. Please check your syntax.');
    }
  };

  // Helper functions for managing arguments and environment variables
  const addArgument = () => {
    setNewMcpServer(prev => ({
      ...prev,
      args: [...prev.args, '']
    }));
  };

  const removeArgument = (index: number) => {
    setNewMcpServer(prev => ({
      ...prev,
      args: prev.args.filter((_, i) => i !== index)
    }));
  };

  const updateArgument = (index: number, value: string) => {
    setNewMcpServer(prev => ({
      ...prev,
      args: prev.args.map((arg, i) => i === index ? value : arg)
    }));
  };

  const addEnvVariable = () => {
    const key = `ENV_VAR_${Object.keys(newMcpServer.env).length + 1}`;
    setNewMcpServer(prev => ({
      ...prev,
      env: { ...prev.env, [key]: '' }
    }));
  };

  const removeEnvVariable = (key: string) => {
    setNewMcpServer(prev => {
      const newEnv = { ...prev.env };
      delete newEnv[key];
      return { ...prev, env: newEnv };
    });
  };

  const updateEnvVariable = (oldKey: string, newKey: string, value: string) => {
    setNewMcpServer(prev => {
      const newEnv = { ...prev.env };
      if (oldKey !== newKey) {
        delete newEnv[oldKey];
      }
      newEnv[newKey] = value;
      return { ...prev, env: newEnv };
    });
  };

  const handleSave = async () => {
    if (!formData) return;

    setIsLoading(true);
    try {
      const success = await settingsService.updateSettings(formData);
      if (success) {
        setSettings(formData);
        setHasChanges(false);

        // If any theme-related settings were changed, notify other windows
        if (formData.ui?.customColors ||
            formData.ui?.useCustomColors !== undefined ||
            formData.ui?.selectedThemePreset ||
            formData.ui?.colorMode) {
          console.log('Settings overlay: Preparing to notify theme change');
          console.log('formData.ui:', formData.ui);
          console.log('Current theme context:', { customColors, useCustomColors, selectedThemePreset, colorMode });

          if (typeof window !== 'undefined' && window.electronAPI) {
            // Determine the actual colors to apply based on the current mode
            let colorsToApply = customColors;
            const currentMode = formData.ui.colorMode || colorMode;
            const currentPreset = formData.ui.selectedThemePreset || selectedThemePreset;

            if (currentMode === 'preset') {
              // Use preset colors
              const preset = themePresets.find(p => p.id === currentPreset);
              if (preset) {
                colorsToApply = preset.colors;
                console.log('Settings overlay: Using preset colors for:', currentPreset);
              }
            } else {
              // Use custom colors
              colorsToApply = formData.ui.customColors || customColors;
              console.log('Settings overlay: Using custom colors');
            }

            const themeData = {
              customColors: colorsToApply,
              useCustomColors: currentMode === 'custom'
            };
            console.log('Settings overlay: Sending theme change notification:', themeData);
            window.electronAPI.notifyThemeChange(themeData);
          } else {
            console.error('Settings overlay: electronAPI not available');
          }
        } else {
          console.log('Settings overlay: No theme changes detected');
        }

        console.log('Settings saved successfully');
      } else {
        console.error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (settings) {
      setFormData(JSON.parse(JSON.stringify(settings))); // Reset to original
      setHasChanges(false);
    }
  };

  const handleReload = async () => {
    await loadSettings();
  };

  const updateFormData = (updates: Partial<AppSettings>) => {
    if (!formData) return;
    const newFormData = { ...formData, ...updates };
    setFormData(newFormData);
    setHasChanges(true);
  };

  // Handle color changes and integrate with save system
  const handleColorChange = (colors: any) => {
    // Update theme immediately for preview (don't save yet)
    if (typeof setCustomColors === 'function') {
      (setCustomColors as any)(colors, false);
    }

    // Update form data to trigger save system
    if (formData) {
      updateFormData({
        ui: {
          ...formData.ui,
          customColors: colors
        }
      });
    }
  };

  const handleUseCustomColorsChange = (enabled: boolean) => {
    // Update theme immediately for preview (don't save yet)
    if (typeof setUseCustomColors === 'function') {
      (setUseCustomColors as any)(enabled, false);
    }

    // Update form data to trigger save system
    if (formData) {
      updateFormData({
        ui: {
          ...formData.ui,
          useCustomColors: enabled
        }
      });
    }
  };

  const handleThemePresetChange = (theme: any) => {
    // Update theme immediately for preview (don't save yet)
    if (typeof setSelectedThemePreset === 'function') {
      (setSelectedThemePreset as any)(theme.id, false);
    }

    // Update form data to trigger save system
    if (formData) {
      updateFormData({
        ui: {
          ...formData.ui,
          selectedThemePreset: theme.id
        }
      });
    }
  };

  const handleColorModeChange = (mode: 'preset' | 'custom') => {
    // Update theme immediately for preview (don't save yet)
    if (typeof setColorMode === 'function') {
      (setColorMode as any)(mode, false);
    }

    // Update form data to trigger save system
    if (formData) {
      updateFormData({
        ui: {
          ...formData.ui,
          colorMode: mode
        }
      });
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  return (
    <div
      style={{ height: '100vh', width: '100vw' }}
      className="settings-overlay bg-background flex flex-col overflow-hidden"
    >
      {/* Custom Title Bar */}
      <div
        className="h-10 w-full bg-background/95 backdrop-blur-sm border-b border-border/30 flex items-center justify-center relative flex-none select-none"
        style={{
          WebkitAppRegion: 'drag',
          borderRadius: '8px 8px 0 0'
        } as React.CSSProperties & { WebkitAppRegion?: string }}
        onMouseDown={handleTitleBarMouseDown}
      >
        <div
          className="absolute left-4 flex items-center gap-2"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
        >
          <div
            className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 cursor-pointer transition-colors"
            onClick={handleClose}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
          />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <div className="text-sm font-medium text-foreground">Settings</div>
      </div>

      {/* Settings Content */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* SIMPLE MANUAL TABS - NO RADIX */}
        <div className="flex-1 flex flex-col min-h-0 p-6">
          {/* Tab Navigation */}
          <div className="grid w-full grid-cols-9 bg-muted p-1 rounded-md flex-none mb-6">
            <button
              onClick={() => setActiveTab('api-keys')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'api-keys' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              API Keys
            </button>
            <button
              onClick={() => setActiveTab('shortcuts')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'shortcuts' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Shortcuts
            </button>
            <button
              onClick={() => setActiveTab('prompts')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'prompts' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Prompts
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'chat' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveTab('mcp')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'mcp' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              MCP
            </button>
            <button
              onClick={() => setActiveTab('memory')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'memory' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Memory
            </button>
            <button
              onClick={() => setActiveTab('knowledge-base')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'knowledge-base' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Knowledge Base
            </button>
            <button
              onClick={() => setActiveTab('appearance')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'appearance' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Appearance
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'general' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              General
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {activeTab === 'api-keys' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">API Configuration</h3>
                  <div className="space-y-4">
                    {formData?.chat?.providers && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="openai-key">OpenAI API Key</Label>
                          <Input
                            id="openai-key"
                            type="password"
                            value={formData.chat.providers.openai?.apiKey || ''}
                            placeholder="sk-..."
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              chat: {
                                ...formData.chat,
                                providers: {
                                  ...formData.chat.providers,
                                  openai: { ...formData.chat.providers.openai, apiKey: e.target.value }
                                }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                          <Input
                            id="anthropic-key"
                            type="password"
                            value={formData.chat.providers.anthropic?.apiKey || ''}
                            placeholder="sk-ant-..."
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              chat: {
                                ...formData.chat,
                                providers: {
                                  ...formData.chat.providers,
                                  anthropic: { ...formData.chat.providers.anthropic, apiKey: e.target.value }
                                }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="gemini-key">Google Gemini API Key</Label>
                          <Input
                            id="gemini-key"
                            type="password"
                            value={formData.chat.providers.gemini?.apiKey || ''}
                            placeholder="AI..."
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              chat: {
                                ...formData.chat,
                                providers: {
                                  ...formData.chat.providers,
                                  gemini: { ...formData.chat.providers.gemini, apiKey: e.target.value }
                                }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="mistral-key">Mistral AI API Key</Label>
                          <Input
                            id="mistral-key"
                            type="password"
                            value={formData.chat.providers.mistral?.apiKey || ''}
                            placeholder="API Key..."
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              chat: {
                                ...formData.chat,
                                providers: {
                                  ...formData.chat.providers,
                                  mistral: { ...formData.chat.providers.mistral, apiKey: e.target.value }
                                }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="deepseek-key">DeepSeek API Key</Label>
                          <Input
                            id="deepseek-key"
                            type="password"
                            value={formData.chat.providers.deepseek?.apiKey || ''}
                            placeholder="sk-..."
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              chat: {
                                ...formData.chat,
                                providers: {
                                  ...formData.chat.providers,
                                  deepseek: { ...formData.chat.providers.deepseek, apiKey: e.target.value }
                                }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="openrouter-key">OpenRouter API Key</Label>
                          <Input
                            id="openrouter-key"
                            type="password"
                            value={formData.chat.providers.openrouter?.apiKey || ''}
                            placeholder="sk-or-..."
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              chat: {
                                ...formData.chat,
                                providers: {
                                  ...formData.chat.providers,
                                  openrouter: { ...formData.chat.providers.openrouter, apiKey: e.target.value }
                                }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lmstudio-key">LM Studio API Key</Label>
                          <Input
                            id="lmstudio-key"
                            type="password"
                            value={formData.chat.providers.lmstudio?.apiKey || ''}
                            placeholder="API Key..."
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              chat: {
                                ...formData.chat,
                                providers: {
                                  ...formData.chat.providers,
                                  lmstudio: { ...formData.chat.providers.lmstudio, apiKey: e.target.value }
                                }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="lmstudio-url">LM Studio Base URL</Label>
                          <Input
                            id="lmstudio-url"
                            type="text"
                            value={formData.chat.providers.lmstudio?.baseUrl || ''}
                            placeholder="http://localhost:1234/v1"
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              chat: {
                                ...formData.chat,
                                providers: {
                                  ...formData.chat.providers,
                                  lmstudio: { ...formData.chat.providers.lmstudio, baseUrl: e.target.value }
                                }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ollama-key">Ollama API Key</Label>
                          <Input
                            id="ollama-key"
                            type="password"
                            value={formData.chat.providers.ollama?.apiKey || ''}
                            placeholder="API Key..."
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              chat: {
                                ...formData.chat,
                                providers: {
                                  ...formData.chat.providers,
                                  ollama: { ...formData.chat.providers.ollama, apiKey: e.target.value }
                                }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="ollama-url">Ollama Base URL</Label>
                          <Input
                            id="ollama-url"
                            type="text"
                            value={formData.chat.providers.ollama?.baseUrl || ''}
                            placeholder="http://localhost:11434"
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              chat: {
                                ...formData.chat,
                                providers: {
                                  ...formData.chat.providers,
                                  ollama: { ...formData.chat.providers.ollama, baseUrl: e.target.value }
                                }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="requesty-key">Requesty API Key</Label>
                          <Input
                            id="requesty-key"
                            type="password"
                            value={formData.chat.providers.requesty?.apiKey || ''}
                            placeholder="API Key..."
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              chat: {
                                ...formData.chat,
                                providers: {
                                  ...formData.chat.providers,
                                  requesty: { ...formData.chat.providers.requesty, apiKey: e.target.value }
                                }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="replicate-key">Replicate API Key</Label>
                          <Input
                            id="replicate-key"
                            type="password"
                            value={formData.chat.providers.replicate?.apiKey || ''}
                            placeholder="r8_..."
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              chat: {
                                ...formData.chat,
                                providers: {
                                  ...formData.chat.providers,
                                  replicate: { ...formData.chat.providers.replicate, apiKey: e.target.value }
                                }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="n8n-key">N8N API Key</Label>
                          <Input
                            id="n8n-key"
                            type="password"
                            value={formData.chat.providers.n8n?.apiKey || ''}
                            placeholder="API Key..."
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              chat: {
                                ...formData.chat,
                                providers: {
                                  ...formData.chat.providers,
                                  n8n: { ...formData.chat.providers.n8n, apiKey: e.target.value }
                                }
                              }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="n8n-url">N8N Base URL</Label>
                          <Input
                            id="n8n-url"
                            type="text"
                            value={formData.chat.providers.n8n?.baseUrl || ''}
                            placeholder="https://your-n8n-instance.com"
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              chat: {
                                ...formData.chat,
                                providers: {
                                  ...formData.chat.providers,
                                  n8n: { ...formData.chat.providers.n8n, baseUrl: e.target.value }
                                }
                              }
                            })}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Keyboard Shortcuts</h3>
                  <div className="space-y-4">
                    {formData?.shortcuts && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="toggle-window">Toggle Window</Label>
                          <Input
                            id="toggle-window"
                            value={formData.shortcuts.toggleWindow}
                            placeholder="CommandOrControl+Shift+L"
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              shortcuts: { ...formData.shortcuts, toggleWindow: e.target.value }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="process-clipboard">Process Clipboard</Label>
                          <Input
                            id="process-clipboard"
                            value={formData.shortcuts.processClipboard}
                            placeholder="CommandOrControl+Shift+V"
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              shortcuts: { ...formData.shortcuts, processClipboard: e.target.value }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="action-menu">Action Menu</Label>
                          <Input
                            id="action-menu"
                            value={formData.shortcuts.actionMenu}
                            placeholder="CommandOrControl+Shift+Space"
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              shortcuts: { ...formData.shortcuts, actionMenu: e.target.value }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="open-shortcuts">Open Shortcuts</Label>
                          <Input
                            id="open-shortcuts"
                            value={formData.shortcuts.openShortcuts}
                            placeholder="CommandOrControl+Shift+K"
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              shortcuts: { ...formData.shortcuts, openShortcuts: e.target.value }
                            })}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'prompts' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Custom Prompts</h3>
                  <PromptsContent
                    onPromptSelect={(prompt) => {
                      // Handle prompt selection if needed
                      console.log('Prompt selected:', prompt);
                    }}
                  />
                </div>
              </div>
            )}

            {activeTab === 'chat' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Chat Configuration</h3>
                  <div className="space-y-4">
                    {formData?.chat && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="system-prompt">Default System Prompt</Label>
                          <Textarea
                            id="system-prompt"
                            value={formData.chat.systemPrompt || ''}
                            placeholder="Enter your default system prompt that will be used for all conversations..."
                            rows={6}
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              chat: { ...formData.chat, systemPrompt: e.target.value }
                            })}
                          />
                          <p className="text-sm text-muted-foreground">
                            This prompt will be sent with every conversation to set the AI behavior and personality.
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="temperature">Temperature</Label>
                            <Input
                              id="temperature"
                              type="number"
                              min="0"
                              max="2"
                              step="0.1"
                              value={formData.chat.temperature}
                              className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                              onChange={(e) => updateFormData({
                                chat: { ...formData.chat, temperature: parseFloat(e.target.value) || 0 }
                              })}
                            />
                            <p className="text-xs text-muted-foreground">
                              Controls randomness (0.0 = focused, 2.0 = creative)
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="max-tokens">Max Tokens</Label>
                            <Input
                              id="max-tokens"
                              type="number"
                              min="1"
                              max="32768"
                              value={formData.chat.maxTokens}
                              className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                              onChange={(e) => updateFormData({
                                chat: { ...formData.chat, maxTokens: parseInt(e.target.value) || 8192 }
                              })}
                            />
                            <p className="text-xs text-muted-foreground">
                              Maximum response length
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <ToggleSwitch
                            enabled={formData.chat.toolCallingEnabled}
                            onToggle={(enabled: boolean) => updateFormData({
                              chat: { ...formData.chat, toolCallingEnabled: enabled }
                            })}
                          />
                          <div>
                            <Label>Enable Tool Calling</Label>
                            <p className="text-sm text-muted-foreground">
                              Allow the AI to use external tools and functions
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'mcp' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">MCP Servers</h3>
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Configure Model Context Protocol (MCP) servers for enhanced functionality.
                    </p>

                    {/* Add Server Button */}
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-muted-foreground">
                        {mcpServers.length} server{mcpServers.length !== 1 ? 's' : ''} configured
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleOpenMcpJsonEditor}
                          className="flex items-center gap-2"
                        >
                          <FileText className="h-4 w-4" />
                          Edit JSON
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAddMcpServer(true)}
                          className="flex items-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          Add Server
                        </Button>
                      </div>
                    </div>

                    {/* Add/Edit Server Form */}
                    {showAddMcpServer && (
                      <div className="border border-border rounded-lg p-4 space-y-4 bg-background">
                        <h4 className="font-medium">{editingMcpServer ? 'Edit' : 'Add'} MCP Server</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="mcp-name">Server Name</Label>
                            <Input
                              id="mcp-name"
                              value={newMcpServer.name}
                              placeholder="My MCP Server"
                              className="bg-slate-900 border-2 border-slate-600 focus:bg-slate-800 hover:bg-slate-850 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
                              onChange={(e) => setNewMcpServer(prev => ({ ...prev, name: e.target.value }))}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="mcp-command">Command</Label>
                            <Input
                              id="mcp-command"
                              value={newMcpServer.command}
                              placeholder="node server.js"
                              className="bg-slate-900 border-2 border-slate-600 focus:bg-slate-800 hover:bg-slate-850 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
                              onChange={(e) => setNewMcpServer(prev => ({ ...prev, command: e.target.value }))}
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="mcp-description">Description (Optional)</Label>
                          <Input
                            id="mcp-description"
                            value={newMcpServer.description}
                            placeholder="Description of what this server does"
                            className="bg-slate-900 border-2 border-slate-600 focus:bg-slate-800 hover:bg-slate-850 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
                            onChange={(e) => setNewMcpServer(prev => ({ ...prev, description: e.target.value }))}
                          />
                        </div>

                        {/* Arguments Section */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Arguments</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addArgument}
                              className="flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              Add Argument
                            </Button>
                          </div>
                          {newMcpServer.args.map((arg, index) => (
                            <div key={index} className="flex gap-2">
                              <Input
                                value={arg}
                                placeholder={`Argument ${index + 1}`}
                                className="bg-slate-900 border-2 border-slate-600 focus:bg-slate-800 hover:bg-slate-850 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20 transition-all"
                                onChange={(e) => updateArgument(index, e.target.value)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeArgument(index)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          {newMcpServer.args.length === 0 && (
                            <p className="text-sm text-muted-foreground">No arguments configured</p>
                          )}
                        </div>

                        {/* Environment Variables Section */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label>Environment Variables</Label>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={addEnvVariable}
                              className="flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" />
                              Add Variable
                            </Button>
                          </div>
                          {Object.entries(newMcpServer.env).map(([key, value]) => (
                            <div key={key} className="flex gap-2">
                              <Input
                                value={key}
                                placeholder="Variable name"
                                className="bg-muted border-2 border-border focus:bg-card hover:bg-muted/80 focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
                                onChange={(e) => updateEnvVariable(key, e.target.value, value)}
                              />
                              <Input
                                value={value}
                                placeholder="Variable value"
                                className="bg-muted border-2 border-border focus:bg-card hover:bg-muted/80 focus:border-ring focus:ring-2 focus:ring-ring/20 transition-all"
                                onChange={(e) => updateEnvVariable(key, key, e.target.value)}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeEnvVariable(key)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          {Object.keys(newMcpServer.env).length === 0 && (
                            <p className="text-sm text-muted-foreground">No environment variables configured</p>
                          )}
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setShowAddMcpServer(false);
                              setEditingMcpServer(null);
                              setNewMcpServer({
                                name: '',
                                command: '',
                                args: [],
                                description: '',
                                enabled: true,
                                env: {}
                              });
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            onClick={editingMcpServer ? handleUpdateMcpServer : handleAddMcpServer}
                            disabled={!newMcpServer.name || !newMcpServer.command}
                          >
                            {editingMcpServer ? 'Update' : 'Add'} Server
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Servers List */}
                    <div className="space-y-2">
                      {mcpServers.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No MCP servers configured</p>
                          <p className="text-sm">Add a server to get started</p>
                        </div>
                      ) : (
                        mcpServers.map((server) => (
                          <div
                            key={server.id}
                            className="flex items-center justify-between p-3 border border-border rounded-lg bg-background"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Zap className={`h-4 w-4 ${server.enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                                <div>
                                  <div className="font-medium">{server.name}</div>
                                  <div className="text-sm text-muted-foreground">{server.command}</div>
                                  {server.description && (
                                    <div className="text-xs text-muted-foreground">{server.description}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <ToggleSwitch
                                enabled={server.enabled}
                                onToggle={(enabled) => handleToggleMcpServer(server.id, enabled)}
                                size="sm"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditMcpServer(server)}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveMcpServer(server.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'memory' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Memory System</h3>
                  <MemoryManagement />
                </div>
              </div>
            )}

            {activeTab === 'knowledge-base' && <KnowledgeBaseSettings />}



            {activeTab === 'appearance' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Appearance</h3>
                  <div className="space-y-4">
                    {formData?.ui && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="theme">Theme</Label>
                          <Select
                            value={formData.ui.theme}
                            onValueChange={(value: 'light' | 'dark' | 'system') => updateFormData({
                              ui: { ...formData.ui, theme: value }
                            })}
                          >
                            <SelectTrigger className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors">
                              <SelectValue placeholder="Select theme" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="light">Light</SelectItem>
                              <SelectItem value="dark">Dark</SelectItem>
                              <SelectItem value="system">System</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Choose your preferred color theme
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="font-size">Font Size</Label>
                          <Select
                            value={formData.ui.fontSize || 'small'}
                            onValueChange={(value: 'small' | 'medium' | 'large') => updateFormData({
                              ui: { ...formData.ui, fontSize: value }
                            })}
                          >
                            <SelectTrigger className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors">
                              <SelectValue placeholder="Select font size" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="small">Small</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="large">Large</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground">
                            Adjust the application font size
                          </p>
                        </div>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Always on Top</Label>
                              <p className="text-sm text-muted-foreground">
                                Keep the application window above other windows
                              </p>
                            </div>
                            <ToggleSwitch
                              enabled={formData.ui.alwaysOnTop}
                              onToggle={(enabled: boolean) => updateFormData({
                                ui: { ...formData.ui, alwaysOnTop: enabled }
                              })}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Start Minimized</Label>
                              <p className="text-sm text-muted-foreground">
                                Start the application minimized to system tray
                              </p>
                            </div>
                            <ToggleSwitch
                              enabled={formData.ui.startMinimized}
                              onToggle={(enabled: boolean) => updateFormData({
                                ui: { ...formData.ui, startMinimized: enabled }
                              })}
                            />
                          </div>
                        </div>

                        {/* Theme Selection Section */}
                        <div className="space-y-4 border-t border-border pt-6">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="flex items-center gap-2">
                                <Palette className="h-4 w-4" />
                                Color Themes
                              </Label>
                              <p className="text-sm text-muted-foreground">
                                Choose from preset themes or create your own custom colors
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={resetToDefaults}
                              className="flex items-center gap-2"
                              title="Reset to factory defaults"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Reset
                            </Button>
                          </div>

                          {/* Color Mode Toggle */}
                          <div className="space-y-3">
                            <div className="flex gap-2">
                              <Button
                                variant={colorMode === 'preset' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleColorModeChange('preset')}
                                className="flex-1"
                              >
                                Preset Themes
                              </Button>
                              <Button
                                variant={colorMode === 'custom' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleColorModeChange('custom')}
                                className="flex-1"
                              >
                                Custom Colors
                              </Button>
                            </div>
                          </div>

                          {/* Theme Preset Selector */}
                          {colorMode === 'preset' && (
                            <div className="space-y-4">
                              <ThemeSelector
                                selectedThemeId={selectedThemePreset}
                                onThemeSelect={handleThemePresetChange}
                              />
                            </div>
                          )}

                          {/* Custom Color Pickers */}
                          {colorMode === 'custom' && (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <Label>Enable Custom Colors</Label>
                                  <p className="text-sm text-muted-foreground">
                                    Use custom colors instead of the default theme
                                  </p>
                                </div>
                                <ToggleSwitch
                                  enabled={useCustomColors}
                                  onToggle={handleUseCustomColorsChange}
                                />
                              </div>
                            </div>
                          )}

                          {colorMode === 'custom' && useCustomColors && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                              <ColorPicker
                                label="Main Background"
                                value={customColors.background}
                                onChange={(color) => handleColorChange({ ...customColors, background: color })}
                              />
                              <ColorPicker
                                label="Main Text Color"
                                value={customColors.foreground}
                                onChange={(color) => handleColorChange({ ...customColors, foreground: color })}
                              />
                              <ColorPicker
                                label="System Text Color"
                                value={customColors.systemText || '#e0e0e0'}
                                onChange={(color) => handleColorChange({ ...customColors, systemText: color })}
                              />
                              <ColorPicker
                                label="Button & Link Color"
                                value={customColors.primary}
                                onChange={(color) => handleColorChange({ ...customColors, primary: color })}
                              />
                              <ColorPicker
                                label="Button Text Color"
                                value={customColors.primaryForeground}
                                onChange={(color) => handleColorChange({ ...customColors, primaryForeground: color })}
                              />
                              <ColorPicker
                                label="Secondary Button Color"
                                value={customColors.secondary}
                                onChange={(color) => handleColorChange({ ...customColors, secondary: color })}
                              />
                              <ColorPicker
                                label="Secondary Button Text"
                                value={customColors.secondaryForeground}
                                onChange={(color) => handleColorChange({ ...customColors, secondaryForeground: color })}
                              />
                              <ColorPicker
                                label="Highlight Color"
                                value={customColors.accent}
                                onChange={(color) => handleColorChange({ ...customColors, accent: color })}
                              />
                              <ColorPicker
                                label="Highlight Text Color"
                                value={customColors.accentForeground}
                                onChange={(color) => handleColorChange({ ...customColors, accentForeground: color })}
                              />
                              <ColorPicker
                                label="Panel Background"
                                value={customColors.card}
                                onChange={(color) => handleColorChange({ ...customColors, card: color })}
                              />
                              <ColorPicker
                                label="Panel Text Color"
                                value={customColors.cardForeground}
                                onChange={(color) => handleColorChange({ ...customColors, cardForeground: color })}
                              />
                              <ColorPicker
                                label="Subtle Background"
                                value={customColors.muted}
                                onChange={(color) => handleColorChange({ ...customColors, muted: color })}
                              />
                              <ColorPicker
                                label="Subtle Text Color"
                                value={customColors.mutedForeground}
                                onChange={(color) => handleColorChange({ ...customColors, mutedForeground: color })}
                              />
                              <ColorPicker
                                label="Border & Divider Color"
                                value={customColors.border}
                                onChange={(color) => handleColorChange({ ...customColors, border: color })}
                              />
                              <ColorPicker
                                label="Input Field Background"
                                value={customColors.input}
                                onChange={(color) => handleColorChange({ ...customColors, input: color })}
                              />
                              <ColorPicker
                                label="Focus Outline Color"
                                value={customColors.ring}
                                onChange={(color) => handleColorChange({ ...customColors, ring: color })}
                              />
                              <ColorPicker
                                label="Error & Delete Color"
                                value={customColors.destructive}
                                onChange={(color) => handleColorChange({ ...customColors, destructive: color })}
                              />
                              <ColorPicker
                                label="Error Text Color"
                                value={customColors.destructiveForeground}
                                onChange={(color) => handleColorChange({ ...customColors, destructiveForeground: color })}
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'general' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">General Settings</h3>
                  <div className="space-y-4">
                    {formData?.general && (
                      <>
                        <div className="flex items-center space-x-2">
                          <ToggleSwitch
                            enabled={formData.general.autoStartWithSystem}
                            onToggle={(enabled: boolean) => updateFormData({
                              general: { ...formData.general, autoStartWithSystem: enabled }
                            })}
                          />
                          <Label>Start with System</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <ToggleSwitch
                            enabled={formData.general.showNotifications}
                            onToggle={(enabled: boolean) => updateFormData({
                              general: { ...formData.general, showNotifications: enabled }
                            })}
                          />
                          <Label>Show Notifications</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <ToggleSwitch
                            enabled={formData.general.saveConversationHistory}
                            onToggle={(enabled: boolean) => updateFormData({
                              general: { ...formData.general, saveConversationHistory: enabled }
                            })}
                          />
                          <Label>Save Conversation History</Label>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="history-length">Conversation History Length</Label>
                          <Input
                            id="history-length"
                            type="number"
                            min="1"
                            max="100"
                            value={formData.general.conversationHistoryLength}
                            className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              general: { ...formData.general, conversationHistoryLength: parseInt(e.target.value) }
                            })}
                          />
                          <p className="text-sm text-muted-foreground">
                            Number of previous messages to include in context
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-none p-6 pt-4 border-t border-border bg-background/50 backdrop-blur-sm">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleReload}
                disabled={isLoading}
                className="bg-muted/50 border-input hover:bg-muted/70 transition-colors"
              >
                {isLoading ? 'Loading...' : 'Reload Settings'}
              </Button>
              {hasChanges && (
                <span className="text-sm text-muted-foreground">
                  • Unsaved changes
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={!hasChanges || isLoading}
                className="bg-muted/50 border-input hover:bg-muted/70 transition-colors"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || isLoading}
                className={hasChanges ? 'bg-primary text-primary-foreground' : ''}
              >
                {isLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>
          {hasChanges && (
            <div className="mt-2 text-xs text-muted-foreground">
              Changes will be applied immediately after saving
            </div>
          )}
        </div>
      </div>

      {/* MCP JSON Editor Dialog */}
      <Dialog open={showMcpJsonEditor} onOpenChange={setShowMcpJsonEditor}>
        <DialogContent className="max-w-5xl w-[90vw] max-h-[85vh] h-[85vh] flex flex-col rounded-lg">
          <DialogHeader className="flex-none">
            <DialogTitle>Edit MCP Configuration JSON</DialogTitle>
          </DialogHeader>
          <div className="flex-1 flex flex-col space-y-4 min-h-0">
            <p className="text-sm text-muted-foreground flex-none">
              Edit the raw MCP configuration JSON. Be careful with the syntax.
            </p>
            <div className="flex-1 min-h-0">
              <Textarea
                value={mcpJsonContent}
                onChange={(e) => setMcpJsonContent(e.target.value)}
                placeholder="MCP JSON configuration..."
                className="w-full h-full resize-none bg-slate-900 border-2 border-slate-600 focus:bg-slate-800 hover:bg-slate-850 focus:border-blue-400 transition-colors font-mono text-sm text-slate-100 custom-scrollbar"
                style={{ minHeight: '400px' }}
              />
            </div>
            <div className="flex justify-end gap-2 flex-none pt-2">
              <Button
                variant="outline"
                onClick={() => setShowMcpJsonEditor(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveMcpJson}>
                Save JSON
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
