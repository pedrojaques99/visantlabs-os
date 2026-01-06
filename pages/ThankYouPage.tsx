import React, { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { CheckCircle, Pickaxe, ArrowRight } from 'lucide-react';
import { GlitchLoader } from '../components/ui/GlitchLoader';
import { useTranslation } from '../hooks/useTranslation';
import { useLayout } from '../hooks/useLayout';
import { subscriptionService } from '../services/subscriptionService';
import type { SubscriptionStatus } from '../services/subscriptionService';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';

export const ThankYouPage: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, isCheckingAuth } = useLayout(); // Usar estado de autenticação do contexto centralizado
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      // Wait for auth check to complete
      if (isCheckingAuth) {
        return;
      }

      if (isAuthenticated === true) {
        // User is authenticated, load subscription status
        try {
          const status = await subscriptionService.getSubscriptionStatus();
          setSubscriptionStatus(status);
        } catch (error) {
          console.error('Failed to load subscription status:', error);
        } finally {
          setIsLoading(false);
        }
      } else {
        // Not authenticated - still show page but without subscription details
        setIsLoading(false);
      }
    };

    // Only run when authentication state is known
    if (isCheckingAuth === false) {
      loadData();
    }
  }, [isAuthenticated, isCheckingAuth]);

  const creditsUsagePercent =
    subscriptionStatus?.monthlyCredits && subscriptionStatus.monthlyCredits > 0
      ? Math.min(
        subscriptionStatus.totalCredits && subscriptionStatus.totalCredits > 0
          ? ((subscriptionStatus.monthlyCredits - (subscriptionStatus.creditsRemaining || 0)) / subscriptionStatus.monthlyCredits) * 100
          : 0,
        100
      )
      : 0;
  const creditsUsageStyle = {
    '--progress': `${creditsUsagePercent}%`,
  } as CSSProperties;

  const handleGetStarted = () => {
    window.history.pushState({}, '', '/');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#121212] text-zinc-300 pt-12 md:pt-14 relative">
      <div className="fixed inset-0 z-0">
        <GridDotsBackground />
      </div>
      <div className="max-w-2xl mx-auto px-4 pt-[30px] pb-16 md:pb-24 relative z-10">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-cyan/20 rounded-md blur-xl"></div>
              <CheckCircle size={80} className="text-brand-cyan relative" />
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold font-mono text-zinc-200 mb-4 uppercase">
            {t('thankYou.title')}
          </h1>

          <p className="text-zinc-400 font-mono text-base md:text-lg mb-2">
            {t('thankYou.subtitle')}
          </p>

          {isCheckingAuth || isLoading ? (
            <div className="flex items-center justify-center gap-2 mt-4">
              <GlitchLoader size={20} color="#52ddeb" />
            </div>
          ) : subscriptionStatus?.hasActiveSubscription ? (
            <div className="mt-6 inline-block bg-brand-cyan/10 border border-brand-cyan/30 rounded-md px-4 py-2">
              <p className="text-brand-cyan font-mono text-sm">
                {t('thankYou.subscriptionActive')}
              </p>
            </div>
          ) : null}
        </div>

        {subscriptionStatus?.hasActiveSubscription && (
          <div className="bg-zinc-900 border border-zinc-800/50 rounded-md p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Pickaxe size={24} className="text-brand-cyan" />
              <h2 className="text-xl font-semibold font-mono text-zinc-200">
                {t('thankYou.whatsNext')}
              </h2>
            </div>

            <ul className="space-y-3 text-sm text-zinc-300 font-mono">
              <li className="flex items-start gap-3">
                <CheckCircle size={18} className="text-brand-cyan mt-0.5 flex-shrink-0" />
                <span>
                  {t('thankYou.benefit1', {
                    credits: subscriptionStatus.monthlyCredits || 100
                  })}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle size={18} className="text-brand-cyan mt-0.5 flex-shrink-0" />
                <span>{t('thankYou.benefit2')}</span>
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle size={18} className="text-brand-cyan mt-0.5 flex-shrink-0" />
                <span>{t('thankYou.benefit3')}</span>
              </li>
            </ul>

            {subscriptionStatus.totalCredits !== undefined && (
              <div className="mt-6 pt-6 border-t border-zinc-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400 font-mono text-sm">
                    {t('thankYou.creditsAvailable')}
                  </span>
                  <span className="text-brand-cyan font-mono font-semibold">
                    {subscriptionStatus.totalCredits} credits
                  </span>
                </div>
                <div className="mt-2 bg-zinc-800 rounded-md h-2 overflow-hidden">
                  <div
                    className="h-full bg-brand-cyan transition-all duration-300 progress-fill"
                    style={creditsUsageStyle}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="text-center">
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center gap-2 px-6 py-3 bg-brand-cyan/80 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-colors cursor-pointer"
          >
            <span>{t('thankYou.getStarted')}</span>
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="mt-12 text-center">
          <p className="text-zinc-500 text-xs font-mono">
            {t('thankYou.support')}
          </p>
        </div>
      </div>
    </div>
  );
};

