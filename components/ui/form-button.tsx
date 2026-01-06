import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { GlitchLoader } from "./GlitchLoader"

const formButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold font-mono transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-[#52ddeb]/50 focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none disabled:opacity-50 uppercase",
  {
    variants: {
      variant: {
        primary:
          "bg-brand-cyan/80 hover:bg-brand-cyan text-black shadow-lg shadow-[#52ddeb]/20 hover:scale-[1.02] active:scale-95",
        outline:
          "border border-zinc-800/10 bg-transparent hover:bg-zinc-800/50 text-zinc-200 hover:border-[#52ddeb]/30 hover:text-brand-cyan hover:scale-[1.02] active:scale-95",
        ghost:
          "bg-transparent hover:bg-zinc-800/50 text-zinc-200 hover:text-brand-cyan hover:scale-[1.02] active:scale-95",
        destructive:
          "bg-red-500/80 hover:bg-red-500 text-white shadow-lg shadow-red-500/20 hover:scale-[1.02] active:scale-95",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  }
)

export type FormButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof formButtonVariants> & {
    isLoading?: boolean
  }

const FormButton = React.forwardRef<HTMLButtonElement, FormButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(formButtonVariants({ variant, size, className }))}
        style={{ fontFamily: "'Red Hat Mono', monospace" }}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <GlitchLoader size={16} color="currentColor" />}
        {children}
      </button>
    )
  }
)
FormButton.displayName = "FormButton"

export { FormButton, formButtonVariants }

