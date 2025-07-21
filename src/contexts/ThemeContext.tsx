'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

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

// Single VS Code theme - the only theme we need
export const themes: Theme[] = [
  {
    id: 'vscode',
    name: 'VS Code',
    icon: '💻',
    colors: {
      background: '#13131f',
      foreground: '#d4d4d4',
      card: '#1d1d33',
      cardForeground: '#d4d4d4',
      primary: '#569cd6',
      primaryForeground: '#ffffff',
      secondary: '#4fc1ff',
      secondaryForeground: '#13131f',
      accent: '#e04539',
      accentForeground: '#ffffff',
      muted: '#1e1b2e',
      mutedForeground: '#9ca3af',
      border: '#3b3b68',
      input: '#1e1b2e',
      ring: '#569cd6',
      destructive: '#f44747',
      destructiveForeground: '#ffffff',
    },
  },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themes: Theme[];
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Helper function to apply theme to DOM
const applyThemeToDOM = (theme: Theme) => {
  try {
    const root = document.documentElement;
    const body = document.body;

    // Apply CSS variables to root
    Object.entries(theme.colors).forEach(([key, value]) => {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      root.style.setProperty(cssVar, value);
    });

    // Apply theme class for dark mode (VS Code is always dark)
    root.classList.add('dark');
    body.classList.add('dark');

    console.log('VS Code theme applied successfully');
  } catch (error) {
    console.error('Error applying theme:', error);
  }
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Always use VS Code theme - no theme switching needed
  const [themeState, setThemeState] = useState<Theme>(themes[0]);

  // Apply VS Code theme on mount
  useEffect(() => {
    console.log('ThemeProvider: Applying VS Code theme');
    setThemeState(themes[0]);
    applyThemeToDOM(themes[0]);
  }, []);

  const setTheme = (newTheme: Theme) => {
    // Only allow VS Code theme
    if (newTheme.id === 'vscode') {
      setThemeState(newTheme);
      applyThemeToDOM(newTheme);
    }
  };

  const value = {
    theme: themeState,
    setTheme,
    themes
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    // During static generation, return default theme
    if (typeof window === 'undefined') {
      return {
        theme: themes[0],
        setTheme: () => {},
        themes
      };
    }
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
