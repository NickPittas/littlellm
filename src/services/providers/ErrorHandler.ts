/**
 * Standardized Error Handler for LLM Providers
 * Provides consistent error handling, categorization, and user-friendly messages
 */

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

export interface ErrorContext {
  provider: string;
  operation: string;
  statusCode?: number;
  requestDetails?: Record<string, unknown>;
  originalError?: unknown;
}

export interface StandardizedError {
  type: ErrorType;
  message: string;
  userMessage: string;
  isRetryable: boolean;
  retryAfter?: number;
  context: ErrorContext;
}

export enum ErrorType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  RATE_LIMIT = 'rate_limit',
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  VALIDATION = 'validation',
  SERVICE_UNAVAILABLE = 'service_unavailable',
  QUOTA_EXCEEDED = 'quota_exceeded',
  MODEL_NOT_FOUND = 'model_not_found',
  TOOL_ERROR = 'tool_error',
  PARSING_ERROR = 'parsing_error',
  UNKNOWN = 'unknown'
}

export class ErrorHandler {
  private static readonly ERROR_PATTERNS = [
    // Authentication errors
    {
      type: ErrorType.AUTHENTICATION,
      patterns: [/unauthorized/i, /invalid.*api.*key/i, /authentication.*failed/i, /401/],
      userMessage: '🔐 Authentication failed. Please check your API key in Settings.',
      isRetryable: false
    },
    
    // Authorization errors
    {
      type: ErrorType.AUTHORIZATION,
      patterns: [/forbidden/i, /access.*denied/i, /permission.*denied/i, /403/],
      userMessage: '🚫 Access denied. Please check your permissions or subscription.',
      isRetryable: false
    },
    
    // Rate limit errors
    {
      type: ErrorType.RATE_LIMIT,
      patterns: [/rate.*limit/i, /too.*many.*requests/i, /429/],
      userMessage: '⏱️ Rate limit exceeded. Please wait a moment before trying again.',
      isRetryable: true,
      retryAfter: 60
    },
    
    // Network errors
    {
      type: ErrorType.NETWORK,
      patterns: [/network/i, /connection/i, /econnrefused/i, /fetch.*failed/i, /socket/i],
      userMessage: '🌐 Network error. Please check your internet connection and try again.',
      isRetryable: true,
      retryAfter: 5
    },
    
    // Timeout errors
    {
      type: ErrorType.TIMEOUT,
      patterns: [/timeout/i, /timed.*out/i, /deadline.*exceeded/i],
      userMessage: '⏰ Request timed out. The service might be overloaded. Please try again.',
      isRetryable: true,
      retryAfter: 10
    },
    
    // Service unavailable
    {
      type: ErrorType.SERVICE_UNAVAILABLE,
      patterns: [/service.*unavailable/i, /502/, /503/, /504/, /server.*error/i, /internal.*error/i],
      userMessage: '🚫 Service temporarily unavailable. Please try again later.',
      isRetryable: true,
      retryAfter: 30
    },
    
    // Quota exceeded
    {
      type: ErrorType.QUOTA_EXCEEDED,
      patterns: [/quota.*exceeded/i, /insufficient.*credits/i, /billing/i],
      userMessage: '💳 Quota exceeded. Please check your billing or upgrade your plan.',
      isRetryable: false
    },
    
    // Model not found
    {
      type: ErrorType.MODEL_NOT_FOUND,
      patterns: [/model.*not.*found/i, /invalid.*model/i, /no.*model.*loaded/i],
      userMessage: '🤖 Model not available. Please select a different model.',
      isRetryable: false
    },
    
    // Tool errors
    {
      type: ErrorType.TOOL_ERROR,
      patterns: [/tool.*not.*found/i, /unknown.*tool/i, /tool.*failed/i],
      userMessage: '🔧 Tool execution failed. The tool might be temporarily unavailable.',
      isRetryable: true,
      retryAfter: 5
    },
    
    // Parsing errors
    {
      type: ErrorType.PARSING_ERROR,
      patterns: [/json/i, /parse/i, /syntax.*error/i, /unexpected.*token/i],
      userMessage: '📄 Data format error. This is likely a temporary service issue.',
      isRetryable: true,
      retryAfter: 5
    }
  ];

  /**
   * Standardize an error from any provider
   */
  static standardizeError(error: unknown, context: ErrorContext): StandardizedError {
    const errorMessage = this.extractErrorMessage(error);
    const statusCode = this.extractStatusCode(error, context);
    
    // Update context with extracted information
    const enrichedContext = {
      ...context,
      statusCode: statusCode || context.statusCode,
      originalError: error
    };

    // Categorize the error
    const errorType = this.categorizeError(errorMessage, statusCode);
    const pattern = this.ERROR_PATTERNS.find(p => p.type === errorType);
    
    if (pattern) {
      return {
        type: errorType,
        message: errorMessage,
        userMessage: this.enhanceUserMessage(pattern.userMessage, enrichedContext),
        isRetryable: pattern.isRetryable,
        retryAfter: pattern.retryAfter,
        context: enrichedContext
      };
    }

    // Fallback for unknown errors
    return {
      type: ErrorType.UNKNOWN,
      message: errorMessage,
      userMessage: `❌ An unexpected error occurred: ${errorMessage}. Please try again or contact support if the problem persists.`,
      isRetryable: true,
      retryAfter: 10,
      context: enrichedContext
    };
  }

  /**
   * Handle HTTP response errors
   */
  static async handleHttpError(
    response: Response,
    context: ErrorContext
  ): Promise<StandardizedError> {
    let errorText = '';
    try {
      errorText = await response.text();
    } catch {
      errorText = `HTTP ${response.status} ${response.statusText}`;
    }

    const enrichedContext = {
      ...context,
      statusCode: response.status,
      requestDetails: {
        ...context.requestDetails,
        url: response.url,
        status: response.status,
        statusText: response.statusText
      }
    };

    return this.standardizeError(errorText, enrichedContext);
  }

