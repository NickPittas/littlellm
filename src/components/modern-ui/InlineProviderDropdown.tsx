'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { ProviderLogo } from '../ui/provider-logo';
import { ProviderFactory } from '../../services/providers/ProviderFactory';
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
      const allProviders = ProviderFactory.getAllProviders();
      
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
        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800/50 border border-gray-700/50 hover:bg-gray-700/50 transition-colors min-w-[200px]"
      >
        {selectedProviderData ? (
          <>
            <div className="w-4 h-4 flex-shrink-0">
              <ProviderLogo provider={selectedProviderData} size={16} />
            </div>
            <span className="text-sm text-white truncate">{selectedProviderData.name}</span>
          </>
        ) : (
          <>
            <div className="w-4 h-4 flex-shrink-0 bg-gray-600 rounded" />
            <span className="text-sm text-gray-400 truncate">
              Select {type} provider...
            </span>
          </>
        )}
        <ChevronDown className={cn(
          "w-4 h-4 text-gray-400 transition-transform ml-auto",
          isOpen && "rotate-180"
        )} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700/50 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
          {providers.length === 0 ? (
            <div className="p-3 text-sm text-gray-400 text-center">
              No {type} providers available
            </div>
          ) : (
            providers.map((provider) => (
              <button
                key={provider.id}
                onClick={() => handleProviderSelect(provider)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-800/50 transition-colors",
                  selectedProvider === provider.id && "bg-gray-800/50"
                )}
              >
                <div className="w-4 h-4 flex-shrink-0">
                  <ProviderLogo provider={provider} size={16} />
                </div>
                <span className="text-sm text-white truncate">{provider.name}</span>
                {selectedProvider === provider.id && (
                  <div className="w-2 h-2 bg-blue-500 rounded-full ml-auto" />
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
