'use client';

import { useEffect, useState } from 'react';
import { BundleMonitor } from '../utils/performanceOptimizations';

interface PerformanceMetrics {
  loadTime: number;
  memoryUsage?: {
    used: string;
    total: string;
    limit: string;
  };
  bundleSize?: number;
  chunksLoaded: number;
}

interface PerformanceMonitorProps {
  enabled?: boolean;
  showUI?: boolean;
}

export function PerformanceMonitor({ enabled = false, showUI = false }: PerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    chunksLoaded: 0
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    const startTime = performance.now();
    let chunksLoaded = 0;

    // Monitor performance metrics
    const updateMetrics = () => {
      const loadTime = performance.now() - startTime;
      
      // Get memory usage if available
      let memoryUsage;
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        memoryUsage = {
          used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
          total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
          limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
        };
      }

      setMetrics({
        loadTime,
        memoryUsage,
        chunksLoaded
      });
    };

    // Monitor chunk loading
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const url = args[0] as string;
      
      // Count JavaScript chunks
      if (url.includes('/_next/static/chunks/') && url.endsWith('.js')) {
        chunksLoaded++;
        console.log(`[PERFORMANCE] Chunk loaded: ${url.split('/').pop()}`);
        updateMetrics();
      }
      
      return response;
    };

    // Initial metrics update
    updateMetrics();

    // Update metrics every 5 seconds
    const interval = setInterval(updateMetrics, 5000);

    // Log performance on page load
    window.addEventListener('load', () => {
      BundleMonitor.logMemoryUsage();
      updateMetrics();
    });

    return () => {
      clearInterval(interval);
      window.fetch = originalFetch;
    };
  }, [enabled]);

  // Keyboard shortcut to toggle visibility
  useEffect(() => {
    if (!enabled) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        setIsVisible(!isVisible);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [enabled, isVisible]);

  if (!enabled || (!showUI && !isVisible)) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs font-mono z-50 max-w-xs">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-green-400">Performance</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-white"
        >
          ×
        </button>
      </div>
      
      <div className="space-y-1">
        <div>
          <span className="text-blue-400">Load Time:</span> {metrics.loadTime.toFixed(0)}ms
        </div>
        
        <div>
          <span className="text-blue-400">Chunks:</span> {metrics.chunksLoaded}
        </div>
        
        {metrics.memoryUsage && (
          <>
            <div>
              <span className="text-blue-400">Memory Used:</span> {metrics.memoryUsage.used}
            </div>
            <div>
              <span className="text-blue-400">Memory Total:</span> {metrics.memoryUsage.total}
            </div>
          </>
        )}
      </div>
      
      <div className="mt-2 pt-2 border-t border-gray-600 text-gray-400">
        Press Ctrl+Shift+P to toggle
      </div>
    </div>
  );
}

// Hook for performance monitoring
export function usePerformanceMonitoring(enabled: boolean = false) {
  const [metrics, setMetrics] = useState({
    initialLoadTime: 0,
    chunksLoaded: 0,
    memoryUsage: null as any
  });

  useEffect(() => {
    if (!enabled) return;

    const startTime = performance.now();
    
    const updateMetrics = () => {
      const loadTime = performance.now() - startTime;
      
      let memoryUsage = null;
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        memoryUsage = {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit
        };
      }

      setMetrics(prev => ({
        ...prev,
        initialLoadTime: loadTime,
        memoryUsage
      }));
    };

    // Monitor on load
    if (document.readyState === 'complete') {
      updateMetrics();
    } else {
      window.addEventListener('load', updateMetrics);
    }

    return () => {
      window.removeEventListener('load', updateMetrics);
    };
  }, [enabled]);

  return metrics;
}

// Performance context for app-wide monitoring
export function logBundlePerformance() {
  if (typeof window === 'undefined') return;

  const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  
  console.group('[BUNDLE PERFORMANCE]');
  console.log('DOM Content Loaded:', `${navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart}ms`);
  console.log('Load Complete:', `${navigation.loadEventEnd - navigation.loadEventStart}ms`);
  console.log('Total Load Time:', `${navigation.loadEventEnd - navigation.navigationStart}ms`);
  
  // Log resource loading
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
  const jsResources = resources.filter(r => r.name.endsWith('.js'));
  const cssResources = resources.filter(r => r.name.endsWith('.css'));
  
  console.log('JavaScript files loaded:', jsResources.length);
  console.log('CSS files loaded:', cssResources.length);
  
  // Log largest JS files
  const largeJsFiles = jsResources
    .filter(r => r.transferSize > 100 * 1024) // > 100KB
    .sort((a, b) => b.transferSize - a.transferSize)
    .slice(0, 5);
    
  if (largeJsFiles.length > 0) {
    console.log('Largest JS files:');
    largeJsFiles.forEach(file => {
      const size = (file.transferSize / 1024).toFixed(2);
      const name = file.name.split('/').pop();
      console.log(`  ${name}: ${size}KB`);
    });
  }
  
  BundleMonitor.logMemoryUsage();
  console.groupEnd();
}

// Auto-run performance logging in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.addEventListener('load', () => {
    setTimeout(logBundlePerformance, 1000);
  });
}