  /**
   * Create provider-specific error messages
   */
  static createProviderError(
    provider: string,
    operation: string,
    error: unknown,
    requestDetails?: Record<string, unknown>
  ): StandardizedError {
    const context: ErrorContext = {
      provider,
      operation,
      requestDetails,
      originalError: error
    };

    return this.standardizeError(error, context);
  }

  /**
   * Log error with appropriate level
   */
  static logError(error: StandardizedError): void {
    const logLevel = error.isRetryable ? 'warn' : 'error';
    const prefix = `${error.context.provider.toUpperCase()}PROVIDER`;
    
    safeDebugLog(logLevel, prefix, `❌ ${error.context.operation} failed:`, {
      type: error.type,
      message: error.message,
      statusCode: error.context.statusCode,
      isRetryable: error.isRetryable,
      retryAfter: error.retryAfter
    });

    // Log request details for debugging
    if (error.context.requestDetails) {
      safeDebugLog('info', prefix, '🔍 Request details:', error.context.requestDetails);
    }
  }

  /**
   * Extract error message from various error formats
   */
  private static extractErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    if (error && typeof error === 'object') {
      // Try common error object patterns
      const errorObj = error as Record<string, unknown>;
      
      if (errorObj.message) {
        return String(errorObj.message);
      }
      
      if (errorObj.error) {
        if (typeof errorObj.error === 'string') {
          return errorObj.error;
        }
        if (errorObj.error && typeof errorObj.error === 'object') {
          const nestedError = errorObj.error as Record<string, unknown>;
          if (nestedError.message) {
            return String(nestedError.message);
          }
        }
      }

      // Try to parse as JSON string
      try {
        const parsed = JSON.parse(String(error));
        if (parsed.message) {
          return parsed.message;
        }
        if (parsed.error) {
          return typeof parsed.error === 'string' ? parsed.error : parsed.error.message || String(parsed.error);
        }
      } catch {
        // Not JSON, continue
      }
    }

    return String(error);
  }

  /**
   * Extract status code from error or context
   */
  private static extractStatusCode(error: unknown, context: ErrorContext): number | undefined {
    if (context.statusCode) {
      return context.statusCode;
    }

    const errorMessage = this.extractErrorMessage(error);
    
    // Try to extract status code from error message
    const statusMatch = errorMessage.match(/\b(4\d{2}|5\d{2})\b/);
    if (statusMatch) {
      return parseInt(statusMatch[1], 10);
    }

    return undefined;
  }

  /**
   * Categorize error based on message and status code
   */
  private static categorizeError(message: string, statusCode?: number): ErrorType {
    const lowerMessage = message.toLowerCase();

    // Check status code first
    if (statusCode) {
      if (statusCode === 401) return ErrorType.AUTHENTICATION;
      if (statusCode === 403) return ErrorType.AUTHORIZATION;
      if (statusCode === 429) return ErrorType.RATE_LIMIT;
      if (statusCode >= 500) return ErrorType.SERVICE_UNAVAILABLE;
    }

    // Check message patterns
    for (const pattern of this.ERROR_PATTERNS) {
      if (pattern.patterns.some(p => p.test(lowerMessage))) {
        return pattern.type;
      }
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Enhance user message with context-specific information
   */
  private static enhanceUserMessage(baseMessage: string, context: ErrorContext): string {
    let enhanced = baseMessage;

    // Add provider-specific guidance
    if (context.provider === 'ollama' && context.statusCode === 404) {
      enhanced += ' Make sure Ollama is running and accessible.';
    } else if (context.provider === 'lmstudio' && context.statusCode === 404) {
      enhanced += ' Make sure LM Studio server is started (Developer tab → Start Server).';
    } else if (context.provider === 'openai' && enhanced.includes('authentication')) {
      enhanced += ' You can get an API key from https://platform.openai.com/api-keys';
    }

    // Add retry information
    if (context.statusCode && context.statusCode >= 500) {
      enhanced += ' This appears to be a server-side issue that should resolve automatically.';
    }

    return enhanced;
  }
}

/**
 * Retry mechanism for handling transient errors
 */
export class RetryHandler {
  private static readonly DEFAULT_CONFIG = {
    maxAttempts: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    backoffMultiplier: 2
  };

  /**
   * Execute a function with retry logic
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    context: ErrorContext,
    config: Partial<typeof RetryHandler.DEFAULT_CONFIG> = {}
  ): Promise<T> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config };
    let lastError: StandardizedError | null = null;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = ErrorHandler.standardizeError(error, {
          ...context,
          operation: `${context.operation} (attempt ${attempt}/${finalConfig.maxAttempts})`
        });

        ErrorHandler.logError(lastError);

        // Don't retry if error is not retryable or this is the last attempt
        if (!lastError.isRetryable || attempt === finalConfig.maxAttempts) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          finalConfig.baseDelay * Math.pow(finalConfig.backoffMultiplier, attempt - 1),
          finalConfig.maxDelay
        );

        // Use error-specific retry delay if available
        const retryDelay = lastError.retryAfter ? lastError.retryAfter * 1000 : delay;

        safeDebugLog('info', `${context.provider.toUpperCase()}PROVIDER`,
          `🔄 Retrying ${context.operation} in ${retryDelay}ms (attempt ${attempt + 1}/${finalConfig.maxAttempts})`);

        await this.sleep(retryDelay);
      }
    }

    // If we get here, all retries failed
    throw new Error(lastError?.userMessage || 'Operation failed after all retry attempts');
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
