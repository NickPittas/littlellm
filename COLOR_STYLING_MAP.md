# LiteLLM Color Styling and Theme Map

This document maps out all locations where CSS styling and colors are defined or changed throughout the codebase.

## 🎨 **Primary Color Definition Files**

### 1. **src/app/globals.css** - Main CSS Variables & Styling
- **Lines 7-38**: Root CSS variables defining the entire color palette
  - `--background: #1e1e1e` (VS Code dark background)
  - `--foreground: #d4d4d4` (VS Code text color)
  - `--card: #2d2d30` (VS Code panel color)
  - `--primary: #569cd6` (VS Code blue)
  - `--secondary: #4fc1ff` (VS Code cyan)
  - `--accent: #c586c0` (VS Code purple)
  - `--muted: #3c3c3c` (VS Code muted)
  - `--border: #464647` (VS Code border)
  - `--destructive: #f44747` (VS Code red)

- **Lines 92-134**: Body and container styling
  - Forces background colors on html, body, #__next
  - Hardcoded fallback colors: `#1e1e1e`, `#d4d4d4`

- **Lines 141-159**: Component styling overrides
  - Button, input, textarea, select styling
  - Card and dialog content styling

- **Lines 181-228**: Chat bubble color overrides
  - Hardcoded VS Code colors for user/assistant messages
  - `#569cd6` for user messages
  - `#3c3c3c` for assistant messages

- **Lines 241-268**: Radix UI component styling
  - Dropdown menus, popover content
  - Select items and hover states

### 2. **tailwind.config.js** - Tailwind Color Configuration
- **Lines 19-53**: Tailwind color mappings to CSS variables
  - Maps Tailwind classes to `hsl(var(--variable))` format
  - Defines primary, secondary, destructive, muted, accent colors

## 🖥️ **Electron Window Styling**

### 3. **electron/main.ts** - Electron Window Configuration
- **Line 1009**: Main window backgroundColor: `#1e1e1e`
- **Line 2154**: Settings window backgroundColor: `#1e1e1e`
- **Lines 2272-2289**: External window CSS variables (dropdown panels)
- **Lines 2588-2606**: Secondary external window CSS variables
- **Lines 2292-2301**: External window body styling

## ⚛️ **React Component Styling**

### 4. **src/app/layout.tsx** - Root Layout Styling
- **Line 22**: HTML element background: `var(--background)`
- **Line 38**: Dynamic background setting: `var(--background)`
- **Lines 50-57**: Body element styling with CSS variables

### 5. **src/components/VoilaInterface.tsx** - Main Interface
- **Lines 905-911**: Main container styling
  - Uses `var(--background)` and `var(--foreground)`
- **Line 927**: Input area card styling: `var(--card)`, `var(--border)`
- **Line 990-996**: Textarea styling: `var(--input)`, `var(--border)`
- **Line 1076**: Chat container styling: `var(--card)`, `var(--border)`
- **Line 1210**: Bottom toolbar styling: `var(--card)`, `var(--border)`
- **Lines 1147-1149**: Chat message bubble classes

### 6. **src/components/ChatInterface.tsx** - Chat Component
- **Lines 395-396**: Hardcoded chat bubble colors
  - User: `rgb(59, 130, 246)` (old blue)
  - Assistant: `rgb(55, 65, 81)` (old gray)

## 🎭 **Theme System**

### 7. **src/contexts/ThemeContext.tsx** - Theme Management
- **Lines 71-95**: Light theme definition
- **Lines 688-709**: VS Code theme definition
- **Lines 739-746**: Dark theme detection logic
- **Lines 748-756**: Theme class application (dark/light)
- **Lines 771-813**: Theme loading and application logic

## 🧩 **UI Component Styling**

### 8. **src/components/ui/button.tsx** - Button Variants
- **Lines 6-33**: Button variant definitions using CSS variables
  - `bg-primary`, `bg-destructive`, `bg-secondary`, etc.

### 9. **src/components/ui/badge.tsx** - Badge Variants
- **Lines 5-23**: Badge variant definitions using CSS variables

### 10. **src/components/SquircleWindow.tsx** - Window Styling
- **Lines 45-86**: Dynamic CSS injection for rounded corners
- **Lines 100-124**: Force repaint logic

## 🔧 **Configuration Files**

### 11. **postcss.config.js** - PostCSS Configuration
- Tailwind CSS processing configuration

## ⚠️ **Issues Identified**

### Hardcoded Colors Still Present:
1. **ChatInterface.tsx** (lines 395-396): Old hardcoded RGB values
2. **globals.css** (lines 126-133): Hardcoded fallback colors
3. **globals.css** (lines 181-211): Hardcoded VS Code colors in overrides

### CSS Variable Conflicts:
1. **Tailwind expects HSL format**: `hsl(var(--variable))`
2. **CSS variables defined as HEX**: `#1e1e1e`
3. **Mixed usage**: Some components use CSS vars, others use hardcoded

### Theme System Issues:
1. **Multiple theme sources**: globals.css + ThemeContext.tsx
2. **Inconsistent application**: Some components bypass theme system
3. **Electron window styling**: Separate from React theme system

## ✅ **FIXES COMPLETED**

### **Single Source of Truth Established:**
1. **ThemeContext.tsx**: Now contains ONLY VS Code theme
2. **globals.css**: Uses CSS variables consistently
3. **ChatInterface.tsx**: Removed hardcoded RGB colors
4. **Electron main.ts**: Uses consistent VS Code colors
5. **ThemeSelector.tsx**: Disabled (only one theme available)

### **All Color Conflicts Removed:**
- ❌ Removed 20+ unnecessary themes
- ❌ Removed hardcoded `rgb()` colors
- ❌ Removed conflicting CSS overrides
- ✅ Single VS Code theme controls ALL colors
- ✅ Consistent HSL format throughout
- ✅ No more theme switching complexity

### **Result:**
🎨 **ONE PLACE CONTROLS ALL COLORS**: `src/contexts/ThemeContext.tsx` (VS Code theme)
