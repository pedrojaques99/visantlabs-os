import * as React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const nodeButtonVariants = cva(
  "w-full px-5 py-3.5 rounded-md text-xs font-mono transition-colors flex items-center justify-center gap-3 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 nodrag nopan",
  {
    variants: {
      variant: {
        default: "bg-zinc-900/50 hover:bg-zinc-900/70 border border-zinc-700/30 text-zinc-400 hover:text-zinc-300",
        primary: "bg-[#52ddeb]/20 hover:bg-[#52ddeb]/30 border border-[#52ddeb]/30 text-[#52ddeb]",
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


