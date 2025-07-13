import * as React from "react"
import { Button } from "./button"
import { Wrench, WrenchIcon } from "lucide-react"
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
        "h-10 w-10 cursor-pointer flex-shrink-0 transition-all duration-200",
        enabled 
          ? "bg-primary/20 text-primary hover:bg-primary/30" 
          : "text-muted-foreground hover:text-foreground hover:bg-accent",
        className
      )}
      style={style}
      title={title}
    >
      <Wrench 
        className={cn(
          "h-4 w-4 transition-all duration-200",
          enabled ? "text-primary" : "text-muted-foreground"
        )} 
      />
    </Button>
  )
}
