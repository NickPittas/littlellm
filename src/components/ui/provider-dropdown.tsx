"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"
import { ProviderLogo } from "./provider-logo"
import type { LLMProvider } from "../../services/llmService"

interface ProviderDropdownProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  providers: LLMProvider[]
  disabled?: boolean
  className?: string
}

export function ProviderDropdown({
  value,
  onValueChange,
  placeholder = "Select a provider...",
  providers,
  disabled = false,
  className
}: ProviderDropdownProps) {
  const [open, setOpen] = React.useState(false)

  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const isElectron = typeof window !== 'undefined' && window.electronAPI

  // Sort providers alphabetically by name
  const sortedProviders = React.useMemo(() => {
    return [...providers].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
  }, [providers])

  // Use all sorted providers (no search filtering)
  const filteredProviders = sortedProviders

  const handleClose = React.useCallback(async () => {
    if (isElectron) {
      try {
        await window.electronAPI.closeDropdown()
      } catch (error) {
        console.error('Failed to close floating dropdown:', error)
      }
    }
    setOpen(false)
  }, [isElectron])

  const handleSelect = (selectedProvider: LLMProvider) => {
    console.log('ProviderDropdown handleSelect called with:', selectedProvider.name);
    onValueChange?.(selectedProvider.name);
    handleClose();
    console.log('ProviderDropdown selection completed');
  }

  const openDropdown = async () => {
    if (!isElectron || !triggerRef.current) {
      setOpen(true)
      return
    }

    // Calculate dropdown dimensions
    const dropdownWidth = 280
    const dropdownHeight = Math.min(300, filteredProviders.length * 40 + 80) // Dynamic height

    try {
      // Get trigger button position relative to the window (not viewport)
      const rect = triggerRef.current.getBoundingClientRect()

      // Calculate position below the trigger
      const x = rect.left
      const y = rect.bottom + 4 // 4px gap below the button

      // Generate HTML content for dropdown
      const content = generateProviderDropdownHTML(filteredProviders, value)

      // Open dropdown at calculated position
      await window.electronAPI.openDropdown(x, y, dropdownWidth, dropdownHeight, content)
      setOpen(true)
    } catch (error) {
      console.error('Failed to open floating dropdown:', error)
      setOpen(true) // Fallback to regular dropdown
    }
  }

  const toggleDropdown = () => {
    if (disabled) return

    if (open) {
      handleClose()
    } else {
      openDropdown()
    }
  }

  // Handle dropdown selection events from Electron
  React.useEffect(() => {
    if (isElectron && window.electronAPI?.onDropdownItemSelected) {
      const handleSelection = (value: string) => {
        console.log('🚀 ELECTRON DROPDOWN: Provider selected:', value);
        console.log('🚀 ELECTRON DROPDOWN: Calling onValueChange with:', value);
        onValueChange?.(value);
        setOpen(false);
      };

      window.electronAPI.onDropdownItemSelected(handleSelection);

      return () => {
        // Clean up listener
        window.electronAPI?.removeAllListeners?.('dropdown-item-selected');
      };
    }
  }, [isElectron, onValueChange]);

  // Close dropdown when clicking outside (for non-Electron fallback)
  React.useEffect(() => {
    if (!isElectron && open) {
      const handleClickOutside = (event: MouseEvent) => {
        if (triggerRef.current && !triggerRef.current.contains(event.target as Node)) {
          setOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open, isElectron]);

  // Find the selected provider to show its logo
  const selectedProvider = providers.find(p => p.name === value)
  const displayValue = value || placeholder

  return (
    <div className="relative" style={{ zIndex: 1 }}>
      <Button
        ref={triggerRef}
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn(
          "justify-between font-normal",
          !value && "text-muted-foreground",
          className
        )}
        disabled={disabled}
        onClick={toggleDropdown}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {selectedProvider ? (
            <div className="w-4 h-4 flex-shrink-0">
              <ProviderLogo provider={selectedProvider} size={16} className="flex-shrink-0" />
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">?</span>
          )}
        </div>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && !isElectron && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-[99998]"
            onClick={handleClose}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
          />

          {/* Dropdown content - only show for non-Electron fallback */}
          <div
            className="absolute top-full mt-1 left-0 z-[99999] w-[280px] bg-card border shadow-lg rounded-md overflow-hidden"
            style={{
              WebkitAppRegion: 'no-drag',
              maxHeight: '300px',
              overflowX: 'hidden'
            } as React.CSSProperties & { WebkitAppRegion?: string }}
          >
            <div className="flex flex-col h-full">
              <div
                className="overflow-y-auto flex-1 min-h-0"
                style={{
                  WebkitAppRegion: 'no-drag',
                  scrollbarWidth: 'none',
                  overflowX: 'hidden',
                  maxHeight: '180px'
                } as React.CSSProperties & { WebkitAppRegion?: string }}
                onWheel={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const target = e.currentTarget;
                  target.scrollTop += e.deltaY;
                }}
              >
                <div className="p-1">
                  {filteredProviders.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No providers found.
                    </div>
                  ) : (
                    <>
                      <div className="px-2 py-1 text-xs text-muted-foreground">
                        {filteredProviders.length} providers available
                      </div>
                      {filteredProviders.map((provider) => (
                        <div
                          key={provider.id}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Provider item clicked:', provider.name);
                            handleSelect(provider);
                          }}
                          className={cn(
                            "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                            value === provider.name && "bg-accent text-accent-foreground"
                          )}
                          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4 flex-shrink-0",
                              value === provider.name ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <ProviderLogo
                            provider={provider}
                            size={20}
                            className="mr-3 flex-shrink-0"
                          />
                          <span className="text-sm truncate">{provider.name}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// Helper function to generate HTML content for the floating dropdown
function generateProviderDropdownHTML(providers: LLMProvider[], selectedValue?: string): string {

  const providerItems = providers.map(provider => {
    // Convert relative path to absolute URL for Electron context
    const logoUrl = provider.logo.startsWith('/') ? `http://localhost:3000${provider.logo}` : provider.logo;

    return `
    <div
      class="dropdown-item ${selectedValue === provider.name ? 'selected' : ''}"
      data-value="${provider.id}"
    >
      <span class="check-icon ${selectedValue === provider.name ? 'visible' : ''}">✓</span>
      <img
        src="${logoUrl}"
        alt="${provider.name}"
        class="provider-icon"
        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
      />
      <div class="provider-icon-fallback" style="display: none; width: 20px; height: 20px; background: hsl(240 3.7% 15.9%); border-radius: 4px; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; color: hsl(0 0% 98%);">
        ${provider.name.charAt(0).toUpperCase()}
      </div>
      <span>${provider.name}</span>
    </div>
  `;
  }).join('');

  return `
    <style>
      .provider-icon {
        width: 20px;
        height: 20px;
        margin-right: 12px;
        border-radius: 4px;
        object-fit: contain;
      }
      .provider-icon-fallback {
        color: hsl(0 0% 98%);
      }
      .dropdown-content {
        overflow-x: hidden;
        overflow-y: auto;
      }
    </style>
    <div class="dropdown-content">
      ${providerItems}
    </div>
  `;
}
