# LittleLLM UI Transparency and Rounded Corners Implementation Guide

This document provides a comprehensive overview of the libraries, techniques, and implementation details used to create the rounded corners and semi-transparent UI effects in LittleLLM.

## Core Libraries and Dependencies

### 1. Figma Squircle (`figma-squircle`)
**Version**: 1.1.0  
**Purpose**: Creates smooth, rounded corners with squircle (super-ellipse) shapes instead of traditional circular border-radius

```bash
npm install figma-squircle@^1.1.0
```

**Key Features**:
- Generates SVG paths for squircle shapes
- Provides more aesthetically pleasing rounded corners
- Used for window-level corner smoothing
- Integrates with CSS clip-path for precise corner control

**Implementation Files**:
- `src/utils/squircle.ts` - Core squircle utilities
- `src/hooks/useSquircle.ts` - React hooks for squircle styling
- `src/components/SquircleWindow.tsx` - Window-level squircle application

### 2. Tailwind CSS with Custom Extensions
**Purpose**: Base styling framework with custom transparency utilities

**Key Configuration** (`tailwind.config.js`):
- Custom color system with HSL variables
- Extended border radius utilities
- Animation keyframes for floating effects
- Responsive design breakpoints

### 3. Radix UI Primitives
**Purpose**: Accessible UI components with transparency support

**Key Components Used**:
- Dialog overlays with backdrop blur
- Select dropdowns with floating effects
- Popover components with transparency
- Focus management for floating elements

## Transparency Implementation Architecture

### 1. Context-Based Transparency Management

**File**: `src/contexts/TransparencyContext.tsx`

```typescript
interface TransparencyContextType {
  isTransparencyEnabled: boolean;
  config: TransparencyConfig | null;
  capabilities: PlatformCapabilities | null;
  enableTransparency: () => Promise<void>;
  disableTransparency: () => Promise<void>;
  updateOpacity: (opacity: number) => Promise<void>;
  updateVibrancyType: (type: string) => Promise<void>;
  isSupported: boolean;
  isInitialized: boolean;
}
```

**Key Features**:
- Platform capability detection
- Dynamic transparency toggling
- Opacity and vibrancy control
- Cross-component state management

### 2. Electron Window Transparency

**File**: `electron/main.ts`

**Platform-Specific Implementation**:

#### macOS (Vibrancy Effects)
```typescript
const windowOptions: BrowserWindowConstructorOptions = {
  transparent: true,
  backgroundColor: 'rgba(0,0,0,0)',
  vibrancy: 'under-window', // Options: titlebar, selection, menu, popover, sidebar, etc.
  visualEffectState: 'active'
};
```

#### Windows (DWM Integration)
```typescript
const windowOptions: BrowserWindowConstructorOptions = {
  transparent: true,
  backgroundColor: 'rgba(0,0,0,0)',
  // Additional DWM configuration for Windows 10/11
};
```

#### Linux (Compositor Support)
```typescript
const windowOptions: BrowserWindowConstructorOptions = {
  transparent: true,
  backgroundColor: 'rgba(0,0,0,0)',
  // Wayland/X11 compositor integration
};
```

## CSS Implementation Details

### 1. Global Transparency Styles

**File**: `src/app/globals.css`

#### Base Transparency Setup
```css
html, body, #__next {
  background: transparent !important;
  border-radius: 20px !important;
  -electron-corner-smoothing: 80% !important;
  overflow: hidden !important;
  /* Hardware acceleration */
  -webkit-transform: translateZ(0);
  transform: translateZ(0);
  will-change: auto;
}
```

#### Squircle Corner Implementation
```css
html {
  border-radius: 20px !important;
  -electron-corner-smoothing: 80% !important;
}
```

### 2. Floating UI Components

#### Container Styles
```css
.floating-container {
  background: rgba(24, 24, 41, 0.85) !important;
  backdrop-filter: blur(20px) saturate(180%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
  border: 1px solid rgba(59, 59, 104, 0.3) !important;
  border-radius: 20px !important;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 1px 0 rgba(255, 255, 255, 0.1) inset !important;
}
```

#### Card Components
```css
.floating-card {
  background: rgba(24, 24, 41, 0.9) !important;
  backdrop-filter: blur(16px) saturate(150%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(150%) !important;
  border: 1px solid rgba(59, 59, 104, 0.4) !important;
  border-radius: 16px !important;
  box-shadow: 
    0 4px 16px rgba(0, 0, 0, 0.25),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset,
    0 1px 0 rgba(255, 255, 255, 0.08) inset !important;
}
```

