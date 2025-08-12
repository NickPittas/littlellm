'use client';

import type React from 'react';

import { useState, useEffect } from 'react';
import {
  Server,
  FileText,
  Settings,
  History,
  Terminal,
  Bot,
  Volume2,
  VolumeX
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';
import { DEFAULT_PROVIDERS } from '../../services/providers/constants';
import { ProviderLogo } from '../ui/provider-logo';
import { settingsService } from '../../services/settingsService';

// SSR-safe debug logging helper
function safeDebugLog(level: 'info' | 'warn' | 'error', prefix: string, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    // During SSR, just use console
    console[level](`[${prefix}]`, ...args);
    return;
  }
  
  try {
    const { debugLogger } = require('../../services/debugLogger');
    if (debugLogger) {
      debugLogger[level](prefix, ...args);
    } else {
      console[level](`[${prefix}]`, ...args);
    }
  } catch {
    console[level](`[${prefix}]`, ...args);
  }
}
interface SidebarItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
  onClick?: () => void;
  providers?: string[]; // For provider sections
}

interface LeftSidebarProps {
  className?: string;
  onItemClick?: (itemId: string) => void;
  selectedProvider?: string;
  onProviderClick?: (element: HTMLElement) => void;
}

export function LeftSidebar({
  className,
  onItemClick,
  selectedProvider,
  onProviderClick
}: LeftSidebarProps) {
  const [activeItem, setActiveItem] = useState<string>('');
  const [ttsEnabled, setTtsEnabled] = useState(false);

  // Load TTS on mount and subscribe to settings changes
  useEffect(() => {
    const loadTtsSettings = () => {
      const settings = settingsService.getSettings();
      const enabled = settings.ui?.textToSpeech?.enabled || false;
      setTtsEnabled(enabled);
    };
    loadTtsSettings();
    const handleSettingsChange = () => loadTtsSettings();
    window.addEventListener('settingsSaved', handleSettingsChange);
    return () => window.removeEventListener('settingsSaved', handleSettingsChange);
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
    } catch (err) {
      safeDebugLog('error', 'LEFTSIDEBAR', 'Failed to toggle TTS:', err);
    }
  };

  const selectedProviderData = DEFAULT_PROVIDERS.find(p => p.id === selectedProvider);

  const sidebarItems: SidebarItem[] = [
    {
      id: 'agents',
      label: 'CUSTOM AGENTS',
      icon: Bot,
      onClick: () => handleItemClick('agents')
    },
    {
      id: 'mcp-servers',
      label: 'MCP SERVERS',
      icon: Server,
      onClick: () => handleItemClick('mcp-servers')
    },
    {
      id: 'prompts',
      label: 'PROMPTS',
      icon: FileText,
      onClick: () => handleItemClick('prompts')
    },
    {
      id: 'history',
      label: 'HISTORY',
      icon: History,
      onClick: () => handleItemClick('history')
    },
    {
      id: 'console',
      label: 'CONSOLE',
      icon: Terminal,
      onClick: () => handleItemClick('console')
    },
    {
      id: 'settings',
      label: 'SETTINGS',
      icon: Settings,
      onClick: () => handleItemClick('settings')
    }
  ];

  const handleItemClick = (itemId: string) => {
    setActiveItem(itemId);
    onItemClick?.(itemId);
  };

  return (
    <div
      className={cn(
        "flex flex-col w-12 h-full bg-gray-900/50 border-r border-gray-800/50",
        className
      )}
    >
      {/* Top controls: Provider + TTS */}
      <div className="p-1 space-y-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* Provider selector */}
        <Button
          variant="ghost"
          className="w-10 h-10 p-0 text-gray-400 hover:text-white hover:bg-gray-800/50"
          onClick={(e) => onProviderClick?.(e.currentTarget)}
          title={selectedProviderData ? selectedProviderData.name : 'Select Provider'}
        >
          {selectedProviderData ? (
            <div className="w-4 h-4">
              <ProviderLogo provider={selectedProviderData} size={16} />
            </div>
          ) : (
            <Server className="w-4 h-4" />
          )}
        </Button>

        {/* TTS toggle */}
        <Button
          variant="ghost"
          className={cn(
            "w-10 h-10 p-0 transition-colors",
            ttsEnabled ? "text-blue-400 hover:text-blue-300 hover:bg-blue-600/20" : "text-gray-400 hover:text-white hover:bg-gray-800/50"
          )}
          onClick={handleTtsToggle}
          title={ttsEnabled ? 'Disable Text to Speech' : 'Enable Text to Speech'}
        >
          {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </Button>
      </div>

      {/* Spacer to push navigation to bottom */}
      <div className="flex-1"></div>

      {/* Navigation Items - At bottom */}
      <div className="p-1 space-y-1">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;

          return (
            <Button
              key={item.id}
              variant="ghost"
              className={cn(
                "w-10 h-10 p-0",
                "hover:bg-gray-800/50 transition-colors duration-200",
                isActive && "bg-gray-800/70 text-white",
                !isActive && "text-gray-400 hover:text-white"
              )}
              onClick={item.onClick}
              title={item.label}
            >
              <Icon className="w-4 h-4" />
            </Button>
          );
        })}
      </div>
    </div>
  );
}
