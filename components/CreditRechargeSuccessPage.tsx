import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle, Pickaxe, ArrowRight, Loader2 } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { useLayout } from '../hooks/useLayout';
import { subscriptionService } from '../services/subscriptionService';
import { authService } from '../services/authService';
import type { SubscriptionStatus } from '../services/subscriptionService';
import { GridDotsBackground } from './ui/GridDotsBackground';

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
      const currentValue = Math.round(startValueRef.current + (targetValue - startValueRef.current) * easeOutCubic);

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

    let pollCreditsInterval: NodeJS.Timeout | null = null;

    const loadData = async () => {
      // Wait for auth check to complete
      if (isCheckingAuth) {
        return;
      }

      if (isAuthenticated === true) {
        // User is authenticated, load subscription status
        try {
          const status = await subscriptionService.getSubscriptionStatus();
          const startingCredits = status.totalCreditsEarned ?? 0;
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
                  console.log('✅ Credits updated successfully:', {
                    initial: startingCredits,
                    updated: currentCredits,
                    added: currentCredits - startingCredits,
                  });
                  if (pollCreditsInterval) clearInterval(pollCreditsInterval);
                  setSubscriptionStatus(status);
                  setIsVerifyingCredits(false);
                  return;
                }
                
                // If we've polled max times, stop polling
                if (pollCount >= maxPolls) {
                  console.log('⏱️ Credit update polling timeout - webhook may still be processing');
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
  const animatedCreditsPurchased = useCountAnimation(creditsConfirmed && creditsPurchased ? creditsPurchased : 0, 1000);
  const animatedTotalCredits = useCountAnimation(creditsConfirmed ? totalCredits : 0, 1200);

  return (
    <div className="min-h-screen bg-black text-zinc-300 pt-12 md:pt-14 relative">
      <div className="fixed inset-0 z-0">
        <GridDotsBackground />
      </div>
      <div className="max-w-2xl mx-auto px-4 py-12 md:py-20 relative z-10">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-[#52ddeb]/20 rounded-md blur-xl"></div>
              <CheckCircle size={80} className="text-[#52ddeb] relative" />
            </div>
          </div>
          
          <h1 className="text-4xl md:text-5xl font-bold font-mono text-zinc-200 mb-4 uppercase">
            {t('creditRechargeSuccess.title')}
          </h1>
          
          <p className="text-zinc-400 font-mono text-base md:text-lg mb-2">
            {t('creditRechargeSuccess.subtitle')}
          </p>
          
          {isCheckingAuth || isLoading ? (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Loader2 size={20} className="animate-spin text-[#52ddeb]" />
            </div>
          ) : isVerifyingCredits ? (
            <div className="flex items-center justify-center gap-2 mt-4">
              <Loader2 size={20} className="animate-spin text-[#52ddeb]" />
              <span className="text-zinc-500 text-sm font-mono">
                {t('creditRechargeSuccess.verifying')}
              </span>
            </div>
          ) : null}
        </div>

        {creditsConfirmed && (
          <div className="bg-black/95 backdrop-blur-xl border border-zinc-800/50 rounded-md p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Pickaxe size={24} className="text-[#52ddeb]" />
              <h2 className="text-xl font-semibold font-mono text-zinc-200">
                {t('creditRechargeSuccess.creditsPurchased')}
              </h2>
            </div>

            {creditsPurchased && creditsConfirmed && (
              <div className="mb-6">
                <div className="text-center py-4 bg-[#52ddeb]/10 border border-[#52ddeb]/30 rounded-md">
                  <div className="text-5xl font-bold font-mono text-[#52ddeb] mb-2">
                    +{animatedCreditsPurchased}
                  </div>
                  <div className="text-zinc-400 font-mono text-sm">
                    {t('creditRechargeSuccess.creditsPurchased')}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-zinc-800/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-zinc-400 font-mono text-sm">
                  {t('creditRechargeSuccess.totalCredits')}
                </span>
                <span className="text-[#52ddeb] font-mono font-semibold text-lg">
                  {animatedTotalCredits} {t('creditsPackages.credits')}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={handleGetStarted}
            className="inline-flex items-center gap-2 px-6 py-3 bg-[#52ddeb]/80 hover:bg-[#52ddeb] text-black font-semibold rounded-md text-sm font-mono transition-colors"
          >
            <span>{t('creditRechargeSuccess.getStarted')}</span>
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="mt-12 text-center">
          <p className="text-zinc-500 text-xs font-mono">
            {t('creditRechargeSuccess.support')}
          </p>
        </div>
      </div>
    </div>
  );
};

