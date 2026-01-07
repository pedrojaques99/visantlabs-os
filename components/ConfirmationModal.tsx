import React, { useEffect, useState } from 'react';
import { X, AlertTriangle, Heart } from 'lucide-react';
import { GlitchLoader } from './ui/GlitchLoader';
import { useTranslation } from '../hooks/useTranslation';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onSaveAll?: () => Promise<void>;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'warning' | 'danger' | 'info';
  showSaveAll?: boolean;
}

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
  showSaveAll = false
}) => {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
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

  const variantStyles = {
    warning: {
      icon: 'text-yellow-400',
      button: 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border-yellow-500/30 hover:border-yellow-500/50'
    },
    danger: {
      icon: 'text-red-400',
      button: 'bg-red-500/20 hover:bg-red-500/30 text-red-400 border-red-500/30 hover:border-red-500/50'
    },
    info: {
      icon: 'text-brand-cyan',
      button: 'bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border-[#brand-cyan]/30 hover:border-[#brand-cyan]/50'
    }
  };

  const styles = variantStyles[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-black/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-black/95 backdrop-blur-xl border border-zinc-800/50 rounded-md p-6 w-full max-w-lg mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div className={`flex-shrink-0 ${styles.icon}`}>
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold font-mono text-zinc-200 uppercase mb-2">
              {title || t('confirmationModal.defaultTitle')}
            </h2>
            <p className="text-sm text-zinc-400 font-mono leading-relaxed">
              {message}
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 mt-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono text-zinc-400 hover:text-zinc-200 transition-colors border border-zinc-700/50 hover:border-zinc-600 rounded-md"
            >
              {cancelText || t('confirmationModal.defaultCancel')}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`px-4 py-2 text-xs font-mono transition-all border rounded-md ${styles.button}`}
            >
              {confirmText || t('confirmationModal.defaultConfirm')}
            </button>
          </div>
          {showSaveAll && onSaveAll && (
            <button
              onClick={async () => {
                setIsSaving(true);
                try {
                  await onSaveAll();
                  onClose();
                } catch (error) {
                  console.error('Failed to save all:', error);
                } finally {
                  setIsSaving(false);
                }
              }}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 text-xs font-mono bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-[#brand-cyan]/30 hover:border-[#brand-cyan]/50 rounded-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <GlitchLoader size={14} />
                  <span>{t('common.save')}...</span>
                </>
              ) : (
                <>
                  <Heart size={14} />
                  <span>{t('messages.saveAll')}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

