import { app, BrowserWindow, globalShortcut, Tray, Menu, clipboard, ipcMain, nativeImage, protocol, screen, BrowserWindowConstructorOptions, dialog, desktopCapturer, Display } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as http from 'http';
import * as mime from 'mime-types';
import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// MCP Connection Management
interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface MCPResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: Record<string, unknown>;
}

interface MCPServer {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

interface MCPServerConfig {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  enabled: boolean;
}

interface MCPData {
  servers: MCPServerConfig[];
  version: string;
}

interface MCPConnection {
  client: Client;
  transport: StdioClientTransport;
  server: MCPServer;
  tools: MCPTool[];
  resources: MCPResource[];
  prompts: MCPPrompt[];
  connected: boolean;
  process?: NodeJS.Process;
}

const mcpConnections: Map<string, MCPConnection> = new Map();

// Multi-Monitor Utility Functions
interface WindowPositionOptions {
  width: number;
  height: number;
  offsetX?: number;
  offsetY?: number;
  preferredPosition?: 'center' | 'below' | 'right' | 'cursor';
}

function getMainWindowDisplay(): Display {
  if (!mainWindow) {
    return screen.getPrimaryDisplay();
  }

  const mainBounds = mainWindow.getBounds();
  const mainCenterX = mainBounds.x + mainBounds.width / 2;
  const mainCenterY = mainBounds.y + mainBounds.height / 2;

  return screen.getDisplayNearestPoint({ x: mainCenterX, y: mainCenterY });
}

function calculateWindowPosition(options: WindowPositionOptions): { x: number; y: number } {
  const { width, height, offsetX = 0, offsetY = 0, preferredPosition = 'center' } = options;

  if (!mainWindow) {
    // Fallback to primary display center
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    return {
      x: Math.max(0, (screenWidth - width) / 2),
      y: Math.max(0, (screenHeight - height) / 2)
    };
  }

  const mainBounds = mainWindow.getBounds();
  const display = getMainWindowDisplay();
  const { x: displayX, y: displayY, width: displayWidth, height: displayHeight } = display.workArea;

  let x: number, y: number;

  switch (preferredPosition) {
    case 'center':
      x = mainBounds.x + (mainBounds.width - width) / 2;
      y = mainBounds.y + (mainBounds.height - height) / 2;
      break;
    case 'below':
      x = mainBounds.x + (mainBounds.width - width) / 2;
      y = mainBounds.y + mainBounds.height + 10;
      break;
    case 'right':
      x = mainBounds.x + mainBounds.width + 10;
      y = mainBounds.y;
      break;
    case 'cursor':
      const cursorPoint = screen.getCursorScreenPoint();
      x = cursorPoint.x + offsetX;
      y = cursorPoint.y + offsetY;
      break;
    default:
      x = mainBounds.x + offsetX;
      y = mainBounds.y + offsetY;
  }

  // Ensure window stays within the display bounds
  x = Math.max(displayX, Math.min(x, displayX + displayWidth - width));
  y = Math.max(displayY, Math.min(y, displayY + displayHeight - height));

  return { x, y };
}

// macOS Permission and Security Utilities
async function checkAndFixMacOSPermissions(command: string): Promise<string> {
  if (process.platform !== 'darwin') {
    return command; // Not macOS, return as-is
  }

  try {
    // Check if command is a full path
    const isFullPath = path.isAbsolute(command);
    let executablePath = command;

    if (!isFullPath) {
      // Try to find the command in PATH
      try {
        const result = spawn('which', [command], { stdio: 'pipe' });
        const output = await new Promise<string>((resolve, reject) => {
          let stdout = '';
          result.stdout.on('data', (data) => stdout += data.toString());
          result.on('close', (code) => {
            if (code === 0) resolve(stdout.trim());
            else reject(new Error(`Command not found: ${command}`));
          });
        });
        executablePath = output;
      } catch (error) {
        console.warn(`⚠️ Command '${command}' not found in PATH, trying as-is`);
        return command;
      }
    }

    // Check if file exists
    if (!fs.existsSync(executablePath)) {
      console.warn(`⚠️ Executable not found: ${executablePath}`);
      return command;
    }

    // Check and fix executable permissions
    try {
      const stats = fs.statSync(executablePath);
      const hasExecutePermission = (stats.mode & parseInt('111', 8)) !== 0;

      if (!hasExecutePermission) {
        console.log(`🔧 Adding execute permissions to: ${executablePath}`);
        fs.chmodSync(executablePath, stats.mode | parseInt('755', 8));
      }
    } catch (error) {
      console.warn(`⚠️ Could not check/fix permissions for ${executablePath}:`, error);
    }

    return executablePath;
  } catch (error) {
    console.warn(`⚠️ Error checking macOS permissions for ${command}:`, error);
    return command;
  }
}

function setupMacOSEnvironment(env: Record<string, string>): NodeJS.ProcessEnv {
  if (process.platform !== 'darwin') {
    // Windows/Linux environment setup
    return setupCrossPlatformEnvironment(env);
  }

  // Get security bypass environment variables
  const securityBypass = createMacOSSecurityBypass();

  // Common macOS environment setup
  const macOSEnv = {
    ...env,
    ...securityBypass, // Apply security bypass

    // Ensure PATH includes common locations
    PATH: [
      env.PATH || process.env.PATH || '',
      '/usr/local/bin',
      '/opt/homebrew/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
      '/opt/local/bin',
      '/usr/local/opt/python/bin',
      '/Library/Frameworks/Python.framework/Versions/3.11/bin',
      '/Library/Frameworks/Python.framework/Versions/3.12/bin',
      '/Library/Frameworks/Python.framework/Versions/3.13/bin',
      process.env.HOME + '/.local/bin',
      process.env.HOME + '/bin',
      process.env.HOME + '/.cargo/bin', // Rust tools
      process.env.HOME + '/.npm-global/bin', // Global npm packages
      '/usr/local/share/npm/bin' // Alternative npm location
    ].filter(Boolean).join(':'),

    // Python-specific environment variables
    PYTHONPATH: env.PYTHONPATH || process.env.PYTHONPATH || '',

    // Node.js environment
    NODE_ENV: (env.NODE_ENV || process.env.NODE_ENV || 'production') as 'development' | 'production' | 'test'
  };

  return macOSEnv;
}

function setupCrossPlatformEnvironment(env: Record<string, string>): NodeJS.ProcessEnv {
  // Windows/Linux environment setup
  const isWindows = process.platform === 'win32';
  const pathSeparator = isWindows ? ';' : ':';

  // Common paths for Node.js/npm on Windows and Linux
  const commonPaths = [
    env.PATH || process.env.PATH || '',
  ];

  if (isWindows) {
    // Windows-specific paths
    commonPaths.push(
      'C:\\Program Files\\nodejs',
      'C:\\Program Files (x86)\\nodejs',
      process.env.APPDATA + '\\npm',
      process.env.USERPROFILE + '\\AppData\\Roaming\\npm',
      process.env.USERPROFILE + '\\.npm-global',
      process.env.LOCALAPPDATA + '\\npm'
    );
  } else {
    // Linux-specific paths
    commonPaths.push(
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      process.env.HOME + '/.local/bin',
      process.env.HOME + '/bin',
      process.env.HOME + '/.npm-global/bin',
      '/usr/local/share/npm/bin'
    );
  }

  return {
    ...process.env,
    ...env,
    PATH: commonPaths.filter(Boolean).join(pathSeparator),
    NODE_ENV: (env.NODE_ENV || process.env.NODE_ENV || 'production') as 'development' | 'production' | 'test'
  };
}

async function validateMCPServerCommand(server: MCPServerConfig): Promise<{ valid: boolean; error?: string; fixedCommand?: string }> {
  try {
    console.log(`🔍 Validating MCP server command: ${server.command} on ${process.platform}`);

    if (process.platform === 'darwin') {
      return await validateMacOSCommand(server);
    } else if (process.platform === 'win32') {
      return await validateWindowsCommand(server);
    } else {
      return await validateLinuxCommand(server);
    }
  } catch (error) {
    return {
      valid: false,
      error: `Validation error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

async function validateMacOSCommand(server: MCPServerConfig): Promise<{ valid: boolean; error?: string; fixedCommand?: string }> {
  console.log(`🍎 Running macOS validation for: ${server.command}`);

  // Check and fix macOS permissions
  const fixedCommand = await checkAndFixMacOSPermissions(server.command);

  // Test if the command can be executed
  return new Promise((resolve) => {
    const testProcess = spawn(fixedCommand, ['--help'], {
      stdio: 'pipe',
      env: setupMacOSEnvironment(server.env || {})
    });

    let hasResponded = false;
    const timeout = setTimeout(() => {
      if (!hasResponded) {
        hasResponded = true;
        testProcess.kill();
        resolve({
          valid: true, // Assume valid if no immediate error
          fixedCommand
        });
      }
    }, 3000); // 3 second timeout

    testProcess.on('error', (error: Error) => {
      if (!hasResponded) {
        hasResponded = true;
        clearTimeout(timeout);
        console.error(`❌ macOS command validation failed for ${server.command}:`, error);
        resolve({
          valid: false,
          error: `macOS command execution failed: ${error.message}`,
          fixedCommand
        });
      }
    });

    testProcess.on('spawn', () => {
      if (!hasResponded) {
        hasResponded = true;
        clearTimeout(timeout);
        testProcess.kill();
        resolve({
          valid: true,
          fixedCommand
        });
      }
    });
  });
}

async function validateWindowsCommand(server: MCPServerConfig): Promise<{ valid: boolean; error?: string; fixedCommand?: string }> {
  console.log(`🪟 Running Windows validation for: ${server.command}`);

  // Windows-specific command validation
  const fixedCommand = server.command;

  // For Windows, we need to handle .cmd and .bat files differently
  const windowsCommand = server.command.endsWith('.cmd') || server.command.endsWith('.bat')
    ? server.command
    : server.command;

  return new Promise((resolve) => {
    // Use 'where' command on Windows to check if command exists
    const testProcess = spawn('where', [windowsCommand], {
      stdio: 'pipe',
      env: setupCrossPlatformEnvironment(server.env || {}),
      shell: true // Important for Windows
    });

    let hasResponded = false;
    const timeout = setTimeout(() => {
      if (!hasResponded) {
        hasResponded = true;
        testProcess.kill();
        resolve({
          valid: true, // Assume valid if no immediate error
          fixedCommand
        });
      }
    }, 3000);

    testProcess.on('error', (error: Error) => {
      if (!hasResponded) {
        hasResponded = true;
        clearTimeout(timeout);
        console.error(`❌ Windows command validation failed for ${server.command}:`, error);
        resolve({
          valid: false,
          error: `Windows command not found: ${error.message}`,
          fixedCommand
        });
      }
    });

    testProcess.on('close', (code: number | null) => {
      if (!hasResponded) {
        hasResponded = true;
        clearTimeout(timeout);
        if (code === 0) {
          console.log(`✅ Windows command found: ${server.command}`);
          resolve({
            valid: true,
            fixedCommand
          });
        } else {
          console.warn(`⚠️ Windows command not found in PATH: ${server.command}`);
          resolve({
            valid: false,
            error: `Command not found in Windows PATH: ${server.command}`,
            fixedCommand
          });
        }
      }
    });
  });
}

async function validateLinuxCommand(server: MCPServerConfig): Promise<{ valid: boolean; error?: string; fixedCommand?: string }> {
  console.log(`🐧 Running Linux validation for: ${server.command}`);

  const fixedCommand = server.command;

  return new Promise((resolve) => {
    // Use 'which' command on Linux to check if command exists
    const testProcess = spawn('which', [server.command], {
      stdio: 'pipe',
      env: setupCrossPlatformEnvironment(server.env || {})
    });

    let hasResponded = false;
    const timeout = setTimeout(() => {
      if (!hasResponded) {
        hasResponded = true;
        testProcess.kill();
        resolve({
          valid: true, // Assume valid if no immediate error
          fixedCommand
        });
      }
    }, 3000);

    testProcess.on('error', (error: Error) => {
      if (!hasResponded) {
        hasResponded = true;
        clearTimeout(timeout);
        console.error(`❌ Linux command validation failed for ${server.command}:`, error);
        resolve({
          valid: false,
          error: `Linux command execution failed: ${error.message}`,
          fixedCommand
        });
      }
    });

    testProcess.on('close', (code: number | null) => {
      if (!hasResponded) {
        hasResponded = true;
        clearTimeout(timeout);
        if (code === 0) {
          console.log(`✅ Linux command found: ${server.command}`);
          resolve({
            valid: true,
            fixedCommand
          });
        } else {
          resolve({
            valid: false,
            error: `Command not found in Linux PATH: ${server.command}`,
            fixedCommand
          });
        }
      }
    });
  });
}

async function attemptMacOSFixes(server: MCPServerConfig): Promise<{ success: boolean; message: string }> {
  if (process.platform !== 'darwin') {
    return { success: false, message: 'Not macOS' };
  }

  console.log(`🔧 Attempting macOS fixes for ${server.command}...`);

  try {
    // Fix 1: Try to install common MCP servers via package managers
    if (server.command.includes('python') || server.command.includes('pip')) {
      console.log(`🐍 Detected Python-based MCP server, checking Python installation...`);

      // Check if Python is available
      try {
        await new Promise<void>((resolve, reject) => {
          const pythonCheck = spawn('python3', ['--version'], { stdio: 'pipe' });
          pythonCheck.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error('Python3 not found'));
          });
        });
        console.log(`✅ Python3 is available`);
      } catch {
        return {
          success: false,
          message: 'Python3 not found. Install with: brew install python3'
        };
      }
    }

    // Fix 2: Try to make the command executable
    if (fs.existsSync(server.command)) {
      try {
        const stats = fs.statSync(server.command);
        if (!(stats.mode & parseInt('111', 8))) {
          fs.chmodSync(server.command, stats.mode | parseInt('755', 8));
          console.log(`✅ Added execute permissions to ${server.command}`);
        }
      } catch (error) {
        console.warn(`⚠️ Could not fix permissions: ${error}`);
      }
    }

    // Fix 3: Check and suggest Homebrew installation for common tools
    const commonTools = ['uv', 'node', 'npm', 'python3', 'pip3'];
    const commandName = path.basename(server.command);

    if (commonTools.includes(commandName)) {
      try {
        // Check if Homebrew is available
        await new Promise<void>((resolve, reject) => {
          const brewCheck = spawn('brew', ['--version'], { stdio: 'pipe' });
          brewCheck.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error('Homebrew not found'));
          });
        });

        return {
          success: false,
          message: `Try installing with Homebrew: brew install ${commandName}`
        };
      } catch {
        return {
          success: false,
          message: `Install Homebrew first: /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
        };
      }
    }

