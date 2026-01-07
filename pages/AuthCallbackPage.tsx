import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { authService } from '../services/authService';
import { useTranslation } from '../hooks/useTranslation';
import { toast } from 'sonner';

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
            // Clean URL and redirect to home
            navigate('/', { replace: true });
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
            errorMessage = t('auth.oauthError.noCode') || 'Authorization code not received. Please try again.';
            break;
          case 'invalid_token':
            errorMessage = t('auth.oauthError.invalidToken') || 'Invalid authentication token. Please try again.';
            break;
          case 'oauth_failed':
            errorMessage = t('auth.oauthError.failed') || 'OAuth authentication failed. Please try again.';
            break;
          default:
            errorMessage = t('auth.oauthError.generic') || 'Authentication error occurred. Please try again.';
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
      <div className="min-h-screen bg-[#121212] flex items-center justify-center">
        <div className="text-center">
          <GlitchLoader size={32} color="#brand-cyan" className="mx-auto mb-4" />
          <p className="text-zinc-400 font-mono text-sm">{t('auth.processing') || 'Processing authentication...'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800/50 rounded-md p-6 w-full max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle size={24} className="text-red-400" />
          <h2 className="text-lg font-semibold font-mono text-zinc-200 uppercase">
            {t('auth.authenticationError') || 'Authentication Error'}
          </h2>
        </div>

        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md mb-4">
            <p className="text-sm text-red-400 font-mono">{error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex-1 bg-brand-cyan/80 hover:bg-brand-cyan/90 text-black font-semibold py-2.5 px-4 rounded-md transition-all duration-200 text-sm font-mono"
          >
            {t('auth.backToHome') || 'Back to Home'}
          </button>
          <button
            onClick={() => {
              // Open auth modal by navigating to home and triggering auth
              navigate('/');
              // Small delay to ensure navigation completes
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('openAuthModal'));
              }, 100);
            }}
            className="flex-1 bg-zinc-800/50 hover:bg-zinc-800/70 text-zinc-300 font-semibold py-2.5 px-4 rounded-md border border-zinc-700/50 hover:border-zinc-600/50 transition-all duration-200 text-sm font-mono"
          >
            {t('auth.tryAgain') || 'Try Again'}
          </button>
        </div>
      </div>
    </div>
  );
};