#### Input Elements
```css
.floating-input {
  background: rgba(32, 30, 49, 0.85) !important;
  backdrop-filter: blur(12px) saturate(120%) !important;
  -webkit-backdrop-filter: blur(12px) saturate(120%) !important;
  border: 1px solid rgba(59, 59, 104, 0.5) !important;
  border-radius: 12px !important;
}
```

#### Button Elements
```css
.floating-button {
  background: rgba(86, 156, 214, 0.9) !important;
  backdrop-filter: blur(8px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(8px) saturate(140%) !important;
  border: 1px solid rgba(86, 156, 214, 0.4) !important;
  border-radius: 12px !important;
}
```

### 3. Transparency-Aware Text Styling

```css
.transparent-text {
  color: rgba(212, 212, 212, 0.98) !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
}

.transparent-text-muted {
  color: rgba(156, 163, 175, 0.85) !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.transparent-text-accent {
  color: rgba(86, 156, 214, 0.95) !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
```

## React Component Implementation

### 1. Floating UI Components

**File**: `src/components/ui/floating-ui.tsx`

```typescript
interface FloatingContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: 1 | 2 | 3 | 4 | 'modal';
  variant?: 'container' | 'card' | 'toolbar' | 'dropdown' | 'message';
  responsive?: boolean;
  enterAnimation?: boolean;
}

export const FloatingContainer = React.forwardRef<HTMLDivElement, FloatingContainerProps>(
  ({ className, level = 1, variant = 'container', responsive = false, enterAnimation = false, ...props }, ref) => {
    const { getFloatingClass } = useTransparencyAwareStyles();
    
    const baseClass = `floating-${variant}`;
    const layerClass = getFloatingClass(level);
    const responsiveClass = responsive ? 'floating-responsive' : '';
    const animationClass = enterAnimation ? 'floating-enter' : '';
    
    return (
      <div
        ref={ref}
        className={cn(baseClass, layerClass, responsiveClass, animationClass, className)}
        {...props}
      />
    );
  }
);
```

### 2. Squircle Utilities

**File**: `src/utils/squircle.ts`

```typescript
import { getSvgPath } from 'figma-squircle';

export function generateSquircleClipPath(
  cornerRadius: number = 12,
  cornerSmoothing: number = 0.6,
  width: number = 400,
  height: number = 600
): string {
  try {
    const svgPath = getSvgPath({
      width,
      height,
      cornerRadius,
      cornerSmoothing,
    });
    
    return `path('${svgPath}')`;
  } catch (error) {
    console.warn('Failed to generate squircle clip-path, falling back to border-radius:', error);
    return 'none';
  }
}

export function generateSquircleCSS(
  cornerRadius: number = 12,
  cornerSmoothing: number = 0.6
) {
  return {
    '--squircle-radius': `${cornerRadius}px`,
    '--squircle-smoothing': `${Math.round(cornerSmoothing * 100)}%`,
    'border-radius': `${cornerRadius}px`,
    '-electron-corner-smoothing': `${Math.round(cornerSmoothing * 100)}%`,
  };
}
```

### 3. Transparency-Aware Hooks

```typescript
export function useTransparencyAwareStyles() {
  const { isTransparencyEnabled, isSupported } = useTransparency();
  
  const getTransparencyClass = (baseClass: string, transparentClass: string) => {
    return isTransparencyEnabled && isSupported ? transparentClass : baseClass;
  };

  const getFloatingClass = (level: 1 | 2 | 3 | 4 | 'modal' = 1) => {
    if (!isTransparencyEnabled || !isSupported) return '';
    return `floating-layer-${level}`;
  };

  return {
    isTransparent: isTransparencyEnabled && isSupported,
    getTransparencyClass,
    getFloatingClass,
    textClass: isTransparencyEnabled && isSupported ? 'transparent-text' : '',
    mutedTextClass: isTransparencyEnabled && isSupported ? 'transparent-text-muted' : '',
    accentTextClass: isTransparencyEnabled && isSupported ? 'transparent-text-accent' : ''
  };
}
```

## Advanced Features

### 1. Click-Through Behavior

```css
/* Global click-through - makes entire element non-interactive */
.click-through {
  pointer-events: none !important;
}

/* Selective click-through - transparent areas non-interactive, UI elements interactive */
.click-through-selective {
  pointer-events: none !important;
}

.click-through-selective .interactive,
.click-through-selective button,
.click-through-selective input,
.click-through-selective textarea {
  pointer-events: auto !important;
}
```

### 2. Visual Hierarchy with Z-Index Layers

