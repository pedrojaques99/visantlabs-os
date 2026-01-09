import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Plus, Minus, Pickaxe, QrCode, CheckCircle2 } from 'lucide-react';
import { getUserLocale, formatPrice, type CurrencyInfo } from '../utils/localeUtils';
import { getCreditPackageLink, getCreditPackagePrice } from '../utils/creditPackages';
import { useTranslation } from '../hooks/useTranslation';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { BreadcrumbWithBack, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '../components/ui/BreadcrumbWithBack';
import { PixPaymentModal } from '../components/PixPaymentModal';
import { SEO } from '../components/SEO';
import { subscriptionService } from '../services/subscriptionService';
import { productService, type Product } from '../services/productService';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

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
  const [subscriptionPlans, setSubscriptionPlans] = useState<Product[]>([]);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'credits'>('subscriptions');

  useEffect(() => {
    const locale = getUserLocale();
    setCurrencyInfo(locale);

    // Fetch dynamic credit packages
    productService.getCreditPackages().then(packages => {
      if (packages.length > 0) {
        setCreditPackages(packages);
      }
    });

    // Fetch dynamic subscription plans
    productService.getSubscriptionPlans().then(plans => {
      if (plans.length > 0) {
        setSubscriptionPlans(plans);
      }
    });
  }, []);

  useEffect(() => {
    if (currencyInfo && subscriptionPlans.length === 0) {
      setIsLoading(true);
      subscriptionService.getPlans(currencyInfo.currency)
        .then((plan) => {
          setPlanInfo(plan);
          setError(null);
        })
        .catch((err) => {
          console.error('Final fallback failed:', err);
          setError('Failed to load pricing information');
        })
        .finally(() => setIsLoading(false));
    }
  }, [currencyInfo, subscriptionPlans.length]);

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

          {/* Tabs Navigation */}
          <div className="flex justify-center mb-12 animate-fade-in-fast">
            <Tabs
              value={activeTab}
              onValueChange={(v: any) => setActiveTab(v)}
              className="w-full max-w-[400px]"
            >
              <TabsList className="grid w-full grid-cols-2 bg-zinc-900/50 border border-zinc-800 p-1 rounded-xl">
                <TabsTrigger
                  value="subscriptions"
                  className="rounded-lg data-[state=active]:bg-zinc-800 data-[state=active]:text-brand-cyan"
                >
                  {t('pricing.tabs.subscriptions') || 'Assinaturas'}
                </TabsTrigger>
                <TabsTrigger
                  value="credits"
                  className="rounded-lg data-[state=active]:bg-zinc-800 data-[state=active]:text-brand-cyan"
                >
                  {t('pricing.tabs.credits') || 'Créditos'}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Content with smooth transitions */}
          <div className="relative min-h-[500px]">
            <Tabs value={activeTab} className="w-full">
              {/* Subscription Plans View */}
              <TabsContent value="subscriptions" className="mt-0 outline-none">
                {subscriptionPlans.length > 0 ? (
                  <div className="animate-fade-in-fast">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                      {subscriptionPlans.map((plan) => (
                        <Card
                          key={plan.id}
                          className="bg-zinc-900/40 border-zinc-800/50 hover:border-brand-cyan/30 transition-all duration-300 flex flex-col group relative overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                          <CardHeader className="text-center pb-2 relative z-10">
                            {plan.displayOrder === 1 && (
                              <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                                <Badge className="bg-brand-cyan text-black font-bold text-[10px] uppercase tracking-widest px-3 py-0.5 rounded-full">
                                  {t('pricing.popular') || 'Popular'}
                                </Badge>
                              </div>
                            )}
                            <h3 className="text-2xl font-bold text-zinc-100 tracking-tight mt-2">{plan.name}</h3>
                          </CardHeader>

                          <CardContent className="flex-1 flex flex-col p-6 pt-2 relative z-10">
                            <div className="text-center mb-6">
                              <div className="flex items-baseline justify-center gap-1">
                                <span className="text-4xl font-bold text-brand-cyan font-mono">
                                  {formatPrice(
                                    currencyInfo?.currency === 'USD' && plan.priceUSD ? plan.priceUSD : plan.priceBRL,
                                    currencyInfo?.currency || 'BRL',
                                    currencyInfo?.locale || 'pt-BR'
                                  )}
                                </span>
                                <span className="text-zinc-500 text-sm font-mono">{t('pricing.perMonth')}</span>
                              </div>
                              <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 font-mono mt-2 uppercase tracking-wider">
                                <Pickaxe size={12} className="text-brand-cyan/60" />
                                <span>{plan.credits} {t('pricing.creditsLabel')}</span>
                              </div>
                            </div>

                            {plan.description && (
                              <div className="space-y-3 mb-8">
                                {plan.description.split(',').map((benefit, idx) => (
                                  <div key={idx} className="flex items-start gap-3 text-sm text-zinc-400">
                                    <CheckCircle2 size={16} className="text-brand-cyan mt-0.5 flex-shrink-0" />
                                    <span>{benefit.trim()}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            <div className="mt-auto pt-4">
                              <Button
                                onClick={() => {
                                  const link = currencyInfo?.currency === 'USD' ? plan.paymentLinkUSD : plan.paymentLinkBRL;
                                  if (link) window.location.href = link;
                                }}
                                className="w-full bg-brand-cyan hover:bg-brand-cyan/90 text-black font-bold h-11 rounded-lg transition-transform hover:scale-[1.02] active:scale-[0.98]"
                                size="lg"
                              >
                                <CreditCard className="mr-2 h-4 w-4" />
                                {t('pricing.subscribe')}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-20 text-zinc-600 font-mono italic">
                    {t('pricing.noPlansFound') || 'Nenhum plano disponível no momento.'}
                  </div>
                )}
              </TabsContent>

              {/* Credit Packages View */}
              <TabsContent value="credits" className="mt-0 outline-none">
                <div className="animate-fade-in-fast">
                  <div className="flex flex-col items-center justify-center py-4">
                    <Card className="bg-zinc-900/40 border-zinc-800/50 w-full max-w-[500px] shadow-2xl overflow-hidden group relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                      <CardContent className="p-8 md:p-12">
                        <div className="space-y-8 relative z-10">
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-6 mb-4">
                              <button
                                onClick={handlePreviousCredit}
                                disabled={selectedCreditIndex === 0}
                                className={cn(
                                  "p-2 rounded-lg transition-all active:scale-90",
                                  selectedCreditIndex === 0
                                    ? "text-zinc-700 opacity-30 cursor-not-allowed"
                                    : "text-zinc-400 hover:text-brand-cyan hover:bg-zinc-800/50 cursor-pointer"
                                )}
                              >
                                <Minus size={24} />
                              </button>

                              <div className="text-6xl md:text-7xl font-bold text-brand-cyan font-mono tracking-tighter drop-shadow-[0_0_15px_rgba(82,221,235,0.2)]">
                                {animatedCredits}
                              </div>

                              <button
                                onClick={handleNextCredit}
                                disabled={selectedCreditIndex === creditPackages.length - 1}
                                className={cn(
                                  "p-2 rounded-lg transition-all active:scale-90",
                                  selectedCreditIndex === creditPackages.length - 1
                                    ? "text-zinc-700 opacity-30 cursor-not-allowed"
                                    : "text-zinc-400 hover:text-brand-cyan hover:bg-zinc-800/50 cursor-pointer"
                                )}
                              >
                                <Plus size={24} />
                              </button>
                            </div>

                            <div className="flex items-center justify-center gap-2 text-xs text-zinc-500 font-mono uppercase tracking-[0.2em]">
                              <Pickaxe size={14} className="text-brand-cyan/50" />
                              {t('pricing.creditsLabel')}
                            </div>
                          </div>

                          <div className="pt-8 border-t border-zinc-800/50 text-center">
                            <div className="text-4xl font-bold text-zinc-100 font-mono mb-1">
                              {formatPrice(animatedPrice, currencyInfo?.currency || 'BRL', currencyInfo?.locale || 'pt-BR')}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest opacity-60">
                              {currencyInfo?.currency === 'BRL' ? 'Pagamento Único' : 'One-time payment'}
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 pt-6">
                            <Button
                              onClick={handleBuyCredits}
                              className="w-full bg-brand-cyan hover:bg-brand-cyan/90 text-black font-bold h-12 text-sm uppercase tracking-wider shadow-[0_5px_15px_rgba(82,221,235,0.15)]"
                              size="lg"
                            >
                              <CreditCard className="mr-2 h-4 w-4" />
                              {t('pricing.buyCredits')}
                            </Button>

                            {currencyInfo?.currency === 'BRL' && (
                              <Button
                                onClick={handleBuyWithPix}
                                variant="outline"
                                className="w-full border-green-500/30 text-green-400 hover:bg-green-500/10 h-12 text-sm uppercase tracking-wider"
                                size="lg"
                              >
                                <QrCode className="mr-2 h-4 w-4" />
                                {t('pix.payWithPix')}
                              </Button>
                            )}
                          </div>

                          <p className="text-[10px] text-zinc-600 font-mono text-center leading-relaxed">
                            {t('pricing.creditsNote')}
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Indicators */}
                    <div className="flex gap-1.5 mt-8 items-center bg-zinc-900/40 p-1.5 rounded-full border border-zinc-800/30">
                      {creditPackages.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedCreditIndex(index)}
                          className={cn(
                            "h-1.5 rounded-full transition-all duration-300",
                            index === selectedCreditIndex
                              ? "bg-brand-cyan w-8"
                              : "bg-zinc-800 w-1.5 hover:bg-zinc-700"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
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
