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
}

export function ElectronDropdown({
  value,
  onValueChange,
  placeholder = "Select an option...",
  options,
  disabled = false,
  className
}: ElectronDropdownProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")
  const [originalWindowSize, setOriginalWindowSize] = React.useState<{width: number, height: number} | null>(null)

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

  // Handle window resizing when dropdown opens/closes
  const handleOpen = React.useCallback(() => {
    if (typeof window !== 'undefined' && window.electronAPI) {
      // Store current window size
      window.electronAPI.getCurrentWindowSize().then((size: {width: number, height: number}) => {
        setOriginalWindowSize(size)
        console.log('Stored original window size:', size)

        // Calculate needed height for dropdown
        const dropdownHeight = Math.min(300, filteredOptions.length * 35 + 100) // 35px per item + search bar
        const newHeight = size.height + dropdownHeight + 20 // Add some padding

        console.log('Resizing window for dropdown:', { newHeight, dropdownHeight })
        window.electronAPI.resizeWindow(size.width, newHeight)
        setOpen(true)
      })
    } else {
      setOpen(true)
    }
  }, [filteredOptions.length])

  const handleClose = React.useCallback(() => {
    setOpen(false)
    setSearchValue("")

    if (typeof window !== 'undefined' && window.electronAPI && originalWindowSize) {
      console.log('Restoring original window size:', originalWindowSize)
      window.electronAPI.resizeWindow(originalWindowSize.width, originalWindowSize.height)
      setOriginalWindowSize(null)
    }
  }, [originalWindowSize])

  const handleSelect = (selectedValue: string) => {
    console.log('ElectronDropdown handleSelect called with:', selectedValue);
    onValueChange?.(selectedValue);
    handleClose(); // This will close dropdown and restore window size
    console.log('ElectronDropdown selection completed');
  }

  const displayValue = value || placeholder

  return (
    <div className="relative">
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className={cn(
          "justify-between font-normal",
          !value && "text-muted-foreground",
          className
        )}
        disabled={disabled}
        onClick={() => open ? handleClose() : handleOpen()}
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        <span className="truncate text-sm">{displayValue}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-[9998]"
            onClick={handleClose}
            style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
          />

          {/* Dropdown content - opens downward */}
          <div
            className="absolute top-full mt-1 left-0 z-[9999] w-[350px] bg-card border shadow-lg rounded-md overflow-hidden"
            style={{
              WebkitAppRegion: 'no-drag',
              maxHeight: '250px'
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
                className="overflow-y-scroll flex-1 min-h-0"
                style={{
                  WebkitAppRegion: 'no-drag',
                  scrollbarWidth: 'auto',
                  scrollBehavior: 'smooth',
                  maxHeight: '180px' // Fixed height to ensure scrolling
                } as React.CSSProperties & { WebkitAppRegion?: string }}
                onWheel={(e) => {
                  // Ensure wheel events are handled properly and don't bubble up
                  e.stopPropagation();
                  e.preventDefault();

                  // Manual scroll handling
                  const target = e.currentTarget;
                  target.scrollTop += e.deltaY;
                }}
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
                          <span className="text-sm">{option}</span>
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
