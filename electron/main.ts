import { app, BrowserWindow, globalShortcut, Tray, Menu, clipboard, ipcMain, nativeImage, protocol, session, net } from 'electron';
import * as path from 'path';
import * as isDev from 'electron-is-dev';
import * as fs from 'fs';
import * as os from 'os';
import { pathToFileURL } from 'url';
import * as http from 'http';
import * as mime from 'mime-types';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

// MCP Connection Management
interface MCPConnection {
  client: Client;
  transport: StdioClientTransport;
  server: any;
  tools: any[];
  resources: any[];
  prompts: any[];
  connected: boolean;
  process?: any;
}

const mcpConnections: Map<string, MCPConnection> = new Map();

// MCP Server Management Functions
async function connectMCPServer(serverId: string): Promise<boolean> {
  try {
    console.log(`🔌 Connecting to MCP server: ${serverId}`);

    // Load server configuration
    const mcpData = loadMCPServers();
    const server = mcpData.servers.find((s: any) => s.id === serverId);

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

    // Create transport
    console.log(`🚀 Starting MCP server process: ${server.command} ${server.args.join(' ')}`);
    console.log(`🔧 Server environment variables:`, server.env);
    const mergedEnv = { ...process.env, ...server.env };
    console.log(`🔧 Merged environment (showing only server env vars):`, Object.fromEntries(
      Object.entries(mergedEnv).filter(([key]) => server.env && key in server.env)
    ));

    const transport = new StdioClientTransport({
      command: server.command,
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
    let tools: any = { tools: [] };
    let resources: any = { resources: [] };
    let prompts: any = { prompts: [] };

    try {
      tools = await client.listTools();
    } catch (error: any) {
      if (error.code === -32601) {
        console.log(`ℹ️ Server ${serverId} does not support tools (method not found)`);
      } else {
        console.warn(`⚠️ Failed to list tools for ${serverId}:`, error);
      }
    }

    try {
      resources = await client.listResources();
    } catch (error: any) {
      if (error.code === -32601) {
        console.log(`ℹ️ Server ${serverId} does not support resources (method not found)`);
      } else {
        console.warn(`⚠️ Failed to list resources for ${serverId}:`, error);
      }
    }

    try {
      prompts = await client.listPrompts();
    } catch (error: any) {
      if (error.code === -32601) {
        console.log(`ℹ️ Server ${serverId} does not support prompts (method not found)`);
      } else {
        console.warn(`⚠️ Failed to list prompts for ${serverId}:`, error);
      }
    }

    const toolCount = tools.tools?.length || 0;
    const resourceCount = resources.resources?.length || 0;
    const promptCount = prompts.prompts?.length || 0;

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
      tools: tools.tools || [],
      resources: resources.resources || [],
      prompts: prompts.prompts || [],
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
    const enabledServers = mcpData.servers.filter((server: any) => server.enabled);

    console.log(`📋 Found ${enabledServers.length} enabled servers`);

    for (const server of enabledServers) {
      await connectMCPServer(server.id);
    }

    console.log('✅ Auto-connection complete');
  } catch (error) {
    console.error('❌ Failed to auto-connect enabled MCP servers:', error);
  }
}

// MCP Tool Management Functions
async function callMCPTool(toolName: string, args: any): Promise<any> {
  try {
    console.log(`🔧 Calling MCP tool: ${toolName} with args:`, args);

    // Find the tool in connected servers
    let targetConnection: MCPConnection | null = null;
    let targetTool: any = null;

    for (const [serverId, connection] of mcpConnections) {
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
  args: any;
  id?: string;
}>): Promise<Array<{
  id?: string;
  name: string;
  result: any;
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

    for (const [serverId, connection] of mcpConnections) {
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

function getAllMCPTools(): any[] {
  const allTools: any[] = [];

  for (const [serverId, connection] of mcpConnections) {
    if (!connection.connected) continue;

    for (const tool of connection.tools) {
      allTools.push({
        ...tool,
        serverId
      });
    }
  }

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

function getMCPDetailedStatus(): any {
  const status: any = {
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
async function readMCPResource(uri: string): Promise<any> {
  try {
    console.log(`📄 Reading MCP resource: ${uri}`);

    // Find the resource in connected servers
    let targetConnection: MCPConnection | null = null;
    let targetResource: any = null;

    for (const [serverId, connection] of mcpConnections) {
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

function getAllMCPResources(): any[] {
  const allResources: any[] = [];

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
async function getMCPPrompt(name: string, args: any): Promise<any> {
  try {
    console.log(`📝 Getting MCP prompt: ${name} with args:`, args);

    // Find the prompt in connected servers
    let targetConnection: MCPConnection | null = null;
    let targetPrompt: any = null;

    for (const [serverId, connection] of mcpConnections) {
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

function getAllMCPPrompts(): any[] {
  const allPrompts: any[] = [];

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

      server.on('error', (err: any) => {
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
let dropdownWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let staticServerPort: number = 3001;
let isQuitting = false;

// Global function to open action menu
async function openActionMenu() {
  if (!mainWindow) return;

  if (actionMenuWindow) {
    actionMenuWindow.focus();
    return;
  }

  // Get main window position to position overlay relative to it
  const mainBounds = mainWindow.getBounds();
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  // Calculate position ensuring window stays on screen
  const windowWidth = 600;
  const windowHeight = 400;
  let x = mainBounds.x + (mainBounds.width - windowWidth) / 2;
  let y = mainBounds.y + 50;

  // Ensure window doesn't go off screen
  x = Math.max(0, Math.min(x, screenWidth - windowWidth));
  y = Math.max(0, Math.min(y, screenHeight - windowHeight));

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
      opacity: 1.0,
      fontSize: 'small',
      windowBounds: {
        width: 400,
        height: 615, // Increased by 15px for draggable header
      },
    },
    shortcuts: {
      toggleWindow: 'CommandOrControl+Shift+L',
      processClipboard: 'CommandOrControl+Shift+V',
      actionMenu: 'CommandOrControl+Shift+Space',
    },
    general: {
      autoStartWithSystem: false,
      showNotifications: true,
      saveConversationHistory: true,
      conversationHistoryLength: 10,
    },
  };
}

function saveAppSettings(settings: any) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    return false;
  }
}

function loadMCPServers() {
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

function saveMCPServers(mcpData: any) {
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

  mainWindow = new BrowserWindow({
    width: Math.max(bounds.width, 350), // Ensure minimum width for all UI elements
    height: Math.max(bounds.height, 157), // Increased by 15px for draggable header
    minWidth: 350, // Ensure all bottom toolbar buttons are visible (calculated from UI elements)
    minHeight: 157, // Increased by 15px for draggable header
    maxWidth: 1400,
    maxHeight: 1000,
    show: !appSettings.ui?.startMinimized,
    alwaysOnTop: appSettings.ui?.alwaysOnTop !== false, // Default to true if not set
    frame: false, // Remove traditional frame completely for Windows
    resizable: true,
    skipTaskbar: true, // Show in taskbar
    autoHideMenuBar: true, // Hide menu bar
    titleBarStyle: 'hidden', // Hide title bar completely
    transparent: false, // Disable transparency to test React rendering
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
  });

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

  // Set initial window properties from app settings
  const currentAppSettings = loadAppSettings();
  if (currentAppSettings.ui && currentAppSettings.ui.opacity !== undefined) {
    mainWindow.setOpacity(currentAppSettings.ui.opacity);
  }

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
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
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

  // Save window bounds when resized
  mainWindow.on('resize', () => {
    if (mainWindow) {
      const bounds = mainWindow.getBounds();
      const currentSettings = loadAppSettings();
      const updatedSettings = {
        ...currentSettings,
        ui: {
          ...currentSettings.ui,
          windowBounds: { width: bounds.width, height: bounds.height }
        }
      };
      saveAppSettings(updatedSettings);
    }
  });

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

  // Register the main shortcut to toggle window
  globalShortcut.register(shortcut, () => {
    console.log('Global shortcut triggered:', shortcut);
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

  ipcMain.handle('update-app-settings', (_, settings: any) => {
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

      // Handle UI settings
      if (cleanSettings.ui && mainWindow) {
        if (cleanSettings.ui.alwaysOnTop !== undefined) {
          mainWindow.setAlwaysOnTop(cleanSettings.ui.alwaysOnTop);
        }
        if (cleanSettings.ui.opacity !== undefined) {
          console.log('Setting window opacity to:', cleanSettings.ui.opacity);
          mainWindow.setOpacity(cleanSettings.ui.opacity);
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

  ipcMain.handle('set-storage-item', (_, key: string, value: any) => {
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

  ipcMain.handle('save-mcp-servers', (_, mcpData: any) => {
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
  ipcMain.handle('add-mcp-server', (_, server: any) => {
    try {
      console.log('Add MCP server:', server);

      // Load current MCP data
      const mcpData = loadMCPServers();

      // Create new server with ID
      const newServer = {
        ...server,
        id: `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
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

  ipcMain.handle('update-mcp-server', async (_, id: string, updates: any) => {
    try {
      console.log('Update MCP server:', id, updates);

      // Load current MCP data
      const mcpData = loadMCPServers();

      // Find and update the server
      const serverIndex = mcpData.servers.findIndex((server: any) => server.id === id);
      if (serverIndex === -1) {
        throw new Error(`Server with ID ${id} not found`);
      }

      const oldServer = mcpData.servers[serverIndex];
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
      const serverIndex = mcpData.servers.findIndex((server: any) => server.id === id);
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

  ipcMain.handle('call-mcp-tool', async (_, toolName: string, args: any) => {
    return await callMCPTool(toolName, args);
  });

  ipcMain.handle('call-multiple-mcp-tools', async (_, toolCalls: Array<{
    name: string;
    args: any;
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

  ipcMain.handle('read-mcp-resource', async (_, uri: string) => {
    return await readMCPResource(uri);
  });

  ipcMain.handle('get-mcp-prompt', async (_, name: string, args: any) => {
    return await getMCPPrompt(name, args);
  });

  ipcMain.handle('get-all-mcp-resources', () => {
    return getAllMCPResources();
  });

  ipcMain.handle('get-all-mcp-prompts', () => {
    return getAllMCPPrompts();
  });

  // Save individual conversation to JSON file
  ipcMain.handle('save-conversation-to-file', (_, conversationId: string, conversation: any) => {
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
  ipcMain.handle('save-conversation-index', (_, conversationIndex: any[]) => {
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
  ipcMain.handle('save-memory-index', (_, memoryIndex: any) => {
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
  ipcMain.handle('save-memory-entry', (_, memoryEntry: any) => {
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
  ipcMain.handle('save-memory-export', async (_, exportData: any, filename: string) => {
    try {
      const { dialog } = require('electron');
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
      const { dialog } = require('electron');
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

  ipcMain.handle('take-screenshot', async () => {
    try {
      const { desktopCapturer } = require('electron');

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

  // Window dragging functionality
  ipcMain.handle('start-drag', () => {
    if (mainWindow) {
      // Get current mouse position and window position
      const { screen } = require('electron');
      const point = screen.getCursorScreenPoint();
      const windowBounds = mainWindow.getBounds();

      // Calculate offset from mouse to window top-left
      const offsetX = point.x - windowBounds.x;
      const offsetY = point.y - windowBounds.y;

      return { offsetX, offsetY };
    }
    return null;
  });

  ipcMain.handle('drag-window', (_, { x, y, offsetX, offsetY }) => {
    if (mainWindow) {
      // Get current window bounds to prevent scaling issues
      const currentBounds = mainWindow.getBounds();

      // Calculate new position
      const newX = Math.round(x - offsetX);
      const newY = Math.round(y - offsetY);

      // Set position while preserving size
      mainWindow.setBounds({
        x: newX,
        y: newY,
        width: currentBounds.width,
        height: currentBounds.height
      });
    }
  });

  // Handle overlay window creation
  ipcMain.handle('open-action-menu', openActionMenu);

  ipcMain.handle('close-action-menu', () => {
    if (actionMenuWindow) {
      actionMenuWindow.close();
    }
  });

  // Handle prompt selection from action menu
  ipcMain.handle('send-prompt-to-main', (event, promptText: string) => {
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

    // Get main window position to position overlay relative to it
    const mainBounds = mainWindow.getBounds();
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Calculate position ensuring window stays on screen
    const windowWidth = 800;
    const windowHeight = 600;
    let x = mainBounds.x + (mainBounds.width - windowWidth) / 2;
    let y = mainBounds.y + 50;

    // Ensure window doesn't go off screen
    x = Math.max(0, Math.min(x, screenWidth - windowWidth));
    y = Math.max(0, Math.min(y, screenHeight - windowHeight));

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
      backgroundColor: '#1a1a1a',
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

  ipcMain.handle('save-state-file', async (_, filename: string, data: any) => {
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



    // Use Electron's built-in cursor positioning instead of manual math
    const { screen } = require('electron');
    const cursorPoint = screen.getCursorScreenPoint();

    // Position dropdown at cursor with small offset
    const dropdownX = cursorPoint.x;
    const dropdownY = cursorPoint.y + 10; // Small offset below cursor

    // Get screen dimensions for bounds checking
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    // Ensure dropdown stays on screen
    const adjustedX = Math.max(0, Math.min(dropdownX, screenWidth - width));
    const adjustedY = Math.max(0, Math.min(dropdownY, screenHeight - height));

    console.log('🔍 Dropdown cursor positioning:', {
      cursorPoint,
      calculated: { dropdownX, dropdownY },
      adjusted: { adjustedX, adjustedY },
      screenSize: { screenWidth, screenHeight }
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
          /* Use CSS variables from main window, with fallback */
          :root {
            ${cssVariables || `
            /* Default dark theme fallback - same as globals.css */
            --background: 224 71% 4%;
            --foreground: 213 31% 91%;
            --card: 224 71% 10%;
            --card-foreground: 213 31% 91%;
            --primary: 217 91% 60%;
            --primary-foreground: 222.2 84% 4.9%;
            --secondary: 222.2 84% 11%;
            --secondary-foreground: 210 40% 98%;
            --accent: 216 34% 17%;
            --accent-foreground: 210 40% 98%;
            --muted: 223 47% 11%;
            --muted-foreground: 215.4 16.3% 56.9%;
            --border: 216 34% 17%;
            --input: 216 34% 17%;
            --ring: 216 34% 17%;
            --destructive: 0 62.8% 30.6%;
            --destructive-foreground: 210 40% 98%;`}
          }

          body {
            margin: 0;
            padding: 0;
            background: hsl(var(--card));
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: hsl(var(--card-foreground));
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
            background: hsl(var(--card));
            border: 1px solid hsl(var(--border));
            border-radius: 6px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            overflow: hidden;
            min-width: 280px;
            max-width: 280px;
            width: 280px;
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
            border-bottom: 1px solid hsl(var(--border));
            padding: 8px 12px;
          }
          .search-input {
            background: transparent;
            border: none;
            outline: none;
            color: hsl(var(--card-foreground));
            width: 100%;
            font-size: 14px;
            padding: 4px 8px;
          }
          .search-input::placeholder {
            color: hsl(var(--muted-foreground));
          }
          .dropdown-content {
            max-height: 215px; /* Increased by 15px for draggable header */
            overflow-y: auto;
            overflow-x: hidden;
            padding: 4px;
            box-sizing: border-box;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .dropdown-content::-webkit-scrollbar {
            display: none;
          }
          .dropdown-item {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            color: hsl(var(--card-foreground));
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
            background: hsl(var(--accent));
          }
          .dropdown-item.selected {
            background: hsl(var(--accent));
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
