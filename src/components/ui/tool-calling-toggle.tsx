import * as React from "react"
import { Button } from "./button"
import { Wrench } from "lucide-react"
import { cn } from "../../lib/utils"

interface ToolCallingToggleProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  className?: string
  style?: React.CSSProperties
  title?: string
}

export function ToolCallingToggle({
  enabled,
  onToggle,
  className,
  style,
  title = "Toggle Tool Calling"
}: ToolCallingToggleProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onToggle(!enabled)}
      className={cn(
        "h-10 w-10 cursor-pointer flex-shrink-0 transition-all duration-200 relative",
        enabled
          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
          : "text-muted-foreground hover:text-foreground hover:bg-accent border border-border",
        className
      )}
      style={style}
      title={title}
    >
      <Wrench
        className={cn(
          "h-4 w-4 transition-all duration-200",
          enabled ? "text-primary-foreground" : "text-muted-foreground"
        )}
      />
      {/* Visual indicator dot when enabled */}
      {enabled && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full border border-background" />
      )}
    </Button>
  )
}
