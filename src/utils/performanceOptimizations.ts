/**
 * Performance optimization utilities for bundle size reduction and lazy loading
 */

import { lazy, ComponentType, ReactElement } from 'react';

// Cache for dynamically loaded components
const componentCache = new Map<string, ComponentType<any>>();

/**
 * Enhanced lazy loading with error boundaries and loading states
 */
export function createLazyComponent<T = {}>(
  importFn: () => Promise<{ default: ComponentType<T> }>,
  fallback?: ReactElement,
  errorFallback?: ReactElement
) {
  return lazy(async () => {
    try {
      const module = await importFn();
      return module;
    } catch (error) {
      console.error('Failed to load component:', error);
      // Return a fallback component that shows the error
      return {
        default: () => errorFallback || <div>Failed to load component</div>
      };
    }
  });
}

/**
 * Preload a component without rendering it
 */
export function preloadComponent(importFn: () => Promise<{ default: ComponentType<any> }>) {
  // Start loading the component but don't wait for it
  importFn().catch(error => {
    console.warn('Failed to preload component:', error);
  });
}

/**
 * Lazy load heavy UI components
 */
export const LazyComponents = {
  // Main chat interface (very heavy - contains all chat functionality)
  ModernChatInterface: createLazyComponent(
    () => import('../components/modern-ui/ModernChatInterface').then(m => ({ default: m.ModernChatInterface })),
    <div className="h-full w-full flex items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading chat interface...</p>
      </div>
    </div>
  ),

  // Settings components (heavy due to form libraries and validation)
  SettingsOverlay: createLazyComponent(
    () => import('../components/SettingsOverlay'),
    <div className="animate-pulse bg-gray-800 rounded-lg h-96 w-full" />
  ),

  ApiKeySettings: createLazyComponent(
    () => import('../components/settings/ApiKeySettings'),
    <div className="animate-pulse bg-gray-700 rounded h-32 w-full" />
  ),

  KnowledgeBaseSettings: createLazyComponent(
    () => import('../components/settings/KnowledgeBaseSettings'),
    <div className="animate-pulse bg-gray-700 rounded h-48 w-full" />
  ),

  // Code block component (heavy due to syntax highlighting)
  CodeBlock: createLazyComponent(
    () => import('../components/CodeBlock'),
    <pre className="bg-gray-900 p-4 rounded overflow-x-auto">
      <code>Loading syntax highlighting...</code>
    </pre>
  ),

  // File upload components (heavy due to file processing)
  FileUpload: createLazyComponent(
    () => import('../components/FileUpload'),
    <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center">
      Loading file upload...
    </div>
  ),
};

/**
 * Lazy load heavy services with intelligent caching
 */
export const LazyServices = {
  // Document processing (very heavy - PDF, Word, Excel parsers)
  async loadDocumentProcessor() {
    const cacheKey = 'DocumentProcessor';
    if (componentCache.has(cacheKey)) {
      return componentCache.get(cacheKey);
    }
    
    const module = await import('../services/DocumentParserService');
    componentCache.set(cacheKey, module.documentParserService);
    return module.documentParserService;
  },
  
  // Transformers (extremely heavy - AI models)
  async loadTransformers() {
    const cacheKey = 'Transformers';
    if (componentCache.has(cacheKey)) {
      return componentCache.get(cacheKey);
    }
    
    // Only load if we're in a browser environment
    if (typeof window === 'undefined') {
      throw new Error('Transformers can only be loaded in browser environment');
    }
    
    const transformers = await import('@xenova/transformers');
    componentCache.set(cacheKey, transformers);
    return transformers;
  },
  
  // Syntax highlighting (heavy - multiple language parsers)
  async loadSyntaxHighlighter() {
    const cacheKey = 'SyntaxHighlighter';
    if (componentCache.has(cacheKey)) {
      return componentCache.get(cacheKey);
    }
    
    // Use the lighter PrismLight instead of full Prism
    const module = await import('react-syntax-highlighter');
    const highlighter = {
      PrismLight: module.PrismLight,
      // Only load common languages initially
      loadLanguage: async (language: string) => {
        try {
          const langModule = await import(`react-syntax-highlighter/dist/esm/languages/prism/${language}`);
          return langModule.default;
        } catch {
          console.warn(`Failed to load syntax highlighting for language: ${language}`);
          return null;
        }
      }
    };
    
    componentCache.set(cacheKey, highlighter);
    return highlighter;
  },
  
  // Chart libraries (heavy - visualization libraries)
  async loadChartLibrary() {
    const cacheKey = 'ChartLibrary';
    if (componentCache.has(cacheKey)) {
      return componentCache.get(cacheKey);
    }
    
    // Load a lightweight chart library only when needed
    const module = await import('recharts');
    componentCache.set(cacheKey, module);
    return module;
  }
};