    // Fix 4: For npm-based tools, suggest global installation
    if (server.command.includes('npx') || server.command.includes('node_modules')) {
      return {
        success: false,
        message: 'Try installing globally: npm install -g <package-name>'
      };
    }

    return { success: true, message: 'Basic fixes applied' };
  } catch (error) {
    return {
      success: false,
      message: `Fix attempt failed: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

function createMacOSSecurityBypass(): Record<string, string> {
  if (process.platform !== 'darwin') {
    return {};
  }

  return {
    // Disable macOS security warnings for development
    'PYTHONDONTWRITEBYTECODE': '1',
    'PYTHONUNBUFFERED': '1',

    // Bypass some macOS security restrictions
    'OBJC_DISABLE_INITIALIZE_FORK_SAFETY': 'YES',

    // Ensure proper locale
    'LC_ALL': 'en_US.UTF-8',
    'LANG': 'en_US.UTF-8',

    // Node.js specific
    'NODE_OPTIONS': '--max-old-space-size=4096',

    // Disable macOS quarantine for known safe operations
    'DISABLE_QUARANTINE': '1'
  };
}

// MCP Server Management Functions
async function connectMCPServer(serverId: string): Promise<boolean> {
  try {
    console.log(`🔌 Connecting to MCP server: ${serverId}`);

    // Load server configuration
    const mcpData = loadMCPServers();
    const server = mcpData.servers.find((s: MCPServerConfig) => s.id === serverId);

    if (!server) {
      console.error(`❌ Server ${serverId} not found in configuration`);
      return false;
    }

    if (!server.enabled) {
      console.log(`⏸️ Server ${serverId} is disabled, skipping connection`);
      return false;
    }

    // Check if already connected
    if (mcpConnections.has(serverId)) {
      console.log(`✅ Server ${serverId} already connected`);
      return true;
    }

    // Skip validation for npx commands since user confirmed they work
    let validation;
    if (server.command === 'npx' || server.command === 'npm') {
      console.log(`✅ Skipping validation for ${server.command} command (user confirmed it's in PATH)`);
      validation = { valid: true, fixedCommand: server.command };
    } else {
      // Validate and prepare command for macOS
      console.log(`🔍 Validating MCP server for macOS compatibility...`);
      validation = await validateMCPServerCommand(server);

      if (!validation.valid) {
        console.warn(`⚠️ Initial MCP server validation failed: ${validation.error}`);

        // Attempt macOS-specific fixes
        console.log(`🔧 Attempting macOS fixes...`);
        const fixResult = await attemptMacOSFixes(server);

        if (!fixResult.success) {
          console.error(`❌ MCP server fixes failed: ${fixResult.message}`);
          throw new Error(`Server validation and fixes failed: ${validation.error}. Suggestion: ${fixResult.message}`);
        }

        console.log(`✅ Applied macOS fixes: ${fixResult.message}`);

        // Re-validate after fixes
        const revalidation = await validateMCPServerCommand(server);
        if (!revalidation.valid) {
          throw new Error(`Server still invalid after fixes: ${revalidation.error}`);
        }
        validation = revalidation;
      }
    }

    const finalCommand = validation.fixedCommand || server.command;
    console.log(`🚀 Starting MCP server process: ${finalCommand} ${server.args?.join(' ') || ''}`);

    // Setup macOS-compatible environment
    const baseEnv = setupMacOSEnvironment(server.env || {});
    const mergedEnv = { ...process.env, ...baseEnv } as Record<string, string>;

    console.log(`🔧 macOS Environment setup:`, {
      command: finalCommand,
      args: server.args,
      pathEntries: mergedEnv.PATH?.split(':').length || 0,
      pythonPath: mergedEnv.PYTHONPATH || 'not set',
      platform: process.platform
    });

    const transport = new StdioClientTransport({
      command: finalCommand,
      args: server.args,
      env: mergedEnv
    });

    // Create client
    const client = new Client({
      name: 'littlellm-client',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      }
    });

    // Connect with timeout
    const connectPromise = client.connect(transport);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), 10000)
    );

    await Promise.race([connectPromise, timeoutPromise]);
    console.log(`✅ Connected to MCP server: ${serverId}`);

    // Discover capabilities with error handling
    let tools: { tools: unknown[] } = { tools: [] };
    let resources: { resources: unknown[] } = { resources: [] };
    let prompts: { prompts: unknown[] } = { prompts: [] };

    try {
      tools = await client.listTools();
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === -32601) {
        console.log(`ℹ️ Server ${serverId} does not support tools (method not found)`);
      } else {
        console.warn(`⚠️ Failed to list tools for ${serverId}:`, error);
      }
    }

    try {
      resources = await client.listResources();
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === -32601) {
        console.log(`ℹ️ Server ${serverId} does not support resources (method not found)`);
      } else {
        console.warn(`⚠️ Failed to list resources for ${serverId}:`, error);
      }
    }

    try {
      prompts = await client.listPrompts();
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === -32601) {
        console.log(`ℹ️ Server ${serverId} does not support prompts (method not found)`);
      } else {
        console.warn(`⚠️ Failed to list prompts for ${serverId}:`, error);
      }
    }

    const toolCount = tools.tools?.length || 0;
    const resourceCount = resources.resources?.length || 0;
    const promptCount = prompts.prompts?.length || 0;

    console.log(`🔍 [DEBUG] Server ${serverId} discovered capabilities:`);
    console.log(`🔍 [DEBUG] - Tools: ${toolCount}`, toolCount > 0 ? (tools.tools || []).map((t: any) => t.name) : []);
    console.log(`🔍 [DEBUG] - Resources: ${resourceCount}`);
    console.log(`🔍 [DEBUG] - Prompts: ${promptCount}`);

    const capabilities = [];
    if (toolCount > 0) capabilities.push(`${toolCount} tools`);
    if (resourceCount > 0) capabilities.push(`${resourceCount} resources`);
    if (promptCount > 0) capabilities.push(`${promptCount} prompts`);

    if (capabilities.length > 0) {
      console.log(`📋 Server ${serverId} capabilities: ${capabilities.join(', ')}`);
    } else {
      console.log(`📋 Server ${serverId} connected but provides no capabilities`);
    }

    // Store connection with error handling
    const connection: MCPConnection = {
      client,
      transport,
      server,
      tools: (tools.tools || []) as MCPTool[],
      resources: (resources.resources || []) as MCPResource[],
      prompts: (prompts.prompts || []) as MCPPrompt[],
      connected: true
    };

    // Monitor connection health
    // Note: MCP SDK doesn't expose direct error/close events,
    // so we'll rely on operation failures to detect disconnections

    mcpConnections.set(serverId, connection);

    // Notify main window of MCP server connection change
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mcp-server-connected', serverId);
    }

    return true;
  } catch (error) {
    console.error(`❌ Failed to connect to MCP server ${serverId}:`, error);

    // Provide macOS-specific troubleshooting information
    if (process.platform === 'darwin') {
      // Reload server config for troubleshooting
      const mcpData = loadMCPServers();
      const serverConfig = mcpData.servers.find((s: MCPServerConfig) => s.id === serverId);

      console.log(`\n🍎 macOS Troubleshooting for MCP server ${serverId}:`);
      if (serverConfig) {
        console.log(`1. Check if the command exists: which ${serverConfig.command}`);
        console.log(`2. Verify executable permissions: ls -la ${serverConfig.command}`);
        console.log(`3. Try running manually: ${serverConfig.command} ${serverConfig.args?.join(' ') || ''}`);
      }
      console.log(`4. Check if Gatekeeper is blocking: System Preferences > Security & Privacy`);
      console.log(`5. For Python servers, ensure Python is in PATH: echo $PATH`);
      console.log(`6. For npm packages, try: npm install -g <package-name>`);

      // Check common issues
      if (error instanceof Error) {
        if (error.message.includes('ENOENT')) {
          console.log(`❗ Command not found. Try installing with: brew install <package> or pip install <package>`);
        } else if (error.message.includes('EACCES')) {
          console.log(`❗ Permission denied. Try: chmod +x <command>`);
        } else if (error.message.includes('spawn')) {
          console.log(`❗ Process spawn failed. Check if the executable is signed or add to Security & Privacy exceptions`);
        }
      }
    }

    return false;
  }
}

async function disconnectMCPServer(serverId: string): Promise<void> {
  try {
    console.log(`🔌 Disconnecting MCP server: ${serverId}`);

    const connection = mcpConnections.get(serverId);
    if (!connection) {
      console.log(`⚠️ Server ${serverId} not connected`);
      return;
    }

    // Close client connection
    await connection.client.close();

    // Remove from connections map
    mcpConnections.delete(serverId);

    // Notify main window of MCP server disconnection
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mcp-server-disconnected', serverId);
    }

    console.log(`✅ Disconnected MCP server: ${serverId}`);
  } catch (error) {
    console.error(`❌ Failed to disconnect MCP server ${serverId}:`, error);
  }
}

async function disconnectAllMCPServers(): Promise<void> {
  console.log('🔌 Disconnecting all MCP servers...');

  const serverIds = Array.from(mcpConnections.keys());
  for (const serverId of serverIds) {
    await disconnectMCPServer(serverId);
  }

  console.log('✅ All MCP servers disconnected');
}

async function connectEnabledMCPServers(): Promise<void> {
  try {
    console.log('🔌 Auto-connecting enabled MCP servers...');

    const mcpData = loadMCPServers();
    console.log(`🔍 [DEBUG] Total servers in config: ${mcpData.servers.length}`);
    console.log(`🔍 [DEBUG] All servers:`, mcpData.servers.map(s => ({
      id: s.id,
      name: s.name,
      enabled: s.enabled,
      command: s.command
    })));

    const enabledServers = mcpData.servers.filter((server: MCPServerConfig) => server.enabled);
    console.log(`📋 Found ${enabledServers.length} enabled servers`);
    console.log(`🔍 [DEBUG] Enabled servers:`, enabledServers.map(s => ({
      id: s.id,
      name: s.name,
      command: s.command
    })));

    for (const server of enabledServers) {
      console.log(`🔌 [DEBUG] Attempting to connect server: ${server.id} (${server.name})`);
      try {
        const connected = await connectMCPServer(server.id);
        console.log(`🔌 [DEBUG] Server ${server.id} connection result: ${connected}`);
        if (!connected) {
          console.error(`❌ [DEBUG] Failed to connect server ${server.id} - connection returned false`);
        }
      } catch (error) {
        console.error(`❌ [DEBUG] Exception while connecting server ${server.id}:`, error);
      }
    }

    console.log('✅ Auto-connection complete');
    console.log(`🔍 [DEBUG] Final connection status:`, Array.from(mcpConnections.keys()));

    // Detailed status check
    const finalStatus = getMCPConnectionStatus();
    console.log(`🔍 [DEBUG] Detailed connection status:`, finalStatus);

    // Check for enabled servers that failed to connect
    const connectedIds = getConnectedMCPServerIds();
    const failedServers = enabledServers.filter(s => !connectedIds.includes(s.id));
    if (failedServers.length > 0) {
      console.error(`❌ [DEBUG] ${failedServers.length} enabled servers failed to connect:`,
        failedServers.map(s => ({ id: s.id, name: s.name, command: s.command })));
    }
  } catch (error) {
    console.error('❌ Failed to auto-connect enabled MCP servers:', error);
  }
}

