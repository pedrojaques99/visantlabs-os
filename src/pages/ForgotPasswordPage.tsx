import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2, XCircle } from '@/lib/ui/icons';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { authService } from '../services/authService';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CARD = 'bg-card border border-border rounded-md p-8 w-full max-w-md';

export const ForgotPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!token) setError(t('auth.invalidResetLink'));
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(t('auth.invalidResetLink'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.passwordMinLength'));
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch'));
      return;
    }

    setIsLoading(true);

    try {
      await authService.resetPassword(token, password);
      setIsSuccess(true);
      toast.success(t('auth.passwordResetSuccess'), { duration: 3000 });
      setTimeout(() => navigate('/'), 2000);
    } catch (error: any) {
      console.error('Reset password error:', error);
      const errorMessage = error.message || String(error);
      if (
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('ERR_CONNECTION_REFUSED') ||
        errorMessage.includes('NetworkError') ||
        error.name === 'TypeError'
      ) {
        // Antes mostrava "inicie o servidor com npm run dev:server" pro usuário final.
        setError(t('auth.networkError'));
      } else if (errorMessage.includes('expired') || errorMessage.includes('Invalid')) {
        setError(t('auth.invalidOrExpiredToken'));
      } else {
        setError(error.message || t('auth.resetFailed'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className={CARD}>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-md bg-success/20 mb-4">
              <CheckCircle2 className="w-8 h-8 text-success" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">
              {t('auth.passwordResetSuccess')}
            </h1>
            <p className="text-sm text-muted-foreground">{t('auth.redirectingToLogin')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className={CARD}>
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-md bg-destructive/20 mb-4">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground">{t('auth.invalidResetLink')}</h1>
            <p className="text-sm text-muted-foreground mb-4">
              {t('auth.invalidResetLinkMessage')}
            </p>
            <Button variant="brand" onClick={() => navigate('/')}>
              {t('auth.backToHome')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className={CARD}>
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-md bg-muted">
          <Lock className="w-8 h-8 text-neutral-300" />
        </div>

        <h1 className="text-2xl font-semibold text-foreground text-center mb-6">
          {t('auth.resetPassword')}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="reset-password" className="block text-sm text-muted-foreground mb-1">
              {t('auth.newPassword')}
            </label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-1">{t('auth.minimumCharacters')}</p>
          </div>

          <div>
            <label
              htmlFor="reset-password-confirm"
              className="block text-sm text-muted-foreground mb-1"
            >
              {t('auth.confirmPassword')}
            </label>
            <Input
              id="reset-password-confirm"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
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
            disabled={isLoading || !password || !confirmPassword}
            className="w-full"
          >
            {isLoading ? (
              <>
                <GlitchLoader size={16} />
                {t('auth.resetting')}
              </>
            ) : (
              t('auth.resetPassword')
            )}
          </Button>
        </form>
      </div>
    </div>
  );
};
