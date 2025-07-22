/**
 * Predefined Theme Configurations
 * Ready-made themes to replace individual color selection
 */

export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  colors: {
    background: string;
    foreground: string;
    card: string;
    cardForeground: string;
    primary: string;
    primaryForeground: string;
    secondary: string;
    secondaryForeground: string;
    accent: string;
    accentForeground: string;
    muted: string;
    mutedForeground: string;
    border: string;
    input: string;
    ring: string;
    destructive: string;
    destructiveForeground: string;
    systemText: string;
  };
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'default',
    name: 'VS Code Dark',
    description: 'The classic VS Code dark theme',
    icon: '🌙',
    colors: {
      background: '#181829',
      foreground: '#d4d4d4',
      card: '#211f32',
      cardForeground: '#ffffff',
      primary: '#569cd6',
      primaryForeground: '#ffffff',
      secondary: '#4fc1ff',
      secondaryForeground: '#adadad',
      accent: '#569cd6',
      accentForeground: '#ffffff',
      muted: '#211f32',
      mutedForeground: '#9ca3af',
      border: '#3b3b68',
      input: '#949494',
      ring: '#569cd6',
      destructive: '#f44747',
      destructiveForeground: '#ffffff',
      systemText: '#e0e0e0',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    description: 'Deep blue tones for late night coding',
    icon: '🌌',
    colors: {
      background: '#0f1419',
      foreground: '#e6e1cf',
      card: '#1a1f29',
      cardForeground: '#ffffff',
      primary: '#39bae6',
      primaryForeground: '#ffffff',
      secondary: '#7c3aed',
      secondaryForeground: '#ffffff',
      accent: '#39bae6',
      accentForeground: '#ffffff',
      muted: '#1a1f29',
      mutedForeground: '#8b949e',
      border: '#30363d',
      input: '#21262d',
      ring: '#39bae6',
      destructive: '#f85149',
      destructiveForeground: '#ffffff',
      systemText: '#e6e1cf',
    },
  },
  {
    id: 'forest',
    name: 'Forest Green',
    description: 'Calming green theme inspired by nature',
    icon: '🌲',
    colors: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      card: '#161b22',
      cardForeground: '#ffffff',
      primary: '#238636',
      primaryForeground: '#ffffff',
      secondary: '#7c3aed',
      secondaryForeground: '#ffffff',
      accent: '#238636',
      accentForeground: '#ffffff',
      muted: '#161b22',
      mutedForeground: '#8b949e',
      border: '#30363d',
      input: '#21262d',
      ring: '#238636',
      destructive: '#da3633',
      destructiveForeground: '#ffffff',
      systemText: '#c9d1d9',
    },
  },
  {
    id: 'sunset',
    name: 'Sunset Orange',
    description: 'Warm orange and red tones',
    icon: '🌅',
    colors: {
      background: '#1a0f0a',
      foreground: '#f4d1ae',
      card: '#2d1b0e',
      cardForeground: '#ffffff',
      primary: '#ff6b35',
      primaryForeground: '#ffffff',
      secondary: '#f7931e',
      secondaryForeground: '#ffffff',
      accent: '#ff6b35',
      accentForeground: '#ffffff',
      muted: '#2d1b0e',
      mutedForeground: '#a0a0a0',
      border: '#4a2c1a',
      input: '#3d2317',
      ring: '#ff6b35',
      destructive: '#dc2626',
      destructiveForeground: '#ffffff',
      systemText: '#f4d1ae',
    },
  },
  {
    id: 'purple',
    name: 'Purple Haze',
    description: 'Rich purple theme with violet accents',
    icon: '💜',
    colors: {
      background: '#1a0d1a',
      foreground: '#e9d5ff',
      card: '#2d1b2d',
      cardForeground: '#ffffff',
      primary: '#8b5cf6',
      primaryForeground: '#ffffff',
      secondary: '#a855f7',
      secondaryForeground: '#ffffff',
      accent: '#8b5cf6',
      accentForeground: '#ffffff',
      muted: '#2d1b2d',
      mutedForeground: '#a1a1aa',
      border: '#4c1d95',
      input: '#3730a3',
      ring: '#8b5cf6',
      destructive: '#ef4444',
      destructiveForeground: '#ffffff',
      systemText: '#e9d5ff',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean Depths',
    description: 'Deep blue-teal theme like ocean depths',
    icon: '🌊',
    colors: {
      background: '#0a1628',
      foreground: '#cbd5e1',
      card: '#1e293b',
      cardForeground: '#ffffff',
      primary: '#0ea5e9',
      primaryForeground: '#ffffff',
      secondary: '#06b6d4',
      secondaryForeground: '#ffffff',
      accent: '#0ea5e9',
      accentForeground: '#ffffff',
      muted: '#1e293b',
      mutedForeground: '#94a3b8',
      border: '#334155',
      input: '#475569',
      ring: '#0ea5e9',
      destructive: '#ef4444',
      destructiveForeground: '#ffffff',
      systemText: '#cbd5e1',
    },
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    description: 'Clean black and white theme',
    icon: '⚫',
    colors: {
      background: '#000000',
      foreground: '#ffffff',
      card: '#1a1a1a',
      cardForeground: '#ffffff',
      primary: '#ffffff',
      primaryForeground: '#000000',
      secondary: '#666666',
      secondaryForeground: '#ffffff',
      accent: '#ffffff',
      accentForeground: '#000000',
      muted: '#1a1a1a',
      mutedForeground: '#a3a3a3',
      border: '#404040',
      input: '#333333',
      ring: '#ffffff',
      destructive: '#ff0000',
      destructiveForeground: '#ffffff',
      systemText: '#ffffff',
    },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk',
    description: 'Neon colors for a futuristic feel',
    icon: '🤖',
    colors: {
      background: '#0a0a0a',
      foreground: '#00ff41',
      card: '#1a1a1a',
      cardForeground: '#00ff41',
      primary: '#ff0080',
      primaryForeground: '#000000',
      secondary: '#00ffff',
      secondaryForeground: '#000000',
      accent: '#ff0080',
      accentForeground: '#000000',
      muted: '#1a1a1a',
      mutedForeground: '#808080',
      border: '#ff0080',
      input: '#2a2a2a',
      ring: '#00ffff',
      destructive: '#ff4444',
      destructiveForeground: '#000000',
      systemText: '#00ff41',
    },
  },
];

/**
 * Get theme preset by ID
 */
export function getThemePreset(id: string): ThemePreset | undefined {
  return THEME_PRESETS.find(theme => theme.id === id);
}

/**
 * Get default theme preset
 */
export function getDefaultThemePreset(): ThemePreset {
  return THEME_PRESETS[0]; // VS Code Dark
}
