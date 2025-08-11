'use client';

import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Cpu, 
  HardDrive, 
  Zap, 
  Clock, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Info
} from 'lucide-react';
import { 
  llamaCppPerformanceMonitor, 
  PerformanceMetrics,
  LlamaCppPerformanceMonitor
} from '../../services/llamaCppPerformanceMonitor';

interface PerformanceMonitorProps {
  isVisible: boolean;
  onClose: () => void;
}

export function PerformanceMonitor({ isVisible, onClose }: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [recommendations, setRecommendations] = useState<string[]>([]);

  useEffect(() => {
    if (!isVisible) return;

    // Initial load
    const initialMetrics = llamaCppPerformanceMonitor.getMetrics();
    setMetrics(initialMetrics);

    const report = llamaCppPerformanceMonitor.getPerformanceReport();
    setRecommendations(report.recommendations);

    // Subscribe to updates
    const unsubscribe = llamaCppPerformanceMonitor.onMetricsUpdate((newMetrics) => {
      setMetrics(newMetrics);
      const newReport = llamaCppPerformanceMonitor.getPerformanceReport();
      setRecommendations(newReport.recommendations);
    });

    return unsubscribe;
  }, [isVisible]);

  if (!isVisible || !metrics) return null;

  const getPerformanceStatus = () => {
    if (metrics.tokensPerSecond > 15 && metrics.errorRate < 5) {
      return { status: 'excellent', color: 'text-green-400', icon: CheckCircle };
    } else if (metrics.tokensPerSecond > 8 && metrics.errorRate < 10) {
      return { status: 'good', color: 'text-blue-400', icon: Info };
    } else {
      return { status: 'needs-attention', color: 'text-yellow-400', icon: AlertTriangle };
    }
  };

  const performanceStatus = getPerformanceStatus();
  const StatusIcon = performanceStatus.icon;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className="bg-gray-900/95 backdrop-blur-md rounded-xl border border-gray-700/50 w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <Activity className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-semibold text-white">Performance Monitor</h2>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gray-800/50 ${performanceStatus.color}`}>
              <StatusIcon className="w-4 h-4" />
              <span className="text-sm font-medium capitalize">{performanceStatus.status.replace('-', ' ')}</span>
            </div>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Performance Metrics */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white mb-4">Performance Metrics</h3>
              
              {/* Tokens per Second */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  <span className="text-gray-300">Tokens per Second</span>
                </div>
                <div className="text-2xl font-bold text-white">
                  {LlamaCppPerformanceMonitor.formatTokensPerSecond(metrics.tokensPerSecond)}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Total tokens: {metrics.totalTokens.toLocaleString()}
                </div>
              </div>

              {/* Latency */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <span className="text-gray-300">Response Latency</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-lg font-bold text-white">
                      {LlamaCppPerformanceMonitor.formatLatency(metrics.averageLatency)}
                    </div>
                    <div className="text-xs text-gray-500">Average</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">
                      {LlamaCppPerformanceMonitor.formatLatency(metrics.firstTokenLatency)}
                    </div>
                    <div className="text-xs text-gray-500">First Token</div>
                  </div>
                </div>
              </div>

              {/* Request Stats */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  <span className="text-gray-300">Request Statistics</span>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-lg font-bold text-white">
                      {metrics.totalRequests}
                    </div>
                    <div className="text-xs text-gray-500">Total Requests</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-white">
                      {LlamaCppPerformanceMonitor.formatErrorRate(metrics.errorRate)}
                    </div>
                    <div className="text-xs text-gray-500">Error Rate</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Resource Usage */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-white mb-4">Resource Usage</h3>
              
              {/* Memory Usage */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <HardDrive className="w-5 h-5 text-purple-400" />
                  <span className="text-gray-300">Memory Usage</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, metrics.memoryUsage)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-lg font-bold text-white">
                    {LlamaCppPerformanceMonitor.formatMemoryUsage(metrics.memoryUsage)}
                  </div>
                </div>
              </div>

              {/* CPU Usage */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Cpu className="w-5 h-5 text-orange-400" />
                  <span className="text-gray-300">CPU Usage</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div 
                        className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, metrics.cpuUsage)}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-lg font-bold text-white">
                    {LlamaCppPerformanceMonitor.formatMemoryUsage(metrics.cpuUsage)}
                  </div>
                </div>
              </div>

              {/* Model Configuration */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Info className="w-5 h-5 text-blue-400" />
                  <span className="text-gray-300">Model Configuration</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Model:</span>
                    <span className="text-white">{metrics.modelName || 'Not loaded'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Context Size:</span>
                    <span className="text-white">{metrics.contextSize || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Batch Size:</span>
                    <span className="text-white">{metrics.batchSize || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Avg Response:</span>
                    <span className="text-white">{Math.round(metrics.averageResponseLength)} tokens</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {recommendations.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium text-white mb-4">Performance Recommendations</h3>
              <div className="space-y-3">
                {recommendations.map((recommendation, index) => (
                  <div key={index} className="bg-blue-900/20 border border-blue-700/50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
                      <p className="text-blue-200/80 text-sm">{recommendation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Session Info */}
          <div className="mt-6 pt-4 border-t border-gray-700/50">
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>Session started: {new Date(metrics.sessionStartTime).toLocaleTimeString()}</span>
              <span>Last updated: {new Date(metrics.lastUpdateTime).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700/50">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-400">
              Monitoring active • Updates every 5 seconds
            </div>
            <button
              onClick={() => {
                llamaCppPerformanceMonitor.reset();
                setMetrics(llamaCppPerformanceMonitor.getMetrics());
              }}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
            >
              Reset Metrics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
