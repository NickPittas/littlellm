import * as React from "react"
import { cn } from "../../lib/utils"

interface ToggleSwitchProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  className?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function ToggleSwitch({
  enabled,
  onToggle,
  className,
  disabled = false,
  size = 'md'
}: ToggleSwitchProps) {
  const sizeClasses = {
    sm: {
      container: 'w-9 h-5',
      thumb: 'w-4 h-4',
      translate: 'translate-x-4'
    },
    md: {
      container: 'w-11 h-6',
      thumb: 'w-5 h-5',
      translate: 'translate-x-5'
    },
    lg: {
      container: 'w-14 h-7',
      thumb: 'w-6 h-6',
      translate: 'translate-x-7'
    }
  }

  const currentSize = sizeClasses[size]

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={() => !disabled && onToggle(!enabled)}
      className={cn(
        "relative inline-flex items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 border-2 border-transparent",
        currentSize.container,
        enabled
          ? "bg-primary hover:bg-primary/80 shadow-lg shadow-primary/25 border-primary/50 focus:ring-primary"
          : "bg-muted-foreground hover:bg-muted-foreground/80 border-muted-foreground/30 focus:ring-muted-foreground",
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "cursor-pointer",
        className
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-white transform transition-all duration-300 ease-in-out",
          currentSize.thumb,
          enabled
            ? `${currentSize.translate} shadow-lg shadow-green-200/50`
            : "translate-x-0.5 shadow-md shadow-gray-300/50"
        )}
      />
    </button>
  )
}
