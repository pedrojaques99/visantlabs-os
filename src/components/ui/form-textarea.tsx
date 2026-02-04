import * as React from "react"
import { cn } from "@/lib/utils"

export interface FormTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> { }

const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "w-full px-4 py-3 bg-neutral-950/70 border border-neutral-800/20 rounded-xl text-neutral-200 font-mono text-sm focus:outline-none focus:border-[brand-cyan]/50 focus:ring-1 focus:ring-[brand-cyan]/30 focus:ring-offset-0 transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-neutral-500 resize-y min-h-[80px]",
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
FormTextarea.displayName = "FormTextarea"

export { FormTextarea }

