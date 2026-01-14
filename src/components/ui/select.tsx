import * as React from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  variant?: 'default' | 'node';
  disabled?: boolean;
  className?: string;
  onMouseDown?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({ className, options, value, onChange, placeholder, variant = 'default', disabled = false, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [focusedIndex, setFocusedIndex] = React.useState(-1);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const listRef = React.useRef<HTMLUListElement>(null);

    // Merge refs
    React.useImperativeHandle(ref, () => buttonRef.current as HTMLButtonElement);

    const selectedOption = options.find(opt => opt.value === value);
    const displayValue = selectedOption?.label || placeholder || 'Select...';

    // Close on outside click
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setFocusedIndex(0);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
    }, [isOpen]);

    // Keyboard navigation
    React.useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false);
          setFocusedIndex(0);
          buttonRef.current?.focus();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedIndex(prev => {
            const next = prev < options.length - 1 ? prev + 1 : 0;
            scrollToOption(next);
            return next;
          });
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedIndex(prev => {
            const next = prev > 0 ? prev - 1 : options.length - 1;
            scrollToOption(next);
            return next;
          });
        } else if (e.key === 'Enter' && focusedIndex >= 0) {
          e.preventDefault();
          handleSelect(options[focusedIndex].value);
        } else if (e.key === 'Home') {
          e.preventDefault();
          setFocusedIndex(0);
          scrollToOption(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          setFocusedIndex(options.length - 1);
          scrollToOption(options.length - 1);
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, focusedIndex, options]);

    // Scroll to focused option
    const scrollToOption = (index: number) => {
      if (listRef.current) {
        const option = listRef.current.children[index] as HTMLElement;
        if (option) {
          option.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      }
    };

    // Set initial focus when opening
    React.useEffect(() => {
      if (isOpen && selectedOption) {
        const index = options.findIndex(opt => opt.value === selectedOption.value);
        setFocusedIndex(index >= 0 ? index : 10);
      }
    }, [isOpen]);

    const handleSelect = (newValue: string) => {
      onChange(newValue);
      setIsOpen(false);
      setFocusedIndex(-1);
    };

    const baseStyles = variant === 'node'
      ? "w-full px-3 py-2 bg-neutral-800 border border-neutral-800/30 rounded text-xs font-mono text-neutral-300 z-[100]"
      : "w-full px-3 py-2.5 bg-neutral-800 border border-neutral-800 rounded-xl text-neutral-200 text-sm font-mono z-[100]";

    const focusStyles = variant === 'node'
      ? "focus:outline-none focus:border-[brand-cyan]/50 z-[100]"
      : "focus:outline-none focus:border-[brand-cyan]/70 focus:ring-2 focus:ring-[brand-cyan]/20 z-[100]";

    return (
      <div ref={containerRef} className={cn("relative w-full", isOpen && "z-[99999]")}>
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            baseStyles,
            focusStyles,
            "transition-all duration-200 appearance-none cursor-pointer",
            "flex items-center justify-between gap-2",
            "hover:border-neutral-600/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            isOpen && "border-[brand-cyan]/50",
            variant === 'node' ? "node-interactive z-[99999]" : "",
            className
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={displayValue}
          {...props}
        >
          <span className={cn(
            "truncate",
            !selectedOption && "text-neutral-500"
          )}>
            {displayValue}
          </span>
          <ChevronDown
            size={16}
            className={cn(
              "text-neutral-400 pointer-events-none flex-shrink-0 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div
            className={cn(
              "absolute z-[99999] w-full mt-1",
              "bg-neutral-800 backdrop-blur-xl",
              "border border-neutral-700/50 rounded-md",
              "shadow-2xl",
              "overflow-hidden",
              "animate-fade-in"
            )}
            role="listbox"
            style={{
              animation: 'fade-in 0.2s ease-out',
              zIndex: 99999,
            }}
          >
            <ul
              ref={listRef}
              className="max-h-60 overflow-auto scrollbar-thin scrollbar-thumb-neutral-400 dark:scrollbar-thumb-neutral-700 scrollbar-track-transparent"
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isFocused = index === focusedIndex;

                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(option.value)}
                    onMouseEnter={() => setFocusedIndex(index)}
                    className={cn(
                      "px-3 py-2 cursor-pointer",
                      "text-xs font-mono relative",
                      "transition-all duration-150",
                      "flex items-center justify-between gap-2",
                      "border-l-2 border-transparent", // Marker for hover
                      isFocused && "bg-neutral-800/60 border-neutral-600", // Focused state
                      isSelected && "bg-brand-cyan/10 text-brand-cyan border-[brand-cyan]", // Selected state
                      !isSelected && !isFocused && "text-neutral-400 hover:bg-neutral-800/40 hover:text-neutral-200 hover:border-neutral-700" // Subtle hover
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && (
                      <Check size={14} className="text-brand-cyan flex-shrink-0" />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
