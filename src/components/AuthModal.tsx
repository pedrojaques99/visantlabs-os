import React, { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { GlitchLoader } from './ui/GlitchLoader';
import { PillButton } from './ui/pill-button';
import { authService } from '../services/authService';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Link } from 'react-router-dom';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isSignUp?: boolean;
  setIsSignUp?: (value: boolean) => void;
  defaultIsSignUp?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  isSignUp: externalIsSignUp,
  setIsSignUp: externalSetIsSignUp,
  defaultIsSignUp = false
}) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  const hcaptchaSiteKey = typeof window !== 'undefined'
    ? (import.meta as any).env?.VITE_HCAPTCHA_SITE_KEY
    : undefined;
  const captchaEnabled = false; // Temporarily disabled

  // Use external state if provided, otherwise use internal state
  const [internalIsSignUp, setInternalIsSignUp] = useState(defaultIsSignUp);
  const isSignUp = externalIsSignUp !== undefined ? externalIsSignUp : internalIsSignUp;
  const setIsSignUp = externalSetIsSignUp || setInternalIsSignUp;

  const handleGoogleAuth = async () => {
    setIsGoogleLoading(true);
    try {
      const referralCode = typeof window !== 'undefined'
        ? localStorage.getItem('referral_code')
        : null;

      const authUrl = await authService.getAuthUrl(referralCode || undefined);
      window.location.href = authUrl;
    } catch (error: any) {
      console.error('Google auth error:', error);
      setIsGoogleLoading(false);
      const errorMessage = error.message || String(error);
      if (
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('ERR_CONNECTION_REFUSED') ||
        errorMessage.includes('NetworkError') ||
        error.name === 'TypeError'
      ) {
        setAuthError(t('auth.backendNotRunning'));
      } else {
        setAuthError(error.message || t('auth.failedToConnectGoogle'));
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    setIsAuthLoading(true);

    try {
      if (isSignUp) {
        // Get referral code from localStorage if available
        const referralCode = typeof window !== 'undefined'
          ? localStorage.getItem('referral_code')
          : null;

        await authService.signUp(email, password, name || undefined, referralCode || undefined, captchaToken || undefined);

        // Reset CAPTCHA after successful signup
        if (captchaRef.current) {
          captchaRef.current.resetCaptcha();
        }
        setCaptchaToken(null);

        // Clear referral code after successful signup
        if (referralCode && typeof window !== 'undefined') {
          localStorage.removeItem('referral_code');
        }
      } else {
        await authService.signIn(email, password);
      }

      toast.success(isSignUp ? t('auth.accountCreatedSuccess') : t('auth.signedInSuccess'), { duration: 2000 });
      onSuccess();
    } catch (error: any) {
      console.error('Email auth error:', error);
      const errorMessage = error.message || String(error);
      if (
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('ERR_CONNECTION_REFUSED') ||
        errorMessage.includes('NetworkError') ||
        error.name === 'TypeError'
      ) {
        setAuthError(t('auth.backendNotRunning'));
      } else {
        // Handle rate limit errors
        if (error.message?.includes('Rate limit') || error.message?.includes('Too many')) {
          setAuthError(t('auth.tooManyAttempts'));
        } else {
          setAuthError(error.message || t('auth.authenticationFailed'));
        }
      }

      // Reset CAPTCHA on error
      if (isSignUp && captchaRef.current) {
        captchaRef.current.resetCaptcha();
        setCaptchaToken(null);
      }
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setName('');
    setAuthError(null);
    setCaptchaToken(null);
    if (captchaRef.current) {
      captchaRef.current.resetCaptcha();
    }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-neutral-950/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-neutral-900 border border-neutral-800/50 rounded-md p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold font-mono text-neutral-200 uppercase">
            {isSignUp ? t('auth.signUp') : t('auth.signIn')}
          </h2>
          <button
            onClick={handleClose}
            className="text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Google OAuth button - temporarily hidden during verification */}
        {false && (
          <>
            <button
              type="button"
              onClick={handleGoogleAuth}
              disabled={isGoogleLoading}
              className="w-full flex items-center justify-center gap-2 bg-neutral-800/50 hover:bg-neutral-800/70 disabled:opacity-50 disabled:cursor-not-allowed text-neutral-300 font-semibold py-2.5 px-4 rounded-md border border-neutral-700/50 hover:border-neutral-600/50 transition-all duration-200 text-sm font-mono mb-4"
            >
              {isGoogleLoading ? (
                <>
                  <GlitchLoader size={16} />
                  {t('auth.signingInWithGoogle')}
                </>
              ) : (
                t('auth.signInWithGoogle')
              )}
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-neutral-800/50"></div>
              <span className="text-xs text-neutral-500 font-mono">{t('auth.or')}</span>
              <div className="flex-1 h-px bg-neutral-800/50"></div>
            </div>
          </>
        )}

        <form onSubmit={handleEmailAuth} className="space-y-4">
          {isSignUp && (
            <div>
              <label className="block text-xs font-mono text-neutral-400 mb-1">
                {t('auth.name')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-neutral-950/70 p-2 rounded-md border border-neutral-700/50 focus:outline-none focus:border-[brand-cyan]/50 focus:ring-0 text-sm text-neutral-300 font-mono"
                placeholder={t('auth.namePlaceholder')}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-mono text-neutral-400 mb-1">
              {t('auth.email')}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-neutral-950/70 p-2 rounded-md border border-neutral-700/50 focus:outline-none focus:border-[brand-cyan]/50 focus:ring-0 text-sm text-neutral-300 font-mono"
              placeholder={t('auth.emailPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-neutral-400 mb-1">
              {t('auth.password')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full bg-neutral-950/70 p-2 rounded-md border border-neutral-700/50 focus:outline-none focus:border-[brand-cyan]/50 focus:ring-0 text-sm text-neutral-300 font-mono"
              placeholder={t('auth.passwordPlaceholder')}
            />
            {isSignUp && (
              <p className="text-xs text-neutral-500 mt-1 font-mono">
                {t('auth.minimumCharacters')}
              </p>
            )}
            {!isSignUp && (
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                className="text-xs text-brand-cyan hover:text-brand-cyan/80 font-mono mt-1 text-right w-full"
              >
                {t('auth.forgotPassword')}
              </button>
            )}
          </div>

          {/* CAPTCHA for signup */}
          {isSignUp && captchaEnabled && (
            <div className="flex justify-center">
              <HCaptcha
                ref={captchaRef}
                sitekey={hcaptchaSiteKey!}
                onVerify={(token) => setCaptchaToken(token)}
                onExpire={() => setCaptchaToken(null)}
                onError={(error) => {
                  console.error('CAPTCHA error:', error);
                  setCaptchaToken(null);
                }}
              />
            </div>
          )}

          {authError && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-md">
              <p className="text-xs text-red-400 font-mono">{authError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={isAuthLoading || !email || !password}
            className="w-full flex items-center justify-center gap-2 bg-brand-cyan/80 hover:bg-brand-cyan/90 disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed text-black font-semibold py-2.5 px-4 rounded-md transition-all duration-200 text-sm font-mono"
          >
            {isAuthLoading ? (
              <>
                <GlitchLoader size={16} />
                {isSignUp ? t('auth.creatingAccount') : t('auth.signingIn')}
              </>
            ) : (
              isSignUp ? t('auth.signUp') : t('auth.signIn')
            )}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-neutral-800/50">
          <PillButton
            onClick={() => {
              setIsSignUp(!isSignUp);
              setAuthError(null);
            }}
            size="sm"
            variant="outline"
            className="w-full"
          >
            {isSignUp
              ? t('auth.alreadyHaveAccount')
              : t('auth.dontHaveAccount')}
          </PillButton>
        </div>

        {isSignUp && (
          <div className="mt-4 pt-4 border-t border-neutral-800/50">
            <p className="text-xs text-neutral-500 font-mono text-center">
              {t('auth.bySigningUp')}{' '}
              <Link
                to="/terms"
                className="text-brand-cyan hover:text-brand-cyan/80 underline"
                onClick={(e) => {
                  e.preventDefault();
                  window.history.pushState({}, '', '/terms');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
              >
                {t('auth.termsOfService')}
              </Link>
              {' '}{t('auth.and')}{' '}
              <Link
                to="/privacy"
                className="text-brand-cyan hover:text-brand-cyan/80 underline"
                onClick={(e) => {
                  e.preventDefault();
                  window.history.pushState({}, '', '/privacy');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }}
              >
                {t('auth.privacyPolicy')}
              </Link>
            </p>
          </div>
        )}
      </div>

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        onBackToLogin={() => {
          setShowForgotPassword(false);
          setIsSignUp(false);
        }}
      />
    </div>
  );
};

