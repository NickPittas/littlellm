/**
 * Secure Local Fetch Utility
 * Provides secure communication with local AI providers through Electron's secure proxy
 */

interface SecureFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

interface SecureFetchResponse {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  json: () => Promise<any>;
  text: () => Promise<string>;
  body?: ReadableStream;
}

/**
 * Check if we're running in Electron environment
 */
function isElectronEnvironment(): boolean {
  return typeof window !== 'undefined' && 
         window.electronAPI && 
         typeof window.electronAPI.secureLocalRequest === 'function';
}

/**
 * Check if URL is a local provider URL that needs secure handling
 */
function isLocalProviderUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    const localHosts = ['localhost', '127.0.0.1', '0.0.0.0'];
    const localPorts = [11434, 1234, 8080, 1337]; // Ollama, LM Studio, llama.cpp, Jan AI
    
    return localHosts.includes(parsedUrl.hostname) && 
           localPorts.includes(parseInt(parsedUrl.port) || 80);
  } catch {
    return false;
  }
}

/**
 * Create a Response-like object from secure proxy response
 */
function createSecureResponse(proxyResponse: any): SecureFetchResponse {
  const response: SecureFetchResponse = {
    ok: proxyResponse.success && proxyResponse.status >= 200 && proxyResponse.status < 300,
    status: proxyResponse.status || (proxyResponse.success ? 200 : 500),
    statusText: proxyResponse.success ? 'OK' : 'Error',
    headers: proxyResponse.headers || {},
    
    json: async () => {
      if (typeof proxyResponse.data === 'object') {
        return proxyResponse.data;
      }
      try {
        return JSON.parse(proxyResponse.data);
      } catch {
        throw new Error('Response is not valid JSON');
      }
    },
    
    text: async () => {
      if (typeof proxyResponse.data === 'string') {
        return proxyResponse.data;
      }
      return JSON.stringify(proxyResponse.data);
    }
  };
  
  return response;
}

/**
 * Secure fetch function that routes local provider requests through Electron's secure proxy
 */
export async function secureLocalFetch(url: string, options: SecureFetchOptions = {}): Promise<SecureFetchResponse> {
  // If not in Electron or not a local provider URL, fall back to regular fetch
  if (!isElectronEnvironment() || !isLocalProviderUrl(url)) {
    console.log(`[SECURE_FETCH] Using regular fetch for: ${url}`);
    const response = await fetch(url, options);
    
    // Convert regular Response to our SecureFetchResponse interface
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      json: () => response.json(),
      text: () => response.text(),
      body: response.body || undefined
    };
  }
  
  console.log(`[SECURE_FETCH] Using secure proxy for local provider: ${url}`);
  
  try {
    // Use Electron's secure proxy for local provider requests
    const proxyResponse = await (window as any).electronAPI.secureLocalRequest({
      url,
      method: options.method || 'GET',
      headers: options.headers,
      body: options.body
    });
    
    if (!proxyResponse.success) {
      console.error(`[SECURE_FETCH] Proxy request failed:`, proxyResponse.error);
      throw new Error(proxyResponse.error || 'Secure proxy request failed');
    }
    
    return createSecureResponse(proxyResponse);
    
  } catch (error) {
    console.error(`[SECURE_FETCH] Error with secure proxy:`, error);
    
    // Create error response
    return {
      ok: false,
      status: 500,
      statusText: 'Secure Proxy Error',
      headers: {},
      json: async () => ({ error: 'Secure proxy request failed', details: error }),
      text: async () => `Secure proxy error: ${error}`
    };
  }
}

/**
 * Check if a local provider is available using the secure proxy
 */
export async function checkLocalProviderAvailability(providerName: string): Promise<boolean> {
  if (!isElectronEnvironment()) {
    console.log(`[SECURE_FETCH] Not in Electron environment, cannot check ${providerName}`);
    return false;
  }
  
  try {
    const isAvailable = await (window as any).electronAPI.checkLocalProviderHealth(providerName);
    console.log(`[SECURE_FETCH] Provider ${providerName} availability:`, isAvailable);
    return isAvailable;
  } catch (error) {
    console.error(`[SECURE_FETCH] Error checking ${providerName} availability:`, error);
    return false;
  }
}

/**
 * Get list of available local providers
 */
export async function getAvailableLocalProviders(): Promise<string[]> {
  if (!isElectronEnvironment()) {
    console.log(`[SECURE_FETCH] Not in Electron environment, cannot get providers`);
    return [];
  }
  
  try {
    const providers = await (window as any).electronAPI.getAvailableLocalProviders();
    console.log(`[SECURE_FETCH] Available local providers:`, providers);
    return providers;
  } catch (error) {
    console.error(`[SECURE_FETCH] Error getting available providers:`, error);
    return [];
  }
}

/**
 * Streaming fetch for local providers (for chat streaming)
 */
export async function secureLocalStreamingFetch(
  url: string, 
  options: SecureFetchOptions = {},
  onChunk?: (chunk: string) => void
): Promise<SecureFetchResponse> {
  // For streaming, we need to handle it differently
  // Since the secure proxy doesn't support streaming yet, we'll fall back to regular fetch
  // but only if we're in a secure context
  
  if (!isElectronEnvironment() || !isLocalProviderUrl(url)) {
    console.log(`[SECURE_FETCH] Using regular streaming fetch for: ${url}`);
    const response = await fetch(url, options);
    
    // Handle streaming if onChunk is provided
    if (onChunk && response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          onChunk(chunk);
        }
      } finally {
        reader.releaseLock();
      }
    }
    
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      json: () => response.json(),
      text: () => response.text(),
      body: response.body || undefined
    };
  }
  
  // For now, use the regular secure proxy for streaming
  // TODO: Implement streaming support in the secure proxy
  console.warn(`[SECURE_FETCH] Streaming not yet supported through secure proxy, using regular request`);
  return secureLocalFetch(url, options);
}

/**
 * Type definitions for window.electronAPI
 */
declare global {
  interface Window {
    electronAPI?: {
      // Secure local provider methods
      secureLocalRequest: (request: {
        url: string;
        method: string;
        headers?: Record<string, string>;
        body?: string;
      }) => Promise<{
        success: boolean;
        status?: number;
        data?: any;
        error?: string;
        headers?: Record<string, string>;
      }>;
      checkLocalProviderHealth: (providerName: string) => Promise<boolean>;
      getAvailableLocalProviders: () => Promise<string[]>;

      // Other existing electronAPI methods (for type safety)
      openActionMenu: () => Promise<void>;
      toggleConsoleWindow: () => void;
      syncMessagesToChat: (messages: any[]) => void;
      takeScreenshot: () => Promise<{ success: boolean; dataURL?: string; error?: string }>;
      openSettingsOverlay: () => Promise<void>;
      openChatWindow: () => Promise<void>;
      openHistory: (conversations: any[]) => Promise<void>;
      getSettings: () => Promise<any>;
      updateSettings: (settings: any) => Promise<void>;
      getAppSettings: () => Promise<any>;
      updateAppSettings: (settings: any) => Promise<void>;
      getSecureApiKeys: () => Promise<any>;
      setSecureApiKeys: (apiKeys: any) => Promise<void>;
      // Add more as needed...
      [key: string]: any; // Allow for additional methods
    };
  }
}
