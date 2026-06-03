import * as React from 'react';
import { cn } from '@/lib/utils';

export type NodeLabelProps = React.LabelHTMLAttributes<HTMLLabelElement>;

const NodeLabel = React.forwardRef<HTMLLabelElement, NodeLabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        className={cn('text-xs text-neutral-400 font-mono mb-3 block tracking-tight', className)}
        ref={ref}
        {...props}
      />
    );
  }
);
NodeLabel.displayName = 'NodeLabel';

export { NodeLabel };
