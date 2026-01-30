import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { Header } from './Header';
import ASCIIFooter from './ASCIIFooter';
import { SubscriptionModal } from './SubscriptionModal';
import { CreditPackagesModal } from './CreditPackagesModal';
import { PrivacyPolicy } from '../pages/PrivacyPolicy';
import { TermsOfService } from '../pages/TermsOfService';
import { RefundPolicy } from '../pages/RefundPolicy';
import { UsagePolicy } from '../pages/UsagePolicy';
import { FloatingSupportButton } from './ui/FloatingSupportButton';
import { SupportModal } from './SupportModal';
import { Toaster, toast } from 'sonner';
import { authService, type User } from '../services/authService';
import { subscriptionService, type SubscriptionStatus } from '../services/subscriptionService';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/hooks/useTheme';
import { CanvasHeader } from './canvas/CanvasHeader';
import { useCanvasHeader } from './canvas/CanvasHeaderContext';


// Export context values for child components
export type LayoutContextValue = {
  subscriptionStatus: SubscriptionStatus | null;
  isAuthenticated: boolean | null;
  isCheckingAuth: boolean;
  onSubscriptionModalOpen: () => void;
  onCreditPackagesModalOpen: () => void;
  setSubscriptionStatus: (status: SubscriptionStatus | null) => void;
  registerUnsavedOutputsHandler: (handler: () => { hasUnsaved: boolean; count: number; onSaveAll?: () => Promise<void> } | null) => void;
  registerResetHandler: (handler: () => void) => void;
};

export const LayoutContext = React.createContext<LayoutContextValue | null>(null);

interface LayoutProps {
  children: React.ReactNode;
}