// MCP Tool Management Functions
async function callMCPTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
  try {
    console.log(`🔧 Calling MCP tool: ${toolName} with args:`, args);

    // Find the tool in connected servers
    let targetConnection: MCPConnection | null = null;
    let targetTool: MCPTool | null = null;

    for (const [, connection] of mcpConnections) {
      if (!connection.connected) continue;

      const tool = connection.tools.find(t => t.name === toolName);
      if (tool) {
        targetConnection = connection;
        targetTool = tool;
        break;
      }
    }

    if (!targetConnection || !targetTool) {
      throw new Error(`Tool "${toolName}" not found in any connected MCP server`);
    }

    console.log(`🎯 Found tool "${toolName}" in server, executing...`);

    // Execute the tool
    const result = await targetConnection.client.callTool({
      name: toolName,
      arguments: args
    });

    console.log(`✅ Tool "${toolName}" executed successfully`);
    return result;
  } catch (error) {
    console.error(`❌ Failed to call MCP tool "${toolName}":`, error);
    throw error;
  }
}

// Enhanced concurrent tool execution
async function callMultipleMCPTools(toolCalls: Array<{
  name: string;
  args: Record<string, unknown>;
  id?: string;
}>): Promise<Array<{
  id?: string;
  name: string;
  result: unknown;
  success: boolean;
  error?: string;
  executionTime: number;
}>> {
  console.log(`🚀 Executing ${toolCalls.length} MCP tools concurrently`);

  const startTime = Date.now();

  // Create a map of tools to their target connections for optimization
  const toolConnectionMap = new Map<string, MCPConnection>();

  // Pre-resolve all tool connections
  for (const toolCall of toolCalls) {
    let targetConnection: MCPConnection | null = null;

    for (const [, connection] of mcpConnections) {
      if (!connection.connected) continue;

      const tool = connection.tools.find(t => t.name === toolCall.name);
      if (tool) {
        targetConnection = connection;
        break;
      }
    }

    if (targetConnection) {
      toolConnectionMap.set(toolCall.name, targetConnection);
    }
  }

  // Execute all tools in parallel
  const toolPromises = toolCalls.map(async (toolCall) => {
    const toolStartTime = Date.now();

    try {
      const connection = toolConnectionMap.get(toolCall.name);
      if (!connection) {
        throw new Error(`Tool "${toolCall.name}" not found in any connected MCP server`);
      }

      console.log(`🔧 [Concurrent] Executing ${toolCall.name}`);

      const result = await connection.client.callTool({
        name: toolCall.name,
        arguments: toolCall.args
      });

      const executionTime = Date.now() - toolStartTime;
      console.log(`✅ [Concurrent] ${toolCall.name} completed in ${executionTime}ms`);

      return {
        id: toolCall.id,
        name: toolCall.name,
        result,
        success: true,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - toolStartTime;
      console.error(`❌ [Concurrent] ${toolCall.name} failed after ${executionTime}ms:`, error);

      return {
        id: toolCall.id,
        name: toolCall.name,
        result: null,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        executionTime
      };
    }
  });

  const results = await Promise.allSettled(toolPromises);
  const totalTime = Date.now() - startTime;

  // Process results
  const processedResults = results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        id: toolCalls[index].id,
        name: toolCalls[index].name,
        result: null,
        success: false,
        error: `Promise execution failed: ${result.reason}`,
        executionTime: 0
      };
    }
  });

  const successCount = processedResults.filter(r => r.success).length;
  console.log(`🏁 Concurrent MCP execution completed in ${totalTime}ms: ${successCount}/${toolCalls.length} successful`);

  return processedResults;
}

function getAllMCPTools(): (MCPTool & { serverId: string })[] {
  const allTools: (MCPTool & { serverId: string })[] = [];

  console.log(`🔍 [DEBUG] getAllMCPTools called - checking ${mcpConnections.size} total connections`);

  for (const [serverId, connection] of mcpConnections) {
    console.log(`🔍 [DEBUG] Server ${serverId}: connected=${connection.connected}, tools=${connection.tools.length}`);

    if (!connection.connected) {
      console.log(`⏸️ [DEBUG] Skipping disconnected server: ${serverId}`);
      continue;
    }

    console.log(`🔧 [DEBUG] Processing ${connection.tools.length} tools from server ${serverId}:`,
      connection.tools.map(t => t.name));

    for (const tool of connection.tools) {
      allTools.push({
        ...tool,
        serverId
      });
    }
  }

  console.log(`📋 [DEBUG] Final result: ${allTools.length} tools from ${mcpConnections.size} total servers`);
  console.log(`🔍 [DEBUG] Tools by server:`, Array.from(mcpConnections.entries()).map(([serverId, conn]) => ({
    serverId,
    connected: conn.connected,
    toolCount: conn.tools.length,
    toolNames: conn.tools.map(t => t.name)
  })));

  console.log(`📋 Retrieved ${allTools.length} tools from ${mcpConnections.size} connected servers`);
  console.log(`🔍 Tool details:`, allTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    hasInputSchema: !!tool.inputSchema,
    inputSchema: tool.inputSchema,
    serverId: tool.serverId
  })));
  return allTools;
}

function getMCPConnectionStatus(): Record<string, boolean> {
  const status: Record<string, boolean> = {};

  for (const [serverId, connection] of mcpConnections) {
    status[serverId] = connection.connected;
  }

  return status;
}

interface MCPDetailedStatus {
  totalServers: number;
  connectedServers: number;
  servers: Array<{
    id: string;
    connected: boolean;
    toolCount: number;
    resourceCount: number;
    promptCount: number;
    tools: Array<{ name: string; description?: string }>;
    hasProcess: boolean;
  }>;
}

interface Conversation {
  id: string;
  title?: string;
  updatedAt: string;
  messages?: Array<{ role: string; content: string }>;
}

interface AppSettings {
  shortcuts?: {
    toggleWindow?: string;
    processClipboard?: string;
    actionMenu?: string;
    openShortcuts?: string;
  };
  ui?: {
    alwaysOnTop?: boolean;
    startMinimized?: boolean;
  };
  [key: string]: unknown;
}

function getMCPDetailedStatus(): MCPDetailedStatus {
  const status: MCPDetailedStatus = {
    totalServers: mcpConnections.size,
    connectedServers: 0,
    servers: []
  };

  for (const [serverId, connection] of mcpConnections) {
    if (connection.connected) {
      status.connectedServers++;
    }

    status.servers.push({
      id: serverId,
      connected: connection.connected,
      toolCount: connection.tools.length,
      resourceCount: connection.resources.length,
      promptCount: connection.prompts.length,
      tools: connection.tools.map(t => ({ name: t.name, description: t.description })),
      hasProcess: !!connection.process
    });
  }

  return status;
}

function getConnectedMCPServerIds(): string[] {
  return Array.from(mcpConnections.keys()).filter(serverId =>
    mcpConnections.get(serverId)?.connected
  );
}

// MCP Resource Management Functions
async function readMCPResource(uri: string): Promise<unknown> {
  try {
    console.log(`📄 Reading MCP resource: ${uri}`);

    // Find the resource in connected servers
    let targetConnection: MCPConnection | null = null;
    let targetResource: MCPResource | null = null;

    for (const [, connection] of mcpConnections) {
      if (!connection.connected) continue;

      const resource = connection.resources.find(r => r.uri === uri);
      if (resource) {
        targetConnection = connection;
        targetResource = resource;
        break;
      }
    }

    if (!targetConnection || !targetResource) {
      throw new Error(`Resource "${uri}" not found in any connected MCP server`);
    }

    console.log(`🎯 Found resource "${uri}" in server, reading...`);

    // Read the resource
    const result = await targetConnection.client.readResource({ uri });

    console.log(`✅ Resource "${uri}" read successfully`);
    return result;
  } catch (error) {
    console.error(`❌ Failed to read MCP resource "${uri}":`, error);
    throw error;
  }
}

function getAllMCPResources(): (MCPResource & { serverId: string })[] {
  const allResources: (MCPResource & { serverId: string })[] = [];

  for (const [serverId, connection] of mcpConnections) {
    if (!connection.connected) continue;

    for (const resource of connection.resources) {
      allResources.push({
        ...resource,
        serverId
      });
    }
  }

  console.log(`📋 Retrieved ${allResources.length} resources from ${mcpConnections.size} connected servers`);
  return allResources;
}

// MCP Prompt Management Functions
async function getMCPPrompt(name: string, args: Record<string, string>): Promise<unknown> {
  try {
    console.log(`📝 Getting MCP prompt: ${name} with args:`, args);

    // Find the prompt in connected servers
    let targetConnection: MCPConnection | null = null;
    let targetPrompt: MCPPrompt | null = null;

    for (const [, connection] of mcpConnections) {
      if (!connection.connected) continue;

      const prompt = connection.prompts.find(p => p.name === name);
      if (prompt) {
        targetConnection = connection;
        targetPrompt = prompt;
        break;
      }
    }

    if (!targetConnection || !targetPrompt) {
      throw new Error(`Prompt "${name}" not found in any connected MCP server`);
    }

    console.log(`🎯 Found prompt "${name}" in server, getting...`);

    // Get the prompt
    const result = await targetConnection.client.getPrompt({
      name,
      arguments: args
    });

    console.log(`✅ Prompt "${name}" retrieved successfully`);
    return result;
  } catch (error) {
    console.error(`❌ Failed to get MCP prompt "${name}":`, error);
    throw error;
  }
}

function getAllMCPPrompts(): (MCPPrompt & { serverId: string })[] {
  const allPrompts: (MCPPrompt & { serverId: string })[] = [];

  for (const [serverId, connection] of mcpConnections) {
    if (!connection.connected) continue;

    for (const prompt of connection.prompts) {
      allPrompts.push({
        ...prompt,
        serverId
      });
    }
  }

  console.log(`📋 Retrieved ${allPrompts.length} prompts from ${mcpConnections.size} connected servers`);
  return allPrompts;
}


// More reliable way to detect production vs development
const isProduction = app.isPackaged || process.env.NODE_ENV === 'production';



// Function to get the correct icon path for different environments
function getIconPath(): string {
  // Use platform-appropriate icon format
  const iconFile = process.platform === 'win32' ? 'icon.ico' : 'icon.png';

  const possiblePaths = [
    path.join(__dirname, '../assets', iconFile),
    path.join(__dirname, '../../assets', iconFile),
    path.join(process.resourcesPath, 'assets', iconFile),
    path.join(app.getAppPath(), 'assets', iconFile),
  ];

  for (const iconPath of possiblePaths) {
    if (fs.existsSync(iconPath)) {
      console.log('Using icon path:', iconPath);
      return iconPath;
    }
  }

  console.warn('Icon file not found, using default');
  return path.join(__dirname, '../assets', iconFile); // fallback
}

// Function to detect available Next.js port
async function detectNextJSPort(): Promise<number> {
  const portsToTry = [3000, 3001, 3002, 3003, 3004, 3005];

  for (const port of portsToTry) {
    try {
      const response = await new Promise<boolean>((resolve) => {
        const req = http.get(`http://localhost:${port}`, (res) => {
          console.log(`Checking port ${port}: status ${res.statusCode}, headers:`, res.headers);
          // Check if this looks like a Next.js server
          const isNextJS = res.headers['x-powered-by']?.includes('Next.js') ||
                          res.statusCode === 200;
          resolve(isNextJS);
        });

        req.on('error', (err) => {
          console.log(`Port ${port} error:`, err.message);
          resolve(false);
        });
        req.setTimeout(2000, () => {
          req.destroy();
          console.log(`Port ${port} timeout`);
          resolve(false);
        });
      });

      if (response) {
        console.log(`✓ Found Next.js server on port ${port}`);
        return port;
      }
    } catch (error) {
      console.log(`Port ${port} exception:`, error);
      // Continue to next port
    }
  }

  // Default to 3000 if no server found (standard Next.js port)
  console.log('No Next.js server found, defaulting to port 3000');
  return 3000;
}

