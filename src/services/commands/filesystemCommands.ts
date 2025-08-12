/**
 * Filesystem Command Implementations
 * Implements DesktopCommanderMCP filesystem functionality as internal commands
 */

import {
  CommandResult,
  InternalCommandTool,
  ReadFileArgs,
  ReadMultipleFilesArgs,
  WriteFileArgs,
  CreateDirectoryArgs,
  ListDirectoryArgs,
  MoveFileArgs,
  SearchFilesArgs,
  SearchCodeArgs,
  GetFileInfoArgs,
  DeleteFileArgs
} from '../../types/internalCommands';
import { filesystemManager } from '../filesystemManager';
import { internalCommandService } from '../internalCommandService';
import { processManager } from '../processManager';
import { debugLogger } from '../debugLogger';

/**
 * Read file contents with optional offset and length
 */
async function readFile(args: unknown): Promise<CommandResult> {
  try {
    const { path, isUrl, offset, length } = args as ReadFileArgs;

    const result = await filesystemManager.readFile(path, isUrl, offset, length);

    if (result.isImage) {
      return {
        success: true,
        content: [
          {
            type: 'text',
            text: `Image file: ${path} (${result.mimeType})\n`
          },
          {
            type: 'image',
            data: result.content,
            mimeType: result.mimeType
          }
        ]
      };
    } else {
      return {
        success: true,
        content: [{
          type: 'text',
          text: result.content
        }]
      };
    }

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Read multiple files simultaneously
 */
async function readMultipleFiles(args: unknown): Promise<CommandResult> {
  try {
    const { paths } = args as ReadMultipleFilesArgs;

    const results = await filesystemManager.readMultipleFiles(paths);

    // Create summary
    const summary = results.map(result => {
      if (result.error) {
        return `${result.path}: Error - ${result.error}`;
      } else if (result.mimeType) {
        return `${result.path}: ${result.mimeType} ${result.isImage ? '(image)' : '(text)'}`;
      } else {
        return `${result.path}: Unknown type`;
      }
    }).join('\n');

    // Create content items
    const contentItems: Array<{type: 'text' | 'image', text?: string, data?: string, mimeType?: string}> = [];
    
    contentItems.push({ type: 'text', text: summary });

    // Add each file content
    for (const result of results) {
      if (!result.error && result.content !== undefined) {
        if (result.isImage && result.mimeType) {
          contentItems.push({
            type: 'image',
            data: result.content,
            mimeType: result.mimeType
          });
        } else {
          contentItems.push({
            type: 'text',
            text: `\n--- ${result.path} contents: ---\n${result.content}`
          });
        }
      }
    }

    return {
      success: true,
      content: contentItems
    };

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Write file contents
 */
async function writeFile(args: unknown): Promise<CommandResult> {
  try {
    const { path, content, mode } = args as WriteFileArgs;

    await filesystemManager.writeFile(path, content, mode);

    const lines = content.split('\n');
    const lineCount = lines.length;
    const modeMessage = mode === 'append' ? 'appended to' : 'wrote to';

    // Get line limit from configuration for performance tip
    const config = internalCommandService.getConfiguration();
    const maxLines = config.fileWriteLineLimit;

    let message = `Successfully ${modeMessage} ${path} (${lineCount} lines)`;
    
    if (lineCount > maxLines) {
      message += `\n💡 Performance tip: For optimal speed, consider chunking files into ≤${maxLines} line pieces in future operations.`;
    }

    return internalCommandService.createSuccessResponse(message);

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Create directory
 */
async function createDirectory(args: unknown): Promise<CommandResult> {
  try {
    const { path } = args as CreateDirectoryArgs;

    await filesystemManager.createDirectory(path);

    return internalCommandService.createSuccessResponse(
      `Successfully created directory ${path}`
    );

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * List directory contents
 */
async function listDirectory(args: unknown): Promise<CommandResult> {
  try {
    const { path } = args as ListDirectoryArgs;

    const entries = await filesystemManager.listDirectory(path);

    return {
      success: true,
      content: [{
        type: 'text',
        text: entries.join('\n')
      }]
    };

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Move or rename file/directory
 */
async function moveFile(args: unknown): Promise<CommandResult> {
  try {
    const { source, destination } = args as MoveFileArgs;

    await filesystemManager.moveFile(source, destination);

    return internalCommandService.createSuccessResponse(
      `Successfully moved ${source} to ${destination}`
    );

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Search for files by name pattern
 */
async function searchFiles(args: unknown): Promise<CommandResult> {
  try {
    const { path, pattern, timeoutMs } = args as SearchFilesArgs;

    const results = await filesystemManager.searchFiles(path, pattern, timeoutMs);

    if (results.length === 0) {
      const timeoutMsg = timeoutMs ? ` or search timed out after ${timeoutMs}ms` : '';
      return internalCommandService.createSuccessResponse(
        `No matches found${timeoutMsg}.`
      );
    }

    return {
      success: true,
      content: [{
        type: 'text',
        text: results.join('\n')
      }]
    };

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Search for code/text patterns within files
 */
async function searchCode(args: unknown): Promise<CommandResult> {
  try {
    const { 
      path, 
      pattern, 
      filePattern, 
      ignoreCase, 
      maxResults, 
      includeHidden, 
      contextLines, 
      timeoutMs 
    } = args as SearchCodeArgs;

    // Use ripgrep-like command for code search
    const command = process.platform === 'win32' ? 'findstr' : 'grep';
    // eslint-disable-next-line prefer-const
    let cmdArgs: string[] = [];

    if (process.platform === 'win32') {
      // Windows findstr
      if (ignoreCase) cmdArgs.push('/I');
      cmdArgs.push('/N', '/S');
      if (pattern) cmdArgs.push(`"${pattern}"`);
      cmdArgs.push(`"${path}\\*"`);
    } else {
      // Unix grep
      cmdArgs.push('-r', '-n');
      if (ignoreCase) cmdArgs.push('-i');
      if (contextLines) cmdArgs.push(`-C${contextLines}`);
      if (maxResults) cmdArgs.push(`-m${maxResults}`);
      if (includeHidden) cmdArgs.push('-a');
      if (filePattern) cmdArgs.push(`--include=${filePattern}`);
      cmdArgs.push(pattern, path);
    }

    const fullCommand = `${command} ${cmdArgs.join(' ')}`;
    const processInfo = await processManager.startProcess(fullCommand);
    const output = await processManager.readProcessOutput(processInfo.pid, timeoutMs || 30000);
    
    // Clean up the process
    await processManager.forceTerminate(processInfo.pid);

    if (!output || output.trim() === '') {
      const timeoutMsg = timeoutMs ? ` or search timed out after ${timeoutMs}ms` : '';
      return internalCommandService.createSuccessResponse(
        `No matches found${timeoutMsg}.`
      );
    }

    return {
      success: true,
      content: [{
        type: 'text',
        text: output
      }]
    };

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Get file information
 */
async function getFileInfo(args: unknown): Promise<CommandResult> {
  try {
    const { path } = args as GetFileInfoArgs;

    const info = await filesystemManager.getFileInfo(path);

    const infoText = Object.entries(info)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    return {
      success: true,
      content: [{
        type: 'text',
        text: infoText
      }]
    };

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Delete file or directory
 */
async function deleteFile(args: unknown): Promise<CommandResult> {
  try {
    const { path, useRecycleBin = true } = args as DeleteFileArgs;

    await filesystemManager.deleteFile(path, useRecycleBin);

    const deleteMethod = useRecycleBin ? 'moved to Recycle Bin' : 'permanently deleted';
    return internalCommandService.createSuccessResponse(
      `Successfully ${deleteMethod}: ${path}`
    );

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

// Export filesystem command tools
export const filesystemCommands: InternalCommandTool[] = [
  {
    name: 'read_file',
    description: `Read the contents of a file from the file system or a URL with optional offset and length parameters.

Supports partial file reading with:
- 'offset' (start line, default: 0)
  * Positive: Start from line N (0-based indexing)
  * Negative: Read last N lines from end (tail behavior)
- 'length' (max lines to read, default: configurable limit)

Examples:
- offset: 0, length: 10 → First 10 lines
- offset: 100, length: 5 → Lines 100-104
- offset: -20 → Last 20 lines

Can fetch content from URLs when isUrl parameter is set to true.
Handles text files normally and image files are returned as viewable images.

Parameters:
- path: File path or URL to read
- isUrl: Whether the path is a URL (optional)
- offset: Start line or negative for tail (optional)
- length: Maximum lines to read (optional)`,
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path or URL' },
        isUrl: { type: 'boolean', description: 'Whether path is a URL' },
        offset: { type: 'number', description: 'Start line or negative for tail' },
        length: { type: 'number', description: 'Maximum lines to read' }
      },
      required: ['path']
    },
    handler: readFile
  },
  {
    name: 'read_multiple_files',
    description: `Read the contents of multiple files simultaneously.

Each file's content is returned with its path as a reference.
Handles text files normally and renders images as viewable content.
Failed reads for individual files won't stop the entire operation.

Parameters:
- paths: Array of file paths to read`,
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        paths: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of file paths to read'
        }
      },
      required: ['paths']
    },
    handler: readMultipleFiles
  },
  {
    name: 'write_file',
    description: `Write or append to file contents.

CHUNKING IS STANDARD PRACTICE: Always write files in chunks of 25-30 lines maximum.

STANDARD PROCESS FOR ANY FILE:
1. FIRST → write_file(filePath, firstChunk, {mode: 'rewrite'}) [≤30 lines]
2. THEN → write_file(filePath, secondChunk, {mode: 'append'}) [≤30 lines]
3. CONTINUE → write_file(filePath, nextChunk, {mode: 'append'}) [≤30 lines]

Parameters:
- path: File path to write
- content: Content to write
- mode: 'rewrite' or 'append' (optional, default: 'rewrite')`,
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to write' },
        content: { type: 'string', description: 'Content to write' },
        mode: {
          type: 'string',
          enum: ['rewrite', 'append'],
          description: 'Write mode: rewrite or append'
        }
      },
      required: ['path', 'content']
    },
    handler: writeFile
  },
  {
    name: 'create_directory',
    description: `Create a new directory or ensure a directory exists.

Can create multiple nested directories in one operation.

Parameters:
- path: Directory path to create`,
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to create' }
      },
      required: ['path']
    },
    handler: createDirectory
  },
  {
    name: 'list_directory',
    description: `Get a detailed listing of all files and directories in a specified path.

Results distinguish between files and directories with [FILE] and [DIR] prefixes.

Parameters:
- path: Directory path to list`,
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to list' }
      },
      required: ['path']
    },
    handler: listDirectory
  },
  {
    name: 'move_file',
    description: `Move or rename files and directories.

Can move files between directories and rename them in a single operation.

Parameters:
- source: Source file/directory path
- destination: Destination file/directory path`,
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source path' },
        destination: { type: 'string', description: 'Destination path' }
      },
      required: ['source', 'destination']
    },
    handler: moveFile
  },
  {
    name: 'search_files',
    description: `Find files by name using case-insensitive substring matching.

Searches through all subdirectories from the starting path.
Has a default timeout of 30 seconds which can be customized.

Parameters:
- path: Starting directory path
- pattern: Search pattern (substring)
- timeoutMs: Timeout in milliseconds (optional)`,
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Starting directory path' },
        pattern: { type: 'string', description: 'Search pattern' },
        timeoutMs: { type: 'number', description: 'Timeout in milliseconds' }
      },
      required: ['path', 'pattern']
    },
    handler: searchFiles
  },
  {
    name: 'search_code',
    description: `Search for text/code patterns within file contents using grep/findstr.

Fast and powerful search similar to VS Code search functionality.
Supports regular expressions, file pattern filtering, and context lines.

Parameters:
- path: Directory to search in
- pattern: Text/regex pattern to search for
- filePattern: File pattern filter (optional)
- ignoreCase: Case-insensitive search (optional)
- maxResults: Maximum number of results (optional)
- includeHidden: Include hidden files (optional)
- contextLines: Lines of context around matches (optional)
- timeoutMs: Timeout in milliseconds (optional)`,
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory to search' },
        pattern: { type: 'string', description: 'Search pattern' },
        filePattern: { type: 'string', description: 'File pattern filter' },
        ignoreCase: { type: 'boolean', description: 'Case-insensitive search' },
        maxResults: { type: 'number', description: 'Maximum results' },
        includeHidden: { type: 'boolean', description: 'Include hidden files' },
        contextLines: { type: 'number', description: 'Context lines' },
        timeoutMs: { type: 'number', description: 'Timeout in milliseconds' }
      },
      required: ['path', 'pattern']
    },
    handler: searchCode
  },
  {
    name: 'get_file_info',
    description: `Retrieve detailed metadata about a file or directory.

Returns information including:
- size, creation time, last modified time
- permissions, type
- lineCount (for text files)
- lastLine (zero-indexed number of last line, for text files)
- appendPosition (line number for appending, for text files)

Parameters:
- path: File or directory path`,
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File or directory path' }
      },
      required: ['path']
    },
    handler: getFileInfo
  },
  {
    name: 'delete_file',
    description: `Delete a file or directory.

By default, files are moved to the Windows Recycle Bin for safety.
Can be configured to permanently delete files if needed.

Parameters:
- path: File or directory path to delete
- useRecycleBin: Whether to move to Recycle Bin (true) or permanently delete (false). Default: true`,
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File or directory path to delete' },
        useRecycleBin: { type: 'boolean', description: 'Move to Recycle Bin (true) or permanently delete (false)', default: true }
      },
      required: ['path']
    },
    handler: deleteFile
  }
];
