# LittleLLM v2.0.1 - Complete Window & Color Variable Mapping

## WINDOW ARCHITECTURE OVERVIEW

LittleLLM v2.0.1 uses a multi-window architecture with consistent theming across all platforms (Windows, macOS, Linux).

### 1. **Main App Window**
- **Creation**: `createWindow()` in `electron/main.ts:1761`
- **URL**: `http://localhost:${port}` (no overlay param)
- **Content**: `VoilaInterface` component
- **Theme Source**: `ThemeProvider` in `src/contexts/ThemeContext.tsx`
- **CSS Variables**: Applied via `applyThemeToDOM()` function
- **Platform Support**: Windows, macOS (Intel + Apple Silicon), Linux

### 2. **Settings Window**
- **Creation**: `openSettingsOverlay()` in `electron/main.ts:1450` & `electron/main.ts:3525`
- **URL**: `http://localhost:${port}?overlay=settings`
- **Content**: `SettingsOverlay` component via `OverlayRouter`
- **Theme Source**: Same `ThemeProvider` but NEW INSTANCE
- **CSS Variables**: Applied via `applyThemeToDOM()` function
- **Features**: Cross-platform theme management, MCP server configuration

### 3. **Action Menu Window (Prompts)**
- **Creation**: `openActionMenu()` in `electron/main.ts:1524`
- **URL**: `http://localhost:${port}?overlay=action-menu`
- **Content**: `ActionMenuOverlay` component via `OverlayRouter`
- **Theme Source**: Same `ThemeProvider` but NEW INSTANCE
- **CSS Variables**: Applied via `applyThemeToDOM()` function
- **Features**: Quick actions, prompt management, clipboard integration

### 4. **Chat Window**
- **Creation**: `open-chat-window` handler in `electron/main.ts:3633`
- **URL**: `http://localhost:${port}?overlay=chat`
- **Content**: `ChatOverlay` component via `OverlayRouter`
- **Theme Source**: Same `ThemeProvider` but NEW INSTANCE
- **CSS Variables**: Applied via `applyThemeToDOM()` function
- **Features**: AI conversations, tool calling, memory context, vision support

### 5. **Chat History Window**
- **Creation**: `open-history` handler in `electron/main.ts:3408`
- **URL**: `data:text/html` (static HTML with embedded CSS)
- **Content**: Static HTML generated in `generateHistoryHTML()`
- **Theme Source**: CSS variables retrieved from main window
- **CSS Variables**: Injected as static CSS in HTML
- **Features**: Conversation history, search, export

### 6. **Dropdown Windows**
- **Creation**: `open-dropdown` handler in `electron/main.ts:3819`
- **URL**: `data:text/html` (static HTML with embedded CSS)
- **Content**: Static HTML with dropdown items
- **Theme Source**: CSS variables retrieved from main window
- **CSS Variables**: Injected as static CSS in HTML
- **Features**: Provider selection, model selection, MCP server management

## CSS VARIABLE DEFINITIONS

### Core Variables (defined in `src/app/globals.css:7-39`)
```css
--background: 24 24 41;           /* Main background color */
--foreground: 212 212 212;        /* Main text color */
--card: 24 24 41;                 /* Panel/card background */
--card-foreground: 255 255 255;   /* Panel/card text */
--primary: 86 156 214;            /* Button & link color */
--primary-foreground: 255 255 255; /* Button text color */
--secondary: 79 193 255;          /* Secondary elements */
--secondary-foreground: 173 173 173; /* Secondary text */
--accent: 86 156 214;             /* Accent/hover color */
--accent-foreground: 255 255 255; /* Accent text */
--muted: 33 31 50;                /* Subtle background */
--muted-foreground: 156 163 175;  /* Subtle text */
--border: 59 59 104;              /* Border & divider color */
--input: 148 148 148;             /* Input field background */
--ring: 86 156 214;               /* Focus outline color */
--destructive: 244 71 71;         /* Error & delete color */
--destructive-foreground: 255 255 255; /* Error text */
```