export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isTermsOpen, setIsTermsOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [isUsagePolicyOpen, setIsUsagePolicyOpen] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isCreditPackagesModalOpen, setIsCreditPackagesModalOpen] = useState(false);
  const [creditPackagesModalTab, setCreditPackagesModalTab] = useState<'buy' | 'credits'>('buy');
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      return token ? true : null;
    }
    return null;
  });
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Handlers for unsaved outputs checking
  const unsavedOutputsHandlerRef = React.useRef<(() => { hasUnsaved: boolean; count: number; onSaveAll?: () => Promise<void> } | null) | null>(null);
  const resetHandlerRef = React.useRef<(() => void) | null>(null);

  const registerUnsavedOutputsHandler = React.useCallback((handler: () => { hasUnsaved: boolean; count: number; onSaveAll?: () => Promise<void> } | null) => {
    unsavedOutputsHandlerRef.current = handler;
  }, []);

  const registerResetHandler = React.useCallback((handler: () => void) => {
    resetHandlerRef.current = handler;
  }, []);

  const getUnsavedOutputsInfo = React.useCallback((): { hasUnsaved: boolean; count: number; onSaveAll?: () => Promise<void> } | null => {
    if (unsavedOutputsHandlerRef.current) {
      return unsavedOutputsHandlerRef.current();
    }
    return null;
  }, []);

  const handleReset = React.useCallback(() => {
    if (resetHandlerRef.current) {
      resetHandlerRef.current();
    }
  }, []);

  // Handle policy routes
  useEffect(() => {
    const path = location.pathname;
    // Privacy Policy now has a dedicated page, so don't open modal for /privacy
    if (path === '/terms') {
      setIsTermsOpen(true);
      setIsPrivacyOpen(false);
      setIsRefundOpen(false);
      setIsUsagePolicyOpen(false);
    } else if (path === '/refund') {
      setIsRefundOpen(true);
      setIsPrivacyOpen(false);
      setIsTermsOpen(false);
      setIsUsagePolicyOpen(false);
    } else if (path === '/usage-policy') {
      setIsUsagePolicyOpen(true);
      setIsPrivacyOpen(false);
      setIsTermsOpen(false);
      setIsRefundOpen(false);
    } else {
      setIsPrivacyOpen(false);
      setIsTermsOpen(false);
      setIsRefundOpen(false);
      setIsUsagePolicyOpen(false);
    }
  }, [location.pathname]);

  const handleClosePrivacy = () => {
    setIsPrivacyOpen(false);
  };

  const handleCloseTerms = () => {
    setIsTermsOpen(false);
    if (location.pathname === '/terms') {
      navigate('/');
    }
  };

  const handleCloseRefund = () => {
    setIsRefundOpen(false);
    if (location.pathname === '/refund') {
      navigate('/');
    }
  };

  const handleCloseUsagePolicy = () => {
    setIsUsagePolicyOpen(false);
    if (location.pathname === '/usage-policy') {
      navigate('/');
    }
  };

  // Detect and save referral code from URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');

    if (refCode) {
      // Save referral code to localStorage for use during registration
      localStorage.setItem('referral_code', refCode);

      // Clean URL by removing ref parameter (optional, for cleaner URLs)
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('ref');
      window.history.replaceState({}, '', newUrl.toString());
    }
  }, []);

  // Load subscription status on mount and handle checkout return
  useEffect(() => {
    const loadSubscriptionStatus = async () => {
      // Use isAuthenticated from context instead of verifying again
      if (isAuthenticated === false) {
        // Definitely not authenticated, don't try to load subscription
        return;
      }

      // If still checking auth, wait for it to complete
      if (isAuthenticated === null || isCheckingAuth) {
        return;
      }

      // isAuthenticated === true, safe to load subscription status
      try {
        const status = await subscriptionService.getSubscriptionStatus();
        setSubscriptionStatus(status);
      } catch (error) {
        console.error('Failed to load subscription status:', error);
      }
    };

    // Handle Stripe checkout return (for both Checkout Sessions and Payment Links)
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');
    const canceled = urlParams.get('canceled');

    if (sessionId) {
      // Checkout Session success - redirect to thank you page
      console.log('✅ Checkout successful, session_id:', sessionId);
      navigate('/thank-you', { replace: true });

      // Load status immediately
      loadSubscriptionStatus();

      // Poll for subscription status update (webhook may take a few seconds)
      // If status doesn't update after 5 seconds, trigger manual verification
      let pollCount = 0;
      const maxPolls = 6; // 6 polls * 1 second = 6 seconds total
      const pollInterval = 1000; // 1 second

      const pollSubscriptionStatus = setInterval(async () => {
        pollCount++;

        // Use isAuthenticated from context - if not authenticated, stop polling
        if (isAuthenticated === false) {
          clearInterval(pollSubscriptionStatus);
          return;
        }

        // If still checking, skip this poll
        if (isAuthenticated === null || isCheckingAuth) {
          return;
        }

        try {
          const status = await subscriptionService.getSubscriptionStatus();

          // If subscription is now active, stop polling
          if (status.hasActiveSubscription) {
            console.log('✅ Subscription status updated via webhook');
            clearInterval(pollSubscriptionStatus);
            setSubscriptionStatus(status);
            return;
          }

          // If we've polled max times and still no update, verify manually
          if (pollCount >= maxPolls) {
            console.log('⏱️ Webhook taking too long, verifying subscription manually...');
            clearInterval(pollSubscriptionStatus);

            try {
              const result = await subscriptionService.verifySubscription();
              console.log('✅ Subscription verified manually:', result);

              // Reload status after manual verification
              const updatedStatus = await subscriptionService.getSubscriptionStatus();
              setSubscriptionStatus(updatedStatus);
            } catch (error) {
              console.error('❌ Error verifying subscription manually:', error);
            }
          }
        } catch (error) {
          console.error('Error polling subscription status:', error);
          clearInterval(pollSubscriptionStatus);
        }
      }, pollInterval);

      // Cleanup interval on unmount
      return () => clearInterval(pollSubscriptionStatus);
    } else if (canceled) {
      // User canceled
      console.log('⚠️ Checkout canceled by user');
      navigate(location.pathname, { replace: true });
      toast.info(t('common.checkoutCanceled'), { duration: 3000 });
      loadSubscriptionStatus();
    } else {
      // Check for credit purchase return from Payment Link
      const creditPurchasePending = localStorage.getItem('credit_purchase_pending');

      if (creditPurchasePending) {
        try {
          const purchaseData = JSON.parse(creditPurchasePending);
          const timeSincePurchase = Date.now() - purchaseData.timestamp;

          // Only poll if purchase was recent (within last 5 minutes)
          if (timeSincePurchase < 5 * 60 * 1000) {
            console.log('📦 Credit purchase detected, polling for credit update...');

            // Declare interval variable outside async function for cleanup
            let pollCreditsStatus: NodeJS.Timeout | null = null;

            // Load initial status and get initial credits to compare
            (async () => {
              let initialCredits = 0;

              // Use isAuthenticated from context instead of verifying
              if (isAuthenticated === true && !isCheckingAuth) {
                try {
                  const status = await subscriptionService.getSubscriptionStatus();
                  initialCredits = status.totalCreditsEarned ?? 0;
                  setSubscriptionStatus(status);
                } catch (error) {
                  console.error('Failed to load initial subscription status:', error);
                }
              }

              // Poll for credit update
              let pollCount = 0;
              const maxPolls = 10; // 10 polls * 1 second = 10 seconds total
              const pollInterval = 1000; // 1 second

              pollCreditsStatus = setInterval(async () => {
                pollCount++;

                // Use isAuthenticated from context - if not authenticated, stop polling
                if (isAuthenticated === false) {
                  if (pollCreditsStatus) clearInterval(pollCreditsStatus);
                  return;
                }

                // If still checking, skip this poll
                if (isAuthenticated === null || isCheckingAuth) {
                  return;
                }

                try {
                  const status = await subscriptionService.getSubscriptionStatus();

                  // If credits increased, payment was successful
                  if (status.totalCreditsEarned > initialCredits) {
                    console.log('✅ Credits updated successfully:', {
                      initial: initialCredits,
                      updated: status.totalCreditsEarned,
                      added: status.totalCreditsEarned - initialCredits,
                    });
                    if (pollCreditsStatus) clearInterval(pollCreditsStatus);
                    setSubscriptionStatus(status);
                    localStorage.removeItem('credit_purchase_pending');
                    toast.success(t('creditsPackages.purchaseSuccess') || 'Credits added successfully!', {
                      duration: 5000,
                    });
                    return;
                  }

                  // If we've polled max times, stop polling
                  if (pollCount >= maxPolls) {
                    console.log('⏱️ Credit update polling timeout');
                    if (pollCreditsStatus) clearInterval(pollCreditsStatus);
                    // Clear the flag after timeout (might have been processed or user didn't complete)
                    localStorage.removeItem('credit_purchase_pending');
                  } else {
                    // Update status even if credits haven't increased yet
                    setSubscriptionStatus(status);
                  }
                } catch (error) {
                  console.error('Error polling credits status:', error);
                  if (pollCreditsStatus) clearInterval(pollCreditsStatus);
                }
              }, pollInterval);
            })();

            // Cleanup interval on unmount
            return () => {
              if (pollCreditsStatus) clearInterval(pollCreditsStatus);
            };
          } else {
            // Purchase data is too old, clear it
            localStorage.removeItem('credit_purchase_pending');
          }
        } catch (error) {
          console.error('Error parsing credit purchase data:', error);
          localStorage.removeItem('credit_purchase_pending');
        }
      }

      // Normal load
      loadSubscriptionStatus();
    }
  }, [navigate, location.pathname, t, isAuthenticated, isCheckingAuth]);

  // Centralized authentication check - única fonte de verdade para estado de autenticação
  useEffect(() => {
    let isMounted = true;
    let isFirstCheck = true;

    const checkAuth = async () => {
      // Debounce mínimo no primeiro check para dar tempo do backend (MongoDB) inicializar
      // Evita erro loop no cold start do serverless
      if (isFirstCheck) {
        isFirstCheck = false;
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!isMounted) return;
      }

      try {
        const user = await authService.verifyToken();
        if (!isMounted) return;

        if (user) {
          setIsAuthenticated(true);
          setCurrentUser(user);
        } else {
          // No user returned - check if token still exists
          const token = authService.getToken();
          if (token) {
            // Token exists but verification failed - might be temporary network issue
            // Keep current state (optimistic) - don't set to false yet
            // The interval will retry automatically
          } else {
            // No token at all - definitely not authenticated
            setIsAuthenticated(false);
            setCurrentUser(null);
          }
        }
      } catch (error) {
        if (!isMounted) return;

        // On error, check if token still exists
        const token = authService.getToken();
        if (token) {
          // Token exists, might be temporary error - keep optimistic state
          // Don't change isAuthenticated, let interval retry
        } else {
          // No token - set to false
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } finally {
        if (!isMounted) return;
        setIsCheckingAuth(false);
      }
    };

    // Initial check
    checkAuth();

    // Check periodically to catch OAuth logins and handle temporary network issues
    // Aumentado para 15 segundos para reduzir requisições simultâneas
    const interval = setInterval(() => {
      if (isMounted) {
        checkAuth();
      }
    }, 15000);

    // Listen for storage events to detect token changes in other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth_token') {
        if (!isMounted) return;

        // Token changed - recheck authentication
        if (e.newValue) {
          // New token set - verify it
          authService.invalidateCache(); // Invalidate cache when token changes
          checkAuth();
        } else {
          // Token removed - user logged out
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      }
    };

    // Listen for custom events to detect token changes in the same tab
    const handleTokenChanged = (e: CustomEvent) => {
      if (!isMounted) return;

      // Token changed in same tab - recheck authentication
      if (e.detail?.token) {
        authService.invalidateCache(); // Invalidate cache when token changes
        checkAuth();
      } else {
        // Token removed - user logged out
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('auth_token_changed', handleTokenChanged as EventListener);

    return () => {
      isMounted = false;
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth_token_changed', handleTokenChanged as EventListener);
    };
  }, []);

  const contextValue: LayoutContextValue = {
    subscriptionStatus,
    isAuthenticated,
    isCheckingAuth,
    onSubscriptionModalOpen: () => setIsSubscriptionModalOpen(true),
    onCreditPackagesModalOpen: () => {
      setCreditPackagesModalTab('buy');
      setIsCreditPackagesModalOpen(true);
    },
    setSubscriptionStatus,
    registerUnsavedOutputsHandler,
    registerResetHandler,
  };

  return (
    <LayoutContext.Provider value={contextValue}>
      <div className="h-screen bg-background text-foreground font-sans flex flex-col">
        <Toaster
          position="top-right"
          offset={40}
          richColors={false}
          closeButton={true}
          duration={1000}
          expand={true}
          gap={12}
          toastOptions={{
            className: theme === 'dark'
              ? 'bg-neutral-950/70 backdrop-blur-[2px] border border-neutral-800/10 !text-white/70 shadow-sm cursor-pointer hover:bg-neutral-950/50 transition-all duration-150 margin-2'
              : 'bg-white/40 backdrop-blur-[2px] border border-neutral-200/10 text-neutral-800/70 shadow-sm cursor-pointer hover:bg-white/50 transition-all duration-150 margin-2',
            style: {
              background: theme === 'dark' ? 'rgba(18, 18, 18, 0.4)' : 'rgba(255, 255, 255, 0.4)',
              padding: '12px 16px',
              fontSize: '11px',
              lineHeight: '1.5',
              borderRadius: 'var(--radius)',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            },
            classNames: {
              toast: theme === 'dark'
                ? 'bg-neutral-950/70 border-neutral-800/10 !text-white/70 !shadow-sm !p-2 !text-[11px] !font-mono'
                : 'bg-white/40 border-neutral-200/10 text-neutral-800/70 !shadow-sm !p-2 !text-[11px] !font-mono',
              title: theme === 'dark' ? '!text-white/70 !font-mono !text-[11px] !font-normal !leading-tight' : 'text-neutral-900/70 !font-mono !text-[11px] !font-normal !leading-tight',
              description: theme === 'dark' ? '!text-white/60 !font-mono !text-[10px] !leading-tight' : 'text-neutral-600/60 !font-mono !text-[10px] !leading-tight',
              success: theme === 'dark'
                ? 'bg-neutral-950/70 border-brand-cyan/15 text-brand-cyan/70'
                : 'bg-white/40 border-green-500/15 text-green-600/70',
              error: theme === 'dark'
                ? 'bg-neutral-950/70 border-red-500/15 text-red-400/70'
                : 'bg-white/40 border-red-500/15 text-red-600/70',
              info: theme === 'dark'
                ? 'bg-neutral-950/70 border-blue-500/15 text-blue-400/70'
                : 'bg-white/40 border-blue-500/15 text-blue-600/70',
              closeButton: theme === 'dark'
                ? 'text-neutral-500/30 hover:text-neutral-400/50 opacity-30 hover:opacity-50 !w-3 !h-3'
                : 'text-neutral-400/30 hover:text-neutral-500/50 opacity-30 hover:opacity-50 !w-3 !h-3',
            },
          }}
        />
        <Analytics />

        <PrivacyPolicy isOpen={isPrivacyOpen} onClose={handleClosePrivacy} />
        <TermsOfService isOpen={isTermsOpen || location.pathname === '/terms'} onClose={handleCloseTerms} />
        <RefundPolicy isOpen={isRefundOpen || location.pathname === '/refund'} onClose={handleCloseRefund} />
        <UsagePolicy isOpen={isUsagePolicyOpen || location.pathname === '/usage-policy'} onClose={handleCloseUsagePolicy} />

        {!location.pathname.startsWith('/canvas/') && (
          <Header
            subscriptionStatus={subscriptionStatus}
            onPricingClick={() => navigate('/pricing')}
            onJoinClick={() => setIsSubscriptionModalOpen(true)}
            onCreditsClick={() => {
              setCreditPackagesModalTab('credits');
              setIsCreditPackagesModalOpen(true);
            }}
            onLogoClick={() => {
              // This will be intercepted by Header if there are unsaved outputs
              const unsavedInfo = getUnsavedOutputsInfo();
              if (!unsavedInfo?.hasUnsaved) {
                handleReset();
                navigate('/');
              }
            }}
            onLogoClickWithReset={handleReset}
            getUnsavedOutputsInfo={getUnsavedOutputsInfo}
            navigateToHome={() => navigate('/')}
            onMockupsClick={() => navigate('/mockups')}
            onCreateNewMockup={() => navigate('/mockupmachine')}
            onMyOutputsClick={() => navigate('/my-outputs')}
            onMyBrandingsClick={() => navigate('/my-brandings')}
          />
        )}

        {location.pathname.startsWith('/canvas/') && <CanvasHeader onBack={() => navigate('/canvas')} />}

        <SubscriptionModal
          isOpen={isSubscriptionModalOpen}
          onClose={() => setIsSubscriptionModalOpen(false)}
          onBuyCredits={() => {
            setIsSubscriptionModalOpen(false);
            setCreditPackagesModalTab('buy');
            setIsCreditPackagesModalOpen(true);
          }}
        />

        <CreditPackagesModal
          isOpen={isCreditPackagesModalOpen}
          onClose={() => setIsCreditPackagesModalOpen(false)}
          subscriptionStatus={subscriptionStatus}
          initialTab={creditPackagesModalTab}
        />

        {!location.pathname.startsWith('/budget/shared') && (
          <FloatingSupportButton onClick={() => setIsSupportModalOpen(true)} />
        )}

        <SupportModal
          isOpen={isSupportModalOpen}
          onClose={() => setIsSupportModalOpen(false)}
          userName={currentUser?.name || ''}
          userEmail={currentUser?.email || ''}
        />

        <div className={location.pathname.startsWith('/canvas/') ? "flex-1 overflow-hidden" : "flex-1 overflow-y-auto"}>
          {children}
        </div>

        {!location.pathname.startsWith('/canvas/') && (
          <ASCIIFooter
            className={location.pathname === '/' ? 'hidden lg:block' : ''}
            onPrivacyClick={() => {
              navigate('/privacy');
            }}
            onTermsClick={() => {
              navigate('/terms');
              setIsTermsOpen(true);
            }}
            onUsagePolicyClick={() => {
              navigate('/usage-policy');
              setIsUsagePolicyOpen(true);
            }}
            onRefundClick={() => {
              navigate('/refund');
              setIsRefundOpen(true);
            }}
          />
        )}
      </div>
    </LayoutContext.Provider>
  );
};

