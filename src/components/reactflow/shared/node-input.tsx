import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from '@/components/ui/input'

export interface NodeInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> { }

const NodeInput = React.forwardRef<HTMLInputElement, NodeInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <Input
        className={cn(
          "w-full bg-neutral-900/50 border-node border-neutral-700/30 rounded-md px-4 py-3 text-xs text-neutral-300 font-mono placeholder:text-neutral-500 focus:outline-none focus:border-[brand-cyan]/50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors duration-200",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
NodeInput.displayName = "NodeInput"

export { NodeInput }
