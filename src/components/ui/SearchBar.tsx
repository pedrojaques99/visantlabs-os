import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchBarProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'size'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  showClearButton?: boolean;
  iconSize?: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  containerClassName?: string;
}

const SIZE_STYLES = {
  sm: {
    input: 'pl-8 pr-8 py-1.5 text-xs rounded-md',
    iconLeft: 'left-2.5',
    iconRight: 'right-2',
    iconSize: 14,
  },
  md: {
    input: 'pl-10 pr-10 py-2.5 text-sm rounded-lg',
    iconLeft: 'left-3',
    iconRight: 'right-3',
    iconSize: 16,
  },
  lg: {
    input: 'pl-12 pr-12 py-4 text-lg rounded-xl',
    iconLeft: 'left-4',
    iconRight: 'right-4',
    iconSize: 20,
  },
};

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  (
    {
      value,
      onChange,
      onClear,
      showClearButton = true,
      iconSize: iconSizeOverride,
      size = 'sm',
      className,
      containerClassName,
      placeholder = 'Search...',
      ...props
    },
    ref
  ) => {
    const s = SIZE_STYLES[size];
    const resolvedIconSize = iconSizeOverride ?? s.iconSize;

    const handleClear = () => {
      onChange('');
      onClear?.();
    };

    return (
      <div className={cn('relative', containerClassName)}>
        <Search
          size={resolvedIconSize}
          className={cn(
            'absolute top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none',
            s.iconLeft
          )}
        />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full bg-neutral-900/50 border border-neutral-800/40',
            s.input,
            'text-neutral-300 placeholder:text-neutral-600',
            'focus:outline-none focus:border-neutral-600',
            'transition-all duration-150',
            className
          )}
          {...props}
        />
        {showClearButton && value && (
          <button
            onClick={handleClear}
            className={cn(
              'absolute top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors',
              s.iconRight
            )}
            aria-label="Clear search"
            type="button"
          >
            <X size={resolvedIconSize} />
          </button>
        )}
      </div>
    );
  }
);

SearchBar.displayName = 'SearchBar';
