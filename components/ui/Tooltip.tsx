import React, { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  dismissible?: boolean;
}

export const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  children, 
  position = 'top',
  delay = 300,
  dismissible = false
}) => {
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  const showTooltip = () => {
    if (isDismissed && dismissible) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      if (triggerRef.current && tooltipRef.current && !isDismissed) {
        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        let top = 0;
        let left = 0;

        switch (position) {
          case 'top':
            top = triggerRect.top - tooltipRect.height - 8;
            left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
            break;
          case 'bottom':
            top = triggerRect.bottom + 8;
            left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
            break;
          case 'left':
            top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
            left = triggerRect.left - tooltipRect.width - 8;
            break;
          case 'right':
            top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
            left = triggerRect.right + 8;
            break;
        }

        // Keep tooltip within viewport
        const padding = 8;
        if (top < padding) top = padding;
        if (left < padding) left = padding;
        if (top + tooltipRect.height > window.innerHeight - padding) {
          top = window.innerHeight - tooltipRect.height - padding;
        }
        if (left + tooltipRect.width > window.innerWidth - padding) {
          left = window.innerWidth - tooltipRect.width - padding;
        }

        setTooltipPosition({ top, left });
        setIsVisible(true);
      }
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible && dismissible) {
        handleDismiss();
      }
    };

    if (isVisible && dismissible) {
      window.addEventListener('keydown', handleEscape);
      return () => {
        window.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isVisible, dismissible]);

  // Auto-show tooltip when dismissible and content is provided
  useEffect(() => {
    if (dismissible && content && !isDismissed && triggerRef.current) {
      const timer = setTimeout(() => {
        if (isDismissed) return;
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = window.setTimeout(() => {
          if (triggerRef.current && tooltipRef.current && !isDismissed) {
            const triggerRect = triggerRef.current.getBoundingClientRect();
            const tooltipRect = tooltipRef.current.getBoundingClientRect();
            let top = 0;
            let left = 0;

            switch (position) {
              case 'top':
                top = triggerRect.top - tooltipRect.height - 8;
                left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
                break;
              case 'bottom':
                top = triggerRect.bottom + 8;
                left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
                break;
              case 'left':
                top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
                left = triggerRect.left - tooltipRect.width - 8;
                break;
              case 'right':
                top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
                left = triggerRect.right + 8;
                break;
            }

            const padding = 8;
            if (top < padding) top = padding;
            if (left < padding) left = padding;
            if (top + tooltipRect.height > window.innerHeight - padding) {
              top = window.innerHeight - tooltipRect.height - padding;
            }
            if (left + tooltipRect.width > window.innerWidth - padding) {
              left = window.innerWidth - tooltipRect.width - padding;
            }

            setTooltipPosition({ top, left });
            setIsVisible(true);
          }
        }, 0);
      }, delay);
      return () => {
        clearTimeout(timer);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [dismissible, content, isDismissed, delay, position]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
        className="inline-block"
      >
        {children}
      </div>
      {isVisible && !isDismissed && (
        <div
          ref={tooltipRef}
          className={`fixed z-50 px-2.5 py-1.5 text-xs font-mono backdrop-blur-sm rounded-md shadow-lg pointer-events-auto animate-fade-in ${
            theme === 'dark'
              ? 'text-zinc-300 bg-zinc-900/70 border border-zinc-800/40'
              : 'text-zinc-700 bg-white/70 border border-zinc-200/40'
          }`}
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
          role="tooltip"
        >
          <div className="flex items-center gap-2">
            <span className="flex-1">{content}</span>
            {dismissible && (
              <button
                onClick={handleDismiss}
                className={`flex-shrink-0 p-0.5 rounded hover:bg-opacity-20 transition-colors ${
                  theme === 'dark'
                    ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
                    : 'text-zinc-500 hover:text-zinc-700 hover:bg-zinc-200'
                }`}
                aria-label="Close tooltip"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <div
            className={`absolute w-0 h-0 border-4 ${
              position === 'top'
                ? theme === 'dark'
                  ? 'top-full left-1/2 -translate-x-1/2 border-t-zinc-900/70 border-r-transparent border-b-transparent border-l-transparent'
                  : 'top-full left-1/2 -translate-x-1/2 border-t-white/70 border-r-transparent border-b-transparent border-l-transparent'
                : position === 'bottom'
                ? theme === 'dark'
                  ? 'bottom-full left-1/2 -translate-x-1/2 border-b-zinc-900/70 border-r-transparent border-t-transparent border-l-transparent'
                  : 'bottom-full left-1/2 -translate-x-1/2 border-b-white/70 border-r-transparent border-t-transparent border-l-transparent'
                : position === 'left'
                ? theme === 'dark'
                  ? 'left-full top-1/2 -translate-y-1/2 border-l-zinc-900/70 border-r-transparent border-t-transparent border-b-transparent'
                  : 'left-full top-1/2 -translate-y-1/2 border-l-white/70 border-r-transparent border-t-transparent border-b-transparent'
                : theme === 'dark'
                ? 'right-full top-1/2 -translate-y-1/2 border-r-zinc-900/70 border-l-transparent border-t-transparent border-b-transparent'
                : 'right-full top-1/2 -translate-y-1/2 border-r-white/70 border-l-transparent border-t-transparent border-b-transparent'
            }`}
          />
        </div>
      )}
    </>
  );
};

