'use client';

import { useState, useEffect, useRef } from 'react';
import { Server, Monitor, X } from 'lucide-react';
import { ProviderLogo } from '../ui/provider-logo';
import { ProviderFactory } from '../../services/providers/ProviderFactory';
import type { LLMProvider } from '../../services/llmService';
import { cn } from '@/lib/utils';

interface FloatingProviderSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onProviderSelect: (providerId: string) => void;
  selectedProvider?: string;
  anchorElement?: HTMLElement | null;
  className?: string;
}

export function FloatingProviderSelector({
  isOpen,
  onClose,
  onProviderSelect,
  selectedProvider,
  anchorElement,
  className
}: FloatingProviderSelectorProps) {
  const [localProviders, setLocalProviders] = useState<LLMProvider[]>([]);
  const [remoteProviders, setRemoteProviders] = useState<LLMProvider[]>([]);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const selectorRef = useRef<HTMLDivElement>(null);

  // Load providers on mount
  useEffect(() => {
    const allProviders = ProviderFactory.getAllProviders();
    
    const local = allProviders.filter(p => 
      p.id === 'ollama' || p.id === 'lmstudio'
    );
    const remote = allProviders.filter(p => 
      p.id !== 'ollama' && p.id !== 'lmstudio'
    );
    
    setLocalProviders(local);
    setRemoteProviders(remote);
  }, []);

  // Calculate position based on anchor element
  useEffect(() => {
    if (isOpen && anchorElement) {
      const rect = anchorElement.getBoundingClientRect();
      setPosition({
        top: rect.top + window.scrollY,
        left: rect.right + 10 // 10px gap from the anchor
      });
    }
  }, [isOpen, anchorElement]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectorRef.current && !selectorRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const handleProviderClick = (provider: LLMProvider) => {
    onProviderSelect(provider.id);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      
      {/* Floating selector */}
      <div
        ref={selectorRef}
        className={cn(
          "fixed z-50 w-64 bg-gray-900/95 border border-gray-700/50 rounded-lg shadow-2xl backdrop-blur-sm",
          className
        )}
        style={{
          top: position.top,
          left: position.left,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-2 border-b border-gray-700/50">
          <h3 className="text-sm font-semibold text-white">Select Provider</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {/* Content */}
        <div className="p-2 space-y-3 max-h-80 overflow-y-auto">
          {/* Local Providers */}
          <div>
            <div className="flex items-center gap-1 mb-2">
              <Monitor style={{ width: '16px', height: '16px' }} className="text-blue-400" />
              <span className="text-xs font-medium text-blue-400">Local Providers</span>
            </div>
            <div className="space-y-1">
              {localProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderClick(provider)}
                  className={cn(
                    "w-full flex items-center gap-2 p-2 rounded-lg border transition-colors",
                    selectedProvider === provider.id
                      ? "bg-blue-600/20 border-blue-500/50 text-white"
                      : "bg-gray-800/50 border-gray-700/50 text-gray-300 hover:bg-gray-700/50"
                  )}
                >
                  <div className="w-4 h-4 flex-shrink-0">
                    <ProviderLogo provider={provider} size={16} />
                  </div>
                  <span className="text-xs font-medium">{provider.name}</span>
                  {selectedProvider === provider.id && (
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Remote Providers */}
          <div>
            <div className="flex items-center gap-1 mb-2">
              <Server style={{ width: '16px', height: '16px' }} className="text-green-400" />
              <span className="text-xs font-medium text-green-400">Remote Providers</span>
            </div>
            <div className="space-y-1">
              {remoteProviders.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderClick(provider)}
                  className={cn(
                    "w-full flex items-center gap-2 p-2 rounded-lg border transition-colors",
                    selectedProvider === provider.id
                      ? "bg-blue-600/20 border-blue-500/50 text-white"
                      : "bg-gray-800/50 border-gray-700/50 text-gray-300 hover:bg-gray-700/50"
                  )}
                >
                  <div className="w-4 h-4 flex-shrink-0">
                    <ProviderLogo provider={provider} size={16} />
                  </div>
                  <span className="text-xs font-medium">{provider.name}</span>
                  {selectedProvider === provider.id && (
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
