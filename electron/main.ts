import { app, BrowserWindow, globalShortcut, Tray, Menu, clipboard, ipcMain, nativeImage, protocol, session, net } from 'electron';
import * as path from 'path';
import * as isDev from 'electron-is-dev';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import * as os from 'os';
import { pathToFileURL } from 'url';
import * as http from 'http';
import * as fs from 'fs';
import * as mime from 'mime-types';

// More reliable way to detect production vs development
const isProduction = app.isPackaged || process.env.NODE_ENV === 'production';
import Store from 'electron-store';

// HTTP server for serving static files
let staticServer: http.Server | null = null;

// Function to get the correct icon path for different environments
function getIconPath(): string {
  const possiblePaths = [
    path.join(__dirname, '../assets/icon.ico'),
    path.join(__dirname, '../../assets/icon.ico'),
    path.join(process.resourcesPath, 'assets/icon.ico'),
    path.join(app.getAppPath(), 'assets/icon.ico'),
  ];

  for (const iconPath of possiblePaths) {
    if (existsSync(iconPath)) {
      console.log('Using icon path:', iconPath);
      return iconPath;
    }
  }

  console.warn('Icon file not found, using default');
  return path.join(__dirname, '../assets/icon.ico'); // fallback
}

function createStaticServer() {
  const server = http.createServer((req, res) => {
    if (!req.url) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    let filePath: string;
    const urlPath = req.url.startsWith('/') ? req.url.slice(1) : req.url;

    if (isProduction) {
      filePath = path.join(process.resourcesPath, 'out', urlPath);
    } else {
      filePath = path.join(__dirname, '..', 'out', urlPath);
    }

    console.log('Static server request:', req.url, '-> ', filePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mimeType });
      fs.createReadStream(filePath).pipe(res);
    } else {
      console.log('File not found:', filePath);
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(3001, 'localhost', () => {
    console.log('Static server running on http://localhost:3001');
  });

  return server;
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
let tray: Tray | null = null;
let isQuitting = false;

// Initialize electron store for settings
const store = new Store({
  defaults: {
    shortcut: 'CommandOrControl+Shift+L',
    windowBounds: { width: 400, height: 600 },
    alwaysOnTop: true,
    startMinimized: false,
  }
}) as any;

// Initialize separate store for app settings
const appStore = new Store({
  name: 'app-settings',
  defaults: {
    chat: {
      provider: 'openrouter',
      model: 'mistralai/mistral-7b-instruct:free',
      temperature: 0.7,
      maxTokens: 2048,
      systemPrompt: 'You are a helpful AI assistant. Please provide concise and helpful responses.',
      providers: {
        openai: { apiKey: '' },
        openrouter: { apiKey: '' },
        requesty: { apiKey: '' },
        ollama: { apiKey: '', baseUrl: 'http://localhost:11434' },
        replicate: { apiKey: '' },
      },
    }
  }
}) as any;

function createWindow() {
  const bounds = store.get('windowBounds') as { width: number; height: number };

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    minWidth: 350,
    minHeight: 400,
    maxWidth: 800,
    maxHeight: 1000,
    show: !store.get('startMinimized'),
    alwaysOnTop: store.get('alwaysOnTop') as boolean,
    frame: true,
    resizable: true,
    skipTaskbar: false, // Show in taskbar
    autoHideMenuBar: true, // Hide menu bar
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // Allow localStorage and cross-origin requests
      allowRunningInsecureContent: true,
      partition: 'persist:littlellm', // Enable localStorage and persistent storage
    },
    icon: getIconPath(),
  });

  // Load the app
  let startUrl: string;
  if (isProduction) {
    // Load from local HTTP server
    startUrl = 'http://localhost:3001/index.html';
  } else {
    startUrl = 'http://localhost:3000';
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
    if (existsSync(iconPath)) {
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        mainWindow.setIcon(icon);
        app.setAppUserModelId('com.littlellm.app'); // Set app ID for Windows taskbar grouping
      }
    }
  }

  console.log('About to load URL:', startUrl);

  mainWindow.loadURL(startUrl).then(() => {
    console.log('Successfully loaded URL');
  }).catch((error) => {
    console.error('Failed to load URL:', error);
  });

  // Add error handling for failed loads
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load page:', errorCode, errorDescription, validatedURL);
  });

  // Only open DevTools in development mode
  if (!isProduction) {
    mainWindow.webContents.openDevTools();
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
      store.set('windowBounds', { width: bounds.width, height: bounds.height });
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
          createWindow();
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
      createWindow();
    }
  });
}

function registerGlobalShortcuts() {
  const shortcut = store.get('shortcut') as string;

  // Register the main shortcut to toggle window
  globalShortcut.register(shortcut, () => {
    if (mainWindow) {
      if (mainWindow.isVisible() && mainWindow.isFocused()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  });

  // Register shortcut for clipboard processing
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    const clipboardText = clipboard.readText();
    if (clipboardText) {
      if (mainWindow) {
        mainWindow.webContents.send('process-clipboard', clipboardText);
        mainWindow.show();
        mainWindow.focus();
      } else {
        createWindow();
        // Wait for window to be ready then send clipboard content
        setTimeout(() => {
          if (mainWindow) {
            mainWindow.webContents.send('process-clipboard', clipboardText);
          }
        }, 1000);
      }
    }
  });
}

app.whenReady().then(() => {
  // Start static server for production
  if (isProduction) {
    staticServer = createStaticServer();
  }

  createWindow();
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
    return store.store;
  });

  ipcMain.handle('update-settings', (_, settings: any) => {
    // Update shortcut if changed
    const currentShortcut = store.get('shortcut') as string;
    if (settings.shortcut && settings.shortcut !== currentShortcut) {
      globalShortcut.unregister(currentShortcut);
      globalShortcut.register(settings.shortcut, () => {
        if (mainWindow) {
          if (mainWindow.isVisible() && mainWindow.isFocused()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        } else {
          createWindow();
        }
      });
    }

    // Update store
    Object.keys(settings).forEach(key => {
      store.set(key, settings[key]);
    });

    // Update window properties if needed
    if (mainWindow) {
      if (settings.alwaysOnTop !== undefined) {
        mainWindow.setAlwaysOnTop(settings.alwaysOnTop);
      }
    }
  });

  // Handle app settings
  ipcMain.handle('get-app-settings', () => {
    return appStore.store;
  });

  ipcMain.handle('update-app-settings', (_, settings: any) => {
    try {
      // Merge with existing settings
      const currentSettings = appStore.store;
      const newSettings = { ...currentSettings, ...settings };
      appStore.store = newSettings;
      console.log('App settings updated:', newSettings);
      return true;
    } catch (error) {
      console.error('Failed to update app settings:', error);
      return false;
    }
  });

  // Handle storage operations (alternative to localStorage)
  ipcMain.handle('get-storage-item', (_, key: string) => {
    try {
      return appStore.get(key);
    } catch (error) {
      console.error('Failed to get storage item:', error);
      return null;
    }
  });

  ipcMain.handle('set-storage-item', (_, key: string, value: any) => {
    try {
      appStore.set(key, value);
      return true;
    } catch (error) {
      console.error('Failed to set storage item:', error);
      return false;
    }
  });

  ipcMain.handle('remove-storage-item', (_, key: string) => {
    try {
      appStore.delete(key);
      return true;
    } catch (error) {
      console.error('Failed to remove storage item:', error);
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
}

app.on('window-all-closed', () => {
  // On Windows/Linux, keep the app running in the background
  // Only quit when explicitly requested
});

app.on('before-quit', () => {
  if (staticServer) {
    staticServer.close();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});