### Tailwind Mapping (defined in `tailwind.config.js:20-48`)
```javascript
background: "hsl(var(--background))"
foreground: "hsl(var(--foreground))"
primary: "hsl(var(--primary))"
// ... etc
```

## SETTINGS APPEARANCE CONTROLS MAPPING

### Settings UI Labels → CSS Variables (from `SettingsOverlay.tsx:1273-1357`)
```
"Main Background" → customColors.background → --background
"Main Text Color" → customColors.foreground → --foreground  
"Button & Link Color" → customColors.primary → --primary
"Button Text Color" → customColors.primaryForeground → --primary-foreground
"Panel Background" → customColors.card → --card
"Panel Text Color" → customColors.cardForeground → --card-foreground
"Subtle Background" → customColors.muted → --muted
"Subtle Text Color" → customColors.mutedForeground → --muted-foreground
"Border & Divider Color" → customColors.border → --border
"Input Field Background" → customColors.input → --input
"Focus Outline Color" → customColors.ring → --ring
"Error & Delete Color" → customColors.destructive → --destructive
"Error Text Color" → customColors.destructiveForeground → --destructive-foreground
```

## CRITICAL ISSUES IDENTIFIED

### 1. **Multiple Theme Provider Instances**
- Each overlay window creates its own `ThemeProvider` instance
- Settings changes in one window don't propagate to others
- Each window loads theme independently from localStorage

### 2. **Static HTML Windows Don't Receive Updates**
- Chat History window uses static HTML
- Dropdown windows use static HTML  
- These only get CSS variables at creation time
- No live updates when theme changes

### 3. **Window Creation Errors**
- `Cannot read properties of null (reading 'loadURL')` errors
- Windows being destroyed before loadURL is called
- Race conditions in window management

### 4. **Hardcoded Electron Background**
- Main window still has `backgroundColor: '#181829'` in `electron/main.ts:1740`
- This overrides React theme system

## SOLUTION IMPLEMENTATION PLAN

### Phase 1: Fix Window Creation Errors
1. Fix null reference errors in window handlers
2. Ensure proper window lifecycle management
3. Remove hardcoded backgroundColor from main window

### Phase 2: Implement Unified Theme Broadcasting
1. Create centralized theme state management
2. Implement IPC-based theme synchronization
3. Ensure all React windows receive theme updates

### Phase 3: Fix Static HTML Windows
1. Implement dynamic CSS variable injection
2. Add theme update listeners for static windows
3. Recreate static windows on theme changes

### Phase 4: Comprehensive Testing
1. Test all windows respond to theme changes
2. Verify color mapping consistency
3. Ensure no hardcoded colors remain

## WINDOW-SPECIFIC COLOR USAGE

### Main Window (`VoilaInterface`)
- Uses all CSS variables via Tailwind classes
- Background: `bg-background`
- Text: `text-foreground`
- Buttons: `bg-primary text-primary-foreground`

### Settings Window (`SettingsOverlay`)
- Uses all CSS variables via Tailwind classes
- Color pickers directly modify CSS variables
- Preview updates happen in real-time

### Action Menu Window (`ActionMenuOverlay`)
- Uses all CSS variables via Tailwind classes
- Search input: `bg-muted text-foreground`
- Items: `hover:bg-accent`

### Chat Window (`ChatOverlay`)
- Uses all CSS variables via Tailwind classes
- Messages: `bg-primary` (user) / `bg-muted` (assistant)

### Chat History Window (Static HTML)
- Uses CSS variables injected at creation
- Background: `hsl(var(--background))`
- Items: `hsl(var(--card))` with `hsl(var(--accent))` hover

### Dropdown Windows (Static HTML)
- Uses CSS variables injected at creation
- Background: `hsl(var(--card))`
- Items: `hsl(var(--muted))` with `hsl(var(--accent))` hover
