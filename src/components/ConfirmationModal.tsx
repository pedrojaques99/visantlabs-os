import React, { useEffect, useState } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { X, AlertTriangle, Heart } from '@/lib/ui/icons';
import { GlitchLoader } from './ui/GlitchLoader';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { glassSurface } from '@/lib/ui/glass';
import { cn } from '@/lib/utils';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** May return a promise: the modal stays open (in a loading state) until it settles. */
  onConfirm: () => void | Promise<void>;
  onSaveAll?: () => Promise<void>;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'warning' | 'danger' | 'info';
  showSaveAll?: boolean;
}

const variantStyles = {
  warning: {
    icon: 'text-warning',
    button: 'warning' as const,
  },
  danger: {
    icon: 'text-destructive',
    button: 'destructive' as const,
  },
  info: {
    icon: 'text-foreground',
    button: 'brand' as const,
  },
};

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onSaveAll,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'warning',
  showSaveAll = false,
}) => {
  useScrollLock(isOpen);
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const busy = isSaving || isConfirming;

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, busy]);

  if (!isOpen) return null;

  const styles = variantStyles[variant];

  const handleConfirm = async () => {
    setIsConfirming(true);
    try {
      await onConfirm();
      onClose();
    } catch (error) {
      // Stay open so the user can retry; the caller owns the error message.
      console.error('Confirmation action failed:', error);
    } finally {
      setIsConfirming(false);
    }
  };

  const handleSaveAll = async () => {
    if (!onSaveAll) return;
    setIsSaving(true);
    try {
      await onSaveAll();
      onClose();
    } catch (error) {
      console.error('Failed to save all:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-background/60 backdrop-blur-sm overflow-y-auto"
      onClick={busy ? undefined : onClose}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        className={cn(glassSurface.panelStrong, 'rounded-md p-6 w-full max-w-lg mx-4')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div className={`flex-shrink-0 ${styles.icon}`}>
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1">
            <h2
              id="confirmation-modal-title"
              className="text-lg font-semibold text-foreground mb-2"
            >
              {title || t('confirmationModal.defaultTitle')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
          </div>
          <Button
            variant="action"
            onClick={onClose}
            disabled={busy}
            className="flex-shrink-0"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 mt-6">
          <div className="flex items-center gap-3">
            <Button variant="surface" size="sm" onClick={onClose} disabled={busy}>
              {cancelText || t('common.cancel')}
            </Button>
            <Button variant={styles.button} size="sm" onClick={handleConfirm} disabled={busy}>
              {isConfirming && <GlitchLoader size={14} />}
              {confirmText || t('confirmationModal.defaultConfirm')}
            </Button>
          </div>
          {showSaveAll && onSaveAll && (
            <Button variant="surface" size="sm" onClick={handleSaveAll} disabled={busy}>
              {isSaving ? <GlitchLoader size={14} /> : <Heart size={14} />}
              <span>{isSaving ? t('common.saving') : t('messages.saveAll')}</span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
