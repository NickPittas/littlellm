'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { ToggleSwitch } from './ui/toggle-switch';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { settingsService, type AppSettings, type ColorSettings } from '../services/settingsService';
import { MemoryManagement } from './MemoryManagement';
import KnowledgeBaseSettings from './KnowledgeBaseSettings';
import { mcpService, type MCPServer } from '../services/mcpService';
import { PromptsContent } from './PromptsContent';
import { ApiKeySettings } from './ApiKeySettings';
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
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const apiKeySaveRef = useRef<(() => Promise<void>) | null>(null);
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

  // Internal Commands state
  const [internalCommandsEnabled, setInternalCommandsEnabled] = useState(false);
  const [allowedDirectories, setAllowedDirectories] = useState<string[]>([]);
  const [blockedCommands, setBlockedCommands] = useState<string[]>([]);
  const [enabledCommandCategories, setEnabledCommandCategories] = useState({
    terminal: true,
    filesystem: true,
    textEditing: true,
    system: true
  });
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({});
  const [availableTools, setAvailableTools] = useState<Array<{
    name: string;
    description: string;
    category: string;
    inputSchema: Record<string, unknown>;
  }>>([]);
  const [newDirectory, setNewDirectory] = useState('');
  const [newBlockedCommand, setNewBlockedCommand] = useState('');

  const handleClose = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.closeSettingsOverlay();
    }
  };

  const handleTitleBarMouseDown = () => {
    // Enable window dragging via CSS
    // The title bar will use -webkit-app-region: drag
  };

  const loadSettings = async (): Promise<AppSettings | undefined> => {
    setIsLoading(true);
    try {
      // Always use the settings service to ensure consistency
      const loadedSettings = settingsService.getSettings();
      console.log('🔍 SettingsOverlay: Loaded settings from service:', loadedSettings);

      setSettings(loadedSettings);
      setFormData(JSON.parse(JSON.stringify(loadedSettings))); // Deep copy
      setHasChanges(false);

      // Load MCP servers
      await loadMcpServers();

      return loadedSettings;
    } catch (error) {
      console.error('Failed to load settings:', error);
      return undefined;
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

  // Internal Commands functions
  const loadInternalCommandsSettings = async (loadedSettings?: AppSettings) => {
    // Use the provided settings, current settings state, or fall back to service
    const currentSettings = loadedSettings || settings || settingsService.getSettings();
    const commandSettings = currentSettings.internalCommands;

    console.log('🔧 Loading internal commands settings:', {
      loadedSettings: !!loadedSettings,
      currentSettings: !!currentSettings,
      commandSettings,
      hasInternalCommands: !!commandSettings
    });

    // Safety check in case internalCommands is not initialized
    if (!commandSettings) {
      console.warn('Internal commands settings not found, using defaults');
      setInternalCommandsEnabled(false);
      setAllowedDirectories([]);
      setBlockedCommands([]);
      setEnabledCommandCategories({
        terminal: true,
        filesystem: true,
        textEditing: true,
        system: true
      });
      setEnabledTools({});
      setAvailableTools([]);
      return;
    }

    console.log('🔧 Setting internal commands state:', {
      enabled: commandSettings.enabled,
      allowedDirectories: commandSettings.allowedDirectories,
      blockedCommands: commandSettings.blockedCommands,
      enabledCommands: commandSettings.enabledCommands,
      enabledTools: commandSettings.enabledTools
    });

    setInternalCommandsEnabled(commandSettings.enabled);
    setAllowedDirectories(commandSettings.allowedDirectories);
    setBlockedCommands(commandSettings.blockedCommands);
    setEnabledCommandCategories(commandSettings.enabledCommands);

    // Load individual tool settings
    setEnabledTools(commandSettings.enabledTools || {});

    // Load available tools (service should already be initialized by LLMService)
    try {
      const { internalCommandService } = await import('../services/internalCommandService');
      // Don't re-initialize - service should already be ready
      const tools = internalCommandService.getAvailableTools();
      setAvailableTools(tools);
    } catch (error) {
      console.error('Failed to load available tools:', error);
      setAvailableTools([]);
    }
  };

  const saveInternalCommandsSettings = () => {
    if (!formData) return;

    // Ensure internalCommands exists with defaults
    const defaultInternalCommands = {
      enabled: false,
      allowedDirectories: [],
      blockedCommands: [],
      fileReadLineLimit: 1000,
      fileWriteLineLimit: 50,
      defaultShell: 'bash',
      enabledCommands: {
        terminal: true,
        filesystem: true,
        textEditing: true,
        system: true
      },
      terminalSettings: {
        defaultTimeout: 30000,
        maxProcesses: 10,
        allowInteractiveShells: true
      }
    };

    const updatedInternalCommands = {
      ...defaultInternalCommands,
      ...formData.internalCommands,
      enabled: internalCommandsEnabled,
      allowedDirectories,
      blockedCommands,
      enabledCommands: enabledCommandCategories,
      enabledTools
    };

    console.log('🔧 Saving internal commands settings:', {
      current: {
        enabled: internalCommandsEnabled,
        allowedDirectories,
        blockedCommands,
        enabledCommandCategories,
        enabledTools
      },
      updated: updatedInternalCommands
    });

    // Update formData to trigger hasChanges and enable save button
    updateFormData({
      internalCommands: updatedInternalCommands
    });

    console.log('🔧 Internal commands settings updated in form data');
  };

  const saveInternalCommandsSettingsWithDirectories = (directories: string[]) => {
    if (!formData) return;

    // Ensure internalCommands exists with defaults
    const defaultInternalCommands = {
      enabled: false,
      allowedDirectories: [],
      blockedCommands: [],
      fileReadLineLimit: 1000,
      fileWriteLineLimit: 50,
      defaultShell: 'bash',
      enabledCommands: {
        terminal: true,
        filesystem: true,
        textEditing: true,
        system: true
      },
      terminalSettings: {
        defaultTimeout: 30000,
        maxProcesses: 10,
        allowInteractiveShells: true,
      }
    };

    const updatedInternalCommands = {
      ...defaultInternalCommands,
      ...formData.internalCommands,
      enabled: internalCommandsEnabled,
      allowedDirectories: directories,
      blockedCommands,
      enabledCommands: enabledCommandCategories,
      enabledTools
    };

    // Update formData to trigger hasChanges and enable save button
    updateFormData({
      internalCommands: updatedInternalCommands
    });

    console.log('🔧 Internal commands settings updated with directories:', directories);
  };

  const addAllowedDirectory = () => {
    if (newDirectory.trim() && !allowedDirectories.includes(newDirectory.trim())) {
      const updatedDirectories = [...allowedDirectories, newDirectory.trim()];
      setAllowedDirectories(updatedDirectories);
      setNewDirectory('');

      // Immediately save the settings with the updated directories
      saveInternalCommandsSettingsWithDirectories(updatedDirectories);
    }
  };

  const removeAllowedDirectory = (index: number) => {
    const updatedDirectories = allowedDirectories.filter((_, i) => i !== index);
    setAllowedDirectories(updatedDirectories);

    // Immediately save the settings with the updated directories
    saveInternalCommandsSettingsWithDirectories(updatedDirectories);
  };

  const browseForDirectory = async () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      try {
        // Use the existing file dialog but configure it for directories
        const result = await window.electronAPI.selectFiles({
          multiple: false,
          properties: ['openDirectory']
        });

        if (result && result.length > 0) {
          const selectedPath = result[0];
          if (!allowedDirectories.includes(selectedPath)) {
            const updatedDirectories = [...allowedDirectories, selectedPath];
            setAllowedDirectories(updatedDirectories);
            saveInternalCommandsSettingsWithDirectories(updatedDirectories);
          }
        }
      } catch (error) {
        console.error('Failed to browse for directory:', error);
        // Fallback to manual entry
        alert('Directory browser not available. Please enter the path manually.');
      }
    }
  };

  const saveInternalCommandsSettingsWithCommands = (commands: string[]) => {
    if (!formData) return;

    // Ensure internalCommands exists with defaults
    const defaultInternalCommands = {
      enabled: false,
      allowedDirectories: [],
      blockedCommands: [],
      fileReadLineLimit: 1000,
      fileWriteLineLimit: 50,
      defaultShell: 'bash',
      enabledCommands: {
        terminal: true,
        filesystem: true,
        textEditing: true,
        system: true
      },
      terminalSettings: {
        defaultTimeout: 30000,
        maxProcesses: 10,
        allowInteractiveShells: true,
      }
    };

    const updatedInternalCommands = {
      ...defaultInternalCommands,
      ...formData.internalCommands,
      enabled: internalCommandsEnabled,
      allowedDirectories,
      blockedCommands: commands,
      enabledCommands: enabledCommandCategories,
      enabledTools
    };

    // Update formData to trigger hasChanges and enable save button
    updateFormData({
      internalCommands: updatedInternalCommands
    });

    console.log('🔧 Internal commands settings updated with blocked commands:', commands);
  };

  const addBlockedCommand = () => {
    if (newBlockedCommand.trim() && !blockedCommands.includes(newBlockedCommand.trim())) {
      const updatedCommands = [...blockedCommands, newBlockedCommand.trim()];
      setBlockedCommands(updatedCommands);
      setNewBlockedCommand('');

      // Immediately save the settings with the updated commands
      saveInternalCommandsSettingsWithCommands(updatedCommands);
    }
  };

  const removeBlockedCommand = (index: number) => {
    const updatedCommands = blockedCommands.filter((_, i) => i !== index);
    setBlockedCommands(updatedCommands);

    // Immediately save the settings with the updated commands
    saveInternalCommandsSettingsWithCommands(updatedCommands);
  };

  const handleSave = async () => {
    if (!formData) return;

    setIsLoading(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Save general settings
      const success = await settingsService.updateSettings(formData);

      // Always save API keys if the save function is available
      let apiKeySaveSuccess = true;
      let apiKeyError: string | null = null;

      if (apiKeySaveRef.current) {
        try {
          console.log('🔐 SettingsOverlay: Triggering API key save via ref');
          await apiKeySaveRef.current();
          console.log('🔐 SettingsOverlay: API key save completed');
        } catch (error) {
          console.error('🔐 SettingsOverlay: Failed to save API keys:', error);
          apiKeySaveSuccess = false;
          apiKeyError = error instanceof Error ? error.message : 'Unknown API key save error';
        }
      }

      if (success && apiKeySaveSuccess) {
        setSettings(formData);
        // Always reset hasChanges after successful save
        setHasChanges(false);

        // Trigger model refresh for all components by dispatching a custom event
        console.log('🔄 Settings saved successfully - triggering model refresh');
        window.dispatchEvent(new CustomEvent('settingsSaved', {
          detail: {
            apiKeysSaved: apiKeySaveSuccess,
            provider: formData.chat?.provider
          }
        }));

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

        // Update internal commands configuration if it exists
        if (formData.internalCommands) {
          try {
            const { internalCommandService } = await import('../services/internalCommandService');
            await internalCommandService.updateConfiguration(formData.internalCommands);
            console.log('🔧 Internal commands configuration updated');
          } catch (error) {
            console.error('Failed to update internal commands configuration:', error);
          }
        }

        console.log('Settings saved successfully');
        setSaveSuccess(true);

        // Clear success message after 3 seconds
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const errorMessage = !success
          ? 'Failed to save general settings'
          : apiKeyError || 'Failed to save API keys';
        setSaveError(errorMessage);
        console.error('Failed to save settings:', errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred while saving settings';
      setSaveError(errorMessage);
      console.error('Error saving settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (settings) {
      setFormData(JSON.parse(JSON.stringify(settings))); // Reset to original
      setHasChanges(false);
      setSaveError(null);
      setSaveSuccess(false);
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

    // Clear any previous save errors when user starts making changes
    if (saveError) setSaveError(null);
    if (saveSuccess) setSaveSuccess(false);
  };

  // Handle color changes and integrate with save system
  const handleColorChange = (colors: Record<string, string>) => {
    // Update theme immediately for preview (don't save yet)
    if (typeof setCustomColors === 'function') {
      (setCustomColors as unknown as (colors: Record<string, string>, shouldSave: boolean) => void)(colors, false);
    }

    // Update form data to trigger save system
    if (formData) {
      updateFormData({
        ui: {
          ...formData.ui,
          customColors: colors as unknown as ColorSettings
        }
      });
    }
  };

  const handleUseCustomColorsChange = (enabled: boolean) => {
    // Update theme immediately for preview (don't save yet)
    if (typeof setUseCustomColors === 'function') {
      (setUseCustomColors as unknown as (enabled: boolean, shouldSave: boolean) => void)(enabled, false);
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

  const handleThemePresetChange = (theme: { id: string; name: string }) => {
    // Update theme immediately for preview (don't save yet)
    if (typeof setSelectedThemePreset === 'function') {
      (setSelectedThemePreset as unknown as (themeId: string, shouldSave: boolean) => void)(theme.id, false);
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
      (setColorMode as unknown as (mode: 'preset' | 'custom', shouldSave: boolean) => void)(mode, false);
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
    const initializeSettings = async () => {
      const loadedSettings = await loadSettings();
      await loadInternalCommandsSettings(loadedSettings);
    };
    initializeSettings();

    // Subscribe to settings changes to keep the overlay in sync
    const unsubscribe = settingsService.subscribe((newSettings) => {
      console.log('🔍 SettingsOverlay: Settings changed via subscription:', newSettings);
      setSettings(newSettings);
      // Only update form data if we don't have unsaved changes
      if (!hasChanges) {
        setFormData(JSON.parse(JSON.stringify(newSettings)));
      }
    });

    return unsubscribe;
  }, []); // Remove hasChanges dependency to prevent re-initialization loop

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
              onClick={() => setActiveTab('internal-commands')}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'internal-commands' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Commands
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
              <ApiKeySettings
                onApiKeyChange={() => {
                  // API keys changed - this is just for tracking, button is always enabled
                  setHasChanges(true);
                }}
                onRegisterSaveFunction={(saveFunction: () => Promise<void>) => {
                  // Register the API key save function so the main save button can use it
                  apiKeySaveRef.current = saveFunction;
                }}
              />
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

            {activeTab === 'internal-commands' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium mb-4">Internal Commands</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Configure internal command functionality that provides terminal, filesystem, and text editing capabilities to AI models.
                    These commands run within the application with directory-scoped security restrictions.
                  </p>

                  {/* Enable/Disable Internal Commands */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label htmlFor="internal-commands-enabled" className="text-sm font-medium">
                          Enable Internal Commands
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Allow AI models to execute terminal, filesystem, and text editing commands
                        </p>
                      </div>
                      <ToggleSwitch
                        enabled={internalCommandsEnabled}
                        onToggle={(enabled) => {
                          setInternalCommandsEnabled(enabled);
                          saveInternalCommandsSettings();
                        }}
                      />
                    </div>

                    {internalCommandsEnabled && (
                      <>
                        {/* Command Categories */}
                        <div className="border border-border rounded-lg p-4">
                          <h4 className="text-sm font-medium mb-3">Enabled Command Categories</h4>
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-sm">Terminal Commands</Label>
                                <p className="text-xs text-muted-foreground">Process execution, interactive shells, command output</p>
                              </div>
                              <ToggleSwitch
                                enabled={enabledCommandCategories.terminal}
                                onToggle={(enabled) => {
                                  setEnabledCommandCategories(prev => ({ ...prev, terminal: enabled }));
                                  saveInternalCommandsSettings();
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-sm">Filesystem Commands</Label>
                                <p className="text-xs text-muted-foreground">File operations, directory management, search capabilities</p>
                              </div>
                              <ToggleSwitch
                                enabled={enabledCommandCategories.filesystem}
                                onToggle={(enabled) => {
                                  setEnabledCommandCategories(prev => ({ ...prev, filesystem: enabled }));
                                  saveInternalCommandsSettings();
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <div>
                                <Label className="text-sm">Text Editing Commands</Label>
                                <p className="text-xs text-muted-foreground">Surgical text replacements with fuzzy search fallback</p>
                              </div>
                              <ToggleSwitch
                                enabled={enabledCommandCategories.textEditing}
                                onToggle={(enabled) => {
                                  setEnabledCommandCategories(prev => ({ ...prev, textEditing: enabled }));
                                  saveInternalCommandsSettings();
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Individual Tools */}
                        {availableTools.length > 0 && (
                          <div className="border border-border rounded-lg p-4">
                            <h4 className="text-sm font-medium mb-3">Individual Tools</h4>
                            <p className="text-xs text-muted-foreground mb-4">
                              Enable or disable specific tools. Tools are grouped by category and only available when their category is enabled.
                            </p>

                            <div className="space-y-4">
                              {/* Group tools by category */}
                              {['terminal', 'filesystem', 'textEditing'].map(category => {
                                const categoryTools = availableTools.filter(tool =>
                                  tool.category.toLowerCase() === category.toLowerCase()
                                );

                                if (categoryTools.length === 0) return null;

                                const categoryEnabled = enabledCommandCategories[category as keyof typeof enabledCommandCategories];

                                return (
                                  <div key={category} className="space-y-2">
                                    <h5 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                      {category === 'textEditing' ? 'Text Editing' : category.charAt(0).toUpperCase() + category.slice(1)} Tools
                                      {!categoryEnabled && <span className="ml-2 text-yellow-600">(Category Disabled)</span>}
                                    </h5>
                                    <div className="grid grid-cols-1 gap-2 pl-4">
                                      {categoryTools.map(tool => (
                                        <div key={tool.name} className={`flex items-center justify-between p-2 rounded ${!categoryEnabled ? 'opacity-50' : ''}`}>
                                          <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                              <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">{tool.name}</code>
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">{tool.description}</p>
                                          </div>
                                          <ToggleSwitch
                                            enabled={categoryEnabled && (enabledTools[tool.name] !== false)}
                                            onToggle={(enabled) => {
                                              setEnabledTools(prev => ({
                                                ...prev,
                                                [tool.name]: enabled
                                              }));
                                              saveInternalCommandsSettings();
                                            }}
                                            disabled={!categoryEnabled}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Allowed Directories */}
                        <div className="border border-border rounded-lg p-4">
                          <h4 className="text-sm font-medium mb-3">Allowed Directories</h4>
                          <p className="text-xs text-muted-foreground mb-3">
                            Specify directories where commands can operate. Leave empty to deny all filesystem access.
                          </p>

                          <div className="space-y-2 mb-3">
                            {allowedDirectories.map((dir, index) => (
                              <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                                <span className="flex-1 text-sm font-mono">{dir}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeAllowedDirectory(index)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter directory path..."
                              value={newDirectory}
                              onChange={(e) => setNewDirectory(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && addAllowedDirectory()}
                              className="flex-1"
                            />
                            <Button onClick={browseForDirectory} size="sm" variant="outline">
                              Browse
                            </Button>
                            <Button onClick={addAllowedDirectory} size="sm">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Blocked Commands */}
                        <div className="border border-border rounded-lg p-4">
                          <h4 className="text-sm font-medium mb-3">Blocked Commands</h4>
                          <p className="text-xs text-muted-foreground mb-3">
                            Commands or patterns that are blocked for security. These are checked against all terminal commands.
                          </p>

                          <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                            {blockedCommands.map((cmd, index) => (
                              <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                                <span className="flex-1 text-sm font-mono">{cmd}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeBlockedCommand(index)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter command pattern to block..."
                              value={newBlockedCommand}
                              onChange={(e) => setNewBlockedCommand(e.target.value)}
                              onKeyPress={(e) => e.key === 'Enter' && addBlockedCommand()}
                              className="flex-1"
                            />
                            <Button onClick={addBlockedCommand} size="sm">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Security Warning */}
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                          <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">Security Notice</h4>
                          <p className="text-xs text-yellow-700 dark:text-yellow-300">
                            Internal commands provide powerful capabilities to AI models. Only enable them if you trust the AI models you&apos;re using.
                            Always configure allowed directories to limit filesystem access to specific paths.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
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
                        <div className="flex items-center space-x-2">
                          <ToggleSwitch
                            enabled={formData.general.debugLogging || false}
                            onToggle={(enabled: boolean) => updateFormData({
                              general: { ...formData.general, debugLogging: enabled }
                            })}
                          />
                          <Label>Debug Logging</Label>
                          <p className="text-sm text-muted-foreground ml-2">
                            Enable detailed console logging for troubleshooting
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

            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                className="bg-muted/50 border-input hover:bg-muted/70 transition-colors"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isLoading}
                className="bg-primary text-primary-foreground"
              >
                {isLoading ? 'Saving...' : 'Save Settings'}
              </Button>
            </div>
          </div>

          {/* Error and Success Messages */}
          {saveError && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">❌ {saveError}</p>
            </div>
          )}

          {saveSuccess && (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
              <p className="text-sm text-green-600">✅ Settings saved successfully!</p>
            </div>
          )}

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
