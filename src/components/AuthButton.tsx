import React, { useState, useEffect, useRef } from 'react';
import { authService, type User } from '../services/authService';
import { subscriptionService, type SubscriptionStatus } from '../services/subscriptionService';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { GlitchLoader } from './ui/GlitchLoader';
import { LogIn, LogOut, User as UserIcon, Mail, X, Pickaxe, ChevronDown, Globe, Key, ShieldCheck } from 'lucide-react';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { toast } from 'sonner';

interface AuthButtonProps {
  subscriptionStatus?: SubscriptionStatus | null;
  onCreditsClick?: () => void;
}

export const AuthButton: React.FC<AuthButtonProps> = ({ subscriptionStatus: propSubscriptionStatus, onCreditsClick }) => {
  const { t } = useTranslation();
  // Try to get layout context, but don't fail if not available (e.g., in EditorApp)
  let isAuthenticated: boolean | null = null;
  let isCheckingAuth = false;
  try {
    const layout = useLayout();
    isAuthenticated = layout.isAuthenticated;
    isCheckingAuth = layout.isCheckingAuth;
  } catch (error) {
    // If useLayout fails, use authService directly as fallback
    if (typeof window !== 'undefined') {
      const token = authService.getToken();
      isAuthenticated = !!token;
      isCheckingAuth = false;
    }
  }
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const captchaRef = useRef<HCaptcha>(null);

  const hcaptchaSiteKey = typeof window !== 'undefined'
    ? (import.meta as any).env?.VITE_HCAPTCHA_SITE_KEY
    : undefined;
  const captchaEnabled = false; // Temporarily disabled

  // Load user data when authenticated state changes (sincronizado com contexto)
  useEffect(() => {
    const loadUserData = async () => {
      // Wait for initial auth check to complete
      if (isCheckingAuth) {
        return;
      }

      if (isAuthenticated === true) {
        setIsLoading(true);
        try {
          // Load user data for UI (name, picture) - uses cached result from authService
          // verifyToken() uses cache/throttle, so this is efficient
          const currentUser = await authService.verifyToken();
          setUser(currentUser);

          if (currentUser) {
            try {
              const status = await subscriptionService.getSubscriptionStatus();
              setSubscriptionStatus(status);
            } catch (error) {
              console.error('Failed to load subscription status:', error);
            }
          }
        } catch (error) {
          console.error('Auth check error:', error);
          setUser(null);
        } finally {
          setIsLoading(false);
        }
      } else if (isAuthenticated === false) {
        // Definitely not authenticated - use context state, no need to verify
        setUser(null);
        setIsLoading(false);
      }
      // If isAuthenticated is null, still checking - keep loading state
    };

    loadUserData();
  }, [isAuthenticated, isCheckingAuth]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    setIsAuthLoading(true);

    try {
      let result;
      if (isSignUp) {
        // Get referral code from localStorage if available
        const referralCode = typeof window !== 'undefined'
          ? localStorage.getItem('referral_code')
          : null;

        result = await authService.signUp(email, password, name || undefined, referralCode || undefined, captchaToken || undefined);

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
        result = await authService.signIn(email, password);
      }

      toast.success(isSignUp ? t('auth.accountCreatedSuccess') : t('auth.signedInSuccess'), { duration: 2000 });
      setUser(result.user);
      setShowEmailModal(false);
      setEmail('');
      setPassword('');
      setName('');

      // Refresh subscription status
      try {
        const status = await subscriptionService.getSubscriptionStatus();
        setSubscriptionStatus(status);
      } catch (error) {
        console.error('Failed to load subscription status:', error);
      }
    } catch (error: any) {
      // Handle Event objects (from script loading errors, etc.) vs Error objects
      const isEventObject = error && typeof error === 'object' && 'type' in error && 'target' in error;

      // Check if this is a BotID script loading error (converted to "Network error during authentication")
      // BotID errors typically have no status and the message "Network error during authentication"
      const isBotIdError =
        error?.message === 'Network error during authentication' &&
        !error.status &&
        !error.response;

      if (isEventObject || isBotIdError) {
        // This is likely a script loading error from BotID - don't log it, just show user-friendly message
        // The error is not actionable and is just noise from BotID's script loading mechanism
        setAuthError(t('auth.backendNotRunning'));
        // Reset CAPTCHA on error
        if (isSignUp && captchaRef.current) {
          captchaRef.current.resetCaptcha();
          setCaptchaToken(null);
        }
        setIsAuthLoading(false);
        return;
      }

      // Enhanced error logging with full context
      const isNetworkError =
        error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('ERR_CONNECTION_REFUSED') ||
        error?.message?.includes('NetworkError') ||
        error?.name === 'TypeError' ||
        !error.status;

      console.error('[AuthButton] Email auth error:', {
        message: error?.message || 'Unknown error',
        name: error?.name || 'Error',
        status: error?.status,
        statusText: error?.statusText,
        response: error?.response,
        stack: isNetworkError ? error?.stack : undefined,
        isSignUp,
      });

      // Check if it's a connection error
      const errorMessage = error?.message || String(error || 'Unknown error');
      if (isNetworkError) {
        setAuthError(t('auth.backendNotRunning'));
      } else {
        // Parse error message from response if available
        let userFriendlyMessage = error?.message || t('auth.authenticationFailed');

        // Check response object for additional error details
        if (error?.response?.error) {
          userFriendlyMessage = error.response.error;
        } else if (error?.response?.message) {
          userFriendlyMessage = error.response.message;
        }

        // Handle rate limit errors
        if (
          userFriendlyMessage.includes('Rate limit') ||
          userFriendlyMessage.includes('Too many') ||
          error?.status === 429
        ) {
          setAuthError(t('auth.tooManyAttempts'));
        } else if (error?.status === 401) {
          // Authentication failed - use the error message from server or default
          setAuthError(userFriendlyMessage || t('auth.authenticationFailed'));
        } else if (error?.status === 400) {
          // Bad request - usually validation errors
          setAuthError(userFriendlyMessage || t('auth.authenticationFailed'));
        } else {
          setAuthError(userFriendlyMessage);
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

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    await authService.logout();
    setUser(null);
    // Navigate to home instead of reloading to avoid chunk loading errors
    // Layout context will automatically update via auth_token_changed event
    window.location.href = '/';
  };

  const handleProfileClick = () => {
    setIsDropdownOpen(false);
    window.history.pushState({}, '', '/profile');
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

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
      const errorMessage = error.message || String(error);
      if (
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('ERR_CONNECTION_REFUSED') ||
        errorMessage.includes('NetworkError') ||
        error.name === 'TypeError'
      ) {
        alert(t('auth.backendNotRunning'));
      } else {
        alert(error.message || t('auth.failedToConnectGoogle'));
      }
      setIsGoogleLoading(false);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-auth-dropdown]')) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);


  if (isCheckingAuth || isLoading) {
    return (
      <div className="px-3 py-2 flex items-center gap-2 text-xs text-neutral-500 font-mono">
        <GlitchLoader size={12} color="brand-cyan" />
      </div>
    );
  }

  // Calculate available credits
  const getAvailableCredits = (): number => {
    const status = propSubscriptionStatus || subscriptionStatus;
    if (!status) return 0;
    return typeof status.totalCredits === 'number'
      ? status.totalCredits
      : ((status.totalCreditsEarned ?? 0) + (status.creditsRemaining ?? 0));
  };

  const availableCredits = getAvailableCredits();

  if (user) {
    return (
      <div className="flex items-center gap-3" data-auth-dropdown>
        {propSubscriptionStatus || subscriptionStatus ? (
          <button
            onClick={onCreditsClick}
            className="flex items-center gap-1.5 px-2.5 md:px-3 py-1 md:py-1.5 text-[11px] md:text-xs font-mono text-brand-cyan hover:text-brand-cyan/80 transition-all rounded border border-[brand-cyan]/30 hover:border-[brand-cyan]/50 hover:bg-brand-cyan/10 focus:outline-none focus:ring-2 focus:ring-[brand-cyan]/50 focus:ring-offset-2 focus:ring-offset-[#0a0a0a] cursor-pointer"
            aria-label={t('auth.availableCredits', { count: availableCredits })}
            title={t('auth.creditsAvailable', { count: availableCredits })}
          >
            <Pickaxe size={12} className="md:w-3 md:h-3" aria-hidden="true" />
            <span>{availableCredits}</span>
          </button>
        ) : null}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-neutral-400 font-mono bg-neutral-800/30 border border-neutral-700/30 hover:bg-neutral-800/50 hover:border-neutral-600/50 hover:text-neutral-300 transition-all cursor-pointer"
            title={t('auth.userMenu')}
          >
            {user.picture ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-5 h-5 rounded-md"
              />
            ) : (
              <UserIcon size={16} />
            )}
            <span className="hidden sm:inline">{user.name || user.email}</span>
            <ChevronDown size={12} className={`hidden sm:block transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
          {isDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onMouseDown={(e) => {
                  // Don't close if clicking inside the dropdown
                  if ((e.target as HTMLElement).closest('.dropdown-menu')) {
                    return;
                  }
                  setIsDropdownOpen(false);
                }}
                onClick={() => setIsDropdownOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 bg-neutral-900 border border-neutral-800/50 rounded-md shadow-lg z-50 min-w-[160px] dropdown-menu">
                <button
                  onClick={handleProfileClick}
                  className="w-full text-left px-4 py-2 text-xs font-mono transition-colors cursor-pointer text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 flex items-center gap-2"
                >
                  <UserIcon size={14} />
                  {t('auth.profile')}
                </button>
                <button
                  onClick={() => {
                    setIsDropdownOpen(false);
                    window.history.pushState({}, '', '/community');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="w-full text-left px-4 py-2 text-xs font-mono transition-colors cursor-pointer text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 flex items-center gap-2"
                >
                  <Globe size={14} />
                  {t('auth.community') || 'Community'}
                </button>
                {user.isAdmin && (
                  <>
                    <div className="border-t border-neutral-800/50 my-1" />
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false);
                        window.history.pushState({}, '', '/admin');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }}
                      className="w-full text-left px-4 py-2 text-xs font-mono transition-colors cursor-pointer text-brand-cyan hover:text-brand-cyan/80 hover:bg-brand-cyan/10 flex items-center gap-2"
                    >
                      <ShieldCheck size={14} />
                      {t('auth.adminPanel') || 'Admin'}
                    </button>
                  </>
                )}

                <div className="border-t border-neutral-800/50 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-xs font-mono transition-colors cursor-pointer text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 flex items-center gap-2"
                >
                  <LogOut size={14} />
                  {t('auth.logout')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-1 md:gap-2">
        {/* Google OAuth button hidden */}
        {false && (
          <button
            onClick={handleGoogleAuth}
            disabled={isGoogleLoading}
            className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-neutral-800/50 text-neutral-400 rounded-md border border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300 disabled:opacity-50 disabled:cursor-not-allowed text-[10px] md:text-xs font-mono transition-colors"
          >
            {isGoogleLoading ? (
              <GlitchLoader size={12} color="currentColor" />
            ) : (
              <span>{t('auth.signInWithGoogle')}</span>
            )}
          </button>
        )}
        <button
          onClick={() => setShowEmailModal(true)}
          className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-neutral-800/50 text-neutral-400 rounded-md border border-neutral-700/50 hover:border-neutral-600 hover:text-neutral-300 text-[10px] md:text-xs font-mono transition-colors"
        >
          <Mail size={12} className="md:w-[14px] md:h-[14px]" />
          <span className="hidden sm:inline">{t('auth.signInWithEmail')}</span>
          <span className="sm:hidden">{t('auth.email')}</span>
        </button>
      </div>

      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center min-h-screen bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800/50 rounded-md p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold font-mono text-neutral-200 uppercase">
                {isSignUp ? t('auth.signUp') : t('auth.signIn')}
              </h2>
              <button
                onClick={() => {
                  setShowEmailModal(false);
                  setAuthError(null);
                  setEmail('');
                  setPassword('');
                  setName('');
                  setCaptchaToken(null);
                  if (captchaRef.current) {
                    captchaRef.current.resetCaptcha();
                  }
                }}
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
                      <GlitchLoader size={16} color="currentColor" />
                      {t('auth.signingInWithGoogle')}
                    </>
                  ) : (
                    t('auth.signInWithGoogle')
                  )}
                </button>

                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1 h-px bg-neutral-800/50"></div>
                  <span className="text-xs text-neutral-500 font-mono">ou</span>
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
                    className="w-full bg-black/40 p-2 rounded-md border border-neutral-700/50 focus:outline-none focus:border-[brand-cyan]/50 focus:ring-0 text-sm text-neutral-300 font-mono"
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
                  className="w-full bg-black/40 p-2 rounded-md border border-neutral-700/50 focus:outline-none focus:border-[brand-cyan]/50 focus:ring-0 text-sm text-neutral-300 font-mono"
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
                  className="w-full bg-black/40 p-2 rounded-md border border-neutral-700/50 focus:outline-none focus:border-[brand-cyan]/50 focus:ring-0 text-sm text-neutral-300 font-mono"
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
                    onClick={() => {
                      setShowEmailModal(false);
                      setShowForgotPassword(true);
                    }}
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
                    <GlitchLoader size={16} color="currentColor" />
                    {isSignUp ? t('auth.creatingAccount') : t('auth.signingIn')}
                  </>
                ) : (
                  isSignUp ? t('auth.signUp') : t('auth.signIn')
                )}
              </button>
            </form>

            <div className="mt-4 pt-4 border-t border-neutral-800/50">
              <button
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setAuthError(null);
                }}
                className="w-full text-xs text-neutral-500 hover:text-neutral-400 font-mono transition-colors"
              >
                {isSignUp
                  ? t('auth.alreadyHaveAccount')
                  : t('auth.dontHaveAccount')}
              </button>
            </div>
          </div>
        </div>
      )}

      <ForgotPasswordModal
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        onBackToLogin={() => {
          setShowForgotPassword(false);
          setShowEmailModal(true);
          setIsSignUp(false);
        }}
      />



    </>
  );
};

