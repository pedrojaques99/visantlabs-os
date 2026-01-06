import * as React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const nodeButtonVariants = cva(
  "w-full px-5 py-3.5 rounded-md text-xs font-mono transition-all flex items-center justify-center gap-3 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 nodrag nopan backdrop-blur-sm shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-zinc-900/60 hover:bg-zinc-900/80 border border-zinc-700/40 text-zinc-400 hover:text-zinc-300 hover:border-zinc-600/60",
        primary: "bg-brand-cyan/20 hover:bg-brand-cyan/30 border border-brand-cyan/40 text-brand-cyan hover:border-brand-cyan/50",
        purple: "bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-400 hover:border-purple-500/50",
        success: "bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 text-green-400 hover:border-green-500/50",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface NodeButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof nodeButtonVariants> {}

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


