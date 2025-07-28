'use client';

import {
  History,
  Terminal,
  Plus,
  Minus,
  Square,
  X,
  Server
} from 'lucide-react';
import { Button } from '../ui/button';
import { ProviderLogo } from '../ui/provider-logo';
import { ProviderFactory } from '../../services/providers/ProviderFactory';
import { cn } from '@/lib/utils';

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
  onHistoryClick,
  onConsoleClick,
  onAddSplitChatClick,
  onMinimize,
  onMaximize,
  onClose,
  selectedProvider,
  onProviderClick
}: TopHeaderProps) {
  
  const handleHistoryClick = () => {
    console.log('History clicked');
    onHistoryClick?.();
  };

  const handleConsoleClick = () => {
    console.log('Console clicked');
    onConsoleClick?.();
  };

  const handleAddSplitChatClick = () => {
    console.log('Add Split Chat clicked');
    onAddSplitChatClick?.();
  };

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

  const handleProviderClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onProviderClick?.(event.currentTarget);
  };

  // Get selected provider data
  const allProviders = ProviderFactory.getAllProviders();
  const selectedProviderData = allProviders.find(p => p.id === selectedProvider);

  return (
    <div
      className={cn(
        "flex items-center justify-between h-8 px-4 bg-gray-900/30",
        "drag-handle", // Allow window dragging
        className
      )}
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left side - Provider selector */}
      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleProviderClick}
          className="h-6 px-2 text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
          title="Select Provider"
        >
          {selectedProviderData ? (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3">
                <ProviderLogo provider={selectedProviderData} size={12} />
              </div>
              <span className="text-xs">{selectedProviderData.name}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Server className="w-3 h-3" />
              <span className="text-xs">Select Provider</span>
            </div>
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
  );
}
