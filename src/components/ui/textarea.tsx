import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-neutral-800/5 bg-neutral-900/50 px-3 py-2 text-sm text-neutral-300 font-mono ring-offset-background placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-500/30 focus-visible:ring-offset-0 focus-visible:border-neutral-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200 resize-y",
          className
        )}
        style={{
          resize: 'vertical',
          ...props.style,
        }}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }

