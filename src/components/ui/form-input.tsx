import * as React from 'react';
import { cn } from '@/lib/utils';

export type FormInputProps = React.InputHTMLAttributes<HTMLInputElement>;

const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <>
        <input
          type={type}
          className={cn(
            'w-full px-4 py-3 bg-background/70 border border-border rounded-md text-foreground text-sm focus:outline-none focus:border-ring transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-300 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-muted-foreground',
            type === 'color' && 'color-picker-square',
            className
          )}
          ref={ref}
          {...props}
        />
        {type === 'color' && (
          <style>{`
            input.color-picker-square {
              -webkit-appearance: none;
              -moz-appearance: none;
              appearance: none;
              border: 0.5px solid #374151;
              cursor: pointer;
              padding: 0;
              border-radius: 0;
            }
            input.color-picker-square::-webkit-color-swatch-wrapper {
              padding: 0;
              border-radius: 0;
            }
            input.color-picker-square::-webkit-color-swatch {
              border: none;
              border-radius: 0;
            }
            input.color-picker-square::-moz-color-swatch {
              border: none;
              border-radius: 0;
            }
            /* Square thumb for color picker */
            input.color-picker-square::-webkit-color-picker-indicator {
              border-radius: 0;
              width: 100%;
              height: 100%;
            }
          `}</style>
        )}
      </>
    );
  }
);
FormInput.displayName = 'FormInput';

export { FormInput };
