'use client';

import {
  Minus,
  Square,
  X,
  Server,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Button } from '../ui/button';
import { ProviderLogo } from '../ui/provider-logo';
import { DEFAULT_PROVIDERS } from '../../services/providers/constants';
import { cn } from '@/lib/utils';
import { settingsService } from '../../services/settingsService';
import { useState, useEffect } from 'react';

interface TopHeaderProps {
  className?: string;
  onHistoryClick?: () => void;
  onConsoleClick?: () => void;
  onAddSplitChatClick?: () => void;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  selectedProvider?: string;
  onProviderClick?: (element: HTMLElement) => void;
}

export function TopHeader({
  className,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onHistoryClick,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onConsoleClick,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onAddSplitChatClick,
  onMinimize,
  onMaximize,
  onClose,
  selectedProvider,
  onProviderClick
}: TopHeaderProps) {
  
  // Reserved handlers (currently unused in this header variant)
  // Keeping typed props for future header actions without triggering ESLint unused warnings
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleHistoryClick = () => {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleConsoleClick = () => {};
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleAddSplitChatClick = () => {};

  const handleMinimize = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.minimizeWindow();
    }
    onMinimize?.();
  };

  const handleMaximize = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.maximizeWindow();
    }
    onMaximize?.();
  };

  const handleClose = () => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      window.electronAPI.closeWindow();
    }
    onClose?.();
  };

  // TTS state
  const [ttsEnabled, setTtsEnabled] = useState(false);

  // Load TTS settings
  useEffect(() => {
    const loadTtsSettings = () => {
      const settings = settingsService.getSettings();
      const enabled = settings.ui?.textToSpeech?.enabled || false;
      console.log('🔊 TopHeader: Loading TTS settings, enabled:', enabled);
      setTtsEnabled(enabled);
    };

    loadTtsSettings();

    // Listen for settings changes
    const handleSettingsChange = () => {
      console.log('🔊 TopHeader: Settings changed, reloading TTS settings...');
      loadTtsSettings();
    };

    window.addEventListener('settingsSaved', handleSettingsChange);

    return () => {
      window.removeEventListener('settingsSaved', handleSettingsChange);
    };
  }, []);

  const handleTtsToggle = async () => {
    try {
      const settings = settingsService.getSettings();
      const newTtsEnabled = !ttsEnabled;

      const updatedSettings = {
        ...settings,
        ui: {
          ...settings.ui,
          textToSpeech: {
            ...settings.ui?.textToSpeech,
            enabled: newTtsEnabled,
            voice: settings.ui?.textToSpeech?.voice || '',
            rate: settings.ui?.textToSpeech?.rate || 1.0,
            pitch: settings.ui?.textToSpeech?.pitch || 1.0,
            volume: settings.ui?.textToSpeech?.volume || 0.8,
            autoPlay: settings.ui?.textToSpeech?.autoPlay || false,
          }
        }
      };

      await settingsService.updateSettings(updatedSettings);
      setTtsEnabled(newTtsEnabled);

      console.log('🔊 TTS toggled:', newTtsEnabled);
    } catch (error) {
      console.error('Failed to toggle TTS:', error);
    }
  };

  const handleProviderClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onProviderClick?.(event.currentTarget);
  };

  // Get selected provider data
  const allProviders = DEFAULT_PROVIDERS;
  const selectedProviderData = allProviders.find(p => p.id === selectedProvider);

  return (
    <div
      className={cn(
        "relative h-8 draggable-title-bar select-none", // explicit draggable class for preload hook
        className
      )}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 9999,
        userSelect: 'none',
        WebkitAppRegion: 'drag',
        cursor: 'default'
      } as React.CSSProperties}
    >
      {/* Guaranteed drag strip (6px) above everything else but narrow to avoid blocking controls */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          WebkitAppRegion: 'drag',
          pointerEvents: 'auto',
          zIndex: 3, // above visuals, below content row controls (which are no-drag)
          background: 'transparent'
        } as React.CSSProperties}
      />

      {/* Visual layer: blur + background, non-interactive */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(17, 24, 39, 0.95)'
        } as React.CSSProperties}
      />

      {/* Content row: header wrapper remains draggable; mark interactive elements as no-drag */}
      <div
        className="relative h-8 px-4 flex items-center justify-between"
        style={{ zIndex: 4, WebkitAppRegion: 'drag', pointerEvents: 'auto' } as React.CSSProperties}
      >
        {/* Left side - Provider selector */}
        <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleProviderClick}
            className="h-5 px-1.5 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            title="Select Provider"
          >
            {selectedProviderData ? (
              <div className="flex items-center gap-1">
                <div className="w-3 h-3">
                  <ProviderLogo provider={selectedProviderData} size={12} />
                </div>
                <span className="text-xs">{selectedProviderData.name}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Server style={{ width: '12px', height: '12px' }} />
                <span className="text-xs">Select Provider</span>
              </div>
            )}
          </Button>
        </div>

        {/* Center - TTS Toggle */}
        <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTtsToggle}
            className={cn(
              "h-6 w-6 p-0 transition-colors",
              ttsEnabled
                ? "text-blue-400 hover:text-blue-300 hover:bg-blue-600/20"
                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
            )}
            title={ttsEnabled ? "Disable Text to Speech" : "Enable Text to Speech"}
          >
            {ttsEnabled ? (
              <Volume2 className="w-3 h-3" />
            ) : (
              <VolumeX className="w-3 h-3" />
            )}
          </Button>
        </div>

        {/* Right side - Window controls */}
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMinimize}
            className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            title="Minimize"
          >
            <Minus className="w-3 h-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleMaximize}
            className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
            title="Maximize"
          >
            <Square className="w-3 h-3" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-6 w-6 p-0 text-gray-400 hover:text-white hover:bg-red-600/50 transition-colors"
            title="Close"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
