import * as React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const nodeButtonVariants = cva(
  "w-full px-5 py-3.5 rounded-md text-xs font-mono transition-all flex items-center justify-center gap-3 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 nodrag nopan backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-neutral-900/50 hover:bg-neutral-900/70 border border-neutral-700/30 text-neutral-400 hover:text-neutral-300",
        primary: "bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-[brand-cyan]/30 text-brand-cyan",
        purple: "bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-400",
        success: "bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface NodeButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof nodeButtonVariants> { }

const NodeButton = React.forwardRef<HTMLButtonElement, NodeButtonProps>(
  ({ className, variant, ...props }, ref) => {
    return (
      <button
        className={cn(nodeButtonVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
NodeButton.displayName = "NodeButton"

export { NodeButton, nodeButtonVariants }


