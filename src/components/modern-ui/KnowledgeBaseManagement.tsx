'use client';

import React, { useState, useEffect } from 'react';
import { Database, Plus, Search, Edit, Trash2, Star, X, AlertCircle, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '@/lib/utils';
import type { KnowledgeBase, CreateKnowledgeBaseRequest, UpdateKnowledgeBaseRequest } from '../../types/knowledgeBase';
import { DocumentUpload } from './DocumentUpload';

interface KnowledgeBaseManagementProps {
  onClose?: () => void;
  selectedKnowledgeBaseId?: string;
  onKnowledgeBaseSelect?: (knowledgeBase: KnowledgeBase) => void;
}

const DEFAULT_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'];
const DEFAULT_ICONS = ['📚', '📖', '📄', '📝', '🔬', '💻', '🎨', '📊', '🌟', '🚀'];

// Constants for frequently used strings
const ELECTRON_API_NOT_AVAILABLE = 'ElectronAPI not available';

// Knowledge base registry API using IPC
const knowledgeBaseRegistryAPI = {
  async listKnowledgeBases(): Promise<KnowledgeBase[]> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const result = await window.electronAPI.listKnowledgeBases();
      if (result.success) {
        // Convert string dates to Date objects
        return result.knowledgeBases.map(kb => ({
          ...kb,
          lastUpdated: new Date(kb.lastUpdated),
          createdAt: new Date(kb.createdAt)
        }));
      } else {
        throw new Error(result.error || 'Failed to list knowledge bases');
      }
    }
    throw new Error(ELECTRON_API_NOT_AVAILABLE);
  },

  async createKnowledgeBase(request: CreateKnowledgeBaseRequest): Promise<KnowledgeBase> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const result = await window.electronAPI.createKnowledgeBase(request);
      if (result.success && result.knowledgeBase) {
        // Convert string dates to Date objects
        return {
          ...result.knowledgeBase,
          lastUpdated: new Date(result.knowledgeBase.lastUpdated),
          createdAt: new Date(result.knowledgeBase.createdAt)
        };
      } else {
        throw new Error(result.error || 'Failed to create knowledge base');
      }
    }
    throw new Error(ELECTRON_API_NOT_AVAILABLE);
  },

  async updateKnowledgeBase(id: string, updates: Omit<UpdateKnowledgeBaseRequest, 'id'>): Promise<KnowledgeBase> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const result = await window.electronAPI.updateKnowledgeBase(id, updates);
      if (result.success && result.knowledgeBase) {
        // Convert string dates to Date objects
        return {
          ...result.knowledgeBase,
          lastUpdated: new Date(result.knowledgeBase.lastUpdated),
          createdAt: new Date(result.knowledgeBase.createdAt)
        };
      } else {
        throw new Error(result.error || 'Failed to update knowledge base');
      }
    }
    throw new Error(ELECTRON_API_NOT_AVAILABLE);
  },

  async getKnowledgeBase(id: string): Promise<KnowledgeBase | null> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const result = await window.electronAPI.getKnowledgeBase(id);
      if (result.success) {
        if (result.knowledgeBase) {
          // Convert string dates to Date objects
          return {
            ...result.knowledgeBase,
            lastUpdated: new Date(result.knowledgeBase.lastUpdated),
            createdAt: new Date(result.knowledgeBase.createdAt)
          };
        }
        return null;
      } else {
        throw new Error(result.error || 'Failed to get knowledge base');
      }
    }
    throw new Error(ELECTRON_API_NOT_AVAILABLE);
  },

  async deleteKnowledgeBase(id: string): Promise<void> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const result = await window.electronAPI.deleteKnowledgeBase(id);
      if (!result.success) {
        throw new Error(result.error || 'Failed to delete knowledge base');
      }
    } else {
      throw new Error(ELECTRON_API_NOT_AVAILABLE);
    }
  }
};

