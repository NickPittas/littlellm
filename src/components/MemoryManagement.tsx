'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import {
  Brain,
  Search,
  Plus,
  Edit,
  Trash2,
  Download,
  Upload,
  RefreshCw,
  Tag,
  Calendar,
  BarChart3,
  FileText,
  Code,
  Lightbulb,
  User,
  MessageSquare,
  FolderOpen
} from 'lucide-react';
import { memoryService } from '../services/memoryService';
import { memoryExportService } from '../services/memoryExportService';
import { memoryCleanupService } from '../services/memoryCleanupService';
import { automaticMemoryService } from '../services/automaticMemoryService';
import { MemoryEntry, MemoryType, SearchQuery, MemoryStats } from '../types/memory';

interface MemoryManagementProps {
  className?: string;
}

export function MemoryManagement({ className }: MemoryManagementProps) {
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [cleanupLoading, setCleanupLoading] = useState(false);
  const [autoMemoryConfig, setAutoMemoryConfig] = useState(automaticMemoryService.getConfig());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<MemoryType | 'all'>('all');
  const [showAddMemory, setShowAddMemory] = useState(false);
  const [editingMemory, setEditingMemory] = useState<MemoryEntry | null>(null);
  const [newMemory, setNewMemory] = useState({
    type: 'general' as MemoryType,
    title: '',
    content: '',
    tags: ''
  });

  // Memory type icons and labels
  const memoryTypeConfig = {
    user_preference: { icon: User, label: 'User Preference', color: 'bg-blue-500' },
    conversation_context: { icon: MessageSquare, label: 'Conversation', color: 'bg-green-500' },
    project_knowledge: { icon: FolderOpen, label: 'Project Knowledge', color: 'bg-purple-500' },
    code_snippet: { icon: Code, label: 'Code Snippet', color: 'bg-orange-500' },
    solution: { icon: Lightbulb, label: 'Solution', color: 'bg-yellow-500' },
    general: { icon: FileText, label: 'General', color: 'bg-gray-500' }
  };

  const loadMemories = useCallback(async () => {
    setLoading(true);
    try {
      const query: SearchQuery = {
        limit: 50,
        offset: 0
      };

      if (searchQuery.trim()) {
        query.text = searchQuery.trim();
      }

      if (selectedType !== 'all') {
        query.type = selectedType;
      }

      const result = await memoryService.searchMemories({ query });
      if (result.success && result.data) {
        setMemories(result.data.results.map(r => r.entry));
      }
    } catch (error) {
      console.error('Failed to load memories:', error);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedType]);

  useEffect(() => {
    loadMemories();
    loadStats();
  }, [loadMemories]);

  const loadStats = async () => {
    try {
      const result = await memoryService.getMemoryStats();
      if (result.success && result.data) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to load memory stats:', error);
    }
  };

  const handleSearch = () => {
    loadMemories();
  };

  const handleAddMemory = async () => {
    if (!newMemory.title.trim() || !newMemory.content.trim()) return;

    try {
      const tags = newMemory.tags.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
      
      const result = await memoryService.storeMemory({
        type: newMemory.type,
        title: newMemory.title.trim(),
        content: newMemory.content.trim(),
        tags,
        source: 'manual_ui'
      });

      if (result.success) {
        setNewMemory({ type: 'general', title: '', content: '', tags: '' });
        setShowAddMemory(false);
        loadMemories();
        loadStats();
      }
    } catch (error) {
      console.error('Failed to add memory:', error);
    }
  };

  const handleEditMemory = async () => {
    if (!editingMemory) return;

    try {
      const tags = editingMemory.metadata.tags;
      
      const result = await memoryService.updateMemory({
        id: editingMemory.id,
        title: editingMemory.title,
        content: editingMemory.content,
        tags,
        type: editingMemory.type
      });

      if (result.success) {
        setEditingMemory(null);
        loadMemories();
      }
    } catch (error) {
      console.error('Failed to update memory:', error);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (!confirm('Are you sure you want to delete this memory?')) return;

    try {
      const result = await memoryService.deleteMemory({ id: memoryId });
      if (result.success) {
        loadMemories();
        loadStats();
      }
    } catch (error) {
      console.error('Failed to delete memory:', error);
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
  };

  const getTypeIcon = (type: MemoryType) => {
    const config = memoryTypeConfig[type];
    const IconComponent = config.icon;
    return <IconComponent className="h-4 w-4" />;
  };

  const getTypeLabel = (type: MemoryType) => {
    return memoryTypeConfig[type].label;
  };

  const getTypeBadgeColor = (type: MemoryType) => {
    return memoryTypeConfig[type].color;
  };

  const handleExportMemories = async () => {
    setExportLoading(true);
    try {
      const exportResult = await memoryExportService.exportMemories({
        description: 'Manual export from LiteLLM Memory Management'
      });

      if (exportResult.success && exportResult.data) {
        const saveResult = await memoryExportService.saveExportToFile(exportResult.data);
        if (saveResult.success) {
          alert(`Memories exported successfully to ${saveResult.filename}`);
        } else {
          alert(`Export failed: ${saveResult.error}`);
        }
      } else {
        alert(`Export failed: ${exportResult.error}`);
      }
    } catch (error) {
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportMemories = async () => {
    setImportLoading(true);
    try {
      const loadResult = await memoryExportService.loadExportFromFile();

      if (loadResult.success && loadResult.data) {
        const importResult = await memoryExportService.importMemories(loadResult.data, {
          skipDuplicates: true,
          validateData: true
        });

        if (importResult.success) {
          alert(`Import completed: ${importResult.imported} memories imported, ${importResult.skipped} skipped, ${importResult.duplicates} duplicates found`);
          loadMemories();
          loadStats();
        } else {
          alert(`Import failed: ${importResult.errors.join(', ')}`);
        }
      } else {
        alert(`Import failed: ${loadResult.error}`);
      }
    } catch (error) {
      alert(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setImportLoading(false);
    }
  };

  const handleCleanupMemories = async () => {
    if (!confirm('This will clean up old and duplicate memories. Continue?')) return;

    setCleanupLoading(true);
    try {
      const cleanupResult = await memoryCleanupService.performCleanup({
        maxAge: 365, // 1 year
        archiveOldMemories: true,
        consolidateDuplicates: true,
        removeUnusedMemories: false
      });

      if (cleanupResult.success) {
        const sizeSaved = cleanupResult.sizeBefore - cleanupResult.sizeAfter;
        alert(`Cleanup completed: ${cleanupResult.deleted} deleted, ${cleanupResult.archived} archived, ${cleanupResult.consolidated} consolidated. Saved ${Math.round(sizeSaved / 1024)}KB`);
        loadMemories();
        loadStats();
      } else {
        alert(`Cleanup failed: ${cleanupResult.errors.join(', ')}`);
      }
    } catch (error) {
      alert(`Cleanup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setCleanupLoading(false);
    }
  };

  const handleAutoMemoryToggle = (setting: 'enableAutoSearch' | 'enableAutoSave', value: boolean) => {
    const newConfig = { ...autoMemoryConfig, [setting]: value };
    setAutoMemoryConfig(newConfig);
    automaticMemoryService.updateConfig(newConfig);
  };

  const handleAutoMemoryConfigChange = (setting: string, value: number) => {
    const newConfig = { ...autoMemoryConfig, [setting]: value };
    setAutoMemoryConfig(newConfig);
    automaticMemoryService.updateConfig(newConfig);
  };

  return (
    <div className={className}>
      <Tabs defaultValue="browse" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="browse" className="text-xs">Browse Memories</TabsTrigger>
          <TabsTrigger value="stats" className="text-xs">Statistics</TabsTrigger>
          <TabsTrigger value="settings" className="text-xs">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-2">
          {/* Search and Filter Controls */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Brain className="h-4 w-4" />
                Memory Browser
              </CardTitle>
              <CardDescription className="text-xs">
                Search and manage your stored memories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex gap-1">
                <div className="flex-1">
                  <Input
                    placeholder="Search memories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="h-7 text-xs"
                  />
                </div>
                <Select value={selectedType} onValueChange={(value) => setSelectedType(value as MemoryType | 'all')}>
                  <SelectTrigger className="w-32 h-7 text-xs">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {Object.entries(memoryTypeConfig).map(([type, config]) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(type as MemoryType)}
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleSearch} disabled={loading} size="sm" className="h-7 w-7 p-0">
                  <Search className="h-3 w-3" />
                </Button>
                <Button onClick={() => setShowAddMemory(true)} size="sm" className="h-7 w-7 p-0">
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Memory List */}
          <div className="space-y-2">
            {loading ? (
              <Card>
                <CardContent className="p-4 text-center">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />
                  Loading memories...
                </CardContent>
              </Card>
            ) : memories.length === 0 ? (
              <Card>
                <CardContent className="p-4 text-center text-muted-foreground">
                  No memories found. Try adjusting your search or add a new memory.
                </CardContent>
              </Card>
            ) : (
              memories.map((memory) => (
                <Card key={memory.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge className={`${getTypeBadgeColor(memory.type)} text-white`}>
                            {getTypeIcon(memory.type)}
                            <span className="ml-1">{getTypeLabel(memory.type)}</span>
                          </Badge>
                          <h3 className="font-medium">{memory.title}</h3>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {memory.content}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(memory.createdAt)}
                          </span>
                          {memory.metadata.tags.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Tag className="h-3 w-3" />
                              {memory.metadata.tags.join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 ml-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingMemory(memory)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteMemory(memory.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Memory Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-2xl font-bold">{stats.totalEntries}</div>
                    <div className="text-sm text-muted-foreground">Total Memories</div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-2xl font-bold">{Math.round(stats.totalSize / 1024)} KB</div>
                    <div className="text-sm text-muted-foreground">Storage Used</div>
                  </div>
                  <div className="col-span-2 space-y-2">
                    <h4 className="font-medium">Memories by Type</h4>
                    {Object.entries(stats.entriesByType).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getTypeIcon(type as MemoryType)}
                          <span>{getTypeLabel(type as MemoryType)}</span>
                        </div>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center text-muted-foreground">
                  Loading statistics...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          {/* Automatic Memory Settings */}
          <Card>
            <CardHeader>
              <CardTitle>Automatic Memory</CardTitle>
              <CardDescription>
                Configure how AI automatically uses and creates memories
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-search">Auto-Search Memories</Label>
                    <input
                      id="auto-search"
                      type="checkbox"
                      checked={autoMemoryConfig.enableAutoSearch}
                      onChange={(e) => handleAutoMemoryToggle('enableAutoSearch', e.target.checked)}
                      className="rounded"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Automatically include relevant memories in AI prompts
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-save">Auto-Save Memories</Label>
                    <input
                      id="auto-save"
                      type="checkbox"
                      checked={autoMemoryConfig.enableAutoSave}
                      onChange={(e) => handleAutoMemoryToggle('enableAutoSave', e.target.checked)}
                      className="rounded"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Automatically save useful information from conversations
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="search-threshold">Search Relevance Threshold</Label>
                  <Input
                    id="search-threshold"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={autoMemoryConfig.searchThreshold}
                    onChange={(e) => handleAutoMemoryConfigChange('searchThreshold', parseFloat(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum relevance score to include memories (0.0 - 1.0)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="save-threshold">Auto-Save Confidence Threshold</Label>
                  <Input
                    id="save-threshold"
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={autoMemoryConfig.saveThreshold}
                    onChange={(e) => handleAutoMemoryConfigChange('saveThreshold', parseFloat(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum confidence to auto-save information (0.0 - 1.0)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-context">Max Context Memories</Label>
                  <Input
                    id="max-context"
                    type="number"
                    min="1"
                    max="10"
                    value={autoMemoryConfig.maxContextMemories}
                    onChange={(e) => handleAutoMemoryConfigChange('maxContextMemories', parseInt(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum memories to include in AI context
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="text-sm space-y-2">
                  <div className="font-medium">How Automatic Memory Works:</div>
                  <ul className="text-muted-foreground space-y-1 ml-4">
                    <li>• <strong>Auto-Search:</strong> AI automatically searches for relevant memories before responding</li>
                    <li>• <strong>Auto-Save:</strong> AI automatically saves preferences, solutions, and useful information</li>
                    <li>• <strong>Smart Context:</strong> Only the most relevant memories are included to avoid overwhelming the AI</li>
                    <li>• <strong>Seamless:</strong> Works transparently without requiring manual memory tool usage</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Manual Memory Management */}
          <Card>
            <CardHeader>
              <CardTitle>Memory Management</CardTitle>
              <CardDescription>
                Manual memory operations and maintenance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Button onClick={loadStats} disabled={loading}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Statistics
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleExportMemories}
                    disabled={exportLoading}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {exportLoading ? 'Exporting...' : 'Export Memories'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleImportMemories}
                    disabled={importLoading}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {importLoading ? 'Importing...' : 'Import Memories'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCleanupMemories}
                    disabled={cleanupLoading}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {cleanupLoading ? 'Cleaning...' : 'Cleanup Memories'}
                  </Button>
                </div>

                <div className="text-sm space-y-2">
                  <div className="font-medium">Memory Management Features:</div>
                  <ul className="text-muted-foreground space-y-1 ml-4">
                    <li>• <strong>Export:</strong> Save all memories to a JSON file for backup</li>
                    <li>• <strong>Import:</strong> Restore memories from a backup file</li>
                    <li>• <strong>Cleanup:</strong> Remove old memories and consolidate duplicates</li>
                    <li>• <strong>Auto-Memory:</strong> AI automatically creates memories during conversations</li>
                  </ul>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Memory system is running and ready to store information from AI conversations.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Memory Dialog */}
      {showAddMemory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Add New Memory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="memory-type">Type</Label>
                <Select value={newMemory.type} onValueChange={(value) => setNewMemory(prev => ({ ...prev, type: value as MemoryType }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(memoryTypeConfig).map(([type, config]) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(type as MemoryType)}
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="memory-title">Title</Label>
                <Input
                  id="memory-title"
                  value={newMemory.title}
                  onChange={(e) => setNewMemory(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Enter memory title..."
                />
              </div>
              <div>
                <Label htmlFor="memory-content">Content</Label>
                <Textarea
                  id="memory-content"
                  value={newMemory.content}
                  onChange={(e) => setNewMemory(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Enter memory content..."
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="memory-tags">Tags (comma-separated)</Label>
                <Input
                  id="memory-tags"
                  value={newMemory.tags}
                  onChange={(e) => setNewMemory(prev => ({ ...prev, tags: e.target.value }))}
                  placeholder="tag1, tag2, tag3..."
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowAddMemory(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddMemory}>
                  Add Memory
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit Memory Dialog */}
      {editingMemory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Edit Memory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="edit-memory-type">Type</Label>
                <Select value={editingMemory.type} onValueChange={(value) => setEditingMemory(prev => prev ? ({ ...prev, type: value as MemoryType }) : null)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(memoryTypeConfig).map(([type, config]) => (
                      <SelectItem key={type} value={type}>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(type as MemoryType)}
                          {config.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-memory-title">Title</Label>
                <Input
                  id="edit-memory-title"
                  value={editingMemory.title}
                  onChange={(e) => setEditingMemory(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                />
              </div>
              <div>
                <Label htmlFor="edit-memory-content">Content</Label>
                <Textarea
                  id="edit-memory-content"
                  value={editingMemory.content}
                  onChange={(e) => setEditingMemory(prev => prev ? ({ ...prev, content: e.target.value }) : null)}
                  rows={4}
                />
              </div>
              <div>
                <Label htmlFor="edit-memory-tags">Tags (comma-separated)</Label>
                <Input
                  id="edit-memory-tags"
                  value={editingMemory.metadata.tags.join(', ')}
                  onChange={(e) => {
                    const tags = e.target.value.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
                    setEditingMemory(prev => prev ? ({ 
                      ...prev, 
                      metadata: { ...prev.metadata, tags }
                    }) : null);
                  }}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setEditingMemory(null)}>
                  Cancel
                </Button>
                <Button onClick={handleEditMemory}>
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
