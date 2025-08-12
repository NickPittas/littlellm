/**
 * useFileManagement Hook - Manages file attachments and uploads
 * Extracted from ModernChatInterface to reduce component complexity
 */

import { useState, useCallback } from 'react';

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

export interface UseFileManagementReturn {
  // State
  attachedFiles: File[];
  
  // Actions
  setAttachedFiles: (files: File[]) => void;
  addFiles: (files: File[]) => void;
  removeFile: (index: number) => void;
  clearFiles: () => void;
  
  // Operations
  handleFileUpload: (files: FileList) => Promise<void>;
  handleScreenshot: () => Promise<void>;
}

export function useFileManagement(): UseFileManagementReturn {
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const addFiles = useCallback((files: File[]) => {
    setAttachedFiles(prev => [...prev, ...files]);
    safeDebugLog('info', 'USEFILEMANAGEMENT', `Added ${files.length} files:`, files.map(f => f.name));
  }, []);

  const removeFile = useCallback((index: number) => {
    setAttachedFiles(prev => {
      const fileName = prev[index]?.name;
      const newFiles = prev.filter((_, i) => i !== index);
      safeDebugLog('info', 'USEFILEMANAGEMENT', `Removed file: ${fileName}`);
      return newFiles;
    });
  }, []);

  const clearFiles = useCallback(() => {
    const fileCount = attachedFiles.length;
    setAttachedFiles([]);
    if (fileCount > 0) {
      safeDebugLog('info', 'USEFILEMANAGEMENT', `Cleared ${fileCount} attached files`);
    }
  }, [attachedFiles.length]);

  const handleFileUpload = useCallback(async (files: FileList) => {
    safeDebugLog('info', 'USEFILEMANAGEMENT', 'Files uploaded:', Array.from(files).map(f => f.name));

    // Add files to attached files list - parsing will be handled by chatService
    const newFiles = Array.from(files);
    addFiles(newFiles);
  }, [addFiles]);

  const handleScreenshot = useCallback(async () => {
    try {
      safeDebugLog('info', 'USEFILEMANAGEMENT', '📸 Taking screenshot...');

      // Check if we're in Electron environment
      if (typeof window !== 'undefined' && window.electronAPI) {
        const electronAPI = window.electronAPI as {
          takeScreenshot?: () => Promise<{ success: boolean; data?: string; error?: string }>;
        };

        if (electronAPI.takeScreenshot) {
          const result = await electronAPI.takeScreenshot();
          
          if (result.success && result.data) {
            // Convert base64 to blob
            const base64Data = result.data.split(',')[1];
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            
            for (let i = 0; i < byteCharacters.length; i++) {
              byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });
            const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' });

            safeDebugLog('info', 'USEFILEMANAGEMENT', `📸 Screenshot file created: ${file.name} (${Math.round(file.size / 1024)}KB)`);

            // Auto-attach screenshot to chat
            addFiles([file]);
            safeDebugLog('info', 'USEFILEMANAGEMENT', '✅ Screenshot captured and attached to chat');

            // Show a brief success indicator
            if (typeof document !== 'undefined') {
              const successMsg = document.createElement('div');
              successMsg.textContent = '📸 Screenshot captured!';
              successMsg.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #10b981;
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-weight: 500;
                z-index: 10000;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                animation: slideIn 0.3s ease-out;
              `;
              
              document.body.appendChild(successMsg);
              
              setTimeout(() => {
                successMsg.style.animation = 'slideOut 0.3s ease-in forwards';
                setTimeout(() => {
                  if (document.body.contains(successMsg)) {
                    document.body.removeChild(successMsg);
                  }
                }, 300);
              }, 2000);
            }
          } else {
            throw new Error(result.error || 'Screenshot failed');
          }
        } else {
          throw new Error('Screenshot API not available');
        }
      } else {
        throw new Error('Screenshot feature is only available in the desktop app');
      }
    } catch (error) {
      safeDebugLog('error', 'USEFILEMANAGEMENT', '❌ Screenshot failed:', error);
      
      // Show error message
      if (typeof document !== 'undefined') {
        const errorMsg = document.createElement('div');
        errorMsg.textContent = '❌ Screenshot failed';
        errorMsg.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: #ef4444;
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-weight: 500;
          z-index: 10000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        document.body.appendChild(errorMsg);
        
        setTimeout(() => {
          if (document.body.contains(errorMsg)) {
            document.body.removeChild(errorMsg);
          }
        }, 3000);
      }
      
      throw error;
    }
  }, [addFiles]);

  return {
    // State
    attachedFiles,
    
    // Actions
    setAttachedFiles,
    addFiles,
    removeFile,
    clearFiles,
    
    // Operations
    handleFileUpload,
    handleScreenshot
  };
}
