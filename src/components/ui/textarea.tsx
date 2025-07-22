import * as React from "react"
import { cn } from "../../lib/utils"

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  // Additional props can be added here if needed
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-input text-foreground px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        style={{
          backgroundColor: 'hsl(var(--input))',
          color: 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--border))'
        }}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
