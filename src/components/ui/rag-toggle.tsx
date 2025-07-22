import * as React from "react"
import { Button } from "./button"
import { Sparkles } from "lucide-react"
import { cn } from "../../lib/utils"

interface RAGToggleProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  className?: string
  style?: React.CSSProperties
  title?: string
}

export function RAGToggle({
  enabled,
  onToggle,
  className,
  style,
  title = "Toggle RAG (Knowledge Base)"
}: RAGToggleProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onToggle(!enabled)}
      className={cn(
        "h-8 w-8 p-0 cursor-pointer flex-shrink-0 transition-all duration-200 relative",
        enabled
          ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md"
          : "text-muted-foreground hover:text-foreground hover:bg-accent border border-border",
        className
      )}
      style={style}
      title={title}
    >
      <Sparkles
        className={cn(
          "h-4 w-4 transition-all duration-200",
          enabled ? "text-yellow-400" : "text-muted-foreground"
        )}
      />
      {/* Visual indicator dot when enabled */}
      {enabled && (
        <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-500 rounded-full border border-background" />
      )}
    </Button>
  )
}
