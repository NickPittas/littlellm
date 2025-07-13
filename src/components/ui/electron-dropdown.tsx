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
        console.error('Failed to close floating dropdown:', error)
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
    const dropdownWidth = 280
    const dropdownHeight = Math.min(315, filteredOptions.length * 40 + 80 + 15) // Dynamic height + 15px for draggable header

    try {
      // Get trigger button position relative to the window (not viewport)
      const rect = triggerRef.current.getBoundingClientRect()

      // Calculate position below the trigger
      const x = rect.left
      const y = rect.bottom + 4 // 4px gap below the button

      console.log('🔍 ElectronDropdown position debug:', {
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

  const handleSelect = (selectedValue: string) => {
    console.log('ElectronDropdown handleSelect called with:', selectedValue);
    onValueChange?.(selectedValue);
    handleClose(); // This will close dropdown and restore window size
    console.log('ElectronDropdown selection completed');
  }

  // Handle dropdown selection events from Electron
  React.useEffect(() => {
    if (isElectron && window.electronAPI?.onDropdownItemSelected) {
      const handleSelection = (selectedValue: string) => {
        console.log('🔥 ELECTRON DROPDOWN: Item selected:', selectedValue);
        console.log('🔥 ELECTRON DROPDOWN: Available options:', options);
        console.log('🔥 ELECTRON DROPDOWN: Is selected value in options?', options.includes(selectedValue));

        // ONLY handle selections that are actually in our options list
        // This prevents cross-dropdown contamination
        if (!options.includes(selectedValue)) {
          console.log('🔥 ELECTRON DROPDOWN: Ignoring selection not in our options:', selectedValue);
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
          "justify-between font-normal",
          !value && "text-muted-foreground",
          className
        )}
        disabled={disabled}
        onClick={toggleDropdown}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        <span className="truncate text-sm">{displayValue}</span>
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
                            console.log('Dropdown item clicked:', option);
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
    ${searchSection}
    <div class="dropdown-content">
      ${optionItems}
    </div>
  `;
}
