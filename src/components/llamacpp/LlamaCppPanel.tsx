'use client';

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Play, 
  Square, 
  Settings, 
  Trash2, 
  Plus,
  Server,
  HardDrive,
  Cpu,
  Zap
} from 'lucide-react';
import { llamaCppService, LlamaCppModel } from '../../services/llamaCppService';

interface LlamaCppPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LlamaCppPanel({ isOpen, onClose }: LlamaCppPanelProps) {
  const [models, setModels] = useState<LlamaCppModel[]>([]);
  const [isSwapRunning, setIsSwapRunning] = useState(false);
  const [selectedModel, setSelectedModel] = useState<LlamaCppModel | null>(null);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [showParametersDialog, setShowParametersDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadModels();
      checkSwapStatus();
    }
  }, [isOpen]);

  const loadModels = async () => {
    try {
      const modelList = await llamaCppService.getModels();
      setModels(modelList);
    } catch (error) {
      console.error('Failed to load models:', error);
    }
  };

  const checkSwapStatus = async () => {
    try {
      const running = await llamaCppService.isLlamaSwapRunning();
      setIsSwapRunning(running);
    } catch (error) {
      console.error('Failed to check swap status:', error);
    }
  };

  const handleStartSwap = async () => {
    setLoading(true);
    try {
      await llamaCppService.startLlamaSwap();
      setIsSwapRunning(true);
    } catch (error) {
      console.error('Failed to start llama-swap:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStopSwap = async () => {
    setLoading(true);
    try {
      await llamaCppService.stopLlamaSwap();
      setIsSwapRunning(false);
    } catch (error) {
      console.error('Failed to stop llama-swap:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    if (confirm('Are you sure you want to delete this model? This action cannot be undone.')) {
      try {
        await llamaCppService.deleteModel(modelId);
        await loadModels();
      } catch (error) {
        console.error('Failed to delete model:', error);
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700/50 w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Llama.cpp Management</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Status Bar */}
        <div className="p-4 border-b border-gray-700/50 bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${isSwapRunning ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-sm text-gray-300">
                  Llama-swap: {isSwapRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-300">
                  {models.length} models available
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isSwapRunning ? (
                <button
                  onClick={handleStopSwap}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  <Square className="w-4 h-4" />
                  Stop
                </button>
              ) : (
                <button
                  onClick={handleStartSwap}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  Start
                </button>
              )}
              <button
                onClick={() => setShowDownloadDialog(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Model
              </button>
            </div>
          </div>
        </div>

        {/* Models List */}
        <div className="flex-1 overflow-y-auto p-4">
          {models.length === 0 ? (
            <div className="text-center py-12">
              <HardDrive className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-300 mb-2">No Models Found</h3>
              <p className="text-gray-500 mb-4">
                Add GGUF model files to the models directory or download them using the Add Model button.
              </p>
              <button
                onClick={() => setShowDownloadDialog(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors mx-auto"
              >
                <Download className="w-4 h-4" />
                Download Models
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {models.map((model) => (
                <div
                  key={model.id}
                  className="bg-gray-800/50 rounded-lg border border-gray-700/50 p-4 hover:bg-gray-800/70 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium text-white">{model.name}</h3>
                        <div className={`w-2 h-2 rounded-full ${model.isRunning ? 'bg-green-400' : 'bg-gray-500'}`} />
                      </div>
                      {model.description && (
                        <p className="text-sm text-gray-400 mb-3">{model.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {formatFileSize(model.size)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Cpu className="w-3 h-3" />
                          {model.parameters.contextSize || 4096} ctx
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {model.parameters.gpuLayers || 0} GPU layers
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedModel(model);
                          setShowParametersDialog(true);
                        }}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded-lg transition-colors"
                        title="Configure Parameters"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteModel(model.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-700/50 rounded-lg transition-colors"
                        title="Delete Model"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Download Dialog */}
      {showDownloadDialog && (
        <ModelDownloadDialog
          onClose={() => setShowDownloadDialog(false)}
          onDownload={loadModels}
        />
      )}

      {/* Parameters Dialog */}
      {showParametersDialog && selectedModel && (
        <ModelParametersDialog
          model={selectedModel}
          onClose={() => {
            setShowParametersDialog(false);
            setSelectedModel(null);
          }}
          onSave={loadModels}
        />
      )}
    </div>
  );
}

// Placeholder components - will be implemented next
function ModelDownloadDialog({ onClose, onDownload }: { onClose: () => void; onDownload: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center">
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-white mb-4">Download Model</h3>
        <p className="text-gray-400 mb-4">Model downloading will be implemented in the next phase.</p>
        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function ModelParametersDialog({ 
  model, 
  onClose, 
  onSave 
}: { 
  model: LlamaCppModel; 
  onClose: () => void; 
  onSave: () => void; 
}) {
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center">
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-white mb-4">Configure {model.name}</h3>
        <p className="text-gray-400 mb-4">Parameter configuration will be implemented in the next phase.</p>
        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
