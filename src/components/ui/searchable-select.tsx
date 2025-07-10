"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { cn } from "../../lib/utils"
import { Button } from "./button"
import { Input } from "./input"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"

interface SearchableSelectProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  options: string[]
  disabled?: boolean
  className?: string
}

export function SearchableSelect({
  value,
  onValueChange,
  placeholder = "Select an option...",
  options,
  disabled = false,
  className
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

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

  const handleSelect = (selectedValue: string) => {
    console.log('SearchableSelect handleSelect called with:', selectedValue);
    onValueChange?.(selectedValue);
    setOpen(false);
    setSearchValue("");
    console.log('SearchableSelect selection completed');
  }

  const displayValue = value || placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
        >
          <span className="truncate text-sm">{displayValue}</span>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[400px] p-0 bg-card border shadow-lg backdrop-blur-none z-[9999]"
        align="start"
        side="top"
        sideOffset={4}
        avoidCollisions={false}
        collisionPadding={0}
        style={{
          WebkitAppRegion: 'no-drag',
          position: 'fixed',
          maxHeight: '300px',
          overflow: 'visible'
        } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        <div
          className="flex flex-col"
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
        >
          <div className="flex items-center border-b px-3 py-2">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Search models..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="border-0 bg-transparent p-0 text-sm outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
            />
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            <div className="p-1">
              {filteredOptions.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No models found.
                </div>
              ) : (
                <>
                  <div className="px-2 py-1 text-xs text-muted-foreground">
                    {filteredOptions.length} models available
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
      </PopoverContent>
    </Popover>
  )
}
