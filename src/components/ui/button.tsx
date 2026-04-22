import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // ── Core ─────────────────────────────────────────────────────────────
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // ── Brand ────────────────────────────────────────────────────────────
        brand: "bg-brand-cyan/80 hover:bg-brand-cyan/90 text-black border border-brand-cyan/30 hover:border-brand-cyan/50 shadow-lg shadow-brand-cyan/20",
        sidebarAction: "bg-neutral-800/50 hover:bg-brand-cyan/10 disabled:bg-neutral-700 disabled:text-neutral-500 text-neutral-400 hover:text-brand-cyan border border-neutral-700/50 hover:border-brand-cyan/30 shadow-lg hover:shadow-brand-cyan/10 transform hover:scale-[1.02] active:scale-100 disabled:hover:scale-100",
        // ── Surface actions ──────────────────────────────────────────────────
        // Bordered muted button — toolbars, page headers, inline forms
        // Usage: px-4 py-2, border, muted text, subtle bg hover
        surface: "bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700/50 text-neutral-300 font-mono rounded-md",
        // Toolbar compact — uppercase tracking, brand-cyan accent on hover
        // Usage: canvas headers, guideline export bars
        toolbar: "h-9 px-4 text-[10px] font-bold uppercase tracking-widest rounded-md text-neutral-400 hover:text-brand-cyan hover:bg-brand-cyan/5",
        // ── Icon actions ─────────────────────────────────────────────────────
        // Inline icon — hover-reveal action icons inside cards/rows
        // Usage: edit, copy, delete icons that appear on group-hover
        action: "p-1.5 rounded-md text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-300",
        // Destructive icon — delete/remove actions
        // Usage: trash icons, remove buttons
        danger: "p-1.5 rounded-md text-neutral-500 hover:bg-red-500/10 hover:text-red-400",
        // ── Menu / dropdown ──────────────────────────────────────────────────
        // Full-width monospace dropdown item
        // Usage: auth dropdowns, footer policy links, language selector
        menuItem: "w-full justify-start px-3 py-2 rounded-md text-[10px] font-mono text-neutral-400 hover:text-white hover:bg-neutral-900/50",
        // ── Info / variant states ────────────────────────────────────────────
        info: "bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400",
        warning: "bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        xs: "h-7 rounded-md px-2 text-[10px]",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        // Small icon — 6×6, used in tight inline contexts
        "icon-sm": "h-6 w-6",
        // Medium icon — 8×8, used in section headers
        "icon-md": "h-8 w-8",
        sidebar: "h-[410px] px-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

