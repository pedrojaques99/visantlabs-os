import * as React from 'react';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';

const nodeButtonVariants = cva(
  'rounded-md text-sm font-mono transition-[color,background-color,border-color,box-shadow,opacity,filter] flex items-center justify-center gap-3 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 nodrag nopan backdrop-blur-sm shadow-sm hover:shadow-md',
  {
    variants: {
      variant: {
        default:
          'bg-neutral-900/50 hover:bg-neutral-900/70 border border-neutral-800 text-neutral-400 hover:text-neutral-300',
        primary:
          'bg-foreground/10 hover:bg-foreground/20 border border-neutral-800 text-foreground focus:border-neutral-600',
        // Canvas identity accent. Uses `[var(--brand-cyan)]` and NOT the
        // `brand-cyan` utility on purpose: index.css has unconditional
        // `.node-container [class*='border-border']` / `[class*='text-foreground']`
        // rules that match the `hover:` variants too, forcing the button to
        // `--foreground` + `opacity: .7` at REST. The var form resolves to the
        // same token (per-brand overridden inside nodes) without the trap.
        accent:
          'bg-neutral-800/40 hover:bg-[var(--brand-cyan)]/20 border border-neutral-700/30 hover:border-[var(--brand-cyan)]/50 text-neutral-400 hover:text-[var(--brand-cyan)]',
        success:
          'bg-neutral-800/40 hover:bg-success/20 border border-neutral-700/30 hover:border-success/50 text-neutral-400 hover:text-success',
        ghost:
          'bg-transparent hover:bg-neutral-900/40 border-none text-neutral-400 hover:text-neutral-200 shadow-none hover:shadow-none',
      },
      size: {
        default: 'w-fit h-fit px-6 py-4',
        full: 'w-full h-fit px-6 py-4',
        sm: 'w-fit h-fit px-4 py-2.5',
        xs: 'w-fit h-fit p-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface NodeButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof nodeButtonVariants> {}

const NodeButton = React.forwardRef<HTMLButtonElement, NodeButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <Button
        variant="ghost"
        className={cn(nodeButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
NodeButton.displayName = 'NodeButton';

export { NodeButton, nodeButtonVariants };
