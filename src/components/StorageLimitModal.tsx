import React, { useEffect } from 'react';
import { X, AlertTriangle, CreditCard } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useNavigate } from 'react-router-dom';

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
      className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-neutral-950/50 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-neutral-950/95 backdrop-blur-xl border border-red-500/30 rounded-md p-6 w-full max-w-lg mx-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="flex-shrink-0 text-red-400">
            <AlertTriangle size={24} />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold font-mono text-neutral-200 uppercase mb-2">
              Limite de Armazenamento Excedido
            </h2>
            <p className="text-sm text-neutral-400 font-mono leading-relaxed mb-3">
              Você excedeu seu limite de armazenamento ({usedMB}MB / {limitMB}MB).
            </p>
            <p className="text-sm text-neutral-400 font-mono leading-relaxed">
              Faça upgrade para Premium para ter mais espaço e continuar fazendo upload de imagens.
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-neutral-500 hover:text-neutral-300 transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono text-neutral-400 hover:text-neutral-200 transition-colors border border-neutral-700/50 hover:border-neutral-600 rounded-md"
          >
            Fechar
          </button>
          <button
            onClick={handleUpgrade}
            className="flex items-center gap-2 px-4 py-2 text-xs font-mono bg-brand-cyan/20 hover:bg-brand-cyan/30 text-brand-cyan border border-brand-cyan/30 hover:border-brand-cyan/50 rounded-md transition-all"
          >
            <CreditCard size={14} />
            <span>Fazer Upgrade</span>
          </button>
        </div>
      </div>
    </div>
  );
};
