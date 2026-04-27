import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-sm text-neutral-200 font-mono placeholder:text-neutral-500 focus-visible:outline-none focus-visible:border-neutral-600 disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-300 resize-y hover:border-neutral-700 shadow-inner",
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

