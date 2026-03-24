import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Plus, Minus, Pickaxe, QrCode, CheckCircle2, HardDrive, Key } from 'lucide-react';
import { getUserLocale, formatPrice, type CurrencyInfo } from '@/utils/localeUtils';
import { getCreditPackageLink, getCreditPackagePrice } from '@/utils/creditPackages';
import { useTranslation } from '@/hooks/useTranslation';
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
import { authService, type User } from '../services/authService';
import { SubscriptionPlansGrid } from '../components/SubscriptionPlansGrid';
import { MicroTitle } from '../components/ui/MicroTitle';
import { GlassPanel } from '../components/ui/GlassPanel';
import { PremiumButton } from '../components/ui/PremiumButton';
import { STORAGE_PLANS } from './docs/data/pricingData';

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
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'credits' | 'storage'>('subscriptions');
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  useEffect(() => {
    // Check authentication
    authService.verifyToken().then(user => {
      if (user) {
        setCurrentUser(user);
      }
    }).catch(err => console.error('Auth verification failed:', err));
  }, []);

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
  }, [currencyInfo]);

  const handleBuyCredits = async () => {
    if (!currencyInfo || creditPackages.length === 0) return;

    // Refresh user state to be sure
    const user = currentUser || await authService.ensureAuthenticated();

    // Optional: Force login if not authenticated (depending on UX requirement)
    // For now, we proceed but log a warning if no user, as payments might be possible as guest (though risky for credits)
    // However, the original issue implies logged-in users. 

    const userId = user?.id;
    const userEmail = user?.email;

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

    // Append client_reference_id and prefilled_email
    const separator = paymentLink.includes('?') ? '&' : '?';
    let params = '';

    if (userId) {
      params += `client_reference_id=${userId}`;
    }

    if (userEmail) {
      params += `${params ? '&' : ''}prefilled_email=${encodeURIComponent(userEmail)}`;
    }

    if (params) {
      paymentLink = `${paymentLink}${separator}${params}`;
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
      <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-12 md:pt-14 relative">
        <div className="fixed inset-0 z-0">
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
            <h1 className="text-5xl md:text-6xl font-semibold font-manrope text-neutral-300 mb-4 tracking-tight">
              {t('pricing.title')}
            </h1>
            <p className="text-neutral-500 font-mono text-sm md:text-base max-w-2xl mx-auto">
              {t('pricing.subtitle')}
            </p>
          </div>

          <div className="flex justify-center mb-12 animate-fade-in-fast">
            <Tabs
              value={activeTab}
              onValueChange={(v: any) => setActiveTab(v)}
              className="w-full max-w-[400px]"
            >
              <TabsList asChild>
                <GlassPanel padding="none" className="grid w-full grid-cols-3 p-1 rounded-xl">
                  <TabsTrigger
                    value="subscriptions"
                    className="rounded-md data-[state=active]:bg-neutral-800 data-[state=active]:text-brand-cyan text-sm"
                  >
                    {t('pricing.tabs.subscriptions') || 'Assinaturas'}
                  </TabsTrigger>
                  <TabsTrigger
                    value="credits"
                    className="rounded-md data-[state=active]:bg-neutral-800 data-[state=active]:text-brand-cyan text-sm"
                  >
                    {t('pricing.tabs.credits') || 'Créditos'}
                  </TabsTrigger>
                  <TabsTrigger
                    value="storage"
                    className="rounded-md data-[state=active]:bg-neutral-800 data-[state=active]:text-brand-cyan text-sm"
                  >
                    {t('pricing.tabs.storage') || 'Storage'}
                  </TabsTrigger>
                </GlassPanel>
              </TabsList>
            </Tabs>
          </div>

          {/* Content with smooth transitions */}
          <div className="relative min-h-[500px]">
            <Tabs value={activeTab} className="w-full">
              {/* Subscription Plans View */}
              <TabsContent value="subscriptions" className="mt-0 outline-none">
                <SubscriptionPlansGrid currencyInfo={currencyInfo} />
              </TabsContent>

              {/* Credit Packages View */}
              <TabsContent value="credits" className="mt-0 outline-none">
                <div className="animate-fade-in-fast">
                  <div className="flex flex-col items-center justify-center py-4">
                    <GlassPanel className="w-full max-w-[500px] shadow-2xl overflow-hidden group relative">
                      <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/5 to-transparent opacity-0 group-hover:opacity-300 transition-opacity duration-300 pointer-events-none" />

                      <CardContent className="p-4 md:p-8">
                        <div className="space-y-8 relative z-10">
                          <div className="text-center">
                            <div className="flex items-center justify-center gap-6 mb-4">
                              <Button variant="ghost" onClick={handlePreviousCredit}
                                disabled={selectedCreditIndex === 0}
                                className={cn(
                                  "p-2 rounded-md transition-all active:scale-90",
                                  selectedCreditIndex === 0
                                    ? "text-neutral-700 opacity-30 cursor-not-allowed"
                                    : "text-neutral-400 hover:text-brand-cyan hover:bg-neutral-800/50 cursor-pointer"
                                )}
                              >
                                <Minus size={24} />
                              </Button>

                              <div className="text-6xl md:text-7xl font-bold text-brand-cyan font-mono tracking-tighter drop-shadow-[0_0_15px_rgba(82,221,235,0.2)]">
                                {animatedCredits}
                              </div>

                              <Button variant="ghost" onClick={handleNextCredit}
                                disabled={selectedCreditIndex === creditPackages.length - 1}
                                className={cn(
                                  "p-2 rounded-md transition-all active:scale-90",
                                  selectedCreditIndex === creditPackages.length - 1
                                    ? "text-neutral-700 opacity-30 cursor-not-allowed"
                                    : "text-neutral-400 hover:text-brand-cyan hover:bg-neutral-800/50 cursor-pointer"
                                )}
                              >
                                <Plus size={24} />
                              </Button>
                            </div>

                            <MicroTitle as="span" className="flex items-center justify-center gap-2 opacity-60">
                              <Pickaxe size={14} className="text-brand-cyan/50" />
                              {t('pricing.creditsLabel')}
                            </MicroTitle>
                          </div>

                          <div className="pt-8 border-t border-neutral-800/50 text-center">
                            <div className="text-4xl font-bold text-neutral-100 font-mono mb-1">
                              {formatPrice(animatedPrice, currencyInfo?.currency || 'BRL', currencyInfo?.locale || 'pt-BR')}
                            </div>
                            <MicroTitle as="span" className="opacity-300">
                              {currencyInfo?.currency === 'BRL' ? 'Pagamento Único' : 'One-time payment'}
                            </MicroTitle>
                          </div>

                          <div className="flex flex-col gap-3 pt-6">
                            <PremiumButton
                              onClick={handleBuyCredits}
                              className="w-full h-12 uppercase "
                            >
                              <CreditCard className="mr-2 h-4 w-4" />
                              {t('pricing.buyCredits')}
                            </PremiumButton>

                            {currencyInfo?.currency === 'BRL' && (
                              <PremiumButton
                                onClick={handleBuyWithPix}
                                className="w-full h-12 uppercase  bg-transparent border-green-500/30 text-green-400 hover:bg-green-500/10 shadow-none"
                                icon={QrCode}
                              >
                                {t('pix.payWithPix')}
                              </PremiumButton>
                            )}
                          </div>

                          <p className="text-[10px] text-neutral-600 font-mono text-center leading-relaxed">
                            {t('pricing.creditsNote')}
                          </p>
                        </div>
                      </CardContent>
                    </GlassPanel>

                    {/* Indicators */}
                    <GlassPanel padding="sm" className="flex gap-1.5 mt-8 items-center rounded-full">
                      {creditPackages.map((_, index) => (
                        <Button variant="ghost" key={index}
                          onClick={() => setSelectedCreditIndex(index)}
                          className={cn(
                            "h-1.5 rounded-full transition-all duration-300",
                            index === selectedCreditIndex
                              ? "bg-brand-cyan w-8"
                              : "bg-neutral-800 w-1.5 hover:bg-neutral-700"
                          )}
                        />
                      ))}
                    </GlassPanel>
                  </div>
                </div>
              </TabsContent>

              {/* Storage Plans View */}
              <TabsContent value="storage" className="mt-0 outline-none">
                <div className="animate-fade-in-fast">
                  {/* Storage Info Banner */}
                  <div className="mb-8 p-4 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-brand-cyan/10 rounded-lg">
                        <Key size={20} className="text-brand-cyan" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-neutral-200 mb-1">
                          {t('pricing.storage.byokTitle') || 'Storage para BYOK'}
                        </h3>
                        <p className="text-sm text-neutral-400">
                          {t('pricing.storage.byokDescription') || 'Usando sua própria API key? Seus arquivos ainda precisam de storage. Escolha um plano abaixo.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Storage Plans Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                    {STORAGE_PLANS.map((plan, index) => (
                      <Card
                        key={plan.id}
                        className={cn(
                          "relative overflow-hidden transition-all duration-300 hover:border-brand-cyan/50",
                          index === 1
                            ? "bg-gradient-to-b from-brand-cyan/5 to-transparent border-brand-cyan/30"
                            : "bg-neutral-900/50 border-neutral-800"
                        )}
                      >
                        {index === 1 && (
                          <div className="absolute top-0 right-0 px-3 py-1 bg-brand-cyan text-black text-xs font-bold rounded-bl-lg">
                            {t('pricing.popular') || 'Popular'}
                          </div>
                        )}
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2 mb-2">
                            <HardDrive size={20} className={index === 1 ? "text-brand-cyan" : "text-neutral-400"} />
                            <CardTitle className="text-lg font-bold text-neutral-200">
                              {plan.name}
                            </CardTitle>
                          </div>
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-neutral-100">
                              {plan.priceBRL === 0 ? t('pricing.free') || 'Grátis' : `R$${plan.priceBRL.toFixed(2)}`}
                            </span>
                            {plan.billingCycle === 'monthly' && (
                              <span className="text-sm text-neutral-500">/mês</span>
                            )}
                          </div>
                          <p className="text-sm text-neutral-400 mt-1">
                            {plan.storageMB >= 1024
                              ? `${(plan.storageMB / 1024).toFixed(0)} GB`
                              : `${plan.storageMB} MB`}
                          </p>
                        </CardHeader>
                        <CardContent className="pt-4 border-t border-neutral-800/50">
                          <ul className="space-y-2">
                            {plan.features.map((feature, i) => (
                              <li key={i} className="flex items-center gap-2 text-sm text-neutral-400">
                                <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                          <Button
                            variant={index === 1 ? "brand" : "outline"}
                            className="w-full mt-6"
                            disabled={plan.priceBRL === 0}
                          >
                            {plan.priceBRL === 0
                              ? (t('pricing.included') || 'Incluído')
                              : (t('pricing.selectPlan') || 'Selecionar')}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Note about subscription storage */}
                  <p className="text-center text-sm text-neutral-500 mt-8 max-w-xl mx-auto">
                    {t('pricing.storage.subscriptionNote') || 'Assinaturas Pro e Vision já incluem storage. Planos de storage são para quem usa BYOK ou precisa de storage adicional.'}
                  </p>
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
