import * as React from 'react';
import { cn } from '@/lib/utils';

export type FormTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'w-full px-4 py-3 bg-background/70 border border-border rounded-md text-foreground text-sm focus:outline-none focus:border-ring transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-muted-foreground resize-y min-h-[80px]',
          className
        )}
        style={{
          resize: 'vertical',
          ...props.style,
        }}
        ref={ref}
        {...props}
      />
    );
  }
);
FormTextarea.displayName = 'FormTextarea';

export { FormTextarea };
