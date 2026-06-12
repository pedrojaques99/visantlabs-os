import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  intensity?: 'subtle' | 'default' | 'strong';
  asChild?: boolean;
}

const intensityStyles = {
  subtle: 'bg-white/[0.03] border-neutral-800',
  default: 'bg-white/[0.03] border-neutral-800',
  strong: 'bg-white/5 border-neutral-800',
} as const;

export const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  (
    { className, padding = 'none', intensity = 'default', children, asChild = false, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : 'div';
    return (
      <Comp
        ref={ref}
        className={cn(
          'border rounded-lg flex flex-col relative z-20 transition-colors duration-300',
          intensityStyles[intensity],
          {
            'p-0': padding === 'none',
            'p-4': padding === 'sm',
            'p-6': padding === 'md',
            'p-8': padding === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </Comp>
    );
  }
);
GlassPanel.displayName = 'GlassPanel';
