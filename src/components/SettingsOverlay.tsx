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
  Cog,
  RefreshCw,
  RotateCcw,
  Server,
  Play,
  Square,
  FileText,
  Brain
} from 'lucide-react';
import { settingsService, type AppSettings } from '../services/settingsService';
import { promptsService, type Prompt } from '../services/promptsService';
import { mcpService, type MCPServer } from '../services/mcpService';
import { useTheme } from '../contexts/ThemeContext';
import { MemoryManagement } from './MemoryManagement';

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

  // MCP state
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [editingMcpServer, setEditingMcpServer] = useState<MCPServer | null>(null);
  const [showAddMcpServer, setShowAddMcpServer] = useState(false);
  const [newMcpServer, setNewMcpServer] = useState({
    name: '',
    description: '',
    command: '',
    args: [] as string[],
    env: {} as Record<string, string>,
    enabled: true
  });
  const [mcpConfigText, setMcpConfigText] = useState('');

  const { theme, setTheme, themes } = useTheme();

  // Load settings and prompts
  useEffect(() => {
    console.log('SettingsOverlay component mounted');
    console.log('Theme context available:', theme);
    loadSettings();
    loadCustomPrompts();
    loadMcpServers();

    // Listen for MCP server connection events for immediate UI updates
    const handleMcpServerConnected = (serverId: string) => {
      console.log('🔌 MCP server connected:', serverId);
      loadMcpServers(); // Refresh the server list immediately
    };

    const handleMcpServerDisconnected = (serverId: string) => {
      console.log('🔌 MCP server disconnected:', serverId);
      loadMcpServers(); // Refresh the server list immediately
    };

    if (typeof window !== 'undefined' && window.electronAPI) {
      // Add event listeners for immediate MCP server updates
      window.electronAPI.onMcpServerConnected?.(handleMcpServerConnected);
      window.electronAPI.onMcpServerDisconnected?.(handleMcpServerDisconnected);
    }

    return () => {
      // Cleanup event listeners
      if (typeof window !== 'undefined' && window.electronAPI) {
        window.electronAPI.removeMcpServerListeners?.();
      }
    };
  }, []);

  const loadSettings = async () => {
    try {
      console.log('=== LOADING SETTINGS IN OVERLAY ===');

      // Try to get settings from electron API first
      if (typeof window !== 'undefined' && window.electronAPI) {
        console.log('Getting settings from electronAPI...');
        const electronSettings = await window.electronAPI.getAppSettings();
        console.log('Electron settings:', electronSettings);
        if (electronSettings) {
          // Ensure providers object exists
          if (!electronSettings.chat) {
            electronSettings.chat = {};
          }
          if (!electronSettings.chat.providers) {
            electronSettings.chat.providers = {
              openai: { apiKey: '', lastSelectedModel: '' },
              anthropic: { apiKey: '', lastSelectedModel: '' },
              gemini: { apiKey: '', lastSelectedModel: '' },
              mistral: { apiKey: '', lastSelectedModel: '' },
              deepseek: { apiKey: '', lastSelectedModel: '' },
              lmstudio: { apiKey: '', baseUrl: 'http://localhost:1234/v1', lastSelectedModel: '' },
              ollama: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
              openrouter: { apiKey: '', lastSelectedModel: '' },
              requesty: { apiKey: '', lastSelectedModel: '' },
              replicate: { apiKey: '', lastSelectedModel: '' },
              n8n: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
            };
          }
          setSettings(electronSettings);
          return;
        }
      }

      // Fallback to settings service
      console.log('Getting settings from settingsService...');
      const appSettings = settingsService.getSettings();
      console.log('Loaded settings in overlay:', appSettings);
      setSettings(appSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Set default settings if loading fails
      const defaultSettings: AppSettings = {
        chat: {
          provider: '',
          model: '',
          temperature: 0.3,
          maxTokens: 8192,
          systemPrompt: '',
          providers: {
            openai: { apiKey: '', lastSelectedModel: '' },
            anthropic: { apiKey: '', lastSelectedModel: '' },
            gemini: { apiKey: '', lastSelectedModel: '' },
            mistral: { apiKey: '', lastSelectedModel: '' },
            deepseek: { apiKey: '', lastSelectedModel: '' },
            lmstudio: { apiKey: '', baseUrl: 'http://localhost:1234/v1', lastSelectedModel: '' },
            ollama: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
            openrouter: { apiKey: '', lastSelectedModel: '' },
            requesty: { apiKey: '', lastSelectedModel: '' },
            replicate: { apiKey: '', lastSelectedModel: '' },
            n8n: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
          },
        },
        ui: {
          theme: 'system' as const,
          alwaysOnTop: true,
          startMinimized: false,
          opacity: 1.0,
          fontSize: 'small' as const,
          windowBounds: {
            width: 400,
            height: 615, // Increased by 15px for draggable header
          },
        },
        shortcuts: {
          toggleWindow: 'CommandOrControl+Shift+L',
          processClipboard: 'CommandOrControl+Shift+V',
          actionMenu: 'CommandOrControl+Shift+Space',
        },
        general: {
          autoStartWithSystem: false,
          showNotifications: true,
          saveConversationHistory: true,
        },
      };
      console.log('Using default settings:', defaultSettings);
      setSettings(defaultSettings);
    }
  };

  const loadCustomPrompts = () => {
    const allPrompts = promptsService.getAllPrompts();
    setCustomPrompts(allPrompts); // Show all prompts, not just custom ones
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    try {
      console.log('=== SAVING SETTINGS FROM OVERLAY ===');
      console.log('Settings to save:', settings);
      console.log('AutoStart value:', settings.general.autoStartWithSystem);

      await settingsService.updateSettings(settings);
      console.log('=== SETTINGS SAVED FROM OVERLAY ===');

      // Force theme update in main window by triggering a settings change event
      if (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.notifyThemeChange) {
        window.electronAPI.notifyThemeChange(theme.id);
      }

      handleClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleReloadSettings = async () => {
    console.log('🔄 Reload Settings button clicked!');
    try {
      console.log('=== RELOADING SETTINGS FROM DISK ===');

      // Force reload from disk
      if (typeof window !== 'undefined' && window.electronAPI) {
        const savedSettings = await window.electronAPI.getSettings();
        if (savedSettings) {
          console.log('Settings reloaded from disk:', savedSettings);

          // Update the overlay UI
          setSettings(savedSettings);

          // IMPORTANT: Force update the settings service AND notify all subscribers
          // This will update VoilaInterface and all other components
          settingsService.forceUpdateSettings(savedSettings);

          console.log('=== SETTINGS RELOADED SUCCESSFULLY ===');
          alert('Settings reloaded successfully! All components updated.');
        } else {
          console.log('No settings found on disk');
          alert('No settings found on disk');
        }
      } else {
        console.log('Electron API not available');
        alert('Electron API not available');
      }
    } catch (error) {
      console.error('Failed to reload settings:', error);
      alert(`Failed to reload settings: ${error instanceof Error ? error.message : String(error)}`);
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
    const isCustom = promptsService.isCustomPrompt(prompt.id);

    if (!isCustom) {
      // For built-in prompts, check if a custom copy already exists
      const existingCustomCopy = promptsService.findCustomCopyOfBuiltinPrompt(prompt);

      if (existingCustomCopy) {
        // Edit the existing custom copy instead of the built-in prompt
        setEditingPrompt(existingCustomCopy);
        setNewPrompt({
          name: existingCustomCopy.name,
          description: existingCustomCopy.description,
          prompt: existingCustomCopy.prompt,
          category: existingCustomCopy.category,
          icon: existingCustomCopy.icon
        });
      } else {
        // No custom copy exists, prepare to create one
        setEditingPrompt(prompt);
        setNewPrompt({
          name: `${prompt.name} (Custom)`,
          description: prompt.description,
          prompt: prompt.prompt,
          category: prompt.category,
          icon: prompt.icon
        });
      }
    } else {
      // Editing an existing custom prompt
      setEditingPrompt(prompt);
      setNewPrompt({
        name: prompt.name,
        description: prompt.description,
        prompt: prompt.prompt,
        category: prompt.category,
        icon: prompt.icon
      });
    }

    setShowAddPrompt(true);
  };

  const handleUpdatePrompt = async () => {
    if (editingPrompt && newPrompt.name && newPrompt.prompt) {
      const isCustom = promptsService.isCustomPrompt(editingPrompt.id);

      const promptData = {
        name: newPrompt.name,
        description: newPrompt.description,
        prompt: newPrompt.prompt,
        category: newPrompt.category,
        icon: newPrompt.icon
      };

      if (isCustom) {
        // Update existing custom prompt
        await promptsService.updateCustomPrompt(editingPrompt.id, promptData);
      } else {
        // Check if a custom copy of this built-in prompt already exists
        const existingCustomCopy = promptsService.findCustomCopyOfBuiltinPrompt(editingPrompt);

        if (existingCustomCopy) {
          // Update the existing custom copy instead of creating a duplicate
          await promptsService.updateCustomPrompt(existingCustomCopy.id, promptData);
          console.log('Updated existing custom copy of built-in prompt:', existingCustomCopy.id);
        } else {
          // Create new custom prompt from built-in prompt
          await promptsService.addCustomPrompt(promptData);
          console.log('Created new custom copy of built-in prompt');
        }
      }

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

  // MCP Server Management Functions
  const loadMcpServers = async () => {
    try {
      const servers = await mcpService.getServers();
      setMcpServers(servers);

      // Load MCP config as text for editing
      if (typeof window !== 'undefined' && window.electronAPI) {
        const mcpData = await window.electronAPI.getMCPServers();
        setMcpConfigText(JSON.stringify(mcpData, null, 2));
      }
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    }
  };

  const handleAddMcpServer = async () => {
    try {
      console.log('🔄 Adding new MCP server:', newMcpServer);

      const server = await mcpService.addServer({
        name: newMcpServer.name,
        description: newMcpServer.description,
        command: newMcpServer.command,
        args: newMcpServer.args.filter(arg => arg.trim()), // Remove empty args
        env: Object.fromEntries(
          Object.entries(newMcpServer.env).filter(([key, value]) => key.trim() && value.trim())
        ), // Remove empty env vars
        enabled: newMcpServer.enabled
      });

      console.log('✅ MCP server added:', server);

      // If enabled, try to connect the server immediately
      if (server.enabled) {
        console.log('🔌 Auto-connecting new MCP server:', server.id);
        try {
          const connected = await mcpService.connectServer(server.id);
          console.log('🔌 Auto-connection result:', connected);
        } catch (connectError) {
          console.warn('⚠️ Failed to auto-connect new server:', connectError);
        }
      }

      setMcpServers([...mcpServers, server]);
      setShowAddMcpServer(false);
      setNewMcpServer({
        name: '',
        description: '',
        command: '',
        args: [],
        env: {},
        enabled: true
      });

      // Reload config text and trigger settings reload
      loadMcpServers();

      // Trigger settings reload for MCP server change
      await settingsService.reloadForMCPChange();

      console.log('🎉 MCP server setup completed');
    } catch (error) {
      console.error('❌ Failed to add MCP server:', error);
    }
  };

  const handleUpdateMcpServer = async (id: string, updates: Partial<MCPServer>) => {
    try {
      console.log('🔄 Updating MCP server:', id, updates);

      const currentServer = mcpServers.find(s => s.id === id);
      const wasEnabled = currentServer?.enabled;
      const willBeEnabled = updates.enabled !== undefined ? updates.enabled : wasEnabled;

      await mcpService.updateServer(id, updates);

      // Handle connection changes
      if (wasEnabled !== willBeEnabled) {
        if (willBeEnabled) {
          console.log('🔌 Connecting MCP server after enable:', id);
          try {
            await mcpService.connectServer(id);
          } catch (connectError) {
            console.warn('⚠️ Failed to connect server after enable:', connectError);
          }
        } else {
          console.log('🔌 Disconnecting MCP server after disable:', id);
          try {
            await mcpService.disconnectServer(id);
          } catch (disconnectError) {
            console.warn('⚠️ Failed to disconnect server after disable:', disconnectError);
          }
        }
      }

      setMcpServers(mcpServers.map(server =>
        server.id === id ? { ...server, ...updates } : server
      ));

      // Reload config text
      loadMcpServers();

      // If enabled state changed, trigger settings reload (explicit requirement)
      if ('enabled' in updates) {
        await settingsService.reloadForMCPChange();
      }

      console.log('✅ MCP server update completed');
    } catch (error) {
      console.error('❌ Failed to update MCP server:', error);
    }
  };

  const handleDeleteMcpServer = async (id: string) => {
    try {
      await mcpService.removeServer(id);
      setMcpServers(mcpServers.filter(server => server.id !== id));

      // Reload config text
      loadMcpServers();
    } catch (error) {
      console.error('Failed to delete MCP server:', error);
    }
  };

  const handleSaveMcpConfig = async () => {
    try {
      const mcpData = JSON.parse(mcpConfigText);
      if (typeof window !== 'undefined' && window.electronAPI) {
        await window.electronAPI.saveMCPServers(mcpData);
        loadMcpServers(); // Reload to sync UI
      }
    } catch (error) {
      console.error('Failed to save MCP config:', error);
      alert('Invalid JSON format. Please check your configuration.');
    }
  };

  const handleRestartMcpServers = async () => {
    try {
      console.log('🔄 Restarting all MCP servers...');
      await mcpService.restartAllServers();
      console.log('✅ All MCP servers restarted');
      // Trigger settings reload for MCP server change
      await settingsService.reloadForMCPChange();
    } catch (error) {
      console.error('❌ Failed to restart MCP servers:', error);
    }
  };

  return (
    <div className="h-full w-full bg-background flex flex-col overflow-hidden">
      {/* Custom Title Bar - macOS style */}
      <div
        className="h-8 w-full bg-background/80 backdrop-blur-md border-b border-border/50 flex items-center justify-center relative flex-none cursor-move"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        <div className="absolute left-4 flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}>
          <div className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 cursor-pointer" onClick={handleClose} />
          <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
          <div className="w-3 h-3 rounded-full bg-green-500/80" />
        </div>
        <div className="text-sm font-medium text-foreground/80">Settings</div>
      </div>



      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto hide-scrollbar overlay-scroll p-6">
        {!settings || !settings.chat || !settings.chat.providers ? (
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p>Loading settings...</p>
            <Button
              onClick={() => {
                console.log('Retry button clicked');
                loadSettings();
              }}
              variant="outline"
            >
              Retry
            </Button>
          </div>
        ) : (
          <Tabs defaultValue="api-keys" className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="api-keys">API Keys</TabsTrigger>
              <TabsTrigger value="shortcuts">Shortcuts</TabsTrigger>
              <TabsTrigger value="prompts">Prompts</TabsTrigger>
              <TabsTrigger value="mcp">MCP</TabsTrigger>
              <TabsTrigger value="memory">Memory</TabsTrigger>
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
                    value={settings.chat.providers?.openai?.apiKey || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: {
                        ...settings.chat,
                        providers: {
                          ...settings.chat.providers,
                          openai: { ...(settings.chat.providers?.openai || {}), apiKey: e.target.value }
                        }
                      }
                    })}
                    placeholder="sk-..."
                  />
                </div>

                {/* Anthropic */}
                <div className="space-y-2">
                  <Label htmlFor="anthropic-key">Anthropic API Key</Label>
                  <Input
                    id="anthropic-key"
                    type="password"
                    value={settings.chat.providers.anthropic?.apiKey || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: {
                        ...settings.chat,
                        providers: {
                          ...settings.chat.providers,
                          anthropic: { ...(settings.chat.providers.anthropic || {}), apiKey: e.target.value }
                        }
                      }
                    })}
                    placeholder="sk-ant-..."
                  />
                </div>

                {/* Google Gemini */}
                <div className="space-y-2">
                  <Label htmlFor="gemini-key">Google Gemini API Key</Label>
                  <Input
                    id="gemini-key"
                    type="password"
                    value={settings.chat.providers.gemini?.apiKey || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: {
                        ...settings.chat,
                        providers: {
                          ...settings.chat.providers,
                          gemini: { ...(settings.chat.providers.gemini || {}), apiKey: e.target.value }
                        }
                      }
                    })}
                    placeholder="AIza..."
                  />
                </div>

                {/* Mistral AI */}
                <div className="space-y-2">
                  <Label htmlFor="mistral-key">Mistral AI API Key</Label>
                  <Input
                    id="mistral-key"
                    type="password"
                    value={settings.chat.providers?.mistral?.apiKey || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: {
                        ...settings.chat,
                        providers: {
                          ...settings.chat.providers,
                          mistral: { ...(settings.chat.providers?.mistral || {}), apiKey: e.target.value }
                        }
                      }
                    })}
                    placeholder="..."
                  />
                </div>

                {/* DeepSeek */}
                <div className="space-y-2">
                  <Label htmlFor="deepseek-key">DeepSeek API Key</Label>
                  <Input
                    id="deepseek-key"
                    type="password"
                    value={settings.chat.providers?.deepseek?.apiKey || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: {
                        ...settings.chat,
                        providers: {
                          ...settings.chat.providers,
                          deepseek: { ...(settings.chat.providers?.deepseek || {}), apiKey: e.target.value }
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
                    value={settings.chat.providers?.openrouter?.apiKey || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: {
                        ...settings.chat,
                        providers: {
                          ...settings.chat.providers,
                          openrouter: { ...(settings.chat.providers?.openrouter || {}), apiKey: e.target.value }
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
                    value={settings.chat.providers?.requesty?.apiKey || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: {
                        ...settings.chat,
                        providers: {
                          ...settings.chat.providers,
                          requesty: { ...(settings.chat.providers?.requesty || {}), apiKey: e.target.value }
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
                    value={settings.chat.providers?.replicate?.apiKey || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: {
                        ...settings.chat,
                        providers: {
                          ...settings.chat.providers,
                          replicate: { ...(settings.chat.providers?.replicate || {}), apiKey: e.target.value }
                        }
                      }
                    })}
                    placeholder="r8_..."
                  />
                </div>

                {/* n8n Workflow */}
                <div className="space-y-2">
                  <Label htmlFor="n8n-webhook">n8n Webhook URL</Label>
                  <Input
                    id="n8n-webhook"
                    value={settings.chat.providers.n8n?.baseUrl || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: {
                        ...settings.chat,
                        providers: {
                          ...settings.chat.providers,
                          n8n: { ...(settings.chat.providers.n8n || {}), baseUrl: e.target.value }
                        }
                      }
                    })}
                    placeholder="https://your-n8n-instance.com/webhook/your-workflow-name"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your n8n webhook URL. The workflow will receive the message and conversation history.
                  </p>
                </div>

                {/* LM Studio */}
                <div className="space-y-2">
                  <Label htmlFor="lmstudio-url">LM Studio Base URL</Label>
                  <Input
                    id="lmstudio-url"
                    value={settings.chat.providers.lmstudio?.baseUrl || 'http://localhost:1234/v1'}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: {
                        ...settings.chat,
                        providers: {
                          ...settings.chat.providers,
                          lmstudio: { ...(settings.chat.providers.lmstudio || {}), baseUrl: e.target.value }
                        }
                      }
                    })}
                    placeholder="http://localhost:1234/v1"
                  />
                  <p className="text-xs text-muted-foreground">
                    Make sure LM Studio server is running and accessible at this URL.
                  </p>
                </div>

                {/* Ollama */}
                <div className="space-y-2">
                  <Label htmlFor="ollama-url">Ollama Base URL</Label>
                  <Input
                    id="ollama-url"
                    value={settings.chat.providers?.ollama?.baseUrl || 'http://localhost:11434'}
                    onChange={(e) => setSettings({
                      ...settings,
                      chat: {
                        ...settings.chat,
                        providers: {
                          ...settings.chat.providers,
                          ollama: { ...(settings.chat.providers?.ollama || {}), baseUrl: e.target.value }
                        }
                      }
                    })}
                    placeholder="http://localhost:11434"
                  />
                  <p className="text-xs text-muted-foreground">
                    Make sure Ollama is running and accessible at this URL.
                  </p>
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

            {/* Memory Tab */}
            <TabsContent value="memory" className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <Brain className="h-4 w-4" />
                  <h3 className="text-lg font-medium">Memory System</h3>
                </div>
                <MemoryManagement />
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
                    min="0.1"
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

                <div className="space-y-2">
                  <Label>Conversation History Length</Label>
                  <Input
                    type="number"
                    min="1"
                    max="50"
                    value={settings.general.conversationHistoryLength || 10}
                    onChange={(e) => setSettings({
                      ...settings,
                      general: { ...settings.general, conversationHistoryLength: parseInt(e.target.value) }
                    })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of previous messages to include in AI context (1-50). Higher values provide more context but use more tokens.
                  </p>
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
                <div className="space-y-2 max-h-64 overflow-y-auto hide-scrollbar overlay-scroll">
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
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditPrompt(prompt)}
                            title={isCustom ? "Edit prompt" : "Edit prompt (will create a custom copy)"}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {isCustom && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeletePrompt(prompt.id)}
                              title="Delete custom prompt"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add/Edit Prompt Dialog */}
                {showAddPrompt && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-background border rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
                      <h3 className="text-lg font-medium mb-4">
                        {editingPrompt
                          ? (promptsService.isCustomPrompt(editingPrompt.id)
                              ? 'Edit Custom Prompt'
                              : 'Edit Built-in Prompt (Custom Copy)')
                          : 'Add New Prompt'}
                      </h3>

                      {editingPrompt && !promptsService.isCustomPrompt(editingPrompt.id) && (
                        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4">
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            <strong>Note:</strong> You're editing a built-in prompt. {
                              promptsService.findCustomCopyOfBuiltinPrompt(editingPrompt)
                                ? 'This will update your existing custom copy of this prompt.'
                                : 'This will create a new custom copy that you can modify. The original built-in prompt will remain unchanged.'
                            }
                          </p>
                        </div>
                      )}

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
                          {editingPrompt
                            ? (promptsService.isCustomPrompt(editingPrompt.id)
                                ? 'Update Prompt'
                                : (promptsService.findCustomCopyOfBuiltinPrompt(editingPrompt)
                                    ? 'Update Custom Copy'
                                    : 'Create Custom Copy'))
                            : 'Add Prompt'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* MCP Tab */}
            <TabsContent value="mcp" className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4" />
                    <h3 className="text-lg font-medium">MCP Servers</h3>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={handleRestartMcpServers}
                      size="sm"
                      variant="outline"
                      className="cursor-pointer"
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restart All
                    </Button>
                    <Button
                      onClick={() => setShowAddMcpServer(true)}
                      size="sm"
                      className="cursor-pointer"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Server
                    </Button>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  Configure MCP (Model Context Protocol) servers to extend functionality with tools, resources, and prompts.
                  <br />
                  <span className="text-xs">💡 "Method not found" warnings are normal for servers that don't support all capabilities.</span>
                </div>

                {/* MCP Servers List */}
                <div className="space-y-2">
                  {mcpServers.map((server) => (
                    <div key={server.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <div className="relative">
                            <Server className="h-4 w-4" />
                            {/* Health indicator */}
                            {server.enabled && (
                              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"
                                   title="Server enabled" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{server.name}</span>
                              {server.enabled && (
                                <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                  Enabled
                                </span>
                              )}
                            </div>
                            {server.description && (
                              <div className="text-sm text-muted-foreground">{server.description}</div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              {server.command} {server.args.join(' ')}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant={server.enabled ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleUpdateMcpServer(server.id, { enabled: !server.enabled })}
                          className="cursor-pointer"
                        >
                          {server.enabled ? <Play className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                          {server.enabled ? 'Enabled' : 'Disabled'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingMcpServer(server)}
                          className="cursor-pointer"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteMcpServer(server.id)}
                          className="cursor-pointer text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {mcpServers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No MCP servers configured. Add one to get started.
                    </div>
                  )}
                </div>

                {/* Raw Config Editor */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="mcp-config">Raw Configuration (JSON)</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSaveMcpConfig}
                      className="cursor-pointer"
                    >
                      <Save className="h-3 w-3 mr-2" />
                      Save Config
                    </Button>
                  </div>
                  <Textarea
                    id="mcp-config"
                    value={mcpConfigText}
                    onChange={(e) => setMcpConfigText(e.target.value)}
                    placeholder="MCP configuration in JSON format..."
                    rows={10}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Advanced: Edit the raw MCP configuration. Changes will be applied when you click "Save Config".
                  </p>
                </div>

                {/* Add/Edit MCP Server Modal */}
                {(showAddMcpServer || editingMcpServer) && (
                  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-background border border-border rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
                      <h3 className="text-lg font-medium mb-4">
                        {editingMcpServer ? 'Edit MCP Server' : 'Add MCP Server'}
                      </h3>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="server-name">Server Name</Label>
                          <Input
                            id="server-name"
                            value={editingMcpServer ? editingMcpServer.name : newMcpServer.name}
                            onChange={(e) => {
                              if (editingMcpServer) {
                                setEditingMcpServer({ ...editingMcpServer, name: e.target.value });
                              } else {
                                setNewMcpServer({ ...newMcpServer, name: e.target.value });
                              }
                            }}
                            placeholder="e.g., File System Server"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="server-description">Description (Optional)</Label>
                          <Input
                            id="server-description"
                            value={editingMcpServer ? editingMcpServer.description || '' : newMcpServer.description}
                            onChange={(e) => {
                              if (editingMcpServer) {
                                setEditingMcpServer({ ...editingMcpServer, description: e.target.value });
                              } else {
                                setNewMcpServer({ ...newMcpServer, description: e.target.value });
                              }
                            }}
                            placeholder="Brief description of what this server does"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="server-command">Command</Label>
                          <Input
                            id="server-command"
                            value={editingMcpServer ? editingMcpServer.command : newMcpServer.command}
                            onChange={(e) => {
                              if (editingMcpServer) {
                                setEditingMcpServer({ ...editingMcpServer, command: e.target.value });
                              } else {
                                setNewMcpServer({ ...newMcpServer, command: e.target.value });
                              }
                            }}
                            placeholder="e.g., npx, python, node"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Arguments</Label>
                          <div className="space-y-2">
                            {(editingMcpServer ? editingMcpServer.args : newMcpServer.args).map((arg, index) => (
                              <div key={index} className="flex gap-2">
                                <Input
                                  value={arg}
                                  onChange={(e) => {
                                    const newArgs = [...(editingMcpServer ? editingMcpServer.args : newMcpServer.args)];
                                    newArgs[index] = e.target.value;
                                    if (editingMcpServer) {
                                      setEditingMcpServer({ ...editingMcpServer, args: newArgs });
                                    } else {
                                      setNewMcpServer({ ...newMcpServer, args: newArgs });
                                    }
                                  }}
                                  placeholder={`Argument ${index + 1}`}
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const newArgs = (editingMcpServer ? editingMcpServer.args : newMcpServer.args).filter((_, i) => i !== index);
                                    if (editingMcpServer) {
                                      setEditingMcpServer({ ...editingMcpServer, args: newArgs });
                                    } else {
                                      setNewMcpServer({ ...newMcpServer, args: newArgs });
                                    }
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newArgs = [...(editingMcpServer ? editingMcpServer.args : newMcpServer.args), ''];
                                if (editingMcpServer) {
                                  setEditingMcpServer({ ...editingMcpServer, args: newArgs });
                                } else {
                                  setNewMcpServer({ ...newMcpServer, args: newArgs });
                                }
                              }}
                              className="w-full"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Argument
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Environment Variables</Label>
                          <div className="space-y-2">
                            {Object.entries(editingMcpServer ? editingMcpServer.env || {} : newMcpServer.env).map(([key, value], index) => (
                              <div key={index} className="flex gap-2">
                                <Input
                                  value={key}
                                  onChange={(e) => {
                                    const currentEnv = editingMcpServer ? editingMcpServer.env || {} : newMcpServer.env;
                                    const newEnv = { ...currentEnv };
                                    delete newEnv[key];
                                    newEnv[e.target.value] = value;
                                    if (editingMcpServer) {
                                      setEditingMcpServer({ ...editingMcpServer, env: newEnv });
                                    } else {
                                      setNewMcpServer({ ...newMcpServer, env: newEnv });
                                    }
                                  }}
                                  placeholder="Variable name"
                                  className="flex-1"
                                />
                                <Input
                                  value={value}
                                  onChange={(e) => {
                                    const currentEnv = editingMcpServer ? editingMcpServer.env || {} : newMcpServer.env;
                                    const newEnv = { ...currentEnv, [key]: e.target.value };
                                    if (editingMcpServer) {
                                      setEditingMcpServer({ ...editingMcpServer, env: newEnv });
                                    } else {
                                      setNewMcpServer({ ...newMcpServer, env: newEnv });
                                    }
                                  }}
                                  placeholder="Variable value"
                                  className="flex-1"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const currentEnv = editingMcpServer ? editingMcpServer.env || {} : newMcpServer.env;
                                    const newEnv = { ...currentEnv };
                                    delete newEnv[key];
                                    if (editingMcpServer) {
                                      setEditingMcpServer({ ...editingMcpServer, env: newEnv });
                                    } else {
                                      setNewMcpServer({ ...newMcpServer, env: newEnv });
                                    }
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const currentEnv = editingMcpServer ? editingMcpServer.env || {} : newMcpServer.env;
                                const newEnv = { ...currentEnv, '': '' };
                                if (editingMcpServer) {
                                  setEditingMcpServer({ ...editingMcpServer, env: newEnv });
                                } else {
                                  setNewMcpServer({ ...newMcpServer, env: newEnv });
                                }
                              }}
                              className="w-full"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Environment Variable
                            </Button>
                          </div>
                        </div>


                      </div>

                      <div className="flex justify-end gap-2 mt-6">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setShowAddMcpServer(false);
                            setEditingMcpServer(null);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={async () => {
                            if (editingMcpServer) {
                              await handleUpdateMcpServer(editingMcpServer.id, {
                                name: editingMcpServer.name,
                                description: editingMcpServer.description,
                                command: editingMcpServer.command,
                                args: editingMcpServer.args,
                                env: Object.fromEntries(
                                  Object.entries(editingMcpServer.env || {}).filter(([key, value]) => key.trim() && value.trim())
                                )
                              });
                              setEditingMcpServer(null);
                            } else {
                              await handleAddMcpServer();
                            }
                          }}
                        >
                          {editingMcpServer ? 'Update' : 'Add'} Server
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Action Buttons */}
            <div className="flex justify-between gap-2 mt-6 pt-4 border-t">
              <Button
                variant="outline"
                onClick={handleReloadSettings}
                className="cursor-pointer"
                type="button"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reload Settings
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleClose} type="button">
                  Cancel
                </Button>
                <Button onClick={handleSaveSettings} type="button">
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </Button>
              </div>
            </div>
          </Tabs>
        )}
      </div>
    </div>
  );
}