async function createStaticServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      let filePath: string;
      let urlPath = req.url.startsWith('/') ? req.url.slice(1) : req.url;

      // Remove query parameters
      const queryIndex = urlPath.indexOf('?');
      if (queryIndex !== -1) {
        urlPath = urlPath.substring(0, queryIndex);
      }

      // Default to index.html for root requests
      if (urlPath === '' || urlPath === '/') {
        urlPath = 'index.html';
      }

      if (isProduction) {
        filePath = path.join(process.resourcesPath, 'out', urlPath);
      } else {
        filePath = path.join(__dirname, '..', 'out', urlPath);
      }

      console.log('Static server request:', req.url, '-> ', filePath);

      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const mimeType = mime.lookup(filePath) || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': mimeType,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        fs.createReadStream(filePath).pipe(res);
      } else {
        console.log('File not found:', filePath);
        res.writeHead(404);
        res.end('Not found');
      }
    });

    // Try ports starting from 3001
    const tryPort = (port: number) => {
      server.listen(port, 'localhost', () => {
        console.log(`Static server running on http://localhost:${port}`);
        resolve(port);
      });

      server.on('error', (err: { code?: string }) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${port} is busy, trying ${port + 1}...`);
          server.removeAllListeners('error');
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
    };

    tryPort(3001);
  });
}

// Register custom scheme as privileged
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

let mainWindow: BrowserWindow | null = null;
let actionMenuWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let chatWindow: BrowserWindow | null = null;
let dropdownWindow: BrowserWindow | null = null;
let historyWindow: BrowserWindow | null = null;

// State tracking for window visibility before global hide
let chatWindowWasVisible = false;
let tray: Tray | null = null;
let staticServerPort: number = 3001;
let isQuitting = false;

// Global function to open settings overlay with optional tab
async function openSettingsOverlay(tab?: string) {
  if (!mainWindow) return;

  if (settingsWindow) {
    settingsWindow.focus();
    // Send tab change message if tab is specified
    if (tab) {
      settingsWindow.webContents.send('change-settings-tab', tab);
    }
    return;
  }

  // Calculate position using multi-monitor aware utility
  const windowWidth = 800;
  const windowHeight = 600;
  const { x, y } = calculateWindowPosition({
    width: windowWidth,
    height: windowHeight,
    preferredPosition: 'center',
    offsetY: 50
  });

  settingsWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: x,
    y: y,
    show: false,
    frame: false, // Remove native frame completely
    resizable: true, // Allow resizing
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: false,
    titleBarStyle: 'hidden', // Hide title bar completely
    title: 'LittleLLM - Settings',
    autoHideMenuBar: true, // Hide menu bar
    backgroundColor: '#1a1a1a',
    roundedCorners: true, // Enable rounded corners on the Electron window panel (macOS/Windows)
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });

  // Load the settings overlay URL
  let startUrl: string;
  if (process.env.NODE_ENV === 'production') {
    startUrl = `file://${path.join(__dirname, '../out/index.html')}`;
  } else {
    const detectedPort = await detectNextJSPort();
    startUrl = `http://localhost:${detectedPort}`;
  }
  const settingsUrl = `${startUrl}?overlay=settings${tab ? `&tab=${tab}` : ''}`;
  settingsWindow.loadURL(settingsUrl);

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  settingsWindow.once('ready-to-show', () => {
    settingsWindow?.show();
    settingsWindow?.focus();
  });
}

// Global function to open action menu
async function openActionMenu() {
  if (!mainWindow) return;

  if (actionMenuWindow) {
    actionMenuWindow.focus();
    return;
  }

  // Calculate position using multi-monitor aware utility
  const windowWidth = 600;
  const windowHeight = 400;
  const { x, y } = calculateWindowPosition({
    width: windowWidth,
    height: windowHeight,
    preferredPosition: 'center',
    offsetY: 50
  });

  actionMenuWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: x,
    y: y,
    show: false,
    frame: false, // Remove native frame completely
    resizable: true, // Allow resizing
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: false,
    titleBarStyle: 'hidden', // Hide title bar completely
    title: 'LittleLLM - Quick Actions',
    autoHideMenuBar: true, // Hide menu bar
    backgroundColor: '#1a1a1a',
    roundedCorners: true, // Enable rounded corners on the Electron window panel (macOS/Windows)
    hasShadow: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // Allow localhost connections for LM Studio, Ollama, etc.
    },
  });

  let startUrl: string;
  if (isProduction) {
    startUrl = `http://localhost:${staticServerPort}`;
  } else {
    const detectedPort = await detectNextJSPort();
    startUrl = `http://localhost:${detectedPort}`;
  }
  const actionMenuUrl = `${startUrl}?overlay=action-menu`;
  actionMenuWindow.loadURL(actionMenuUrl);

  actionMenuWindow.on('blur', () => {
    if (actionMenuWindow) {
      actionMenuWindow.hide();
    }
  });

  actionMenuWindow.on('closed', () => {
    actionMenuWindow = null;
  });

  actionMenuWindow.once('ready-to-show', () => {
    actionMenuWindow?.show();
    actionMenuWindow?.focus();
  });
}

// Use simple JSON file storage instead of electron-store to avoid nesting issues
const settingsPath = path.join(app.getPath('userData'), 'voila-settings.json');
const mcpServersPath = path.join(app.getPath('userData'), 'mcp.json');

function loadAppSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      const settings = JSON.parse(data);

      // Ensure the settings have the expected structure
      if (!settings.chat) {
        settings.chat = {};
      }
      if (!settings.chat.providers) {
        settings.chat.providers = {
          openai: { apiKey: '', lastSelectedModel: '' },
          anthropic: { apiKey: '', lastSelectedModel: '' },
          gemini: { apiKey: '', lastSelectedModel: '' },
          mistral: { apiKey: '', lastSelectedModel: '' },
          deepseek: { apiKey: '', lastSelectedModel: '' },
          lmstudio: { apiKey: '', baseUrl: 'http://localhost:1234/v1', lastSelectedModel: '' },
          ollama: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
          openrouter: { apiKey: '', lastSelectedModel: '' },
          requesty: { apiKey: '', lastSelectedModel: '' },
          replicate: { apiKey: '', lastSelectedModel: '' },
          n8n: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
        };
      }

      return settings;
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }

  // Return default structure when no settings file exists
  return {
    chat: {
      provider: '',
      model: '',
      temperature: 0.3,
      maxTokens: 8192,
      systemPrompt: '',
      providers: {
        openai: { apiKey: '', lastSelectedModel: '' },
        anthropic: { apiKey: '', lastSelectedModel: '' },
        gemini: { apiKey: '', lastSelectedModel: '' },
        mistral: { apiKey: '', lastSelectedModel: '' },
        deepseek: { apiKey: '', lastSelectedModel: '' },
        lmstudio: { apiKey: '', baseUrl: 'http://localhost:1234/v1', lastSelectedModel: '' },
        ollama: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
        openrouter: { apiKey: '', lastSelectedModel: '' },
        requesty: { apiKey: '', lastSelectedModel: '' },
        replicate: { apiKey: '', lastSelectedModel: '' },
        n8n: { apiKey: '', baseUrl: '', lastSelectedModel: '' },
      },
    },
    ui: {
      theme: 'system',
      alwaysOnTop: true,
      startMinimized: false,

      fontSize: 'small',
      windowBounds: {
        width: 400,
        height: 615, // Increased by 15px for draggable header
        x: undefined, // Let Electron choose initial position
        y: undefined, // Let Electron choose initial position
      },
    },
    shortcuts: {
      toggleWindow: 'CommandOrControl+Shift+L',
      processClipboard: 'CommandOrControl+Shift+V',
      actionMenu: 'CommandOrControl+Shift+Space',
      openShortcuts: 'CommandOrControl+Shift+K',
    },
    general: {
      autoStartWithSystem: false,
      showNotifications: true,
      saveConversationHistory: true,
      conversationHistoryLength: 10,
    },
  };
}

function saveAppSettings(settings: Record<string, unknown>) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    return false;
  }
}

function loadMCPServers(): MCPData {
  try {
    if (fs.existsSync(mcpServersPath)) {
      const data = fs.readFileSync(mcpServersPath, 'utf8');
      const mcpData = JSON.parse(data);

      // Ensure the structure has the expected format
      if (!mcpData.servers) {
        mcpData.servers = [];
      }

      return mcpData;
    }
  } catch (error) {
    console.error('Failed to load MCP servers:', error);
  }

  // Return default structure when no MCP file exists
  return {
    servers: [],
    version: '1.0.0'
  };
}

function saveMCPServers(mcpData: MCPData) {
  try {
    fs.writeFileSync(mcpServersPath, JSON.stringify(mcpData, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save MCP servers:', error);
    return false;
  }
}



async function createWindow() {
  const appSettings = loadAppSettings();
  const bounds = appSettings.ui?.windowBounds || { width: 570, height: 157 }; // Increased by 15px for draggable header

  // Prepare window options with size
  const windowOptions: BrowserWindowConstructorOptions = {
    width: Math.max(bounds.width, 350), // Ensure minimum width for all UI elements
    height: Math.max(bounds.height, 157), // Increased by 15px for draggable header
    minWidth: 350, // Ensure all bottom toolbar buttons are visible (calculated from UI elements)
    minHeight: 157, // Increased by 15px for draggable header
    maxWidth: 1400,
    maxHeight: 1000,
    show: !appSettings.ui?.startMinimized,
    alwaysOnTop: appSettings.ui?.alwaysOnTop !== false, // Default to true if not set
    frame: false, // Remove traditional frame completely for Windows
    resizable: true, // Enable resizing
    skipTaskbar: true, // Show in taskbar
    autoHideMenuBar: true, // Hide menu bar
    titleBarStyle: 'hidden', // Hide title bar completely
    transparent: false, // Keep solid background for better compatibility
    backgroundColor: '#1e1e1e', // VS Code background
    roundedCorners: true, // Enable rounded corners on the Electron window panel (macOS/Windows)
    hasShadow: false, // Disable shadow to help with rounded corners
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // Allow localhost connections for LM Studio, Ollama, etc.
      allowRunningInsecureContent: true, // Allow localhost connections
      partition: 'persist:littlellm', // Enable localStorage and persistent storage
      zoomFactor: 1.0,
      disableBlinkFeatures: 'Auxclick',
    },
    icon: getIconPath(),
  };

  // Add saved position if available
  if (bounds.x !== undefined && bounds.y !== undefined) {
    windowOptions.x = bounds.x;
    windowOptions.y = bounds.y;
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Load the app with automatic port detection
  let startUrl: string;
  if (isProduction) {
    // Start local HTTP server for static files
    staticServerPort = await createStaticServer();
    startUrl = `http://localhost:${staticServerPort}`;
  } else {
    // Detect the Next.js port automatically
    const detectedPort = await detectNextJSPort();
    startUrl = `http://localhost:${detectedPort}`;
  }

  console.log('isProduction:', isProduction);
  console.log('app.isPackaged:', app.isPackaged);
  console.log('Loading URL:', startUrl);
  console.log('__dirname:', __dirname);
  console.log('process.resourcesPath:', process.resourcesPath);
  console.log('Resolved path:', path.join(process.resourcesPath, 'out', 'index.html'));



  // Ensure icon is properly set for Windows taskbar
  if (process.platform === 'win32') {
    const iconPath = getIconPath();
    if (fs.existsSync(iconPath)) {
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        mainWindow.setIcon(icon);
        app.setAppUserModelId('com.littlellm.app'); // Set app ID for Windows taskbar grouping
      }
    }
  }

  console.log('About to load URL:', startUrl);

  // Note: Rounded corners are now handled by Electron's roundedCorners option + CSS for content

  mainWindow.loadURL(startUrl).then(() => {
    console.log('Successfully loaded URL');

    // Prevent zoom changes to avoid scaling issues
    if (mainWindow) {
      mainWindow.webContents.setZoomFactor(1.0);
      mainWindow.webContents.on('zoom-changed', () => {
        mainWindow?.webContents.setZoomFactor(1.0);
      });
    }

    // Hide scrollbars globally after page loads
    mainWindow?.webContents.executeJavaScript(`
      // Inject CSS to hide all scrollbars
      const style = document.createElement('style');
      style.textContent = \`
        /* Hide all scrollbars globally */
        ::-webkit-scrollbar {
          display: none !important;
          width: 0 !important;
          height: 0 !important;
          background: transparent !important;
        }

        ::-webkit-scrollbar-track {
          display: none !important;
        }

        ::-webkit-scrollbar-thumb {
          display: none !important;
        }

        * {
          scrollbar-width: none !important;
          -ms-overflow-style: none !important;
        }

        /* Ensure scrolling still works */
        html, body {
          overflow-y: auto !important;
          overflow-x: hidden !important;
        }
      \`;
      document.head.appendChild(style);
    `);
  }).catch((error) => {
    console.error('Failed to load URL:', error);
  });

  // Add error handling for failed loads
  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load page:', errorCode, errorDescription, validatedURL);
  });

  // Only open DevTools in development mode (detached for transparency)
  if (!isProduction) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Handle window events
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Save window bounds when resized or moved
  const saveWindowBounds = () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      const currentSettings = loadAppSettings();
      const updatedSettings = {
        ...currentSettings,
        ui: {
          ...currentSettings.ui,
          windowBounds: {
            width: bounds.width,
            height: bounds.height,
            x: bounds.x,
            y: bounds.y
          }
        }
      };
      saveAppSettings(updatedSettings);
    }
  };

  mainWindow.on('resize', saveWindowBounds);
  mainWindow.on('move', saveWindowBounds);



  // Handle window show/hide
  mainWindow.on('show', () => {
    // Note: setHighlightMode was removed in newer Electron versions
    // Tray highlighting is now handled automatically by the system
  });

  mainWindow.on('hide', () => {
    // Note: setHighlightMode was removed in newer Electron versions
    // Tray highlighting is now handled automatically by the system
  });
}

