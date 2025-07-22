'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { settingsService, type ColorSettings } from '../services/settingsService';
import { themeSyncService } from '../services/themeSyncService';
import { getDefaultHexColors, applyColorsToDOM } from '../config/colors';
import { THEME_PRESETS, getThemePreset, getDefaultThemePreset, type ThemePreset } from '../config/themes';

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

  // Apply default colors immediately on mount, then load settings
  useEffect(() => {
    // Apply default colors first to ensure no hardcoded values are used
    console.log('🎨 ThemeProvider: Applying default colors on mount');
    applyColorsToDOM(getDefaultHexColors());

    const loadThemeSettings = async () => {
      try {
        // Only run on client side
        if (typeof window === 'undefined') return;

        const settings = settingsService.getSettings();
        console.log('ThemeProvider: Loaded settings:', settings.ui);

        if (settings.ui.customColors) {
          console.log('ThemeProvider: Setting custom colors:', settings.ui.customColors);
          setCustomColors(settings.ui.customColors);
        }

        // Load theme preset settings
        const themePreset = settings.ui.selectedThemePreset ?? 'default';
        const mode = settings.ui.colorMode ?? 'preset';
        console.log('ThemeProvider: Loading theme preset:', themePreset, 'mode:', mode);
        setSelectedThemePreset(themePreset);
        setColorMode(mode);

        // Always set useCustomColors (could be true or false)
        const useCustom = settings.ui.useCustomColors ?? false;
        console.log('ThemeProvider: Setting useCustomColors:', useCustom);
        setUseCustomColors(useCustom);

        console.log('ThemeProvider: Applying theme with settings');
        // Apply theme based on color mode
        let colorsToApply: ColorSettings;
        if (mode === 'preset') {
          const preset = getThemePreset(themePreset) || getDefaultThemePreset();
          colorsToApply = preset.colors;
        } else {
          colorsToApply = useCustom && settings.ui.customColors ? settings.ui.customColors : getDefaultHexColors();
        }
        applyColorsToDOM(colorsToApply);

        // Initialize theme sync service
        themeSyncService.initialize();
      } catch (error) {
        console.error('Error loading theme settings:', error);
        applyColorsToDOM(getDefaultHexColors());
      }
    };

    loadThemeSettings();
  }, []);

  // Listen for theme changes from other windows
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return;

    const handleThemeChange = (themeData: { customColors: unknown; useCustomColors: boolean }) => {
      console.log('Received theme change:', themeData);
      const customColors = themeData.customColors as ColorSettings;
      setCustomColors(customColors);
      setUseCustomColors(themeData.useCustomColors);
      const colorsToApply = themeData.useCustomColors ? customColors : getDefaultHexColors();
      applyColorsToDOM(colorsToApply);
      console.log('Applied theme change to DOM');
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
    setSelectedThemePreset(presetId);

    // Apply theme immediately if in preset mode
    if (colorMode === 'preset') {
      const preset = getThemePreset(presetId) || getDefaultThemePreset();
      applyColorsToDOM(preset.colors);
    }

    if (shouldSave) {
      try {
        const currentSettings = settingsService.getSettings();
        settingsService.updateSettings({
          ui: { ...currentSettings.ui, selectedThemePreset: presetId }
        });
      } catch (error) {
        console.error('Error saving theme preset:', error);
      }

      // Broadcast theme change
      themeSyncService.broadcastThemeChange({
        customColors: getCurrentColors(),
        useCustomColors: colorMode === 'custom'
      });
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
      themeSyncService.broadcastThemeChange({
        customColors: colorsToApply,
        useCustomColors: mode === 'custom'
      });
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
      themeSyncService.broadcastThemeChange({
        customColors: colors,
        useCustomColors: useCustomColors
      });
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
      themeSyncService.broadcastThemeChange({
        customColors: customColors,
        useCustomColors: use
      });
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
