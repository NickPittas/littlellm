/**
 * Terminal Command Implementations
 * Implements DesktopCommanderMCP terminal functionality as internal commands
 */

import {
  CommandResult,
  InternalCommandTool,
  StartProcessArgs,
  ReadProcessOutputArgs,
  InteractWithProcessArgs,
  ForceTerminateArgs,
  KillProcessArgs
} from '../../types/internalCommands';
import { processManager } from '../processManager';
import { internalCommandService } from '../internalCommandService';

/**
 * Start a new terminal process
 */
async function startProcess(args: unknown): Promise<CommandResult> {
  try {
    const { command, timeout_ms, shell } = args as StartProcessArgs;

    // Validate command against blocked commands
    internalCommandService.validateCommand(command);

    // Start the process
    const processInfo = await processManager.startProcess(command, shell, timeout_ms);

    return internalCommandService.createSuccessResponse(
      `Process started successfully:\n` +
      `PID: ${processInfo.pid}\n` +
      `Command: ${processInfo.command}\n` +
      `Status: ${processInfo.status}\n` +
      `Started: ${processInfo.startTime.toISOString()}`
    );

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Read output from a running process
 */
async function readProcessOutput(args: unknown): Promise<CommandResult> {
  try {
    const { pid, timeout_ms } = args as ReadProcessOutputArgs;

    const output = await processManager.readProcessOutput(pid, timeout_ms);

    return {
      success: true,
      content: [{
        type: 'text',
        text: output || 'No output available'
      }]
    };

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Send input to a running process and get response
 */
async function interactWithProcess(args: unknown): Promise<CommandResult> {
  try {
    const { pid, input, timeout_ms } = args as InteractWithProcessArgs;

    const output = await processManager.interactWithProcess(pid, input, timeout_ms);

    return {
      success: true,
      content: [{
        type: 'text',
        text: output || 'Command executed, no output returned'
      }]
    };

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Force terminate a running process
 */
async function forceTerminate(args: unknown): Promise<CommandResult> {
  try {
    const { pid } = args as ForceTerminateArgs;

    const success = await processManager.forceTerminate(pid);

    if (success) {
      return internalCommandService.createSuccessResponse(
        `Process ${pid} terminated successfully`
      );
    } else {
      return internalCommandService.createErrorResponse(
        `Failed to terminate process ${pid}`
      );
    }

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * List all active terminal sessions
 */
async function listSessions(): Promise<CommandResult> {
  try {
    const sessions = processManager.listSessions();

    if (sessions.length === 0) {
      return internalCommandService.createSuccessResponse('No active sessions');
    }

    const sessionList = sessions.map(session => 
      `PID: ${session.pid} | Command: ${session.command} | Status: ${session.status} | ` +
      `Blocked: ${session.blocked} | Runtime: ${Math.round(session.runtime / 1000)}s`
    ).join('\n');

    return {
      success: true,
      content: [{
        type: 'text',
        text: `Active Sessions (${sessions.length}):\n${sessionList}`
      }]
    };

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * Kill a system process by PID
 */
async function killProcess(args: unknown): Promise<CommandResult> {
  try {
    const { pid } = args as KillProcessArgs;

    const success = await processManager.killProcess(pid);

    if (success) {
      return internalCommandService.createSuccessResponse(
        `Process ${pid} killed successfully`
      );
    } else {
      return internalCommandService.createErrorResponse(
        `Failed to kill process ${pid}`
      );
    }

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * List all running processes (system-wide)
 */
async function listProcesses(): Promise<CommandResult> {
  try {
    // Use platform-specific command to list processes
    const command = process.platform === 'win32'
      ? 'tasklist /fo csv'
      : 'ps aux';

    const processInfo = await processManager.startProcess(command);
    const output = await processManager.readProcessOutput(processInfo.pid, 10000);

    // Clean up the temporary process
    await processManager.forceTerminate(processInfo.pid);

    return {
      success: true,
      content: [{
        type: 'text',
        text: output || 'No processes found'
      }]
    };

  } catch (error) {
    return internalCommandService.createErrorResponse(
      error instanceof Error ? error.message : String(error)
    );
  }
}

// Terminal command tool definitions
export const terminalCommands: InternalCommandTool[] = [
  {
    name: 'start_process',
    description: `Start a new terminal process with intelligent state detection.
    
CRITICAL RULE: For ANY local file work, ALWAYS use this tool + interact_with_process, NEVER use analysis/REPL tool.

REQUIRED WORKFLOW FOR LOCAL FILES:
1. start_process("python3 -i") - Start Python REPL for data analysis
2. interact_with_process(pid, "import pandas as pd, numpy as np")
3. interact_with_process(pid, "df = pd.read_csv('/absolute/path/file.csv')")
4. interact_with_process(pid, "print(df.describe())")

COMMON PATTERNS:
• start_process("python3 -i") → Python REPL for data analysis (RECOMMENDED)
• start_process("node -i") → Node.js for JSON processing
• start_process("bash") → Interactive bash shell

Parameters:
- command: Shell command to execute
- timeout_ms: Maximum execution time in milliseconds
- shell: Optional shell to use (bash, powershell, etc.)`,
    category: 'terminal',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        timeout_ms: { type: 'number', description: 'Timeout in milliseconds' },
        shell: { type: 'string', description: 'Shell to use (optional)' }
      },
      required: ['command', 'timeout_ms']
    },
    handler: startProcess
  },
  {
    name: 'read_process_output',
    description: `Read output from a running process with intelligent completion detection.
    
SMART FEATURES:
- Early exit when REPL shows prompt (>>>, >, etc.)
- Detects process completion vs still running
- Prevents hanging on interactive prompts

Parameters:
- pid: Process ID from start_process
- timeout_ms: Maximum wait time (optional)`,
    category: 'terminal',
    inputSchema: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Process ID' },
        timeout_ms: { type: 'number', description: 'Timeout in milliseconds (optional)' }
      },
      required: ['pid']
    },
    handler: readProcessOutput
  },
  {
    name: 'interact_with_process',
    description: `Send input to a running process and automatically receive the response.
    
CRITICAL: THIS IS THE PRIMARY TOOL FOR ALL LOCAL FILE ANALYSIS
For ANY local file analysis (CSV, JSON, data processing), ALWAYS use this instead of the analysis tool.

REQUIRED INTERACTIVE WORKFLOW FOR FILE ANALYSIS:
1. Start REPL: start_process("python3 -i")
2. Load libraries: interact_with_process(pid, "import pandas as pd, numpy as np")
3. Read file: interact_with_process(pid, "df = pd.read_csv('/absolute/path/file.csv')")
4. Analyze: interact_with_process(pid, "print(df.describe())")

Parameters:
- pid: Process ID from start_process
- input: Code/command to execute
- timeout_ms: Maximum wait time (optional)
- wait_for_prompt: Auto-wait for response (optional)`,
    category: 'terminal',
    inputSchema: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Process ID' },
        input: { type: 'string', description: 'Input to send to process' },
        timeout_ms: { type: 'number', description: 'Timeout in milliseconds (optional)' },
        wait_for_prompt: { type: 'boolean', description: 'Wait for prompt (optional)' }
      },
      required: ['pid', 'input']
    },
    handler: interactWithProcess
  },
  {
    name: 'force_terminate',
    description: `Force terminate a running terminal session.
    
Parameters:
- pid: Process ID to terminate`,
    category: 'terminal',
    inputSchema: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Process ID to terminate' }
      },
      required: ['pid']
    },
    handler: forceTerminate
  },
  {
    name: 'list_sessions',
    description: `List all active terminal sessions.
    
Shows session status including:
- PID: Process identifier
- Blocked: Whether session is waiting for input
- Runtime: How long the session has been running`,
    category: 'terminal',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    },
    handler: listSessions
  },
  {
    name: 'kill_process',
    description: `Terminate a running process by PID.
    
Use with caution as this will forcefully terminate the specified process.

Parameters:
- pid: Process ID to kill`,
    category: 'terminal',
    inputSchema: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Process ID to kill' }
      },
      required: ['pid']
    },
    handler: killProcess
  },
  {
    name: 'list_processes',
    description: `List all running processes.
    
Returns process information including PID, command name, CPU usage, and memory usage.`,
    category: 'terminal',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false
    },
    handler: listProcesses
  }
];