function createTray() {
  // Create tray icon using our custom icon
  const trayIconPath = getIconPath();
  let trayIcon;

  try {
    trayIcon = nativeImage.createFromPath(trayIconPath);
    if (trayIcon.isEmpty()) {
      console.log('Tray icon is empty, using default');
      trayIcon = nativeImage.createEmpty();
    }
  } catch (error) {
    console.log('Error loading tray icon:', error);
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show LittleLLM',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow().catch(console.error);
        }
      }
    },
    {
      label: 'Read Clipboard',
      click: () => {
        const clipboardText = clipboard.readText();
        if (mainWindow) {
          mainWindow.webContents.send('clipboard-content', clipboardText);
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Settings',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('open-settings');
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip('LittleLLM - AI Assistant');

  // Double-click to show window
  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow().catch(console.error);
    }
  });
}

function registerGlobalShortcuts() {
  // Get shortcut from the new app settings store
  const appSettings = loadAppSettings();
  const shortcut = appSettings.shortcuts?.toggleWindow || 'CommandOrControl+\\';

  console.log('Registering global shortcut:', shortcut);

  // Register the main shortcut to toggle ALL windows
  globalShortcut.register(shortcut, () => {
    console.log('Global shortcut triggered:', shortcut);

    // Check if any window is visible and focused
    const anyWindowVisible = (mainWindow && mainWindow.isVisible()) ||
                            (chatWindow && chatWindow.isVisible()) ||
                            (settingsWindow && settingsWindow.isVisible()) ||
                            (actionMenuWindow && actionMenuWindow.isVisible()) ||
                            (dropdownWindow && dropdownWindow.isVisible());

    const anyWindowFocused = (mainWindow && mainWindow.isFocused()) ||
                           (chatWindow && chatWindow.isFocused()) ||
                           (settingsWindow && settingsWindow.isFocused()) ||
                           (actionMenuWindow && actionMenuWindow.isFocused()) ||
                           (dropdownWindow && dropdownWindow.isFocused());

    if (anyWindowVisible && anyWindowFocused) {
      // Hide ALL windows and track chat window state
      console.log('Hiding all application windows');

      // Track if chat window was visible before hiding
      chatWindowWasVisible = !!(chatWindow && chatWindow.isVisible());

      if (mainWindow && mainWindow.isVisible()) mainWindow.hide();
      if (chatWindow && chatWindow.isVisible()) chatWindow.hide();
      if (settingsWindow && settingsWindow.isVisible()) settingsWindow.hide();
      if (actionMenuWindow && actionMenuWindow.isVisible()) actionMenuWindow.hide();
      if (dropdownWindow && dropdownWindow.isVisible()) dropdownWindow.hide();
    } else {
      // Show main window (and restore other windows if they were open)
      console.log('Showing application windows');
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow().catch(console.error);
      }

      // Restore chat window if it was visible before hiding
      if (chatWindowWasVisible && chatWindow) {
        console.log('Restoring chat window that was previously visible');
        chatWindow.show();
        chatWindow.focus();
        // Reset the tracking state
        chatWindowWasVisible = false;
      }
    }
  });

  // Register shortcut for clipboard processing
  const clipboardShortcut = appSettings.shortcuts?.processClipboard || 'CommandOrControl+Shift+\\';
  globalShortcut.register(clipboardShortcut, () => {
    console.log('Clipboard shortcut triggered:', clipboardShortcut);
    const clipboardText = clipboard.readText();
    if (clipboardText) {
      if (mainWindow) {
        mainWindow.webContents.send('process-clipboard', clipboardText);
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow().then(() => {
          // Wait for window to be ready then send clipboard content
          setTimeout(() => {
            if (mainWindow) {
              mainWindow.webContents.send('process-clipboard', clipboardText);
            }
          }, 1000);
        }).catch(console.error);
      }
    }
  });

  // Register shortcut for action menu
  const actionMenuShortcut = appSettings.shortcuts?.actionMenu || 'CommandOrControl+Shift+Space';
  globalShortcut.register(actionMenuShortcut, async () => {
    console.log('Action menu shortcut triggered:', actionMenuShortcut);
    if (mainWindow) {
      // Show main window first if hidden
      if (!mainWindow.isVisible()) {
        mainWindow.show();
        mainWindow.focus();
      }
      // Open action menu using the global function
      await openActionMenu();
    }
  });

  // Register shortcut for opening shortcuts settings
  const shortcutsSettingsShortcut = appSettings.shortcuts?.openShortcuts || 'CommandOrControl+Shift+K';
  globalShortcut.register(shortcutsSettingsShortcut, async () => {
    console.log('Shortcuts settings shortcut triggered:', shortcutsSettingsShortcut);
    if (mainWindow) {
      // Show main window first if hidden
      if (!mainWindow.isVisible()) {
        mainWindow.show();
        mainWindow.focus();
      }
      // Open settings overlay directly to shortcuts tab
      await openSettingsOverlay('shortcuts');
    }
  });
}

// Disable GPU acceleration to prevent crashes
app.disableHardwareAcceleration();

// Add command line switches for better compatibility
app.commandLine.appendSwitch('--disable-gpu');
app.commandLine.appendSwitch('--disable-gpu-sandbox');
app.commandLine.appendSwitch('--disable-software-rasterizer');
app.commandLine.appendSwitch('--no-sandbox');

// Disable hardware acceleration for better transparency support
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  await createWindow();
  createTray();
  registerGlobalShortcuts();

  // Set up IPC handlers
  setupIPC();

  // Auto-connect enabled MCP servers immediately
  try {
    await connectEnabledMCPServers();
  } catch (error) {
    console.error('Failed to auto-connect MCP servers on startup:', error);
  }
});

