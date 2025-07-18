'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface TransparencyConfig {
  opacity: number;
  vibrancyType: string;
  blurRadius: number;
  saturation: number;
}

interface PlatformCapabilities {
  supportsTransparency: boolean;
  supportsVibrancy: boolean;
  supportsBackdropFilter: boolean;
  platform: string;
}

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

const TransparencyContext = createContext<TransparencyContextType | undefined>(undefined);

interface TransparencyProviderProps {
  children: ReactNode;
}

export function TransparencyProvider({ children }: TransparencyProviderProps) {
  const [isTransparencyEnabled, setIsTransparencyEnabled] = useState(true);
  const [config, setConfig] = useState<TransparencyConfig>({
    opacity: 0.85,
    vibrancyType: 'under-window',
    blurRadius: 20,
    saturation: 180,
  });
  const [capabilities, setCapabilities] = useState<PlatformCapabilities | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Detect platform capabilities
  useEffect(() => {
    const detectCapabilities = () => {
      const isElectron = typeof window !== 'undefined' && (window.electronAPI || window.require);
      const supportsBackdropFilter = CSS.supports('backdrop-filter', 'blur(1px)') ||
                                   CSS.supports('-webkit-backdrop-filter', 'blur(1px)');

      const platformCapabilities: PlatformCapabilities = {
        supportsTransparency: true, // Force enable for testing
        supportsVibrancy: isElectron,
        supportsBackdropFilter: true, // Force enable for testing
        platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
      };

      setCapabilities(platformCapabilities);
      setIsInitialized(true);
      console.log('Platform capabilities:', platformCapabilities);
    };

    detectCapabilities();
  }, []);

  const enableTransparency = async () => {
    setIsTransparencyEnabled(true);
    // Notify Electron main process if available
    if (window.electronAPI?.setTransparency) {
      await window.electronAPI.setTransparency(true);
    }
  };

  const disableTransparency = async () => {
    setIsTransparencyEnabled(false);
    // Notify Electron main process if available
    if (window.electronAPI?.setTransparency) {
      await window.electronAPI.setTransparency(false);
    }
  };

  const updateOpacity = async (opacity: number) => {
    setConfig(prev => prev ? { ...prev, opacity } : null);
    // Notify Electron main process if available
    if (window.electronAPI?.setOpacity) {
      await window.electronAPI.setOpacity(opacity);
    }
  };

  const updateVibrancyType = async (type: string) => {
    setConfig(prev => prev ? { ...prev, vibrancyType: type } : null);
    // Notify Electron main process if available
    if (window.electronAPI?.setVibrancyType) {
      await window.electronAPI.setVibrancyType(type);
    }
  };

  const isSupported = capabilities?.supportsTransparency && capabilities?.supportsBackdropFilter;

  return (
    <TransparencyContext.Provider
      value={{
        isTransparencyEnabled,
        config,
        capabilities,
        enableTransparency,
        disableTransparency,
        updateOpacity,
        updateVibrancyType,
        isSupported: isSupported || false,
        isInitialized,
      }}
    >
      {children}
    </TransparencyContext.Provider>
  );
}

export function useTransparency() {
  const context = useContext(TransparencyContext);
  if (context === undefined) {
    throw new Error('useTransparency must be used within a TransparencyProvider');
  }
  return context;
}

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
