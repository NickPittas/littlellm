/**
 * Type definitions for the internal command system
 * Based on DesktopCommanderMCP functionality
 */

// Base interfaces for command execution
export interface CommandResult {
  success: boolean;
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  error?: string;
}

export interface ProcessInfo {
  pid: number;
  command: string;
  status: 'running' | 'finished' | 'error';
  startTime: Date;
  blocked: boolean;
  runtime: number;
}

export interface FileInfo {
  path: string;
  size: number;
  created: Date;
  modified: Date;
  permissions: string;
  type: 'file' | 'directory';
  lineCount?: number;
  lastLine?: number;
  appendPosition?: number;
}

// Command argument schemas (based on DesktopCommanderMCP)
export interface StartProcessArgs {
  command: string;
  timeout_ms: number;
  shell?: string;
}

export interface ReadProcessOutputArgs {
  pid: number;
  timeout_ms?: number;
}

export interface InteractWithProcessArgs {
  pid: number;
  input: string;
  timeout_ms?: number;
  wait_for_prompt?: boolean;
}

export interface ForceTerminateArgs {
  pid: number;
}

export interface KillProcessArgs {
  pid: number;
}

export interface ReadFileArgs {
  path: string;
  isUrl?: boolean;
  offset?: number;
  length?: number;
}

export interface ReadMultipleFilesArgs {
  paths: string[];
}

export interface WriteFileArgs {
  path: string;
  content: string;
  mode?: 'rewrite' | 'append';
}

export interface CreateDirectoryArgs {
  path: string;
}

export interface ListDirectoryArgs {
  path: string;
}

export interface MoveFileArgs {
  source: string;
  destination: string;
}

export interface SearchFilesArgs {
  path: string;
  pattern: string;
  timeoutMs?: number;
}

export interface SearchCodeArgs {
  path: string;
  pattern: string;
  filePattern?: string;
  ignoreCase?: boolean;
  maxResults?: number;
  includeHidden?: boolean;
  contextLines?: number;
  timeoutMs?: number;
}

export interface GetFileInfoArgs {
  path: string;
}

export interface DeleteFileArgs {
  path: string;
  useRecycleBin?: boolean; // true = move to recycle bin, false = permanent delete
}

export interface EditBlockArgs {
  file_path: string;
  old_string: string;
  new_string: string;
  expected_replacements?: number;
}

// Internal command tool definition
export interface InternalCommandTool {
  name: string;
  description: string;
  category: 'terminal' | 'filesystem' | 'textEditing' | 'system';
  inputSchema: Record<string, unknown>;
  handler: (args: unknown) => Promise<CommandResult>;
}

// Security validation interface
export interface SecurityContext {
  allowedDirectories: string[];
  blockedCommands: string[];
  enabledCategories: string[];
}

// Process management
export interface ProcessSession {
  pid: number;
  command: string;
  shell: string;
  startTime: Date;
  lastActivity: Date;
  status: 'running' | 'finished' | 'error';
  blocked: boolean;
  process?: unknown; // Node.js ChildProcess (avoiding Node.js imports in browser)
}

// Configuration interface
export interface InternalCommandConfig {
  enabled: boolean;
  allowedDirectories: string[];
  blockedCommands: string[];
  fileReadLineLimit: number;
  fileWriteLineLimit: number;
  defaultShell: string;
  enabledCommands: {
    terminal: boolean;
    filesystem: boolean;
    textEditing: boolean;
    system: boolean;
  };
  terminalSettings: {
    defaultTimeout: number;
    maxProcesses: number;
    allowInteractiveShells: boolean;
  };
}

// Error types
export class CommandSecurityError extends Error {
  constructor(message: string, public path?: string, public command?: string) {
    super(message);
    this.name = 'CommandSecurityError';
  }
}

export class CommandExecutionError extends Error {
  constructor(message: string, public code?: string | number) {
    super(message);
    this.name = 'CommandExecutionError';
  }
}

export class CommandTimeoutError extends Error {
  constructor(message: string, public timeoutMs: number) {
    super(message);
    this.name = 'CommandTimeoutError';
  }
}
