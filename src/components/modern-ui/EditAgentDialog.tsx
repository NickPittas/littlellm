'use client';

import { useState, useEffect } from 'react';
import {
  Bot,
  Save,
  CheckCircle,
  Loader2,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '@/lib/utils';
import { AgentConfiguration, AgentTool, UpdateAgentRequest } from '../../types/agent';
import { agentService } from '../../services/agentService';
import { mcpService } from '../../services/mcpService';
import { llmService } from '../../services/llmService';
import { chatService } from '../../services/chatService';
import { secureApiKeyService } from '../../services/secureApiKeyService';

interface EditAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: AgentConfiguration;
  onSuccess: () => void;
}

export function EditAgentDialog({
  open,
  onOpenChange,
  agent,
  onSuccess
}: EditAgentDialogProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '🤖',
    userDescription: '',
    systemPrompt: '',
    defaultProvider: 'anthropic',
    defaultModel: 'claude-3-sonnet-20240229',
    temperature: 0.7,
    maxTokens: 4000,
    tags: [] as string[]
  });
  const [availableTools, setAvailableTools] = useState<AgentTool[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [availableMCPServers, setAvailableMCPServers] = useState<any[]>([]);
  const [selectedMCPServers, setSelectedMCPServers] = useState<string[]>([]);
  const [isRegeneratingPrompt, setIsRegeneratingPrompt] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);

  // Load data when dialog opens
  useEffect(() => {
    if (open && agent) {
      loadData();
      populateForm();
    }
  }, [open, agent]);

  const loadData = async () => {
    try {
      const [tools, mcpServers, providersData] = await Promise.all([
        agentService.getAvailableTools(),
        mcpService.getServers(),
        llmService.getProviders()
      ]);
      setAvailableTools(tools);
      setAvailableMCPServers(mcpServers);
      setProviders(providersData);

      // Validate agent
      const validation = await agentService.validateAgent(agent.id);
      setValidationResult(validation);

      // Load models for the agent's provider
      if (agent.defaultProvider) {
        await loadModelsForProvider(agent.defaultProvider);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  // Load models for a specific provider
  const loadModelsForProvider = async (providerId: string) => {
    try {
      setLoadingModels(true);
      setAvailableModels([]);

      // Get API key and base URL from secure storage
      let apiKey = '';
      let baseUrl = '';

      try {
        const apiKeyData = secureApiKeyService?.getApiKeyData(providerId);
        apiKey = apiKeyData?.apiKey || '';
        baseUrl = apiKeyData?.baseUrl || '';
      } catch (error) {
        console.warn(`Failed to get API key data for ${providerId}:`, error);
      }

      // Skip model loading for remote providers without API keys
      if (!apiKey && providerId !== 'ollama' && providerId !== 'lmstudio' && providerId !== 'n8n') {
        console.warn(`No API key found for ${providerId}, skipping model loading`);
        setAvailableModels([]);
        return;
      }

      // Fetch models using the chat service
      const models = await chatService.fetchModels(providerId, apiKey, baseUrl);
      console.log(`Loaded ${models.length} models for ${providerId}:`, models);

      setAvailableModels(models);
    } catch (error) {
      console.error('Failed to load models for provider:', providerId, error);
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const populateForm = () => {
    setFormData({
      name: agent.name,
      description: agent.description,
      icon: agent.icon || '🤖',
      userDescription: agent.userDescription || '',
      systemPrompt: agent.systemPrompt,
      defaultProvider: agent.defaultProvider,
      defaultModel: agent.defaultModel,
      temperature: agent.temperature || 0.7,
      maxTokens: agent.maxTokens || 4000,
      tags: agent.tags || []
    });
    setSelectedTools(agent.selectedTools.map(tool => tool.name));
    setSelectedMCPServers([...agent.enabledMCPServers]);
  };

  const handleRegeneratePrompt = async () => {
    if (!formData.userDescription.trim()) {
      alert('Please provide a description to regenerate the prompt.');
      return;
    }

    if (!formData.defaultModel.trim()) {
      alert('Please select or enter a model for prompt generation.');
      return;
    }

    setIsRegeneratingPrompt(true);
    try {
      const selectedToolObjects = availableTools.filter(tool =>
        selectedTools.includes(tool.name)
      );

      const response = await agentService.generatePrompt({
        userDescription: formData.userDescription,
        selectedTools: selectedToolObjects,
        agentName: formData.name,
        agentDescription: formData.description,
        provider: formData.defaultProvider,
        model: formData.defaultModel
      });

      if (response.success && response.generatedPrompt) {
        setFormData(prev => ({ ...prev, systemPrompt: response.generatedPrompt! }));
      } else {
        alert(`Failed to regenerate prompt: ${response.error}`);
      }
    } catch (error) {
      console.error('Failed to regenerate prompt:', error);
      alert('Failed to regenerate prompt. Please try again.');
    } finally {
      setIsRegeneratingPrompt(false);
    }
  };

  // Handle provider change
  const handleProviderChange = async (providerId: string) => {
    setFormData(prev => ({ ...prev, defaultProvider: providerId, defaultModel: '' }));
    await loadModelsForProvider(providerId);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const request: UpdateAgentRequest = {
        id: agent.id,
        name: formData.name,
        description: formData.description,
        icon: formData.icon,
        userDescription: formData.userDescription,
        systemPrompt: formData.systemPrompt,
        selectedTools,
        enabledMCPServers: selectedMCPServers,
        defaultProvider: formData.defaultProvider,
        defaultModel: formData.defaultModel,
        temperature: formData.temperature,
        maxTokens: formData.maxTokens,
        tags: formData.tags
      };

      const success = await agentService.updateAgent(request);
      if (success) {
        onSuccess();
        onOpenChange(false);
      } else {
        alert('Failed to update agent. Please try again.');
      }
    } catch (error) {
      console.error('Failed to update agent:', error);
      alert('Failed to update agent. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !formData.tags.includes(tag.trim())) {
      setFormData(prev => ({ ...prev, tags: [...prev.tags, tag.trim()] }));
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({ 
      ...prev, 
      tags: prev.tags.filter(tag => tag !== tagToRemove) 
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto bg-gray-950 border-gray-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Bot className="w-5 h-5" />
            Edit Agent: {agent.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Validation Warnings */}
          {validationResult && !validationResult.isValid && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium">Validation Issues</span>
              </div>
              <ul className="text-sm text-red-300 space-y-1">
                {validationResult.errors.map((error: string, index: number) => (
                  <li key={index}>• {error}</li>
                ))}
                {validationResult.warnings.map((warning: string, index: number) => (
                  <li key={index} className="text-yellow-300">• {warning}</li>
                ))}
              </ul>
            </div>
          )}

          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-gray-900">
              <TabsTrigger value="basic" className="text-gray-300">Basic Info</TabsTrigger>
              <TabsTrigger value="tools" className="text-gray-300">Tools & MCP</TabsTrigger>
              <TabsTrigger value="prompt" className="text-gray-300">System Prompt</TabsTrigger>
              <TabsTrigger value="settings" className="text-gray-300">Settings</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Agent Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="bg-gray-900 border-gray-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icon">Icon (Emoji)</Label>
                  <Input
                    id="icon"
                    value={formData.icon}
                    onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                    className="bg-gray-900 border-gray-700"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="bg-gray-900 border-gray-700"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="userDescription">Agent Purpose</Label>
                <Textarea
                  id="userDescription"
                  value={formData.userDescription}
                  onChange={(e) => setFormData(prev => ({ ...prev, userDescription: e.target.value }))}
                  placeholder="Describe what this agent should do..."
                  className="bg-gray-900 border-gray-700 min-h-[100px]"
                />
              </div>

              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag) => (
                    <Badge 
                      key={tag} 
                      variant="secondary" 
                      className="bg-gray-800 text-gray-300 cursor-pointer"
                      onClick={() => removeTag(tag)}
                    >
                      {tag} ×
                    </Badge>
                  ))}
                </div>
                <Input
                  placeholder="Add tag and press Enter"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      addTag(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                  className="bg-gray-900 border-gray-700"
                />
              </div>
            </TabsContent>

            <TabsContent value="tools" className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Available Tools</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-auto">
                  {availableTools.map((tool) => (
                    <Card 
                      key={tool.name}
                      className={cn(
                        "cursor-pointer border transition-colors bg-gray-900",
                        selectedTools.includes(tool.name) ? "border-blue-500 bg-blue-950/20" : "border-gray-700 hover:border-gray-600"
                      )}
                      onClick={() => {
                        setSelectedTools(prev => 
                          prev.includes(tool.name) 
                            ? prev.filter(t => t !== tool.name)
                            : [...prev, tool.name]
                        );
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-white">{tool.name}</h4>
                            <p className="text-sm text-gray-400 mt-1">{tool.description}</p>
                            <Badge variant="outline" className="mt-2 text-xs">
                              {tool.category}
                            </Badge>
                          </div>
                          {selectedTools.includes(tool.name) && (
                            <CheckCircle className="w-5 h-5 text-blue-400" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">MCP Servers</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-auto">
                  {availableMCPServers.map((server) => (
                    <Card 
                      key={server.id}
                      className={cn(
                        "cursor-pointer border transition-colors bg-gray-900",
                        selectedMCPServers.includes(server.id) ? "border-blue-500 bg-blue-950/20" : "border-gray-700 hover:border-gray-600"
                      )}
                      onClick={() => {
                        setSelectedMCPServers(prev => 
                          prev.includes(server.id) 
                            ? prev.filter(s => s !== server.id)
                            : [...prev, server.id]
                        );
                      }}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-medium text-white">{server.name}</h4>
                            <p className="text-sm text-gray-400 mt-1">{server.description || 'MCP Server'}</p>
                          </div>
                          {selectedMCPServers.includes(server.id) && (
                            <CheckCircle className="w-5 h-5 text-blue-400" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="prompt" className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="systemPrompt">System Prompt</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRegeneratePrompt}
                  disabled={isRegeneratingPrompt || !formData.userDescription.trim() || !formData.defaultModel.trim()}
                  className="border-purple-600 text-purple-400 hover:bg-purple-900/20"
                >
                  {isRegeneratingPrompt ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Regenerate
                    </>
                  )}
                </Button>
              </div>


              <Textarea
                id="systemPrompt"
                value={formData.systemPrompt}
                onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                placeholder="Enter the system prompt for this agent..."
                className="bg-gray-900 border-gray-700 min-h-[300px]"
              />
              <p className="text-xs text-gray-400">
                This prompt defines how the agent behaves and responds to user requests.
              </p>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="provider">Default Provider</Label>
                  <select
                    id="provider"
                    value={formData.defaultProvider}
                    onChange={(e) => handleProviderChange(e.target.value)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  >
                    {providers.map(provider => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Default Model</Label>
                  {loadingModels ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border border-gray-700 rounded">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-gray-400">Loading models...</span>
                    </div>
                  ) : availableModels.length > 0 ? (
                    <select
                      id="model"
                      value={formData.defaultModel}
                      onChange={(e) => setFormData(prev => ({ ...prev, defaultModel: e.target.value }))}
                      className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                    >
                      <option value="">Select a model</option>
                      {availableModels.map(model => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id="model"
                      value={formData.defaultModel}
                      onChange={(e) => setFormData(prev => ({ ...prev, defaultModel: e.target.value }))}
                      placeholder="Enter model name manually"
                      className="bg-gray-900 border-gray-700"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temperature">Temperature</Label>
                  <Input
                    id="temperature"
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={formData.temperature}
                    onChange={(e) => setFormData(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                    className="bg-gray-900 border-gray-700"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxTokens">Max Tokens</Label>
                  <Input
                    id="maxTokens"
                    type="number"
                    min="100"
                    max="32000"
                    value={formData.maxTokens}
                    onChange={(e) => setFormData(prev => ({ ...prev, maxTokens: parseInt(e.target.value) }))}
                    className="bg-gray-900 border-gray-700"
                  />
                </div>
              </div>

              <div className="bg-gray-900 rounded-lg p-4 space-y-2">
                <h4 className="font-medium text-white">Agent Statistics</h4>
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-400">
                  <div>Created: {agent.createdAt.toLocaleDateString()}</div>
                  <div>Updated: {agent.updatedAt.toLocaleDateString()}</div>
                  <div>Tools: {selectedTools.length}</div>
                  <div>MCP Servers: {selectedMCPServers.length}</div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t border-gray-800">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-gray-600 text-gray-300"
            >
              Cancel
            </Button>

            <Button
              onClick={handleSave}
              disabled={isSaving || !formData.name.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
