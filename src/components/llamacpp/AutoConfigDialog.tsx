'use client';

import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  HardDrive, 
  Zap, 
  Settings, 
  CheckCircle, 
  AlertTriangle, 
  Info,
  Loader2,
  Monitor,
  Gauge
} from 'lucide-react';
import { 
  llamaCppAutoConfig, 
  SystemCapabilities, 
  OptimalConfiguration 
} from '../../services/llamaCppAutoConfig';

interface AutoConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyConfig: (config: OptimalConfiguration) => void;
  currentModelId?: string;
}

export function AutoConfigDialog({ isOpen, onClose, onApplyConfig, currentModelId }: AutoConfigDialogProps) {
  const [loading, setLoading] = useState(false);
  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null);
  const [configuration, setConfiguration] = useState<OptimalConfiguration | null>(null);
  const [priority, setPriority] = useState<'performance' | 'quality' | 'balanced'>('balanced');
  const [recommendations, setRecommendations] = useState<Array<{
    modelId: string;
    name: string;
    suitability: 'excellent' | 'good' | 'marginal' | 'unsuitable';
    reasoning: string;
  }>>([]);

  useEffect(() => {
    if (isOpen) {
      detectSystemAndGenerate();
    }
  }, [isOpen, currentModelId, priority]);

  const detectSystemAndGenerate = async () => {
    setLoading(true);
    try {
      // Detect system capabilities
      const systemCaps = await llamaCppAutoConfig.detectSystemCapabilities();
      setCapabilities(systemCaps);

      // Generate optimal configuration
      if (currentModelId) {
        const config = llamaCppAutoConfig.generateOptimalConfiguration(
          currentModelId,
          systemCaps,
          priority
        );
        setConfiguration(config);
      }

      // Get model recommendations
      const modelRecs = llamaCppAutoConfig.getRecommendedModels(systemCaps);
      setRecommendations(modelRecs);
    } catch (error) {
      console.error('Failed to detect system or generate configuration:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyConfiguration = () => {
    if (configuration) {
      onApplyConfig(configuration);
      onClose();
    }
  };

  const getSuitabilityColor = (suitability: string) => {
    switch (suitability) {
      case 'excellent': return 'text-green-400';
      case 'good': return 'text-blue-400';
      case 'marginal': return 'text-yellow-400';
      case 'unsuitable': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getSuitabilityIcon = (suitability: string) => {
    switch (suitability) {
      case 'excellent': return CheckCircle;
      case 'good': return Info;
      case 'marginal': return AlertTriangle;
      case 'unsuitable': return AlertTriangle;
      default: return Info;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700/50 w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Auto-Configuration</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                <span className="text-white">Detecting system capabilities...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* System Capabilities */}
              {capabilities && (
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">System Capabilities</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <HardDrive className="w-5 h-5 text-purple-400" />
                        <span className="text-gray-300">Memory</span>
                      </div>
                      <div className="text-lg font-bold text-white">
                        {capabilities.availableRAM}GB / {capabilities.totalRAM}GB
                      </div>
                      <div className="text-xs text-gray-500">Available / Total RAM</div>
                    </div>

                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Cpu className="w-5 h-5 text-orange-400" />
                        <span className="text-gray-300">CPU</span>
                      </div>
                      <div className="text-lg font-bold text-white">
                        {capabilities.cpuCores} cores
                      </div>
                      <div className="text-xs text-gray-500">{capabilities.platform} {capabilities.architecture}</div>
                    </div>

                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Zap className="w-5 h-5 text-green-400" />
                        <span className="text-gray-300">GPU</span>
                      </div>
                      <div className="text-lg font-bold text-white">
                        {capabilities.hasGPU ? 'Available' : 'Not detected'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {capabilities.hasGPU && capabilities.gpuVRAM 
                          ? `${capabilities.gpuVRAM}GB VRAM` 
                          : 'CPU-only processing'}
                      </div>
                    </div>

                    <div className="bg-gray-800/50 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <Gauge className="w-5 h-5 text-blue-400" />
                        <span className="text-gray-300">Performance</span>
                      </div>
                      <div className="text-lg font-bold text-white">
                        {configuration?.performance || 'Unknown'}
                      </div>
                      <div className="text-xs text-gray-500">Expected performance level</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Priority Selection */}
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Optimization Priority</h3>
                <div className="flex gap-3">
                  {(['performance', 'balanced', 'quality'] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriority(p)}
                      className={`px-4 py-2 rounded-lg transition-colors capitalize ${
                        priority === p
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-400 mt-2">
                  {priority === 'performance' && 'Optimize for maximum speed and throughput'}
                  {priority === 'balanced' && 'Balance between speed and quality'}
                  {priority === 'quality' && 'Optimize for best response quality'}
                </p>
              </div>

              {/* Generated Configuration */}
              {configuration && (
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Recommended Configuration</h3>
                  <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <div className="text-sm text-gray-400">Context Size</div>
                        <div className="text-lg font-bold text-white">{configuration.contextSize}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">CPU Threads</div>
                        <div className="text-lg font-bold text-white">{configuration.threads}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">GPU Layers</div>
                        <div className="text-lg font-bold text-white">{configuration.gpuLayers}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Batch Size</div>
                        <div className="text-lg font-bold text-white">{configuration.batchSize}</div>
                      </div>
                    </div>

                    {/* Reasoning */}
                    {configuration.reasoning.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-300 mb-2">Configuration Reasoning</h4>
                        <ul className="space-y-1">
                          {configuration.reasoning.map((reason, index) => (
                            <li key={index} className="text-sm text-gray-400 flex items-start gap-2">
                              <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Warnings */}
                    {configuration.warnings.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-yellow-300 mb-2">Warnings</h4>
                        <ul className="space-y-1">
                          {configuration.warnings.map((warning, index) => (
                            <li key={index} className="text-sm text-yellow-200 flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                              {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Model Recommendations */}
              {recommendations.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-white mb-4">Model Recommendations</h3>
                  <div className="space-y-3">
                    {recommendations.slice(0, 5).map((rec, index) => {
                      const SuitabilityIcon = getSuitabilityIcon(rec.suitability);
                      return (
                        <div key={index} className="bg-gray-800/50 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <SuitabilityIcon className={`w-5 h-5 mt-0.5 ${getSuitabilityColor(rec.suitability)}`} />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-white">{rec.name}</span>
                                <span className={`text-xs px-2 py-1 rounded-full capitalize ${getSuitabilityColor(rec.suitability)} bg-gray-700/50`}>
                                  {rec.suitability}
                                </span>
                              </div>
                              <p className="text-sm text-gray-400">{rec.reasoning}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700/50">
          <div className="flex justify-between items-center">
            <button
              onClick={detectSystemAndGenerate}
              disabled={loading}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {loading ? 'Detecting...' : 'Re-detect System'}
            </button>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              {configuration && (
                <button
                  onClick={handleApplyConfiguration}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Apply Configuration
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
