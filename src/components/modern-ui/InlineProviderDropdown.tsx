'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { ProviderLogo } from '../ui/provider-logo';
import { DEFAULT_PROVIDERS } from '../../services/providers/constants';
import type { LLMProvider } from '../../services/llmService';
import { cn } from '@/lib/utils';

interface InlineProviderDropdownProps {
  type: 'local' | 'remote';
  selectedProvider?: string;
  onProviderSelect?: (providerId: string) => void;
  className?: string;
}

export function InlineProviderDropdown({
  type,
  selectedProvider,
  onProviderSelect,
  className
}: InlineProviderDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load providers on mount
  useEffect(() => {
    const loadProviders = () => {
      const allProviders = DEFAULT_PROVIDERS;
      
      if (type === 'local') {
        const localProviders = allProviders.filter(p => 
          p.id === 'ollama' || p.id === 'lmstudio'
        );
        setProviders(localProviders);
      } else {
        const remoteProviders = allProviders.filter(p => 
          p.id !== 'ollama' && p.id !== 'lmstudio'
        );
        setProviders(remoteProviders);
      }
    };
    
    loadProviders();
  }, [type]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedProviderData = providers.find(p => p.id === selectedProvider);

  const handleProviderSelect = (provider: LLMProvider) => {
    onProviderSelect?.(provider.id);
    setIsOpen(false);
  };

  return (
    <div className={cn("relative", className)} ref={dropdownRef}>
      {/* Dropdown trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/50 transition-colors min-w-[160px]"
      >
        {selectedProviderData ? (
          <>
            <div className="w-4 h-4 flex-shrink-0">
              <ProviderLogo provider={selectedProviderData} size={16} />
            </div>
            <span className="text-xs text-white truncate">{selectedProviderData.name}</span>
          </>
        ) : (
          <>
            <div className="w-4 h-4 flex-shrink-0 bg-gray-600 rounded" />
            <span className="text-xs text-gray-400 truncate">
              Select {type} provider...
            </span>
          </>
        )}
        <ChevronDown className={cn(
          "text-gray-400 transition-transform ml-auto",
          isOpen && "rotate-180"
        )} style={{ width: '16px', height: '16px' }} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700/50 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto">
          {providers.length === 0 ? (
            <div className="p-2 text-xs text-gray-400 text-center">
              No {type} providers available
            </div>
          ) : (
            providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleProviderSelect(provider)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-800/50 transition-colors",
                  selectedProvider === provider.id && "bg-gray-800/50"
                )}
              >
                <div className="w-4 h-4 flex-shrink-0">
                  <ProviderLogo provider={provider} size={16} />
                </div>
                <span className="text-xs text-white truncate">{provider.name}</span>
                {selectedProvider === provider.id && (
                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full ml-auto" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
