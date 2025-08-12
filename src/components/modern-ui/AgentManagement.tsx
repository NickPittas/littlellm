'use client';

import { useState, useEffect } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Copy, 
  Download, 
  Upload, 
  Search,
  Filter,
  Bot,
  Play
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '@/lib/utils';
import { AgentConfiguration, AgentTemplate } from '../../types/agent';
import { agentService } from '../../services/agentService';
import { CreateAgentDialog } from './CreateAgentDialog';
import { EditAgentDialog } from './EditAgentDialog';

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

interface AgentManagementProps {
  className?: string;
  onAgentSelect?: (agent: AgentConfiguration) => void;
  onClose?: () => void;
}

export function AgentManagement({
  className,
  onAgentSelect,
  onClose
}: AgentManagementProps) {
  const [agents, setAgents] = useState<AgentConfiguration[]>([]);
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentConfiguration | null>(null);
  const [loading, setLoading] = useState(true);

  // Load agents and templates
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [agentsData, templatesData] = await Promise.all([
        agentService.getAgents(),
        agentService.getTemplates()
      ]);
      setAgents(agentsData);
      setTemplates(templatesData);
    } catch (error) {
      safeDebugLog('error', 'AGENT_MANAGEMENT', 'Failed to load agent data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter agents based on search and category
  const filteredAgents = agents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         agent.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (agent.tags || []).some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || 
                           (agent.tags || []).includes(selectedCategory);
    
    return matchesSearch && matchesCategory;
  });

  // Get unique categories from agents
  const categories = ['all', ...new Set(agents.flatMap(agent => agent.tags || []))];

  const handleCreateAgent = async () => {
    await loadData();
    setCreateDialogOpen(false);
  };

  const handleEditAgent = (agent: AgentConfiguration) => {
    setSelectedAgent(agent);
    setEditDialogOpen(true);
  };

  const handleUpdateAgent = async () => {
    await loadData();
    setEditDialogOpen(false);
    setSelectedAgent(null);
  };

  const handleDeleteAgent = async (agent: AgentConfiguration) => {
    if (confirm(`Are you sure you want to delete "${agent.name}"?`)) {
      try {
        await agentService.deleteAgent(agent.id);
        await loadData();
      } catch (error) {
        safeDebugLog('error', 'AGENT_MANAGEMENT', 'Failed to delete agent:', error);
      }
    }
  };

  const handleDuplicateAgent = async (agent: AgentConfiguration) => {
    try {
      await agentService.duplicateAgent(agent.id);
      await loadData();
    } catch (error) {
      safeDebugLog('error', 'AGENT_MANAGEMENT', 'Failed to duplicate agent:', error);
    }
  };

  const handleExportAgent = async (agent: AgentConfiguration) => {
    try {
      const exportData = await agentService.exportAgent(agent.id);
      if (exportData) {
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${agent.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_agent.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      safeDebugLog('error', 'AGENTMANAGEMENT', 'Failed to export agent:', error);
    }
  };

  const handleImportAgent = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const exportData = JSON.parse(text);
      const result = await agentService.importAgent(exportData);
      
      if (result.success) {
        await loadData();
        alert(`Agent imported successfully! ${result.warnings?.length ? `\nWarnings: ${result.warnings.join(', ')}` : ''}`);
      } else {
        alert(`Failed to import agent: ${result.errors?.join(', ')}`);
      }
    } catch (error) {
      safeDebugLog('error', 'AGENTMANAGEMENT', 'Failed to import agent:', error);
      alert('Failed to import agent: Invalid file format');
    }
    
    // Reset file input
    event.target.value = '';
  };

  const handleUseAgent = (agent: AgentConfiguration) => {
    onAgentSelect?.(agent);
    onClose?.();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading agents...</div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full bg-gray-950 text-white", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <Bot className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-semibold">Custom Agents</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".json"
            onChange={handleImportAgent}
            className="hidden"
            id="import-agent"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => document.getElementById('import-agent')?.click()}
            className="text-gray-300 border-gray-600 hover:bg-gray-800"
          >
            <Upload className="w-4 h-4 mr-2" />
            Import
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Agent
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4 p-6 border-b border-gray-800">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-900 border-gray-700 text-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white text-sm"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Agent Grid */}
      <div className="flex-1 overflow-auto p-6">
        {filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-400">
            <Bot className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg mb-2">No agents found</p>
            <p className="text-sm">Create your first custom agent to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onEdit={() => handleEditAgent(agent)}
                onDelete={() => handleDeleteAgent(agent)}
                onDuplicate={() => handleDuplicateAgent(agent)}
                onExport={() => handleExportAgent(agent)}
                onUse={() => handleUseAgent(agent)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create Agent Dialog */}
      <CreateAgentDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={handleCreateAgent}
        templates={templates}
      />

      {/* Edit Agent Dialog */}
      {selectedAgent && (
        <EditAgentDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          agent={selectedAgent}
          onSuccess={handleUpdateAgent}
        />
      )}
    </div>
  );
}

interface AgentCardProps {
  agent: AgentConfiguration;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onUse: () => void;
}

function AgentCard({ agent, onEdit, onDelete, onDuplicate, onExport, onUse }: AgentCardProps) {
  return (
    <Card className="bg-gray-900 border-gray-700 hover:border-gray-600 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="text-2xl">{agent.icon || '🤖'}</div>
            <div>
              <CardTitle className="text-white text-lg">{agent.name}</CardTitle>
              <CardDescription className="text-gray-400 text-sm">
                {agent.description}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Tags */}
          {agent.tags && agent.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {agent.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs bg-gray-800 text-gray-300">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>{agent.selectedTools.length} tools</span>
            <span>{agent.enabledMCPServers.length} MCP servers</span>
            <span>{agent.defaultProvider}</span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={onUse}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              <Play className="w-3 h-3 mr-1" />
              Use
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="border-gray-600 hover:bg-gray-800"
            >
              <Edit3 className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDuplicate}
              className="border-gray-600 hover:bg-gray-800"
            >
              <Copy className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onExport}
              className="border-gray-600 hover:bg-gray-800"
            >
              <Download className="w-3 h-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              className="border-red-600 text-red-400 hover:bg-red-900/20"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