/**
 * Intelligent preloading based on user interactions
 */
export class IntelligentPreloader {
  private static preloadedComponents = new Set<string>();
  
  /**
   * Preload components based on user hover or focus
   */
  static onUserIntent(componentName: keyof typeof LazyComponents) {
    if (this.preloadedComponents.has(componentName)) {
      return;
    }
    
    this.preloadedComponents.add(componentName);
    
    // Preload with a small delay to avoid unnecessary loads
    setTimeout(() => {
      switch (componentName) {
        case 'SettingsOverlay':
          preloadComponent(() => import('../components/SettingsOverlay'));
          break;
        case 'CodeBlock':
          preloadComponent(() => import('../components/CodeBlock'));
          break;
        case 'FileUpload':
          preloadComponent(() => import('../components/FileUpload'));
          break;
        // Add more cases as needed
      }
    }, 100);
  }
  
  /**
   * Preload based on route or context
   */
  static preloadForContext(context: 'chat' | 'settings' | 'files') {
    switch (context) {
      case 'chat':
        // Preload code highlighting for potential code blocks
        LazyServices.loadSyntaxHighlighter().catch(() => {});
        break;
      case 'settings':
        // Preload settings components
        this.onUserIntent('SettingsOverlay');
        this.onUserIntent('ApiKeySettings');
        break;
      case 'files':
        // Preload file processing
        this.onUserIntent('FileUpload');
        LazyServices.loadDocumentProcessor().catch(() => {});
        break;
    }
  }
}

/**
 * Bundle size monitoring utilities
 */
export const BundleMonitor = {
  /**
   * Log bundle loading performance
   */
  logComponentLoad(componentName: string, startTime: number) {
    const loadTime = performance.now() - startTime;
    console.log(`[PERFORMANCE] ${componentName} loaded in ${loadTime.toFixed(2)}ms`);
  },
  
  /**
   * Monitor memory usage
   */
  logMemoryUsage() {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      console.log('[MEMORY]', {
        used: `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        total: `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
        limit: `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`
      });
    }
  }
};

/**
 * Tree shaking helpers for icon libraries
 */
export const OptimizedIcons = {
  /**
   * Dynamically import only the icons we need
   */
  async loadIcon(iconName: string) {
    try {
      // Use dynamic imports for lucide-react icons
      const iconModule = await import(`lucide-react/dist/esm/icons/${iconName.toLowerCase()}`);
      return iconModule.default;
    } catch {
      // Fallback to a default icon
      const { HelpCircle } = await import('lucide-react');
      return HelpCircle;
    }
  }
};

/**
 * Resource hints for better loading performance
 */
export function addResourceHints() {
  if (typeof document === 'undefined') return;
  
  // Preload critical CSS
  const criticalCSS = document.createElement('link');
  criticalCSS.rel = 'preload';
  criticalCSS.as = 'style';
  criticalCSS.href = '/critical.css';
  document.head.appendChild(criticalCSS);
  
  // DNS prefetch for external resources
  const dnsPrefetch = document.createElement('link');
  dnsPrefetch.rel = 'dns-prefetch';
  dnsPrefetch.href = '//fonts.googleapis.com';
  document.head.appendChild(dnsPrefetch);
}

/**
 * Service worker registration for caching
 */
export function registerServiceWorker() {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('[SW] Service Worker registered:', registration);
        })
        .catch(error => {
          console.log('[SW] Service Worker registration failed:', error);
        });
    });
  }
}
