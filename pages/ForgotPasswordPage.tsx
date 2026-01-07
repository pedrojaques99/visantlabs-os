import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, CheckCircle2, XCircle } from 'lucide-react';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { authService } from '../services/authService';
import { useTranslation } from '../hooks/useTranslation';
import { toast } from 'sonner';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';

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
    if (!token) {
      setError(t('auth.invalidResetLink') || 'Invalid reset link. Please request a new password reset.');
    }
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError(t('auth.invalidResetLink') || 'Invalid reset link.');
      return;
    }

    if (password.length < 6) {
      setError(t('auth.passwordMinLength') || 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError(t('auth.passwordsDoNotMatch') || 'Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      await authService.resetPassword(token, password);
      setIsSuccess(true);
      toast.success(t('auth.passwordResetSuccess') || 'Password reset successfully!', { duration: 3000 });

      // Redirect to home after 2 seconds
      setTimeout(() => {
        navigate('/');
      }, 2000);
    } catch (error: any) {
      console.error('Reset password error:', error);
      const errorMessage = error.message || String(error);
      if (
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('ERR_CONNECTION_REFUSED') ||
        errorMessage.includes('NetworkError') ||
        error.name === 'TypeError'
      ) {
        setError('Backend não está rodando! Por favor, inicie o servidor com: npm run dev:server ou npm run dev:all');
      } else if (errorMessage.includes('expired') || errorMessage.includes('Invalid')) {
        setError(t('auth.invalidOrExpiredToken') || 'Invalid or expired token. Please request a new password reset.');
      } else {
        setError(error.message || 'Failed to reset password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <GridDotsBackground />
        <div className="bg-zinc-900 border border-zinc-800/50 rounded-md p-8 w-full max-w-md relative z-10">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-md bg-green-500/20 mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h1 className="text-2xl font-semibold font-mono text-zinc-200">
              {t('auth.passwordResetSuccess') || 'Password Reset Successful!'}
            </h1>
            <p className="text-sm text-zinc-400 font-mono">
              {t('auth.redirectingToLogin') || 'Redirecting to login...'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
        <GridDotsBackground />
        <div className="bg-zinc-900 border border-zinc-800/50 rounded-md p-8 w-full max-w-md relative z-10">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-md bg-red-500/20 mb-4">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-2xl font-semibold font-mono text-zinc-200">
              {t('auth.invalidResetLink') || 'Invalid Reset Link'}
            </h1>
            <p className="text-sm text-zinc-400 font-mono mb-4">
              {t('auth.invalidResetLinkMessage') || 'This password reset link is invalid or has expired. Please request a new password reset.'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-4 py-2 bg-brand-cyan/80 hover:bg-brand-cyan/90 text-black font-semibold rounded-md transition-all duration-200 text-sm font-mono"
            >
              {t('auth.backToHome') || 'Back to Home'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
      <GridDotsBackground />
      <div className="bg-zinc-900 border border-zinc-800/50 rounded-md p-8 w-full max-w-md relative z-10">
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-md bg-brand-cyan/20">
          <Lock className="w-8 h-8 text-brand-cyan" />
        </div>

        <h1 className="text-2xl font-semibold font-mono text-zinc-200 text-center mb-2">
          {t('auth.resetPassword') || 'Reset Password'}
        </h1>
        <p className="text-sm text-zinc-400 font-mono text-center mb-6">
          {t('auth.enterNewPassword') || 'Enter your new password below'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1">
              {t('auth.newPassword') || 'New Password'}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-black/40 p-2 rounded-md border border-zinc-700/50 focus:outline-none focus:border-[#brand-cyan]/50 focus:ring-0 text-sm text-zinc-300 font-mono"
              placeholder={t('auth.passwordPlaceholder') || 'Enter new password'}
            />
            <p className="text-xs text-zinc-500 mt-1 font-mono">
              {t('auth.minimumCharacters') || 'Minimum 6 characters'}
            </p>
          </div>

          <div>
            <label className="block text-xs font-mono text-zinc-400 mb-1">
              {t('auth.confirmPassword') || 'Confirm Password'}
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-black/40 p-2 rounded-md border border-zinc-700/50 focus:outline-none focus:border-[#brand-cyan]/50 focus:ring-0 text-sm text-zinc-300 font-mono"
              placeholder={t('auth.confirmPasswordPlaceholder') || 'Confirm new password'}
            />
          </div>

          {error && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-md">
              <p className="text-xs text-red-400 font-mono">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !password || !confirmPassword}
            className="w-full flex items-center justify-center gap-2 bg-brand-cyan/80 hover:bg-brand-cyan/90 disabled:bg-zinc-700 disabled:text-zinc-500 disabled:cursor-not-allowed text-black font-semibold py-2.5 px-4 rounded-md transition-all duration-200 text-sm font-mono"
          >
            {isLoading ? (
              <>
                <GlitchLoader size={16} />
                {t('auth.resetting') || 'Resetting...'}
              </>
            ) : (
              t('auth.resetPassword') || 'Reset Password'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
