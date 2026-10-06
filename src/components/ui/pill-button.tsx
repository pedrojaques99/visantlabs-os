import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const pillButtonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md bg-transparent border transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-200 focus:outline-none focus:ring-offset-2 focus:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        outline:
          'border-border hover:border-border-hover text-muted-foreground hover:text-foreground',
        outlineDark:
          'border-border hover:border-border-hover text-muted-foreground hover:text-foreground',
        outlineLight:
          'border-border hover:border-border-hover text-muted-foreground hover:text-foreground',
      },
      size: {
        sm: 'px-3 py-2 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-base',
      },
    },
    defaultVariants: {
      variant: 'outline',
      size: 'md',
    },
  }
);

export interface PillButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof pillButtonVariants> {}

const PillButton = React.forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(pillButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
PillButton.displayName = 'PillButton';

export { PillButton, pillButtonVariants };
