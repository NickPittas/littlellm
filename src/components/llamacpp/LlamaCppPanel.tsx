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
  Zap,
  AlertTriangle,
  Loader2,
  Activity
} from 'lucide-react';
import { llamaCppService, LlamaCppModel } from '../../services/llamaCppService';
import { LlamaCppErrorBoundary, useLlamaCppErrorHandler } from './ErrorBoundary';
import { useLlamaCppNotifications } from './NotificationSystem';
import { PerformanceMonitor } from './PerformanceMonitor';
import { AutoConfigDialog } from './AutoConfigDialog';
import { OptimalConfiguration } from '../../services/llamaCppAutoConfig';

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
  const [error, setError] = useState<string | null>(null);
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [showAutoConfig, setShowAutoConfig] = useState(false);

  const { handleError } = useLlamaCppErrorHandler();
  const notifications = useLlamaCppNotifications();

  useEffect(() => {
    if (isOpen) {
      loadModels();
      checkSwapStatus();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadModels = async () => {
    try {
      setError(null);
      const modelList = await llamaCppService.getModels();
      setModels(modelList);
    } catch (err) {
      const error = err as Error;
      console.error('Failed to load models:', error);
      const errorInfo = handleError(error, 'loadModels');
      setError(errorInfo.message);
      notifications.notifyError('Failed to Load Models', errorInfo.message);
    }
  };

  const checkSwapStatus = async () => {
    try {
      const running = await llamaCppService.isLlamaSwapRunning();
      setIsSwapRunning(running);
    } catch (err) {
      const error = err as Error;
      console.error('Failed to check swap status:', error);
      const errorInfo = handleError(error, 'checkSwapStatus');
      notifications.notifyWarning('Status Check Failed', errorInfo.message);
    }
  };

  const handleStartSwap = async () => {
    setLoading(true);
    try {
      await llamaCppService.startLlamaSwap();
      setIsSwapRunning(true);
      notifications.notifyLlamaSwapStarted();
    } catch (err) {
      const error = err as Error;
      console.error('Failed to start llama-swap:', error);
      const errorInfo = handleError(error, 'startLlamaSwap');
      notifications.notifyLlamaSwapError(errorInfo.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStopSwap = async () => {
    setLoading(true);
    try {
      await llamaCppService.stopLlamaSwap();
      setIsSwapRunning(false);
      notifications.notifyLlamaSwapStopped();
    } catch (err) {
      const error = err as Error;
      console.error('Failed to stop llama-swap:', error);
      const errorInfo = handleError(error, 'stopLlamaSwap');
      notifications.notifyError('Failed to Stop Llama-swap', errorInfo.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModel = async (modelId: string) => {
    const model = models.find(m => m.id === modelId);
    const modelName = model?.name || modelId;

    if (confirm(`Are you sure you want to delete "${modelName}"? This action cannot be undone.`)) {
      try {
        await llamaCppService.deleteModel(modelId);
        await loadModels();
        notifications.notifyModelDeleted(modelName);
      } catch (err) {
        const error = err as Error;
        console.error('Failed to delete model:', error);
        const errorInfo = handleError(error, 'deleteModel');
        notifications.notifyError('Failed to Delete Model', errorInfo.message);
      }
    }
  };

  const handleApplyAutoConfig = async (config: OptimalConfiguration) => {
    if (!selectedModel) return;

    try {
      const updatedParameters = {
        ...selectedModel.parameters,
        contextSize: config.contextSize,
        threads: config.threads,
        gpuLayers: config.gpuLayers,
        batchSize: config.batchSize,
        temperature: config.temperature,
        topK: config.topK,
        topP: config.topP,
        repeatPenalty: config.repeatPenalty
      };

      await llamaCppService.updateModelParameters(selectedModel.id, updatedParameters);
      await loadModels();
      notifications.notifyModelConfigured(selectedModel.name);

      // Show reasoning in notification
      if (config.reasoning.length > 0) {
        notifications.notifyInfo(
          'Auto-Configuration Applied',
          `Configuration optimized based on: ${config.reasoning.slice(0, 2).join(', ')}`
        );
      }
    } catch (err) {
      const error = err as Error;
      console.error('Failed to apply auto-configuration:', error);
      const errorInfo = handleError(error, 'applyAutoConfig');
      notifications.notifyError('Failed to Apply Configuration', errorInfo.message);
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
      <LlamaCppErrorBoundary>
        <div className="bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700/50 w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <Server className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Llama.cpp Management</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAutoConfig(true)}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
            >
              <Settings className="w-4 h-4" />
              Auto-Config
            </button>
            <button
              onClick={() => setShowPerformanceMonitor(true)}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm"
            >
              <Activity className="w-4 h-4" />
              Performance
            </button>
            <button
              onClick={() => setShowDownloadDialog(true)}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Model
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
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
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                  {loading ? 'Stopping...' : 'Stop'}
                </button>
              ) : (
                <button
                  onClick={handleStartSwap}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  {loading ? 'Starting...' : 'Start'}
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

        {/* Error Display */}
        {error && (
          <div className="p-4 border-b border-gray-700/50">
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="text-red-300 font-medium mb-1">Error</h4>
                  <p className="text-red-200/80 text-sm">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="mt-2 text-xs text-red-300 hover:text-red-200 underline"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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

      {/* Performance Monitor */}
      <PerformanceMonitor
        isVisible={showPerformanceMonitor}
        onClose={() => setShowPerformanceMonitor(false)}
      />

      {/* Auto-Configuration Dialog */}
      <AutoConfigDialog
        isOpen={showAutoConfig}
        onClose={() => setShowAutoConfig(false)}
        onApplyConfig={handleApplyAutoConfig}
        currentModelId={selectedModel?.id}
      />
      </LlamaCppErrorBoundary>
    </div>
  );
}

// Model Download Dialog Component
function ModelDownloadDialog({ onClose, onDownload }: { onClose: () => void; onDownload: () => void }) {
  const [availableModels, setAvailableModels] = useState<Array<{
    id: string;
    name: string;
    description: string;
    downloads: number;
    quantizations: string[];
    size?: Record<string, string>;
  }>>([]);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedQuantization, setSelectedQuantization] = useState<string>('Q4_K_M');
  const [loading, setLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    progress: number;
    status: string;
  } | null>(null);

  useEffect(() => {
    loadAvailableModels();

    // Set up download progress listener
    let cleanup: (() => void) | undefined;
    if (typeof window !== 'undefined' && window.electronAPI?.onLlamaCppDownloadProgress) {
      cleanup = window.electronAPI.onLlamaCppDownloadProgress((data) => {
        setDownloadProgress({
          progress: data.progress,
          status: data.status
        });

        if (data.progress === 100) {
          // Download complete, refresh models list
          setTimeout(() => {
            setDownloadProgress(null);
            onDownload();
          }, 2000);
        }
      });
    }

    return () => {
      if (cleanup) cleanup();
    };
  }, [onDownload]);

  const loadAvailableModels = async () => {
    try {
      const models = await llamaCppService.getAvailableModelsFromHuggingFace();
      setAvailableModels(models);
      if (models.length > 0) {
        setSelectedModel(models[0].id);
      }
    } catch (error) {
      console.error('Failed to load available models:', error);
    }
  };

  const handleDownload = async () => {
    if (!selectedModel) return;

    setLoading(true);
    setDownloadProgress({ progress: 0, status: 'Preparing download...' });

    try {
      const result = await llamaCppService.downloadModel(selectedModel, selectedQuantization);

      if (result) {
        // Download initiated successfully
        console.log('Download started for:', selectedModel);
        // Progress will be tracked via the event listener
      }
    } catch (error) {
      console.error('Failed to download model:', error);
      setDownloadProgress(null);
      setLoading(false);

      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('manually')) {
        alert('Automatic downloading is not available for this model. Please download the .gguf file manually from Hugging Face and place it in the models directory.');
      } else {
        alert(`Download failed: ${errorMessage}`);
      }
    }
  };

  const selectedModelData = availableModels.find(m => m.id === selectedModel);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center">
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Download Model</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Model Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select Model
            </label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableModels.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name} ({model.downloads.toLocaleString()} downloads)
                </option>
              ))}
            </select>
          </div>

          {/* Model Description */}
          {selectedModelData && (
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h4 className="font-medium text-white mb-2">{selectedModelData.name}</h4>
              <p className="text-gray-400 text-sm mb-3">{selectedModelData.description}</p>
              <div className="text-xs text-gray-500">
                Downloads: {selectedModelData.downloads.toLocaleString()}
              </div>
            </div>
          )}

          {/* Quantization Selection */}
          {selectedModelData && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Quantization Level
              </label>
              <select
                value={selectedQuantization}
                onChange={(e) => setSelectedQuantization(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {selectedModelData.quantizations.map((quant) => {
                  const size = selectedModelData.size?.[quant];
                  return (
                    <option key={quant} value={quant}>
                      {quant} {quant === 'Q4_K_M' ? '(Recommended)' : ''} {size ? `- ${size}` : ''}
                    </option>
                  );
                })}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Q4_K_M provides the best balance of quality and performance for most use cases.
                {selectedModelData.size?.[selectedQuantization] && (
                  <span className="block mt-1">
                    Download size: {selectedModelData.size[selectedQuantization]}
                  </span>
                )}
              </p>
            </div>
          )}

          {/* Download Progress */}
          {downloadProgress && (
            <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-blue-400 mt-0.5">📥</div>
                <div className="flex-1">
                  <h4 className="text-blue-300 font-medium mb-2">Downloading Model</h4>
                  <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${downloadProgress.progress}%` }}
                    />
                  </div>
                  <p className="text-blue-200/80 text-sm">
                    {downloadProgress.status}
                  </p>
                  <p className="text-blue-200/60 text-xs mt-1">
                    {downloadProgress.progress}% complete
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Download Notice */}
          {!downloadProgress && (
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-yellow-400 mt-0.5">⚠️</div>
                <div>
                  <h4 className="text-yellow-300 font-medium mb-1">Download Notice</h4>
                  <p className="text-yellow-200/80 text-sm">
                    Automatic downloading may not work for all models. If download fails,
                    please manually download .gguf files from Hugging Face and place them in the models directory.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              disabled={loading || !selectedModel || !!downloadProgress}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {downloadProgress ? `Downloading... ${downloadProgress.progress}%` :
               loading ? 'Preparing...' : 'Download'}
            </button>
          </div>
        </div>
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
  const [parameters, setParameters] = useState(model.parameters);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await llamaCppService.updateModelParameters(model.id, parameters);
      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to update parameters:', error);
      alert('Failed to update model parameters. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleParameterChange = (key: string, value: number | string) => {
    setParameters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center">
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Configure {model.name}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Context Size */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Context Size
            </label>
            <input
              type="number"
              value={parameters.contextSize || 4096}
              onChange={(e) => handleParameterChange('contextSize', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="512"
              max="32768"
              step="512"
            />
            <p className="text-xs text-gray-500 mt-1">
              Maximum number of tokens the model can process at once (512-32768)
            </p>
          </div>

          {/* Threads */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              CPU Threads
            </label>
            <input
              type="number"
              value={parameters.threads || -1}
              onChange={(e) => handleParameterChange('threads', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="-1"
              max="32"
            />
            <p className="text-xs text-gray-500 mt-1">
              Number of CPU threads to use (-1 for auto-detect)
            </p>
          </div>

          {/* GPU Layers */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              GPU Layers
            </label>
            <input
              type="number"
              value={parameters.gpuLayers || 0}
              onChange={(e) => handleParameterChange('gpuLayers', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0"
              max="100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Number of layers to offload to GPU (0 for CPU-only)
            </p>
          </div>

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Temperature
            </label>
            <input
              type="number"
              value={parameters.temperature || 0.7}
              onChange={(e) => handleParameterChange('temperature', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0.1"
              max="2.0"
              step="0.1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Controls randomness in generation (0.1-2.0, lower = more focused)
            </p>
          </div>

          {/* Top K */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Top K
            </label>
            <input
              type="number"
              value={parameters.topK || 40}
              onChange={(e) => handleParameterChange('topK', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="100"
            />
            <p className="text-xs text-gray-500 mt-1">
              Limits vocabulary to top K most likely tokens
            </p>
          </div>

          {/* Top P */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Top P
            </label>
            <input
              type="number"
              value={parameters.topP || 0.9}
              onChange={(e) => handleParameterChange('topP', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="0.1"
              max="1.0"
              step="0.1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Nucleus sampling threshold (0.1-1.0)
            </p>
          </div>

          {/* Repeat Penalty */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Repeat Penalty
            </label>
            <input
              type="number"
              value={parameters.repeatPenalty || 1.1}
              onChange={(e) => handleParameterChange('repeatPenalty', parseFloat(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1.0"
              max="2.0"
              step="0.1"
            />
            <p className="text-xs text-gray-500 mt-1">
              Penalty for repeating tokens (1.0 = no penalty, higher = less repetition)
            </p>
          </div>

          {/* Batch Size */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Batch Size
            </label>
            <input
              type="number"
              value={parameters.batchSize || 512}
              onChange={(e) => handleParameterChange('batchSize', parseInt(e.target.value))}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
              max="2048"
            />
            <p className="text-xs text-gray-500 mt-1">
              Number of tokens to process in parallel
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {loading ? 'Saving...' : 'Save Parameters'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
