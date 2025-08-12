/**
 * Lazy loading utilities for heavy services and components
 * This helps reduce initial bundle size by loading services only when needed
 */

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('../services/debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}

// Cache for loaded services to avoid re-importing
const serviceCache = new Map<string, any>();

/**
 * Lazy load the DocumentParserService
 */
export async function loadDocumentParserService() {
  if (serviceCache.has('DocumentParserService')) {
    return serviceCache.get('DocumentParserService');
  }

  try {
    safeDebugLog('info', 'LAZY_SERVICES', 'Loading DocumentParserService...');
    const module = await import('../services/DocumentParserService');
    const service = module.documentParserService;
    serviceCache.set('DocumentParserService', service);
    safeDebugLog('info', 'LAZY_SERVICES', 'DocumentParserService loaded successfully');
    return service;
  } catch (error) {
    safeDebugLog('error', 'LAZY_SERVICES', 'Failed to load DocumentParserService:', error);
    throw error;
  }
}

/**
 * Lazy load PDF processing utilities
 * Note: PDF processing is handled by Electron main process, not browser
 */
export async function loadPdfProcessor() {
  safeDebugLog('info', 'LAZY_SERVICES', 'PDF processing is handled by Electron main process');
  throw new Error('PDF processing is handled by Electron main process, not browser');
}

/**
 * Lazy load syntax highlighting
 */
export async function loadSyntaxHighlighter() {
  if (serviceCache.has('SyntaxHighlighter')) {
    return serviceCache.get('SyntaxHighlighter');
  }

  try {
    safeDebugLog('info', 'LAZY_SERVICES', 'Loading syntax highlighter...');
    // Use the lighter PrismLight instead of full Prism
    const syntaxModule = await import('react-syntax-highlighter');
    const SyntaxHighlighter = syntaxModule.PrismLight;
    
    // Load only essential languages
    const [
      javascript,
      typescript,
      python,
      json,
      css,
      html,
      markdown
    ] = await Promise.all([
      import('react-syntax-highlighter/dist/esm/languages/prism/javascript'),
      import('react-syntax-highlighter/dist/esm/languages/prism/typescript'),
      import('react-syntax-highlighter/dist/esm/languages/prism/python'),
      import('react-syntax-highlighter/dist/esm/languages/prism/json'),
      import('react-syntax-highlighter/dist/esm/languages/prism/css'),
      import('react-syntax-highlighter/dist/esm/languages/prism/markup'),
      import('react-syntax-highlighter/dist/esm/languages/prism/markdown')
    ]);

    // Register languages
    SyntaxHighlighter.registerLanguage('javascript', javascript.default);
    SyntaxHighlighter.registerLanguage('typescript', typescript.default);
    SyntaxHighlighter.registerLanguage('python', python.default);
    SyntaxHighlighter.registerLanguage('json', json.default);
    SyntaxHighlighter.registerLanguage('css', css.default);
    SyntaxHighlighter.registerLanguage('html', html.default);
    SyntaxHighlighter.registerLanguage('markdown', markdown.default);

    serviceCache.set('SyntaxHighlighter', SyntaxHighlighter);
    safeDebugLog('info', 'LAZY_SERVICES', 'Syntax highlighter loaded successfully');
    return SyntaxHighlighter;
  } catch (error) {
    safeDebugLog('error', 'LAZY_SERVICES', 'Failed to load syntax highlighter:', error);
    throw error;
  }
}

/**
 * Lazy load transformers for AI processing
 * Note: Transformers are not currently installed
 */
export async function loadTransformers() {
  safeDebugLog('info', 'LAZY_SERVICES', 'Transformers are not currently installed');
  throw new Error('Transformers are not currently installed');
}

/**
 * Lazy load Excel processing utilities
 */
export async function loadExcelProcessor() {
  if (serviceCache.has('ExcelProcessor')) {
    return serviceCache.get('ExcelProcessor');
  }

  try {
    safeDebugLog('info', 'LAZY_SERVICES', 'Loading Excel processor...');
    const xlsx = await import('xlsx');
    serviceCache.set('ExcelProcessor', xlsx);
    safeDebugLog('info', 'LAZY_SERVICES', 'Excel processor loaded successfully');
    return xlsx;
  } catch (error) {
    safeDebugLog('error', 'LAZY_SERVICES', 'Failed to load Excel processor:', error);
    throw error;
  }
}

/**
 * Lazy load Word document processing utilities
 */
export async function loadWordProcessor() {
  if (serviceCache.has('WordProcessor')) {
    return serviceCache.get('WordProcessor');
  }

  try {
    safeDebugLog('info', 'LAZY_SERVICES', 'Loading Word processor...');
    const mammoth = await import('mammoth');
    serviceCache.set('WordProcessor', mammoth);
    safeDebugLog('info', 'LAZY_SERVICES', 'Word processor loaded successfully');
    return mammoth;
  } catch (error) {
    safeDebugLog('error', 'LAZY_SERVICES', 'Failed to load Word processor:', error);
    throw error;
  }
}

/**
 * Preload critical services in the background
 */
export function preloadCriticalServices() {
  // Preload services that are likely to be used soon
  setTimeout(() => {
    loadDocumentParserService().catch(() => {
      // Ignore errors during preload
    });
  }, 2000);
}

/**
 * Clear service cache (useful for testing or memory management)
 */
export function clearServiceCache() {
  serviceCache.clear();
  safeDebugLog('info', 'LAZY_SERVICES', 'Service cache cleared');
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: serviceCache.size,
    services: Array.from(serviceCache.keys())
  };
}
