

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

"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Input } from "./input"

interface ElectronDropdownProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  options: string[]
  disabled?: boolean
  className?: string
  displayTransform?: (value: string) => string // Optional function to transform display text
}

export function ElectronDropdown({
  value,
  onValueChange,
  placeholder = "Select an option...",
  options,
  disabled = false,
  className,
  displayTransform
}: ElectronDropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const isElectron = typeof window !== 'undefined' && window.electronAPI

  // Sort options alphabetically
  const sortedOptions = React.useMemo(() => {
    return [...options].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
  }, [options])

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!searchValue) return sortedOptions
    return sortedOptions.filter(option =>
      option.toLowerCase().includes(searchValue.toLowerCase())
    )
  }, [sortedOptions, searchValue])

  const handleClose = React.useCallback(async () => {
    if (isElectron) {
      try {
        await window.electronAPI.closeDropdown()
      } catch (error) {
        safeDebugLog('error', 'ELECTRON_DROPDOWN', 'Failed to close floating dropdown:', error)
      }
    }
    setOpen(false)
    setSearchValue("")
  }, [isElectron])

  const openDropdown = async () => {
    if (!isElectron || !triggerRef.current) {
      setOpen(true)
      return
    }

    // Calculate dropdown dimensions
    // Calculate width based on longest option text
    const maxTextLength = Math.max(
      ...filteredOptions.map(option =>
        displayTransform ? displayTransform(option).length : String(option).length
      ),
      12 // Minimum width for "Search options..."
    )
    const dropdownWidth = Math.max(280, Math.min(500, maxTextLength * 8 + 60)) // 8px per char + padding
    // Height calculation: search section (50px) + content area (dynamic) + minimal padding
    const searchSectionHeight = 50
    const itemHeight = 40
    const maxContentHeight = 250
    const calculatedContentHeight = filteredOptions.length * itemHeight + 8 // 8px for content padding
    const actualContentHeight = Math.min(maxContentHeight, calculatedContentHeight)
    const dropdownHeight = searchSectionHeight + actualContentHeight

    try {
      // Get trigger button position relative to the window (not viewport)
      const rect = triggerRef.current.getBoundingClientRect()

      // Calculate position below the trigger
      const x = rect.left
      const y = rect.bottom + 4 // 4px gap below the button

      safeDebugLog('info', 'ELECTRON_DROPDOWN', '🔍 ElectronDropdown position debug:', {
        rect: { left: rect.left, top: rect.top, bottom: rect.bottom, right: rect.right },
        calculated: { x, y },
        dropdownSize: { width: dropdownWidth, height: dropdownHeight }
      })

      // Generate HTML content for dropdown
      const content = generateOptionsDropdownHTML(filteredOptions, value, searchValue, displayTransform)

      // Open dropdown at calculated position (theme will be retrieved from main window)
      await window.electronAPI.openDropdown(x, y, dropdownWidth, dropdownHeight, content)
      setOpen(true)
    } catch (error) {
      safeDebugLog('error', 'ELECTRON_DROPDOWN', 'Failed to open floating dropdown:', error)
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

  const handleSelect = (selectedValue: string) => {
    safeDebugLog('info', 'ELECTRON_DROPDOWN', 'ElectronDropdown handleSelect called with:', selectedValue);
    onValueChange?.(selectedValue);
    handleClose(); // This will close dropdown and restore window size
    safeDebugLog('info', 'ELECTRON_DROPDOWN', 'ElectronDropdown selection completed');
  }

  // Handle dropdown selection events from Electron
  React.useEffect(() => {
    if (isElectron && window.electronAPI?.onDropdownItemSelected) {
      const handleSelection = (selectedValue: string) => {
        safeDebugLog('info', 'ELECTRON_DROPDOWN', '🔥 ELECTRON DROPDOWN: Item selected:', selectedValue);
        safeDebugLog('info', 'ELECTRON_DROPDOWN', '🔥 ELECTRON DROPDOWN: Available options:', options);
        safeDebugLog('info', 'ELECTRON_DROPDOWN', '🔥 ELECTRON DROPDOWN: Is selected value in options?', options.includes(selectedValue));

        // ONLY handle selections that are actually in our options list
        // This prevents cross-dropdown contamination
        if (!options.includes(selectedValue)) {
          safeDebugLog('info', 'ELECTRON_DROPDOWN', '🔥 ELECTRON DROPDOWN: Ignoring selection not in our options:', selectedValue);
          return;
        }

        onValueChange?.(selectedValue);
        setOpen(false);
      };

      window.electronAPI.onDropdownItemSelected(handleSelection);

      return () => {
        // Don't remove all listeners - just let this one be overridden
        // The electron API will handle multiple listeners properly
      };
    }
  }, [isElectron, onValueChange, options]);

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

  const displayValue = value ? (displayTransform ? displayTransform(value) : value) : placeholder

  return (
    <div className="relative" style={{ zIndex: 1 }}>
      <Button
        ref={triggerRef}
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn(
          "justify-between font-normal text-foreground",
          !value && "text-muted-foreground",
          className
        )}
        disabled={disabled}
        onClick={toggleDropdown}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        <span className="truncate text-sm text-foreground">{displayValue}</span>
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

          {/* Dropdown content - opens downward */}
          <div
            className="absolute top-full mt-1 left-0 z-[99999] min-w-full max-w-[350px] bg-card border shadow-lg rounded-md"
            style={{
              WebkitAppRegion: 'no-drag',
              maxHeight: '315px', // Increased by 15px for draggable header
              overflow: 'hidden'
            } as React.CSSProperties & { WebkitAppRegion?: string }}
          >
            <div className="flex flex-col h-full">
              <div className="flex items-center border-b px-3 py-2 flex-shrink-0">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <Input
                  placeholder="Search..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  className="border-0 bg-transparent p-0 text-sm outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
                />
              </div>
              <div
                className="flex-1 min-h-0 overflow-y-auto scrollbar-hide"
                style={{
                  WebkitAppRegion: 'no-drag',
                  maxHeight: '265px' // Increased by 15px for draggable header
                } as React.CSSProperties & { WebkitAppRegion?: string }}
              >
                <div className="p-1">
                  {filteredOptions.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      No options found.
                    </div>
                  ) : (
                    <>
                      <div className="px-2 py-1 text-xs text-muted-foreground">
                        {filteredOptions.length} options available
                      </div>
                      {filteredOptions.map((option) => (
                        <div
                          key={option}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            safeDebugLog('info', 'ELECTRON_DROPDOWN', 'Dropdown item clicked:', option);
                            handleSelect(option);
                          }}
                          className={cn(
                            "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                            value === option && "bg-accent text-accent-foreground"
                          )}
                          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              value === option ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <span className="text-sm truncate flex-1">{displayTransform ? displayTransform(option) : option}</span>
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
function generateOptionsDropdownHTML(options: string[], selectedValue?: string, searchValue?: string, displayTransform?: (value: string) => string): string {
  const searchSection = `
    <div class="search-section">
      <input
        type="text"
        class="search-input"
        placeholder="Search options..."
        value="${searchValue || ''}"
      />
    </div>
  `;

  const optionItems = options.map(option => `
    <div
      class="dropdown-item ${selectedValue === option ? 'selected' : ''}"
      data-value="${option}"
    >
      <span class="check-icon ${selectedValue === option ? 'visible' : ''}">✓</span>
      <span>${displayTransform ? displayTransform(option) : option}</span>
    </div>
  `).join('');

  return `
    <style>
      .search-section {
        padding: 8px 12px;
        border-bottom: 1px solid hsl(var(--border));
        background: hsl(var(--muted));
      }
      .search-input {
        width: 100%;
        padding: 6px 8px;
        background: hsl(var(--background));
        border: 1px solid hsl(var(--border));
        border-radius: 4px;
        color: hsl(var(--foreground));
        font-size: 14px;
        outline: none;
      }
      .search-input::placeholder {
        color: hsl(var(--muted-foreground));
      }
      .dropdown-content {
        max-height: 250px;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .dropdown-content::-webkit-scrollbar {
        display: none;
      }
      .dropdown-item {
        display: flex;
        align-items: center;
        padding: 8px 12px;
        color: hsl(var(--foreground));
        cursor: pointer;
        border-radius: 4px;
        margin: 1px 0;
        font-size: 14px;
        user-select: none;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        box-sizing: border-box;
        min-width: 0;
        transition: background-color 0.2s;
      }
      .dropdown-item:hover {
        background: hsl(var(--accent) / 0.1);
        color: hsl(var(--foreground));
      }
      .dropdown-item.selected {
        background: hsl(var(--accent) / 0.2);
        color: hsl(var(--foreground));
      }
      .check-icon {
        margin-right: 8px;
        width: 16px;
        height: 16px;
        opacity: 0;
        color: hsl(var(--primary));
      }
      .check-icon.visible {
        opacity: 1;
      }
    </style>
    ${searchSection}
    <div class="dropdown-content">
      ${optionItems}
    </div>
  `;
}
