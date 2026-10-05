import React, { useState, useEffect } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { X, Mail } from '@/lib/ui/icons';
import { GlitchLoader } from './ui/GlitchLoader';
import { PillButton } from './ui/pill-button';
import { authService } from '../services/authService';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { glassSurface } from '@/lib/ui/glass';
import { cn } from '@/lib/utils';

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
  useScrollLock(isOpen);
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
        setError(
          'Backend não está rodando! Por favor, inicie o servidor com: npm run dev:server ou npm run dev:all'
        );
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
    <div className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-background/60 backdrop-blur-sm overflow-y-auto">
      <div className={cn(glassSurface.panelStrong, 'rounded-md p-6 w-full max-w-md mx-4')}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-200">{t('auth.forgotPassword')}</h2>
          <Button
            variant="ghost"
            onClick={handleClose}
            aria-label={t('common.close')}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <X size={20} />
          </Button>
        </div>

        {isSuccess ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 rounded-md bg-neutral-800/60">
              <Mail className="w-8 h-8 text-neutral-300" />
            </div>
            <p className="text-sm text-neutral-300 text-center">
              {t('auth.resetEmailSentMessage')}
            </p>
            <p className="text-xs text-neutral-500 text-center">
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
            <p className="text-sm text-neutral-400 mb-4">{t('auth.forgotPasswordInstructions')}</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-neutral-400 mb-1">{t('auth.email')}</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full"
                />
              </div>

              {error && (
                <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-xs text-destructive">{error}</p>
                </div>
              )}

              <Button
                variant="brand"
                type="submit"
                disabled={isLoading || !email}
                className="w-full font-semibold"
              >
                {isLoading ? (
                  <>
                    <GlitchLoader size={16} />
                    {t('auth.sending')}
                  </>
                ) : (
                  t('auth.sendResetLink')
                )}
              </Button>
            </form>

            {onBackToLogin && (
              <div className="mt-4 pt-4 border-t border-neutral-800/50">
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
