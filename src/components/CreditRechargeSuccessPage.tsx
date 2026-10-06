import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle, Pickaxe, ArrowRight } from '@/lib/ui/icons';
import { GlitchLoader } from './ui/GlitchLoader';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { subscriptionService } from '../services/subscriptionService';
import { authService } from '../services/authService';
import type { SubscriptionStatus } from '../services/subscriptionService';
import { Button } from '@/components/ui/button';
import { trackPurchase } from '@/utils/analytics';

// Hook para animação de contador
const useCountAnimation = (targetValue: number, duration: number = 800) => {
  const [displayValue, setDisplayValue] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef<number>(0);

  useEffect(() => {
    if (targetValue === displayValue) return;

    startValueRef.current = displayValue;
    startTimeRef.current = null;

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (easeOutCubic)
      const easeOutCubic = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(
        startValueRef.current + (targetValue - startValueRef.current) * easeOutCubic
      );

      setDisplayValue(currentValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValue);
      }
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetValue, duration, displayValue]);

  return displayValue;
};

export const CreditRechargeSuccessPage: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated, isCheckingAuth } = useLayout(); // Usar estado de autenticação do contexto centralizado
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifyingCredits, setIsVerifyingCredits] = useState(true);
  const [creditsPurchased, setCreditsPurchased] = useState<number | null>(null);
  const [previousCredits, setPreviousCredits] = useState<number | null>(null);

  useEffect(() => {
    // Get credits from URL query parameter
    const urlParams = new URLSearchParams(window.location.search);
    const creditsParam = urlParams.get('credits');

    let purchasedCredits: number | null = null;
    if (creditsParam) {
      const credits = parseInt(creditsParam, 10);
      if (!isNaN(credits) && credits > 0) {
        purchasedCredits = credits;
        setCreditsPurchased(credits);
      }
    }

    let pollCreditsInterval: ReturnType<typeof setInterval> | null = null;

    const loadData = async () => {
      // Wait for auth check to complete
      if (isCheckingAuth) {
        return;
      }

      if (isAuthenticated === true) {
        // User is authenticated, load subscription status
        try {
          const status = await subscriptionService.getSubscriptionStatus();
          // Detection compares lifetime earned credits; the "before" row shows the
          // balance so it lines up with the "total" row (both totalCredits).
          const startingCredits = status.totalCreditsEarned ?? 0;
          setPreviousCredits(status.totalCredits ?? 0);
          setSubscriptionStatus(status);
          setIsLoading(false);

          // Start polling to verify credits were added
          if (purchasedCredits) {
            setIsVerifyingCredits(true);

            let pollCount = 0;
            const maxPolls = 10; // 10 polls * 1 second = 10 seconds total
            const pollInterval = 1000; // 1 second

            pollCreditsInterval = setInterval(async () => {
              pollCount++;

              try {
                const status = await subscriptionService.getSubscriptionStatus();
                const currentCredits = status.totalCreditsEarned ?? 0;

                // If credits increased, payment was successful
                if (currentCredits > startingCredits) {
                  const added = currentCredits - startingCredits;
                  // Track Purchase in Himetrica
                  trackPurchase({
                    product_id: `recharge_${added}_credits`,
                    price: 0, // In this page we don't have the price, but we track the event
                    credits: added,
                  });

                  if (pollCreditsInterval) clearInterval(pollCreditsInterval);
                  setSubscriptionStatus(status);
                  setIsVerifyingCredits(false);
                  return;
                }

                // If we've polled max times, stop polling
                if (pollCount >= maxPolls) {
                  if (pollCreditsInterval) clearInterval(pollCreditsInterval);
                  setIsVerifyingCredits(false);
                  // Update status anyway (webhook might have processed)
                  setSubscriptionStatus(status);
                } else {
                  // Update status even if credits haven't increased yet
                  setSubscriptionStatus(status);
                }
              } catch (error) {
                console.error('Error polling credits status:', error);
                if (pollCreditsInterval) clearInterval(pollCreditsInterval);
                setIsVerifyingCredits(false);
              }
            }, pollInterval);
          } else {
            setIsVerifyingCredits(false);
          }
        } catch (error) {
          console.error('Failed to load subscription status:', error);
          setIsLoading(false);
          setIsVerifyingCredits(false);
        }
      } else {
        // Not authenticated - still show page but without credit details
        setIsLoading(false);
        setIsVerifyingCredits(false);
      }
    };

    // Only run when authentication state is known
    if (isCheckingAuth === false) {
      loadData();
    }

    // Cleanup function
    return () => {
      if (pollCreditsInterval) {
        clearInterval(pollCreditsInterval);
      }
    };
  }, [isAuthenticated, isCheckingAuth]);

  const handleGetStarted = () => {
    window.history.pushState({}, '', '/');
    window.location.reload();
  };

  const totalCredits = subscriptionStatus?.totalCredits ?? 0;
  const creditsConfirmed = !isVerifyingCredits && subscriptionStatus !== null;

  // Animated values - only animate when credits are confirmed
  const animatedCreditsPurchased = useCountAnimation(
    creditsConfirmed && creditsPurchased ? creditsPurchased : 0,
    1000
  );
  const animatedTotalCredits = useCountAnimation(creditsConfirmed ? totalCredits : 0, 1200);

  return (
    <div className="min-h-screen bg-background text-foreground pt-12 md:pt-14">
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-20">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <CheckCircle size={64} className="text-success" />
          </div>

          <h1 className="text-3xl md:text-4xl font-medium text-foreground mb-4">
            {t('creditRechargeSuccess.title')}
          </h1>

          <p className="text-muted-foreground text-base md:text-lg mb-2">
            {t('creditRechargeSuccess.subtitle')}
          </p>

          {isCheckingAuth || isLoading ? (
            <div className="flex items-center justify-center gap-2 mt-4">
              <GlitchLoader size={20} />
            </div>
          ) : isVerifyingCredits ? (
            <div className="flex items-center justify-center gap-2 mt-4">
              <GlitchLoader size={20} />
              <span className="text-muted-foreground text-sm">
                {t('creditRechargeSuccess.verifying')}
              </span>
            </div>
          ) : null}
        </div>

        {creditsConfirmed && (
          <div className="bg-card border border-border rounded-md p-6 mb-8">
            <div className="flex items-center gap-3 mb-6">
              <Pickaxe size={20} className="text-muted-foreground" />
              <h2 className="text-lg font-medium text-foreground">
                {t('creditRechargeSuccess.creditsPurchased')}
              </h2>
            </div>

            {creditsPurchased && (
              <div className="mb-6 text-center py-4 bg-muted border border-border rounded-md">
                <div className="text-5xl font-semibold text-foreground tabular-nums">
                  +{animatedCreditsPurchased}
                </div>
              </div>
            )}

            <div className="space-y-3 pt-6 border-t border-border">
              {previousCredits !== null && (
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-md">
                  <span className="text-muted-foreground text-sm">
                    {t('creditRechargeSuccess.previousCredits')}
                  </span>
                  <span className="text-foreground font-medium text-lg tabular-nums">
                    {previousCredits} {t('creditsPackages.credits')}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between p-3 bg-muted/60 border border-border rounded-md">
                <span className="text-foreground text-sm font-medium">
                  {t('creditRechargeSuccess.totalCredits')}
                </span>
                <span className="text-foreground font-semibold text-xl tabular-nums">
                  {animatedTotalCredits} {t('creditsPackages.credits')}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="text-center">
          <Button variant="brand" onClick={handleGetStarted} className="px-6">
            <span>{t('creditRechargeSuccess.getStarted')}</span>
            <ArrowRight size={16} />
          </Button>
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground text-xs">{t('creditRechargeSuccess.support')}</p>
        </div>
      </div>
    </div>
  );
};
