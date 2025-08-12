/**
 * Provider Error Utilities - Helper functions for standardized error handling
 * Makes it easy for providers to adopt consistent error handling patterns
 */

import { ErrorHandler, RetryHandler, ErrorContext, StandardizedError } from './ErrorHandler';

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('../debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}

export class ProviderErrorUtils {
  /**
   * Wrapper for fetch requests with standardized error handling
   */
  static async safeFetch(
    url: string,
    options: RequestInit,
    context: ErrorContext
  ): Promise<Response> {
    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const error = await ErrorHandler.handleHttpError(response, context);
        ErrorHandler.logError(error);
        throw new Error(error.userMessage);
      }
      
      return response;
    } catch (error) {
      if (error instanceof Error && error.message.includes('🔐') || error.message.includes('🚫')) {
        // Already a standardized error message
        throw error;
      }
      
      const standardizedError = ErrorHandler.standardizeError(error, context);
      ErrorHandler.logError(standardizedError);
      throw new Error(standardizedError.userMessage);
    }
  }

  /**
   * Wrapper for fetch requests with retry logic
   */
  static async fetchWithRetry(
    url: string,
    options: RequestInit,
    context: ErrorContext,
    retryConfig?: { maxAttempts?: number; baseDelay?: number }
  ): Promise<Response> {
    return RetryHandler.withRetry(
      () => this.safeFetch(url, options, context),
      context,
      retryConfig
    );
  }

  /**
   * Handle API key validation errors
   */
  static handleApiKeyError(provider: string, error: unknown): never {
    const context: ErrorContext = {
      provider,
      operation: 'API key validation'
    };
    
    const standardizedError = ErrorHandler.standardizeError(error, context);
    ErrorHandler.logError(standardizedError);
    
    // Enhance message for API key errors
    let message = standardizedError.userMessage;
    if (standardizedError.type === 'authentication') {
      message += ` Please verify your ${provider.toUpperCase()} API key in Settings.`;
    }
    
    throw new Error(message);
  }

  /**
   * Handle model fetching errors
   */
  static handleModelFetchError(provider: string, error: unknown, apiKey?: string): never {
    const context: ErrorContext = {
      provider,
      operation: 'fetch models',
      requestDetails: {
        hasApiKey: !!apiKey,
        apiKeyLength: apiKey?.length
      }
    };
    
    const standardizedError = ErrorHandler.standardizeError(error, context);
    ErrorHandler.logError(standardizedError);
    
    // Enhance message for model fetch errors
    let message = standardizedError.userMessage;
    if (standardizedError.type === 'authentication') {
      message = `🔐 Failed to fetch ${provider} models. Please check your API key in Settings.`;
    } else if (standardizedError.type === 'network') {
      message = `🌐 Failed to connect to ${provider}. Please check your internet connection and try again.`;
    }
    
    throw new Error(message);
  }

  /**
   * Handle streaming errors
   */
  static handleStreamingError(provider: string, error: unknown, requestDetails?: Record<string, unknown>): never {
    const context: ErrorContext = {
      provider,
      operation: 'streaming',
      requestDetails
    };
    
    const standardizedError = ErrorHandler.standardizeError(error, context);
    ErrorHandler.logError(standardizedError);
    
    throw new Error(standardizedError.userMessage);
  }

  /**
   * Handle tool execution errors
   */
  static handleToolError(provider: string, toolName: string, error: unknown): string {
    const context: ErrorContext = {
      provider,
      operation: `tool execution: ${toolName}`,
      requestDetails: { toolName }
    };
    
    const standardizedError = ErrorHandler.standardizeError(error, context);
    ErrorHandler.logError(standardizedError);
    
    // Return error message for tool results (don't throw)
    return `❌ ${toolName} failed: ${standardizedError.userMessage}`;
  }

  /**
   * Create a standardized error for provider-specific issues
   */
  static createProviderError(
    provider: string,
    operation: string,
    message: string,
    isRetryable = false
  ): StandardizedError {
    const context: ErrorContext = {
      provider,
      operation
    };
    
    return {
      type: 'unknown',
      message,
      userMessage: `❌ ${provider.toUpperCase()}: ${message}`,
      isRetryable,
      context
    };
  }

  /**
   * Validate and handle common provider configuration errors
   */
  static validateProviderConfig(
    provider: string,
    config: {
      apiKey?: string;
      baseUrl?: string;
      model?: string;
    }
  ): void {
    const errors: string[] = [];
    
    if (!config.apiKey && provider !== 'ollama' && provider !== 'lmstudio') {
      errors.push(`API key is required for ${provider}`);
    }
    
    if (!config.model) {
      errors.push('Model selection is required');
    }
    
    if (config.baseUrl && !this.isValidUrl(config.baseUrl)) {
      errors.push('Invalid base URL format');
    }
    
    if (errors.length > 0) {
      const context: ErrorContext = {
        provider,
        operation: 'configuration validation'
      };
      
      const error = ErrorHandler.standardizeError(
        `Configuration errors: ${errors.join(', ')}`,
        context
      );
      
      ErrorHandler.logError(error);
      throw new Error(error.userMessage);
    }
  }

  /**
   * Handle timeout errors specifically
   */
  static handleTimeout(provider: string, operation: string, timeoutMs: number): never {
    const context: ErrorContext = {
      provider,
      operation,
      requestDetails: { timeoutMs }
    };
    
    const error = ErrorHandler.standardizeError(
      `Operation timed out after ${timeoutMs}ms`,
      context
    );
    
    ErrorHandler.logError(error);
    throw new Error(error.userMessage);
  }

  /**
   * Create a user-friendly error message for rate limits
   */
  static createRateLimitMessage(provider: string, retryAfter?: number): string {
    const baseMessage = `⏱️ ${provider.toUpperCase()} rate limit exceeded.`;
    
    if (retryAfter) {
      const minutes = Math.ceil(retryAfter / 60);
      return `${baseMessage} Please wait ${minutes} minute${minutes > 1 ? 's' : ''} before trying again.`;
    }
    
    return `${baseMessage} Please wait a moment before trying again.`;
  }

  /**
   * Extract and format error details for debugging
   */
  static extractErrorDetails(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n').slice(0, 5) // First 5 lines of stack
      };
    }
    
    if (error && typeof error === 'object') {
      return { ...error as Record<string, unknown> };
    }
    
    return { error: String(error) };
  }

  /**
   * Check if a URL is valid
   */
  private static isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Create a context object for error handling
   */
  static createContext(
    provider: string,
    operation: string,
    requestDetails?: Record<string, unknown>
  ): ErrorContext {
    return {
      provider,
      operation,
      requestDetails
    };
  }

  /**
   * Log provider operation start for debugging
   */
  static logOperationStart(provider: string, operation: string, details?: Record<string, unknown>): void {
    safeDebugLog('info', `${provider.toUpperCase()}PROVIDER`, `🚀 Starting ${operation}`, details);
  }

  /**
   * Log provider operation success
   */
  static logOperationSuccess(provider: string, operation: string, details?: Record<string, unknown>): void {
    safeDebugLog('info', `${provider.toUpperCase()}PROVIDER`, `✅ ${operation} completed`, details);
  }
}
