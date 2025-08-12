/**
 * Secure Local Provider Proxy
 * Handles secure communication with local AI providers (Ollama, LM Studio, etc.)
 * while maintaining Electron security best practices
 */

import { net } from 'electron';
import { URL } from 'url';

// Allowed local provider configurations
const ALLOWED_LOCAL_PROVIDERS = {
  ollama: {
    host: 'localhost',
    port: 11434,
    protocol: 'http',
    paths: ['/api/tags', '/api/generate', '/api/chat', '/api/embeddings', '/api/pull', '/api/push']
  },
  lmstudio: {
    host: '127.0.0.1',
    port: 1234,
    protocol: 'http',
    paths: ['/v1/models', '/v1/chat/completions', '/v1/completions', '/v1/embeddings']
  },
  llamacpp: {
    host: 'localhost',
    port: 8080,
    protocol: 'http',
    paths: ['/v1/models', '/v1/chat/completions', '/v1/completions', '/v1/embeddings', '/health']
  },
  janai: {
    host: 'localhost',
    port: 1337,
    protocol: 'http',
    paths: ['/v1/models', '/v1/chat/completions', '/v1/completions']
  }
};

interface ProxyRequest {
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

interface ProxyResponse {
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
  headers?: Record<string, string>;
}

/**
 * Validate if a URL is allowed for local provider access
 */
function isAllowedLocalUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // Check each allowed provider
    for (const [providerName, config] of Object.entries(ALLOWED_LOCAL_PROVIDERS)) {
      const isValidHost = parsedUrl.hostname === config.host;
      const isValidPort = parsedUrl.port === config.port.toString() || 
                         (parsedUrl.port === '' && config.port === 80);
      const isValidProtocol = parsedUrl.protocol === `${config.protocol}:`;
      const isValidPath = config.paths.some(allowedPath => 
        parsedUrl.pathname.startsWith(allowedPath)
      );
      
      if (isValidHost && isValidPort && isValidProtocol && isValidPath) {
        console.log(`[SECURE_PROXY] Allowing ${providerName} request to ${url}`);
        return true;
      }
    }
    
    console.warn(`[SECURE_PROXY] Blocked unauthorized local request to ${url}`);
    return false;
  } catch (error) {
    console.error(`[SECURE_PROXY] Invalid URL format: ${url}`, error);
    return false;
  }
}

/**
 * Sanitize headers to prevent security issues
 */
function sanitizeHeaders(headers: Record<string, string> = {}): Record<string, string> {
  const sanitized: Record<string, string> = {};
  const allowedHeaders = [
    'content-type',
    'authorization',
    'accept',
    'user-agent',
    'x-api-key'
  ];
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (allowedHeaders.includes(lowerKey)) {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

/**
 * Make a secure request to a local provider
 */
export async function makeSecureLocalRequest(request: ProxyRequest): Promise<ProxyResponse> {
  try {
    // Validate the URL
    if (!isAllowedLocalUrl(request.url)) {
      return {
        success: false,
        error: 'Unauthorized local provider access'
      };
    }
    
    // Sanitize headers
    const sanitizedHeaders = sanitizeHeaders(request.headers);
    
    console.log(`[SECURE_PROXY] Making ${request.method} request to ${request.url}`);
    
    // Create the request using Electron's net module (more secure than fetch)
    const netRequest = net.request({
      method: request.method as any,
      url: request.url,
      headers: sanitizedHeaders
    });
    
    // Set up response handling
    return new Promise((resolve) => {
      let responseData = '';
      let responseHeaders: Record<string, string> = {};
      let statusCode = 0;
      
      netRequest.on('response', (response) => {
        statusCode = response.statusCode;
        responseHeaders = response.headers as Record<string, string>;
        
        response.on('data', (chunk) => {
          responseData += chunk.toString();
        });
        
        response.on('end', () => {
          try {
            // Try to parse JSON response
            let parsedData;
            try {
              parsedData = JSON.parse(responseData);
            } catch {
              parsedData = responseData;
            }
            
            resolve({
              success: statusCode >= 200 && statusCode < 300,
              status: statusCode,
              data: parsedData,
              headers: responseHeaders
            });
          } catch (error) {
            resolve({
              success: false,
              error: `Response parsing error: ${error}`
            });
          }
        });
      });
      
      netRequest.on('error', (error) => {
        console.error(`[SECURE_PROXY] Request error:`, error);
        resolve({
          success: false,
          error: `Network error: ${error.message}`
        });
      });
      
      // Send request body if provided
      if (request.body) {
        netRequest.write(request.body);
      }
      
      netRequest.end();
      
      // Set timeout
      setTimeout(() => {
        netRequest.abort();
        resolve({
          success: false,
          error: 'Request timeout'
        });
      }, 30000); // 30 second timeout
    });
    
  } catch (error) {
    console.error(`[SECURE_PROXY] Unexpected error:`, error);
    return {
      success: false,
      error: `Unexpected error: ${error}`
    };
  }
}

/**
 * Check if a local provider is available
 */
export async function checkLocalProviderHealth(providerName: keyof typeof ALLOWED_LOCAL_PROVIDERS): Promise<boolean> {
  const config = ALLOWED_LOCAL_PROVIDERS[providerName];
  if (!config) {
    return false;
  }
  
  const healthUrl = `${config.protocol}://${config.host}:${config.port}${config.paths[0]}`;
  
  try {
    const response = await makeSecureLocalRequest({
      url: healthUrl,
      method: 'GET'
    });
    
    return response.success;
  } catch {
    return false;
  }
}

/**
 * Get available local providers
 */
export async function getAvailableLocalProviders(): Promise<string[]> {
  const available: string[] = [];
  
  for (const providerName of Object.keys(ALLOWED_LOCAL_PROVIDERS)) {
    const isAvailable = await checkLocalProviderHealth(providerName as keyof typeof ALLOWED_LOCAL_PROVIDERS);
    if (isAvailable) {
      available.push(providerName);
    }
  }
  
  return available;
}

/**
 * Validate provider configuration
 */
export function validateProviderConfig(providerName: string, host: string, port: number): boolean {
  const config = ALLOWED_LOCAL_PROVIDERS[providerName as keyof typeof ALLOWED_LOCAL_PROVIDERS];
  if (!config) {
    return false;
  }
  
  return config.host === host && config.port === port;
}

/**
 * Security audit log for local provider access
 */
export function logSecurityEvent(event: string, details: any) {
  const timestamp = new Date().toISOString();
  console.log(`[SECURITY_AUDIT] ${timestamp} - ${event}:`, details);
  
  // In production, you might want to write this to a secure log file
  // or send to a security monitoring service
}
