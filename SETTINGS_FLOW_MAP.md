# Settings Window Flow Map

## 1. USER ACTION: Click Settings Button

### Location: Main Window UI
- **File**: `src/components/BottomToolbarNew.tsx`
- **Lines**: 537-550
- **Code**:
```tsx
<Button
  variant="ghost"
  size="sm"
  onClick={() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.openSettingsOverlay();
    }
  }}
  className="h-8 w-8 p-0"
  title="Settings"
  data-interactive="true"
>
  <Settings className="h-4 w-4" />
</Button>
```

## 2. ELECTRON API CALL: openSettingsOverlay()

### Location: Preload Script
- **File**: `electron/preload.ts`
- **Line**: 87
- **Code**:
```typescript
openSettingsOverlay: () => ipcRenderer.invoke('open-settings-overlay'),
```

### What happens:
- Calls `ipcRenderer.invoke('open-settings-overlay')`
- This sends IPC message to Electron main process

## 3. ELECTRON MAIN PROCESS: IPC Handler

### Location: Main Process
- **File**: `electron/main.ts`
- **Function**: `openSettingsOverlay()`
- **Lines**: 1436-1504
- **Code**:
```typescript
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
```

### What happens:
1. Creates new BrowserWindow with specific settings
2. Determines URL based on environment (dev vs production)
3. Loads URL: `http://localhost:3000?overlay=settings` (in dev mode)
4. Shows window when ready

## 4. NEXT.JS ROUTING: Page Load

### Location: App Router
- **File**: `src/app/page.tsx`
- **Lines**: 1-31
- **Code**:
```tsx
export default function Home() {
  // Home component rendering
  const [isOverlay, setIsOverlay] = useState(false);

  useEffect(() => {
    console.log('Home component mounted');
    // Check if this is an overlay window
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      setIsOverlay(urlParams.has('overlay'));
    }
  }, []);

  if (isOverlay) {
    return (
      <div className="h-full w-full bg-background" style={{ width: '100vw', height: '100vh' }}>
        <OverlayRouter />
      </div>
    );
  }

  return (
    <VoilaInterface />
  );
}
```

### What happens:
1. Page loads with URL parameter `?overlay=settings`
2. `useEffect` detects `overlay` parameter
3. Sets `isOverlay = true`
4. Renders `<OverlayRouter />` instead of main interface

## 5. OVERLAY ROUTING: Component Selection

### Location: Overlay Router
- **File**: `src/components/OverlayRouter.tsx`
- **Lines**: 8-34
- **Code**:
```tsx
export function OverlayRouter() {
  const [overlayType, setOverlayType] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    // Check URL parameters to determine overlay type
    const urlParams = new URLSearchParams(window.location.search);
    const overlay = urlParams.get('overlay');
    setOverlayType(overlay);
  }, []);

  if (!isClient || !overlayType) {
    return null;
  }

  switch (overlayType) {
    case 'action-menu':
      return <ActionMenuOverlay />;
    case 'settings':
      return <SettingsOverlay />;
    case 'chat':
      return <ChatOverlay />;
    default:
      return null;
  }
}
```

### What happens:
1. Reads URL parameter `overlay=settings`
2. Sets `overlayType = 'settings'`
3. Returns `<SettingsOverlay />` component

## 6. SETTINGS COMPONENT: Final Render

### Location: Settings Component
- **File**: `src/components/SettingsOverlay.tsx`
- **Current Implementation**: Manual tabs with conditional rendering
- **Expected Behavior**: Should show navigation tabs + colored content areas
- **Actual Behavior**: Only shows navigation tabs, no content

## ANALYSIS: Where the Problem Might Be

### Possible Issues:

1. **CSS/Styling Conflicts**:
   - Global CSS might be hiding content
   - Tailwind classes might not be working
   - Height/width constraints

2. **React Rendering Issues**:
   - State not updating properly
   - Conditional rendering not working
   - Component not re-rendering

3. **Build/Cache Issues**:
   - Old compiled version being used
   - Hot reload not working
   - Browser cache

4. **Environment Issues**:
   - Development vs production differences
   - Port detection issues
   - File serving problems

### Next Steps for Debugging:

1. Add console.log statements to track component rendering
2. Check browser developer tools for errors
3. Verify which version of the component is actually loading
4. Check if CSS is being applied correctly
5. Test with minimal component to isolate the issue
