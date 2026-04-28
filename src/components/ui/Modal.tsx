import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScrollLock } from '@/hooks/useScrollLock';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full' | 'auto';
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  footer?: React.ReactNode;
  footerClassName?: string;
  id?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  headerAction?: React.ReactNode;
  mobileDrawer?: boolean; // If true, transforms into a bottom drawer on mobile
}

const sizeClasses = {
  sm: 'sm:max-w-md',
  md: 'sm:max-w-lg',
  lg: 'sm:max-w-2xl',
  xl: 'sm:max-w-5xl',
  full: 'sm:max-w-[90vw]',
  auto: 'w-auto',
};

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  className,
  contentClassName,
  headerClassName,
  footer,
  footerClassName,
  id = 'modal',
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  headerAction,
  mobileDrawer = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useScrollLock(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, closeOnEscape]);

  useEffect(() => {
    if (isOpen) {
      const modalElement = modalRef.current;
      if (modalElement) {
        modalElement.focus();
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  const modalContent = (
    <div
      id={id}
      ref={modalRef}
      tabIndex={-1}
      className={cn(
        'fixed inset-0 bg-neutral-950/80 backdrop-blur-md z-[9999] flex flex-col sm:items-center sm:justify-center overflow-hidden transition-all duration-300',
        mobileDrawer ? 'justify-end sm:p-4' : 'justify-center p-4',
        'animate-in fade-in duration-300',
        className
      )}
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledBy || (title ? `${id}-title` : undefined)}
      aria-describedby={ariaDescribedBy || (description ? `${id}-description` : undefined)}
    >
      <div
        className={cn(
          'relative w-full overflow-hidden flex flex-col transition-all duration-500',
          'bg-neutral-950/98 backdrop-blur-3xl border-t sm:border border-white/10 sm:border-white/5 shadow-[0_30px_100px_rgba(0,0,0,0.8)]',
          'animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-2 duration-500',
          
          // Mobile Drawer vs Centered Desktop
          mobileDrawer 
            ? 'rounded-t-[2.5rem] sm:rounded-2xl max-h-[95vh] sm:max-h-[92vh]' 
            : 'rounded-2xl max-h-[92vh]',
            
          // Sizing
          sizeClasses[size],
          id === 'setup-modal' && 'sm:w-fit sm:min-w-[320px] sm:max-w-[95vw]',
          contentClassName
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Handle */}
        {mobileDrawer && (
          <div className="w-full flex justify-center pt-3 pb-1 sm:hidden">
            <div className="w-12 h-1.5 bg-white/10 rounded-full" />
          </div>
        )}

        {/* Header */}
        {(title || showCloseButton) && (
          <div className={cn(
            'flex items-center justify-between p-6 sm:p-8 border-b border-neutral-800/50 flex-shrink-0',
            headerClassName
          )}>
            <div className="flex-1 min-w-0">
              {title && (
                <h2 id={`${id}-title`} className="text-[11px] font-bold font-mono text-brand-cyan uppercase tracking-[0.2em]">
                  {title}
                </h2>
              )}
              {description && (
                <p id={`${id}-description`} className="text-xs text-neutral-500 font-mono mt-2 opacity-70">
                  {description}
                </p>
              )}
            </div>
            {headerAction && (
              <div className="flex-shrink-0 ml-4">
                {headerAction}
              </div>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-2 sm:p-3 -mr-2 sm:-mr-3 text-neutral-500 hover:text-white transition-all bg-white/5 hover:bg-white/10 rounded-full"
                title="Close (Esc)"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className={cn(
          "flex-1 overflow-y-auto custom-scrollbar",
          id === 'setup-modal' ? "p-6 sm:p-10" : "p-6 sm:p-10 md:p-12"
        )}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className={cn('flex items-center justify-end gap-3 p-6 sm:p-8 border-t border-neutral-800/50 flex-shrink-0 bg-neutral-900/10', footerClassName)}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
