import { app, BrowserWindow, globalShortcut, Tray, Menu, clipboard, ipcMain, nativeImage, protocol, session, net } from 'electron';
import * as path from 'path';
import * as isDev from 'electron-is-dev';
import * as fs from 'fs';
import * as os from 'os';
import { pathToFileURL } from 'url';
import * as http from 'http';
import * as mime from 'mime-types';
import Store from 'electron-store';

// More reliable way to detect production vs development
const isProduction = app.isPackaged || process.env.NODE_ENV === 'production';



// Function to get the correct icon path for different environments
function getIconPath(): string {
  const possiblePaths = [
    path.join(__dirname, '../assets/icon.ico'),
    path.join(__dirname, '../../assets/icon.ico'),
    path.join(process.resourcesPath, 'assets/icon.ico'),
    path.join(app.getAppPath(), 'assets/icon.ico'),
  ];

  for (const iconPath of possiblePaths) {
    if (fs.existsSync(iconPath)) {
      console.log('Using icon path:', iconPath);
      return iconPath;
    }
  }

  console.warn('Icon file not found, using default');
  return path.join(__dirname, '../assets/icon.ico'); // fallback
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
    frame: true, // Enable frame for dragging
    resizable: true, // Allow resizing
    alwaysOnTop: true,
    skipTaskbar: true,
    transparent: false,
    titleBarStyle: 'default', // Show title bar for dragging
    title: 'Prompts',
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

function loadAppSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return {};
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



async function createWindow() {
  const appSettings = loadAppSettings();
  const bounds = appSettings.ui?.windowBounds || { width: 570, height: 142 };

  mainWindow = new BrowserWindow({
    width: Math.max(bounds.width, 350), // Ensure minimum width for all UI elements
    height: Math.max(bounds.height, 142), // Ensure minimum height for input + toolbar
    minWidth: 350, // Ensure all bottom toolbar buttons are visible (calculated from UI elements)
    minHeight: 142, // Ensure input + full toolbar are always visible
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
      webSecurity: true, // Enable web security
      allowRunningInsecureContent: false,
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
    if (tray && process.platform === 'darwin') {
      // setHighlightMode is macOS only
      (tray as any).setHighlightMode('always');
    }
  });

  mainWindow.on('hide', () => {
    if (tray && process.platform === 'darwin') {
      // setHighlightMode is macOS only
      (tray as any).setHighlightMode('never');
    }
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
    return { width: 570, height: 180 }; // Default size
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
      frame: true, // Enable frame for dragging
      resizable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      transparent: false,
      titleBarStyle: 'default', // Show title bar for dragging
      title: 'Settings',
      minWidth: 600,
      minHeight: 400,
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

  // Handle theme change notifications from overlay to main window
  ipcMain.handle('notify-theme-change', (_, themeId: string) => {
    if (mainWindow) {
      mainWindow.webContents.send('theme-changed', themeId);
    }
  });
}

app.on('window-all-closed', () => {
  // On Windows/Linux, keep the app running in the background
  // Only quit when explicitly requested
});

app.on('before-quit', () => {
  isQuitting = true;
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
