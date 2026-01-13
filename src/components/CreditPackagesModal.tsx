import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CreditCard, Plus, Minus, Pickaxe, QrCode, Info, FileText } from 'lucide-react';
import type { CSSProperties } from 'react';
import { getUserLocale, formatPrice, type CurrencyInfo } from '@/utils/localeUtils';
import { CREDIT_PACKAGES, getCreditPackageLink, getCreditPackagePrice } from '@/utils/creditPackages';
import { useTranslation } from '@/hooks/useTranslation';
import { LinearGradientBackground } from './ui/LinearGradientBackground';
import type { SubscriptionStatus } from '../services/subscriptionService';

// Função para tocar som de clique
const playClickSound = () => {
  try {
    const audio = new Audio('/sounds/hihat.wav');
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Silenciosamente falha se o áudio não puder ser reproduzido
    });
  } catch (error) {
    // Silenciosamente falha se o áudio não estiver disponível
  }
};

// Hook para animação de contador
const useAnimatedCounter = (targetValue: number, duration: number = 500) => {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef<number>(targetValue);

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
  }, [targetValue, duration]);

  return displayValue;
};

interface CreditPackagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionStatus?: SubscriptionStatus | null;
  initialTab?: 'buy' | 'credits';
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return 'N/A';
  }
};

