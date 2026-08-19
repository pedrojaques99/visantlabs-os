import React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cn } from '@/lib/utils';
import { glassSurface } from '@/lib/ui/glass';

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  intensity?: 'subtle' | 'default' | 'strong';
  asChild?: boolean;
}

const intensityStyles = {
  subtle: glassSurface.panelSubtle,
  default: glassSurface.panel,
  strong: glassSurface.panelStrong,
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
          // 300ms é o TETO pra UI. Num painel grande a borda demora a assentar e o
          // hover parece um flash. --dur-base (200ms) é o default do craft.
          'border rounded-lg flex flex-col relative z-20 transition-colors [transition-duration:var(--dur-base)]',
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
