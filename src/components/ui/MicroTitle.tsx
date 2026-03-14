import React from 'react';
import { cn } from '@/lib/utils';

export interface MicroTitleProps extends React.AllHTMLAttributes<HTMLElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'span' | 'p' | 'label';
}

export const MicroTitle = React.forwardRef<HTMLElement, MicroTitleProps>(
  ({ className, as: Component = 'span', children, ...props }, ref) => {
    return (
      <Component
        ref={ref as any}
        className={cn(
          "text-[10px] font-mono text-neutral-400 uppercase tracking-[0.05em]",
          className
        )}
        {...props}
      >
        {children}
      </Component>
    )
  }
)
MicroTitle.displayName = "MicroTitle"
