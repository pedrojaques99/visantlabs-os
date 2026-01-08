import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Plus, Minus, Pickaxe, QrCode } from 'lucide-react';
import { getUserLocale, formatPrice, type CurrencyInfo } from '../utils/localeUtils';
import { getCreditPackageLink, getCreditPackagePrice } from '../utils/creditPackages';
import { useTranslation } from '../hooks/useTranslation';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { BreadcrumbWithBack, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '../components/ui/BreadcrumbWithBack';
import { PixPaymentModal } from '../components/PixPaymentModal';
import { SEO } from '../components/SEO';
import { subscriptionService } from '../services/subscriptionService';
import { productService, type Product } from '../services/productService';

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

interface PlanInfo {
  priceId: string;
  tier: string;
  monthlyCredits: number;
  amount: number;
  currency: string;
  interval: string;
  productName: string;
  description: string;
}

export const PricingPage: React.FC = () => {
  const { t } = useTranslation();
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creditPackages, setCreditPackages] = useState<Product[]>([]);
  const [selectedCreditIndex, setSelectedCreditIndex] = useState(0);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);

  useEffect(() => {
    const locale = getUserLocale();
    setCurrencyInfo(locale);

    // Fetch dynamic credit packages
    productService.getCreditPackages().then(packages => {
      if (packages.length > 0) {
        setCreditPackages(packages);
      }
    });
  }, []);

  useEffect(() => {
    if (currencyInfo) {
      // Try to fetch plan info from Stripe, but use fallback if it fails
      subscriptionService.getPlans(currencyInfo.currency)
        .then((plan) => {
          setPlanInfo(plan);
          setError(null);
        })
        .catch((err) => {
          console.warn('Could not load plan info from Stripe, using defaults:', err);
          // Use default values based on currency
          const defaultPlans: Record<string, Partial<PlanInfo>> = {
            USD: {
              amount: 9,
              currency: 'USD',
              monthlyCredits: 100,
              interval: 'month',
              productName: 'Premium',
              tier: 'premium',
            },
            BRL: {
              amount: 19.90,
              currency: 'BRL',
              monthlyCredits: 100,
              interval: 'month',
              productName: 'Premium',
              tier: 'premium',
            },
          };

          const defaultPlan = defaultPlans[currencyInfo.currency] || defaultPlans.USD;
          setPlanInfo({
            priceId: '',
            tier: defaultPlan.tier || 'premium',
            monthlyCredits: defaultPlan.monthlyCredits || 100,
            amount: defaultPlan.amount || 9,
            currency: defaultPlan.currency || 'USD',
            interval: defaultPlan.interval || 'month',
            productName: defaultPlan.productName || 'Premium',
            description: '',
          });
          setError(null); // Don't show error, just use defaults
        });
    }
  }, [currencyInfo]);

  const handleBuyCredits = async () => {
    if (!currencyInfo || creditPackages.length === 0) return;

    const currentPackage = creditPackages[selectedCreditIndex];

    // Flag no localStorage para detectar retorno do pagamento
    localStorage.setItem('credit_purchase_pending', JSON.stringify({
      timestamp: Date.now(),
      credits: currentPackage.credits,
    }));

    // Usar Payment Link do produto se disponível, caso contrário fallback para utils
    let paymentLink = currencyInfo.currency === 'USD'
      ? currentPackage.paymentLinkUSD
      : currentPackage.paymentLinkBRL;

    if (!paymentLink) {
      paymentLink = getCreditPackageLink(currentPackage.credits, currencyInfo.currency);
    }

    if (!paymentLink) {
      setError('Payment link not found for this package');
      return;
    }

    // Redireciona para o Payment Link do Stripe
    window.location.href = paymentLink;
  };

  const handleBuyWithPix = () => {
    if (!currencyInfo) return;
    setIsPixModalOpen(true);
  };

  const handlePixSuccess = () => {
    // Refresh page or update credits display
    window.location.reload();
  };

  const handlePreviousCredit = () => {
    setSelectedCreditIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const handleNextCredit = () => {
    setSelectedCreditIndex((prev) => (prev < creditPackages.length - 1 ? prev + 1 : prev));
  };

  const currentCreditPackage = creditPackages[selectedCreditIndex];

  const getDisplayPrice = () => {
    if (!currencyInfo || !currentCreditPackage) return 0;

    // Prefer product price if set
    if (currencyInfo.currency === 'USD' && currentCreditPackage.priceUSD) {
      return currentCreditPackage.priceUSD;
    }
    if (currencyInfo.currency === 'BRL') {
      return currentCreditPackage.priceBRL;
    }

    // Fallback to utils
    return getCreditPackagePrice(currentCreditPackage.credits, currencyInfo.currency);
  };

  const creditPrice = getDisplayPrice();

  // Animated counter for credits (30% faster: 280ms instead of 400ms)
  const animatedCredits = useAnimatedCounter(currentCreditPackage?.credits || 0, 280);

  // Animated counter for price (30% faster: 280ms instead of 400ms)
  const animatedPrice = useAnimatedCounter(creditPrice, 280);

  return (
    <>
      <SEO
        title="Preços e Planos"
        description="Planos e pacotes de créditos para gerar mockups profissionais com IA. Escolha o plano ideal para suas necessidades de design."
        keywords="preços, planos, créditos, assinatura, mockup generator, pricing"
      />
      <div className="min-h-screen bg-[#121212] text-zinc-300 pt-12 md:pt-14 relative">
        <div className="fixed inset-0 z-0">
          <GridDotsBackground />
        </div>
        <div className="max-w-5xl mx-auto px-4 pt-[30px] pb-16 md:pb-24 relative z-10">
          <div className="mb-4">
            <BreadcrumbWithBack to="/">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">{t('apps.home')}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{t('pricing.title') || 'Pricing'}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </BreadcrumbWithBack>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4 text-sm text-red-400 font-mono mb-8 text-center animate-fade-in-down">
              {error}
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-12 md:mb-16 animate-fade-in-fast">
            <h1 className="text-5xl md:text-6xl font-semibold font-manrope text-zinc-300 mb-4 tracking-tight">
              {t('pricing.title')}
            </h1>
            <p className="text-zinc-500 font-mono text-sm md:text-base max-w-2xl mx-auto">
              {t('pricing.subtitle')}
            </p>
          </div>

          {/* Content with smooth transitions */}
          <div className="relative min-h-[500px]">
            {/* Credits */}
            <div className="animate-fade-in-fast">
              <div className="flex flex-col items-center justify-center py-8 md:py-12">
                {/* Package Selector */}
                <div className="flex items-center justify-center mb-8">
                  {/* Current Package Display */}
                  <div className="bg-card border border-zinc-800/30 rounded-md p-6 md:p-10 min-w-[280px] md:min-w-[420px] text-center shadow-sm hover:border-brand-cyan/30 hover:shadow-brand-cyan/10 transition-all duration-300 relative overflow-hidden group">
                    {/* Subtle glow effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                    <div className="space-y-4 relative z-10">
                      <div>
                        {/* Credits Display with Pickaxe and +/- buttons */}
                        <div className="flex items-center justify-center gap-3 mb-3">
                          {/* Previous button */}
                          <button
                            onClick={handlePreviousCredit}
                            disabled={selectedCreditIndex === 0}
                            className={`p-2 md:p-2.5 transition-all duration-200 rounded-md active:scale-[0.95] ${selectedCreditIndex === 0
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
                            onClick={handleNextCredit}
                            disabled={selectedCreditIndex === creditPackages.length - 1}
                            className={`p-2 md:p-2.5 transition-all duration-200 rounded-md active:scale-[0.95] ${selectedCreditIndex === creditPackages.length - 1
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
                          {t('pricing.creditsLabel') || 'Credits'}
                        </div>
                      </div>

                      {currencyInfo && creditPrice > 0 && (
                        <div className="pt-4 border-t border-zinc-800/50">
                          <div className="text-3xl font-bold text-zinc-200 font-mono">
                            {formatPrice(animatedPrice, currencyInfo.currency, currencyInfo.locale)}
                          </div>
                          <div className="text-xs text-zinc-500 font-mono mt-1">
                            {currencyInfo.currency === 'BRL' ? 'Pagamento único' : 'One-time payment'}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col gap-2 mt-6">
                        <button
                          onClick={handleBuyCredits}
                          className="w-full px-6 py-3 bg-brand-cyan/80 hover:bg-brand-cyan text-black font-semibold rounded-md text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-[brand-cyan]/20 cursor-pointer"
                        >
                          <CreditCard size={16} />
                          {t('pricing.buyCredits') || 'Buy'}
                        </button>
                        {currencyInfo?.currency === 'BRL' && (
                          <button
                            onClick={handleBuyWithPix}
                            className="w-full px-6 py-3 bg-[#6fd591]/80 hover:bg-[#6fd591] text-white font-semibold rounded-md text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-[#6fd591]/20 cursor-pointer"
                          >
                            <QrCode size={16} />
                            {t('pix.payWithPix') || 'Pagar com PIX'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Package Indicator */}
                <div className="flex gap-2 mb-6">
                  {creditPackages.map((pkg, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedCreditIndex(index)}
                      className={`h-2 rounded-md transition-all duration-300 ease-out cursor-pointer ${index === selectedCreditIndex
                        ? 'bg-brand-cyan w-8 shadow-[0_0_8px_rgba(82,221,235,0.4)]'
                        : 'bg-zinc-600 hover:bg-zinc-500 w-2 hover:scale-125'
                        }`}
                      aria-label={`Select ${pkg.credits} credits package`}
                    />
                  ))}
                </div>

                <div className="text-xs text-zinc-500 font-mono text-center max-w-md animate-fade-in-fast">
                  {t('pricing.creditsNote') || 'Credits never expire and can be used at any time'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PIX Payment Modal */}
        {isPixModalOpen && currencyInfo && currentCreditPackage && (
          <PixPaymentModal
            isOpen={isPixModalOpen}
            onClose={() => setIsPixModalOpen(false)}
            credits={currentCreditPackage.credits}
            currency={currencyInfo.currency}
            onSuccess={handlePixSuccess}
          />
        )}
      </div>
    </>
  );
};
