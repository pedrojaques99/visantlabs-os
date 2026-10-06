import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle } from '@/lib/ui/icons';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { authService } from '../services/authService';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export const AuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      const searchParams = new URLSearchParams(location.search);
      const token = searchParams.get('token');
      const errorParam = searchParams.get('error');

      if (token) {
        try {
          // Set token and verify it
          authService.setToken(token);

          // Verify token to get user data
          const user = await authService.verifyToken();

          if (user) {
            toast.success(t('auth.signedInSuccess'), { duration: 2000 });
            const redirectBack = searchParams.get('redirect_back');
            if (redirectBack?.startsWith('/oauth/authorize')) {
              const apiBase = import.meta.env.VITE_API_URL || 'https://api.visantlabs.com';
              window.location.href = `${apiBase}${redirectBack}&token=${encodeURIComponent(token)}`;
            } else {
              // New users (e.g. Google signup) must reach onboarding — otherwise the
              // OAuth path skips the brand-first wizard and lands on a bare launcher.
              navigate(user.onboardingCompleted ? '/' : '/welcome', { replace: true });
            }
          } else {
            setError(t('auth.authenticationFailed'));
            setIsProcessing(false);
          }
        } catch (err: any) {
          console.error('Token processing error:', err);
          setError(err.message || t('auth.authenticationFailed'));
          setIsProcessing(false);
        }
      } else if (errorParam) {
        // Handle OAuth errors with user-friendly messages
        let errorMessage = t('auth.authenticationFailed');

        switch (errorParam) {
          case 'no_code':
            errorMessage = t('auth.oauthError.noCode');
            break;
          case 'invalid_token':
            errorMessage = t('auth.oauthError.invalidToken');
            break;
          case 'oauth_failed':
            errorMessage = t('auth.oauthError.failed');
            break;
          default:
            errorMessage = t('auth.oauthError.generic');
        }

        setError(errorMessage);
        setIsProcessing(false);
        // Clean URL without navigating to allow error UI to display
        window.history.replaceState({}, '', window.location.pathname);
      } else {
        // No token or error - redirect to home
        navigate('/', { replace: true });
      }
    };

    processCallback();
  }, [location.search, navigate, t]);

  if (isProcessing && !error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <GlitchLoader size={32} className="mx-auto mb-4" />
          <p className="text-muted-foreground font-mono text-sm">{t('auth.processing')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-md p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle size={24} className="text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">{t('auth.authenticationError')}</h2>
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md mb-4">
            <p className="text-sm text-destructive font-mono">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
            className="flex-1 bg-brand-cyan/80 hover:bg-brand-cyan/90 text-black font-medium py-2.5 px-4 rounded-md transition-colors duration-200 text-sm font-mono"
          >
            {t('auth.backToHome')}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              // Open auth modal by navigating to home and triggering auth
              navigate('/');
              // Small delay to ensure navigation completes
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('openAuthModal'));
              }, 100);
            }}
            className="flex-1 bg-muted hover:bg-accent text-foreground font-medium py-2.5 px-4 rounded-md border border-border hover:border-border-hover transition-colors duration-200 text-sm font-mono"
          >
            {t('auth.tryAgain')}
          </Button>
        </div>
      </div>
    </div>
  );
};
