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
        "relative inline-flex items-center rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 border-2 border-transparent",
        currentSize.container,
        enabled
          ? "bg-green-500 hover:bg-green-600"
          : "bg-gray-300 hover:bg-gray-400 dark:bg-gray-600 dark:hover:bg-gray-500",
        disabled && "opacity-50 cursor-not-allowed",
        !disabled && "cursor-pointer",
        className
      )}
    >
      <span
        className={cn(
          "inline-block rounded-full bg-white shadow-lg transform transition-all duration-300 ease-in-out",
          currentSize.thumb,
          enabled ? currentSize.translate : "translate-x-0.5"
        )}
      />
    </button>
  )
}
