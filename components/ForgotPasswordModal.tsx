import React, { useState, useEffect } from 'react';
import { X, Loader2, Mail } from 'lucide-react';
import { PillButton } from './ui/pill-button';
import { authService } from '../services/authService';
import { useTranslation } from '../hooks/useTranslation';
import { toast } from 'sonner';

export interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToLogin?: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  onBackToLogin,
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await authService.forgotPassword(email);
      setIsSuccess(true);
      toast.success(t('auth.resetEmailSent'), { duration: 3000 });
    } catch (error: any) {
      console.error('Forgot password error:', error);
      const errorMessage = error.message || String(error);
      if (
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('ERR_CONNECTION_REFUSED') ||
        errorMessage.includes('NetworkError') ||
        error.name === 'TypeError'
      ) {
        setError('Backend não está rodando! Por favor, inicie o servidor com: npm run dev:server ou npm run dev:all');
      } else {
        setError(error.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setError(null);
    setIsSuccess(false);
    onClose();
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-black/95 backdrop-blur-xl border border-zinc-800/50 rounded-md p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold font-mono text-zinc-200 uppercase">
            {t('auth.forgotPassword')}
          </h2>
          <button
            onClick={handleClose}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {isSuccess ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-md bg-[#52ddeb]/20">
              <Mail className="w-8 h-8 text-[#52ddeb]" />
            </div>
            <p className="text-sm text-zinc-300 font-mono text-center">
              {t('auth.resetEmailSentMessage')}
            </p>
            <p className="text-xs text-zinc-500 font-mono text-center">
              {t('auth.checkEmailInstructions')}
            </p>
            {onBackToLogin && (
              <PillButton
                onClick={() => {
                  handleClose();
                  onBackToLogin();
                }}
                size="sm"
                variant="outline"
                className="w-full mt-4"
              >
                {t('auth.backToLogin')}
              </PillButton>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-zinc-400 font-mono mb-4">
              {t('auth.forgotPasswordInstructions')}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono text-zinc-400 mb-1">
                  {t('auth.email')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-black/40 p-2 rounded-md border border-zinc-700/50 focus:outline-none focus:border-[#52ddeb]/50 focus:ring-0 text-sm text-zinc-300 font-mono"
                  placeholder={t('auth.emailPlaceholder')}
                />
              </div>

              {error && (
                <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-md">
                  <p className="text-xs text-red-400 font-mono">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading || !email}
                className="w-full flex items-center justify-center gap-2 bg-[#52ddeb]/80 hover:bg-[#52ddeb]/90 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-black font-semibold py-2.5 px-4 rounded-md transition-all duration-200 text-sm font-mono"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {t('auth.sending')}
                  </>
                ) : (
                  t('auth.sendResetLink')
                )}
              </button>
            </form>

            {onBackToLogin && (
              <div className="mt-4 pt-4 border-t border-zinc-800/50">
                <PillButton
                  onClick={() => {
                    handleClose();
                    onBackToLogin();
                  }}
                  size="sm"
                  variant="outline"
                  className="w-full"
                >
                  {t('auth.backToLogin')}
                </PillButton>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
