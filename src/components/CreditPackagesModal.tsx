import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, CreditCard, Plus, Minus, Pickaxe, QrCode, Info, FileText, CheckCircle2, ChevronLeft, ChevronRight, Key, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { CSSProperties } from 'react';
import { getUserLocale, formatPrice, type CurrencyInfo } from '@/utils/localeUtils';
import { CREDIT_PACKAGES, getCreditPackageLink, getCreditPackagePrice } from '@/utils/creditPackages';
import { useTranslation } from '@/hooks/useTranslation';
import { LinearGradientBackground } from './ui/LinearGradientBackground';
import type { SubscriptionStatus } from '../services/subscriptionService';
import { productService, type Product } from '../services/productService';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle'

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
  // Default to 'credits' if user has subscription, otherwise 'buy'
  const defaultTab = subscriptionStatus ? 'credits' : 'buy';
  const [activeTab, setActiveTab] = useState<'buy' | 'credits'>(initialTab || defaultTab);
  const [buySection, setBuySection] = useState<'credits' | 'subscriptions'>('credits');
  const [subscriptionPlans, setSubscriptionPlans] = useState<Product[]>([]);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showPackageCosts, setShowPackageCosts] = useState(false);
  const [showStatusCosts, setShowStatusCosts] = useState(false);

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-neutral-950/90 backdrop-blur-sm p-4 sm:p-6 md:p-8 overflow-hidden" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-xl md:max-w-2xl bg-neutral-950/50 backdrop-blur-3xl border border-white/5 rounded-2xl shadow-[0_30px_100px_rgba(0,0,0,0.8)] relative max-h-full overflow-hidden flex flex-col animate-scale-in">
        <LinearGradientBackground className="rounded-2xl" fullHeight />
        <Button
          variant="ghost"
          onClick={onClose}
          className="absolute top-4 right-4 text-neutral-500 hover:text-white transition-colors z-30 p-2 hover:bg-white/5 rounded-full"
        >
          <X size={20} />
        </Button>
        <div className="relative flex-1 w-full overflow-y-auto overflow-x-hidden">
          <div className="relative p-6 sm:p-8 md:p-10 z-10 w-full min-h-full">

            <div className="space-y-6 sm:space-y-8">
              <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <CreditCard size={16} className="sm:w-4 sm:h-4 text-neutral-500" />
                  <MicroTitle className="text-neutral-500 uppercase">
                    {activeTab === 'credits'
                      ? (t('credits.title') || 'CRÉDITOS')
                      : (t('creditsPackages.title') || 'COMPRAR')
                    }
                  </MicroTitle>
                </div>
              </div>

              {/* Tab Content */}
              <div className="relative overflow-hidden">
                {activeTab === 'buy' && (
                  <div className="animate-slide-in-right transition-all duration-300 ease-in-out">
                    {/* Unified Tabs: Créditos/Assinaturas */}
                    <div className="flex justify-center">
                      <div className="grid grid-cols-2 bg-neutral-900/50 p-1 rounded-md border border-neutral-800/50 w-full sm:w-auto sm:min-w-[200px]">
                        <Button variant="ghost"
                          onClick={() => {
                            playClickSound();
                            setBuySection('credits');
                          }}
                          className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-mono uppercase  transition-all rounded-md ${buySection === 'credits'
                            ? 'bg-neutral-800 text-white shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-300'
                            }`}
                        >
                          {t('creditsPackages.credits') || 'Créditos'}
                        </Button>
                        <Button variant="ghost"
                          onClick={() => {
                            playClickSound();
                            setBuySection('subscriptions');
                          }}
                          className={`px-2 sm:px-3 py-1 sm:py-1.5 text-xs font-mono uppercase  transition-all rounded-md ${buySection === 'subscriptions'
                            ? 'bg-neutral-800 text-white shadow-sm'
                            : 'text-neutral-500 hover:text-neutral-300'
                            }`}
                        >
                          {t('pricing.tabs.subscriptions') || 'Assinaturas'}
                        </Button>
                      </div>
                    </div>

                    {/* Credits Section */}
                    {buySection === 'credits' && (
                      <div className="flex flex-col items-center justify-center py-4 sm:py-5 md:py-6 animate-fade-in transition-all duration-300 ease-in-out">
                        {/* Package Selector */}
                        <div className="flex items-center justify-center mb-4 sm:mb-5 md:mb-6 w-full">
                          {/* Current Package Display */}
                          <div className="bg-neutral-900/40 border border-neutral-800/50 rounded-xl p-4 sm:p-6 md:p-8 w-full max-w-[320px] sm:max-w-[380px] md:max-w-[420px] text-center shadow-sm relative overflow-hidden group">
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/5 to-transparent opacity-0 group-hover:opacity-300 transition-opacity duration-300 pointer-events-none" />

                            <div className="relative z-10 space-y-4 sm:space-y-6">
                              <div>
                                {/* Credits Display with Pickaxe and +/- buttons */}
                                <div className="flex items-center justify-center gap-3 mb-3">
                                  {/* Previous button */}
                                  <Button variant="ghost"
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
                                  </Button>

                                  {/* Credits number */}
                                  <div className="text-4xl sm:text-5xl md:text-6xl font-bold text-brand-cyan/80 font-mono">
                                    {animatedCredits}
                                  </div>

                                  {/* Next button */}
                                  <Button variant="ghost"
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
                                  </Button>
                                </div>

                                <MicroTitle className="flex items-center justify-center gap-2 text-neutral-500 uppercase mt-2">
                                  <Pickaxe
                                    size={12}
                                    className="text-brand-cyan/50 flex-shrink-0"
                                  />
                                  {t('creditsPackages.credits') || 'Credits'}
                                </MicroTitle>
                                <div className="flex flex-col items-center gap-2 mt-1">
                                  <div className="flex items-center justify-center gap-1.5 ">
                                    <div className="text-[10px] sm:text-[11px] font-mono text-brand-cyan/50 uppercase tracking-widest">
                                      ≈ {animatedCredits} {t('pricing.imagesEstimate') || 'Imagens HD'}
                                    </div>
                                    <button
                                      onClick={() => setShowPackageCosts(!showPackageCosts)}
                                      className="flex items-center gap-1 text-[10px] text-neutral-600 hover:text-brand-cyan transition-colors cursor-pointer uppercase font-mono tracking-widest pl-2 border-l border-neutral-800 ml-2"
                                    >
                                      <span>{showPackageCosts ? 'Ver menos' : 'Ver modelos'}</span>
                                      {showPackageCosts ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                    </button>
                                  </div>

                                  {/* Expandable Costs Section */}
                                  {showPackageCosts && (
                                    <div className="w-full max-w-[300px] mt-2 py-3 px-4 bg-neutral-950/40 rounded-lg border border-neutral-800/30 animate-in fade-in slide-in-from-top-2 duration-300">
                                      <div className="space-y-2">
                                        <div className="flex justify-between text-[11px] font-bold uppercase tracking-tight text-neutral-400 border-b border-neutral-800/100 pb-1 mb-2">
                                          <span>Modelo / Resolução</span>
                                          <span>Imagens</span>
                                        </div>

                                        <div className="space-y-1.5">
                                          {[
                                            { label: '2.5 Flash / NB2 1K', cost: 1 },
                                            { label: 'Gemini Pro 1K (HD)', cost: 2 },
                                            { label: 'Gemini Pro 2K', cost: 3 },
                                            { label: 'Gemini Pro 3K', cost: 4 },
                                            { label: 'Gemini Pro 4K', cost: 5 },
                                            { label: 'Nano Banana 2 2K', cost: 3 },
                                            { label: 'Nano Banana 2 3K', cost: 4 },
                                            { label: 'Nano Banana 2 4K', cost: 5 },
                                          ].map((item, idx) => (
                                            <div key={idx} className="flex justify-between text-[10px] items-center">
                                              <span className="text-neutral-500">{item.label}</span>
                                              <span className="text-brand-cyan font-bold">{Math.floor(currentPackage.credits / item.cost)}</span>
                                            </div>
                                          ))}

                                          <div className="flex justify-between text-[10px] items-center pt-1 border-t border-neutral-800/50 mt-1">
                                            <span className="text-neutral-500">Veo 3 (Vídeo)</span>
                                            <span className="text-brand-cyan font-bold">{Math.floor(currentPackage.credits / 15)} Vídeos</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {currencyInfo && price > 0 && (
                                <div className="pt-6 border-t border-neutral-800/40">
                                  <div className="flex flex-col items-center justify-center gap-1">
                                    <div className="text-3xl sm:text-4xl font-bold text-neutral-100 font-mono tracking-tight">
                                      {formatPrice(animatedPrice, currencyInfo.currency, currencyInfo.locale)}
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono text-neutral-500 uppercase tracking-widest">
                                      <span>{t('pricing.oneTimePayment') || 'Pagamento único'}</span>
                                      <span className="w-1 h-1 bg-neutral-800 rounded-full" />
                                      <span className="text-brand-cyan/60">
                                        $0.067 Google + $0.013 Infra
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="flex flex-col gap-2 mt-4 sm:mt-6">
                                <Button variant="ghost"
                                  onClick={() => {
                                    playClickSound();
                                    handleBuyCredits();
                                  }}
                                  className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-brand-cyan/80 hover:bg-brand-cyan text-black font-semibold rounded-md text-xs sm:text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-[brand-cyan]/20"
                                >
                                  <CreditCard size={14} className="sm:w-4 sm:h-4" />
                                  {t('creditsPackages.buy') || 'Comprar'}
                                </Button>
                                {currencyInfo?.currency === 'BRL' && ABACATEPAY_LINKS[currentPackage.credits] && (
                                  <Button variant="ghost"
                                    onClick={() => {
                                      playClickSound();
                                      handleBuyWithPix();
                                    }}
                                    className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-[#6fd591]/80 hover:bg-[#6fd591] text-white font-semibold rounded-md text-xs sm:text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-[#6fd591]/20"
                                  >
                                    <QrCode size={14} className="sm:w-4 sm:h-4" />
                                    {t('pix.payWithPix') || 'Pagar com PIX'}
                                  </Button>
                                )}

                                <Button variant="ghost"
                                  onClick={() => {
                                    playClickSound();
                                    setBuySection('subscriptions');
                                  }}
                                  className="w-full mt-2 px-4 sm:px-6 py-2 text-neutral-500 hover:text-brand-cyan text-xs font-mono transition-colors flex items-center justify-center gap-2 hover:bg-neutral-800/30 rounded-md"
                                >
                                  {t('pricing.tabs.subscriptions') || 'Ver Assinaturas'}
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Package Indicator */}
                        <div className="flex gap-2 mb-4 sm:mb-5 md:mb-6 justify-center">
                          {CREDIT_PACKAGES.map((_, index) => (
                            <Button variant="ghost"
                              key={index}
                              onClick={() => {
                                playClickSound();
                                setSelectedIndex(index);
                              }}
                              className={`h-2 rounded-md transition-all duration-300 ease-out ${index === selectedIndex
                                ? 'bg-brand-cyan w-8 shadow-[0_0_10px_rgba(82,221,235,0.4)]'
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
                      <div className="py-2 sm:py-4 animate-fade-in transition-all duration-300 ease-in-out">
                        {filteredPlans.length > 0 && currentPlan ? (
                          <div className="flex flex-col items-center justify-center">
                            {/* Plan Display with Arrows */}
                            <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-6 w-full">
                              {/* Left Arrow */}
                              <Button variant="ghost"
                                onClick={handlePreviousPlan}
                                disabled={selectedPlanIndex === 0}
                                className={`p-2 sm:p-2.5 md:p-3 transition-all duration-200 rounded-md active:scale-[0.95] flex-shrink-0 ${selectedPlanIndex === 0
                                  ? 'text-neutral-600 cursor-not-allowed opacity-50'
                                  : 'text-neutral-400 hover:text-brand-cyan hover:bg-neutral-800/50 hover:scale-110 cursor-pointer'
                                  }`}
                                aria-label="Previous plan"
                              >
                                <ChevronLeft size={20} className="sm:w-6 sm:h-6 md:w-7 md:h-7" />
                              </Button>

                              {/* Plan Card */}
                              <div className="bg-neutral-900/40 border border-neutral-800/50 rounded-xl p-4 sm:p-6 md:p-8 w-full max-w-[320px] sm:max-w-[380px] md:max-w-[420px] text-center shadow-sm relative overflow-hidden group">
                                <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/5 to-transparent opacity-0 group-hover:opacity-300 transition-opacity duration-300 pointer-events-none" />

                                {/* Popular Badge */}
                                {currentPlan.displayOrder === 1 && (
                                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 z-10">
                                    <Badge className="bg-brand-cyan text-black font-bold text-[10px] sm:text-[10px] uppercase tracking-widest px-2 sm:px-3 py-0.5 rounded-full">
                                      {t('pricing.popular') || 'Popular'}
                                    </Badge>
                                  </div>
                                )}

                                <div className="relative z-10 space-y-4 sm:space-y-6">
                                  {/* Plan Name */}
                                  <div>
                                    <div className="flex items-center justify-center gap-2 mb-1">
                                      <h3 className="text-xl sm:text-2xl font-bold text-neutral-100 tracking-tight">
                                        {currentPlan.name}
                                      </h3>
                                      {currentPlan.metadata?.storageMB && parseInt(currentPlan.metadata.storageMB) >= 5120 && (
                                        <Badge className="bg-brand-cyan/20 text-brand-cyan border-none text-[10px] px-1.5 py-0">
                                          BYOK READY
                                        </Badge>
                                      )}
                                    </div>
                                  </div>

                                  {/* Billing Cycle Toggle - Inside card */}
                                  <div className="flex justify-center">
                                    <div className="bg-neutral-900/40 p-1 rounded-full border border-neutral-800/50 inline-flex relative w-full max-w-[200px]">
                                      <div
                                        className={`absolute inset-y-1 rounded-full bg-brand-cyan transition-all duration-300 ease-out ${billingCycle === 'monthly' ? "left-1 w-[calc(50%-3px)]" : "left-[50%] w-[calc(50%-3px)]"
                                          }`}
                                      />
                                      <Button variant="ghost"
                                        onClick={() => {
                                          playClickSound();
                                          setBillingCycle('monthly');
                                        }}
                                        className={`relative z-10 px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold rounded-full transition-colors duration-200 flex-1 ${billingCycle === 'monthly' ? "text-black" : "text-neutral-500 hover:text-neutral-300"
                                          }`}
                                      >
                                        {t('pricing.monthly')}
                                      </Button>
                                      <Button variant="ghost"
                                        onClick={() => {
                                          playClickSound();
                                          setBillingCycle('yearly');
                                        }}
                                        className={`relative z-10 px-2 sm:px-3 py-2 text-[10px] sm:text-sm font-bold rounded-full transition-colors duration-200 flex-1 flex items-center justify-center gap-1 sm:gap-2 ${billingCycle === 'yearly' ? "text-black" : "text-neutral-500 hover:text-neutral-300"
                                          }`}
                                      >
                                        {t('pricing.yearly')}
                                        <span className={`text-[10px] px-1 py-0.5 rounded-full font-bold  ${billingCycle === 'yearly' ? "bg-black/10" : "bg-brand-cyan/10 text-brand-cyan"
                                          }`}>
                                          -16%
                                        </span>
                                      </Button>
                                    </div>
                                  </div>

                                  {/* Price */}
                                  <div className="text-center pt-2">
                                    <div className="flex items-baseline justify-center gap-1">
                                      <span className="text-4xl sm:text-5xl font-black text-brand-cyan font-mono tracking-tighter">
                                        {formatPrice(
                                          currencyInfo?.currency === 'USD' && currentPlan.priceUSD ? currentPlan.priceUSD : currentPlan.priceBRL,
                                          currencyInfo?.currency || 'BRL',
                                          currencyInfo?.locale || 'pt-BR'
                                        )}
                                      </span>
                                      <span className="text-neutral-500 text-xs font-mono uppercase">
                                        {billingCycle === 'yearly' ? (t('pricing.perYear') || '/ano') : t('pricing.perMonth') || '/mês'}
                                      </span>
                                    </div>
                                    <MicroTitle className="flex items-center justify-center gap-1.5 text-[10px] text-neutral-500 mt-2 uppercase tracking-widest ">
                                      <Pickaxe size={10} className="text-brand-cyan/40" />
                                      <span>{currentPlan.credits} {t('pricing.creditsLabel')}</span>
                                    </MicroTitle>
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
                                    <Button variant="ghost"
                                      onClick={() => {
                                        playClickSound();
                                        const link = currencyInfo?.currency === 'USD' ? currentPlan.paymentLinkUSD : currentPlan.paymentLinkBRL;
                                        if (link) window.location.href = link;
                                      }}
                                      className="w-full bg-brand-cyan hover:bg-brand-cyan/90 text-black font-bold h-10 sm:h-11 rounded-md transition-transform hover:scale-[1.02] active:scale-[0.98] text-xs sm:text-sm"
                                      size="lg"
                                    >
                                      <CreditCard className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                      {t('pricing.subscribe') || 'Assinar'}
                                    </Button>
                                  </div>
                                </div>
                              </div>

                              {/* Right Arrow */}
                              <Button variant="ghost"
                                onClick={handleNextPlan}
                                disabled={selectedPlanIndex === filteredPlans.length - 1}
                                className={`p-2 sm:p-2.5 md:p-3 transition-all duration-200 rounded-md active:scale-[0.95] flex-shrink-0 ${selectedPlanIndex === filteredPlans.length - 1
                                  ? 'text-neutral-600 cursor-not-allowed opacity-50'
                                  : 'text-neutral-400 hover:text-brand-cyan hover:bg-neutral-800/50 hover:scale-110 cursor-pointer'
                                  }`}
                                aria-label="Next plan"
                              >
                                <ChevronRight size={20} className="sm:w-6 sm:h-6 md:w-7 md:h-7" />
                              </Button>
                            </div>

                            {/* Plan Indicator */}
                            <div className="flex gap-1.5 sm:gap-2 mb-2 sm:mb-3 md:mb-4">
                              {filteredPlans.map((_, index) => (
                                <Button variant="ghost"
                                  key={index}
                                  onClick={() => {
                                    playClickSound();
                                    setSelectedPlanIndex(index);
                                  }}
                                  className={`h-2 rounded-md transition-all duration-300 ease-out ${index === selectedPlanIndex
                                    ? 'bg-brand-cyan w-8 shadow-[0_0_10px_rgba(82,221,235,0.4)]'
                                    : 'bg-neutral-600 hover:bg-neutral-500 w-2 hover:scale-125'
                                    }`}
                                  aria-label={`Select plan ${index + 1}`}
                                />
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-10 sm:py-14 md:py-16 text-neutral-600 font-mono  text-sm sm:text-base">
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
                    <div className="flex flex-col items-center justify-center py-4 sm:py-6 md:py-8 animate-slide-in-left transition-all duration-300 ease-in-out">
                      {/* Available Credits Box */}
                      <div className="bg-neutral-950/20 backdrop-blur-sm border border-neutral-800/30 rounded-xl p-5 sm:p-6 md:p-8 w-full max-w-[280px] sm:max-w-[420px] text-center shadow-sm mb-6 sm:mb-8 md:mb-10">
                        <div className="space-y-4">
                          <div>
                            {/* Credits Display */}
                            <div className="flex items-center justify-center mb-3">
                              <div className="text-6xl sm:text-7xl md:text-8xl font-black text-brand-cyan drop-shadow-[0_0_15px_rgba(82,221,235,0.3)] font-mono leading-none tracking-tighter">
                                {totalCreditsAvailable}
                              </div>
                            </div>

                            <MicroTitle className="flex items-center justify-center gap-2 text-neutral-500 uppercase tracking-widest">
                              <Pickaxe
                                size={12}
                                className="text-brand-cyan/50 flex-shrink-0"
                              />
                              {t('credits.available')}
                            </MicroTitle>
                            <div className="flex flex-col items-center gap-2 mt-1">
                              <div className="flex items-center justify-center gap-1.5">
                                <div className="text-[10px] sm:text-[11px] font-mono text-brand-cyan/50 uppercase tracking-widest">
                                  ≈ {totalCreditsAvailable} {t('pricing.imagesEstimate') || 'Imagens HD'}
                                </div>
                                <button
                                  onClick={() => setShowStatusCosts(!showStatusCosts)}
                                  className="flex items-center gap-1 text-[10px] text-neutral-600 hover:text-brand-cyan transition-colors cursor-pointer uppercase font-mono tracking-widest pl-2 border-l border-neutral-800 ml-2"
                                >
                                  <span>{showStatusCosts ? 'Ver menos' : 'Ver modelos'}</span>
                                  {showStatusCosts ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                </button>
                              </div>

                              {/* Expandable Costs Section */}
                              {showStatusCosts && (
                                <div className="w-full max-w-[300px] mt-2 py-3 px-4 bg-neutral-950/40 rounded-lg border border-neutral-800/30 animate-in fade-in slide-in-from-top-2 duration-300">
                                  <div className="space-y-2">
                                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-tight text-neutral-400 border-b border-neutral-800/100 pb-1 mb-2">
                                      <span>Modelo / Resolução</span>
                                      <span>Imagens</span>
                                    </div>

                                    <div className="space-y-1.5">
                                      {[
                                        { label: '2.5 Flash / NB2 1K', cost: 1 },
                                        { label: 'Gemini Pro 1K (HD)', cost: 2 },
                                        { label: 'Gemini Pro 2K', cost: 3 },
                                        { label: 'Gemini Pro 3K', cost: 4 },
                                        { label: 'Gemini Pro 4K', cost: 5 },
                                        { label: 'Nano Banana 2 2K', cost: 3 },
                                        { label: 'Nano Banana 2 3K', cost: 4 },
                                        { label: 'Nano Banana 2 4K', cost: 5 },
                                      ].map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-[10px] items-center">
                                          <span className="text-neutral-500">{item.label}</span>
                                          <span className="text-brand-cyan font-bold">{Math.floor(totalCreditsAvailable / item.cost)}</span>
                                        </div>
                                      ))}

                                      <div className="flex justify-between text-[10px] items-center pt-1 border-t border-neutral-800/50 mt-1">
                                        <span className="text-neutral-500">Veo 3 (Vídeo)</span>
                                        <span className="text-brand-cyan font-bold">{Math.floor(totalCreditsAvailable / 15)} Vídeos</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Reset Date */}
                          {creditsResetDate && (
                            <div className="pt-6 border-t border-neutral-800/40">
                              <div className="text-[10px] sm:text-[11px] font-mono text-neutral-500 uppercase tracking-widest text-center">
                                {hasActiveSubscription
                                  ? t('credits.renews', { date: formatDate(creditsResetDate) })
                                  : t('credits.resets', { date: formatDate(creditsResetDate) })}
                              </div>
                            </div>
                          )}

                          {/* Action Buttons */}
                          <div className="flex flex-col gap-2 mt-4 sm:mt-6">
                            <Button variant="ghost"
                              onClick={() => {
                                playClickSound();
                                setActiveTab('buy');
                              }}
                              className="w-full px-4 sm:px-6 py-2.5 sm:py-3 bg-brand-cyan/80 hover:bg-brand-cyan text-black font-semibold rounded-md text-xs sm:text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-[brand-cyan]/20"
                            >
                              <CreditCard size={14} className="sm:w-4 sm:h-4" />
                              {t('credits.buyCredits') || 'Comprar Créditos'}
                            </Button>
                            <Button variant="ghost"
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
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Show message if trying to view credits but no subscription status */}
                {activeTab === 'credits' && !subscriptionStatus && (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="text-neutral-400 font-mono text-sm mb-4">
                      {t('credits.noSubscription') || 'Faça login para ver seus créditos disponíveis'}
                    </div>
                    <Button variant="ghost"
                      onClick={() => {
                        playClickSound();
                        setActiveTab('buy');
                      }}
                      className="text-xs text-brand-cyan hover:text-brand-cyan/80 font-mono uppercase  transition-colors px-3 py-2 hover:bg-neutral-800/30 rounded"
                    >
                      {t('creditsPackages.buy') || 'Comprar'} →
                    </Button>
                  </div>
                )}
              </div>

              {/* Modal Community Footer */}
              <div className="pt-8 mt-4 border-t border-neutral-800/20 flex flex-col sm:flex-row items-center justify-between gap-4 opacity-50 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-4">
                  <a href="https://github.com/visantlabs" target="_blank" className="flex items-center gap-2 text-[10px] font-mono text-neutral-500 hover:text-brand-cyan transition-colors">
                    <Pickaxe size={12} />
                    <span>OSS CORE</span>
                  </a>
                  <a href="https://discord.gg/visant" target="_blank" className="flex items-center gap-2 text-[10px] font-mono text-neutral-500 hover:text-brand-cyan transition-colors">
                    <Info size={12} />
                    <span>LABS COMMUNITY</span>
                  </a>
                </div>
                <div className="text-[10px] font-mono text-neutral-600">
                  © 2026 VISANT LAB® — BUILDING IN PUBLIC
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
