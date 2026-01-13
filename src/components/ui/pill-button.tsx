import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const pillButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-transparent border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[brand-cyan]/50 focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        outline: "border-zinc-700/50 hover:border-zinc-600/50 text-zinc-500 hover:text-zinc-400",
        outlineDark: "border-zinc-700/50 hover:border-zinc-600/50 text-zinc-500 hover:text-zinc-400 hover:text-brand-cyan",
        outlineLight: "border-zinc-300/50 hover:border-zinc-400/50 text-zinc-600 hover:text-zinc-700 hover:text-brand-cyan",
      },
      size: {
        sm: "px-3 py-2 text-xs font-mono",
        md: "px-4 py-2 text-sm font-mono",
        lg: "px-6 py-3 text-base font-mono",
      },
    },
    defaultVariants: {
      variant: "outline",
      size: "md",
    },
  }
)

export interface PillButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof pillButtonVariants> { }

const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(pillButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
PillButton.displayName = "PillButton"

export { PillButton, pillButtonVariants }

