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

// NO DEFAULT COLORS - will be loaded from settings only
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeState, setThemeState] = useState<Theme>(themes[0]);
  const [customColors, setCustomColors] = useState<ColorSettings>({} as ColorSettings);
  const [useCustomColors, setUseCustomColors] = useState(false);
  const [selectedThemePreset, setSelectedThemePreset] = useState('');
  const [colorMode, setColorMode] = useState<'preset' | 'custom'>('preset');

  // SIMPLIFIED: Load theme ONCE from main process at startup
  useEffect(() => {
    const loadTheme = async () => {
      try {
        if (typeof window === 'undefined') return;

        // Loading theme from main process

        // Get theme directly from main process
        if (window.electronAPI?.getCurrentTheme) {
          const currentTheme = await window.electronAPI.getCurrentTheme();
          // Received theme from main process

          if (currentTheme?.customColors) {
            // Apply theme immediately
            setCustomColors(currentTheme.customColors);
            setUseCustomColors(currentTheme.useCustomColors);
            applyColorsToDOM(currentTheme.customColors);
            // Theme applied successfully
            return;
          }
        }

        // NO FALLBACK - app requires valid theme settings
        console.error('❌ CRITICAL: No theme data from main process - app requires valid theme settings');
      } catch (error) {
        console.error('❌ CRITICAL: Error loading theme:', error);
        console.error('❌ App requires valid theme settings - no fallback to defaults');
      }
    };

    loadTheme();
  }, []);

  // Listen for theme changes from other windows
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electronAPI) return;

    const handleThemeChange = (themeData: { customColors: unknown; useCustomColors: boolean }) => {
      // Received theme change
      const receivedColors = themeData.customColors as ColorSettings;

      // Update local state
      setCustomColors(receivedColors);
      setUseCustomColors(themeData.useCustomColors);

      // Apply the colors directly - the main process has already resolved preset vs custom
      // The customColors field contains the actual colors to apply (either preset or custom)
      if (receivedColors && Object.keys(receivedColors).length > 0) {
        applyColorsToDOM(receivedColors);
        // Applied theme change to DOM
      } else {
        // NO FALLBACK - log error but don't apply defaults
        console.error('❌ CRITICAL: No colors received in theme change - cannot apply theme');
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
    // Setting theme preset
    setSelectedThemePreset(presetId);

    // Apply preset colors immediately - NO FALLBACK
    const preset = getThemePreset(presetId);
    if (!preset) {
      console.error(`❌ CRITICAL: Theme preset '${presetId}' not found - cannot apply theme`);
      return;
    }
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
        // Theme change notified to main process
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
      const preset = getThemePreset(selectedThemePreset);
      if (!preset) {
        console.error(`❌ CRITICAL: Theme preset '${selectedThemePreset}' not found - cannot get colors`);
        return {} as ColorSettings;
      }
      return preset.colors;
    } else {
      if (!useCustomColors || !customColors) {
        console.error('❌ CRITICAL: Custom colors mode but no custom colors available');
        return {} as ColorSettings;
      }
      return customColors;
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
    console.error('❌ resetToDefaults is disabled - no default themes available');
    console.log('💡 Use theme presets instead of resetting to defaults');
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
    // NO DEFAULTS - even during static generation
    throw new Error('useTheme must be used within a ThemeProvider - no fallback themes available');
  }
  return context;
};
