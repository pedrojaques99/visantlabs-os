import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CreditCard, Plus, Minus, Pickaxe, QrCode, Info, FileText, CheckCircle2 } from 'lucide-react';
import type { CSSProperties } from 'react';
import { getUserLocale, formatPrice, type CurrencyInfo } from '@/utils/localeUtils';
import { CREDIT_PACKAGES, getCreditPackageLink, getCreditPackagePrice } from '@/utils/creditPackages';
import { useTranslation } from '@/hooks/useTranslation';
import { LinearGradientBackground } from './ui/LinearGradientBackground';
import type { SubscriptionStatus } from '../services/subscriptionService';
import { productService, type Product } from '../services/productService';
import { Badge } from './ui/badge';
import { Button } from './ui/button';

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
  const [buySection, setBuySection] = useState<'credits' | 'subscriptions'>('credits');
  const [subscriptionPlans, setSubscriptionPlans] = useState<Product[]>([]);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

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

  useEffect(() => {
    // Fetch subscription plans
    productService.getSubscriptionPlans().then(plans => {
      if (plans.length > 0) {
        setSubscriptionPlans(plans);
      }
    });
  }, []);

  // Filter plans by billing cycle
  const filteredPlans = subscriptionPlans.filter(plan => {
    const isYearly = plan.metadata?.interval === 'year' ||
      plan.name.toLowerCase().includes('anual') ||
      plan.name.toLowerCase().includes('yearly');
    return billingCycle === 'yearly' ? isYearly : !isYearly;
  });

  // Reset selected plan index when billing cycle changes
  useEffect(() => {
    if (filteredPlans.length > 0) {
      setSelectedPlanIndex(0);
    }
  }, [billingCycle]);

  const handlePreviousPlan = () => {
    if (selectedPlanIndex > 0) {
      playClickSound();
      setSelectedPlanIndex((prev) => prev - 1);
    }
  };

  const handleNextPlan = () => {
    if (selectedPlanIndex < filteredPlans.length - 1) {
      playClickSound();
      setSelectedPlanIndex((prev) => prev + 1);
    }
  };

  const currentPlan = filteredPlans[selectedPlanIndex];

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-2 sm:p-4">
      <div className="border border-neutral-800/50 rounded-md w-full mx-auto relative min-h-[500px] sm:min-h-[600px] md:min-h-[700px] max-h-[98vh] sm:max-h-[95vh] md:max-h-[90vh] overflow-y-auto overflow-x-hidden flex flex-col">
        <LinearGradientBackground className="rounded-md" fullHeight />
        <div className="relative p-4 sm:p-6 z-10 flex-1">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 sm:top-4 sm:right-4 text-neutral-500 hover:text-neutral-300 transition-colors z-20 p-1"
          >
            <X size={18} className="sm:w-5 sm:h-5" />
          </button>

          <div className="space-y-4 sm:space-y-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <CreditCard size={18} className="sm:w-5 sm:h-5 text-neutral-500" />
              <h2 className="text-sm sm:text-base font-medium font-mono text-neutral-400">
                {t('creditsPackages.title') || 'CREDITS'}
              </h2>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-2 bg-neutral-900/50 p-1 rounded-lg border border-neutral-800/50">
              <button
                onClick={() => {
                  playClickSound();
                  setActiveTab('credits');
                }}
                className={`px-3 sm:px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all rounded-md ${activeTab === 'credits'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-300'
                  }`}
              >
                {t('credits.title') || 'Créditos'}
              </button>

              <button
                onClick={() => {
                  playClickSound();
                  setActiveTab('buy');
                }}
                className={`px-3 sm:px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all rounded-md ${activeTab === 'buy'
                  ? 'bg-neutral-800 text-white shadow-sm'
                  : 'text-neutral-500 hover:text-neutral-300'
                  }`}
              >
                {t('creditsPackages.buy') || 'Comprar'}
              </button>
            </div>

            {/* Tab Content */}
            <div className="relative min-h-[400px] sm:min-h-[500px] overflow-hidden">
              {activeTab === 'buy' && (
                <div className="py-4 sm:py-6 animate-slide-in-right transition-all duration-300 ease-in-out">
                  {/* Sub-tabs for Buy section */}
                  <div className="flex justify-center mb-6">
                    <div className="grid grid-cols-2 bg-neutral-900/50 p-1 rounded-lg border border-neutral-800/50 w-full max-w-xs">
                      <button
                        onClick={() => {
                          playClickSound();
                          setBuySection('credits');
                        }}
                        className={`px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all rounded-md ${buySection === 'credits'
                          ? 'bg-neutral-800 text-white shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-300'
                          }`}
                      >
                        {t('creditsPackages.credits') || 'Créditos'}
                      </button>
                      <button
                        onClick={() => {
                          playClickSound();
                          setBuySection('subscriptions');
                        }}
                        className={`px-4 py-2 text-xs font-mono uppercase tracking-wider transition-all rounded-md ${buySection === 'subscriptions'
                          ? 'bg-neutral-800 text-white shadow-sm'
                          : 'text-neutral-500 hover:text-neutral-300'
                          }`}
                      >
                        {t('pricing.tabs.subscriptions') || 'Assinaturas'}
                      </button>
                    </div>
                  </div>

                  {/* Credits Section */}
                  {buySection === 'credits' && (
                    <div className="flex flex-col items-center justify-center py-4 sm:py-8 animate-fade-in transition-all duration-300 ease-in-out">
                      {/* Package Selector */}
                      <div className="flex items-center justify-center mb-4 sm:mb-6 w-full">
                        {/* Current Package Display */}
                        <div className="bg-neutral-900 border border-neutral-800/30 rounded-xl p-4 sm:p-6 md:p-10 w-full max-w-[280px] sm:max-w-[420px] text-center shadow-sm">
                      <div className="space-y-4">
                        <div>
                          {/* Credits Display with Pickaxe and +/- buttons */}
                          <div className="flex items-center justify-center gap-3 mb-3">
                            {/* Previous button */}
                            <button
                              onClick={() => {
                                playClickSound();
                                handlePrevious();
                              }}
                              disabled={selectedIndex === 0}
                              className={`p-1.5 sm:p-2 md:p-2.5 transition-all duration-200 rounded-md active:scale-[0.95] ${selectedIndex === 0
                                ? 'text-neutral-600 cursor-not-allowed opacity-50'
                                : 'text-neutral-400 hover:text-brand-cyan hover:bg-neutral-800/50 hover:scale-110 cursor-pointer'
                                }`}
                              aria-label="Previous package"
                            >
                              <Minus size={18} className="sm:w-5 sm:h-5 md:w-5 md:h-5" />
                            </button>

                            {/* Credits number */}
                            <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-brand-cyan/80 font-mono">
                              {animatedCredits}
                            </div>

                            {/* Next button */}
                            <button
                              onClick={() => {
                                playClickSound();
                                handleNext();
                              }}
                              disabled={selectedIndex === CREDIT_PACKAGES.length - 1}
                              className={`p-1.5 sm:p-2 md:p-2.5 transition-all duration-200 rounded-md active:scale-[0.95] ${selectedIndex === CREDIT_PACKAGES.length - 1
                                ? 'text-neutral-600 cursor-not-allowed opacity-50'
                                : 'text-neutral-400 hover:text-brand-cyan hover:bg-neutral-800/50 hover:scale-110 cursor-pointer'
                                }`}
                              aria-label="Next package"
                            >
                              <Plus size={18} className="sm:w-5 sm:h-5 md:w-5 md:h-5" />
                            </button>
                          </div>

                          <div className="flex items-center justify-center gap-2 text-sm text-neutral-400 font-mono uppercase tracking-wider">
                            <Pickaxe
                              size={14}
                              className="md:w-4 md:h-4 text-brand-cyan/70 flex-shrink-0"
                            />
                            {t('creditsPackages.credits') || 'Credits'}
                          </div>
                        </div>

                        {currencyInfo && price > 0 && (
                          <div className="pt-4 border-t border-neutral-800/50">
                            <div className="flex items-center justify-center gap-2">
                              <div className="text-2xl sm:text-3xl font-bold text-neutral-200 font-mono">
                                {formatPrice(animatedPrice, currencyInfo.currency, currencyInfo.locale)}
                              </div>
                              <div className="relative group">
                                <Info
                                  size={14}
                                  className="text-neutral-500 hover:text-neutral-400 transition-colors cursor-help"
                                />
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-neutral-300 bg-neutral-900/95 border border-neutral-700/50 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                  {t('pricing.oneTimePayment') || (currencyInfo.currency === 'BRL' ? 'Pagamento único' : 'One-time payment')}
                                </div>
                              </div>
                            </div>
                            {currentPackage.credits > 0 && (
                              <div className="text-xs text-neutral-500 font-mono mt-2">
                                {formatPrice(price / currentPackage.credits, currencyInfo.currency, currencyInfo.locale)} {currencyInfo.currency === 'BRL' ? 'por crédito' : 'per credit'}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex flex-col gap-2 mt-4 sm:mt-6">
                          <button
                            onClick={() => {
                              playClickSound();
                              handleBuyCredits();
                            }}
                            className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-brand-cyan/80 hover:bg-brand-cyan text-black font-semibold rounded-md text-xs sm:text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-[brand-cyan]/20"
                          >
                            <CreditCard size={14} className="sm:w-4 sm:h-4" />
                            {t('creditsPackages.buy') || 'Comprar'}
                          </button>
                          {currencyInfo?.currency === 'BRL' && ABACATEPAY_LINKS[currentPackage.credits] && (
                            <button
                              onClick={() => {
                                playClickSound();
                                handleBuyWithPix();
                              }}
                              className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-[#6fd591]/80 hover:bg-[#6fd591] text-white font-semibold rounded-md text-xs sm:text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-[#6fd591]/20"
                            >
                              <QrCode size={14} className="sm:w-4 sm:h-4" />
                              {t('pix.payWithPix') || 'Pagar com PIX'}
                            </button>
                          )}

                          <button
                            onClick={() => {
                              playClickSound();
                              setBuySection('subscriptions');
                            }}
                            className="w-full mt-2 px-4 sm:px-6 py-2 text-neutral-500 hover:text-brand-cyan text-xs font-mono transition-colors flex items-center justify-center gap-2 hover:bg-neutral-800/30 rounded-md"
                          >
                            {t('pricing.tabs.subscriptions') || 'Ver Assinaturas'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                      {/* Package Indicator */}
                      <div className="flex gap-2 mb-4 sm:mb-6 justify-center">
                        {CREDIT_PACKAGES.map((_, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              playClickSound();
                              setSelectedIndex(index);
                            }}
                            className={`h-2 rounded-md transition-all duration-300 ease-out ${index === selectedIndex
                              ? 'bg-brand-cyan w-8 shadow-[0_0_8px_rgba(82,221,235,0.4)]'
                              : 'bg-neutral-600 hover:bg-neutral-500 w-2 hover:scale-125'
                              }`}
                            aria-label={`Select ${CREDIT_PACKAGES[index].credits} credits package`}
                          />
                        ))}
                      </div>

                      <div className="text-xs text-neutral-300 font-mono text-center max-w-md px-4">
                        {t('creditsPackages.note') || 'Credits never expire and can be used at any time'}
                      </div>
                    </div>
                  )}

                  {/* Subscriptions Section */}
                  {buySection === 'subscriptions' && (
                    <div className="py-4 sm:py-6 animate-fade-in transition-all duration-300 ease-in-out">
                      {/* Billing Cycle Toggle */}
                      <div className="flex justify-center mb-6 sm:mb-8">
                        <div className="bg-neutral-900/50 p-1 rounded-full border border-neutral-800 inline-flex relative">
                          <div
                            className={`absolute inset-y-1 rounded-full bg-brand-cyan transition-all duration-300 ease-out ${
                              billingCycle === 'monthly' ? "left-1 w-[calc(50%-4px)]" : "left-[50%] w-[calc(50%-4px)]"
                            }`}
                          />
                          <button
                            onClick={() => {
                              playClickSound();
                              setBillingCycle('monthly');
                            }}
                            className={`relative z-10 px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-colors duration-200 min-w-[80px] sm:min-w-[100px] ${
                              billingCycle === 'monthly' ? "text-black font-bold" : "text-neutral-400 hover:text-neutral-200"
                            }`}
                          >
                            {t('pricing.monthly') || 'Mensal'}
                          </button>
                          <button
                            onClick={() => {
                              playClickSound();
                              setBillingCycle('yearly');
                            }}
                            className={`relative z-10 px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-full transition-colors duration-200 min-w-[80px] sm:min-w-[100px] flex items-center justify-center gap-1 sm:gap-2 ${
                              billingCycle === 'yearly' ? "text-black font-bold" : "text-neutral-400 hover:text-neutral-200"
                            }`}
                          >
                            {t('pricing.yearly') || 'Anual'}
                            <span className={`text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                              billingCycle === 'yearly' ? "bg-black/20 text-black" : "bg-brand-cyan/20 text-brand-cyan"
                            }`}>
                              {t('pricing.yearlyDiscount') || '-16%'}
                            </span>
                          </button>
                        </div>
                      </div>

                      {filteredPlans.length > 0 && currentPlan ? (
                        <div className="flex flex-col items-center justify-center">
                          {/* Plan Display */}
                          <div className="flex items-center justify-center mb-4 sm:mb-6 w-full">
                            <div className="bg-neutral-900/40 border border-neutral-800/50 rounded-xl p-4 sm:p-6 md:p-8 w-full max-w-[320px] sm:max-w-[420px] text-center shadow-sm relative overflow-hidden group">
                              <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                              
                              {/* Popular Badge */}
                              {currentPlan.displayOrder === 1 && (
                                <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10">
                                  <Badge className="bg-brand-cyan text-black font-bold text-[9px] sm:text-[10px] uppercase tracking-widest px-2 sm:px-3 py-0.5 rounded-full">
                                    {t('pricing.popular') || 'Popular'}
                                  </Badge>
                                </div>
                              )}

                              <div className="relative z-10 space-y-4 sm:space-y-6">
                                {/* Plan Name */}
                                <div>
                                  <h3 className="text-xl sm:text-2xl font-bold text-neutral-100 tracking-tight mt-2">
                                    {currentPlan.name}
                                  </h3>
                                </div>

                                {/* Price */}
                                <div className="text-center">
                                  <div className="flex items-baseline justify-center gap-1">
                                    <span className="text-3xl sm:text-4xl font-bold text-brand-cyan font-mono">
                                      {formatPrice(
                                        currencyInfo?.currency === 'USD' && currentPlan.priceUSD ? currentPlan.priceUSD : currentPlan.priceBRL,
                                        currencyInfo?.currency || 'BRL',
                                        currencyInfo?.locale || 'pt-BR'
                                      )}
                                    </span>
                                    <span className="text-neutral-500 text-xs sm:text-sm font-mono">
                                      {billingCycle === 'yearly' ? (t('pricing.perYear') || '/ano') : t('pricing.perMonth') || '/mês'}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-center gap-1.5 text-[10px] sm:text-[11px] text-neutral-400 font-mono mt-2 uppercase tracking-wider">
                                    <Pickaxe size={10} className="sm:w-3 sm:h-3 text-brand-cyan/60" />
                                    <span>{currentPlan.credits} {t('pricing.creditsLabel') || 'créditos'}</span>
                                  </div>
                                </div>

                                {/* Plan Benefits */}
                                <div className="space-y-2 sm:space-y-3 text-left">
                                  {currentPlan.metadata?.features && Array.isArray(currentPlan.metadata.features) ? (
                                    currentPlan.metadata.features.slice(0, 4).map((benefit: string, idx: number) => (
                                      <div key={idx} className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-neutral-400">
                                        <CheckCircle2 size={14} className="sm:w-4 sm:h-4 text-brand-cyan mt-0.5 flex-shrink-0" />
                                        <span>{benefit.trim()}</span>
                                      </div>
                                    ))
                                  ) : currentPlan.description ? (
                                    currentPlan.description.split(',').slice(0, 4).map((benefit: string, idx: number) => (
                                      <div key={idx} className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm text-neutral-400">
                                        <CheckCircle2 size={14} className="sm:w-4 sm:h-4 text-brand-cyan mt-0.5 flex-shrink-0" />
                                        <span>{benefit.trim()}</span>
                                      </div>
                                    ))
                                  ) : null}
                                </div>

                                {/* Subscribe Button */}
                                <div className="pt-2 sm:pt-4">
                                  <Button
                                    onClick={() => {
                                      playClickSound();
                                      const link = currencyInfo?.currency === 'USD' ? currentPlan.paymentLinkUSD : currentPlan.paymentLinkBRL;
                                      if (link) window.location.href = link;
                                    }}
                                    className="w-full bg-brand-cyan hover:bg-brand-cyan/90 text-black font-bold h-10 sm:h-11 rounded-lg transition-transform hover:scale-[1.02] active:scale-[0.98] text-xs sm:text-sm"
                                    size="lg"
                                  >
                                    <CreditCard className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                    {t('pricing.subscribe') || 'Assinar'}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Navigation Arrows */}
                          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                            <button
                              onClick={handlePreviousPlan}
                              disabled={selectedPlanIndex === 0}
                              className={`p-1.5 sm:p-2 md:p-2.5 transition-all duration-200 rounded-md active:scale-[0.95] ${
                                selectedPlanIndex === 0
                                  ? 'text-neutral-600 cursor-not-allowed opacity-50'
                                  : 'text-neutral-400 hover:text-brand-cyan hover:bg-neutral-800/50 hover:scale-110 cursor-pointer'
                              }`}
                              aria-label="Previous plan"
                            >
                              <Minus size={18} className="sm:w-5 sm:h-5 md:w-5 md:h-5" />
                            </button>

                            {/* Plan Indicator */}
                            <div className="flex gap-1.5 sm:gap-2">
                              {filteredPlans.map((_, index) => (
                                <button
                                  key={index}
                                  onClick={() => {
                                    playClickSound();
                                    setSelectedPlanIndex(index);
                                  }}
                                  className={`h-2 rounded-md transition-all duration-300 ease-out ${
                                    index === selectedPlanIndex
                                      ? 'bg-brand-cyan w-8 shadow-[0_0_8px_rgba(82,221,235,0.4)]'
                                      : 'bg-neutral-600 hover:bg-neutral-500 w-2 hover:scale-125'
                                  }`}
                                  aria-label={`Select plan ${index + 1}`}
                                />
                              ))}
                            </div>

                            <button
                              onClick={handleNextPlan}
                              disabled={selectedPlanIndex === filteredPlans.length - 1}
                              className={`p-1.5 sm:p-2 md:p-2.5 transition-all duration-200 rounded-md active:scale-[0.95] ${
                                selectedPlanIndex === filteredPlans.length - 1
                                  ? 'text-neutral-600 cursor-not-allowed opacity-50'
                                  : 'text-neutral-400 hover:text-brand-cyan hover:bg-neutral-800/50 hover:scale-110 cursor-pointer'
                              }`}
                              aria-label="Next plan"
                            >
                              <Plus size={18} className="sm:w-5 sm:h-5 md:w-5 md:h-5" />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-12 sm:py-20 text-neutral-600 font-mono italic text-sm sm:text-base">
                          {t('pricing.noPlansFound') || 'Nenhum plano disponível no momento.'}
                        </div>
                      )}
                    </div>
                  )}
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
                  <div className="flex flex-col items-center justify-center py-4 sm:py-8 animate-slide-in-left transition-all duration-300 ease-in-out">
                    {/* Available Credits Box */}
                    <div className="bg-black/20 backdrop-blur-sm border border-neutral-800/30 rounded-xl p-4 sm:p-6 md:p-10 w-full max-w-[280px] sm:max-w-[420px] text-center shadow-sm mb-6 sm:mb-8">
                      <div className="space-y-4">
                        <div>
                          {/* Credits Display */}
                          <div className="flex items-center justify-center mb-3">
                            <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-brand-cyan/80 font-mono">
                              {totalCreditsAvailable}
                            </div>
                          </div>

                          <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-neutral-400 font-mono uppercase tracking-wider">
                            <Pickaxe
                              size={12}
                              className="sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-brand-cyan/70 flex-shrink-0"
                            />
                            {t('credits.available')}
                          </div>
                        </div>

                        {/* Reset Date */}
                        {creditsResetDate && (
                          <div className="pt-4 border-t border-neutral-800/50">
                            <div className="text-xs font-mono text-neutral-400 text-center">
                              {hasActiveSubscription
                                ? t('credits.renews', { date: formatDate(creditsResetDate) })
                                : t('credits.resets', { date: formatDate(creditsResetDate) })}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-2 mt-4 sm:mt-6">
                          <button
                            onClick={() => {
                              playClickSound();
                              setActiveTab('buy');
                            }}
                            className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-brand-cyan/80 hover:bg-brand-cyan text-black font-semibold rounded-md text-xs sm:text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-[brand-cyan]/20"
                          >
                            <CreditCard size={14} className="sm:w-4 sm:h-4" />
                            {t('credits.buyCredits')}
                          </button>
                          <button
                            onClick={() => {
                              playClickSound();
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
                            className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-neutral-800/50 hover:bg-neutral-800/70 border border-neutral-700/50 hover:border-neutral-600/50 text-neutral-300 font-semibold rounded-md text-xs sm:text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                          >
                            <FileText size={14} className="sm:w-4 sm:h-4" />
                            {t('usageHistory.title') || 'Histórico de Uso'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Show message if no subscription status */}
              {activeTab === 'credits' && !subscriptionStatus && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="text-neutral-400 font-mono text-sm">
                    {t('credits.loading') || 'Carregando informações...'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
