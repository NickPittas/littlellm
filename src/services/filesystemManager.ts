/**
 * Filesystem Manager for Internal Commands
 * Handles file operations with directory restrictions
 */

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { FileInfo } from '../types/internalCommands';

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('./debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}
// internalCommandService import removed - validation handled in main process

export class FilesystemManager {
  
  /**
   * Read file contents with optional offset and length
   */
  async readFile(filePath: string, isUrl = false, offset = 0, length?: number): Promise<{
    content: string;
    isImage: boolean;
    mimeType?: string;
  }> {
    if (isUrl) {
      return this.readFromUrl(filePath);
    }

    // Path validation will be handled in the main process

    try {
      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      // Check if it's an image file
      const isImage = this.isImageFile(filePath);
      if (isImage) {
        const buffer = await fs.readFile(filePath);
        return {
          content: buffer.toString('base64'),
          isImage: true,
          mimeType: this.getMimeType(filePath)
        };
      }

      // Read text file with offset/length support
      const content = await this.readTextFileWithOffset(filePath, offset, length);
      return {
        content,
        isImage: false
      };

    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Read multiple files simultaneously
   */
  async readMultipleFiles(filePaths: string[]): Promise<Array<{
    path: string;
    content?: string;
    error?: string;
    isImage?: boolean;
    mimeType?: string;
  }>> {
    const results = await Promise.allSettled(
      filePaths.map(async (filePath) => {
        try {
          const result = await this.readFile(filePath);
          return {
            path: filePath,
            content: result.content,
            isImage: result.isImage,
            mimeType: result.mimeType
          };
        } catch (error) {
          return {
            path: filePath,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      })
    );

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          path: filePaths[index],
          error: result.reason instanceof Error ? result.reason.message : String(result.reason)
        };
      }
    });
  }

  /**
   * Write file contents
   */
  async writeFile(filePath: string, content: string, mode: 'rewrite' | 'append' = 'rewrite'): Promise<void> {
    // Path validation will be handled in the main process

    try {
      if (mode === 'append') {
        await fs.appendFile(filePath, content);
      } else {
        await fs.writeFile(filePath, content, 'utf8');
      }
    } catch (error) {
      throw new Error(`Failed to write file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create directory
   */
  async createDirectory(dirPath: string): Promise<void> {
    // Path validation will be handled in the main process

    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(dirPath: string): Promise<string[]> {
    // Path validation will be handled in the main process

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries.map(entry => {
        const prefix = entry.isDirectory() ? '[DIR]' : '[FILE]';
        return `${prefix} ${entry.name}`;
      });
    } catch (error) {
      throw new Error(`Failed to list directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Move/rename file or directory
   */
  async moveFile(source: string, destination: string): Promise<void> {
    // Path validation will be handled in the main process

    try {
      await fs.rename(source, destination);
    } catch (error) {
      throw new Error(`Failed to move ${source} to ${destination}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Search for files by name pattern
   */
  async searchFiles(searchPath: string, pattern: string, timeoutMs?: number): Promise<string[]> {
    // Path validation will be handled in the main process

    const results: string[] = [];
    const searchPattern = pattern.toLowerCase();

    try {
      await this.searchFilesRecursive(searchPath, searchPattern, results, timeoutMs);
      return results;
    } catch (error) {
      throw new Error(`Failed to search files in ${searchPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get file information
   */
  async getFileInfo(filePath: string): Promise<FileInfo> {
    // Path validation will be handled in the main process

    try {
      const stats = await fs.stat(filePath);
      const info: FileInfo = {
        path: filePath,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        permissions: stats.mode.toString(8),
        type: stats.isDirectory() ? 'directory' : 'file'
      };

      // Add line count for text files
      if (stats.isFile() && !this.isImageFile(filePath)) {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const lines = content.split('\n');
          info.lineCount = lines.length;
          info.lastLine = lines.length - 1;
          info.appendPosition = lines.length;
        } catch {
          // Ignore errors for binary files
        }
      }

      return info;
    } catch (error) {
      throw new Error(`Failed to get file info for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Read text file with offset and length support
   */
  private async readTextFileWithOffset(filePath: string, offset: number, length?: number): Promise<string> {
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');

    if (offset < 0) {
      // Negative offset: read from end (tail behavior)
      const tailLines = Math.abs(offset);
      return lines.slice(-tailLines).join('\n');
    } else {
      // Positive offset: read from start with optional length
      const startLine = offset;
      const endLine = length ? startLine + length : lines.length;
      return lines.slice(startLine, endLine).join('\n');
    }
  }

  /**
   * Read from URL
   */
  private async readFromUrl(url: string): Promise<{
    content: string;
    isImage: boolean;
    mimeType?: string;
  }> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'LittleLLM/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      const isImage = contentType.startsWith('image/');

      if (isImage) {
        const buffer = await response.arrayBuffer();
        return {
          content: Buffer.from(buffer).toString('base64'),
          isImage: true,
          mimeType: contentType
        };
      } else {
        const content = await response.text();
        return {
          content,
          isImage: false,
          mimeType: contentType
        };
      }
    } catch (error) {
      throw new Error(`Failed to fetch URL ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if file is an image based on extension
   */
  private isImageFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(ext);
  }

  /**
   * Get MIME type based on file extension
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.bmp': 'image/bmp',
      '.svg': 'image/svg+xml'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Recursive file search helper
   */
  private async searchFilesRecursive(
    dirPath: string, 
    pattern: string, 
    results: string[], 
    timeoutMs?: number,
    startTime?: number
  ): Promise<void> {
    const currentTime = Date.now();
    if (!startTime) startTime = currentTime;
    
    if (timeoutMs && (currentTime - startTime) > timeoutMs) {
      return; // Timeout reached
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isFile() && entry.name.toLowerCase().includes(pattern)) {
          results.push(fullPath);
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          // Recursively search subdirectories
          await this.searchFilesRecursive(fullPath, pattern, results, timeoutMs, startTime);
        }
      }
    } catch (error) {
      // Ignore permission errors and continue
      safeDebugLog('warn', 'FILESYSTEMMANAGER', `Search warning for ${dirPath}:`, error);
    }
  }

  /**
   * Delete file or directory
   */
  async deleteFile(filePath: string, useRecycleBin = true): Promise<void> {
    // Path validation will be handled in the main process

    try {
      if (useRecycleBin) {
        // Use shell command to move to recycle bin on Windows
        if (process.platform === 'win32') {
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);

          // Use PowerShell to move file to recycle bin
          const escapedPath = filePath.replace(/'/g, "''");
          const command = `powershell -Command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${escapedPath}', 'OnlyErrorDialogs', 'SendToRecycleBin')"`;

          await execAsync(command);
        } else {
          // On macOS/Linux, move to trash using system commands
          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);

          if (process.platform === 'darwin') {
            // macOS: use osascript to move to trash
            const escapedPath = filePath.replace(/'/g, "\\'");
            await execAsync(`osascript -e 'tell application "Finder" to delete POSIX file "${escapedPath}"'`);
          } else {
            // Linux: use gio trash if available, otherwise move to ~/.local/share/Trash
            try {
              await execAsync(`gio trash "${filePath}"`);
            } catch {
              // Fallback: create .trash directory and move file there
              const trashDir = path.join(os.homedir(), '.local', 'share', 'Trash', 'files');
              await fs.mkdir(trashDir, { recursive: true });
              const fileName = path.basename(filePath);
              const trashPath = path.join(trashDir, fileName);
              await fs.rename(filePath, trashPath);
            }
          }
        }
      } else {
        // Permanent deletion
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
          await fs.rmdir(filePath, { recursive: true });
        } else {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      throw new Error(`Failed to delete ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Export singleton instance
export const filesystemManager = new FilesystemManager();
