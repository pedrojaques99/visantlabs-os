import React, { useState, useEffect, useRef } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useNavigate } from 'react-router-dom';
import { X, CreditCard, Plus, Minus, Pickaxe, QrCode, Info, FileText, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
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
  initialTab?: 'carteira' | 'creditos' | 'assinatura';
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
  initialTab = 'creditos'
}) => {
  useScrollLock(isOpen);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const defaultTab: 'carteira' | 'creditos' | 'assinatura' = subscriptionStatus ? 'carteira' : 'creditos';
  const [activeTab, setActiveTab] = useState<'carteira' | 'creditos' | 'assinatura'>(initialTab || defaultTab);
  const [subscriptionPlans, setSubscriptionPlans] = useState<Product[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [showPackageCosts, setShowPackageCosts] = useState(false);
  const [showStatusCosts, setShowStatusCosts] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab || defaultTab);
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
              {/* Header */}
              <div className="flex items-center gap-2 sm:gap-3 pb-2">
                <CreditCard size={16} className="text-neutral-500" />
                <MicroTitle className="text-neutral-500 uppercase">
                  {activeTab === 'carteira' ? (t('credits.title') || 'CRÉDITOS') : (t('creditsPackages.title') || 'COMPRAR')}
                </MicroTitle>
              </div>

              {/* 3-tab bar */}
              <div className="grid grid-cols-3 bg-neutral-900/50 p-1 rounded-md border border-neutral-800/50">
                {(['carteira', 'creditos', 'assinatura'] as const).map((tab) => {
                  const labels: Record<string, string> = { carteira: 'Carteira', creditos: 'Créditos', assinatura: 'Assinatura' };
                  return (
                    <button
                      key={tab}
                      onClick={() => { playClickSound(); setActiveTab(tab); }}
                      className={`px-2 py-1.5 text-[11px] font-mono uppercase tracking-wide rounded transition-all ${activeTab === tab ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                    >
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <div className="relative overflow-hidden">
                {/* ── Créditos tab ── */}
                {activeTab === 'creditos' && (
                  <div>
                    {true && (
                      <div className="animate-fade-in py-4 space-y-3">
                        {/* Package card */}
                        <div className="bg-neutral-900/40 border border-neutral-800/50 rounded-xl p-5 sm:p-6 space-y-5">
                          {/* Selector row */}
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-300 mb-1">
                                {t('creditsPackages.credits') || 'Créditos'}
                              </p>
                              <div className="flex items-baseline gap-2">
                                <span className="text-4xl sm:text-5xl font-black font-mono text-white leading-none tabular-nums">
                                  {animatedCredits}
                                </span>
                                <span className="text-xs font-mono text-brand-cyan/70 uppercase">
                                  créditos
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                onClick={() => { playClickSound(); handlePrevious(); }}
                                disabled={selectedIndex === 0}
                                aria-label="Pacote anterior"
                                className="h-8 w-8 p-0 border-neutral-700 bg-neutral-900/50 hover:bg-neutral-800 hover:border-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-300"
                              >
                                <Minus size={14} />
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => { playClickSound(); handleNext(); }}
                                disabled={selectedIndex === CREDIT_PACKAGES.length - 1}
                                aria-label="Próximo pacote"
                                className="h-8 w-8 p-0 border-neutral-700 bg-neutral-900/50 hover:bg-neutral-800 hover:border-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-300"
                              >
                                <Plus size={14} />
                              </Button>
                            </div>
                          </div>

                          {/* Package dots */}
                          <div className="flex gap-1.5">
                            {CREDIT_PACKAGES.map((_, index) => (
                              <button
                                key={index}
                                onClick={() => { playClickSound(); setSelectedIndex(index); }}
                                aria-label={`${CREDIT_PACKAGES[index].credits} créditos`}
                                className={`h-1.5 rounded-full transition-all duration-300 ${index === selectedIndex ? 'bg-brand-cyan w-6' : 'bg-neutral-700 hover:bg-neutral-500 w-1.5'}`}
                              />
                            ))}
                          </div>

                          {/* Price row */}
                          {currencyInfo && price > 0 && (
                            <div className="pt-4 border-t border-neutral-800/40 flex items-end justify-between">
                              <div>
                                <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-300 mb-1">
                                  {t('pricing.oneTimePayment') || 'Pagamento único'}
                                </p>
                                <div className="flex items-baseline gap-1.5">
                                  <span className="text-3xl sm:text-4xl font-black font-mono text-white tabular-nums">
                                    {formatPrice(animatedPrice, currencyInfo.currency, currencyInfo.locale)}
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] font-mono text-brand-cyan/50 uppercase tracking-widest text-right leading-relaxed">
                                $0.067 Google<br />$0.013 Infra
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Model cost reference — expandable */}
                        <div className="border border-neutral-800/40 rounded-xl overflow-hidden">
                          <button
                            onClick={() => setShowPackageCosts(!showPackageCosts)}
                            className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-neutral-300 hover:text-white hover:bg-neutral-900/40 transition-colors"
                            aria-expanded={showPackageCosts}
                          >
                            <span className="flex items-center gap-2">
                              <Pickaxe size={11} className="text-brand-cyan/70" />
                              Quanto rende por modelo
                            </span>
                            {showPackageCosts ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>

                          {showPackageCosts && (
                            <div className="px-4 pb-4 pt-1 bg-neutral-950/30 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="flex justify-between text-[10px] font-mono font-bold uppercase tracking-tight text-neutral-300 border-b border-neutral-800/60 pb-2 mb-2">
                                <span>Modelo / Resolução</span>
                                <span>Imagens</span>
                              </div>
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
                                <div key={idx} className="flex justify-between text-[10px] font-mono items-center">
                                  <span className="text-neutral-300">{item.label}</span>
                                  <span className="text-brand-cyan font-bold tabular-nums">{Math.floor(currentPackage.credits / item.cost)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between text-[10px] font-mono items-center pt-2 border-t border-neutral-800/50 mt-1">
                                <span className="text-neutral-300">Veo 3 (Vídeo)</span>
                                <span className="text-brand-cyan font-bold tabular-nums">{Math.floor(currentPackage.credits / 15)} vídeos</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex flex-col gap-2 pt-1">
                          <Button
                            onClick={() => { playClickSound(); handleBuyCredits(); }}
                            className="w-full bg-brand-cyan/80 hover:bg-brand-cyan text-black font-semibold rounded-md text-xs sm:text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] shadow-lg"
                          >
                            <CreditCard size={14} />
                            {t('creditsPackages.buy') || 'Comprar'}
                          </Button>
                          {currencyInfo?.currency === 'BRL' && ABACATEPAY_LINKS[currentPackage.credits] && (
                            <Button
                              onClick={() => { playClickSound(); handleBuyWithPix(); }}
                              className="w-full bg-[#6fd591]/80 hover:bg-[#6fd591] text-white font-semibold rounded-md text-xs sm:text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99]"
                            >
                              <QrCode size={14} />
                              {t('pix.payWithPix') || 'Pagar com PIX'}
                            </Button>
                          )}
                          <button
                            onClick={() => { playClickSound(); setActiveTab('assinatura'); }}
                            className="w-full text-neutral-500 hover:text-neutral-300 text-[10px] font-mono uppercase tracking-widest transition-colors hover:bg-neutral-800/30 rounded-md py-2"
                          >
                            {t('pricing.tabs.subscriptions') || 'Ver Assinatura'} →
                          </button>
                        </div>

                        <p className="text-[10px] font-mono text-neutral-600 text-center pt-1">
                          {t('creditsPackages.note') || 'Créditos não expiram e podem ser usados a qualquer momento'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Assinatura tab ── */}
                {activeTab === 'assinatura' && (
                  <div className="py-4 space-y-3 animate-fade-in">
                    {subscriptionPlans.length > 0 ? (
                      <>
                        {/* Billing toggle */}
                        <div className="grid grid-cols-2 bg-neutral-900/50 p-1 rounded-md border border-neutral-800/50">
                          {(['monthly', 'yearly'] as const).map((cycle) => (
                            <button
                              key={cycle}
                              onClick={() => { playClickSound(); setBillingCycle(cycle); }}
                              className={`py-1.5 text-[11px] font-mono uppercase tracking-wide rounded transition-all flex items-center justify-center gap-1.5 ${billingCycle === cycle ? 'bg-neutral-800 text-white shadow-sm' : 'text-neutral-500 hover:text-neutral-300'}`}
                            >
                              {cycle === 'monthly' ? (t('pricing.monthly') || 'Mensal') : (t('pricing.yearly') || 'Anual')}
                              {cycle === 'yearly' && (
                                <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${billingCycle === 'yearly' ? 'bg-brand-cyan/20 text-brand-cyan' : 'bg-neutral-800 text-neutral-500'}`}>-16%</span>
                              )}
                            </button>
                          ))}
                        </div>

                        {/* 2-column plan cards */}
                        <div className="grid grid-cols-2 gap-3">
                          {filteredPlans.map((plan) => {
                            const planPrice = currencyInfo?.currency === 'USD' && plan.priceUSD ? plan.priceUSD : plan.priceBRL;
                            const benefits = (plan.metadata?.features && Array.isArray(plan.metadata.features) ? plan.metadata.features : plan.description?.split(',') ?? []).slice(0, 4);
                            const isPopular = plan.displayOrder === 1;
                            return (
                              <div key={plan.id} className={`relative bg-neutral-900/40 border rounded-xl p-4 space-y-4 flex flex-col ${isPopular ? 'border-brand-cyan/40' : 'border-neutral-800/50'}`}>
                                {isPopular && (
                                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                                    <Badge className="bg-brand-cyan text-black font-bold text-[9px] uppercase tracking-widest px-2 py-0.5 rounded-b-md rounded-t-none whitespace-nowrap">
                                      {t('pricing.popular') || 'Popular'}
                                    </Badge>
                                  </div>
                                )}

                                {/* Name */}
                                <div className="pt-1">
                                  <p className="text-[9px] font-mono uppercase tracking-widest text-neutral-500 mb-0.5">Plano</p>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-base font-black text-white leading-tight">{plan.name}</span>
                                    {plan.metadata?.storageMB && parseInt(plan.metadata.storageMB) >= 5120 && (
                                      <Badge className="bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 text-[9px] px-1">BYOK</Badge>
                                    )}
                                  </div>
                                </div>

                                {/* Price */}
                                <div className="border-t border-neutral-800/40 pt-3">
                                  <p className="text-[9px] font-mono uppercase tracking-widest text-neutral-300 mb-1">
                                    {billingCycle === 'yearly' ? (t('pricing.perYear') || '/ano') : (t('pricing.perMonth') || '/mês')}
                                  </p>
                                  <span className="text-2xl font-black font-mono text-white tabular-nums">
                                    {formatPrice(planPrice, currencyInfo?.currency || 'BRL', currencyInfo?.locale || 'pt-BR')}
                                  </span>
                                  <div className="flex items-center gap-1 text-[9px] font-mono text-brand-cyan/60 uppercase mt-1">
                                    <Pickaxe size={9} />
                                    <span>{plan.credits} {t('pricing.creditsLabel') || 'créd/mês'}</span>
                                  </div>
                                </div>

                                {/* Benefits */}
                                <div className="space-y-1.5 flex-1">
                                  {benefits.map((benefit: string, idx: number) => (
                                    <div key={idx} className="flex items-start gap-1.5 text-[10px] font-mono text-neutral-300">
                                      <CheckCircle2 size={11} className="text-brand-cyan flex-shrink-0 mt-0.5" />
                                      <span>{benefit.trim()}</span>
                                    </div>
                                  ))}
                                </div>

                                {/* CTA */}
                                <Button
                                  onClick={() => {
                                    playClickSound();
                                    const link = currencyInfo?.currency === 'USD' ? plan.paymentLinkUSD : plan.paymentLinkBRL;
                                    if (link) window.location.href = link;
                                  }}
                                  className={`w-full text-xs font-mono font-semibold rounded-md transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5 ${isPopular ? 'bg-brand-cyan/80 hover:bg-brand-cyan text-black shadow-lg' : 'bg-neutral-800 hover:bg-neutral-700 text-white'}`}
                                >
                                  <CreditCard size={12} />
                                  {t('pricing.subscribe') || 'Assinar'}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12 text-neutral-600 font-mono text-sm">
                        {t('pricing.noPlansFound') || 'Nenhum plano disponível no momento.'}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Carteira tab ── */}
                {activeTab === 'carteira' && subscriptionStatus && (() => {
                  const {
                    hasActiveSubscription,
                    subscriptionTier,
                    monthlyCredits,
                    creditsUsed,
                    creditsResetDate,
                    totalCreditsEarned,
                    totalCredits,
                  } = subscriptionStatus;

                  const totalCreditsAvailable = typeof totalCredits === 'number'
                    ? totalCredits
                    : ((totalCreditsEarned ?? 0));

                  const usedPercentage = monthlyCredits > 0 ? Math.min(Math.round((creditsUsed / monthlyCredits) * 100), 100) : 0;

                  return (
                    <div className="animate-slide-in-left py-4 sm:py-6 space-y-3">
                      {/* Header: balance + tier */}
                      <div className="bg-neutral-900/40 border border-neutral-800/50 rounded-xl p-5 sm:p-6 space-y-5">
                        {/* Balance row */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-300 mb-1">
                              {t('credits.available') || 'Disponíveis'}
                            </p>
                            <div className="flex items-baseline gap-2">
                              <span className="text-4xl sm:text-5xl font-black font-mono text-white leading-none">
                                {totalCreditsAvailable}
                              </span>
                              <span className="text-xs font-mono text-brand-cyan/70 uppercase">
                                créditos
                              </span>
                            </div>
                          </div>
                          {subscriptionTier && (
                            <Badge className="bg-brand-cyan/10 text-brand-cyan border border-brand-cyan/20 text-[10px] font-mono uppercase tracking-widest px-2.5 py-1">
                              {subscriptionTier}
                            </Badge>
                          )}
                        </div>

                        {/* Monthly usage bar */}
                        {monthlyCredits > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[10px] font-mono uppercase tracking-widest text-neutral-300">
                              <span>Uso mensal</span>
                              <span>{creditsUsed} / {monthlyCredits}</span>
                            </div>
                            <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-brand-cyan/70 rounded-full transition-all duration-500"
                                style={{ width: `${usedPercentage}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Reset date */}
                        {creditsResetDate && (
                          <p className="text-[10px] font-mono text-neutral-300 uppercase tracking-widest">
                            {hasActiveSubscription
                              ? t('credits.renews', { date: formatDate(creditsResetDate) })
                              : t('credits.resets', { date: formatDate(creditsResetDate) })}
                          </p>
                        )}
                      </div>

                      {/* Model cost reference — expandable */}
                      <div className="border border-neutral-800/40 rounded-xl overflow-hidden">
                        <button
                          onClick={() => setShowStatusCosts(!showStatusCosts)}
                          className="w-full flex items-center justify-between px-4 py-3 text-[10px] font-mono uppercase tracking-widest text-neutral-300 hover:text-white hover:bg-neutral-900/40 transition-colors"
                          aria-expanded={showStatusCosts}
                        >
                          <span className="flex items-center gap-2">
                            <Pickaxe size={11} className="text-brand-cyan/70" />
                            Quanto rende por modelo
                          </span>
                          {showStatusCosts ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>

                        {showStatusCosts && (
                          <div className="px-4 pb-4 pt-1 bg-neutral-950/30 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex justify-between text-[10px] font-mono font-bold uppercase tracking-tight text-neutral-300 border-b border-neutral-800/60 pb-2 mb-2">
                              <span>Modelo / Resolução</span>
                              <span>Imagens</span>
                            </div>
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
                              <div key={idx} className="flex justify-between text-[10px] font-mono items-center">
                                <span className="text-neutral-300">{item.label}</span>
                                <span className="text-brand-cyan font-bold tabular-nums">{Math.floor(totalCreditsAvailable / item.cost)}</span>
                              </div>
                            ))}
                            <div className="flex justify-between text-[10px] font-mono items-center pt-2 border-t border-neutral-800/50 mt-1">
                              <span className="text-neutral-300">Veo 3 (Vídeo)</span>
                              <span className="text-brand-cyan font-bold tabular-nums">{Math.floor(totalCreditsAvailable / 15)} vídeos</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col gap-2 pt-1">
                        <Button
                          onClick={() => { playClickSound(); setActiveTab('creditos'); }}
                          className="w-full bg-brand-cyan/80 hover:bg-brand-cyan text-black font-semibold rounded-md text-xs sm:text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] shadow-lg"
                        >
                          <CreditCard size={14} />
                          {t('credits.buyCredits') || 'Comprar Créditos'}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            playClickSound();
                            onClose();
                            navigate('/profile');
                            setTimeout(() => {
                              document.getElementById('usage-history-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }, 300);
                          }}
                          className="w-full border-neutral-700/50 hover:border-neutral-600/50 bg-neutral-900/30 hover:bg-neutral-800/50 text-neutral-300 font-semibold rounded-md text-xs sm:text-sm font-mono transition-all duration-200 flex items-center justify-center gap-2"
                        >
                          <FileText size={14} />
                          {t('usageHistory.title') || 'Histórico de Uso'}
                        </Button>
                      </div>
                    </div>
                  );
                })()}

                {/* Carteira — no subscription */}
                {activeTab === 'carteira' && !subscriptionStatus && (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                    <p className="text-neutral-400 font-mono text-sm">
                      {t('credits.noSubscription') || 'Faça login para ver seus créditos disponíveis'}
                    </p>
                    <button
                      onClick={() => { playClickSound(); setActiveTab('creditos'); }}
                      className="text-[11px] text-brand-cyan hover:text-brand-cyan/80 font-mono uppercase tracking-widest transition-colors px-3 py-2 hover:bg-neutral-800/30 rounded"
                    >
                      {t('creditsPackages.buy') || 'Comprar'} →
                    </button>
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
