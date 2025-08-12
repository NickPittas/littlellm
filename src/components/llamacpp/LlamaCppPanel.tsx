'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
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

  const loadModels = useCallback(async () => {
    try {
      console.log('🔄 LlamaCppPanel.loadModels() called');
      setError(null);
      const modelList = await llamaCppService.getModels();
      console.log('📋 Received model list:', modelList);
      setModels(modelList);
      console.log('✅ Models state updated');
    } catch (err) {
      const error = err as Error;
      console.error('Failed to load models:', error);
      const errorInfo = handleError(error, 'loadModels');
      setError(errorInfo.message);
      notifications.notifyError('Failed to Load Models', errorInfo.message);
    }
  }, [handleError, notifications]);

  useEffect(() => {
    if (isOpen) {
      loadModels();
      checkDirectServerStatus();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Temporarily disabled to fix infinite loop
  // // Listen for models updated events
  // useEffect(() => {
  //   const handleModelsUpdated = () => {
  //     console.log('🔄 Models updated event received, refreshing list...');
  //     loadModels();
  //   };

  //   if (typeof window !== 'undefined') {
  //     window.addEventListener('llamacpp-models-updated', handleModelsUpdated);
  //   }

  //   return () => {
  //     if (typeof window !== 'undefined') {
  //       window.removeEventListener('llamacpp-models-updated', handleModelsUpdated);
  //     }
  //   };
  // }, [loadModels]);

  const checkDirectServerStatus = async () => {
    try {
      const running = await llamaCppService.isDirectServerRunning();
      setIsSwapRunning(running);
    } catch (err) {
      const error = err as Error;
      console.error('Failed to check direct server status:', error);
      const errorInfo = handleError(error, 'checkDirectServerStatus');
      notifications.notifyWarning('Status Check Failed', errorInfo.message);
    }
  };

  const handleStartDirectServer = async () => {
    setLoading(true);
    try {
      // For direct server, we need a model to start with
      // This function is now mainly for UI compatibility
      notifications.notifyInfo('Direct Server', 'Please select a model to start the direct server');
    } catch (err) {
      const error = err as Error;
      console.error('Failed to start direct server:', error);
      const errorInfo = handleError(error, 'startDirectServer');
      notifications.notifyError('Start Failed', errorInfo.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStopDirectServer = async () => {
    setLoading(true);
    try {
      await llamaCppService.stopDirectServer();
      setIsSwapRunning(false);
      notifications.notifySuccess('Server Stopped', 'Direct llama.cpp server stopped');
    } catch (err) {
      const error = err as Error;
      console.error('Failed to stop direct server:', error);
      const errorInfo = handleError(error, 'stopDirectServer');
      notifications.notifyError('Stop Failed', errorInfo.message);
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

  const handleStartWithModel = async (modelId: string) => {
    setLoading(true);
    try {
      await llamaCppService.startServerWithModel(modelId);
      await checkDirectServerStatus();
      await loadModels();
      const model = models.find(m => m.id === modelId);
      const modelName = model?.name || modelId;
      notifications.notifySuccess('Server Started', `Server started with model: ${modelName}`);
    } catch (error) {
      const errorInfo = handleError(error as Error, 'startWithModel');
      notifications.notifyError('Failed to Start Server', errorInfo.message);
    } finally {
      setLoading(false);
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

  const handleTestServer = async (model: LlamaCppModel) => {
    try {
      console.log(`🧪 Testing llama-server with model: ${model.name}`);
      const result = await llamaCppService.testLlamaServer(model.filePath);

      if (result.success) {
        notifications.notifySuccess('Server Test', `llama-server.exe works correctly with ${model.name}`);
      } else {
        notifications.notifyError('Server Test Failed', `Error: ${result.error}\n\nStdout: ${result.stdout || 'None'}\n\nStderr: ${result.stderr || 'None'}`);
      }
    } catch (error) {
      const errorInfo = handleError(error as Error, 'testServer');
      notifications.notifyError('Test Failed', errorInfo.message);
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
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Llama.cpp Management</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAutoConfig(true)}
              className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded transition-colors text-xs"
            >
              <Settings className="w-3 h-3" />
              Auto-Config
            </button>
            <button
              onClick={() => setShowPerformanceMonitor(true)}
              className="flex items-center gap-1 px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors text-xs"
            >
              <Activity className="w-3 h-3" />
              Performance
            </button>
            <button
              onClick={() => setShowDownloadDialog(true)}
              className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors text-xs"
            >
              <Plus className="w-3 h-3" />
              Add Model
            </button>
            <button
              onClick={loadModels}
              className="px-2 py-1 bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors text-xs"
              title="Refresh models list"
            >
              🔄
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-sm"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="p-2 border-b border-gray-700/50 bg-gray-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${isSwapRunning ? 'bg-green-400' : 'bg-red-400'}`} />
                <span className="text-xs text-gray-300">
                  Server: {isSwapRunning ? 'Running' : 'Stopped'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-300">
                  {models.length} models
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {isSwapRunning ? (
                <button
                  onClick={handleStopDirectServer}
                  disabled={loading}
                  className="flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Square className="w-3 h-3" />}
                  {loading ? 'Stopping...' : 'Stop'}
                </button>
              ) : (
                <button
                  onClick={handleStartDirectServer}
                  disabled={loading}
                  className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-700 text-white rounded text-xs transition-colors disabled:opacity-50"
                >
                  {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                  {loading ? 'Starting...' : 'Start'}
                </button>
              )}
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
        <div className="flex-1 overflow-y-auto p-2">
          {models.length === 0 ? (
            <div className="text-center py-8">
              <HardDrive className="w-8 h-8 text-gray-500 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-300 mb-2">No Models Found</h3>
              <p className="text-xs text-gray-500 mb-3">
                Add GGUF model files to the models directory or use the &quot;Add Model&quot; button to download them.
              </p>
            </div>
          ) : (
            <div className="grid gap-2">
              {models.map((model) => (
                <div
                  key={model.id}
                  className="bg-gray-800/50 rounded border border-gray-700/50 p-2 hover:bg-gray-800/70 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-white">{model.name}</h3>
                        <div className={`w-1.5 h-1.5 rounded-full ${model.isRunning ? 'bg-green-400' : 'bg-gray-500'}`} />
                      </div>
                      {model.description && (
                        <p className="text-xs text-gray-400 mb-2">{model.description}</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <HardDrive className="w-3 h-3" />
                          {formatFileSize(model.size)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Cpu className="w-3 h-3" />
                          {model.parameters.contextSize || 4096}
                        </div>
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {model.parameters.gpuLayers || 0} GPU
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleStartWithModel(model.id)}
                        disabled={loading || model.isRunning}
                        className="p-1 text-gray-400 hover:text-green-400 hover:bg-gray-700/50 rounded transition-colors disabled:opacity-50"
                        title="Start Server with this Model"
                      >
                        <Play className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => {
                          setSelectedModel(model);
                          setShowParametersDialog(true);
                        }}
                        className="p-1 text-gray-400 hover:text-white hover:bg-gray-700/50 rounded transition-colors"
                        title="Configure Parameters"
                      >
                        <Settings className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleTestServer(model)}
                        className="p-1 text-gray-400 hover:text-blue-400 hover:bg-gray-700/50 rounded transition-colors"
                        title="Test llama-server.exe with this model"
                      >
                        <Zap className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteModel(model.id)}
                        className="p-1 text-gray-400 hover:text-red-400 hover:bg-gray-700/50 rounded transition-colors"
                        title="Delete Model"
                      >
                        <Trash2 className="w-3 h-3" />
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
  const [customModelInput, setCustomModelInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Array<{
    id: string;
    name: string;
    description: string;
    downloads: number;
    quantizations: string[];
    size?: Record<string, string>;
  }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'popular' | 'search' | 'custom'>('popular');

  // Check if we're in Electron environment
  const isElectronApp = typeof window !== 'undefined' && !!window.electronAPI;

  useEffect(() => {
    loadAvailableModels();

    // Set up download progress listeners
    let electronCleanup: (() => void) | undefined;

    // Electron progress listener
    if (typeof window !== 'undefined' && window.electronAPI?.onLlamaCppDownloadProgress) {
      electronCleanup = window.electronAPI.onLlamaCppDownloadProgress((data) => {
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

    // Browser progress listener
    const handleBrowserProgress = (event: CustomEvent) => {
      const { progress, status } = event.detail;
      setDownloadProgress({ progress, status });

      if (progress === 100) {
        // Download complete, refresh models list
        setTimeout(() => {
          setDownloadProgress(null);
          onDownload();
        }, 2000);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('llamacpp-download-progress', handleBrowserProgress as EventListener);
    }

    return () => {
      if (electronCleanup) electronCleanup();
      if (typeof window !== 'undefined') {
        window.removeEventListener('llamacpp-download-progress', handleBrowserProgress as EventListener);
      }
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

  const searchHuggingFaceModels = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      console.log(`🔍 Searching Hugging Face for: ${query}`);

      // Mock search results for now - in a real implementation, this would call the Hugging Face API
      const mockResults = [
        {
          id: `${query}/GGUF`,
          name: `${query} GGUF`,
          description: `GGUF quantized version of ${query}`,
          downloads: Math.floor(Math.random() * 10000),
          quantizations: ['Q4_K_M', 'Q5_K_M', 'Q8_0', 'F16']
        },
        {
          id: `${query}-instruct/GGUF`,
          name: `${query} Instruct GGUF`,
          description: `Instruction-tuned GGUF version of ${query}`,
          downloads: Math.floor(Math.random() * 5000),
          quantizations: ['Q4_K_M', 'Q5_K_M', 'Q8_0']
        }
      ];

      // Add some popular models if query matches
      if (query.toLowerCase().includes('llama')) {
        mockResults.push({
          id: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
          name: 'Llama 3.2 3B Instruct GGUF',
          description: 'Meta Llama 3.2 3B Instruct model in GGUF format',
          downloads: 75000,
          quantizations: ['Q4_K_M', 'Q5_K_M', 'Q8_0', 'F16']
        });
      }

      if (query.toLowerCase().includes('phi')) {
        mockResults.push({
          id: 'microsoft/Phi-3-mini-4k-instruct-gguf',
          name: 'Phi-3 Mini 4K Instruct GGUF',
          description: 'Microsoft Phi-3 Mini model optimized for instruction following',
          downloads: 50000,
          quantizations: ['Q4_K_M', 'Q5_K_M', 'Q8_0']
        });
      }

      // Use the real Hugging Face search service instead of mock results
      const { huggingFaceSearchService } = await import('../../services/huggingFaceSearch');
      const results = await huggingFaceSearchService.searchModels(query, {
        limit: 20,
        sort: 'downloads'
      });

      // Transform results to match the expected format
      const transformedResults = results.map((model) => ({
        id: model.id,
        name: model.name,
        description: model.description,
        downloads: model.downloads,
        quantizations: model.quantizations,
        size: model.size
      }));

      console.log(`✅ Found ${transformedResults.length} models from Hugging Face`);
      setSearchResults(transformedResults.slice(0, 10)); // Show top 10 results
    } catch (error) {
      console.error('Failed to search models:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };



  const parseCustomModelInput = (input: string) => {
    // Parse formats like:
    // - unsloth/gpt-oss-20b-GGUF:Q4_K_M
    // - microsoft/Phi-3-mini-4k-instruct-gguf
    // - bartowski/Llama-3.2-3B-Instruct-GGUF:Q5_K_M

    const parts = input.trim().split(':');
    const modelId = parts[0];
    const quantization = parts[1] || 'Q4_K_M';

    if (!modelId) return null;

    return {
      id: modelId,
      name: modelId.split('/').pop() || modelId,
      description: `Custom model: ${modelId}`,
      downloads: 0,
      quantizations: [quantization],
      quantization
    };
  };

  const handleDownload = async () => {
    let modelToDownload = selectedModel;
    let quantizationToUse = selectedQuantization;

    // Handle custom model input
    if (activeTab === 'custom' && customModelInput.trim()) {
      const parsed = parseCustomModelInput(customModelInput);
      if (!parsed) {
        alert('Invalid model format. Please use format: owner/model-name:quantization (e.g., unsloth/gpt-oss-20b-GGUF:Q4_K_M)');
        return;
      }
      modelToDownload = parsed.id;
      quantizationToUse = parsed.quantization;
    }

    if (!modelToDownload) {
      alert('Please select a model or enter a custom model.');
      return;
    }

    setLoading(true);
    setDownloadProgress({ progress: 0, status: 'Preparing download...' });

    try {
      const result = await llamaCppService.downloadModel(modelToDownload, quantizationToUse);

      if (result) {
        // Download initiated successfully
        console.log('Download started for:', modelToDownload);

        if (isElectronApp) {
          // Progress will be tracked via the event listener in Electron
          setLoading(false);
        } else {
          // In browser mode, the progress listener will handle completion
          // Just reset loading state - progress listener will show completion
          setLoading(false);
        }
      }
    } catch (error) {
      console.error('Failed to download model:', error);
      setDownloadProgress(null);
      setLoading(false);

      const errorMessage = error instanceof Error ? error.message : String(error);

      if (errorMessage.includes('Repository not found')) {
        alert(`Repository not found: ${modelToDownload}\n\nPlease check:\n- The repository name is correct\n- The repository exists on Hugging Face\n- You have access to the repository`);
      } else if (errorMessage.includes('No GGUF files found')) {
        alert(`No GGUF files found in repository: ${modelToDownload}\n\nThis may not be a GGUF model repository. Please check:\n- The repository contains .gguf files\n- Try searching for a different model\n\nManual link: https://huggingface.co/${modelToDownload}/tree/main`);
      } else if (errorMessage.includes('Browser download failed')) {
        alert(`Download failed: ${errorMessage}\n\nYou can manually download from: https://huggingface.co/${modelToDownload}/tree/main`);
      } else if (errorMessage.includes('require is not defined')) {
        alert(`Download system error detected. Trying browser download instead...\n\nIf this continues to fail, you can manually download from: https://huggingface.co/${modelToDownload}/tree/main`);
      } else {
        alert(`Download failed: ${errorMessage}\n\nManual download: https://huggingface.co/${modelToDownload}/tree/main`);
      }
    }
  };

  const selectedModelData = availableModels.find(m => m.id === selectedModel) ||
                           searchResults.find(m => m.id === selectedModel);

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
          {/* Tab Navigation */}
          <div className="flex space-x-1 bg-gray-800 rounded p-1">
            <button
              onClick={() => setActiveTab('popular')}
              className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                activeTab === 'popular'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              Popular
            </button>
            <button
              onClick={() => setActiveTab('search')}
              className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                activeTab === 'search'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              Search HF
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`flex-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                activeTab === 'custom'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700'
              }`}
            >
              Custom
            </button>
          </div>

          {/* Popular Models Tab */}
          {activeTab === 'popular' && (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Select Popular Model
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Choose a model...</option>
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} ({model.downloads.toLocaleString()} downloads)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search Tab */}
          {activeTab === 'search' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1">
                  Search Hugging Face Models
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchHuggingFaceModels(searchQuery)}
                    placeholder="e.g., microsoft/Phi-3, unsloth/llama-3"
                    className="flex-1 px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <button
                    onClick={() => searchHuggingFaceModels(searchQuery)}
                    disabled={isSearching}
                    className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded transition-colors"
                  >
                    {isSearching ? 'Searching...' : 'Search'}
                  </button>
                </div>
              </div>

              {searchResults.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1">
                    Search Results ({searchResults.length} models found)
                  </label>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {searchResults.map((model) => (
                      <div
                        key={model.id}
                        className="p-2 border rounded border-gray-600 bg-gray-800/50"
                      >
                        {/* Model Header */}
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex-1">
                            <h4 className="font-medium text-white text-xs">{model.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-400">
                                {model.id.split('/')[0]}
                              </span>
                              <span className="text-xs text-gray-500">•</span>
                              <span className="text-xs text-gray-400">
                                {model.downloads.toLocaleString()} downloads
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-gray-400 mb-2 line-clamp-2">{model.description}</p>

                        {/* Quantization Selection */}
                        <div className="mb-2">
                          <label className="block text-xs font-medium text-gray-300 mb-1">
                            Select Quantization:
                          </label>
                          <div className="grid grid-cols-3 gap-1">
                            {model.quantizations.map((quant) => (
                              <button
                                key={`${model.id}-${quant}`}
                                onClick={() => {
                                  setSelectedModel(model.id);
                                  setSelectedQuantization(quant);
                                }}
                                className={`p-1 text-xs rounded border transition-colors ${
                                  selectedModel === model.id && selectedQuantization === quant
                                    ? 'border-blue-500 bg-blue-900/30 text-blue-300'
                                    : 'border-gray-600 bg-gray-800/50 text-gray-300 hover:bg-gray-700/50'
                                }`}
                              >
                                <div className="font-medium text-xs">{quant}</div>
                                {model.size && model.size[quant] && (
                                  <div className="text-xs text-gray-400">
                                    {model.size[quant]}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Download Button */}
                        <button
                          onClick={() => {
                            setSelectedModel(model.id);
                            if (!selectedQuantization && model.quantizations.length > 0) {
                              setSelectedQuantization(model.quantizations[0]);
                            }
                            handleDownload();
                          }}
                          disabled={loading}
                          className="w-full px-2 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded text-xs transition-colors"
                        >
                          {loading && selectedModel === model.id ? 'Downloading...' : `Download ${selectedQuantization || model.quantizations[0] || 'Model'}`}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custom Model Tab */}
          {activeTab === 'custom' && (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Custom Model Repository
              </label>
              <input
                type="text"
                value={customModelInput}
                onChange={(e) => setCustomModelInput(e.target.value)}
                placeholder="e.g., unsloth/gpt-oss-20b-GGUF:Q4_K_M"
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="mt-1 text-xs text-gray-400">
                <p className="mb-1">Supported formats:</p>
                <ul className="list-disc list-inside space-y-0 text-xs">
                  <li><code>owner/model-name</code> (uses Q4_K_M by default)</li>
                  <li><code>owner/model-name:Q4_K_M</code> (specify quantization)</li>
                  <li><code>unsloth/gpt-oss-20b-GGUF:Q5_K_M</code> (example)</li>
                </ul>
              </div>
            </div>
          )}

          {/* Quantization Selection for Popular Models */}
          {activeTab === 'popular' && selectedModelData && (
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                Quantization Level
              </label>
              <select
                value={selectedQuantization}
                onChange={(e) => setSelectedQuantization(e.target.value)}
                className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {selectedModelData.quantizations.map((quant) => (
                  <option key={quant} value={quant}>
                    {quant} {quant === 'Q4_K_M' ? '(Recommended)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Download Information */}
        <div className="bg-blue-900/20 border border-blue-700/50 rounded p-2">
          <div className="flex items-start gap-2">
            <div className="text-blue-400 mt-0.5 text-xs">ℹ️</div>
            <div className="flex-1">
              <h4 className="text-blue-300 font-medium mb-1 text-xs">Automatic Download</h4>
              <p className="text-blue-200/80 text-xs mb-1">
                {isElectronApp
                  ? 'Models will be downloaded automatically to your configured models directory. You can change the download folder in Settings → General.'
                  : 'Models will be downloaded automatically to your browser storage. No manual file management required!'
                }
              </p>
              {!isElectronApp && (
                <div className="text-xs text-blue-300/70 space-y-1">
                  <div>💾 Stored in browser for instant access and immediate use</div>
                  <div>⚠️ <strong>Size Limit:</strong> Browser downloads limited to ~1GB. Large quantizations (Q8_K_XL, F16) may fail.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Download Progress */}
        {downloadProgress && (
          <div className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-blue-400">📥</div>
              <div className="flex-1">
                <h4 className="text-blue-300 font-medium">Downloading Model</h4>
                <p className="text-blue-200/80 text-sm">{downloadProgress.status}</p>
              </div>
              <div className="text-blue-300 font-mono text-sm">
                {downloadProgress.progress}%
              </div>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${downloadProgress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-3 mt-3 border-t border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleDownload}
            disabled={loading || (activeTab === 'custom' ? !customModelInput.trim() : !selectedModel)}
            className="flex-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded transition-colors"
          >
            {loading ? 'Downloading...' : 'Download'}
          </button>
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

  // Local state for input values to allow proper editing
  const [inputValues, setInputValues] = useState({
    contextSize: String(model.parameters.contextSize || 8192),
    threads: String(model.parameters.threads || -1),
    gpuLayers: String(model.parameters.gpuLayers || 0),
    temperature: String(model.parameters.temperature || 0.7),
    topK: String(model.parameters.topK || 40),
    topP: String(model.parameters.topP || 0.9),
    repeatPenalty: String(model.parameters.repeatPenalty || 1.1),
    batchSize: String(model.parameters.batchSize || 512),
    port: String(model.parameters.port || 8080),
    host: String(model.parameters.host || '127.0.0.1'),
    seed: String(model.parameters.seed || -1),
    minP: String(model.parameters.minP || 0.05),
    tfsZ: String(model.parameters.tfsZ || 1.0),
    typicalP: String(model.parameters.typicalP || 1.0),
    mirostat: String(model.parameters.mirostat || 0),
    mirostatTau: String(model.parameters.mirostatTau || 5.0),
    mirostatEta: String(model.parameters.mirostatEta || 0.1),
    timeout: String(model.parameters.timeout || 600)
  });

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

  const handleParameterChange = (key: string, value: number | string | boolean) => {
    setParameters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handle input value changes (for display)
  const handleInputChange = (key: string, value: string) => {
    setInputValues(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Handle input blur (validate and update parameter)
  const handleInputBlur = (key: string, value: string, parser: (val: string) => number, min: number, max: number, defaultValue: number) => {
    const parsed = parser(value);
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      handleParameterChange(key, parsed);
    } else {
      // Reset to current parameter value if invalid
      const currentValue = parameters[key] || defaultValue;
      setInputValues(prev => ({
        ...prev,
        [key]: String(currentValue)
      }));
    }
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

        <div className="space-y-3">
          {/* Context Size */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              Context Size
            </label>
            <input
              type="text"
              value={inputValues.contextSize}
              onChange={(e) => handleInputChange('contextSize', e.target.value)}
              onBlur={(e) => handleInputBlur('contextSize', e.target.value, parseInt, 512, 32768, 8192)}
              className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="8192"
            />
            <p className="text-xs text-gray-500">
              Maximum context length in tokens (512-32768)
            </p>
          </div>

          {/* Threads */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              CPU Threads
            </label>
            <input
              type="text"
              value={inputValues.threads}
              onChange={(e) => handleInputChange('threads', e.target.value)}
              onBlur={(e) => handleInputBlur('threads', e.target.value, parseInt, -1, 32, -1)}
              className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="-1"
            />
            <p className="text-xs text-gray-500">
              Number of CPU threads (-1 for auto-detect, max 32)
            </p>
          </div>

          {/* GPU Layers */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              GPU Layers
            </label>
            <input
              type="text"
              value={inputValues.gpuLayers}
              onChange={(e) => handleInputChange('gpuLayers', e.target.value)}
              onBlur={(e) => handleInputBlur('gpuLayers', e.target.value, parseInt, 0, 100, 32)}
              className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="32"
            />
            <p className="text-xs text-gray-500">
              Number of layers to offload to GPU (32 for GPU acceleration, 0 for CPU-only)
            </p>
          </div>

          {/* Temperature */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              Temperature
            </label>
            <input
              type="text"
              value={inputValues.temperature}
              onChange={(e) => handleInputChange('temperature', e.target.value)}
              onBlur={(e) => handleInputBlur('temperature', e.target.value, parseFloat, 0.1, 2.0, 0.7)}
              className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="0.7"
            />
            <p className="text-xs text-gray-500">
              Controls randomness (0.1-2.0, lower = more focused)
            </p>
          </div>

          {/* Top K */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              Top K
            </label>
            <input
              type="text"
              value={inputValues.topK}
              onChange={(e) => handleInputChange('topK', e.target.value)}
              onBlur={(e) => handleInputBlur('topK', e.target.value, parseInt, 1, 100, 40)}
              className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="40"
            />
            <p className="text-xs text-gray-500">
              Limits vocabulary to top K tokens (1-100)
            </p>
          </div>

          {/* Top P */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              Top P
            </label>
            <input
              type="text"
              value={inputValues.topP}
              onChange={(e) => handleInputChange('topP', e.target.value)}
              onBlur={(e) => handleInputBlur('topP', e.target.value, parseFloat, 0.1, 1.0, 0.9)}
              className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="0.9"
            />
            <p className="text-xs text-gray-500">
              Nucleus sampling threshold (0.1-1.0)
            </p>
          </div>

          {/* Repeat Penalty */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              Repeat Penalty
            </label>
            <input
              type="text"
              value={parameters.repeatPenalty || 1.1}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 1.1;
                if (value >= 1.0 && value <= 2.0) {
                  handleParameterChange('repeatPenalty', value);
                }
              }}
              className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="1.1"
            />
            <p className="text-xs text-gray-500">
              Penalty for repeating tokens (1.0-2.0, higher = less repetition)
            </p>
          </div>

          {/* Batch Size */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              Batch Size
            </label>
            <input
              type="text"
              value={parameters.batchSize || 512}
              onChange={(e) => {
                const value = parseInt(e.target.value) || 512;
                if (value >= 1 && value <= 2048) {
                  handleParameterChange('batchSize', value);
                }
              }}
              className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="512"
            />
            <p className="text-xs text-gray-500">
              Number of tokens to process in parallel (1-2048)
            </p>
          </div>

          {/* Tool Calling & Templates */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              Enable Jinja Templates (Required for Tool Calling)
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={parameters.jinja || false}
                onChange={(e) => handleParameterChange('jinja', e.target.checked)}
                className="w-3 h-3 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-1"
              />
              <span className="text-xs text-gray-400">Enable --jinja flag for tool calling support</span>
            </div>
            <div className="text-xs text-yellow-400 bg-yellow-900/20 p-2 rounded">
              ⚠️ This must be enabled for tool calling to work. Without --jinja flag, you'll get "500 Internal Server Error - tools param requires --jinja flag"
            </div>
          </div>

          {/* Flash Attention */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              Flash Attention
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={parameters.flashAttention || false}
                onChange={(e) => handleParameterChange('flashAttention', e.target.checked)}
                className="w-3 h-3 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-1"
              />
              <span className="text-xs text-gray-400">Enable flash attention for better performance</span>
            </div>
          </div>

          {/* KV Cache Quantization */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-300">
              KV Cache Quantization
            </label>
            <select
              value={parameters.kvCacheQuantization || 'f16'}
              onChange={(e) => handleParameterChange('kvCacheQuantization', e.target.value)}
              className="w-full px-2 py-1 text-xs bg-gray-800 border border-gray-600 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="f16">f16 (Default)</option>
              <option value="q8_0">q8_0</option>
              <option value="q4_0">q4_0</option>
              <option value="q4_1">q4_1</option>
              <option value="iq4_nl">iq4_nl</option>
              <option value="q5_0">q5_0</option>
              <option value="q5_1">q5_1</option>
            </select>
            <p className="text-xs text-gray-500">
              Quantization level for key-value cache (lower = faster, less memory)
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-3">
            <button
              onClick={onClose}
              className="flex-1 px-2 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:opacity-50 text-white rounded transition-colors"
            >
              {loading ? 'Saving...' : 'Save Parameters'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
