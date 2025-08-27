/* eslint-disable no-console */
'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ToggleSwitch } from '../ui/toggle-switch';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { settingsService, type AppSettings } from '../../services/settingsService';
import { MemoryManagement } from '../MemoryManagement';
import KnowledgeBaseSettings from '../KnowledgeBaseSettings';
import { mcpService, type MCPServer } from '../../services/mcpService';
import { PromptsContent } from '../PromptsContent';
import { ApiKeySettings } from '../ApiKeySettings';
import { getTTSService, type TTSVoice } from '../../services/textToSpeechService';
import type { TextToSpeechSettings } from '../../types/settings';
import { Plus, Trash2, Server, FileText, Palette, RotateCcw, X, Key, Keyboard, MessageSquare, Terminal, Brain, Database, Settings, Edit, Volume2 } from 'lucide-react';
import { ColorPicker } from '../ui/color-picker';
import { ThemeSelector } from '../ui/theme-selector';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '@/lib/utils';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const sidebarItems: SidebarItem[] = [
  { id: 'api-keys', label: 'API Keys', icon: <Key style={{ width: '16px', height: '16px' }} /> },
  { id: 'shortcuts', label: 'Shortcuts', icon: <Keyboard style={{ width: '16px', height: '16px' }} /> },
  { id: 'prompts', label: 'Prompts', icon: <FileText style={{ width: '16px', height: '16px' }} /> },
  { id: 'chat', label: 'Chat', icon: <MessageSquare style={{ width: '16px', height: '16px' }} /> },
  { id: 'text-to-speech', label: 'Text to Speech', icon: <Volume2 style={{ width: '16px', height: '16px' }} /> },
  { id: 'mcp', label: 'MCP', icon: <Server style={{ width: '16px', height: '16px' }} /> },
  { id: 'internal-commands', label: 'Commands', icon: <Terminal style={{ width: '16px', height: '16px' }} /> },
  { id: 'memory', label: 'Memory', icon: <Brain style={{ width: '16px', height: '16px' }} /> },
  { id: 'knowledge-base', label: 'Knowledge Base', icon: <Database style={{ width: '16px', height: '16px' }} /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className="w-4 h-4" /> },
  { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
];

export function SettingsModal({ isOpen, onClose, className }: SettingsModalProps) {
  // Copy all state from SettingsOverlay
  const [activeTab, setActiveTab] = useState('api-keys');
  const [formData, setFormData] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const apiKeySaveRef = useRef<(() => Promise<void>) | null>(null);
  const {
    customColors,
    setCustomColors,
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



  // TTS state
  const [availableVoices, setAvailableVoices] = useState<TTSVoice[]>([]);
  const [ttsSettings, setTtsSettings] = useState<TextToSpeechSettings>({
    enabled: false,
    voice: '',
    rate: 1.0,
    pitch: 1.0,
    volume: 0.8,
    autoPlay: false,
  });
  const [newDirectory, setNewDirectory] = useState('');
  const [newBlockedCommand, setNewBlockedCommand] = useState('');

  // Copy all utility functions from SettingsOverlay
  const updateFormData = (updates: Partial<AppSettings>) => {
    setFormData(prev => prev ? { ...prev, ...updates } : null);
    setHasChanges(true);
  };

  const loadMcpJson = async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        const jsonData = await window.electronAPI.getMCPServers();
        setMcpJsonContent(JSON.stringify(jsonData, null, 2));
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
          loadMcpServers();
        }
      }
    } catch (error) {
      console.error('Failed to save MCP JSON:', error);
    }
  };

  const loadMcpServers = async () => {
    try {
      const servers = await mcpService.getServers();
      setMcpServers(servers);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
      setMcpServers([]);
    }
  };

  const handleAddMcpServer = async () => {
    try {
      const success = await mcpService.addServer(newMcpServer);
      if (success) {
        setNewMcpServer({
          name: '',
          command: '',
          args: [],
          description: '',
          enabled: true,
          env: {}
        });
        setShowAddMcpServer(false);
        await loadMcpServers();
      }
    } catch (error) {
      console.error('Failed to add MCP server:', error);
    }
  };

  const handleUpdateMcpServer = async () => {
    if (!editingMcpServer) return;

    try {
      console.log('🔧 Updating MCP server:', editingMcpServer.id, newMcpServer);
      const success = await mcpService.updateServer(editingMcpServer.id, {
        name: newMcpServer.name,
        command: newMcpServer.command,
        args: newMcpServer.args,
        description: newMcpServer.description,
        enabled: newMcpServer.enabled,
        env: newMcpServer.env
      });

      if (success) {
        console.log('🔧 MCP server updated successfully');
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
        await loadMcpServers();
      } else {
        console.error('🔧 Failed to update MCP server - updateServer returned false');
      }
    } catch (error) {
      console.error('🔧 Failed to update MCP server:', error);
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

  const handleDeleteMcpServer = async (serverId: string) => {
    try {
      const success = await mcpService.removeServer(serverId);
      if (success) {
        await loadMcpServers();
      }
    } catch (error) {
      console.error('Failed to delete MCP server:', error);
    }
  };

  const handleToggleMcpServer = async (serverId: string, enabled: boolean) => {
    try {
      console.log('🔧 Toggling MCP server:', serverId, 'to enabled:', enabled);
      const success = await mcpService.updateServer(serverId, { enabled });
      console.log('🔧 MCP server toggle result:', success);
      if (success) {
        console.log('🔧 Reloading MCP servers after toggle...');
        await loadMcpServers();
      } else {
        console.error('🔧 Failed to toggle MCP server - updateServer returned false');
      }
    } catch (error) {
      console.error('🔧 Failed to toggle MCP server:', error);
    }
  };

  // Internal Commands functions
  const loadInternalCommandsSettings = async () => {
    try {
      const currentSettings = settingsService.getSettings();
      console.log('🔧 Loading internal commands settings:', currentSettings?.internalCommands);
      if (currentSettings?.internalCommands) {
        const enabled = currentSettings.internalCommands.enabled || false;
        const directories = currentSettings.internalCommands.allowedDirectories || [];
        const blocked = currentSettings.internalCommands.blockedCommands || [];
        const commands = currentSettings.internalCommands.enabledCommands || {
          terminal: true,
          filesystem: true,
          textEditing: true,
          system: true
        };
        const tools = currentSettings.internalCommands.enabledTools || {};

        setInternalCommandsEnabled(enabled);
        setAllowedDirectories(directories);
        setBlockedCommands(blocked);
        setEnabledCommandCategories(commands);
        setEnabledTools(tools);

        // Also update formData to ensure it's in sync
        setFormData(prev => prev ? {
          ...prev,
          internalCommands: {
            ...prev.internalCommands,
            enabled: enabled,
            allowedDirectories: directories,
            blockedCommands: blocked,
            enabledCommands: commands,
            enabledTools: tools
          }
        } : null);
      }
    } catch (error) {
      console.error('Failed to load internal commands settings:', error);
    }
  };

  const saveInternalCommandsSettings = async () => {
    try {
      const currentSettings = settingsService.getSettings();
      const updatedSettings = {
        ...currentSettings,
        internalCommands: {
          ...currentSettings.internalCommands,
          enabled: internalCommandsEnabled,
          allowedDirectories,
          blockedCommands,
          enabledCommands: enabledCommandCategories,
          enabledTools
        }
      };

      await settingsService.updateSettings(updatedSettings);
      console.log('Internal commands settings saved successfully');
    } catch (error) {
      console.error('Failed to save internal commands settings:', error);
    }
  };

  const saveInternalCommandsSettingsWithCommands = async (commands: { terminal: boolean; filesystem: boolean; textEditing: boolean; system: boolean }) => {
    try {
      const currentSettings = settingsService.getSettings();
      const updatedSettings = {
        ...currentSettings,
        internalCommands: {
          ...currentSettings.internalCommands,
          enabled: internalCommandsEnabled,
          allowedDirectories,
          blockedCommands,
          enabledCommands: commands,
          enabledTools
        }
      };

      await settingsService.updateSettings(updatedSettings);
      console.log('Internal commands settings with commands saved successfully');
    } catch (error) {
      console.error('Failed to save internal commands settings with commands:', error);
    }
  };

  const handleAddDirectory = () => {
    if (newDirectory.trim() && !allowedDirectories.includes(newDirectory.trim())) {
      const updatedDirectories = [...allowedDirectories, newDirectory.trim()];
      setAllowedDirectories(updatedDirectories);
      setNewDirectory('');
      setHasChanges(true);

      // Update formData with directory changes
      setFormData(prev => prev ? {
        ...prev,
        internalCommands: {
          ...prev.internalCommands,
          enabled: internalCommandsEnabled,
          allowedDirectories: updatedDirectories,
          blockedCommands: blockedCommands,
          enabledCommands: enabledCommandCategories,
          enabledTools: enabledTools
        }
      } : null);

      saveInternalCommandsSettings();
    }
  };

  const handleRemoveDirectory = (directory: string) => {
    const updatedDirectories = allowedDirectories.filter(d => d !== directory);
    setAllowedDirectories(updatedDirectories);
    setHasChanges(true);

    // Update formData with directory changes
    setFormData(prev => prev ? {
      ...prev,
      internalCommands: {
        ...prev.internalCommands,
        enabled: internalCommandsEnabled,
        allowedDirectories: updatedDirectories,
        blockedCommands: blockedCommands,
        enabledCommands: enabledCommandCategories,
        enabledTools: enabledTools
      }
    } : null);

    saveInternalCommandsSettings();
  };

  const handleAddBlockedCommand = () => {
    if (newBlockedCommand.trim() && !blockedCommands.includes(newBlockedCommand.trim())) {
      const updatedCommands = [...blockedCommands, newBlockedCommand.trim()];
      setBlockedCommands(updatedCommands);
      setNewBlockedCommand('');
      setHasChanges(true);

      // Update formData with blocked command changes
      setFormData(prev => prev ? {
        ...prev,
        internalCommands: {
          ...prev.internalCommands,
          enabled: internalCommandsEnabled,
          allowedDirectories: allowedDirectories,
          blockedCommands: updatedCommands,
          enabledCommands: enabledCommandCategories,
          enabledTools: enabledTools
        }
      } : null);

      saveInternalCommandsSettings();
    }
  };

  const handleRemoveBlockedCommand = (command: string) => {
    const updatedCommands = blockedCommands.filter(c => c !== command);
    setBlockedCommands(updatedCommands);
    setHasChanges(true);

    // Update formData with blocked command changes
    setFormData(prev => prev ? {
      ...prev,
      internalCommands: {
        ...prev.internalCommands,
        enabled: internalCommandsEnabled,
        allowedDirectories: allowedDirectories,
        blockedCommands: updatedCommands,
        enabledCommands: enabledCommandCategories,
        enabledTools: enabledTools
      }
    } : null);

    saveInternalCommandsSettings();
  };

  const handleCommandCategoryToggle = (category: string, enabled: boolean) => {
    const updatedCommands = {
      ...enabledCommandCategories,
      [category]: enabled
    };
    setEnabledCommandCategories(updatedCommands);
    setHasChanges(true);

    // Update formData with command category changes
    setFormData(prev => prev ? {
      ...prev,
      internalCommands: {
        ...prev.internalCommands,
        enabled: internalCommandsEnabled,
        allowedDirectories: allowedDirectories,
        blockedCommands: blockedCommands,
        enabledCommands: updatedCommands,
        enabledTools: enabledTools
      }
    } : null);

    // Immediately save the settings with the updated commands
    saveInternalCommandsSettingsWithCommands(updatedCommands);
  };

  const handleOpenMcpJsonEditor = () => {
    loadMcpJson();
  };

  // Main save function (copied from SettingsOverlay)
  const handleSave = async () => {
    if (!formData) {
      console.error('🔧 No formData to save');
      return;
    }

    console.log('🔧 Starting save process with formData:', formData);
    console.log('🔧 Theme data being saved:', formData.ui);

    setIsLoading(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      // Save general settings
      console.log('🔧 Calling settingsService.updateSettings...');
      const success = await settingsService.updateSettings(formData);
      console.log('🔧 Settings save result:', success);

      // Always save API keys if the save function is available
      let apiKeySaveSuccess = true;
      let apiKeyError: string | null = null;

      if (apiKeySaveRef.current) {
        try {
          console.log('🔐 SettingsModal: Triggering API key save via ref');
          await apiKeySaveRef.current();
          console.log('🔐 SettingsModal: API key save completed');
        } catch (error) {
          console.error('🔐 SettingsModal: Failed to save API keys:', error);
          apiKeySaveSuccess = false;
          apiKeyError = error instanceof Error ? error.message : 'Unknown API key save error';
        }
      }

      if (success && apiKeySaveSuccess) {
        console.log('🔄 Settings and API keys saved successfully');

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
          console.log('Settings modal: Preparing to notify theme change');

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
              }
            }

            console.log('Notifying theme change with colors:', colorsToApply);
            window.electronAPI.notifyThemeChange({
              customColors: colorsToApply,
              useCustomColors: currentMode === 'custom'
            });
          }
        }

        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);

        // Close the modal after successful save
        onClose();
      } else {
        if (!success) {
          setSaveError('Failed to save settings');
        }
        if (!apiKeySaveSuccess && apiKeyError) {
          setSaveError(apiKeyError);
        }
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Initialization (copied from SettingsOverlay)
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const currentSettings = settingsService.getSettings();
        setFormData(currentSettings);


      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    if (isOpen) {
      loadSettings();
      loadMcpServers();
      loadInternalCommandsSettings();
    }
  }, [isOpen]);

  // Load available internal command tools only
  useEffect(() => {
    const loadAvailableTools = async () => {
      try {
        if (typeof window !== 'undefined' && window.electronAPI) {
          console.log('🔧 SettingsModal: Loading internal command tools...');
          console.log('🔧 SettingsModal: electronAPI available:', !!window.electronAPI);
          console.log('🔧 SettingsModal: getInternalCommandsTools method exists:', typeof window.electronAPI.getInternalCommandsTools);

          // First, ensure configuration is sent to Electron main process
          const currentSettings = settingsService.getSettings();
          console.log('🔧 SettingsModal: Sending config to Electron:', currentSettings.internalCommands);
          await window.electronAPI.setInternalCommandsConfig(currentSettings.internalCommands);

          // Now load the tools
          const internalTools = await window.electronAPI.getInternalCommandsTools();
          console.log(`🔧 SettingsModal: Received ${(internalTools as any[])?.length || 0} internal command tools:`, internalTools);
          setAvailableTools((internalTools as Array<{
            name: string;
            description: string;
            category: string;
            inputSchema: Record<string, unknown>;
          }>) || []);
        } else {
          console.log('🔧 SettingsModal: No electronAPI available');
        }
      } catch (error) {
        console.error('Failed to load available tools:', error);
      }
    };

    if (isOpen) {
      loadAvailableTools();
    }
  }, [isOpen]);

  // Initialize TTS and load voices
  useEffect(() => {
    if (isOpen && formData?.ui) {
      // Ensure TTS settings exist with defaults
      const defaultTtsSettings = {
        enabled: false,
        voice: '',
        rate: 1.0,
        pitch: 1.0,
        volume: 0.8,
        autoPlay: false,
      };

      const ttsSettings = formData.ui.textToSpeech || defaultTtsSettings;
      setTtsSettings(ttsSettings);

      // If TTS settings don't exist in formData, add them
      if (!formData.ui.textToSpeech) {
        updateFormData({
          ui: {
            ...formData.ui,
            textToSpeech: defaultTtsSettings
          }
        });
      }

      // Initialize TTS service and load voices
      try {
        const ttsService = getTTSService(ttsSettings);
        const allVoices = ttsService.getAvailableVoices();
        const highQualityVoices = ttsService.getHighQualityVoices();
        const sortedVoices = ttsService.getAllVoicesWithQualityInfo();

        // Show all voices sorted by quality (don't filter too strictly)
        const voicesToShow = sortedVoices.length > 0 ? sortedVoices : allVoices;

        console.log('🔊 SettingsModal: Total voices:', allVoices.length);
        console.log('🔊 SettingsModal: High-quality voices:', highQualityVoices.length);
        console.log('🔊 SettingsModal: Showing voices (sorted):', voicesToShow.length);
        console.log('🔊 SettingsModal: Voice details:', voicesToShow.map(v => ({
          name: v.name,
          lang: v.lang,
          localService: v.localService
        })));

        setAvailableVoices(voicesToShow);

        // Set up voice change listener
        ttsService.onVoicesChanged(() => {
          const allUpdatedVoices = ttsService.getAvailableVoices();
          const highQualityUpdatedVoices = ttsService.getHighQualityVoices();
          const sortedUpdatedVoices = ttsService.getAllVoicesWithQualityInfo();
          const updatedVoicesToShow = sortedUpdatedVoices.length > 0 ? sortedUpdatedVoices : allUpdatedVoices;

          console.log('🔊 SettingsModal: Voices updated - Total:', allUpdatedVoices.length, 'High-quality:', highQualityUpdatedVoices.length);
          console.log('🔊 SettingsModal: Updated voice details:', updatedVoicesToShow.slice(0, 5).map(v => v.name));
          setAvailableVoices(updatedVoicesToShow);

          // If no voice is selected and voices are available, select the first high-quality one
          if (!ttsSettings.voice && updatedVoicesToShow.length > 0) {
            const newTtsSettings = {
              ...ttsSettings,
              voice: updatedVoicesToShow[0].name
            };
            setTtsSettings(newTtsSettings);
            updateFormData({
              ui: {
                ...formData.ui,
                textToSpeech: newTtsSettings
              }
            });
          }
        });
      } catch (error) {
        console.error('Failed to initialize TTS service:', error);
      }
    }
  }, [isOpen, formData?.ui]);

  if (!isOpen) return null;

  return (
    <div className={cn("flex h-full bg-background text-foreground", className)}>
      {/* Left Sidebar */}
      <div className="w-64 bg-muted/30 border-r border-border flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h2 className="text-sm font-semibold">Settings</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 hover:bg-muted"
          >
            <X style={{ width: '16px', height: '16px' }} />
          </Button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-1">
          <div className="space-y-0.5">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded-md transition-colors text-left",
                  activeTab === item.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Save/Cancel Buttons */}
        <div className="p-2 border-t border-border space-y-1 flex-shrink-0">
          {saveError && (
            <div className="text-xs text-destructive mb-1">{saveError}</div>
          )}
          {saveSuccess && (
            <div className="text-xs text-green-600 mb-1">Settings saved successfully!</div>
          )}
          <Button
            onClick={() => {
              console.log('🔧 Save button clicked - hasChanges:', hasChanges, 'formData:', formData);
              handleSave();
            }}
            disabled={isLoading || !hasChanges}
            className="w-full h-7 text-xs"
          >
            {isLoading ? 'Saving...' : 'Save Settings'}
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full h-7 text-xs"
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* API Keys Tab */}
          {activeTab === 'api-keys' && (
            <ApiKeySettings
              onApiKeyChange={() => setHasChanges(true)}
              onRegisterSaveFunction={(saveFunction: () => Promise<void>) => {
                apiKeySaveRef.current = saveFunction;
              }}
            />
          )}

          {/* Shortcuts Tab */}
          {activeTab === 'shortcuts' && formData?.shortcuts && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium mb-2">Keyboard Shortcuts</h3>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label htmlFor="toggle-window" className="text-xs">Toggle Window</Label>
                    <Input
                      id="toggle-window"
                      value={formData.shortcuts.toggleWindow}
                      placeholder="CommandOrControl+Shift+L"
                      className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                      onChange={(e) => updateFormData({
                        shortcuts: { ...formData.shortcuts, toggleWindow: e.target.value }
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="process-clipboard" className="text-xs">Process Clipboard</Label>
                    <Input
                      id="process-clipboard"
                      value={formData.shortcuts.processClipboard}
                      placeholder="CommandOrControl+Shift+V"
                      className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                      onChange={(e) => updateFormData({
                        shortcuts: { ...formData.shortcuts, processClipboard: e.target.value }
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="action-menu" className="text-xs">Action Menu</Label>
                    <Input
                      id="action-menu"
                      value={formData.shortcuts.actionMenu}
                      placeholder="CommandOrControl+Shift+Space"
                      className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                      onChange={(e) => updateFormData({
                        shortcuts: { ...formData.shortcuts, actionMenu: e.target.value }
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="open-shortcuts" className="text-xs">Open Shortcuts</Label>
                    <Input
                      id="open-shortcuts"
                      value={formData.shortcuts.openShortcuts}
                      placeholder="CommandOrControl+Shift+K"
                      className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                      onChange={(e) => updateFormData({
                        shortcuts: { ...formData.shortcuts, openShortcuts: e.target.value }
                      })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Prompts Tab */}
          {activeTab === 'prompts' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium mb-2">Prompts Management</h3>
                <PromptsContent onPromptSelect={() => {}} />
              </div>
            </div>
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium mb-2">Chat Configuration</h3>
                <div className="space-y-2">
                  {formData?.chat && (
                    <>
                      <div className="space-y-1">
                        <Label htmlFor="system-prompt" className="text-xs">Default System Prompt</Label>
                        <Textarea
                          id="system-prompt"
                          value={formData.chat.systemPrompt || ''}
                          placeholder="Enter your default system prompt that will be used for all conversations..."
                          rows={3}
                          className="text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                          onChange={(e) => updateFormData({
                            chat: { ...formData.chat, systemPrompt: e.target.value }
                          })}
                        />
                        <p className="text-xs text-muted-foreground">
                          This prompt will be sent with every conversation to set the AI behavior and personality.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="temperature" className="text-xs">Temperature</Label>
                          <Input
                            id="temperature"
                            type="number"
                            min="0"
                            max="2"
                            step="0.1"
                            value={formData.chat.temperature}
                            className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => updateFormData({
                              chat: { ...formData.chat, temperature: parseFloat(e.target.value) || 0 }
                            })}
                          />
                          <p className="text-xs text-muted-foreground">
                            Controls randomness (0.0 = focused, 2.0 = creative)
                          </p>
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="max-tokens" className="text-xs">Max Tokens</Label>
                          <Input
                            id="max-tokens"
                            type="number"
                            min="1"
                            max="32768"
                            value={formData.chat.maxTokens}
                            className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
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
                          size="sm"
                          enabled={formData.chat.toolCallingEnabled}
                          onToggle={(enabled: boolean) => updateFormData({
                            chat: { ...formData.chat, toolCallingEnabled: enabled }
                          })}
                        />
                        <div>
                          <Label className="text-xs">Enable Tool Calling</Label>
                          <p className="text-xs text-muted-foreground">
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

          {/* Text to Speech Tab */}
          {activeTab === 'text-to-speech' && formData?.ui?.textToSpeech && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium mb-2">Text to Speech</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <ToggleSwitch
                      size="sm"
                      enabled={ttsSettings.enabled}
                      onToggle={(enabled: boolean) => {
                        const newTtsSettings = { ...ttsSettings, enabled };
                        setTtsSettings(newTtsSettings);
                        updateFormData({
                          ui: {
                            ...formData.ui,
                            textToSpeech: newTtsSettings
                          }
                        });
                      }}
                    />
                    <div>
                      <Label className="text-xs">Enable Text to Speech</Label>
                      <p className="text-xs text-muted-foreground">
                        Enable voice synthesis for AI responses
                      </p>
                    </div>
                  </div>

                  {ttsSettings.enabled && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="voice-select">Voice</Label>
                        <Select
                          value={ttsSettings.voice}
                          onValueChange={(value) => {
                            const newTtsSettings = { ...ttsSettings, voice: value };
                            setTtsSettings(newTtsSettings);
                            updateFormData({
                              ui: {
                                ...formData.ui,
                                textToSpeech: newTtsSettings
                              }
                            });
                          }}
                        >
                          <SelectTrigger className="bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors">
                            <SelectValue placeholder="Select a voice" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableVoices.map((voice) => (
                              <SelectItem key={voice.name} value={voice.name}>
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {voice.name}
                                    {voice.name.toLowerCase().includes('google') && ' 🎯'}
                                    {voice.name.toLowerCase().includes('neural') && ' ⚡'}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {voice.lang} • {voice.localService ? 'Local' : 'Remote/Cloud'}
                                  </span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground">
                            Choose a voice for speech synthesis. 🎯 = Google voices, ⚡ = Neural voices. Remote/Cloud voices typically offer the best quality.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              try {
                                console.log('🔊 Manual voice refresh triggered');
                                const ttsService = getTTSService(ttsSettings);

                                // Force voice reload
                                if (typeof window !== 'undefined' && window.speechSynthesis) {
                                  // Cancel any ongoing speech
                                  window.speechSynthesis.cancel();

                                  // Trigger voice loading
                                  const voices = window.speechSynthesis.getVoices();
                                  console.log('🔊 Manual refresh: Found', voices.length, 'voices');

                                  // Update available voices
                                  const sortedVoices = ttsService.getAllVoicesWithQualityInfo();
                                  setAvailableVoices(sortedVoices);

                                  console.log('🔊 Manual refresh: Updated to', sortedVoices.length, 'voices');
                                }
                              } catch (error) {
                                console.error('🔊 Failed to refresh voices:', error);
                              }
                            }}
                            className="text-xs"
                          >
                            Refresh Voices
                          </Button>
                        </div>

                        {/* Voice count and help */}
                        <div className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <span>Available voices: {availableVoices.length}</span>
                            <span>
                              {availableVoices.filter(v => !v.localService).length} remote voices
                            </span>
                          </div>

                          {availableVoices.filter(v => v.name.toLowerCase().includes('google')).length === 0 && (
                            <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
                              <p className="font-medium text-yellow-400 mb-1">🚨 No Google Voices Found</p>
                              <p className="text-yellow-300">
                                Google voices (including Whisper-quality voices) are only available in Chrome browser, not in Electron apps.
                              </p>
                            </div>
                          )}

                          <div className="space-y-2">
                            <p className="font-medium">💡 To get Google voices:</p>
                            <ul className="space-y-1 ml-4">
                              <li>• <strong>Chrome Browser:</strong> Open this app in Chrome for Google cloud voices</li>
                              <li>• <strong>Windows Store:</strong> Download "Voice Recorder" app which installs premium voices</li>
                              <li>• <strong>Windows Settings:</strong> Settings → Time & Language → Speech → Manage voices</li>
                              <li>• <strong>Speech Platform:</strong> Download Microsoft Speech Platform Runtime + voices</li>
                            </ul>

                            <p className="mt-2 text-xs opacity-75">
                              <strong>Note:</strong> Electron apps are limited to locally installed voices. For the best voice selection,
                              consider running this app in Chrome browser where Google's cloud voices are available.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="speech-rate">Rate: {ttsSettings.rate.toFixed(1)}</Label>
                          <input
                            id="speech-rate"
                            type="range"
                            min="0.1"
                            max="3.0"
                            step="0.1"
                            value={ttsSettings.rate}
                            className="w-full"
                            onChange={(e) => {
                              const newTtsSettings = { ...ttsSettings, rate: parseFloat(e.target.value) };
                              setTtsSettings(newTtsSettings);
                              updateFormData({
                                ui: {
                                  ...formData.ui,
                                  textToSpeech: newTtsSettings
                                }
                              });
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            Speech speed (0.1 = very slow, 3.0 = very fast)
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="speech-pitch">Pitch: {ttsSettings.pitch.toFixed(1)}</Label>
                          <input
                            id="speech-pitch"
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={ttsSettings.pitch}
                            className="w-full"
                            onChange={(e) => {
                              const newTtsSettings = { ...ttsSettings, pitch: parseFloat(e.target.value) };
                              setTtsSettings(newTtsSettings);
                              updateFormData({
                                ui: {
                                  ...formData.ui,
                                  textToSpeech: newTtsSettings
                                }
                              });
                            }}
                          />
                          <p className="text-xs text-muted-foreground">
                            Voice pitch (0 = low, 2 = high)
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="speech-volume">Volume: {Math.round(ttsSettings.volume * 100)}%</Label>
                        <input
                          id="speech-volume"
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={ttsSettings.volume}
                          className="w-full"
                          onChange={(e) => {
                            const newTtsSettings = { ...ttsSettings, volume: parseFloat(e.target.value) };
                            setTtsSettings(newTtsSettings);
                            updateFormData({
                              ui: {
                                ...formData.ui,
                                textToSpeech: newTtsSettings
                              }
                            });
                          }}
                        />
                        <p className="text-xs text-muted-foreground">
                          Speech volume level
                        </p>
                      </div>

                      <div className="flex items-center space-x-2">
                        <ToggleSwitch
                          size="sm"
                          enabled={ttsSettings.autoPlay}
                          onToggle={(enabled: boolean) => {
                            const newTtsSettings = { ...ttsSettings, autoPlay: enabled };
                            setTtsSettings(newTtsSettings);
                            updateFormData({
                              ui: {
                                ...formData.ui,
                                textToSpeech: newTtsSettings
                              }
                            });
                          }}
                        />
                        <div>
                          <Label className="text-xs">Auto-play AI Responses</Label>
                          <p className="text-xs text-muted-foreground">
                            Automatically speak AI responses when they arrive
                          </p>
                        </div>
                      </div>

                      {/* Test Voice Button */}
                      <div className="pt-4 border-t border-border">
                        <Button
                          variant="outline"
                          onClick={() => {
                            try {
                              const ttsService = getTTSService(ttsSettings);
                              ttsService.speak("Hello! This is a test of the text to speech functionality. How does it sound?");
                            } catch (error) {
                              console.error('Failed to test TTS:', error);
                            }
                          }}
                          className="w-full"
                        >
                          <Volume2 className="w-4 h-4 mr-2" />
                          Test Voice
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* MCP Tab */}
          {activeTab === 'mcp' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium mb-2">MCP Servers</h3>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Configure Model Context Protocol (MCP) servers for enhanced functionality.
                  </p>

                  {/* Add Server Button */}
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-muted-foreground">
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

                  {/* Add New Server Form */}
                  {showAddMcpServer && !editingMcpServer && (
                    <div className="border border-border rounded-lg p-2 space-y-2 bg-background">
                      <h4 className="text-xs font-medium">Add New MCP Server</h4>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor="mcp-name" className="text-xs">Server Name</Label>
                          <Input
                            id="mcp-name"
                            value={newMcpServer.name}
                            placeholder="My MCP Server"
                            className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => setNewMcpServer(prev => ({ ...prev, name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor="mcp-command" className="text-xs">Command</Label>
                          <Input
                            id="mcp-command"
                            value={newMcpServer.command}
                            placeholder="node server.js"
                            className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                            onChange={(e) => setNewMcpServer(prev => ({ ...prev, command: e.target.value }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="mcp-description" className="text-xs">Description (Optional)</Label>
                        <Input
                          id="mcp-description"
                          value={newMcpServer.description}
                          placeholder="Description of what this server does"
                          className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                          onChange={(e) => setNewMcpServer(prev => ({ ...prev, description: e.target.value }))}
                        />
                      </div>

                      {/* Arguments Section */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Arguments</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addArgument}
                            className="h-6 text-xs flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Add Argument
                          </Button>
                        </div>
                        {newMcpServer.args.map((arg, index) => (
                          <div key={index} className="flex gap-1">
                            <Input
                              value={arg}
                              placeholder={`Argument ${index + 1}`}
                              className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                              onChange={(e) => updateArgument(index, e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeArgument(index)}
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        {newMcpServer.args.length === 0 && (
                          <p className="text-xs text-muted-foreground">No arguments configured</p>
                        )}
                      </div>

                      {/* Environment Variables Section */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Environment Variables</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={addEnvVariable}
                            className="h-6 text-xs flex items-center gap-1"
                          >
                            <Plus className="h-3 w-3" />
                            Add Variable
                          </Button>
                        </div>
                        {Object.entries(newMcpServer.env).map(([key, value]) => (
                          <div key={key} className="flex gap-1">
                            <Input
                              value={key}
                              placeholder="Variable name"
                              className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                              onChange={(e) => updateEnvVariable(key, e.target.value, value)}
                            />
                            <Input
                              value={value}
                              placeholder="Variable value"
                              className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                              onChange={(e) => updateEnvVariable(key, key, e.target.value)}
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeEnvVariable(key)}
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                        {Object.keys(newMcpServer.env).length === 0 && (
                          <p className="text-xs text-muted-foreground">No environment variables configured</p>
                        )}
                      </div>

                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
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
                          className="h-7 text-xs"
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleAddMcpServer}
                          size="sm"
                          className="h-7 text-xs"
                        >
                          Add Server
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Server List */}
                  <div className="space-y-2">
                    {mcpServers.map((server) => (
                      <div key={server.name}>
                        <div className="flex items-center justify-between p-2 border border-border rounded-lg bg-background">
                          <div className="flex items-center gap-2">
                            <Server className="h-3 w-3 text-muted-foreground" />
                            <div>
                              <div className="text-xs font-medium">{server.name}</div>
                              <div className="text-xs text-muted-foreground">{server.command}</div>
                              {server.description && (
                                <div className="text-xs text-muted-foreground">{server.description}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <ToggleSwitch
                              size="sm"
                              enabled={server.enabled}
                              onToggle={(enabled) => {
                                console.log('🔧 MCP Server toggle clicked:', server.name, 'id:', server.id, 'enabled:', enabled);
                                handleToggleMcpServer(server.id, enabled);
                              }}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                console.log('🔧 Edit MCP server:', server.name);
                                if (editingMcpServer?.id === server.id) {
                                  // If already editing this server, close the form
                                  setEditingMcpServer(null);
                                  setShowAddMcpServer(false);
                                } else {
                                  // Edit this server
                                  setEditingMcpServer(server);
                                  setNewMcpServer({
                                    name: server.name,
                                    command: server.command,
                                    args: server.args || [],
                                    description: server.description || '',
                                    enabled: server.enabled,
                                    env: server.env || {}
                                  });
                                  setShowAddMcpServer(true);
                                }
                              }}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteMcpServer(server.id)}
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Inline Edit Form - appears right below the server being edited */}
                        {editingMcpServer?.id === server.id && showAddMcpServer && (
                          <div className="mt-1 border border-border rounded-lg p-2 space-y-2 bg-muted/30">
                            <h4 className="text-xs font-medium">Edit MCP Server</h4>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <Label htmlFor="mcp-name" className="text-xs">Server Name</Label>
                                <Input
                                  id="mcp-name"
                                  value={newMcpServer.name}
                                  placeholder="My MCP Server"
                                  className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                                  onChange={(e) => setNewMcpServer(prev => ({ ...prev, name: e.target.value }))}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label htmlFor="mcp-command" className="text-xs">Command</Label>
                                <Input
                                  id="mcp-command"
                                  value={newMcpServer.command}
                                  placeholder="node server.js"
                                  className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                                  onChange={(e) => setNewMcpServer(prev => ({ ...prev, command: e.target.value }))}
                                />
                              </div>
                            </div>

                            <div className="space-y-1">
                              <Label htmlFor="mcp-description" className="text-xs">Description (Optional)</Label>
                              <Input
                                id="mcp-description"
                                value={newMcpServer.description}
                                placeholder="Description of what this server does"
                                className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                                onChange={(e) => setNewMcpServer(prev => ({ ...prev, description: e.target.value }))}
                              />
                            </div>

                            {/* Arguments Section */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Arguments</Label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={addArgument}
                                  className="h-6 text-xs flex items-center gap-1"
                                >
                                  <Plus className="h-3 w-3" />
                                  Add Argument
                                </Button>
                              </div>
                              {newMcpServer.args.map((arg, index) => (
                                <div key={index} className="flex gap-1">
                                  <Input
                                    value={arg}
                                    placeholder={`Argument ${index + 1}`}
                                    className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                                    onChange={(e) => updateArgument(index, e.target.value)}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeArgument(index)}
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              {newMcpServer.args.length === 0 && (
                                <p className="text-xs text-muted-foreground">No arguments configured</p>
                              )}
                            </div>

                            {/* Environment Variables Section */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <Label className="text-xs">Environment Variables</Label>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={addEnvVariable}
                                  className="h-6 text-xs flex items-center gap-1"
                                >
                                  <Plus className="h-3 w-3" />
                                  Add Variable
                                </Button>
                              </div>
                              {Object.entries(newMcpServer.env).map(([key, value]) => (
                                <div key={key} className="flex gap-1">
                                  <Input
                                    value={key}
                                    placeholder="Variable name"
                                    className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                                    onChange={(e) => updateEnvVariable(key, e.target.value, value)}
                                  />
                                  <Input
                                    value={value}
                                    placeholder="Variable value"
                                    className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                                    onChange={(e) => updateEnvVariable(key, key, e.target.value)}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeEnvVariable(key)}
                                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                              {Object.keys(newMcpServer.env).length === 0 && (
                                <p className="text-xs text-muted-foreground">No environment variables configured</p>
                              )}
                            </div>

                            <div className="flex justify-end gap-1">
                              <Button
                                variant="outline"
                                size="sm"
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
                                className="h-7 text-xs"
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleUpdateMcpServer}
                                size="sm"
                                className="h-7 text-xs"
                              >
                                Update Server
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {mcpServers.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No MCP servers configured. Add one to get started.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Internal Commands Tab */}
          {activeTab === 'internal-commands' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium mb-2">Internal Commands</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <ToggleSwitch
                      size="sm"
                      enabled={internalCommandsEnabled}
                      onToggle={(enabled) => {
                        setInternalCommandsEnabled(enabled);
                        setHasChanges(true);

                        // Update formData with internal commands changes
                        setFormData(prev => prev ? {
                          ...prev,
                          internalCommands: {
                            ...prev.internalCommands,
                            enabled: enabled,
                            allowedDirectories: allowedDirectories,
                            blockedCommands: blockedCommands,
                            enabledCommands: enabledCommandCategories,
                            enabledTools: enabledTools
                          }
                        } : null);

                        // Also save immediately
                        saveInternalCommandsSettings();
                      }}
                    />
                    <div>
                      <Label className="text-xs">Enable Internal Commands</Label>
                      <p className="text-xs text-muted-foreground">
                        Allow the AI to execute system commands and file operations
                      </p>
                    </div>
                  </div>

                  {internalCommandsEnabled && (
                    <>
                      <div className="space-y-1">
                        <Label className="text-xs">Command Categories</Label>
                        <div className="space-y-1">
                          {Object.entries(enabledCommandCategories).map(([category, enabled]) => (
                            <div key={category} className="flex items-center space-x-2">
                              <ToggleSwitch
                                size="sm"
                                enabled={enabled}
                                onToggle={(enabled) => handleCommandCategoryToggle(category, enabled)}
                              />
                              <Label className="text-xs capitalize">{category.replace(/([A-Z])/g, ' $1').trim()}</Label>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Allowed Directories</Label>
                        <div className="flex gap-1">
                          <Input
                            value={newDirectory}
                            onChange={(e) => setNewDirectory(e.target.value)}
                            placeholder="Enter directory path"
                            className="h-7 text-xs flex-1"
                          />
                          <Button
                            onClick={async () => {
                              if (typeof window !== 'undefined' && window.electronAPI) {
                                try {
                                  const selectedPath = await window.electronAPI.selectDirectory();
                                  if (selectedPath) {
                                    setNewDirectory(selectedPath);
                                  }
                                } catch (error) {
                                  console.error('Failed to select directory:', error);
                                }
                              }
                            }}
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                          >
                            Browse
                          </Button>
                          <Button
                            onClick={handleAddDirectory}
                            size="sm"
                            className="h-7 w-7 p-0"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="space-y-1">
                          {allowedDirectories.map((dir) => (
                            <div key={dir} className="flex items-center justify-between p-1 bg-muted rounded">
                              <span className="text-xs">{dir}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveDirectory(dir)}
                                className="h-6 w-6 p-0 text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Available Internal Command Tools Section - positioned after directories */}
                      <div className="space-y-1">
                        <Label className="text-xs">Available Internal Command Tools</Label>
                        <div className="max-h-64 overflow-y-auto space-y-1 border border-border rounded p-2 bg-muted/20">
                          {availableTools.length > 0 ? (
                            availableTools.map((tool) => (
                              <div key={tool.name} className="flex items-center justify-between p-2 bg-background rounded">
                                <div>
                                  <div className="text-xs font-medium">{tool.name}</div>
                                  <div className="text-xs text-muted-foreground">{tool.description}</div>
                                  <div className="text-xs text-muted-foreground">Category: {tool.category}</div>
                                </div>
                                <ToggleSwitch
                                  size="sm"
                                  enabled={enabledTools[tool.name] !== false}
                                  onToggle={(enabled) => {
                                    setEnabledTools(prev => ({
                                      ...prev,
                                      [tool.name]: enabled
                                    }));
                                    saveInternalCommandsSettings();
                                  }}
                                />
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-3 text-muted-foreground text-xs">
                              No internal command tools detected. Make sure internal commands are enabled and configured.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Blocked Commands</Label>
                        <div className="flex gap-1">
                          <Input
                            value={newBlockedCommand}
                            onChange={(e) => setNewBlockedCommand(e.target.value)}
                            placeholder="Enter command to block (e.g., rm, del)"
                            className="h-7 text-xs flex-1"
                          />
                          <Button
                            onClick={handleAddBlockedCommand}
                            size="sm"
                            className="h-7 w-7 p-0"
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="space-y-1">
                          {blockedCommands.map((cmd) => (
                            <div key={cmd} className="flex items-center justify-between p-1 bg-muted rounded">
                              <span className="text-xs">{cmd}</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveBlockedCommand(cmd)}
                                className="h-6 w-6 p-0 text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>


                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Memory Tab */}
          {activeTab === 'memory' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium mb-2">Memory Management</h3>
                <MemoryManagement />
              </div>
            </div>
          )}

          {/* Knowledge Base Tab */}
          {activeTab === 'knowledge-base' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium mb-2">Knowledge Base</h3>
                <KnowledgeBaseSettings />
              </div>
            </div>
          )}

          {/* Appearance Tab */}
          {activeTab === 'appearance' && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium mb-2">Appearance</h3>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Theme</Label>
                    <ThemeSelector
                      selectedThemeId={selectedThemePreset}
                      onThemeSelect={(theme) => {
                        setSelectedThemePreset(theme.id);
                        setHasChanges(true);

                        // Update formData with theme changes
                        setFormData(prev => prev ? {
                          ...prev,
                          ui: {
                            ...prev.ui,
                            selectedThemePreset: theme.id,
                            colorMode: 'preset',
                            customColors: theme.colors
                          }
                        } : null);

                        // Apply theme change immediately
                        if (typeof window !== 'undefined' && window.electronAPI) {
                          console.log('Applying theme preset change immediately:', theme.colors);
                          window.electronAPI.notifyThemeChange({
                            customColors: theme.colors,
                            useCustomColors: false
                          });
                        }
                      }}
                    />
                  </div>


                  <div className="space-y-2">
                    <Label>Color Mode</Label>
                    <Select
                      value={colorMode}
                      onValueChange={(value: 'preset' | 'custom') => {
                        setColorMode(value);
                        setHasChanges(true);

                        // Determine colors to apply
                        let colorsToApply = customColors;
                        if (value === 'preset') {
                          const preset = themePresets.find(p => p.id === selectedThemePreset);
                          if (preset) {
                            colorsToApply = preset.colors;
                          }
                        }

                        // Update formData with theme changes
                        setFormData(prev => prev ? {
                          ...prev,
                          ui: {
                            ...prev.ui,
                            colorMode: value,
                            selectedThemePreset: selectedThemePreset,
                            customColors: colorsToApply,
                            useCustomColors: value === 'custom'
                          }
                        } : null);

                        // Apply theme change immediately
                        if (typeof window !== 'undefined' && window.electronAPI) {
                          console.log('Applying theme change immediately:', colorsToApply);
                          window.electronAPI.notifyThemeChange({
                            customColors: colorsToApply,
                            useCustomColors: value === 'custom'
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="bg-muted/80 border-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="preset">Use Theme Preset</SelectItem>
                        <SelectItem value="custom">Custom Colors</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {colorMode === 'custom' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Background</Label>
                          <ColorPicker
                            value={customColors.background}
                            onChange={(color) => {
                              const newColors = { ...customColors, background: color };
                              setCustomColors(newColors);
                              setHasChanges(true);

                              // Update formData with custom color changes
                              setFormData(prev => prev ? {
                                ...prev,
                                ui: {
                                  ...prev.ui,
                                  customColors: newColors,
                                  colorMode: 'custom',
                                  useCustomColors: true
                                }
                              } : null);

                              // Apply color change immediately
                              if (typeof window !== 'undefined' && window.electronAPI) {
                                console.log('Applying background color change immediately:', newColors);
                                window.electronAPI.notifyThemeChange({
                                  customColors: newColors,
                                  useCustomColors: true
                                });
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Foreground</Label>
                          <ColorPicker
                            value={customColors.foreground}
                            onChange={(color) => {
                              const newColors = { ...customColors, foreground: color };
                              setCustomColors(newColors);
                              setHasChanges(true);

                              // Update formData with custom color changes
                              setFormData(prev => prev ? {
                                ...prev,
                                ui: {
                                  ...prev.ui,
                                  customColors: newColors,
                                  colorMode: 'custom',
                                  useCustomColors: true
                                }
                              } : null);

                              // Apply color change immediately
                              if (typeof window !== 'undefined' && window.electronAPI) {
                                console.log('Applying foreground color change immediately:', newColors);
                                window.electronAPI.notifyThemeChange({
                                  customColors: newColors,
                                  useCustomColors: true
                                });
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Primary</Label>
                          <ColorPicker
                            value={customColors.primary}
                            onChange={(color) => {
                              const newColors = { ...customColors, primary: color };
                              setCustomColors(newColors);
                              setHasChanges(true);

                              // Update formData with custom color changes
                              setFormData(prev => prev ? {
                                ...prev,
                                ui: {
                                  ...prev.ui,
                                  customColors: newColors,
                                  colorMode: 'custom',
                                  useCustomColors: true
                                }
                              } : null);

                              // Apply color change immediately
                              if (typeof window !== 'undefined' && window.electronAPI) {
                                console.log('Applying primary color change immediately:', newColors);
                                window.electronAPI.notifyThemeChange({
                                  customColors: newColors,
                                  useCustomColors: true
                                });
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Secondary</Label>
                          <ColorPicker
                            value={customColors.secondary}
                            onChange={(color) => {
                              const newColors = { ...customColors, secondary: color };
                              setCustomColors(newColors);
                              setHasChanges(true);

                              // Update formData with custom color changes
                              setFormData(prev => prev ? {
                                ...prev,
                                ui: {
                                  ...prev.ui,
                                  customColors: newColors,
                                  colorMode: 'custom',
                                  useCustomColors: true
                                }
                              } : null);

                              // Apply color change immediately
                              if (typeof window !== 'undefined' && window.electronAPI) {
                                console.log('Applying secondary color change immediately:', newColors);
                                window.electronAPI.notifyThemeChange({
                                  customColors: newColors,
                                  useCustomColors: true
                                });
                              }
                            }}
                          />
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        onClick={resetToDefaults}
                        className="flex items-center gap-2"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Reset to Defaults
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* General Tab */}
          {activeTab === 'general' && formData?.general && (
            <div className="space-y-3">
              <div>
                <h3 className="text-sm font-medium mb-2">General Settings</h3>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <ToggleSwitch
                      size="sm"
                      enabled={formData.general.autoStartWithSystem}
                      onToggle={(enabled) => updateFormData({
                        general: { ...formData.general, autoStartWithSystem: enabled }
                      })}
                    />
                    <div>
                      <Label className="text-xs">Auto-start with system</Label>
                      <p className="text-xs text-muted-foreground">
                        Launch LittleLLM automatically when your computer starts
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <ToggleSwitch
                      size="sm"
                      enabled={formData.general.showNotifications}
                      onToggle={(enabled) => updateFormData({
                        general: { ...formData.general, showNotifications: enabled }
                      })}
                    />
                    <div>
                      <Label className="text-xs">Show notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Display system notifications for important events
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <ToggleSwitch
                      size="sm"
                      enabled={formData.general.saveConversationHistory}
                      onToggle={(enabled) => updateFormData({
                        general: { ...formData.general, saveConversationHistory: enabled }
                      })}
                    />
                    <div>
                      <Label className="text-xs">Save conversation history</Label>
                      <p className="text-xs text-muted-foreground">
                        Keep a record of your conversations for future reference
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="history-length" className="text-xs">Conversation history length</Label>
                    <Input
                      id="history-length"
                      type="number"
                      min="1"
                      max="100"
                      value={formData.general.conversationHistoryLength}
                      className="h-7 text-xs bg-muted/80 border-input focus:bg-muted hover:bg-muted/90 transition-colors"
                      onChange={(e) => updateFormData({
                        general: { ...formData.general, conversationHistoryLength: parseInt(e.target.value) || 10 }
                      })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of recent conversations to keep in history
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <ToggleSwitch
                      size="sm"
                      enabled={formData.general.debugLogging}
                      onToggle={(enabled) => updateFormData({
                        general: { ...formData.general, debugLogging: enabled }
                      })}
                    />
                    <div>
                      <Label className="text-xs">Debug logging</Label>
                      <p className="text-xs text-muted-foreground">
                        Enable detailed logging for troubleshooting
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MCP JSON Editor Dialog */}
      {showMcpJsonEditor && (
        <Dialog open={showMcpJsonEditor} onOpenChange={setShowMcpJsonEditor}>
          <DialogContent className="max-w-6xl w-[90vw] max-h-[90vh] h-[80vh] flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Edit MCP Configuration</DialogTitle>
            </DialogHeader>
            <div className="flex-1 flex flex-col space-y-4 min-h-0">
              <div className="flex-1 min-h-0">
                <Textarea
                  value={mcpJsonContent}
                  onChange={(e) => setMcpJsonContent(e.target.value)}
                  className="font-mono text-sm h-full resize-none overflow-auto"
                  placeholder="MCP configuration JSON..."
                />
              </div>
              <div className="flex justify-end gap-2 flex-shrink-0">
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
      )}
    </div>
  );
}