export const CreditPackagesModal: React.FC<CreditPackagesModalProps> = ({
  isOpen,
  onClose,
  subscriptionStatus = null,
  initialTab = 'buy'
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'buy' | 'credits'>(initialTab);

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    // Detect user locale
    const locale = getUserLocale();
    setCurrencyInfo(locale);
  }, []);

  const currentPackage = CREDIT_PACKAGES[selectedIndex];

  const handlePrevious = () => {
    if (selectedIndex > 0) {
      playClickSound();
      setSelectedIndex((prev) => prev - 1);
    }
  };

  const handleNext = () => {
    if (selectedIndex < CREDIT_PACKAGES.length - 1) {
      playClickSound();
      setSelectedIndex((prev) => prev + 1);
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  const handleBuyCredits = async () => {
    if (!currencyInfo || !currentPackage) return;

    // Flag no localStorage para detectar retorno do pagamento
    localStorage.setItem('credit_purchase_pending', JSON.stringify({
      timestamp: Date.now(),
      credits: currentPackage.credits,
    }));

    // Usar Payment Link diretamente
    const paymentLink = getCreditPackageLink(currentPackage.credits, currencyInfo.currency);
    if (!paymentLink) {
      console.error('Payment link not found for credits:', currentPackage.credits);
      return;
    }

    // Redireciona para o Payment Link do Stripe
    window.location.href = paymentLink;
  };

  // Links estáticos do AbacatePay para cada pacote de créditos
  const ABACATEPAY_LINKS: Record<number, string> = {
    20: 'https://www.abacatepay.com/pay/bill_TNSpGheWqrAxn3SDB4fFrtr5',
    50: 'https://www.abacatepay.com/pay/bill_6C3nzx6rNp4YkBkpbuS44qBf',
    100: 'https://www.abacatepay.com/pay/bill_RS6ytpErrsHZC42fdBtqXQ51',
    500: 'https://www.abacatepay.com/pay/bill_GSXJBRdEmgb1Mep4X5AtTFAn',
  };

  const handleBuyWithPix = () => {
    if (!currentPackage) return;

    const pixLink = ABACATEPAY_LINKS[currentPackage.credits];
    if (pixLink) {
      // Flag no localStorage para detectar retorno do pagamento
      localStorage.setItem('credit_purchase_pending', JSON.stringify({
        timestamp: Date.now(),
        credits: currentPackage.credits,
      }));

      window.open(pixLink, '_blank');
    }
  };

  if (!currentPackage) return null;

  const price = currencyInfo
    ? getCreditPackagePrice(currentPackage.credits, currencyInfo.currency)
    : 0;

  // Animated counter for credits (30% faster: 280ms instead of 400ms)
  const animatedCredits = useAnimatedCounter(currentPackage.credits, 280);

  // Animated counter for price (30% faster: 280ms instead of 400ms)
  const animatedPrice = useAnimatedCounter(price, 280);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="border border-zinc-800/50 rounded-md max-w-4xl w-full mx-4 relative max-h-[90vh] overflow-y-auto overflow-hidden">
        <div className="relative p-6 min-h-[100%]">
          <LinearGradientBackground className="rounded-md" fullHeight />
          <div className="relative z-10">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-300 transition-colors z-20"
            >
              <X size={20} />
            </button>

            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <CreditCard size={20} className="text-zinc-500" />
                <h2 className="text-base font-medium font-mono text-zinc-400">
                  {t('creditsPackages.title') || 'CREDITS'}
                </h2>
              </div>

              {/* Tabs */}
              <div className="flex gap-2 border-b border-zinc-800/50">
                <button
                  onClick={() => setActiveTab('buy')}
                  className={`px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'buy'
                    ? 'text-brand-cyan border-[brand-cyan]'
                    : 'text-zinc-500 border-transparent hover:text-zinc-400'
                    }`}
                >
                  {t('creditsPackages.buy') || 'Buy'}
                </button>
                {subscriptionStatus && (
                  <button
                    onClick={() => setActiveTab('credits')}
                    className={`px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors border-b-2 ${activeTab === 'credits'
                      ? 'text-brand-cyan border-[brand-cyan]'
                      : 'text-zinc-500 border-transparent hover:text-zinc-400'
                      }`}
                  >
                    {t('credits.title') || 'Credits'}
                  </button>
                )}
              </div>

              {/* Tab Content */}
              <div className="relative min-h-[400px] overflow-hidden">
                {activeTab === 'buy' && (
                  <div className="flex flex-col items-center justify-center py-8 animate-slide-in-right transition-all duration-300 ease-in-out">
                    {/* Package Selector */}
                    <div className="flex items-center justify-center mb-6">
                      {/* Current Package Display */}
                      <div className="bg-zinc-900 border border-zinc-800/30 rounded-xl p-6 md:p-10 min-w-[280px] md:min-w-[420px] text-center shadow-sm">
                        <div className="space-y-4">
                          <div>
                            {/* Credits Display with Pickaxe and +/- buttons */}
                            <div className="flex items-center justify-center gap-3 mb-3">
                              {/* Previous button */}
                              <button
                                onClick={handlePrevious}
                                disabled={selectedIndex === 0}
                                className={`p-2 md:p-2.5 transition-all duration-200 rounded-md active:scale-[0.95] ${selectedIndex === 0
                                  ? 'text-zinc-600 cursor-not-allowed opacity-50'
                                  : 'text-zinc-400 hover:text-brand-cyan hover:bg-zinc-800/50 hover:scale-110 cursor-pointer'
                                  }`}
                                aria-label="Previous package"
                              >
                                <Minus size={20} className="md:w-5 md:h-5" />
                              </button>

                              {/* Credits number */}
                              <div className="text-5xl md:text-6xl font-bold text-brand-cyan/80 font-mono">
                                {animatedCredits}
                              </div>

                              {/* Next button */}
                              <button
                                onClick={handleNext}
                                disabled={selectedIndex === CREDIT_PACKAGES.length - 1}
                                className={`p-2 md:p-2.5 transition-all duration-200 rounded-md active:scale-[0.95] ${selectedIndex === CREDIT_PACKAGES.length - 1
                                  ? 'text-zinc-600 cursor-not-allowed opacity-50'
                                  : 'text-zinc-400 hover:text-brand-cyan hover:bg-zinc-800/50 hover:scale-110 cursor-pointer'
                                  }`}
                                aria-label="Next package"
                              >
                                <Plus size={20} className="md:w-5 md:h-5" />
                              </button>
                            </div>

                            <div className="flex items-center justify-center gap-2 text-sm text-zinc-400 font-mono uppercase tracking-wider">
                              <Pickaxe
                                size={14}
                                className="md:w-4 md:h-4 text-brand-cyan/70 flex-shrink-0"
                              />
                              {t('creditsPackages.credits') || 'Credits'}
                            </div>
                          </div>

                          {currencyInfo && price > 0 && (
                            <div className="pt-4 border-t border-zinc-800/50">
                              <div className="flex items-center justify-center gap-2">
                                <div className="text-3xl font-bold text-zinc-200 font-mono">
                                  {formatPrice(animatedPrice, currencyInfo.currency, currencyInfo.locale)}
                                </div>
                                <div className="relative group">
                                  <Info
                                    size={14}
                                    className="text-zinc-500 hover:text-zinc-400 transition-colors cursor-help"
                                  />
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-zinc-300 bg-zinc-900/95 border border-zinc-700/50 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                    {t('pricing.oneTimePayment') || (currencyInfo.currency === 'BRL' ? 'Pagamento único' : 'One-time payment')}
                                  </div>
                                </div>
                              </div>
                              {currentPackage.credits > 0 && (
                                <div className="text-xs text-zinc-500 font-mono mt-2">
                                  {formatPrice(price / currentPackage.credits, currencyInfo.currency, currencyInfo.locale)} {currencyInfo.currency === 'BRL' ? 'por crédito' : 'per credit'}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex flex-col gap-2 mt-6">
                            <button
                              onClick={handleBuyCredits}
                              className="w-full px-6 py-3 bg-brand-cyan/80 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-[brand-cyan]/20"
                            >
                              <CreditCard size={16} />
                              {t('creditsPackages.buy') || 'Buy'}
                            </button>
                            {currencyInfo?.currency === 'BRL' && ABACATEPAY_LINKS[currentPackage.credits] && (
                              <button
                                onClick={handleBuyWithPix}
                                className="w-full px-6 py-3 bg-[#6fd591]/80 hover:bg-[#6fd591] text-white font-semibold rounded-md text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-[#6fd591]/20"
                              >
                                <QrCode size={16} />
                                {t('pix.payWithPix') || 'Pagar com PIX'}
                              </button>
                            )}

                            <button
                              onClick={() => {
                                onClose();
                                navigate('/pricing');
                              }}
                              className="w-full mt-2 px-6 py-2 text-zinc-500 hover:text-brand-cyan text-xs font-mono transition-colors flex items-center justify-center gap-2 hover:bg-zinc-800/30 rounded-md"
                            >
                              {t('creditsPackages.viewPlans') || 'View Subscription Plans'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Package Indicator */}
                    <div className="flex gap-2 mb-6">
                      {CREDIT_PACKAGES.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedIndex(index)}
                          className={`h-2 rounded-md transition-all duration-300 ease-out ${index === selectedIndex
                            ? 'bg-brand-cyan w-8 shadow-[0_0_8px_rgba(82,221,235,0.4)]'
                            : 'bg-zinc-600 hover:bg-zinc-500 w-2 hover:scale-125'
                            }`}
                          aria-label={`Select ${CREDIT_PACKAGES[index].credits} credits package`}
                        />
                      ))}
                    </div>

                    <div className="text-xs text-zinc-300 font-mono text-center max-w-md">
                      {t('creditsPackages.note') || 'Credits never expire and can be used at any time'}
                    </div>
                  </div>
                )}

                {/* Credits Tab Content */}
                {activeTab === 'credits' && subscriptionStatus && (() => {
                  const {
                    hasActiveSubscription,
                    subscriptionTier,
                    monthlyCredits,
                    creditsUsed,
                    creditsRemaining,
                    creditsResetDate,
                    totalCreditsEarned,
                    totalCredits,
                  } = subscriptionStatus;

                  // Calculate total credits available
                  const totalCreditsAvailable = typeof totalCredits === 'number'
                    ? totalCredits
                    : ((totalCreditsEarned ?? 0) + (creditsRemaining ?? 0));

                  const creditsPercentage = monthlyCredits > 0
                    ? Math.round((creditsUsed / monthlyCredits) * 100)
                    : 0;

                  const monthlyUsageStyle = {
                    '--progress': `${Math.min(creditsPercentage, 100)}%`,
                  } as CSSProperties;

                  return (
                    <div className="flex flex-col items-center justify-center py-8 animate-slide-in-left transition-all duration-300 ease-in-out">
                      {/* Available Credits Box */}
                      <div className="bg-zinc-900 border border-zinc-800/30 rounded-xl p-6 md:p-10 min-w-[280px] md:min-w-[420px] text-center shadow-sm mb-8">
                        <div className="space-y-4">
                          <div>
                            {/* Credits Display */}
                            <div className="flex items-center justify-center mb-3">
                              <div className="text-5xl md:text-6xl font-bold text-brand-cyan/80 font-mono">
                                {totalCreditsAvailable}
                              </div>
                            </div>

                            <div className="flex items-center justify-center gap-2 text-sm text-zinc-400 font-mono uppercase tracking-wider">
                              <Pickaxe
                                size={14}
                                className="md:w-4 md:h-4 text-brand-cyan/70 flex-shrink-0"
                              />
                              {t('credits.available')}
                            </div>
                          </div>

                          {/* Reset Date */}
                          {creditsResetDate && (
                            <div className="pt-4 border-t border-zinc-800/50">
                              <div className="text-xs font-mono text-zinc-400 text-center">
                                {hasActiveSubscription
                                  ? t('credits.renews', { date: formatDate(creditsResetDate) })
                                  : t('credits.resets', { date: formatDate(creditsResetDate) })}
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex flex-col gap-2 mt-6">
                            <button
                              onClick={() => {
                                onClose();
                                navigate('/profile');
                                // Scroll to usage history section after navigation
                                setTimeout(() => {
                                  const section = document.getElementById('usage-history-section');
                                  if (section) {
                                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                  }
                                }, 300);
                              }}
                              className="w-full px-6 py-3 bg-zinc-800/50 hover:bg-zinc-800/70 border border-zinc-700/50 hover:border-zinc-600/50 text-zinc-300 font-semibold rounded-md text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                            >
                              <FileText size={16} />
                              {t('usageHistory.title') || 'Usage History'}
                            </button>
                            <button
                              onClick={() => setActiveTab('buy')}
                              className="w-full px-6 py-3 bg-brand-cyan/80 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-[brand-cyan]/20"
                            >
                              <CreditCard size={16} />
                              {t('credits.buyCredits')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
