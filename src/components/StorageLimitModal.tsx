import React, { useEffect } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { X, AlertTriangle, CreditCard } from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface StorageLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  usedMB: string;
  limitMB: string;
}

export const StorageLimitModal: React.FC<StorageLimitModalProps> = ({
  isOpen,
  onClose,
  usedMB,
  limitMB,
}) => {
  useScrollLock(isOpen);
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleUpgrade = () => {
    onClose();
    navigate('/pricing');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-background/80 backdrop-blur-md overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-popover border border-destructive/30 rounded-xl p-6 w-full max-w-lg mx-4 shadow-[var(--e-modal)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 text-destructive">
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-medium text-foreground mb-2">
              {t('storageLimitModal.title')}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">
              {t('storageLimitModal.usage', { used: usedMB, limit: limitMB })}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {t('storageLimitModal.body')}
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={onClose}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t('common.close')}
          >
            <X size={20} />
          </Button>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <Button
            variant="ghost"
            onClick={onClose}
            className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border hover:border-border-hover rounded-md"
          >
            {t('common.close')}
          </Button>
          <Button
            variant="primary"
            onClick={handleUpgrade}
            className="flex items-center gap-2 px-4 py-2 text-xs rounded-md"
          >
            <CreditCard size={14} />
            <span>{t('storageLimitModal.upgrade')}</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
