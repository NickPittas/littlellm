/**
 * SINGLE POINT OF COLOR REFERENCE
 * All colors in the entire application are defined here
 * This is the ONLY place where colors should be defined
 */

export interface ColorDefinition {
  hex: string;
  hsl: string;
  description: string;
}

export interface ColorScheme {
  background: ColorDefinition;
  foreground: ColorDefinition;
  card: ColorDefinition;
  cardForeground: ColorDefinition;
  primary: ColorDefinition;
  primaryForeground: ColorDefinition;
  secondary: ColorDefinition;
  secondaryForeground: ColorDefinition;
  accent: ColorDefinition;
  accentForeground: ColorDefinition;
  muted: ColorDefinition;
  mutedForeground: ColorDefinition;
  border: ColorDefinition;
  input: ColorDefinition;
  ring: ColorDefinition;
  destructive: ColorDefinition;
  destructiveForeground: ColorDefinition;
  systemText: ColorDefinition;
}

/**
 * Convert hex to HSL format for CSS variables
 */
function hexToHsl(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse RGB
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Create color definition from hex
 */
function createColor(hex: string, description: string): ColorDefinition {
  return {
    hex,
    hsl: hexToHsl(hex),
    description
  };
}

/**
 * DEFAULT COLOR SCHEME
 * These are the default values for "Reset to Defaults"
 * Users can change these through Settings Appearance
 * NO HARDCODED VALUES are used anywhere else
 */
export const DEFAULT_COLORS: ColorScheme = {
  background: createColor('#181829', 'Main application background'),
  foreground: createColor('#d4d4d4', 'Main text color'),
  card: createColor('#211f32', 'Panel and card backgrounds'),
  cardForeground: createColor('#ffffff', 'Panel and card text'),
  primary: createColor('#569cd6', 'Primary buttons and links'),
  primaryForeground: createColor('#ffffff', 'Primary button text'),
  secondary: createColor('#4fc1ff', 'Secondary elements'),
  secondaryForeground: createColor('#adadad', 'Secondary text'),
  accent: createColor('#569cd6', 'Accent and hover states'),
  accentForeground: createColor('#ffffff', 'Accent text'),
  muted: createColor('#2d2a41', 'Subtle backgrounds'),
  mutedForeground: createColor('#9ca3af', 'Subtle text'),
  border: createColor('#3b3b68', 'Borders and dividers'),
  input: createColor('#949494', 'Input field backgrounds'),
  ring: createColor('#569cd6', 'Focus outlines'),
  destructive: createColor('#f44747', 'Error and delete actions'),
  destructiveForeground: createColor('#ffffff', 'Error text'),
  systemText: createColor('#e0e0e0', 'System UI text (labels, buttons, etc.)')
};

/**
 * Get CSS variables string for injection
 */
export function getCSSVariables(): string {
  return Object.entries(DEFAULT_COLORS)
    .map(([key, color]) => {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      return `${cssVar}: ${color.hsl};`;
    })
    .join('\n    ');
}

/**
 * Get default hex colors for settings interface
 * These are used for "Reset to Defaults" functionality
 */
export function getDefaultHexColors() {
  return {
    background: DEFAULT_COLORS.background.hex,
    foreground: DEFAULT_COLORS.foreground.hex,
    card: DEFAULT_COLORS.card.hex,
    cardForeground: DEFAULT_COLORS.cardForeground.hex,
    primary: DEFAULT_COLORS.primary.hex,
    primaryForeground: DEFAULT_COLORS.primaryForeground.hex,
    secondary: DEFAULT_COLORS.secondary.hex,
    secondaryForeground: DEFAULT_COLORS.secondaryForeground.hex,
    accent: DEFAULT_COLORS.accent.hex,
    accentForeground: DEFAULT_COLORS.accentForeground.hex,
    muted: DEFAULT_COLORS.muted.hex,
    mutedForeground: DEFAULT_COLORS.mutedForeground.hex,
    border: DEFAULT_COLORS.border.hex,
    input: DEFAULT_COLORS.input.hex,
    ring: DEFAULT_COLORS.ring.hex,
    destructive: DEFAULT_COLORS.destructive.hex,
    destructiveForeground: DEFAULT_COLORS.destructiveForeground.hex,
    systemText: DEFAULT_COLORS.systemText.hex,
  };
}

/**
 * Apply colors to DOM and Electron window background
 * If no custom colors provided, uses default colors
 */
export function applyColorsToDOM(customColors?: any) {
  const root = document.documentElement;
  const defaults = getDefaultHexColors();
  const colorsToApply = customColors || defaults;

  // Ensure all required colors exist (fallback for missing systemText in old settings)
  const completeColors = {
    ...defaults,
    ...colorsToApply,
    systemText: colorsToApply.systemText || defaults.systemText
  };

  Object.entries(completeColors).forEach(([key, hex]) => {
    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
    const hsl = hexToHsl(hex as string);
    root.style.setProperty(cssVar, hsl, 'important');
  });

  // Also update the Electron window background color
  if (typeof window !== 'undefined' && window.electronAPI && completeColors.background) {
    console.log('🎨 Setting Electron window background to:', completeColors.background);
    window.electronAPI.setWindowBackgroundColor(completeColors.background).catch((error: any) => {
      console.error('Failed to set window background color:', error);
    });
  }

  console.log('🎨 Applied colors to DOM and Electron window:', completeColors);
}
