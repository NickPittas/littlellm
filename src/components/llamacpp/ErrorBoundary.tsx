'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, ExternalLink } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: string;
}

export class LlamaCppErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('🚨 Llama.cpp Error Boundary caught an error:', error, errorInfo);
    this.setState({
      errorInfo: errorInfo.componentStack
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex items-center justify-center min-h-[400px] p-6">
          <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400 mt-1 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-red-300 mb-2">
                  Llama.cpp Error
                </h3>
                <p className="text-red-200/80 text-sm mb-4">
                  Something went wrong with the Llama.cpp integration. This might be due to:
                </p>
                <ul className="text-red-200/70 text-xs space-y-1 mb-4 list-disc list-inside">
                  <li>Missing or corrupted model files</li>
                  <li>Insufficient system resources</li>
                  <li>Network connectivity issues</li>
                  <li>Configuration problems</li>
                </ul>
                
                {this.state.error && (
                  <details className="mb-4">
                    <summary className="text-red-300 text-sm cursor-pointer hover:text-red-200">
                      Technical Details
                    </summary>
                    <div className="mt-2 p-2 bg-red-950/50 rounded text-xs text-red-200/60 font-mono">
                      <div className="mb-2">
                        <strong>Error:</strong> {this.state.error.message}
                      </div>
                      {this.state.errorInfo && (
                        <div>
                          <strong>Stack:</strong>
                          <pre className="whitespace-pre-wrap text-xs mt-1">
                            {this.state.errorInfo}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={this.handleRetry}
                    className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Retry
                  </button>
                  <button
                    onClick={() => window.open('https://github.com/ggml-org/llama.cpp/discussions', '_blank')}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Get Help
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for handling async errors
export function useLlamaCppErrorHandler() {
  const handleError = (error: Error, context: string) => {
    console.error(`🚨 Llama.cpp Error in ${context}:`, error);
    
    // You could integrate with error reporting service here
    // Example: Sentry.captureException(error, { tags: { context: `llamacpp-${context}` } });
    
    return {
      message: getErrorMessage(error),
      isRetryable: isRetryableError(error),
      suggestions: getErrorSuggestions(error)
    };
  };

  return { handleError };
}

function getErrorMessage(error: Error): string {
  const message = error.message.toLowerCase();
  
  if (message.includes('network') || message.includes('fetch')) {
    return 'Network connection failed. Please check your internet connection.';
  }
  
  if (message.includes('permission') || message.includes('access')) {
    return 'Permission denied. Please check file permissions or run as administrator.';
  }
  
  if (message.includes('memory') || message.includes('ram')) {
    return 'Insufficient memory. Try using a smaller model or closing other applications.';
  }
  
  if (message.includes('model') || message.includes('gguf')) {
    return 'Model file error. Please verify the model file is valid and not corrupted.';
  }
  
  if (message.includes('port') || message.includes('address')) {
    return 'Port conflict. Another application may be using port 8080.';
  }
  
  return error.message || 'An unexpected error occurred.';
}

function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Network errors are usually retryable
  if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
    return true;
  }
  
  // Temporary resource issues
  if (message.includes('busy') || message.includes('locked')) {
    return true;
  }
  
  // Permission and file corruption errors are usually not retryable
  if (message.includes('permission') || message.includes('corrupted') || message.includes('invalid')) {
    return false;
  }
  
  return true;
}

function getErrorSuggestions(error: Error): string[] {
  const message = error.message.toLowerCase();
  const suggestions: string[] = [];
  
  if (message.includes('network') || message.includes('download')) {
    suggestions.push('Check your internet connection');
    suggestions.push('Try downloading the model manually from Hugging Face');
    suggestions.push('Verify firewall settings');
  }
  
  if (message.includes('memory') || message.includes('ram')) {
    suggestions.push('Close other applications to free up memory');
    suggestions.push('Try a smaller model (0.5B or 1B parameters)');
    suggestions.push('Use Q4_K_M quantization instead of higher precision');
  }
  
  if (message.includes('model') || message.includes('gguf')) {
    suggestions.push('Re-download the model file');
    suggestions.push('Verify the model file is not corrupted');
    suggestions.push('Check that the file has .gguf extension');
  }
  
  if (message.includes('port') || message.includes('address')) {
    suggestions.push('Close other applications using port 8080');
    suggestions.push('Restart LittleLLM');
    suggestions.push('Check if another llama-server is running');
  }
  
  if (suggestions.length === 0) {
    suggestions.push('Restart LittleLLM');
    suggestions.push('Check the console for more details');
    suggestions.push('Visit the documentation for troubleshooting');
  }
  
  return suggestions;
}
