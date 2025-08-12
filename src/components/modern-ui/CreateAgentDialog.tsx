'use client';

import { useState, useEffect } from 'react';
import {
  Bot,
  CheckCircle,
  Loader2,
  Sparkles
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { AgentTemplate, AgentTool, CreateAgentRequest } from '../../types/agent';
import { agentService } from '../../services/agentService';
import { llmService } from '../../services/llmService';
import { chatService } from '../../services/chatService';
import { secureApiKeyService } from '../../services/secureApiKeyService';

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('../../services/debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}
interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  templates: AgentTemplate[];
}

export function CreateAgentDialog({
  open,
  onOpenChange,
  onSuccess,
  templates
}: CreateAgentDialogProps) {
  const [step, setStep] = useState<'template' | 'configure' | 'tools' | 'prompt' | 'review'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '🤖',
    userDescription: '',
    defaultProvider: 'anthropic',
    defaultModel: 'claude-3-sonnet-20240229',
    temperature: 0.7,
    maxTokens: 4000,
    tags: [] as string[]
  });
  const [availableTools, setAvailableTools] = useState<AgentTool[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  // Load data when dialog opens
  useEffect(() => {
    if (open) {
      loadData();
      resetForm();
    }
  }, [open]);

  const loadData = async () => {
    try {
      const [tools, providersData] = await Promise.all([
        agentService.getAvailableTools(),
        llmService.getProviders()
      ]);
      setAvailableTools(tools);
      setProviders(providersData);

      // Load models for the default provider
      if (formData.defaultProvider) {
        await loadModelsForProvider(formData.defaultProvider);
      }
    } catch (error) {
      safeDebugLog('error', 'CREATEAGENTDIALOG', 'Failed to load data:', error);
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
        safeDebugLog('warn', 'CREATEAGENTDIALOG', `Failed to get API key data for ${providerId}:`, error);
      }

      // Skip model loading for remote providers without API keys
      if (!apiKey && providerId !== 'ollama' && providerId !== 'lmstudio' && providerId !== 'n8n') {
        safeDebugLog('warn', 'CREATEAGENTDIALOG', `No API key found for ${providerId}, skipping model loading`);
        setAvailableModels([]);
        return;
      }

      // Fetch models using the chat service
      const models = await chatService.fetchModels(providerId, apiKey, baseUrl);
      safeDebugLog('info', 'CREATEAGENTDIALOG', `Loaded ${models.length} models for ${providerId}:`, models);

      setAvailableModels(models);

      // Auto-select first model if none selected
      if (models.length > 0 && !formData.defaultModel) {
        setFormData(prev => ({ ...prev, defaultModel: models[0] }));
      }
    } catch (error) {
      safeDebugLog('error', 'CREATEAGENTDIALOG', 'Failed to load models for provider:', providerId, error);
      setAvailableModels([]);
    } finally {
      setLoadingModels(false);
    }
  };

  const resetForm = () => {
    setStep('template');
    setSelectedTemplate(null);
    setFormData({
      name: '',
      description: '',
      icon: '🤖',
      userDescription: '',
      defaultProvider: 'anthropic',
      defaultModel: 'claude-3-sonnet-20240229',
      temperature: 0.7,
      maxTokens: 4000,
      tags: []
    });
    setSelectedTools([]);
    setGeneratedPrompt('');
  };

  const handleTemplateSelect = (template: AgentTemplate | null) => {
    setSelectedTemplate(template);
    if (template) {
      setFormData(prev => ({
        ...prev,
        name: template.name,
        description: template.description,
        icon: template.icon,
        defaultProvider: template.defaultProvider || 'anthropic',
        defaultModel: template.defaultModel || 'claude-3-sonnet-20240229',
        temperature: template.temperature || 0.7,
        maxTokens: template.maxTokens || 4000,
        tags: [template.category]
      }));
      setSelectedTools(template.suggestedTools);
    }
    setStep('configure');
  };

  const handleGeneratePrompt = async () => {
    if (!formData.userDescription.trim()) {
      alert('Please provide a description of what you want the agent to do.');
      return;
    }

    if (!formData.defaultModel.trim()) {
      alert('Please select or enter a model for prompt generation.');
      return;
    }

    setIsGeneratingPrompt(true);
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
        setGeneratedPrompt(response.generatedPrompt);
        setStep('review');
      } else {
        const errorMessage = response.error || 'Unknown error occurred';
        safeDebugLog('error', 'CREATEAGENTDIALOG', 'Prompt generation failed:', errorMessage);
        alert(`Failed to generate prompt: ${errorMessage}`);
      }
    } catch (error) {
      safeDebugLog('error', 'CREATEAGENTDIALOG', 'Failed to generate prompt:', error);
      alert('Failed to generate prompt. Please try again.');
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  // Handle provider change
  const handleProviderChange = async (providerId: string) => {
    setFormData(prev => ({ ...prev, defaultProvider: providerId, defaultModel: '' }));
    await loadModelsForProvider(providerId);
  };

  // Toggle tool description expansion
  const toggleToolExpansion = (toolName: string) => {
    setExpandedTools(prev => {
      const newSet = new Set(prev);
      if (newSet.has(toolName)) {
        newSet.delete(toolName);
      } else {
        newSet.add(toolName);
      }
      return newSet;
    });
  };



  const handleCreateAgent = async () => {
    setIsCreating(true);
    try {
      const request: CreateAgentRequest = {
        name: formData.name,
        description: formData.description,
        icon: formData.icon,
        userDescription: formData.userDescription,
        selectedTools,
        enabledMCPServers: [], // Empty for now - tools are unified
        defaultProvider: formData.defaultProvider,
        defaultModel: formData.defaultModel,
        temperature: formData.temperature,
        maxTokens: formData.maxTokens,
        tags: formData.tags
      };

      const agentId = await agentService.createAgent(request);
      
      // Update with generated prompt if available
      if (generatedPrompt) {
        await agentService.updateAgent({
          id: agentId,
          systemPrompt: generatedPrompt
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      safeDebugLog('error', 'CREATEAGENTDIALOG', 'Failed to create agent:', error);
      alert('Failed to create agent. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const renderTemplateStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-lg font-semibold mb-2">Choose a Template</h3>
        <p className="text-gray-400 text-sm">Start with a template or create from scratch</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {/* Custom Agent Option */}
        <Card
          className={cn(
            "cursor-pointer border-2 transition-colors bg-gray-900",
            !selectedTemplate ? "border-blue-500" : "border-gray-700 hover:border-gray-600"
          )}
          onClick={() => handleTemplateSelect(null)}
        >
          <CardHeader className="text-center p-4">
            <div className="text-2xl mb-1">⚡</div>
            <CardTitle className="text-white text-sm">Custom Agent</CardTitle>
            <CardDescription className="text-xs">Create from scratch</CardDescription>
          </CardHeader>
        </Card>

        {/* Template Options */}
        {templates.map((template) => (
          <Card
            key={template.id}
            className={cn(
              "cursor-pointer border-2 transition-colors bg-gray-900",
              selectedTemplate?.id === template.id ? "border-blue-500" : "border-gray-700 hover:border-gray-600"
            )}
            onClick={() => handleTemplateSelect(template)}
          >
            <CardHeader className="text-center p-4">
              <div className="text-2xl mb-1">{template.icon}</div>
              <CardTitle className="text-white text-sm">{template.name}</CardTitle>
              <CardDescription className="text-xs line-clamp-2">{template.description}</CardDescription>
              <Badge variant="secondary" className="w-fit mx-auto mt-1 text-xs">
                {template.category}
              </Badge>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderConfigureStep = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Agent Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="My Custom Agent"
            className="bg-gray-900 border-gray-700"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="icon">Icon (Emoji)</Label>
          <Input
            id="icon"
            value={formData.icon}
            onChange={(e) => setFormData(prev => ({ ...prev, icon: e.target.value }))}
            placeholder="🤖"
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
          placeholder="Brief description of what this agent does"
          className="bg-gray-900 border-gray-700"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="userDescription">Agent Purpose</Label>
        <Textarea
          id="userDescription"
          value={formData.userDescription}
          onChange={(e) => setFormData(prev => ({ ...prev, userDescription: e.target.value }))}
          placeholder="Describe in detail what you want this agent to do and how it should behave..."
          className="bg-gray-900 border-gray-700 min-h-[100px]"
        />
        <p className="text-xs text-gray-400">
          This description will be used to generate a specialized system prompt for your agent.
        </p>
      </div>

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
    </div>
  );

  const renderToolsStep = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Select Tools</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {availableTools.map((tool) => (
            <Card
              key={tool.name}
              className={cn(
                "border transition-colors bg-gray-900",
                selectedTools.includes(tool.name) ? "border-blue-500 bg-blue-950/20" : "border-gray-700 hover:border-gray-600"
              )}
            >
              <CardContent className="p-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-white text-sm truncate flex-1">{tool.name}</h4>
                    {selectedTools.includes(tool.name) && (
                      <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0 ml-1" />
                    )}
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTools(prev =>
                          prev.includes(tool.name)
                            ? prev.filter(t => t !== tool.name)
                            : [...prev, tool.name]
                        );
                      }}
                      className={cn(
                        "text-xs h-6 flex-1",
                        selectedTools.includes(tool.name)
                          ? "bg-blue-600 border-blue-600 text-white hover:bg-blue-700"
                          : "border-gray-600 text-gray-300 hover:bg-gray-800"
                      )}
                    >
                      {selectedTools.includes(tool.name) ? 'Selected' : 'Select'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleToolExpansion(tool.name)}
                      className="text-xs h-6 px-2 text-gray-400 hover:text-white"
                    >
                      {expandedTools.has(tool.name) ? '−' : '+'}
                    </Button>
                  </div>

                  {expandedTools.has(tool.name) && (
                    <div className="space-y-1">
                      <p className="text-xs text-gray-400">{tool.description}</p>
                      <Badge variant="outline" className="text-xs">
                        {tool.category}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>


    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto bg-gray-950 border-gray-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Bot className="w-5 h-5" />
            Create Custom Agent
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Steps */}
          <div className="flex items-center justify-center space-x-4">
            {['template', 'configure', 'tools', 'prompt', 'review'].map((stepName, index) => (
              <div key={stepName} className="flex items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  step === stepName ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"
                )}>
                  {index + 1}
                </div>
                {index < 4 && <div className="w-8 h-px bg-gray-700 mx-2" />}
              </div>
            ))}
          </div>

          {/* Step Content */}
          {step === 'template' && renderTemplateStep()}
          {step === 'configure' && renderConfigureStep()}
          {step === 'tools' && renderToolsStep()}
          
          {step === 'prompt' && (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Generate System Prompt</h3>
                <p className="text-gray-400 text-sm">AI will create a specialized prompt based on your configuration</p>
              </div>



              <div className="flex justify-center">
                <Button
                  onClick={handleGeneratePrompt}
                  disabled={isGeneratingPrompt || !formData.userDescription.trim() || !formData.defaultModel.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isGeneratingPrompt ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Generate Prompt
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Review & Create</h3>
              
              <div className="bg-gray-900 rounded-lg p-4 space-y-3">
                <div><strong>Name:</strong> {formData.name}</div>
                <div><strong>Description:</strong> {formData.description}</div>
                <div><strong>Tools:</strong> {selectedTools.length} selected</div>
                <div><strong>Provider:</strong> {formData.defaultProvider}</div>
              </div>

              {generatedPrompt && (
                <div className="space-y-2">
                  <Label>Generated System Prompt</Label>
                  <Textarea
                    value={generatedPrompt}
                    onChange={(e) => setGeneratedPrompt(e.target.value)}
                    className="bg-gray-900 border-gray-700 min-h-[150px]"
                  />
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between pt-4 border-t border-gray-800">
            <Button
              variant="outline"
              onClick={() => {
                if (step === 'template') {
                  onOpenChange(false);
                } else if (step === 'configure') {
                  setStep('template');
                } else if (step === 'tools') {
                  setStep('configure');
                } else if (step === 'prompt') {
                  setStep('tools');
                } else if (step === 'review') {
                  setStep('prompt');
                }
              }}
              className="border-gray-600 text-gray-300"
            >
              {step === 'template' ? 'Cancel' : 'Back'}
            </Button>

            <Button
              onClick={() => {
                if (step === 'template') {
                  // Template step requires selection
                  return;
                } else if (step === 'configure') {
                  setStep('tools');
                } else if (step === 'tools') {
                  setStep('prompt');
                } else if (step === 'prompt') {
                  // Generate prompt step
                  return;
                } else if (step === 'review') {
                  handleCreateAgent();
                }
              }}
              disabled={
                (step === 'template') ||
                (step === 'configure' && (!formData.name.trim() || !formData.userDescription.trim())) ||
                (step === 'prompt') ||
                (step === 'review' && isCreating)
              }
              className="bg-blue-600 hover:bg-blue-700"
            >
              {step === 'review' ? (
                isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Agent'
                )
              ) : (
                'Next'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
