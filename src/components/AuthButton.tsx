import React, { useState, useEffect } from 'react';
import { authService, type User } from '../services/authService';
import { subscriptionService, type SubscriptionStatus } from '../services/subscriptionService';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { GlitchLoader } from './ui/GlitchLoader';
import {
  LogIn,
  LogOut,
  User as UserIcon,
  Mail,
  Pickaxe,
  ChevronDown,
  Globe,
  Key,
  ShieldCheck,
  BookOpen,
  Info,
} from '@/lib/ui/icons';
import { AuthModal } from './AuthModal';
import { Button } from '@/components/ui/button';

interface AuthButtonProps {
  subscriptionStatus?: SubscriptionStatus | null;
  onCreditsClick?: () => void;
  /** Direção de abertura do dropdown. 'bottom' (padrão) abre pra baixo (topbar);
   *  'top' abre pra cima — usado quando ancorado no rodapé do rail. */
  menuPlacement?: 'top' | 'bottom';
}

export const AuthButton: React.FC<AuthButtonProps> = ({
  subscriptionStatus: propSubscriptionStatus,
  onCreditsClick,
  menuPlacement = 'bottom',
}) => {
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);

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

  // O formulário de login mora no AuthModal (era duplicado aqui inteiro). Depois
  // do login, só relê usuário e créditos.
  const handleAuthSuccess = async () => {
    setShowEmailModal(false);
    try {
      const currentUser = await authService.verifyToken();
      setUser(currentUser);
      if (currentUser) {
        setSubscriptionStatus(await subscriptionService.getSubscriptionStatus());
      }
    } catch (error) {
      console.error('Failed to refresh user after sign-in:', error);
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
      <div className="px-3 py-2 flex items-center gap-2 text-xs text-muted-foreground">
        <GlitchLoader size={12} />
      </div>
    );
  }

  // Calculate available credits
  const getAvailableCredits = (): number => {
    const status = propSubscriptionStatus || subscriptionStatus;
    if (!status) return 0;
    return typeof status.totalCredits === 'number'
      ? status.totalCredits
      : (status.totalCreditsEarned ?? 0) + (status.creditsRemaining ?? 0);
  };

  const availableCredits = getAvailableCredits();

  const currentStatus = propSubscriptionStatus || subscriptionStatus;
  const tier = currentStatus?.subscriptionTier;
  const tierLabel = tier === 'premium' ? 'Vision' : tier === 'pro' ? 'Pro' : 'Free';
  const isLowCredits = availableCredits > 0 && availableCredits < 5;

  if (user) {
    return (
      <div className="flex items-center gap-2" data-auth-dropdown>
        {currentStatus ? (
          <>
            <Button
              variant="ghost"
              onClick={onCreditsClick}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-2xs md:text-2xs bg-card/60 border border-border hover:bg-accent hover:border-border-hover transition-[color,background-color,border-color,box-shadow] cursor-pointer shadow-sm ${
                isLowCredits ? 'text-warning border-warning/30' : 'text-foreground border-ring'
              }`}
              aria-label={t('auth.availableCredits', { count: availableCredits })}
              title={
                isLowCredits
                  ? t('auth.lowCredits', { count: availableCredits })
                  : t('auth.creditsAvailable', { count: availableCredits })
              }
            >
              <Pickaxe
                size={12}
                className={`md:w-3 md:h-3 ${isLowCredits ? 'text-warning' : 'text-muted-foreground'}`}
                aria-hidden="true"
              />
              <span className="tabular-nums">{availableCredits}</span>
            </Button>
          </>
        ) : null}
        <div className="relative">
          <Button
            variant="ghost"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 h-9 px-2 md:px-3 rounded-[10px] text-2xs text-muted-foreground bg-card/60 border border-border hover:bg-accent hover:border-border-hover hover:text-foreground transition-[color,background-color,border-color,box-shadow] cursor-pointer shadow-sm"
            title={t('auth.userMenu')}
          >
            {user.picture && !avatarFailed ? (
              <img
                src={user.picture}
                alt={user.name}
                className="w-4 h-4 md:w-5 md:h-5 rounded-[4px]"
                onError={() => setAvatarFailed(true)}
              />
            ) : (
              <UserIcon size={14} className="md:w-4 md:h-4" />
            )}
            <span className="hidden sm:inline lowercase">{user.name || user.email}</span>
            <ChevronDown
              size={12}
              className={`hidden sm:block transition-transform ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </Button>
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
              <div
                className={`absolute right-0 ${
                  menuPlacement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
                } bg-popover border border-border rounded-md shadow-lg z-50 min-w-[150px] py-1 dropdown-menu`}
              >
                <Button
                  variant="ghost"
                  onClick={handleProfileClick}
                  className="w-full text-left px-3 py-1.5 h-auto text-xs transition-colors cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent flex items-center gap-2 justify-between"
                >
                  <span className="flex items-center gap-2">
                    <UserIcon size={14} />
                    {t('common.profile')}
                  </span>
                  <span className="text-2xs text-muted-foreground">{tierLabel}</span>
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    window.history.pushState({}, '', '/community');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="w-full text-left px-3 py-1.5 h-auto text-xs transition-colors cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-start gap-2"
                >
                  <Globe size={14} />
                  {t('common.community')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    window.history.pushState({}, '', '/docs');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="w-full text-left px-3 py-1.5 h-auto text-xs transition-colors cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-start gap-2"
                >
                  <BookOpen size={14} />
                  Docs
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsDropdownOpen(false);
                    window.history.pushState({}, '', '/about');
                    window.dispatchEvent(new PopStateEvent('popstate'));
                  }}
                  className="w-full text-left px-3 py-1.5 h-auto text-xs transition-colors cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-start gap-2"
                >
                  <Info size={14} />
                  {t('header.about')}
                </Button>
                {user.isAdmin && (
                  <>
                    <div className="border-t border-border my-1" />
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setIsDropdownOpen(false);
                        window.history.pushState({}, '', '/admin');
                        window.dispatchEvent(new PopStateEvent('popstate'));
                      }}
                      className="w-full text-left px-3 py-1.5 h-auto text-xs transition-colors cursor-pointer text-foreground hover:bg-accent flex items-center justify-start gap-2"
                    >
                      <ShieldCheck size={14} />
                      {t('auth.adminPanel')}
                    </Button>
                  </>
                )}

                <div className="border-t border-border my-1" />
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="w-full text-left px-3 py-1.5 h-auto text-xs transition-colors cursor-pointer text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-start gap-2"
                >
                  <LogOut size={14} />
                  {t('auth.logout')}
                </Button>
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
        <Button
          variant="ghost"
          onClick={() => setShowEmailModal(true)}
          className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 bg-secondary text-muted-foreground rounded-md border border-border hover:border-border-hover hover:text-foreground text-2xs md:text-xs transition-colors"
        >
          <Mail size={12} className="md:w-[14px] md:h-[14px]" />
          <span className="hidden sm:inline">{t('auth.signInWithEmail')}</span>
          <span className="sm:hidden">{t('auth.email')}</span>
        </Button>
      </div>

      <AuthModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
};
