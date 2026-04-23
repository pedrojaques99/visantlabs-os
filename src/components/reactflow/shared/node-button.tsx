import * as React from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"
import { Button } from '@/components/ui/button'

const nodeButtonVariants = cva(
  "rounded-md text-[13px] font-mono transition-all flex items-center justify-center gap-3 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 nodrag nopan backdrop-blur-sm shadow-sm hover:shadow-md",
  {
    variants: {
      variant: {
        default: "bg-neutral-900/50 hover:bg-neutral-900/70 border-node border-neutral-800 text-neutral-400 hover:text-neutral-300",
        primary: "bg-foreground/10 hover:bg-foreground/20 border-node border-neutral-800 text-foreground focus:bg-brand-cyan/20 focus:text-brand-cyan focus:border-brand-cyan/50 focus:ring-1 focus:ring-brand-cyan/20",
        purple: "bg-neutral-800/40 hover:bg-purple-500/20 border-node border-neutral-700/30 hover:border-purple-500/50 text-neutral-400 hover:text-purple-400",
        success: "bg-neutral-800/40 hover:bg-green-500/20 border-node border-neutral-700/30 hover:border-green-500/50 text-neutral-400 hover:text-green-400",
        ghost: "bg-transparent hover:bg-neutral-900/40 border-none text-neutral-400 hover:text-neutral-200 shadow-none hover:shadow-none",
      },
      size: {
        default: "w-fit h-fit px-6 py-4",
        full: "w-full h-fit px-6 py-4",
        sm: "w-fit h-fit px-4 py-2.5",
        xs: "w-fit h-fit p-1",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface NodeButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof nodeButtonVariants> { }

const NodeButton = React.forwardRef<HTMLButtonElement, NodeButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <Button variant="ghost" className={cn(nodeButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
NodeButton.displayName = "NodeButton"

export { NodeButton, nodeButtonVariants }


