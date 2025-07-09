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
let actionMenuWindow: BrowserWindow | null = null;
let settingsWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// Initialize electron store for settings
const store = new Store({
  defaults: {
    shortcut: 'CommandOrControl+\\',
    windowBounds: { width: 520, height: 160 }, // Start with minimum dimensions
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
      maxTokens: 4096,
      systemPrompt: 'You are a helpful AI assistant. Please provide concise and helpful responses.',
      providers: {
        openai: { apiKey: '', lastSelectedModel: 'gpt-4o' },
        openrouter: { apiKey: '', lastSelectedModel: 'mistralai/mistral-7b-instruct:free' },
        requesty: { apiKey: '', lastSelectedModel: 'openai/gpt-4o-mini' },
        ollama: { apiKey: '', baseUrl: 'http://localhost:11434', lastSelectedModel: 'llama2' },
        replicate: { apiKey: '', lastSelectedModel: 'meta/llama-2-70b-chat' },
      },
    },
    ui: {
      theme: 'system',
      alwaysOnTop: true,
      startMinimized: false,
      opacity: 1.0,
      fontSize: 'medium',
      windowBounds: {
        width: 520,
        height: 160,
      },
    },
    shortcuts: {
      toggleWindow: 'CommandOrControl+\\',
      processClipboard: 'CommandOrControl+Shift+\\',
    },
    general: {
      autoStartWithSystem: false,
      showNotifications: true,
      saveConversationHistory: true,
    },
  }
}) as any;



function createWindow() {
  const bounds = store.get('windowBounds') as { width: number; height: number };

  mainWindow = new BrowserWindow({
    width: Math.max(bounds.width, 520), // Ensure minimum width for all UI elements
    height: Math.max(bounds.height, 160), // Ensure minimum height for input + toolbar
    minWidth: 520, // Ensure all bottom toolbar buttons are visible (calculated from UI elements)
    minHeight: 160, // Ensure input + full toolbar are always visible
    maxWidth: 1400,
    maxHeight: 1000,
    show: !store.get('startMinimized'),
    alwaysOnTop: store.get('alwaysOnTop') as boolean,
    frame: false, // Remove traditional frame completely for Windows
    resizable: true,
    skipTaskbar: false, // Show in taskbar
    autoHideMenuBar: true, // Hide menu bar
    titleBarStyle: 'hidden', // Hide title bar completely
    transparent: false, // Keep opaque for better performance
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // Allow localStorage and cross-origin requests
      allowRunningInsecureContent: true,
      partition: 'persist:littlellm', // Enable localStorage and persistent storage
      zoomFactor: 1.0,
      disableBlinkFeatures: 'Auxclick',
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

  // Set initial window properties from app settings
  const appSettings = appStore.store;
  if (appSettings.ui && appSettings.ui.opacity !== undefined) {
    mainWindow.setOpacity(appSettings.ui.opacity);
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
  // Get shortcut from the new app settings store
  const appSettings = appStore.store;
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
      createWindow();
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

// Disable GPU acceleration to prevent crashes
app.disableHardwareAcceleration();

// Add command line switches for better compatibility
app.commandLine.appendSwitch('--disable-gpu');
app.commandLine.appendSwitch('--disable-gpu-sandbox');
app.commandLine.appendSwitch('--disable-software-rasterizer');
app.commandLine.appendSwitch('--no-sandbox');

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

      // Handle shortcut updates
      if (settings.shortcuts && settings.shortcuts.toggleWindow) {
        const currentSettings = appStore.store;
        const currentShortcut = currentSettings.shortcuts?.toggleWindow || 'CommandOrControl+\\';
        const newShortcut = settings.shortcuts.toggleWindow;

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
              createWindow();
            }
          });

          // Update the old store format for compatibility
          store.set('shortcut', newShortcut);
        }
      }

      // Handle UI settings
      if (settings.ui && mainWindow) {
        if (settings.ui.alwaysOnTop !== undefined) {
          mainWindow.setAlwaysOnTop(settings.ui.alwaysOnTop);
        }
        if (settings.ui.opacity !== undefined) {
          mainWindow.setOpacity(settings.ui.opacity);
        }
      }

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

  ipcMain.handle('resize-window', (_, { width, height }) => {
    if (mainWindow) {
      mainWindow.setSize(width, height);
    }
  });

  ipcMain.handle('take-screenshot', async () => {
    try {
      const { screen, desktopCapturer } = require('electron');

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
  ipcMain.handle('open-action-menu', () => {
    if (!mainWindow) return;

    if (actionMenuWindow) {
      actionMenuWindow.focus();
      return;
    }

    // Get main window position to position overlay relative to it
    const mainBounds = mainWindow.getBounds();

    actionMenuWindow = new BrowserWindow({
      width: 600,
      height: 400,
      x: mainBounds.x + (mainBounds.width - 600) / 2, // Center horizontally over main window
      y: mainBounds.y + 50, // Position below main window input
      show: false,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      transparent: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: false,
      },
    });

    const startUrl = isProduction ? 'http://localhost:3001/index.html' : 'http://localhost:3000';
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
  });

  ipcMain.handle('close-action-menu', () => {
    if (actionMenuWindow) {
      actionMenuWindow.close();
    }
  });

  ipcMain.handle('open-settings-overlay', () => {
    if (!mainWindow) return;

    if (settingsWindow) {
      settingsWindow.focus();
      return;
    }

    // Get main window position to position overlay relative to it
    const mainBounds = mainWindow.getBounds();

    settingsWindow = new BrowserWindow({
      width: 800,
      height: 600,
      x: mainBounds.x + (mainBounds.width - 800) / 2, // Center horizontally over main window
      y: mainBounds.y + 50, // Position below main window
      show: false,
      frame: false,
      resizable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      transparent: false,
      minWidth: 600,
      minHeight: 400,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: false,
      },
    });

    const startUrl = isProduction ? 'http://localhost:3001/index.html' : 'http://localhost:3000';
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