export function KnowledgeBaseManagement({
  onClose,
  selectedKnowledgeBaseId,
  onKnowledgeBaseSelect
}: KnowledgeBaseManagementProps) {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [selectedKB, setSelectedKB] = useState<KnowledgeBase | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: DEFAULT_COLORS[0],
    icon: DEFAULT_ICONS[0],
    tags: [] as string[]
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    color: DEFAULT_COLORS[0],
    icon: DEFAULT_ICONS[0],
    tags: [] as string[]
  });

  // Load knowledge bases from the registry
  const loadKnowledgeBases = async () => {
    setIsLoading(true);
    try {
      const kbs = await knowledgeBaseRegistryAPI.listKnowledgeBases();
      setKnowledgeBases(kbs);
    } catch (error) {
      console.error('Failed to load knowledge bases:', error);
      setMessage(error instanceof Error ? error.message : 'Failed to load knowledge bases');
      setKnowledgeBases([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  const filteredKBs = knowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kb.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      color: DEFAULT_COLORS[0],
      icon: DEFAULT_ICONS[0],
      tags: []
    });
  };

  const resetEditForm = () => {
    setEditFormData({
      name: '',
      description: '',
      color: DEFAULT_COLORS[0],
      icon: DEFAULT_ICONS[0],
      tags: []
    });
  };

  const openEditDialog = (kb: KnowledgeBase) => {
    setSelectedKB(kb);
    setEditFormData({
      name: kb.name,
      description: kb.description,
      color: kb.color,
      icon: kb.icon,
      tags: [...kb.tags]
    });
    setShowEditDialog(true);
  };

  const handleCreateKB = async () => {
    if (!formData.name.trim()) {
      setMessage('Name is required');
      return;
    }
    
    setIsLoading(true);
    try {
      const createRequest: CreateKnowledgeBaseRequest = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        color: formData.color,
        icon: formData.icon,
        tags: formData.tags
      };
      
      const newKB = await knowledgeBaseRegistryAPI.createKnowledgeBase(createRequest);
      setMessage(`Knowledge base "${newKB.name}" created successfully`);
      setShowCreateDialog(false);
      resetForm();
      await loadKnowledgeBases();
    } catch (error) {
      console.error('Failed to create knowledge base:', error);
      setMessage(`Failed to create knowledge base: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditKB = async () => {
    if (!selectedKB || !editFormData.name.trim()) {
      setMessage('Name is required');
      return;
    }
    
    setIsLoading(true);
    try {
      const updateRequest = {
        name: editFormData.name.trim(),
        description: editFormData.description.trim(),
        color: editFormData.color,
        icon: editFormData.icon,
        tags: editFormData.tags
      };
      
      const updatedKB = await knowledgeBaseRegistryAPI.updateKnowledgeBase(selectedKB.id, updateRequest);
      setMessage(`Knowledge base "${updatedKB.name}" updated successfully`);
      setShowEditDialog(false);
      setSelectedKB(null);
      resetEditForm();
      await loadKnowledgeBases();
    } catch (error) {
      console.error('Failed to update knowledge base:', error);
      setMessage(`Failed to update knowledge base: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteKB = async () => {
    if (!selectedKB) return;
    setIsLoading(true);
    try {
      await knowledgeBaseRegistryAPI.deleteKnowledgeBase(selectedKB.id);
      setMessage(`"${selectedKB.name}" deleted successfully`);
      setShowDeleteDialog(false);
      setSelectedKB(null);
      await loadKnowledgeBases();
    } catch (error) {
      console.error('Failed to delete knowledge base:', error);
      setMessage(`Failed to delete knowledge base: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-purple-400" />
          <h1 className="text-lg font-semibold">Knowledge Base Management</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            className="text-green-400 border-green-400 hover:bg-green-400/10"
          >
            <Plus className="w-4 h-4 mr-1" />
            Create
          </Button>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search knowledge bases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-gray-800 border-gray-600"
          />
        </div>
      </div>

      {/* Message */}
      {message && (
        <div className="p-4 bg-blue-900/20 border-b border-gray-700">
          <p className="text-sm text-blue-300">{message}</p>
        </div>
      )}

      {/* Knowledge Base List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-gray-400">Loading...</div>
          </div>
        ) : filteredKBs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Database className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg mb-2">No Knowledge Bases Found</p>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(true)}
              className="text-green-400 border-green-400 hover:bg-green-400/10"
            >
              <Plus className="w-4 h-4 mr-1" />
              Create Knowledge Base
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {filteredKBs.map((kb) => (
              <div
                key={kb.id}
                className={cn(
                  "bg-gray-800 rounded-lg p-4 border-2 transition-all cursor-pointer relative overflow-hidden",
                  selectedKnowledgeBaseId === kb.id
                    ? "border-purple-500 bg-purple-900/20"
                    : "border-gray-700 hover:border-gray-600"
                )}
                onClick={() => onKnowledgeBaseSelect?.(kb)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                      style={{ backgroundColor: kb.color + '20', color: kb.color }}
                    >
                      {kb.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <h3 className="font-medium truncate">{kb.name}</h3>
                        {kb.isDefault && (
                          <Star className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="currentColor" />
                        )}
                      </div>
                      <p className="text-xs text-gray-400 truncate">{kb.description}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedKB(kb);
                        setShowDocumentUpload(true);
                      }}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-blue-400"
                      title="Upload documents"
                    >
                      <Upload className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDialog(kb);
                      }}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                      title="Edit knowledge base"
                    >
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedKB(kb);
                        setShowDeleteDialog(true);
                      }}
                      className="h-6 w-6 p-0 text-gray-400 hover:text-red-400"
                      disabled={kb.isDefault && knowledgeBases.length === 1}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div className="text-center mb-3">
                  <div className="text-lg font-semibold">{kb.documentCount}</div>
                  <div className="text-xs text-gray-400">Documents</div>
                </div>

                {kb.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {kb.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document Upload Dialog */}
      {showDocumentUpload && selectedKB && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-[90vw] h-[90vh] max-w-4xl max-h-[800px] bg-gray-800 rounded-lg overflow-hidden">
            <DocumentUpload
              knowledgeBaseId={selectedKB.id}
              knowledgeBaseName={selectedKB.name}
              onUploadComplete={(files) => {
                console.log('Upload completed for files:', files);
                // Refresh knowledge bases to update document counts
                loadKnowledgeBases();
              }}
              onUploadProgress={(file) => {
                console.log('Upload progress for file:', file.file.name, file.status);
              }}
              onClose={() => {
                setShowDocumentUpload(false);
                setSelectedKB(null);
              }}
              maxFileSize={500}
              showPreview={true}
            />
          </div>
        </div>
      )}

      {/* Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Create Knowledge Base</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreateDialog(false);
                  resetForm();
                }}
                className="h-6 w-6 p-0 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-200">Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Knowledge base name"
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-200">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-200">Color</label>
                  <div className="flex gap-1 flex-wrap">
                    {DEFAULT_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setFormData(prev => ({ ...prev, color }))}
                        className={cn(
                          "w-6 h-6 rounded border-2 transition-all hover:scale-110",
                          formData.color === color ? "border-white shadow-lg" : "border-gray-500 hover:border-gray-300"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-200">Icon</label>
                  <div className="flex gap-1 flex-wrap">
                    {DEFAULT_ICONS.map(icon => (
                      <button
                        key={icon}
                        onClick={() => setFormData(prev => ({ ...prev, icon }))}
                        className={cn(
                          "w-6 h-6 rounded border text-sm transition-all hover:scale-110",
                          formData.icon === icon ? "border-white bg-gray-600 shadow-lg" : "border-gray-500 hover:border-gray-300 hover:bg-gray-700"
                        )}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowCreateDialog(false);
                  resetForm();
                }}
                className="text-gray-300 hover:text-white hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateKB}
                disabled={!formData.name.trim() || isLoading}
                className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {showEditDialog && selectedKB && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Edit Knowledge Base</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowEditDialog(false);
                  setSelectedKB(null);
                  resetEditForm();
                }}
                className="h-6 w-6 p-0 text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-gray-200">Name *</label>
                <Input
                  value={editFormData.name}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Knowledge base name"
                  className="bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1 text-gray-200">Description</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                  rows={2}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-sm text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-200">Color</label>
                  <div className="flex gap-1 flex-wrap">
                    {DEFAULT_COLORS.map(color => (
                      <button
                        key={color}
                        onClick={() => setEditFormData(prev => ({ ...prev, color }))}
                        className={cn(
                          "w-6 h-6 rounded border-2 transition-all hover:scale-110",
                          editFormData.color === color ? "border-white shadow-lg" : "border-gray-500 hover:border-gray-300"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-gray-200">Icon</label>
                  <div className="flex gap-1 flex-wrap">
                    {DEFAULT_ICONS.map(icon => (
                      <button
                        key={icon}
                        onClick={() => setEditFormData(prev => ({ ...prev, icon }))}
                        className={cn(
                          "w-6 h-6 rounded border text-sm transition-all hover:scale-110",
                          editFormData.icon === icon ? "border-white bg-gray-600 shadow-lg" : "border-gray-500 hover:border-gray-300 hover:bg-gray-700"
                        )}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowEditDialog(false);
                  setSelectedKB(null);
                  resetEditForm();
                }}
                className="text-gray-300 hover:text-white hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleEditKB}
                disabled={!editFormData.name.trim() || isLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Updating...' : 'Update'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {showDeleteDialog && selectedKB && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-400" />
              <h2 className="text-lg font-semibold text-white">Delete Knowledge Base</h2>
            </div>
            
            <p className="text-gray-300 mb-4">
              Are you sure you want to delete &quot;<span className="font-medium text-white">{selectedKB.name}</span>&quot;? This action cannot be undone.
            </p>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSelectedKB(null);
                }}
                className="text-gray-300 hover:text-white hover:bg-gray-700"
              >
                Cancel
              </Button>
              <Button
                onClick={handleDeleteKB}
                disabled={isLoading}
                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}