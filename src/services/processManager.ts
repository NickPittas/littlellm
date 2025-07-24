/**
 * Process Manager for Internal Commands
 * Handles terminal process execution and management
 */

import { spawn, ChildProcess } from 'child_process';
import { ProcessSession, ProcessInfo } from '../types/internalCommands';
import { EventEmitter } from 'events';

class ProcessManager extends EventEmitter {
  private sessions: Map<number, ProcessSession> = new Map();
  private nextPid: number = 1000; // Start with a high number to avoid conflicts

  constructor() {
    super();
    this.setupCleanup();
  }

  /**
   * Start a new process
   */
  async startProcess(command: string, shell?: string, timeout?: number): Promise<ProcessInfo> {
    const pid = this.nextPid++;
    const startTime = new Date();

    try {
      // Determine shell to use
      const useShell = shell || this.getDefaultShell();
      
      // Parse command and arguments
      const { cmd, args } = this.parseCommand(command, useShell);
      
      // Spawn the process
      const childProcess = spawn(cmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: useShell === 'bash' || useShell === 'sh',
        env: { ...process.env },
        cwd: process.cwd()
      });

      // Create session
      const session: ProcessSession = {
        pid,
        command,
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
      if (timeout && timeout > 0) {
        setTimeout(() => {
          if (this.sessions.has(pid) && this.sessions.get(pid)!.status === 'running') {
            this.forceTerminate(pid);
          }
        }, timeout);
      }

      console.log(`🚀 Started process ${pid}: ${command}`);

      return {
        pid,
        command,
        status: 'running',
        startTime,
        blocked: false,
        runtime: 0
      };

    } catch (error) {
      console.error(`❌ Failed to start process: ${command}`, error);
      throw new Error(`Failed to start process: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Read output from a process
   */
  async readProcessOutput(pid: number, timeoutMs?: number): Promise<string> {
    const session = this.sessions.get(pid);
    if (!session) {
      throw new Error(`Process ${pid} not found`);
    }

    if (!session.process) {
      throw new Error(`Process ${pid} has no associated child process`);
    }

    return new Promise((resolve, reject) => {
      let output = '';
      let hasResolved = false;

      const timeout = setTimeout(() => {
        if (!hasResolved) {
          hasResolved = true;
          resolve(output || 'Process timed out or no output available');
        }
      }, timeoutMs || 5000);

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
      setTimeout(cleanup, (timeoutMs || 5000) + 1000);
    });
  }

  /**
   * Send input to a process
   */
  async interactWithProcess(pid: number, input: string, timeoutMs?: number): Promise<string> {
    const session = this.sessions.get(pid);
    if (!session) {
      throw new Error(`Process ${pid} not found`);
    }

    if (!session.process || !session.process.stdin) {
      throw new Error(`Process ${pid} is not accepting input`);
    }

    // Send input to the process
    session.process.stdin.write(input + '\n');
    session.lastActivity = new Date();

    // Wait for output
    return this.readProcessOutput(pid, timeoutMs);
  }

  /**
   * Force terminate a process
   */
  async forceTerminate(pid: number): Promise<boolean> {
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

  /**
   * List all active sessions
   */
  listSessions(): ProcessInfo[] {
    return Array.from(this.sessions.values()).map(session => ({
      pid: session.pid,
      command: session.command,
      status: session.status,
      startTime: session.startTime,
      blocked: session.blocked,
      runtime: Date.now() - session.startTime.getTime()
    }));
  }

  /**
   * Kill a process by PID (system-wide)
   */
  async killProcess(pid: number): Promise<boolean> {
    try {
      process.kill(pid, 'SIGTERM');
      return true;
    } catch (error) {
      console.error(`❌ Failed to kill process ${pid}:`, error);
      return false;
    }
  }

  /**
   * Get default shell based on platform
   */
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

  /**
   * Parse command for shell execution
   */
  private parseCommand(command: string, shell: string): { cmd: string; args: string[] } {
    if (shell === 'powershell') {
      return {
        cmd: 'powershell',
        args: ['-Command', command]
      };
    } else {
      return {
        cmd: shell,
        args: ['-c', command]
      };
    }
  }

  /**
   * Set up process event handlers
   */
  private setupProcessHandlers(session: ProcessSession, childProcess: ChildProcess): void {
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

  /**
   * Set up cleanup on process exit
   */
  private setupCleanup(): void {
    const cleanup = () => {
      console.log('🧹 Cleaning up process manager...');
      for (const [pid] of this.sessions) {
        this.forceTerminate(pid);
      }
    };

    process.on('exit', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  }
}

// Export singleton instance
export const processManager = new ProcessManager();
