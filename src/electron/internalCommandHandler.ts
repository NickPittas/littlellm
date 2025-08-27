/* eslint-disable no-console */
/**
 * Electron Main Process Internal Command Handler
 * Handles internal commands in the main process where Node.js APIs are available
 */

import { spawn, ChildProcess, exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import {
  CommandResult,
  InternalCommandConfig,
  FileInfo
} from '../types/internalCommands';

// Electron-specific ProcessSession with proper ChildProcess type
interface ElectronProcessSession {
  pid: number;
  command: string;
  shell: string;
  startTime: Date;
  lastActivity: Date;
  status: 'running' | 'finished' | 'error';
  blocked: boolean;
  process?: ChildProcess; // Proper Node.js ChildProcess type
}

export class ElectronInternalCommandHandler {
  private config: InternalCommandConfig | null = null;
  private commandHistory: Array<{ timestamp: number; command: string; success: boolean }> = [];
  private readonly MAX_COMMANDS_PER_MINUTE = 60;
  private readonly MAX_HISTORY_SIZE = 1000;
  private sessions: Map<number, ElectronProcessSession> = new Map();
  private nextPid = 1000;

  constructor() {
    this.setupIpcHandlers();
  }

  /**
   * Set up IPC handlers for internal commands
   * Note: IPC handlers are now registered in main.ts setupIPC() to avoid duplicates
   */
  private setupIpcHandlers(): void {
    // IPC handlers moved to main.ts setupIPC() function to prevent duplicate registration
    console.log('🔧 Internal command handler initialized (IPC handlers in main.ts)');
  }

  /**
   * Public methods for main process integration
   */
  public async setConfig(config: InternalCommandConfig): Promise<boolean> {
    console.log(`🔧 ElectronInternalCommandHandler.setConfig() called with enabled: ${config.enabled}`);
    this.config = config;
    console.log(`🔧 Config updated - enabled: ${this.config?.enabled}, has enabledCommands: ${!!this.config?.enabledCommands}`);
    return true;
  }

  public async getTools(): Promise<Array<{name: string; description: string; category: string; inputSchema: unknown}>> {
    const tools = this.getAvailableTools();
    console.log(`🔧 InternalCommandHandler.getTools() called - returning ${tools.length} tools`);
    console.log(`🔧 Config enabled: ${this.config?.enabled}, has config: ${!!this.config}`);
    if (tools.length > 0) {
      console.log(`🔧 Sample tools:`, tools.slice(0, 3).map(t => ({ name: t.name, category: t.category })));
    }
    return tools;
  }

  public async execute(toolName: string, args: unknown): Promise<CommandResult> {
    return this.executeCommand(toolName, args);
  }

  public async isEnabled(): Promise<boolean> {
    return this.config?.enabled || false;
  }

  /**
   * Execute an internal command
   */
  private async executeCommand(toolName: string, args: unknown): Promise<CommandResult> {
    let success = false;

    try {
      // Check if service is enabled
      if (!this.config?.enabled) {
        throw new Error('Internal commands are disabled');
      }

      // Check rate limiting
      this.checkRateLimit();

      // Import and execute the appropriate command
      const result = await this.executeSpecificCommand(toolName, args);
      success = result.success;
      
      return result;

    } catch (error) {
      console.error(`❌ Internal command failed: ${toolName}`, error);
      
      return {
        success: false,
        content: [{
          type: 'text',
          text: `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`
        }],
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      // Record command execution for rate limiting and monitoring
      this.recordCommandExecution(toolName, success);
    }
  }

  /**
   * Execute specific command based on tool name
   */
  private async executeSpecificCommand(toolName: string, args: unknown): Promise<CommandResult> {
    console.log(`🔧 Executing internal command: ${toolName}`, args);

    // Terminal commands
    if (toolName === 'start_process') {
      return this.startProcess(args as { command: string; timeout_ms: number; shell?: string });
    } else if (toolName === 'read_process_output') {
      return this.readProcessOutput(args as { pid: number });
    } else if (toolName === 'interact_with_process') {
      return this.interactWithProcess(args as { pid: number; input: string });
    } else if (toolName === 'force_terminate') {
      return this.forceTerminate(args as { pid: number });
    } else if (toolName === 'list_sessions') {
      return this.listSessions();
    } else if (toolName === 'kill_process') {
      return this.killProcess(args as { pid: number });
    } else if (toolName === 'list_processes') {
      return this.listProcesses();
    } else if (toolName === 'get_cpu_usage') {
      return this.getCpuUsage();
    } else if (toolName === 'get_memory_usage') {
      return this.getMemoryUsage();
    } else if (toolName === 'get_system_info') {
      return this.getSystemInfo();
    }

    // Filesystem commands
    else if (toolName === 'read_file') {
      return this.readFile(args as { path: string; isUrl?: boolean; offset?: number; length?: number });
    } else if (toolName === 'write_file') {
      return this.writeFile(args as { path: string; content: string; append?: boolean });
    } else if (toolName === 'create_directory') {
      return this.createDirectory(args as { path: string });
    } else if (toolName === 'list_directory') {
      return this.listDirectory(args as { path: string });
    } else if (toolName === 'move_file') {
      return this.moveFile(args as { source: string; destination: string });
    } else if (toolName === 'search_files') {
      return this.searchFiles(args as { path: string; pattern: string; recursive?: boolean });
    } else if (toolName === 'get_file_info') {
      return this.getFileInfo(args as { path: string });
    } else if (toolName === 'delete_file') {
      return this.deleteFile(args as { path: string });
    }

    // Text editing commands
    else if (toolName === 'edit_block') {
      return this.editBlock(args as { file_path: string; old_string: string; new_string: string; expected_replacements?: number });
    }

    else {
      throw new Error(`Unknown internal command: ${toolName}`);
    }
  }

  /**
   * Validate file path against allowed directories
   */
  private validateFilePath(filePath: string): void {
    if (!this.config) {
      console.error('🚨 validateFilePath: Configuration not initialized');
      throw new Error('Configuration not initialized');
    }

    const allowedDirs = this.config.allowedDirectories;
    console.log(`🔧 validateFilePath: Checking path "${filePath}" against allowed directories:`, allowedDirs);

    // If no allowed directories configured, deny all access
    if (allowedDirs.length === 0) {
      console.error('🚨 validateFilePath: No allowed directories configured - blocking all file operations');
      throw new Error('No allowed directories configured. Please configure allowed directories in settings.');
    }

    // Resolve the absolute path
    const absolutePath = path.resolve(filePath);
    console.log(`🔧 validateFilePath: Resolved absolute path: "${absolutePath}"`);

    // Check if path is within any allowed directory
    const isAllowed = allowedDirs.some(allowedDir => {
      const absoluteAllowedDir = path.resolve(allowedDir);

      // Normalize paths for Windows compatibility (case-insensitive, consistent separators)
      const normalizedPath = absolutePath.toLowerCase().replace(/\\/g, '/');
      const normalizedAllowedDir = absoluteAllowedDir.toLowerCase().replace(/\\/g, '/');

      // Check if paths are exactly equal (for accessing the directory itself)
      if (normalizedPath === normalizedAllowedDir) {
        console.log(`🔧 validateFilePath: Exact match "${absolutePath}" === "${absoluteAllowedDir}" -> true`);
        return true;
      }

      // Check if path is within the allowed directory (subdirectory access)
      const allowedDirWithSlash = normalizedAllowedDir.endsWith('/') ? normalizedAllowedDir : normalizedAllowedDir + '/';
      const isWithinDir = normalizedPath.startsWith(allowedDirWithSlash);

      console.log(`🔧 validateFilePath: Checking "${normalizedPath}" against "${allowedDirWithSlash}" -> ${isWithinDir}`);
      return isWithinDir;
    });

    if (!isAllowed) {
      console.error(`🚨 validateFilePath: Access denied for path "${filePath}" (resolved: "${absolutePath}")`);
      console.error(`🚨 validateFilePath: Allowed directories:`, allowedDirs.map(dir => path.resolve(dir)));

      throw new Error(`Access denied: Path '${filePath}' is not within allowed directories`);
    }

    console.log(`✅ validateFilePath: Path "${filePath}" is allowed`);
  }

  /**
   * Validate command against blocked commands
   */
  private validateCommand(command: string): void {
    if (!this.config) {
      throw new Error('Configuration not initialized');
    }

    const blockedCommands = this.config.blockedCommands;

    // Check if command contains any blocked patterns
    const isBlocked = blockedCommands.some(blockedCmd =>
      command.toLowerCase().includes(blockedCmd.toLowerCase())
    );

    if (isBlocked) {
      throw new Error(`Command blocked for security: '${command}'`);
    }
  }

  // ===== TERMINAL COMMANDS =====

  /**
   * Start a new process
   */
  private async startProcess(args: { command: string; timeout_ms: number; shell?: string }): Promise<CommandResult> {
    try {
      this.validateCommand(args.command);

      const pid = this.nextPid++;
      const startTime = new Date();

      // Determine shell to use
      const useShell = args.shell || this.getDefaultShell();

      // Parse command and arguments
      const { cmd, cmdArgs } = this.parseCommand(args.command, useShell);

      // Spawn the process
      const childProcess = spawn(cmd, cmdArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: useShell === 'bash' || useShell === 'sh',
        env: { ...process.env },
        cwd: process.cwd()
      });

      // Create session
      const session: ElectronProcessSession = {
        pid,
        command: args.command,
        shell: useShell,
        startTime,
        lastActivity: startTime,
        status: 'running',
        blocked: false,
        process: childProcess
      };

      this.sessions.set(pid, session);

      // Set up process event handlers
      this.setupProcessHandlers(session, childProcess);

      // Set up timeout if specified
      if (args.timeout_ms && args.timeout_ms > 0) {
        setTimeout(() => {
          if (this.sessions.has(pid) && this.sessions.get(pid)!.status === 'running') {
            this.forceTerminateInternal(pid);
          }
        }, args.timeout_ms);
      }

      console.log(`🚀 Started process ${pid}: ${args.command}`);

      return this.createSuccessResponse(
        `Process started successfully:\nPID: ${pid}\nCommand: ${args.command}\nStatus: running\nStarted: ${startTime.toISOString()}`
      );

    } catch (error) {
      return this.createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Read output from a process
   */
  private async readProcessOutput(args: { pid: number; timeout_ms?: number }): Promise<CommandResult> {
    try {
      const session = this.sessions.get(args.pid);
      if (!session) {
        throw new Error(`Process ${args.pid} not found`);
      }

      if (!session.process) {
        throw new Error(`Process ${args.pid} has no associated child process`);
      }

      const output = await this.readProcessOutputInternal(session, args.timeout_ms || 5000);
      return this.createSuccessResponse(output || 'No output available');

    } catch (error) {
      return this.createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Send input to a process and get response
   */
  private async interactWithProcess(args: { pid: number; input: string; timeout_ms?: number }): Promise<CommandResult> {
    try {
      const session = this.sessions.get(args.pid);
      if (!session) {
        throw new Error(`Process ${args.pid} not found`);
      }

      if (!session.process || !session.process.stdin) {
        throw new Error(`Process ${args.pid} is not accepting input`);
      }

      // Send input to the process
      session.process.stdin.write(args.input + '\n');
      session.lastActivity = new Date();

      // Wait for output
      const output = await this.readProcessOutputInternal(session, args.timeout_ms || 5000);
      return this.createSuccessResponse(output || 'Command executed, no output returned');

    } catch (error) {
      return this.createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Force terminate a process
   */
  private async forceTerminate(args: { pid: number }): Promise<CommandResult> {
    try {
      const success = this.forceTerminateInternal(args.pid);
      if (success) {
        return this.createSuccessResponse(`Process ${args.pid} terminated successfully`);
      } else {
        return this.createErrorResponse(`Failed to terminate process ${args.pid}`);
      }
    } catch (error) {
      return this.createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * List all active sessions
   */
  private async listSessions(): Promise<CommandResult> {
    try {
      const sessions = Array.from(this.sessions.values()).map(session => ({
        pid: session.pid,
        command: session.command,
        status: session.status,
        startTime: session.startTime,
        blocked: session.blocked,
        runtime: Date.now() - session.startTime.getTime()
      }));

      if (sessions.length === 0) {
        return this.createSuccessResponse('No active sessions');
      }

      const sessionList = sessions.map(session =>
        `PID: ${session.pid} | Command: ${session.command} | Status: ${session.status} | ` +
        `Blocked: ${session.blocked} | Runtime: ${Math.round(session.runtime / 1000)}s`
      ).join('\n');

      return this.createSuccessResponse(`Active Sessions (${sessions.length}):\n${sessionList}`);

    } catch (error) {
      return this.createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * List all running processes on the system
   */
  private async listProcesses(): Promise<CommandResult> {
    try {
      const execAsync = promisify(exec);

      let command: string;
      if (process.platform === 'win32') {
        // Windows: Get processes with CPU and memory usage
        command = 'powershell "Get-Process | Sort-Object CPU -Descending | Select-Object -First 20 Name,Id,CPU,WorkingSet | Format-Table -AutoSize"';
      } else if (process.platform === 'darwin') {
        // macOS: Get top processes with CPU and memory
        command = 'ps aux | head -21';
      } else {
        // Linux: Get top processes with CPU and memory
        command = 'ps aux --sort=-%cpu | head -21';
      }

      console.log(`🔧 Executing system command: ${command}`);
      const { stdout } = await execAsync(command);
      console.log(`🔧 Command output length: ${stdout.length} characters`);

      return this.createSuccessResponse(stdout);
    } catch (error) {
      console.error(`🔧 listProcesses error:`, error);
      return this.createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Get current CPU usage percentage
   */
  private async getCpuUsage(): Promise<CommandResult> {
    try {
      const execAsync = promisify(exec);

      let command: string;
      if (process.platform === 'win32') {
        // PowerShell command to get CPU usage - simplified for better reliability
        command = 'powershell "Get-WmiObject -Class Win32_Processor | Measure-Object -Property LoadPercentage -Average | Select-Object Average"';
      } else if (process.platform === 'darwin') {
        // macOS command using top - more reliable format
        command = 'top -l 1 -s 0 | grep "CPU usage" | head -1';
      } else {
        // Linux command using top - simplified for better parsing
        command = 'top -bn1 | grep "Cpu(s)" | head -1';
      }

      console.log(`🔧 Executing CPU usage command: ${command}`);
      const { stdout } = await execAsync(command);
      console.log(`🔧 CPU usage output: ${stdout}`);

      return this.createSuccessResponse(`Current CPU Usage:\n${stdout}`);
    } catch (error) {
      console.error(`🔧 getCpuUsage error:`, error);
      return this.createErrorResponse(`Failed to get CPU usage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get current memory usage statistics
   */
  private async getMemoryUsage(): Promise<CommandResult> {
    try {
      const execAsync = promisify(exec);

      let command: string;
      if (process.platform === 'win32') {
        // PowerShell command to get memory usage
        command = 'powershell "Get-CimInstance -ClassName Win32_OperatingSystem | Select-Object TotalVisibleMemorySize,FreePhysicalMemory | ConvertTo-Json"';
      } else if (process.platform === 'darwin') {
        // macOS command using vm_stat
        command = 'vm_stat && echo "---" && sysctl hw.memsize';
      } else {
        // Linux command using free
        command = 'free -h';
      }

      console.log(`🔧 Executing memory usage command: ${command}`);
      const { stdout } = await execAsync(command);
      console.log(`🔧 Memory usage output length: ${stdout.length} characters`);

      return this.createSuccessResponse(`Current Memory Usage:\n${stdout}`);
    } catch (error) {
      console.error(`🔧 getMemoryUsage error:`, error);
      return this.createErrorResponse(`Failed to get memory usage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get comprehensive system information
   */
  private async getSystemInfo(): Promise<CommandResult> {
    try {
      const execAsync = promisify(exec);

      let commands: string[];
      if (process.platform === 'win32') {
        commands = [
          'powershell "Get-ComputerInfo | Select-Object WindowsProductName,WindowsVersion,TotalPhysicalMemory,CsProcessors | ConvertTo-Json"',
          'powershell "Get-CimInstance -ClassName Win32_LogicalDisk | Select-Object DeviceID,Size,FreeSpace | ConvertTo-Json"'
        ];
      } else if (process.platform === 'darwin') {
        commands = [
          'system_profiler SPSoftwareDataType SPHardwareDataType',
          'df -h'
        ];
      } else {
        commands = [
          'uname -a',
          'lscpu',
          'free -h',
          'df -h'
        ];
      }

      console.log(`🔧 Executing system info commands for ${process.platform}`);
      const results = await Promise.all(commands.map(cmd => execAsync(cmd)));
      const output = results.map((result, index) => `Command ${index + 1}:\n${result.stdout}`).join('\n\n---\n\n');

      return this.createSuccessResponse(`System Information:\n${output}`);
    } catch (error) {
      console.error(`🔧 getSystemInfo error:`, error);
      return this.createErrorResponse(`Failed to get system info: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Kill a system process by PID
   */
  private async killProcess(args: { pid: number }): Promise<CommandResult> {
    try {
      process.kill(args.pid, 'SIGTERM');
      return this.createSuccessResponse(`Process ${args.pid} killed successfully`);
    } catch (error) {
      return this.createErrorResponse(`Failed to kill process ${args.pid}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ===== FILESYSTEM COMMANDS =====

  /**
   * Read file contents
   */
  private async readFile(args: { path: string; isUrl?: boolean; offset?: number; length?: number } | { input: { path: string; isUrl?: boolean; offset?: number; length?: number } }): Promise<CommandResult> {
    try {
      // Handle both direct args and nested input format
      const actualArgs = 'path' in args ? args : args.input;
      const { path: filePath, isUrl, offset, length } = actualArgs;

      console.log(`🔧 readFile called with path: ${filePath}`);

      if (isUrl) {
        return this.readFromUrl(filePath);
      }

      this.validateFilePath(filePath);

      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      // Check if it's an image file
      const isImage = this.isImageFile(filePath);
      if (isImage) {
        const buffer = await fs.readFile(filePath);
        return {
          success: true,
          content: [
            { type: 'text', text: `Image file: ${filePath}` },
            { type: 'image', data: buffer.toString('base64'), mimeType: this.getMimeType(filePath) }
          ]
        };
      }

      // Read text file with offset/length support
      const content = await this.readTextFileWithOffset(filePath, offset || 0, length);
      return this.createSuccessResponse(content);

    } catch (error) {
      return this.createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Write file contents
   */
  private async writeFile(args: { path: string; content: string; append?: boolean } | { path: string; content: string; mode?: 'rewrite' | 'append' }): Promise<CommandResult> {
    try {
      console.log(`🔧 writeFile called with:`, { path: args.path, contentLength: args.content?.length, args });
      this.validateFilePath(args.path);

      // Handle both parameter formats: append boolean or mode string
      const shouldAppend = 'append' in args ? args.append : ('mode' in args && args.mode === 'append');

      if (shouldAppend) {
        console.log(`🔧 writeFile: Appending to ${args.path}`);
        await fs.appendFile(args.path, args.content);
      } else {
        console.log(`🔧 writeFile: Writing to ${args.path}`);
        await fs.writeFile(args.path, args.content, 'utf8');
      }

      const lines = args.content.split('\n');
      const lineCount = lines.length;
      const modeMessage = shouldAppend ? 'appended to' : 'wrote to';

      console.log(`✅ writeFile: Successfully ${modeMessage} ${args.path} (${lineCount} lines)`);
      return this.createSuccessResponse(`Successfully ${modeMessage} ${args.path} (${lineCount} lines)`);

    } catch (error) {
      console.error(`❌ writeFile error:`, error);
      return this.createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Create directory
   */
  private async createDirectory(args: { path: string }): Promise<CommandResult> {
    try {
      console.log(`🔧 createDirectory called with path: ${args.path}`);
      this.validateFilePath(args.path);
      await fs.mkdir(args.path, { recursive: true });
      console.log(`✅ createDirectory: Successfully created directory ${args.path}`);
      return this.createSuccessResponse(`Successfully created directory ${args.path}`);
    } catch (error) {
      console.error(`❌ createDirectory error:`, error);
      return this.createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * List directory contents
   */
  private async listDirectory(args: { path: string } | { input: { path: string } }): Promise<CommandResult> {
    try {
      // Handle both direct path and nested input format
      const path = 'path' in args ? args.path : args.input.path;

      console.log(`🔧 listDirectory called with path: ${path}`);
      this.validateFilePath(path);
      const entries = await fs.readdir(path, { withFileTypes: true });
      const result = entries.map(entry => {
        const prefix = entry.isDirectory() ? '[DIR]' : '[FILE]';
        return `${prefix} ${entry.name}`;
      }).join('\n');
      console.log(`🔧 listDirectory result: ${entries.length} entries found`);
      return this.createSuccessResponse(result);
    } catch (error) {
      console.error(`🔧 listDirectory error:`, error);
      return this.createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Move or rename file/directory
   */
  private async moveFile(args: { source: string; destination: string }): Promise<CommandResult> {
    try {
      this.validateFilePath(args.source);
      this.validateFilePath(args.destination);
      await fs.rename(args.source, args.destination);
      return this.createSuccessResponse(`Successfully moved ${args.source} to ${args.destination}`);
    } catch (error) {
      return this.createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Search for files by name pattern
   */
  private async searchFiles(args: { path: string; pattern: string; timeoutMs?: number }): Promise<CommandResult> {
    try {
      this.validateFilePath(args.path);
      const results = await this.searchFilesRecursive(args.path, args.pattern.toLowerCase(), args.timeoutMs);

      if (results.length === 0) {
        return this.createSuccessResponse('No matches found.');
      }

      return this.createSuccessResponse(results.join('\n'));
    } catch (error) {
      return this.createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Get file information
   */
  private async getFileInfo(args: { path: string }): Promise<CommandResult> {
    try {
      this.validateFilePath(args.path);
      const stats = await fs.stat(args.path);

      const info: FileInfo = {
        path: args.path,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        permissions: stats.mode.toString(8),
        type: stats.isDirectory() ? 'directory' : 'file'
      };

      // Add line count for text files
      if (stats.isFile() && !this.isImageFile(args.path)) {
        try {
          const content = await fs.readFile(args.path, 'utf8');
          const lines = content.split('\n');
          info.lineCount = lines.length;
          info.lastLine = lines.length - 1;
          info.appendPosition = lines.length;
        } catch {
          // Ignore errors for binary files
        }
      }

      const infoText = Object.entries(info)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

      return this.createSuccessResponse(infoText);
    } catch (error) {
      return this.createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Delete file or directory
   */
  private async deleteFile(args: { path: string; useRecycleBin?: boolean }): Promise<CommandResult> {
    try {
      console.log(`🔧 deleteFile called with:`, args);
      this.validateFilePath(args.path);

      const useRecycleBin = args.useRecycleBin !== false; // Default to true

      if (useRecycleBin) {
        // Use shell command to move to recycle bin on Windows
        if (process.platform === 'win32') {
          const execAsync = promisify(exec);

          // Use PowerShell to move file to recycle bin
          const escapedPath = args.path.replace(/'/g, "''");
          const command = `powershell -Command "Add-Type -AssemblyName Microsoft.VisualBasic; [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile('${escapedPath}', 'OnlyErrorDialogs', 'SendToRecycleBin')"`;

          console.log(`🔧 deleteFile: Moving to Recycle Bin: ${args.path}`);
          await execAsync(command);
          console.log(`✅ deleteFile: Successfully moved to Recycle Bin: ${args.path}`);

          return this.createSuccessResponse(`Successfully moved to Recycle Bin: ${args.path}`);
        } else {
          // On macOS/Linux, move to trash using system commands
          const execAsync = promisify(exec);

          if (process.platform === 'darwin') {
            // macOS: use osascript to move to trash
            const escapedPath = args.path.replace(/'/g, "\\'");
            await execAsync(`osascript -e 'tell application "Finder" to delete POSIX file "${escapedPath}"'`);
            return this.createSuccessResponse(`Successfully moved to Trash: ${args.path}`);
          } else {
            // Linux: use gio trash if available, otherwise move to ~/.local/share/Trash
            try {
              await execAsync(`gio trash "${args.path}"`);
              return this.createSuccessResponse(`Successfully moved to Trash: ${args.path}`);
            } catch {
              // Fallback: create .trash directory and move file there
              const trashDir = path.join(os.homedir(), '.local', 'share', 'Trash', 'files');
              await fs.mkdir(trashDir, { recursive: true });
              const fileName = path.basename(args.path);
              const trashPath = path.join(trashDir, fileName);
              await fs.rename(args.path, trashPath);
              return this.createSuccessResponse(`Successfully moved to Trash: ${args.path}`);
            }
          }
        }
      } else {
        // Permanent deletion
        console.log(`🔧 deleteFile: Permanently deleting: ${args.path}`);
        const stats = await fs.stat(args.path);
        if (stats.isDirectory()) {
          await fs.rmdir(args.path, { recursive: true });
        } else {
          await fs.unlink(args.path);
        }
        console.log(`✅ deleteFile: Successfully permanently deleted: ${args.path}`);
        return this.createSuccessResponse(`Successfully permanently deleted: ${args.path}`);
      }
    } catch (error) {
      console.error(`❌ deleteFile error:`, error);
      return this.createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  // ===== TEXT EDITING COMMANDS =====

  /**
   * Apply surgical text replacements to files
   */
  private async editBlock(args: { file_path: string; old_string: string; new_string: string; expected_replacements?: number }): Promise<CommandResult> {
    try {
      this.validateFilePath(args.file_path);

      // Read the current file content
      const content = await fs.readFile(args.file_path, 'utf8');

      // Perform the replacement
      const replacementCount = args.expected_replacements || 1;
      let actualReplacements = 0;
      let newContent = content;

      if (replacementCount === 1) {
        // Single replacement
        const index = content.indexOf(args.old_string);
        if (index !== -1) {
          newContent = content.substring(0, index) + args.new_string + content.substring(index + args.old_string.length);
          actualReplacements = 1;
        }
      } else {
        // Multiple replacements
        const regex = new RegExp(this.escapeRegExp(args.old_string), 'g');
        const matches = content.match(regex);
        actualReplacements = matches ? matches.length : 0;

        if (actualReplacements > 0) {
          newContent = content.replace(regex, args.new_string);
        }
      }

      // Check if replacement was successful
      if (actualReplacements === 0) {
        return this.createErrorResponse(`No exact matches found for the search text in ${args.file_path}.`);
      }

      if (args.expected_replacements && actualReplacements !== args.expected_replacements) {
        return this.createErrorResponse(
          `Expected ${args.expected_replacements} replacements but found ${actualReplacements} matches`
        );
      }

      // Write the modified content back to the file
      await fs.writeFile(args.file_path, newContent, 'utf8');

      return this.createSuccessResponse(`Successfully applied ${actualReplacements} replacement(s) in ${args.file_path}`);

    } catch (error) {
      return this.createErrorResponse(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Get available tools based on configuration
   */
  private getAvailableTools(): Array<{name: string; description: string; category: string; inputSchema: unknown}> {
    console.log(`🔧 ElectronInternalCommandHandler.getAvailableTools() called`);
    console.log(`🔧 Config exists: ${!!this.config}, enabled: ${this.config?.enabled}`);

    if (!this.config?.enabled) {
      console.log(`🔧 Internal commands disabled or no config, returning empty array`);
      return [];
    }

    const tools: Array<{name: string; description: string; category: string; inputSchema: unknown}> = [];

    // Add terminal commands if enabled
    if (this.config.enabledCommands.terminal) {
      tools.push(
        ...this.getTerminalCommandDefinitions()
      );
    }

    // Add filesystem commands if enabled
    if (this.config.enabledCommands.filesystem) {
      tools.push(
        ...this.getFilesystemCommandDefinitions()
      );
    }

    // Add text editing commands if enabled
    if (this.config.enabledCommands.textEditing) {
      tools.push(
        ...this.getTextEditingCommandDefinitions()
      );
    }

    // Add system commands if enabled
    if (this.config.enabledCommands.system) {
      const systemTools = this.getSystemCommandDefinitions();
      console.log(`🔧 Adding ${systemTools.length} system tools`);
      tools.push(...systemTools);
    }

    console.log(`🔧 Total tools generated: ${tools.length}`);
    if (tools.length > 0) {
      console.log(`🔧 Sample tools:`, tools.slice(0, 3).map(t => ({ name: t.name, category: t.category })));
    }

    return tools;
  }

  /**
   * Check if command is a terminal command
   */
  private isTerminalCommand(toolName: string): boolean {
    const terminalCommands = [
      'start_process', 'read_process_output', 'interact_with_process', 
      'force_terminate', 'list_sessions', 'kill_process', 'list_processes'
    ];
    return terminalCommands.includes(toolName);
  }

  /**
   * Check if command is a filesystem command
   */
  private isFilesystemCommand(toolName: string): boolean {
    const filesystemCommands = [
      'read_file', 'read_multiple_files', 'write_file', 'create_directory',
      'list_directory', 'move_file', 'search_files', 'search_code', 'get_file_info', 'delete_file'
    ];
    return filesystemCommands.includes(toolName);
  }

  /**
   * Check if command is a text editing command
   */
  private isTextEditingCommand(toolName: string): boolean {
    const textEditingCommands = ['edit_block'];
    return textEditingCommands.includes(toolName);
  }

  /**
   * Get terminal command definitions
   */
  private getTerminalCommandDefinitions() {
    return [
      {
        name: 'start_process',
        description: 'Start a new terminal process',
        category: 'terminal',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string' },
            timeout_ms: { type: 'number' },
            shell: { type: 'string' }
          },
          required: ['command', 'timeout_ms']
        }
      },
      {
        name: 'read_process_output',
        description: 'Read output from a running process',
        category: 'terminal',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: { type: 'string' }
          },
          required: ['session_id']
        }
      },
      {
        name: 'interact_with_process',
        description: 'Send input to an interactive process',
        category: 'terminal',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: { type: 'string' },
            input: { type: 'string' }
          },
          required: ['session_id', 'input']
        }
      },
      {
        name: 'force_terminate',
        description: 'Force terminate a process',
        category: 'terminal',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: { type: 'string' }
          },
          required: ['session_id']
        }
      },
      {
        name: 'list_sessions',
        description: 'List all active terminal sessions',
        category: 'terminal',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'kill_process',
        description: 'Kill a system process by PID',
        category: 'terminal',
        inputSchema: {
          type: 'object',
          properties: {
            pid: { type: 'number' }
          },
          required: ['pid']
        }
      },
      {
        name: 'list_processes',
        description: 'List all running processes on the system with CPU and memory usage',
        category: 'terminal',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_cpu_usage',
        description: 'Get current CPU usage percentage and system performance metrics. Works on Windows (PowerShell), macOS (zsh/bash), and Linux (bash).',
        category: 'system',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_memory_usage',
        description: 'Get current memory usage statistics including total, used, and available memory. Works on Windows (PowerShell), macOS (zsh/bash), and Linux (bash).',
        category: 'system',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_system_info',
        description: 'Get comprehensive system information including OS, CPU, memory, and disk usage. Works across all platforms.',
        category: 'system',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ];
  }

  /**
   * Get filesystem command definitions
   */
  private getFilesystemCommandDefinitions() {
    return [
      {
        name: 'read_file',
        description: 'Read file contents (supports images, documents, code)',
        category: 'filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            isUrl: { type: 'boolean' },
            offset: { type: 'number' },
            length: { type: 'number' }
          },
          required: ['path']
        }
      },
      {
        name: 'write_file',
        description: 'Write or append to files',
        category: 'filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            content: { type: 'string' },
            append: { type: 'boolean' }
          },
          required: ['path', 'content']
        }
      },
      {
        name: 'create_directory',
        description: 'Create directories',
        category: 'filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path']
        }
      },
      {
        name: 'list_directory',
        description: 'List directory contents',
        category: 'filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path']
        }
      },
      {
        name: 'move_file',
        description: 'Move or rename files/directories',
        category: 'filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            source: { type: 'string' },
            destination: { type: 'string' }
          },
          required: ['source', 'destination']
        }
      },
      {
        name: 'search_files',
        description: 'Find files by name patterns',
        category: 'filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            directory: { type: 'string' },
            pattern: { type: 'string' },
            recursive: { type: 'boolean' }
          },
          required: ['directory', 'pattern']
        }
      },
      {
        name: 'get_file_info',
        description: 'Get detailed file metadata',
        category: 'filesystem',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string' }
          },
          required: ['path']
        }
      }
    ];
  }

  /**
   * Get text editing command definitions
   */
  private getTextEditingCommandDefinitions() {
    return [
      {
        name: 'edit_block',
        description: 'Apply surgical text replacements',
        category: 'textEditing',
        inputSchema: {
          type: 'object',
          properties: {
            file_path: { type: 'string' },
            old_string: { type: 'string' },
            new_string: { type: 'string' },
            expected_replacements: { type: 'number' }
          },
          required: ['file_path', 'old_string', 'new_string']
        }
      }
    ];
  }

  /**
   * Get system command definitions
   */
  private getSystemCommandDefinitions() {
    return [
      {
        name: 'get_cpu_usage',
        description: 'Get current CPU usage percentage and system performance metrics. Works on Windows (PowerShell), macOS (zsh/bash), and Linux (bash).',
        category: 'system',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_memory_usage',
        description: 'Get current memory usage statistics including total, used, and available memory. Works on Windows (PowerShell), macOS (zsh/bash), and Linux (bash).',
        category: 'system',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'get_system_info',
        description: 'Get comprehensive system information including OS, CPU, memory, and disk usage. Works across all platforms.',
        category: 'system',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    ];
  }

  /**
   * Check rate limiting to prevent abuse
   */
  private checkRateLimit(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean old entries
    this.commandHistory = this.commandHistory.filter(entry => entry.timestamp > oneMinuteAgo);

    // Check if rate limit exceeded
    if (this.commandHistory.length >= this.MAX_COMMANDS_PER_MINUTE) {
      throw new Error(
        `Rate limit exceeded: Maximum ${this.MAX_COMMANDS_PER_MINUTE} commands per minute`
      );
    }
  }

  /**
   * Record command execution for monitoring
   */
  private recordCommandExecution(command: string, success: boolean): void {
    this.commandHistory.push({
      timestamp: Date.now(),
      command,
      success
    });

    // Limit history size
    if (this.commandHistory.length > this.MAX_HISTORY_SIZE) {
      this.commandHistory = this.commandHistory.slice(-this.MAX_HISTORY_SIZE);
    }
  }

  // ===== HELPER METHODS =====

  private createSuccessResponse(text: string): CommandResult {
    return {
      success: true,
      content: [{ type: 'text', text }]
    };
  }

  private createErrorResponse(message: string): CommandResult {
    return {
      success: false,
      content: [{ type: 'text', text: `Error: ${message}` }],
      error: message
    };
  }

  private getDefaultShell(): string {
    switch (process.platform) {
      case 'win32':
        return 'powershell';
      case 'darwin':
      case 'linux':
      default:
        return 'bash';
    }
  }

  private parseCommand(command: string, shell: string): { cmd: string; cmdArgs: string[] } {
    if (shell === 'powershell') {
      return {
        cmd: 'powershell',
        cmdArgs: ['-Command', command]
      };
    } else {
      return {
        cmd: shell,
        cmdArgs: ['-c', command]
      };
    }
  }

  private setupProcessHandlers(session: ElectronProcessSession, childProcess: ChildProcess): void {
    childProcess.on('close', (code) => {
      session.status = code === 0 ? 'finished' : 'error';
      console.log(`📋 Process ${session.pid} closed with code ${code}`);
    });

    childProcess.on('error', (error) => {
      session.status = 'error';
      console.error(`❌ Process ${session.pid} error:`, error);
    });

    // Detect if process is blocked (waiting for input)
    let lastOutputTime = Date.now();
    childProcess.stdout?.on('data', () => {
      lastOutputTime = Date.now();
      session.blocked = false;
    });

    // Check periodically if process seems blocked
    const checkBlocked = setInterval(() => {
      if (session.status === 'running' && Date.now() - lastOutputTime > 2000) {
        session.blocked = true;
      }
    }, 1000);

    childProcess.on('close', () => {
      clearInterval(checkBlocked);
    });
  }

  private async readProcessOutputInternal(session: ElectronProcessSession, timeoutMs: number): Promise<string> {
    return new Promise((resolve, reject) => {
      let output = '';
      let hasResolved = false;

      const timeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          resolve(output || 'Process timed out or no output available');
        }
      }, timeoutMs);

      // Collect stdout data
      const onData = (data: Buffer) => {
        output += data.toString();
        session.lastActivity = new Date();
      };

      // Handle process completion
      const onClose = (code: number | null) => {
        clearTimeout(timeout);
        if (!hasResolved) {
          hasResolved = true;
          session.status = code === 0 ? 'finished' : 'error';
          resolve(output);
        }
      };

      // Handle errors
      const onError = (error: Error) => {
        clearTimeout(timeout);
        if (!hasResolved) {
          hasResolved = true;
          session.status = 'error';
          reject(error);
        }
      };

      session.process!.stdout?.on('data', onData);
      session.process!.stderr?.on('data', onData);
      session.process!.on('close', onClose);
      session.process!.on('error', onError);

      // Clean up listeners after resolution
      const cleanup = () => {
        session.process!.stdout?.off('data', onData);
        session.process!.stderr?.off('data', onData);
        session.process!.off('close', onClose);
        session.process!.off('error', onError);
      };

      // Ensure cleanup happens
      setTimeout(cleanup, timeoutMs + 1000);
    });
  }

  private forceTerminateInternal(pid: number): boolean {
    const session = this.sessions.get(pid);
    if (!session) {
      return false;
    }

    try {
      if (session.process) {
        session.process.kill('SIGTERM');

        // If process doesn't terminate gracefully, force kill
        setTimeout(() => {
          if (session.process && !session.process.killed) {
            session.process.kill('SIGKILL');
          }
        }, 5000);
      }

      session.status = 'finished';
      this.sessions.delete(pid);

      console.log(`🛑 Terminated process ${pid}`);
      return true;

    } catch (error) {
      console.error(`❌ Failed to terminate process ${pid}:`, error);
      return false;
    }
  }

  private isImageFile(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'].includes(ext);
  }

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

  private async readFromUrl(url: string): Promise<CommandResult> {
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
          success: true,
          content: [
            { type: 'text', text: `Image from URL: ${url}` },
            { type: 'image', data: Buffer.from(buffer).toString('base64'), mimeType: contentType }
          ]
        };
      } else {
        const content = await response.text();
        return this.createSuccessResponse(content);
      }
    } catch (error) {
      return this.createErrorResponse(`Failed to fetch URL ${url}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async searchFilesRecursive(dirPath: string, pattern: string, timeoutMs?: number, startTime?: number): Promise<string[]> {
    const results: string[] = [];
    const currentTime = Date.now();
    if (!startTime) startTime = currentTime;

    if (timeoutMs && (currentTime - startTime) > timeoutMs) {
      return results; // Timeout reached
    }

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isFile() && entry.name.toLowerCase().includes(pattern)) {
          results.push(fullPath);
        } else if (entry.isDirectory() && !entry.name.startsWith('.')) {
          // Recursively search subdirectories
          const subResults = await this.searchFilesRecursive(fullPath, pattern, timeoutMs, startTime);
          results.push(...subResults);
        }
      }
    } catch (error) {
      // Ignore permission errors and continue
      console.warn(`Search warning for ${dirPath}:`, error);
    }

    return results;
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

// Export singleton instance
export const electronInternalCommandHandler = new ElectronInternalCommandHandler();
