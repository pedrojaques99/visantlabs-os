import React, { forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SearchBarProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  showClearButton?: boolean;
  iconSize?: number;
  className?: string;
  containerClassName?: string;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  (
    {
      value,
      onChange,
      onClear,
      showClearButton = true,
      iconSize = 14,
      className,
      containerClassName,
      placeholder = 'Search...',
      ...props
    },
    ref
  ) => {
    const handleClear = () => {
      onChange('');
      onClear?.();
    };

    return (
      <div className={cn('relative', containerClassName)}>
        <Search
          size={iconSize}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
        />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(
            'w-full pl-8 pr-8 py-1.5 text-xs bg-neutral-900/50 border border-neutral-800/40 rounded-md',
            'text-neutral-300 placeholder:text-neutral-600',
            'focus:outline-none focus:border-[brand-cyan]/50 focus:ring-1 focus:ring-[brand-cyan]/20',
            'transition-all duration-150',
            className
          )}
          {...props}
        />
        {showClearButton && value && (
          <button
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors"
            aria-label="Clear search"
            type="button"
          >
            <X size={iconSize} />
          </button>
        )}
      </div>
    );
  }
);

SearchBar.displayName = 'SearchBar';