```css
.floating-layer-1 { z-index: 10; }
.floating-layer-2 { z-index: 20; }
.floating-layer-3 { z-index: 30; }
.floating-layer-4 { z-index: 40; }
.floating-layer-modal { z-index: 50; }
```

### 3. Backdrop Blur Variants

```css
.floating-blur-light {
  backdrop-filter: blur(8px) saturate(120%) !important;
  -webkit-backdrop-filter: blur(8px) saturate(120%) !important;
}

.floating-blur-medium {
  backdrop-filter: blur(16px) saturate(140%) !important;
  -webkit-backdrop-filter: blur(16px) saturate(140%) !important;
}

.floating-blur-heavy {
  backdrop-filter: blur(24px) saturate(160%) !important;
  -webkit-backdrop-filter: blur(24px) saturate(160%) !important;
}
```

### 4. Animation System

```css
@keyframes float-in {
  0% {
    opacity: 0;
    transform: translateY(20px) scale(0.95);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.floating-enter {
  animation: float-in 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
```

## Platform-Specific Considerations

### macOS
- **Vibrancy Effects**: Native macOS blur and transparency
- **Corner Smoothing**: `-electron-corner-smoothing` property
- **Performance**: Hardware-accelerated compositing

### Windows
- **DWM Integration**: Desktop Window Manager transparency
- **Acrylic Effects**: Windows 10/11 blur effects
- **Compatibility**: Windows 7+ support with fallbacks

### Linux
- **Compositor Support**: Wayland and X11 compatibility
- **Desktop Environment**: GNOME, KDE, XFCE support
- **Fallback Handling**: Graceful degradation for unsupported systems

## Performance Optimizations

### 1. Hardware Acceleration
```css
-webkit-transform: translateZ(0);
transform: translateZ(0);
will-change: transform, opacity;
```

### 2. Efficient Backdrop Filters
- Use `saturate()` for enhanced visual depth
- Combine blur with saturation for better performance
- Limit blur radius to reasonable values (8px-24px)

### 3. Reduced Motion Support
```css
@media (prefers-reduced-motion: reduce) {
  .floating-container,
  .floating-card {
    transition: none !important;
    animation: none !important;
  }
}
```

### 4. High Contrast Mode Support
```css
@media (prefers-contrast: high) {
  .floating-container {
    border-width: 2px !important;
    backdrop-filter: none !important;
    background: rgba(24, 24, 41, 0.98) !important;
  }
}
```

## Usage Examples

### Basic Floating Container
```tsx
import { FloatingContainer, FloatingText } from '@/components/ui/floating-ui';

function MyComponent() {
  return (
    <FloatingContainer level={2} variant="card" responsive enterAnimation>
      <FloatingText variant="accent">
        This is a floating card with transparency effects
      </FloatingText>
    </FloatingContainer>
  );
}
```

### Squircle Window Application
```tsx
import SquircleWindow from '@/components/SquircleWindow';

function App() {
  return (
    <SquircleWindow cornerRadius={20} cornerSmoothing={0.8} enabled>
      <div className="app-content">
        {/* Your app content */}
      </div>
    </SquircleWindow>
  );
}
```

### Transparency-Aware Styling
```tsx
import { useTransparencyAwareStyles } from '@/contexts/TransparencyContext';

function MyComponent() {
  const { isTransparent, getFloatingClass, textClass } = useTransparencyAwareStyles();
  
  return (
    <div className={cn('base-container', getFloatingClass(1))}>
      <span className={textClass}>
        This text adapts to transparency mode
      </span>
    </div>
  );
}
```

## Troubleshooting

### Common Issues

1. **Transparency not working**: Check platform support and Electron window configuration
2. **Performance issues**: Reduce backdrop-filter complexity and limit animated elements
3. **Text readability**: Ensure sufficient contrast with text-shadow and appropriate opacity
4. **Click-through problems**: Verify pointer-events CSS and interactive element configuration

### Debug Tools

1. **Transparency Context**: Use React DevTools to inspect transparency state
2. **CSS Inspector**: Check computed styles for backdrop-filter support
3. **Platform Detection**: Log platform capabilities in console
4. **Performance Monitor**: Use Chrome DevTools for rendering performance

## Future Enhancements

1. **Dynamic Blur Intensity**: Adjust blur based on content behind window
2. **Adaptive Transparency**: Change opacity based on system theme
3. **Custom Vibrancy Types**: Platform-specific vibrancy customization
4. **Performance Monitoring**: Real-time transparency performance metrics

This guide provides a complete reference for implementing similar transparency and rounded corner effects in other applications using the same technology stack.