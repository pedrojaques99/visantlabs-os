import * as React from 'react';
import { cn } from '@/lib/utils';
import { FormLabel, FormLabelProps } from './form-label';
import { X, Check } from 'lucide-react';

export interface FormFieldProps {
  label?: string;
  labelProps?: FormLabelProps;
  error?: string;
  success?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}

const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ label, labelProps, error, success, hint, required, children, className }, ref) => {
    return (
      <div ref={ref} className={cn('space-y-2', className)}>
        {label && (
          <FormLabel {...labelProps}>
            {label}
            {required && <span className="text-destructive ml-1">*</span>}
          </FormLabel>
        )}
        {children}
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-sm text-destructive font-mono flex items-center gap-2">
            <X size={14} />
            {error}
          </div>
        )}
        {success && (
          <div className="bg-success/10 border border-success/30 rounded-md p-3 text-sm text-success font-mono flex items-center gap-2">
            <Check size={14} />
            {success}
          </div>
        )}
        {hint && !error && !success && <p className="text-xs text-neutral-500 font-mono">{hint}</p>}
      </div>
    );
  }
);
FormField.displayName = 'FormField';

export { FormField };
