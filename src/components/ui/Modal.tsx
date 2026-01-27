import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
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
}

const sizeClasses = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl',
  full: 'max-w-[90vw]',
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
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEscape);

    const modalElement = modalRef.current;
    if (modalElement) {
      modalElement.focus();
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose, closeOnEscape]);

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
        'fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4',
        'animate-fade-in overflow-y-auto',
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
          'relative w-full max-h-[90vh] bg-neutral-950/95 backdrop-blur-xl border border-neutral-800/50 rounded-md shadow-2xl overflow-hidden flex flex-col',
          sizeClasses[size],
          contentClassName
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className={cn('flex items-center justify-between p-4 border-b border-neutral-800/50 flex-shrink-0', headerClassName)}>
            <div className="flex-1 min-w-0">
              {title && (
                <h2 id={`${id}-title`} className="text-sm font-mono text-neutral-300 uppercase">
                  {title}
                </h2>
              )}
              {description && (
                <p id={`${id}-description`} className="text-xs text-neutral-500 font-mono mt-1">
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
                className="p-2 text-neutral-500 hover:text-white transition-colors flex-shrink-0 ml-4"
                title="Close (Esc)"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">{children}</div>

        {/* Footer */}
        {footer && (
          <div className={cn('flex items-center justify-end gap-3 p-4 border-t border-neutral-800/50 flex-shrink-0', footerClassName)}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};
