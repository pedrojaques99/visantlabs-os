import * as React from "react"
import { createPortal } from "react-dom"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
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
  loading?: boolean;
  footer?: React.ReactNode;
}

const Select = React.forwardRef<HTMLButtonElement, SelectProps>(
  ({ className, options, value, onChange, placeholder, variant = 'default', disabled = false, loading = false, footer, ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [focusedIndex, setFocusedIndex] = React.useState(-1);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const listRef = React.useRef<HTMLUListElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    const [renderPosition, setRenderPosition] = React.useState<'bottom' | 'top'>('bottom');
    const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({});

    // Merge refs
    React.useImperativeHandle(ref, () => buttonRef.current as HTMLButtonElement);

    const selectedOption = options.find(opt => opt.value === value);
    const displayValue = selectedOption?.label || placeholder || 'Select...';

    const updatePosition = React.useCallback(() => {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      const dropdownHeight = 240;
      const spaceBelow = windowHeight - rect.bottom;
      const showAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

      setRenderPosition(showAbove ? 'top' : 'bottom');

      if (variant === 'node') {
        setDropdownStyle({
          position: 'fixed',
          left: rect.left,
          width: rect.width,
          zIndex: 99999,
          ...(showAbove
            ? { bottom: windowHeight - rect.top + 2 }
            : { top: rect.bottom + 2 }),
        });
      } else {
        setDropdownStyle({});
      }
    }, [variant]);

    React.useLayoutEffect(() => {
      if (!isOpen) return;
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition, true);
      };
    }, [isOpen, updatePosition]);

    // Close on outside click — checks both trigger and portal dropdown
    React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        const insideTrigger = containerRef.current?.contains(target);
        const insideDropdown = dropdownRef.current?.contains(target);
        if (!insideTrigger && !insideDropdown) {
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
        setFocusedIndex(index >= 0 ? index : 0);
      }
    }, [isOpen]);

    const handleSelect = (newValue: string) => {
      onChange(newValue);
      setIsOpen(false);
      setFocusedIndex(-1);
    };

    const baseStyles = variant === 'node'
      ? "w-full px-3 py-2 bg-neutral-950/40 border border-neutral-800 rounded-md text-xs text-neutral-300"
      : "w-full px-3 py-2.5 bg-neutral-800 border border-neutral-800 rounded-xl text-neutral-200 text-sm";

    const focusStyles = "focus:outline-none focus:border-neutral-600";

    const dropdownContent = (
      <div
        ref={dropdownRef}
        className={cn(
          "bg-neutral-950/90 backdrop-blur-xl",
          "border-node border-neutral-800/50 rounded-md",
          "shadow-2xl overflow-hidden",
          variant !== 'node' && cn(
            "absolute w-full",
            renderPosition === 'bottom' ? "mt-1 top-full" : "mb-1 bottom-full",
            "z-[99999]"
          )
        )}
        style={variant === 'node' ? dropdownStyle : undefined}
        role="listbox"
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
                  "px-2 py-1.5 cursor-pointer",
                  "text-[11px] font-medium relative",
                  "transition-all duration-150",
                  "flex items-center justify-start gap-2",
                  "border-l-2 border-transparent",
                  "text-neutral-400",
                  isFocused && "bg-neutral-800/60 border-neutral-600 text-neutral-200",
                  isSelected && "bg-foreground/10 text-foreground border-l border-foreground/50",
                  !isSelected && !isFocused && "hover:bg-neutral-800/40 hover:text-neutral-200 hover:border-neutral-700"
                )}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0 pointer-events-none">
                  {option.icon && (
                    <span className={cn(
                      "flex-shrink-0 transition-colors duration-150",
                      isSelected ? "text-foreground" : "text-neutral-400"
                    )}>
                      {option.icon}
                    </span>
                  )}
                  <span className="truncate">{option.label}</span>
                </div>
                {isSelected && (
                  <Check size={14} className="text-foreground flex-shrink-0" />
                )}
              </li>
            );
          })}
        </ul>
        {footer && (
          <div className="border-t border-neutral-800/30">
            {footer}
          </div>
        )}
      </div>
    );

    return (
      <div ref={containerRef} className={cn("relative w-full")}>
        <button
          ref={buttonRef}
          type="button"
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            baseStyles,
            focusStyles,
            "transition-all duration-200 appearance-none cursor-pointer",
            "flex items-center justify-start gap-2",
            "hover:border-neutral-600/50",
            "disabled:cursor-not-allowed disabled:opacity-50",
            variant === 'node' ? "node-interactive" : "",
            className
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-label={displayValue}
          {...props}
        >
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {selectedOption?.icon && (
              <span className="text-neutral-400 flex-shrink-0">
                {selectedOption.icon}
              </span>
            )}
            <span className={cn(
              "truncate text-left",
              !selectedOption && "text-neutral-500"
            )}>
              {loading ? (
                <span className="inline-block w-20 h-4 rounded bg-neutral-700/50" />
              ) : (
                displayValue
              )}
            </span>
          </div>
          <ChevronDown
            size={14}
            className={cn(
              "text-neutral-400 pointer-events-none flex-shrink-0 transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </button>

        {isOpen && (
          variant === 'node'
            ? createPortal(dropdownContent, document.body)
            : dropdownContent
        )}
      </div>
    );
  }
)
Select.displayName = "Select"

export { Select }