function setupIPC() {
  // Handle clipboard read requests from renderer
  ipcMain.handle('read-clipboard', () => {
    return clipboard.readText();
  });

  // Handle clipboard write requests from renderer
  ipcMain.handle('write-clipboard', (_, text: string) => {
    clipboard.writeText(text);
  });

  // Handle settings updates
  ipcMain.handle('get-settings', () => {
    return loadAppSettings();
  });

  // Removed old update-settings handler to prevent conflicts with update-app-settings

  // Handle app settings
  ipcMain.handle('get-app-settings', () => {
    const settings = loadAppSettings();
    console.log('get-app-settings called, returning:', settings);
    return settings;
  });

  ipcMain.handle('update-app-settings', (_, settings: AppSettings) => {
    try {
      console.log('update-app-settings called, received:', settings);

      // Clean settings to avoid nested structures
      const cleanSettings = { ...settings };
      delete cleanSettings['app-settings']; // Remove any nested app-settings key

      // Handle shortcut updates
      if (cleanSettings.shortcuts && cleanSettings.shortcuts.toggleWindow) {
        const currentSettings = loadAppSettings();
        const currentShortcut = currentSettings.shortcuts?.toggleWindow || 'CommandOrControl+\\';
        const newShortcut = cleanSettings.shortcuts.toggleWindow;

        if (newShortcut !== currentShortcut) {
          console.log('Updating shortcut from', currentShortcut, 'to', newShortcut);

          // Unregister old shortcut
          globalShortcut.unregister(currentShortcut);

          // Register new shortcut
          globalShortcut.register(newShortcut, () => {
            console.log('New shortcut triggered:', newShortcut);
            if (mainWindow) {
              if (mainWindow.isVisible() && mainWindow.isFocused()) {
                mainWindow.hide();
              } else {
                mainWindow.show();
                mainWindow.focus();
              }
            } else {
              createWindow().catch(console.error);
            }
          });
        }
      }

      // Handle action menu shortcut updates
      if (cleanSettings.shortcuts && cleanSettings.shortcuts.actionMenu) {
        const currentSettings = loadAppSettings();
        const currentActionMenuShortcut = currentSettings.shortcuts?.actionMenu || 'CommandOrControl+Shift+Space';
        const newActionMenuShortcut = cleanSettings.shortcuts.actionMenu;

        if (newActionMenuShortcut !== currentActionMenuShortcut) {
          console.log('Updating action menu shortcut from', currentActionMenuShortcut, 'to', newActionMenuShortcut);

          // Unregister old shortcut
          globalShortcut.unregister(currentActionMenuShortcut);

          // Register new shortcut
          globalShortcut.register(newActionMenuShortcut, async () => {
            console.log('New action menu shortcut triggered:', newActionMenuShortcut);
            if (mainWindow) {
              // Show main window first if hidden
              if (!mainWindow.isVisible()) {
                mainWindow.show();
                mainWindow.focus();
              }
              // Open action menu
              await openActionMenu();
            }
          });
        }
      }

      // Handle open shortcuts shortcut updates
      if (cleanSettings.shortcuts && cleanSettings.shortcuts.openShortcuts) {
        const currentSettings = loadAppSettings();
        const currentOpenShortcutsShortcut = currentSettings.shortcuts?.openShortcuts || 'CommandOrControl+Shift+K';
        const newOpenShortcutsShortcut = cleanSettings.shortcuts.openShortcuts;

        if (newOpenShortcutsShortcut !== currentOpenShortcutsShortcut) {
          console.log('Updating open shortcuts shortcut from', currentOpenShortcutsShortcut, 'to', newOpenShortcutsShortcut);

          // Unregister old shortcut
          globalShortcut.unregister(currentOpenShortcutsShortcut);

          // Register new shortcut
          globalShortcut.register(newOpenShortcutsShortcut, async () => {
            console.log('New open shortcuts shortcut triggered:', newOpenShortcutsShortcut);
            if (mainWindow) {
              // Show main window first if hidden
              if (!mainWindow.isVisible()) {
                mainWindow.show();
                mainWindow.focus();
              }
              // Open settings overlay directly to shortcuts tab
              await openSettingsOverlay('shortcuts');
            }
          });
        }
      }

      // Handle UI settings
      if (cleanSettings.ui && mainWindow) {
        if (cleanSettings.ui.alwaysOnTop !== undefined) {
          mainWindow.setAlwaysOnTop(cleanSettings.ui.alwaysOnTop);
        }

      }

      const success = saveAppSettings(cleanSettings);
      console.log('App settings updated in store:', cleanSettings);
      return success;
    } catch (error) {
      console.error('Failed to update app settings:', error);
      return false;
    }
  });

  // Handle storage operations (alternative to localStorage)
  ipcMain.handle('get-storage-item', (_, key: string) => {
    try {
      const settings = loadAppSettings();
      return settings[key];
    } catch (error) {
      console.error('Failed to get storage item:', error);
      return null;
    }
  });

  ipcMain.handle('set-storage-item', (_, key: string, value: unknown) => {
    try {
      const settings = loadAppSettings();
      settings[key] = value;
      return saveAppSettings(settings);
    } catch (error) {
      console.error('Failed to set storage item:', error);
      return false;
    }
  });

  ipcMain.handle('remove-storage-item', (_, key: string) => {
    try {
      const settings = loadAppSettings();
      delete settings[key];
      return saveAppSettings(settings);
    } catch (error) {
      console.error('Failed to remove storage item:', error);
      return false;
    }
  });

  // Handle MCP servers operations
  ipcMain.handle('get-mcp-servers', () => {
    try {
      const mcpData = loadMCPServers();
      console.log('get-mcp-servers called, returning:', mcpData);
      return mcpData;
    } catch (error) {
      console.error('Failed to get MCP servers:', error);
      return { servers: [], version: '1.0.0' };
    }
  });

  ipcMain.handle('save-mcp-servers', (_, mcpData: MCPData) => {
    try {
      console.log('save-mcp-servers called, received:', mcpData);
      const success = saveMCPServers(mcpData);
      console.log('MCP servers saved:', success);
      return success;
    } catch (error) {
      console.error('Failed to save MCP servers:', error);
      return false;
    }
  });

  // Additional MCP server operations
  ipcMain.handle('add-mcp-server', (_, server: Omit<MCPServerConfig, 'id'>) => {
    try {
      console.log('Add MCP server:', server);

      // Load current MCP data
      const mcpData = loadMCPServers();

      // Create new server with ID
      const newServer = {
        ...server,
        id: `mcp-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
      };

      // Add to servers array
      mcpData.servers.push(newServer);

      // Save updated data
      const success = saveMCPServers(mcpData);

      if (success) {
        console.log('MCP server added successfully:', newServer.id);
        return newServer;
      } else {
        throw new Error('Failed to save MCP servers');
      }
    } catch (error) {
      console.error('Failed to add MCP server:', error);
      throw error;
    }
  });

  ipcMain.handle('update-mcp-server', async (_, id: string, updates: Partial<MCPServerConfig>) => {
    try {
      console.log('Update MCP server:', id, updates);

      // Load current MCP data
      const mcpData = loadMCPServers();

      // Find and update the server
      const serverIndex = mcpData.servers.findIndex((server: MCPServerConfig) => server.id === id);
      if (serverIndex === -1) {
        throw new Error(`Server with ID ${id} not found`);
      }

      const wasConnected = mcpConnections.has(id);

      // Update the server
      mcpData.servers[serverIndex] = { ...mcpData.servers[serverIndex], ...updates };

      // Save updated data
      const success = saveMCPServers(mcpData);

      if (success) {
        console.log('MCP server updated successfully:', id);

        // Handle immediate connection changes based on updates
        if (wasConnected && updates.enabled === false) {
          console.log('🔌 Disconnecting MCP server after disable:', id);
          await disconnectMCPServer(id);
        } else if (!wasConnected && updates.enabled === true) {
          console.log('🔌 Connecting MCP server after enable:', id);
          await connectMCPServer(id);
        } else if (wasConnected && updates.env) {
          console.log('🔄 Environment variables changed, restarting MCP server:', id);
          await disconnectMCPServer(id);
          if (mcpData.servers[serverIndex].enabled) {
            await connectMCPServer(id);
          }
        }

        return true;
      } else {
        throw new Error('Failed to save MCP servers');
      }
    } catch (error) {
      console.error('Failed to update MCP server:', error);
      return false;
    }
  });

  ipcMain.handle('remove-mcp-server', (_, id: string) => {
    try {
      console.log('Remove MCP server:', id);

      // Load current MCP data
      const mcpData = loadMCPServers();

      // Find and remove the server
      const serverIndex = mcpData.servers.findIndex((server: MCPServerConfig) => server.id === id);
      if (serverIndex === -1) {
        throw new Error(`Server with ID ${id} not found`);
      }

      // Remove the server
      mcpData.servers.splice(serverIndex, 1);

      // Save updated data
      const success = saveMCPServers(mcpData);

      if (success) {
        console.log('MCP server removed successfully:', id);
        return true;
      } else {
        throw new Error('Failed to save MCP servers');
      }
    } catch (error) {
      console.error('Failed to remove MCP server:', error);
      return false;
    }
  });

  ipcMain.handle('connect-mcp-server', async (_, serverId: string) => {
    return await connectMCPServer(serverId);
  });

  ipcMain.handle('disconnect-mcp-server', async (_, serverId: string) => {
    await disconnectMCPServer(serverId);
  });

  ipcMain.handle('disconnect-all-mcp-servers', async () => {
    await disconnectAllMCPServers();
  });

  ipcMain.handle('connect-enabled-mcp-servers', async () => {
    await connectEnabledMCPServers();
  });

  ipcMain.handle('restart-mcp-servers', async () => {
    console.log('🔄 Restarting all MCP servers to pick up environment changes...');
    await disconnectAllMCPServers();
    await connectEnabledMCPServers();
    console.log('✅ All MCP servers restarted');
  });

  ipcMain.handle('call-mcp-tool', async (_, toolName: string, args: Record<string, unknown>) => {
    return await callMCPTool(toolName, args);
  });

  ipcMain.handle('call-multiple-mcp-tools', async (_, toolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
    id?: string;
  }>) => {
    return await callMultipleMCPTools(toolCalls);
  });

  ipcMain.handle('get-all-mcp-tools', () => {
    return getAllMCPTools();
  });

  ipcMain.handle('get-mcp-connection-status', () => {
    return getMCPConnectionStatus();
  });

  ipcMain.handle('get-mcp-detailed-status', () => {
    return getMCPDetailedStatus();
  });

  ipcMain.handle('get-connected-mcp-server-ids', () => {
    return getConnectedMCPServerIds();
  });

  // macOS-specific MCP server troubleshooting
  ipcMain.handle('fix-macos-mcp-server', async (_, serverId: string) => {
    try {
      console.log(`🔧 Manual macOS fix requested for server: ${serverId}`);

      // Load server configuration
      const mcpData = loadMCPServers();
      const server = mcpData.servers.find((s: MCPServerConfig) => s.id === serverId);

      if (!server) {
        return { success: false, message: `Server ${serverId} not found` };
      }

      // Attempt fixes
      const fixResult = await attemptMacOSFixes(server);

      if (fixResult.success) {
        // Try to validate after fixes
        const validation = await validateMCPServerCommand(server);
        return {
          success: validation.valid,
          message: validation.valid
            ? `Fixes applied successfully: ${fixResult.message}`
            : `Fixes applied but validation still fails: ${validation.error}`
        };
      }

      return fixResult;
    } catch (error) {
      console.error('Failed to apply macOS fixes:', error);
      return {
        success: false,
        message: `Fix attempt failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  });

  ipcMain.handle('validate-mcp-server', async (_, serverId: string) => {
    try {
      console.log(`🔍 Manual validation requested for server: ${serverId}`);

      // Load server configuration
      const mcpData = loadMCPServers();
      const server = mcpData.servers.find((s: MCPServerConfig) => s.id === serverId);

      if (!server) {
        return { valid: false, error: `Server ${serverId} not found` };
      }

      return await validateMCPServerCommand(server);
    } catch (error) {
      console.error('Failed to validate MCP server:', error);
      return {
        valid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  });

  ipcMain.handle('read-mcp-resource', async (_, uri: string) => {
    return await readMCPResource(uri);
  });

  ipcMain.handle('get-mcp-prompt', async (_, name: string, args: Record<string, string>) => {
    return await getMCPPrompt(name, args);
  });

  ipcMain.handle('get-all-mcp-resources', () => {
    return getAllMCPResources();
  });

  ipcMain.handle('get-all-mcp-prompts', () => {
    return getAllMCPPrompts();
  });

  // Save individual conversation to JSON file
  ipcMain.handle('save-conversation-to-file', (_, conversationId: string, conversation: Conversation) => {
    try {
      const conversationsDir = path.join(app.getPath('userData'), 'conversations');
      if (!fs.existsSync(conversationsDir)) {
        fs.mkdirSync(conversationsDir, { recursive: true });
      }

      const filePath = path.join(conversationsDir, `${conversationId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(conversation, null, 2));
      console.log(`Conversation ${conversationId} saved to file: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`Failed to save conversation ${conversationId}:`, error);
      return false;
    }
  });

  // Save conversation index to JSON file
  ipcMain.handle('save-conversation-index', (_, conversationIndex: Conversation[]) => {
    try {
      const conversationsDir = path.join(app.getPath('userData'), 'conversations');
      if (!fs.existsSync(conversationsDir)) {
        fs.mkdirSync(conversationsDir, { recursive: true });
      }

      const indexPath = path.join(conversationsDir, 'index.json');
      fs.writeFileSync(indexPath, JSON.stringify(conversationIndex, null, 2));
      console.log(`Conversation index saved to file: ${indexPath}`);
      return true;
    } catch (error) {
      console.error('Failed to save conversation index:', error);
      return false;
    }
  });

  ipcMain.handle('load-conversation-index', () => {
    try {
      const conversationsDir = path.join(app.getPath('userData'), 'conversations');
      const indexPath = path.join(conversationsDir, 'index.json');

      if (fs.existsSync(indexPath)) {
        const data = fs.readFileSync(indexPath, 'utf8');
        return JSON.parse(data);
      }
      return [];
    } catch (error) {
      console.error('Failed to load conversation index:', error);
      return [];
    }
  });

  ipcMain.handle('load-conversation-from-file', (_, conversationId: string) => {
    try {
      const conversationsDir = path.join(app.getPath('userData'), 'conversations');
      const filePath = path.join(conversationsDir, `${conversationId}.json`);

      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error(`Failed to load conversation ${conversationId}:`, error);
      return null;
    }
  });

  ipcMain.handle('get-all-conversation-ids', () => {
    try {
      const conversationsDir = path.join(app.getPath('userData'), 'conversations');

      if (!fs.existsSync(conversationsDir)) {
        return [];
      }

      const files = fs.readdirSync(conversationsDir);
      const conversationIds = files
        .filter(file => file.endsWith('.json') && file !== 'index.json')
        .map(file => file.replace('.json', ''));

      return conversationIds;
    } catch (error) {
      console.error('Failed to get conversation IDs:', error);
      return [];
    }
  });

  // Memory System IPC Handlers

  // Save memory index to JSON file
  ipcMain.handle('save-memory-index', (_, memoryIndex: Record<string, unknown>) => {
    try {
      const memoryDir = path.join(app.getPath('userData'), 'memory');
      if (!fs.existsSync(memoryDir)) {
        fs.mkdirSync(memoryDir, { recursive: true });
      }

      const indexPath = path.join(memoryDir, 'index.json');
      fs.writeFileSync(indexPath, JSON.stringify(memoryIndex, null, 2));
      console.log(`Memory index saved to file: ${indexPath}`);
      return true;
    } catch (error) {
      console.error('Failed to save memory index:', error);
      return false;
    }
  });

  // Load memory index from JSON file
  ipcMain.handle('load-memory-index', () => {
    try {
      const memoryDir = path.join(app.getPath('userData'), 'memory');
      const indexPath = path.join(memoryDir, 'index.json');

      if (fs.existsSync(indexPath)) {
        const data = fs.readFileSync(indexPath, 'utf8');
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error('Failed to load memory index:', error);
      return null;
    }
  });

  // Save individual memory entry to JSON file
  ipcMain.handle('save-memory-entry', (_, memoryEntry: Record<string, unknown>) => {
    try {
      const memoryDir = path.join(app.getPath('userData'), 'memory');
      const entriesDir = path.join(memoryDir, 'entries');

      if (!fs.existsSync(entriesDir)) {
        fs.mkdirSync(entriesDir, { recursive: true });
      }

      const filePath = path.join(entriesDir, `${memoryEntry.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(memoryEntry, null, 2));
      console.log(`Memory entry ${memoryEntry.id} saved to file: ${filePath}`);
      return true;
    } catch (error) {
      console.error(`Failed to save memory entry ${memoryEntry?.id}:`, error);
      return false;
    }
  });

  // Load memory entry from JSON file
  ipcMain.handle('load-memory-entry', (_, memoryId: string) => {
    try {
      const memoryDir = path.join(app.getPath('userData'), 'memory');
      const entriesDir = path.join(memoryDir, 'entries');
      const filePath = path.join(entriesDir, `${memoryId}.json`);

      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error(`Failed to load memory entry ${memoryId}:`, error);
      return null;
    }
  });

  // Delete memory entry file
  ipcMain.handle('delete-memory-entry', (_, memoryId: string) => {
    try {
      const memoryDir = path.join(app.getPath('userData'), 'memory');
      const entriesDir = path.join(memoryDir, 'entries');
      const filePath = path.join(entriesDir, `${memoryId}.json`);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Memory entry ${memoryId} deleted from file: ${filePath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to delete memory entry ${memoryId}:`, error);
      return false;
    }
  });

  // Get memory storage statistics
  ipcMain.handle('get-memory-stats', () => {
    try {
      const memoryDir = path.join(app.getPath('userData'), 'memory');
      const entriesDir = path.join(memoryDir, 'entries');

      if (!fs.existsSync(entriesDir)) {
        return { totalSize: 0, entryCount: 0 };
      }

      const files = fs.readdirSync(entriesDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      let totalSize = 0;
      for (const file of jsonFiles) {
        const filePath = path.join(entriesDir, file);
        const stats = fs.statSync(filePath);
        totalSize += stats.size;
      }

      return {
        totalSize,
        entryCount: jsonFiles.length
      };
    } catch (error) {
      console.error('Failed to get memory stats:', error);
      return { totalSize: 0, entryCount: 0 };
    }
  });

  // Memory Export/Import IPC Handlers

  // Save memory export to file
  ipcMain.handle('save-memory-export', async (_, exportData: Record<string, unknown>, filename: string) => {
    try {
      if (!mainWindow) return { success: false, error: 'No main window available' };

      // dialog is already imported at the top
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Memory Export',
        defaultPath: filename,
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Save canceled by user' };
      }

      fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2));
      console.log(`Memory export saved to: ${result.filePath}`);

      return {
        success: true,
        filename: path.basename(result.filePath)
      };
    } catch (error) {
      console.error('Failed to save memory export:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Load memory export from file
  ipcMain.handle('load-memory-export', async () => {
    try {
      if (!mainWindow) return { success: false, error: 'No main window available' };

      // dialog is already imported at the top
      const result = await dialog.showOpenDialog(mainWindow, {
        title: 'Load Memory Export',
        filters: [
          { name: 'JSON Files', extensions: ['json'] },
          { name: 'All Files', extensions: ['*'] }
        ],
        properties: ['openFile']
      });

      if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
        return { success: false, error: 'Load canceled by user' };
      }

      const filePath = result.filePaths[0];
      const data = fs.readFileSync(filePath, 'utf8');
      const exportData = JSON.parse(data);

      console.log(`Memory export loaded from: ${filePath}`);

      return {
        success: true,
        data: exportData
      };
    } catch (error) {
      console.error('Failed to load memory export:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handle window control
  ipcMain.handle('hide-window', () => {
    if (mainWindow) {
      mainWindow.hide();
    }
  });

  ipcMain.handle('show-window', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  ipcMain.handle('close-window', () => {
    if (mainWindow) {
      isQuitting = true;
      app.quit();
    }
  });

  ipcMain.handle('minimize-window', () => {
    if (mainWindow) {
      mainWindow.minimize();
    }
  });

  ipcMain.handle('maximize-window', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.handle('resize-window', (_, width: number, height: number) => {
    if (mainWindow) {
      mainWindow.setSize(width, height);
    }
  });

  ipcMain.handle('get-current-window-size', () => {
    if (mainWindow) {
      const [width, height] = mainWindow.getSize();
      return { width, height };
    }
    return { width: 570, height: 195 }; // Default size (increased by 15px for draggable header)
  });

  ipcMain.handle('get-window-position', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      return { x: bounds.x, y: bounds.y };
    }
    return { x: 0, y: 0 };
  });

  ipcMain.handle('take-screenshot', async () => {
    try {
      // desktopCapturer is already imported at the top

      // Get all available sources (screens)
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 }
      });

      if (sources.length > 0) {
        // Use the primary screen
        const primarySource = sources[0];
        const screenshot = primarySource.thumbnail;

        // Convert to base64 data URL
        const dataURL = screenshot.toDataURL();

        console.log('Screenshot captured successfully');
        return { success: true, dataURL };
      } else {
        throw new Error('No screen sources available');
      }
    } catch (error) {
      console.error('Failed to take screenshot:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Window dragging is now handled by CSS -webkit-app-region in the renderer
  // No IPC handlers needed for CSS-based dragging

  // Handle overlay window creation
  ipcMain.handle('open-action-menu', openActionMenu);

  ipcMain.handle('close-action-menu', () => {
    if (actionMenuWindow) {
      actionMenuWindow.close();
    }
  });

  // Handle prompt selection from action menu
  ipcMain.handle('send-prompt-to-main', (_, promptText: string) => {
    if (mainWindow) {
      mainWindow.webContents.send('prompt-selected', promptText);
    }
    // Close the action menu after sending prompt
    if (actionMenuWindow) {
      actionMenuWindow.close();
    }
  });

  ipcMain.handle('open-settings-overlay', async () => {
    if (!mainWindow) return;

    if (settingsWindow) {
      settingsWindow.focus();
      return;
    }

    // Calculate position using multi-monitor aware utility
    const windowWidth = 800;
    const windowHeight = 600;
    const { x, y } = calculateWindowPosition({
      width: windowWidth,
      height: windowHeight,
      preferredPosition: 'center',
      offsetY: 50
    });

    settingsWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: x,
      y: y,
      show: false,
      frame: false, // Remove native frame completely
      resizable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      transparent: false,
      titleBarStyle: 'hidden', // Hide title bar completely
      title: 'LittleLLM - Settings',
      minWidth: 600,
      minHeight: 400,
      autoHideMenuBar: true, // Hide menu bar
      backgroundColor: '#1e1e1e',
      roundedCorners: true, // Enable rounded corners on the Electron window panel (macOS/Windows)
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: false, // Allow localhost connections for LM Studio, Ollama, etc.
      },
    });

    let startUrl: string;
    if (isProduction) {
      startUrl = `http://localhost:${staticServerPort}`;
    } else {
      const detectedPort = await detectNextJSPort();
      startUrl = `http://localhost:${detectedPort}`;
    }
    const settingsUrl = `${startUrl}?overlay=settings`;
    settingsWindow.loadURL(settingsUrl);

    settingsWindow.on('closed', () => {
      settingsWindow = null;
    });

    settingsWindow.once('ready-to-show', () => {
      settingsWindow?.show();
      settingsWindow?.focus();
    });
  });

  ipcMain.handle('close-settings-overlay', () => {
    if (settingsWindow) {
      settingsWindow.close();
    }
  });

  // Handle chat window creation
  ipcMain.handle('open-chat-window', async () => {
    if (!mainWindow) return;

    if (chatWindow) {
      // Always show and focus the chat window, even if it was hidden
      if (!chatWindow.isVisible()) {
        chatWindow.show();
      }
      chatWindow.focus();
      return;
    }

    // Calculate position next to main window
    const windowWidth = 400; // 50% smaller than original 800px
    const windowHeight = 600;

    // Get main window position and size
    const mainBounds = mainWindow.getBounds();

    // Position chat window to the right of main window
    const x = mainBounds.x + mainBounds.width + 10; // 10px gap
    const y = mainBounds.y;

    chatWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      minWidth: 300, // Minimum width to prevent cropping
      minHeight: 400, // Minimum height to prevent cropping
      x: x,
      y: y,
      show: false,
      frame: false, // No title bar
      resizable: true, // Make it resizable
      alwaysOnTop: true,
      skipTaskbar: true,
      transparent: false,
      backgroundColor: '#1e1e1e',
      roundedCorners: true, // Enable rounded corners
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: false,
      },
    });

    let startUrl: string;
    if (isProduction) {
      startUrl = `http://localhost:${staticServerPort}`;
    } else {
      const detectedPort = await detectNextJSPort();
      startUrl = `http://localhost:${detectedPort}`;
    }
    const chatUrl = `${startUrl}?overlay=chat`;
    chatWindow.loadURL(chatUrl);

    chatWindow.on('closed', () => {
      chatWindow = null;
    });

    chatWindow.once('ready-to-show', () => {
      chatWindow?.show();
      chatWindow?.focus();
    });
  });

  ipcMain.handle('close-chat-window', () => {
    if (chatWindow) {
      chatWindow.close();
    }
  });

  // Handle messages synchronization between main window and chat window
  ipcMain.handle('sync-messages-to-chat', (_, messages) => {
    if (chatWindow) {
      chatWindow.webContents.send('messages-update', messages);
    }
  });

  // Handle request for current messages from chat window
  ipcMain.handle('request-current-messages', () => {
    if (mainWindow) {
      // Request current messages from main window
      mainWindow.webContents.send('request-current-messages');
    }
  });

  // Handle state file operations (separate from settings)
  ipcMain.handle('get-state-file', async (_, filename: string) => {
    try {
      const stateDir = path.join(app.getPath('userData'), 'state');
      const filePath = path.join(stateDir, filename);

      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
      }
      return null;
    } catch (error) {
      console.error(`Failed to read state file ${filename}:`, error);
      return null;
    }
  });

  ipcMain.handle('save-state-file', async (_, filename: string, data: Record<string, unknown>) => {
    try {
      const stateDir = path.join(app.getPath('userData'), 'state');

      // Ensure state directory exists
      if (!fs.existsSync(stateDir)) {
        fs.mkdirSync(stateDir, { recursive: true });
      }

      const filePath = path.join(stateDir, filename);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      console.error(`Failed to save state file ${filename}:`, error);
      return false;
    }
  });

  // Handle theme change notifications from overlay to main window
  ipcMain.handle('notify-theme-change', (_, themeId: string) => {
    if (mainWindow) {
      mainWindow.webContents.send('theme-changed', themeId);
    }
  });

  // Generate HTML content for history window
  function generateHistoryHTML(conversations: Conversation[]): string {
    const conversationItems = conversations.map(conversation => {
      const date = new Date(conversation.updatedAt).toLocaleDateString();
      const messageCount = conversation.messages?.length || 0;

      return `
        <div class="history-item" data-conversation-id="${conversation.id}">
          <div class="history-item-content">
            <div class="history-item-title">${conversation.title || 'Untitled Conversation'}</div>
            <div class="history-item-meta">${messageCount} messages • ${date}</div>
          </div>
          <button class="history-item-delete" data-conversation-id="${conversation.id}" title="Delete conversation">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"></polyline>
              <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      `;
    }).join('');

    const emptyState = conversations.length === 0 ? `
      <div class="empty-state">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <p>No chat history yet</p>
        <p class="empty-state-subtitle">Start a conversation to see it here</p>
      </div>
    ` : '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          :root {
            /* Custom theme colors - matching globals.css */
            --background: #181829;
            --foreground: #d4d4d4;
            --card: #181829;
            --card-foreground: #eba5a5;
            --primary: #569cd6;
            --primary-foreground: #ffffff;
            --secondary: #4fc1ff;
            --secondary-foreground: #adadad;
            --accent: #e04539;
            --accent-foreground: #ffffff;
            --muted: #201e31;
            --muted-foreground: #9ca3af;
            --border: #3b3b68;
            --input: #949494;
            --ring: #569cd6;
            --destructive: #f44747;
            --destructive-foreground: #ffffff;
          }

          body {
            margin: 0;
            padding: 0;
            background: var(--card);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: var(--card-foreground);
            overflow: hidden;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          body::-webkit-scrollbar {
            display: none;
          }

          .history-container {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 6px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            overflow: hidden;
            height: 100vh;
            display: flex;
            flex-direction: column;
          }

          .history-header {
            padding: 16px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: between;
            align-items: center;
            background: var(--card);
          }

          .history-title {
            font-size: 16px;
            font-weight: 600;
            color: var(--card-foreground);
            flex: 1;
          }

          .clear-all-button {
            background: var(--destructive);
            color: var(--destructive-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 12px;
            cursor: pointer;
            margin-left: 12px;
          }

          .clear-all-button:hover {
            opacity: 0.9;
          }

          .history-content {
            flex: 1;
            overflow-y: auto;
            padding: 8px;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }

          .history-content::-webkit-scrollbar {
            display: none;
          }

          .history-item {
            display: flex;
            align-items: center;
            padding: 12px;
            margin-bottom: 4px;
            border: 1px solid var(--border);
            border-radius: 6px;
            cursor: pointer;
            transition: background-color 0.2s;
            group: hover;
          }

          .history-item:hover {
            background: var(--accent);
            color: var(--accent-foreground);
          }

          .history-item-content {
            flex: 1;
            min-width: 0;
          }

          .history-item-title {
            font-size: 14px;
            font-weight: 500;
            color: var(--card-foreground);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 4px;
          }

          .history-item:hover .history-item-title {
            color: var(--accent-foreground);
          }

          .history-item-meta {
            font-size: 12px;
            color: var(--muted-foreground);
          }

          .history-item:hover .history-item-meta {
            color: var(--accent-foreground);
            opacity: 0.8;
          }

          .history-item-delete {
            background: none;
            border: none;
            color: var(--muted-foreground);
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            opacity: 0;
            transition: opacity 0.2s;
            margin-left: 8px;
          }

          .history-item:hover .history-item-delete {
            opacity: 1;
          }

          .history-item-delete:hover {
            background: var(--destructive);
            color: var(--destructive-foreground);
          }

          .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 200px;
            color: var(--muted-foreground);
            text-align: center;
          }

          .empty-state svg {
            margin-bottom: 12px;
            opacity: 0.5;
          }

          .empty-state p {
            margin: 4px 0;
          }

          .empty-state-subtitle {
            font-size: 12px;
            opacity: 0.7;
          }
        </style>
      </head>
      <body>
        <div class="history-container">
          <div class="history-header">
            <div class="history-title">Chat History</div>
            ${conversations.length > 0 ? '<button class="clear-all-button" onclick="clearAllHistory()">Clear All</button>' : ''}
          </div>
          <div class="history-content">
            ${emptyState}
            ${conversationItems}
          </div>
        </div>
        <script>
          // Handle conversation item clicks
          document.addEventListener('click', function(e) {
            const historyItem = e.target.closest('.history-item');
            const deleteButton = e.target.closest('.history-item-delete');

            if (deleteButton) {
              e.stopPropagation();
              const conversationId = deleteButton.dataset.conversationId;
              if (confirm('Delete this conversation?')) {
                window.electronAPI?.deleteHistoryItem?.(conversationId);
              }
            } else if (historyItem) {
              const conversationId = historyItem.dataset.conversationId;
              window.electronAPI?.selectHistoryItem?.(conversationId);
            }
          });

          // Handle clear all history
          function clearAllHistory() {
            if (confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
              window.electronAPI?.clearAllHistory?.();
            }
          }
        </script>
      </body>
      </html>
    `;
  }

  // Handle dropdown window creation
  ipcMain.handle('open-dropdown', async (_, { x, y, width, height, content }) => {
    if (!mainWindow) return;

    // Close existing dropdown if open
    if (dropdownWindow) {
      dropdownWindow.close();
      dropdownWindow = null;
    }

    // Get current CSS variables from main window
    let cssVariables = '';
    try {
      cssVariables = await mainWindow.webContents.executeJavaScript(`
        (() => {
          const root = document.documentElement;
          const style = getComputedStyle(root);
          const variables = [
            'background', 'foreground', 'card', 'card-foreground',
            'primary', 'primary-foreground', 'secondary', 'secondary-foreground',
            'accent', 'accent-foreground', 'muted', 'muted-foreground',
            'border', 'input', 'ring', 'destructive', 'destructive-foreground'
          ];

          return variables.map(name => {
            const value = style.getPropertyValue('--' + name).trim();
            return value ? '--' + name + ': ' + value + ';' : '';
          }).filter(Boolean).join('\\n            ');
        })()
      `);
      console.log('🎨 Retrieved CSS variables from main window:', cssVariables);
    } catch (error) {
      console.error('Failed to get CSS variables from main window:', error);
      cssVariables = ''; // Will use fallback values
    }



    // Convert viewport coordinates to screen coordinates using multi-monitor aware utility
    const mainBounds = mainWindow.getBounds();
    const screenX = mainBounds.x + x;
    const screenY = mainBounds.y + y;

    // Get the display where the dropdown should appear
    const display = screen.getDisplayNearestPoint({ x: screenX, y: screenY });
    const { x: displayX, y: displayY, width: displayWidth, height: displayHeight } = display.workArea;

    // Ensure dropdown stays within the display bounds
    const adjustedX = Math.max(displayX, Math.min(screenX, displayX + displayWidth - width));
    const adjustedY = Math.max(displayY, Math.min(screenY, displayY + displayHeight - height));

    console.log('🔍 Dropdown multi-monitor positioning:', {
      viewportCoords: { x, y },
      screenCoords: { screenX, screenY },
      adjustedPosition: { adjustedX, adjustedY },
      size: { width, height },
      display: display.bounds
    });

    dropdownWindow = new BrowserWindow({
      width: width,
      height: height + 15, // Add 15px for draggable header accommodation
      x: adjustedX,
      y: adjustedY,
      show: false,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      transparent: false,
      backgroundColor: '#1a1a1a', // Dark background
      roundedCorners: true, // Enable rounded corners on the Electron window panel (macOS/Windows)
      focusable: true, // Enable focus to receive click events
      parent: mainWindow, // Anchor to main window
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: false,
      },
    });



    // Create HTML content for the dropdown using CSS variables (same as main window)
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          /* Custom theme colors - matching globals.css */
          :root {
            --background: #181829;
            --foreground: #d4d4d4;
            --card: #181829;
            --card-foreground: #eba5a5;
            --primary: #569cd6;
            --primary-foreground: #ffffff;
            --secondary: #4fc1ff;
            --secondary-foreground: #adadad;
            --accent: #e04539;
            --accent-foreground: #ffffff;
            --muted: #201e31;
            --muted-foreground: #9ca3af;
            --border: #3b3b68;
            --input: #949494;
            --ring: #569cd6;
            --destructive: #f44747;
            --destructive-foreground: #ffffff;
          }

          body {
            margin: 0;
            padding: 0;
            background: var(--card);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: var(--card-foreground);
            overflow: hidden; /* Prevent any scrollbars on body */
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE */
          }
          html {
            overflow: hidden; /* Prevent any scrollbars on html */
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE */
          }
          .dropdown-container {
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: 6px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            overflow: hidden;
            min-width: 280px;
            max-width: 500px;
            width: 100%;
            box-sizing: border-box;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .dropdown-container::-webkit-scrollbar {
            display: none;
          }
          .search-section {
            display: flex;
            align-items: center;
            border-bottom: 1px solid var(--border);
            padding: 8px 12px;
          }
          .search-input {
            background: transparent;
            border: none;
            outline: none;
            color: var(--card-foreground);
            width: 100%;
            font-size: 14px;
            padding: 4px 8px;
          }
          .search-input::placeholder {
            color: var(--muted-foreground);
          }
          .dropdown-content {
            max-height: 250px;
            overflow-y: auto;
            overflow-x: hidden;
            padding: 4px;
            box-sizing: border-box;
            scrollbar-width: none;
            -ms-overflow-style: none;
            flex: 1;
          }
          .dropdown-content::-webkit-scrollbar {
            display: none;
          }
          .dropdown-item {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            color: var(--card-foreground);
            cursor: pointer;
            border-radius: 4px;
            margin: 1px 0;
            font-size: 14px;
            user-select: none;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            box-sizing: border-box;
            min-width: 0;
          }
          .dropdown-item:hover {
            background: var(--accent);
            color: var(--accent-foreground);
          }
          .dropdown-item.selected {
            background: var(--accent);
            color: var(--accent-foreground);
          }
          .dropdown-item.keyboard-selected {
            background: var(--accent);
            color: var(--accent-foreground);
          }
          .check-icon {
            margin-right: 8px;
            width: 16px;
            height: 16px;
            opacity: 0;
          }
          .check-icon.visible {
            opacity: 1;
          }
          .provider-icon {
            margin-right: 12px;
            width: 20px;
            height: 20px;
            flex-shrink: 0;
          }
          /* Hide scrollbars completely */
          .dropdown-content::-webkit-scrollbar {
            display: none;
          }
          .dropdown-container::-webkit-scrollbar {
            display: none;
          }
          body::-webkit-scrollbar {
            display: none;
          }
          html::-webkit-scrollbar {
            display: none;
          }
        </style>
      </head>
      <body>
        <div class="dropdown-container">
          ${content}
        </div>
        <script>
          // Auto-focus search input when dropdown opens
          document.addEventListener('DOMContentLoaded', function() {
            const searchInput = document.querySelector('.search-input');
            if (searchInput) {
              // Small delay to ensure window is fully loaded
              setTimeout(() => {
                searchInput.focus();
              }, 50);
            }
          });

          // Handle click events
          document.addEventListener('click', function(e) {
            const item = e.target.closest('.dropdown-item');
            if (item && item.dataset.value) {
              // Send selection back to main process
              window.electronAPI?.selectDropdownItem?.(item.dataset.value);
            }
          });

          // Handle search input
          const searchInput = document.querySelector('.search-input');
          if (searchInput) {
            searchInput.addEventListener('input', function(e) {
              const searchTerm = e.target.value.toLowerCase();
              const items = document.querySelectorAll('.dropdown-item');
              items.forEach(item => {
                const text = item.textContent.toLowerCase();
                item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
              });
            });

            // Handle keyboard navigation
            searchInput.addEventListener('keydown', function(e) {
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const visibleItems = Array.from(document.querySelectorAll('.dropdown-item')).filter(item =>
                  item.style.display !== 'none'
                );
                if (visibleItems.length > 0) {
                  const currentSelected = document.querySelector('.dropdown-item.keyboard-selected');
                  let newIndex = 0;

                  if (currentSelected) {
                    currentSelected.classList.remove('keyboard-selected');
                    const currentIndex = visibleItems.indexOf(currentSelected);
                    if (e.key === 'ArrowDown') {
                      newIndex = (currentIndex + 1) % visibleItems.length;
                    } else {
                      newIndex = currentIndex > 0 ? currentIndex - 1 : visibleItems.length - 1;
                    }
                  }

                  visibleItems[newIndex].classList.add('keyboard-selected');
                  visibleItems[newIndex].scrollIntoView({ block: 'nearest' });
                }
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const selected = document.querySelector('.dropdown-item.keyboard-selected');
                if (selected && selected.dataset.value) {
                  window.electronAPI?.selectDropdownItem?.(selected.dataset.value);
                }
              }
            });
          }
        </script>
      </body>
      </html>
    `;

    dropdownWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    // Handle click outside to close
    dropdownWindow.on('blur', () => {
      // Small delay to allow click events to process first
      setTimeout(() => {
        if (dropdownWindow && !dropdownWindow.isDestroyed()) {
          dropdownWindow.close();
        }
      }, 100);
    });

    dropdownWindow.on('closed', () => {
      dropdownWindow = null;
    });

    dropdownWindow.once('ready-to-show', () => {
      dropdownWindow?.show();
      dropdownWindow?.focus(); // Ensure it can receive events
    });

    // Close dropdown if main window moves or is minimized
    const handleMainWindowMove = () => {
      if (dropdownWindow && !dropdownWindow.isDestroyed()) {
        dropdownWindow.close();
      }
    };

    const handleMainWindowMinimize = () => {
      if (dropdownWindow && !dropdownWindow.isDestroyed()) {
        dropdownWindow.close();
      }
    };

    mainWindow.on('move', handleMainWindowMove);
    mainWindow.on('minimize', handleMainWindowMinimize);
    mainWindow.on('hide', handleMainWindowMove);

    // Clean up listeners when dropdown closes
    dropdownWindow.on('closed', () => {
      mainWindow?.off('move', handleMainWindowMove);
      mainWindow?.off('minimize', handleMainWindowMinimize);
      mainWindow?.off('hide', handleMainWindowMove);
    });
  });

  ipcMain.handle('close-dropdown', () => {
    if (dropdownWindow) {
      dropdownWindow.close();
      dropdownWindow = null;
    }
  });

  // Handle dropdown item selection
  ipcMain.handle('select-dropdown-item', (_, value: string) => {
    // Send selection to main window
    if (mainWindow) {
      mainWindow.webContents.send('dropdown-item-selected', value);
    }
    // Close dropdown
    if (dropdownWindow) {
      dropdownWindow.close();
      dropdownWindow = null;
    }
  });

  // Handle history window creation
  ipcMain.handle('open-history', async (_, { conversations }) => {
    if (!mainWindow) return;

    // Close existing history window if open
    if (historyWindow) {
      historyWindow.close();
      historyWindow = null;
    }

    // Get current CSS variables from main window
    let cssVariables = '';
    try {
      cssVariables = await mainWindow.webContents.executeJavaScript(`
        (() => {
          const root = document.documentElement;
          const computedStyle = getComputedStyle(root);
          const variables = [];
          for (let i = 0; i < computedStyle.length; i++) {
            const property = computedStyle[i];
            if (property.startsWith('--')) {
              const value = computedStyle.getPropertyValue(property);
              variables.push(\`\${property}: \${value};\`);
            }
          }
          return variables.join('\\n            ');
        })()
      `);
      console.log('🎨 Retrieved CSS variables from main window:', cssVariables ? 'Success' : 'Empty');
    } catch (error) {
      console.warn('Failed to retrieve CSS variables:', error);
    }

    // Calculate window size and position using multi-monitor aware utility
    const windowWidth = 400;
    const windowHeight = 500;
    const { x: adjustedX, y: adjustedY } = calculateWindowPosition({
      width: windowWidth,
      height: windowHeight,
      preferredPosition: 'right'
    });

    historyWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: adjustedX,
      y: adjustedY,
      show: false,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      transparent: false,
      backgroundColor: '#1a1a1a',
      roundedCorners: true,
      focusable: true,
      parent: mainWindow,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: false,
      },
    });

    // Generate HTML content for history
    const htmlContent = generateHistoryHTML(conversations);

    historyWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    // Handle click outside to close
    historyWindow.on('blur', () => {
      setTimeout(() => {
        if (historyWindow && !historyWindow.isDestroyed()) {
          historyWindow.close();
        }
      }, 100);
    });

    historyWindow.on('closed', () => {
      historyWindow = null;
    });

    historyWindow.once('ready-to-show', () => {
      historyWindow?.show();
      historyWindow?.focus();
    });

    // Close history window if main window moves or is minimized
    const handleMainWindowMove = () => {
      if (historyWindow && !historyWindow.isDestroyed()) {
        historyWindow.close();
      }
    };

    mainWindow.on('move', handleMainWindowMove);
    mainWindow.on('minimize', handleMainWindowMove);
    mainWindow.on('hide', handleMainWindowMove);

    // Clean up listeners when history window closes
    historyWindow.on('closed', () => {
      mainWindow?.off('move', handleMainWindowMove);
      mainWindow?.off('minimize', handleMainWindowMove);
      mainWindow?.off('hide', handleMainWindowMove);
    });
  });

  ipcMain.handle('close-history', () => {
    if (historyWindow) {
      historyWindow.close();
      historyWindow = null;
    }
  });

  // Handle history item selection
  ipcMain.handle('select-history-item', (_, conversationId: string) => {
    // Send selection to main window
    if (mainWindow) {
      mainWindow.webContents.send('history-item-selected', conversationId);
    }
    // Close history window
    if (historyWindow) {
      historyWindow.close();
      historyWindow = null;
    }
  });

  // Handle history item deletion
  ipcMain.handle('delete-history-item', (_, conversationId: string) => {
    // Send deletion request to main window
    if (mainWindow) {
      mainWindow.webContents.send('history-item-deleted', conversationId);
    }
  });

  // Handle clear all history
  ipcMain.handle('clear-all-history', () => {
    // Send clear all request to main window
    if (mainWindow) {
      mainWindow.webContents.send('clear-all-history');
    }
    // Close history window
    if (historyWindow) {
      historyWindow.close();
      historyWindow = null;
    }
  });
}

app.on('window-all-closed', () => {
  // On Windows/Linux, keep the app running in the background
  // Only quit when explicitly requested
});

app.on('before-quit', async () => {
  isQuitting = true;

  // Disconnect all MCP servers before quitting
  try {
    console.log('🔌 Disconnecting all MCP servers before quit...');
    await disconnectAllMCPServers();
  } catch (error) {
    console.error('❌ Failed to disconnect MCP servers on quit:', error);
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow().catch(console.error);
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});
