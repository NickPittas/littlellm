'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { getStorageItem, setStorageItem } from '../utils/storage';

export interface Theme {
  id: string;
  name: string;
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
  };
}

// Helper function to add card colors to themes
const addCardColors = (theme: any): Theme => {
  // If card colors are missing, generate them based on background
  if (!theme.colors.card) {
    const isDark = theme.id.includes('dark') ||
                   theme.id === 'midnight' ||
                   theme.id === 'forest' ||
                   theme.id === 'sunset' ||
                   theme.id === 'cyberpunk' ||
                   theme.id === 'dracula' ||
                   theme.id === 'matrix';

    if (isDark) {
      // For dark themes, make card slightly lighter than background with good contrast
      theme.colors.card = theme.colors.accent || theme.colors.secondary;
      theme.colors.cardForeground = theme.colors.foreground;
    } else {
      // For light themes, use white or very light color
      theme.colors.card = '0 0% 100%';
      theme.colors.cardForeground = theme.colors.foreground;
    }
  }
  return theme;
};

export const themes: Theme[] = [
  {
    id: 'light',
    name: 'Light',
    icon: '☀️',
    colors: {
      background: '0 0% 100%',
      foreground: '222.2 84% 4.9%',
      card: '0 0% 100%',
      cardForeground: '222.2 84% 4.9%',
      primary: '222.2 47.4% 11.2%',
      primaryForeground: '210 40% 98%',
      secondary: '210 40% 96%',
      secondaryForeground: '222.2 84% 4.9%',
      accent: '210 40% 96%',
      accentForeground: '222.2 84% 4.9%',
      muted: '210 40% 96%',
      mutedForeground: '215.4 16.3% 46.9%',
      border: '214.3 31.8% 91.4%',
      input: '214.3 31.8% 91.4%',
      ring: '222.2 84% 4.9%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    icon: '🌙',
    colors: {
      background: '224 71% 4%',
      foreground: '213 31% 91%',
      card: '224 71% 10%',
      cardForeground: '213 31% 91%',
      primary: '217 91% 60%',
      primaryForeground: '222.2 84% 4.9%',
      secondary: '222.2 84% 11%',
      secondaryForeground: '210 40% 98%',
      accent: '216 34% 17%',
      accentForeground: '210 40% 98%',
      muted: '223 47% 11%',
      mutedForeground: '215.4 16.3% 56.9%',
      border: '216 34% 17%',
      input: '216 34% 17%',
      ring: '216 34% 17%',
      destructive: '0 62.8% 30.6%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'blue',
    name: 'Ocean Blue',
    icon: '🌊',
    colors: {
      background: '210 100% 97%',
      foreground: '210 100% 15%',
      card: '0 0% 100%',
      cardForeground: '210 100% 15%',
      primary: '210 100% 50%',
      primaryForeground: '0 0% 100%',
      secondary: '210 60% 90%',
      secondaryForeground: '210 100% 15%',
      accent: '210 60% 90%',
      accentForeground: '210 100% 15%',
      muted: '210 60% 90%',
      mutedForeground: '210 30% 40%',
      border: '210 60% 85%',
      input: '210 60% 85%',
      ring: '210 100% 50%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'green',
    name: 'Forest Green',
    icon: '🌲',
    colors: {
      background: '120 60% 97%',
      foreground: '120 100% 15%',
      primary: '120 100% 25%',
      primaryForeground: '0 0% 100%',
      secondary: '120 30% 90%',
      secondaryForeground: '120 100% 15%',
      accent: '120 30% 90%',
      accentForeground: '120 100% 15%',
      muted: '120 30% 90%',
      mutedForeground: '120 20% 40%',
      border: '120 30% 85%',
      input: '120 30% 85%',
      ring: '120 100% 25%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'purple',
    name: 'Royal Purple',
    icon: '👑',
    colors: {
      background: '270 100% 98%',
      foreground: '270 100% 15%',
      primary: '270 100% 50%',
      primaryForeground: '0 0% 100%',
      secondary: '270 30% 92%',
      secondaryForeground: '270 100% 15%',
      accent: '270 30% 92%',
      accentForeground: '270 100% 15%',
      muted: '270 30% 92%',
      mutedForeground: '270 20% 50%',
      border: '270 30% 87%',
      input: '270 30% 87%',
      ring: '270 100% 50%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'rose',
    name: 'Rose Garden',
    icon: '🌹',
    colors: {
      background: '350 100% 98%',
      foreground: '350 100% 15%',
      primary: '350 100% 50%',
      primaryForeground: '0 0% 100%',
      secondary: '350 30% 92%',
      secondaryForeground: '350 100% 15%',
      accent: '350 30% 92%',
      accentForeground: '350 100% 15%',
      muted: '350 30% 92%',
      mutedForeground: '350 20% 50%',
      border: '350 30% 87%',
      input: '350 30% 87%',
      ring: '350 100% 50%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'orange',
    name: 'Sunset Orange',
    icon: '🌅',
    colors: {
      background: '30 100% 98%',
      foreground: '30 100% 15%',
      primary: '30 100% 50%',
      primaryForeground: '0 0% 100%',
      secondary: '30 30% 92%',
      secondaryForeground: '30 100% 15%',
      accent: '30 30% 92%',
      accentForeground: '30 100% 15%',
      muted: '30 30% 92%',
      mutedForeground: '30 20% 50%',
      border: '30 30% 87%',
      input: '30 30% 87%',
      ring: '30 100% 50%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'teal',
    name: 'Teal Wave',
    icon: '🌊',
    colors: {
      background: '180 100% 97%',
      foreground: '180 100% 15%',
      primary: '180 100% 35%',
      primaryForeground: '0 0% 100%',
      secondary: '180 30% 90%',
      secondaryForeground: '180 100% 15%',
      accent: '180 30% 90%',
      accentForeground: '180 100% 15%',
      muted: '180 30% 90%',
      mutedForeground: '180 20% 40%',
      border: '180 30% 85%',
      input: '180 30% 85%',
      ring: '180 100% 35%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'indigo',
    name: 'Deep Indigo',
    icon: '🔮',
    colors: {
      background: '240 100% 98%',
      foreground: '240 100% 15%',
      primary: '240 100% 45%',
      primaryForeground: '0 0% 100%',
      secondary: '240 30% 92%',
      secondaryForeground: '240 100% 15%',
      accent: '240 30% 92%',
      accentForeground: '240 100% 15%',
      muted: '240 30% 92%',
      mutedForeground: '240 20% 50%',
      border: '240 30% 87%',
      input: '240 30% 87%',
      ring: '240 100% 45%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'amber',
    name: 'Golden Amber',
    icon: '🍯',
    colors: {
      background: '45 100% 98%',
      foreground: '45 100% 15%',
      primary: '45 100% 45%',
      primaryForeground: '0 0% 100%',
      secondary: '45 30% 92%',
      secondaryForeground: '45 100% 15%',
      accent: '45 30% 92%',
      accentForeground: '45 100% 15%',
      muted: '45 30% 92%',
      mutedForeground: '45 20% 50%',
      border: '45 30% 87%',
      input: '45 30% 87%',
      ring: '45 100% 45%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald City',
    icon: '💎',
    colors: {
      background: '160 100% 98%',
      foreground: '160 100% 15%',
      primary: '160 100% 35%',
      primaryForeground: '0 0% 100%',
      secondary: '160 30% 92%',
      secondaryForeground: '160 100% 15%',
      accent: '160 30% 92%',
      accentForeground: '160 100% 15%',
      muted: '160 30% 92%',
      mutedForeground: '160 20% 50%',
      border: '160 30% 87%',
      input: '160 30% 87%',
      ring: '160 100% 35%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'slate',
    name: 'Slate Gray',
    icon: '🗿',
    colors: {
      background: '210 20% 98%',
      foreground: '210 20% 15%',
      primary: '210 20% 35%',
      primaryForeground: '0 0% 100%',
      secondary: '210 20% 92%',
      secondaryForeground: '210 20% 15%',
      accent: '210 20% 92%',
      accentForeground: '210 20% 15%',
      muted: '210 20% 92%',
      mutedForeground: '210 20% 50%',
      border: '210 20% 87%',
      input: '210 20% 87%',
      ring: '210 20% 35%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'crimson',
    name: 'Crimson Red',
    icon: '🔥',
    colors: {
      background: '0 100% 98%',
      foreground: '0 100% 15%',
      primary: '0 100% 45%',
      primaryForeground: '0 0% 100%',
      secondary: '0 30% 92%',
      secondaryForeground: '0 100% 15%',
      accent: '0 30% 92%',
      accentForeground: '0 100% 15%',
      muted: '0 30% 92%',
      mutedForeground: '0 20% 50%',
      border: '0 30% 87%',
      input: '0 30% 87%',
      ring: '0 100% 45%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'lime',
    name: 'Electric Lime',
    icon: '⚡',
    colors: {
      background: '75 100% 98%',
      foreground: '75 100% 15%',
      primary: '75 100% 40%',
      primaryForeground: '0 0% 100%',
      secondary: '75 30% 92%',
      secondaryForeground: '75 100% 15%',
      accent: '75 30% 92%',
      accentForeground: '75 100% 15%',
      muted: '75 30% 92%',
      mutedForeground: '75 20% 50%',
      border: '75 30% 87%',
      input: '75 30% 87%',
      ring: '75 100% 40%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'cyan',
    name: 'Electric Cyan',
    icon: '💠',
    colors: {
      background: '195 100% 98%',
      foreground: '195 100% 15%',
      primary: '195 100% 40%',
      primaryForeground: '0 0% 100%',
      secondary: '195 30% 92%',
      secondaryForeground: '195 100% 15%',
      accent: '195 30% 92%',
      accentForeground: '195 100% 15%',
      muted: '195 30% 92%',
      mutedForeground: '195 20% 50%',
      border: '195 30% 87%',
      input: '195 30% 87%',
      ring: '195 100% 40%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'pink',
    name: 'Bubblegum Pink',
    icon: '🌸',
    colors: {
      background: '320 100% 98%',
      foreground: '320 100% 15%',
      primary: '320 100% 50%',
      primaryForeground: '0 0% 100%',
      secondary: '320 30% 92%',
      secondaryForeground: '320 100% 15%',
      accent: '320 30% 92%',
      accentForeground: '320 100% 15%',
      muted: '320 30% 92%',
      mutedForeground: '320 20% 50%',
      border: '320 30% 87%',
      input: '320 30% 87%',
      ring: '320 100% 50%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'violet',
    name: 'Mystic Violet',
    icon: '🔮',
    colors: {
      background: '285 100% 98%',
      foreground: '285 100% 15%',
      primary: '285 100% 45%',
      primaryForeground: '0 0% 100%',
      secondary: '285 30% 92%',
      secondaryForeground: '285 100% 15%',
      accent: '285 30% 92%',
      accentForeground: '285 100% 15%',
      muted: '285 30% 92%',
      mutedForeground: '285 20% 50%',
      border: '285 30% 87%',
      input: '285 30% 87%',
      ring: '285 100% 45%',
      destructive: '0 84.2% 60.2%',
      destructiveForeground: '210 40% 98%',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight Blue',
    icon: '🌌',
    colors: {
      background: '220 40% 8%',
      foreground: '220 40% 95%',
      card: '220 40% 12%',
      cardForeground: '220 40% 95%',
      primary: '220 100% 60%',
      primaryForeground: '220 40% 8%',
      secondary: '220 40% 15%',
      secondaryForeground: '220 40% 95%',
      accent: '220 40% 15%',
      accentForeground: '220 40% 95%',
      muted: '220 40% 15%',
      mutedForeground: '220 20% 65%',
      border: '220 40% 20%',
      input: '220 40% 20%',
      ring: '220 100% 60%',
      destructive: '0 62.8% 30.6%',
      destructiveForeground: '220 40% 95%',
    },
  },
  {
    id: 'forest',
    name: 'Dark Forest',
    icon: '🌲',
    colors: {
      background: '120 30% 8%',
      foreground: '120 30% 95%',
      primary: '120 100% 50%',
      primaryForeground: '120 30% 8%',
      secondary: '120 30% 15%',
      secondaryForeground: '120 30% 95%',
      accent: '120 30% 15%',
      accentForeground: '120 30% 95%',
      muted: '120 30% 15%',
      mutedForeground: '120 20% 65%',
      border: '120 30% 20%',
      input: '120 30% 20%',
      ring: '120 100% 50%',
      destructive: '0 62.8% 30.6%',
      destructiveForeground: '120 30% 95%',
    },
  },
  {
    id: 'sunset',
    name: 'Dark Sunset',
    icon: '🌆',
    colors: {
      background: '15 30% 8%',
      foreground: '15 30% 95%',
      primary: '15 100% 55%',
      primaryForeground: '15 30% 8%',
      secondary: '15 30% 15%',
      secondaryForeground: '15 30% 95%',
      accent: '15 30% 15%',
      accentForeground: '15 30% 95%',
      muted: '15 30% 15%',
      mutedForeground: '15 20% 65%',
      border: '15 30% 20%',
      input: '15 30% 20%',
      ring: '15 100% 55%',
      destructive: '0 62.8% 30.6%',
      destructiveForeground: '15 30% 95%',
    },
  },
  {
    id: 'dark-blue',
    name: 'Dark Blue',
    icon: '🌌',
    colors: {
      background: '220 30% 8%',
      foreground: '220 30% 95%',
      card: '220 30% 12%',
      cardForeground: '220 30% 95%',
      primary: '220 100% 60%',
      primaryForeground: '220 30% 8%',
      secondary: '220 30% 15%',
      secondaryForeground: '220 30% 95%',
      accent: '220 30% 18%',
      accentForeground: '220 30% 95%',
      muted: '220 30% 15%',
      mutedForeground: '220 20% 65%',
      border: '220 30% 20%',
      input: '220 30% 20%',
      ring: '220 100% 60%',
      destructive: '0 62.8% 30.6%',
      destructiveForeground: '220 30% 95%',
    },
  },
  {
    id: 'dark-purple',
    name: 'Dark Purple',
    icon: '🔮',
    colors: {
      background: '270 30% 8%',
      foreground: '270 30% 95%',
      card: '270 30% 12%',
      cardForeground: '270 30% 95%',
      primary: '270 100% 65%',
      primaryForeground: '270 30% 8%',
      secondary: '270 30% 15%',
      secondaryForeground: '270 30% 95%',
      accent: '270 30% 18%',
      accentForeground: '270 30% 95%',
      muted: '270 30% 15%',
      mutedForeground: '270 20% 65%',
      border: '270 30% 20%',
      input: '270 30% 20%',
      ring: '270 100% 65%',
      destructive: '0 62.8% 30.6%',
      destructiveForeground: '270 30% 95%',
    },
  },
  {
    id: 'dark-green',
    name: 'Dark Green',
    icon: '🌿',
    colors: {
      background: '140 30% 8%',
      foreground: '140 30% 95%',
      card: '140 30% 12%',
      cardForeground: '140 30% 95%',
      primary: '140 100% 50%',
      primaryForeground: '140 30% 8%',
      secondary: '140 30% 15%',
      secondaryForeground: '140 30% 95%',
      accent: '140 30% 18%',
      accentForeground: '140 30% 95%',
      muted: '140 30% 15%',
      mutedForeground: '140 20% 65%',
      border: '140 30% 20%',
      input: '140 30% 20%',
      ring: '140 100% 50%',
      destructive: '0 62.8% 30.6%',
      destructiveForeground: '140 30% 95%',
    },
  },
  {
    id: 'dark-red',
    name: 'Dark Red',
    icon: '🌹',
    colors: {
      background: '0 30% 8%',
      foreground: '0 30% 95%',
      card: '0 30% 12%',
      cardForeground: '0 30% 95%',
      primary: '0 100% 60%',
      primaryForeground: '0 30% 8%',
      secondary: '0 30% 15%',
      secondaryForeground: '0 30% 95%',
      accent: '0 30% 18%',
      accentForeground: '0 30% 95%',
      muted: '0 30% 15%',
      mutedForeground: '0 20% 65%',
      border: '0 30% 20%',
      input: '0 30% 20%',
      ring: '0 100% 60%',
      destructive: '0 62.8% 30.6%',
      destructiveForeground: '0 30% 95%',
    },
  },
  {
    id: 'dark-teal',
    name: 'Dark Teal',
    icon: '🌊',
    colors: {
      background: '180 30% 8%',
      foreground: '180 30% 95%',
      card: '180 30% 12%',
      cardForeground: '180 30% 95%',
      primary: '180 100% 50%',
      primaryForeground: '180 30% 8%',
      secondary: '180 30% 15%',
      secondaryForeground: '180 30% 95%',
      accent: '180 30% 18%',
      accentForeground: '180 30% 95%',
      muted: '180 30% 15%',
      mutedForeground: '180 20% 65%',
      border: '180 30% 20%',
      input: '180 30% 20%',
      ring: '180 100% 50%',
      destructive: '0 62.8% 30.6%',
      destructiveForeground: '180 30% 95%',
    },
  },
  {
    id: 'dark-orange',
    name: 'Dark Orange',
    icon: '🔥',
    colors: {
      background: '30 30% 8%',
      foreground: '30 30% 95%',
      card: '30 30% 12%',
      cardForeground: '30 30% 95%',
      primary: '30 100% 60%',
      primaryForeground: '30 30% 8%',
      secondary: '30 30% 15%',
      secondaryForeground: '30 30% 95%',
      accent: '30 30% 18%',
      accentForeground: '30 30% 95%',
      muted: '30 30% 15%',
      mutedForeground: '30 20% 65%',
      border: '30 30% 20%',
      input: '30 30% 20%',
      ring: '30 100% 60%',
      destructive: '0 62.8% 30.6%',
      destructiveForeground: '30 30% 95%',
    },
  },
  {
    id: 'dark-slate',
    name: 'Dark Slate',
    icon: '🌫️',
    colors: {
      background: '210 20% 8%',
      foreground: '210 20% 95%',
      card: '210 20% 12%',
      cardForeground: '210 20% 95%',
      primary: '210 80% 60%',
      primaryForeground: '210 20% 8%',
      secondary: '210 20% 15%',
      secondaryForeground: '210 20% 95%',
      accent: '210 20% 18%',
      accentForeground: '210 20% 95%',
      muted: '210 20% 15%',
      mutedForeground: '210 15% 65%',
      border: '210 20% 20%',
      input: '210 20% 20%',
      ring: '210 80% 60%',
      destructive: '0 62.8% 30.6%',
      destructiveForeground: '210 20% 95%',
    },
  },
].map(addCardColors);

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Default to dark theme for better UX
  const [theme, setThemeState] = useState<Theme>(themes[1]); // themes[1] is dark theme

  useEffect(() => {
    // Load saved theme
    const loadTheme = async () => {
      try {
        const savedThemeId = await getStorageItem('littlellm-theme');
        if (savedThemeId) {
          const savedTheme = themes.find(t => t.id === savedThemeId);
          if (savedTheme) {
            setThemeState(savedTheme);
            return;
          }
        }
        // If no saved theme, default to dark theme
        setThemeState(themes[1]);
      } catch (error) {
        console.error('Error loading theme:', error);
        // Fallback to dark theme
        setThemeState(themes[1]);
      }
    };

    loadTheme();
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);

    // Save theme asynchronously
    const saveTheme = async () => {
      try {
        await setStorageItem('littlellm-theme', newTheme.id);
      } catch (error) {
        console.error('Error saving theme:', error);
      }
    };
    saveTheme();

    // Apply CSS variables and theme class
    try {
      const root = document.documentElement;
      const body = document.body;

      // Apply CSS variables with higher priority
      Object.entries(newTheme.colors).forEach(([key, value]) => {
        // Convert camelCase to kebab-case for CSS variables
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        root.style.setProperty(`--${cssKey}`, value, 'important');

      });

      // Apply theme class for dark/light mode
      const isDark = newTheme.id.includes('dark') ||
                     newTheme.id === 'midnight' ||
                     newTheme.id === 'forest' ||
                     newTheme.id === 'sunset' ||
                     newTheme.id === 'cyberpunk' ||
                     newTheme.id === 'dracula' ||
                     newTheme.id === 'matrix';

      if (isDark) {
        root.classList.add('dark');
        body.classList.add('dark');
      } else {
        root.classList.remove('dark');
        body.classList.remove('dark');
      }
    } catch (error) {
      console.error('Error applying theme:', error);
    }
  };

  useEffect(() => {
    // Apply initial theme
    try {
      const root = document.documentElement;
      const body = document.body;

      // Apply CSS variables with higher priority
      Object.entries(theme.colors).forEach(([key, value]) => {
        // Convert camelCase to kebab-case for CSS variables
        const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        root.style.setProperty(`--${cssKey}`, value, 'important');
      });

      // Apply theme class for dark/light mode
      const isDark = theme.id.includes('dark') ||
                     theme.id === 'midnight' ||
                     theme.id === 'forest' ||
                     theme.id === 'sunset' ||
                     theme.id === 'cyberpunk' ||
                     theme.id === 'dracula' ||
                     theme.id === 'matrix';

      if (isDark) {
        root.classList.add('dark');
        body.classList.add('dark');
      } else {
        root.classList.remove('dark');
        body.classList.remove('dark');
      }
    } catch (error) {
      console.error('Error applying initial theme:', error);
    }
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
