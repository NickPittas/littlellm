'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { settingsService, type ColorSettings } from '../services/settingsService';
import { themeSyncService } from '../services/themeSyncService';
import { getDefaultHexColors, applyColorsToDOM } from '../config/colors';
import { THEME_PRESETS, getThemePreset, getDefaultThemePreset, type ThemePreset } from '../config/themes';
import type { ColorSettings } from '../types/settings';

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
  customColors: ColorSettings;
  setCustomColors: (colors: ColorSettings) => void;
  useCustomColors: boolean;
  setUseCustomColors: (use: boolean) => void;
  resetToDefaults: () => void;
  // Theme preset functionality
  selectedThemePreset: string;
  setSelectedThemePreset: (presetId: string) => void;
  colorMode: 'preset' | 'custom';
  setColorMode: (mode: 'preset' | 'custom') => void;
  themePresets: ThemePreset[];
  getCurrentColors: () => ColorSettings;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);


// Hex to HSL conversion is now handled in colors.ts

// Theme application is now handled by applyColorsToDOM from colors.ts

// Default colors - using DEFAULT_COLORS as single source of truth
const defaultColors: ColorSettings = getDefaultHexColors();

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeState, setThemeState] = useState<Theme>(themes[0]);
  const [customColors, setCustomColors] = useState<ColorSettings>(defaultColors);
  const [useCustomColors, setUseCustomColors] = useState(false);
  const [selectedThemePreset, setSelectedThemePreset] = useState('default');
  const [colorMode, setColorMode] = useState<'preset' | 'custom'>('preset');

  // SIMPLIFIED: Load theme ONCE from main process at startup
  useEffect(() => {
    const loadTheme = async () => {
      try {
        if (typeof window === 'undefined') return;

        console.log('🎨 ThemeProvider: Loading theme from main process...');

        // Get theme directly from main process
        if (window.electronAPI?.getCurrentTheme) {
          const currentTheme = await window.electronAPI.getCurrentTheme();
          console.log('🎨 ThemeProvider: Received theme:', currentTheme);

          if (currentTheme?.customColors) {
            // Apply theme immediately
            setCustomColors(currentTheme.customColors);
            setUseCustomColors(currentTheme.useCustomColors);
            applyColorsToDOM(currentTheme.customColors);
            console.log('🎨 ThemeProvider: Theme applied successfully');
            return;
          }
        }

        // Fallback to defaults
        console.log('🎨 ThemeProvider: Using default theme');
        applyColorsToDOM(getDefaultHexColors());
      } catch (error) {
        console.error('🎨 ThemeProvider: Error loading theme:', error);
        applyColorsToDOM(getDefaultHexColors());
      }
    };

    loadTheme();
  }, []);

  // Listen for theme changes from other windows
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return;

    const handleThemeChange = (themeData: { customColors: unknown; useCustomColors: boolean }) => {
      console.log('🎨 ThemeProvider: Received theme change:', themeData);
      const receivedColors = themeData.customColors as ColorSettings;

      // Update local state
      setCustomColors(receivedColors);
      setUseCustomColors(themeData.useCustomColors);

      // Apply the colors directly - the main process has already resolved preset vs custom
      // The customColors field contains the actual colors to apply (either preset or custom)
      if (receivedColors && Object.keys(receivedColors).length > 0) {
        applyColorsToDOM(receivedColors);
        console.log('🎨 ThemeProvider: Applied theme change to DOM with received colors');
      } else {
        // Fallback to default colors if no colors received
        applyColorsToDOM(getDefaultHexColors());
        console.log('🎨 ThemeProvider: Applied default colors as fallback');
      }
    };

    // Listen for theme changes and store the wrapped callback
    const wrappedCallback = window.electronAPI.onThemeChange(handleThemeChange);

    return () => {
      // Cleanup listener if available
      if (window.electronAPI.removeThemeChangeListener && wrappedCallback) {
        window.electronAPI.removeThemeChangeListener(wrappedCallback);
      }
    };
  }, [themeState]);

  const setTheme = (newTheme: Theme) => {
    if (newTheme.id === 'vscode') {
      setThemeState(newTheme);
      const colorsToApply = getCurrentColors();
      applyColorsToDOM(colorsToApply);
    }
  };

  const handleSetSelectedThemePreset = (presetId: string, shouldSave: boolean = true) => {
    console.log('🎨 Setting theme preset:', presetId);
    setSelectedThemePreset(presetId);

    // Apply preset colors immediately
    const preset = getThemePreset(presetId) || getDefaultThemePreset();
    setCustomColors(preset.colors);
    applyColorsToDOM(preset.colors);

    if (shouldSave) {
      // Save to settings immediately
      const currentSettings = settingsService.getSettings();
      settingsService.updateSettings({
        ui: {
          ...currentSettings.ui,
          selectedThemePreset: presetId,
          colorMode: 'preset'
        }
      });

      // Notify main process immediately
      const themeData = {
        customColors: preset.colors,
        useCustomColors: false
      };

      if (window.electronAPI?.notifyThemeChange) {
        window.electronAPI.notifyThemeChange(themeData);
        console.log('🎨 Theme change notified to main process');
      }
    }
  };

  const handleSetColorMode = (mode: 'preset' | 'custom', shouldSave: boolean = true) => {
    setColorMode(mode);

    // Apply appropriate colors immediately
    const colorsToApply = getCurrentColors(mode);
    applyColorsToDOM(colorsToApply);

    if (shouldSave) {
      try {
        const currentSettings = settingsService.getSettings();
        settingsService.updateSettings({
          ui: { ...currentSettings.ui, colorMode: mode }
        });
      } catch (error) {
        console.error('Error saving color mode:', error);
      }

      // Broadcast theme change
      const themeData = {
        customColors: colorsToApply,
        useCustomColors: mode === 'custom'
      };
      themeSyncService.broadcastThemeChange(themeData);

      // Store current theme in main process for new windows
      if (typeof window !== 'undefined' && window.electronAPI) {
        window.electronAPI.notifyThemeChange(themeData);
      }
    }
  };

  const getCurrentColors = (mode?: 'preset' | 'custom'): ColorSettings => {
    const currentMode = mode || colorMode;
    if (currentMode === 'preset') {
      const preset = getThemePreset(selectedThemePreset) || getDefaultThemePreset();
      return preset.colors;
    } else {
      return useCustomColors ? customColors : getDefaultHexColors();
    }
  };

  const handleSetCustomColors = (colors: ColorSettings, shouldSave: boolean = true) => {
    setCustomColors(colors);

    // Apply theme immediately
    applyColorsToDOM(colors);

    // Only save and notify if requested (settings overlay will handle this)
    if (shouldSave) {
      // Save to settings
      try {
        const currentSettings = settingsService.getSettings();
        settingsService.updateSettings({
          ui: { ...currentSettings.ui, customColors: colors }
        });
      } catch (error) {
        console.error('Error saving custom colors:', error);
      }

      // Broadcast theme change to all windows via sync service
      const themeData = {
        customColors: colors,
        useCustomColors: useCustomColors
      };
      themeSyncService.broadcastThemeChange(themeData);

      // Store current theme in main process for new windows
      if (typeof window !== 'undefined' && window.electronAPI) {
        window.electronAPI.notifyThemeChange(themeData);
      }
    }
  };

  const handleSetUseCustomColors = (use: boolean, shouldSave: boolean = true) => {
    setUseCustomColors(use);

    // Apply theme immediately
    const colorsToApply = use ? customColors : getDefaultHexColors();
    applyColorsToDOM(colorsToApply);

    // Only save and notify if requested (settings overlay will handle this)
    if (shouldSave) {
      // Save to settings
      try {
        const currentSettings = settingsService.getSettings();
        settingsService.updateSettings({
          ui: { ...currentSettings.ui, useCustomColors: use }
        });
      } catch (error) {
        console.error('Error saving useCustomColors setting:', error);
      }

      // Broadcast theme change to all windows via sync service
      const themeData = {
        customColors: customColors,
        useCustomColors: use
      };
      themeSyncService.broadcastThemeChange(themeData);

      // Store current theme in main process for new windows
      if (typeof window !== 'undefined' && window.electronAPI) {
        window.electronAPI.notifyThemeChange(themeData);
      }
    }
  };

  const resetToDefaults = () => {
    setCustomColors(defaultColors);
    setUseCustomColors(false);

    // Apply theme immediately
    applyColorsToDOM(defaultColors);

    // Save to settings
    try {
      const currentSettings = settingsService.getSettings();
      settingsService.updateSettings({
        ui: {
          ...currentSettings.ui,
          customColors: defaultColors,
          useCustomColors: false
        }
      });
    } catch (error) {
      console.error('Error resetting to defaults:', error);
    }

    // Notify other windows about theme change
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.notifyThemeChange({
        customColors: defaultColors,
        useCustomColors: false
      });
    }
  };

  const value = {
    theme: themeState,
    setTheme,
    themes,
    customColors,
    setCustomColors: handleSetCustomColors,
    useCustomColors,
    setUseCustomColors: handleSetUseCustomColors,
    resetToDefaults,
    selectedThemePreset,
    setSelectedThemePreset: handleSetSelectedThemePreset,
    colorMode,
    setColorMode: handleSetColorMode,
    themePresets: THEME_PRESETS,
    getCurrentColors
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
        themes,
        customColors: defaultColors,
        setCustomColors: () => {},
        useCustomColors: false,
        setUseCustomColors: () => {},
        resetToDefaults: () => {},
        selectedThemePreset: 'default',
        setSelectedThemePreset: () => {},
        colorMode: 'preset' as const,
        setColorMode: () => {},
        themePresets: THEME_PRESETS,
        getCurrentColors: () => defaultColors
      };
    }
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
