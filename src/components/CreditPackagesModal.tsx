import React, { useState, useEffect, useRef } from 'react';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useNavigate } from 'react-router-dom';
import {
  X,
  CreditCard,
  Plus,
  Minus,
  Pickaxe,
  QrCode,
  Info,
  FileText,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from '@/lib/ui/icons';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import {
  getUserLocale,
  formatPrice,
  formatDateShort,
  type CurrencyInfo,
} from '@/utils/localeUtils';
import {
  CREDIT_PACKAGES,
  getCreditPackageLink,
  getCreditPackagePrice,
} from '@/utils/creditPackages';
import { getCreditYieldRows } from '@/utils/creditCalculator';
import { trackEvent } from '@/utils/analytics';
import { useTranslation } from '@/hooks/useTranslation';
import type { SubscriptionStatus } from '../services/subscriptionService';
import { productService, type Product } from '../services/productService';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { glassSurface } from '@/lib/ui/glass';
import { cn } from '@/lib/utils';

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
  }, [targetValue, duration]);

  return displayValue;
};

interface CreditPackagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionStatus?: SubscriptionStatus | null;
  initialTab?: 'carteira' | 'creditos' | 'assinatura';
  /** Motivo do paywall (e.g. "limite de marcas atingido — 3/3") mostrado como banner. */
  contextMessage?: string | null;
}

const formatDate = (dateString: string | null): string => {
  if (!dateString) return '';
  try {
    return formatDateShort(dateString);
  } catch {
    return '';
  }
};

/** Tabela "quanto rende": era duplicada nas abas Créditos e Carteira. */
const CreditYieldTable: React.FC<{ credits: number }> = ({ credits }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          <Pickaxe size={11} className="text-muted-foreground" />
          {t('creditsModal.yieldTitle')}
        </span>
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 bg-muted/40 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex justify-between text-xs font-medium text-muted-foreground border-b border-border pb-2 mb-2">
            <span>{t('creditsModal.yieldModel')}</span>
            <span>{t('creditsModal.yieldImages')}</span>
          </div>
          {getCreditYieldRows().map((item, idx) => (
            <div key={idx} className="flex justify-between text-xs items-center">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="text-foreground font-medium tabular-nums">
                {Math.floor(credits / item.cost)}
              </span>
            </div>
          ))}
          <div className="flex justify-between text-xs items-center pt-2 border-t border-border mt-1">
            <span className="text-muted-foreground">Veo 3</span>
            <span className="text-foreground font-medium tabular-nums">
              {t('creditsModal.videoCount', { count: Math.floor(credits / 15) })}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export const CreditPackagesModal: React.FC<CreditPackagesModalProps> = ({
  isOpen,
  onClose,
  subscriptionStatus = null,
  initialTab = 'creditos',
  contextMessage = null,
}) => {
  useScrollLock(isOpen);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const defaultTab: 'carteira' | 'creditos' | 'assinatura' = subscriptionStatus
    ? 'carteira'
    : 'creditos';
  const [activeTab, setActiveTab] = useState<'carteira' | 'creditos' | 'assinatura'>(
    initialTab || defaultTab
  );
  const [subscriptionPlans, setSubscriptionPlans] = useState<Product[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

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
    productService.getSubscriptionPlans().then((plans) => {
      if (plans.length > 0) {
        setSubscriptionPlans(plans);
      }
    });
  }, []);

  // Filter plans by billing cycle
  const filteredPlans = subscriptionPlans.filter((plan) => {
    const isYearly =
      plan.metadata?.interval === 'year' ||
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
    localStorage.setItem(
      'credit_purchase_pending',
      JSON.stringify({
        timestamp: Date.now(),
        credits: currentPackage.credits,
      })
    );

    // Usar Payment Link diretamente
    const paymentLink = getCreditPackageLink(currentPackage.credits, currencyInfo.currency);
    if (!paymentLink) {
      console.error('Payment link not found for credits:', currentPackage.credits);
      return;
    }

    // Redireciona para o Payment Link do Stripe
    trackEvent('checkout_started', {
      type: 'credits',
      credits: currentPackage.credits,
      currency: currencyInfo.currency,
    });
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
      localStorage.setItem(
        'credit_purchase_pending',
        JSON.stringify({
          timestamp: Date.now(),
          credits: currentPackage.credits,
        })
      );

      trackEvent('checkout_started', {
        type: 'credits',
        method: 'pix',
        credits: currentPackage.credits,
        currency: 'BRL',
      });
      window.open(pixLink, '_blank');
    }
  };

  const price =
    currencyInfo && currentPackage
      ? getCreditPackagePrice(currentPackage.credits, currencyInfo.currency)
      : 0;

  const animatedCredits = useAnimatedCounter(currentPackage?.credits ?? 0, 280);
  const animatedPrice = useAnimatedCounter(price, 280);

  if (!currentPackage) return null;
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 sm:p-6 md:p-8 overflow-hidden"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          glassSurface.panelStrong,
          'w-full max-w-xl md:max-w-2xl rounded-xl relative max-h-full overflow-hidden flex flex-col animate-scale-in'
        )}
      >
        <Button
          variant="ghost"
          onClick={onClose}
          aria-label={t('common.close')}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors z-30 p-2 hover:bg-accent rounded-full"
        >
          <X size={20} />
        </Button>
        <div className="relative flex-1 w-full overflow-y-auto overflow-x-hidden">
          <div className="relative p-6 sm:p-8 md:p-10 z-10 w-full min-h-full">
            <div className="space-y-6 sm:space-y-8">
              {/* Header */}
              <div className="flex items-center gap-2 sm:gap-3 pb-2">
                <CreditCard size={16} className="text-muted-foreground" />
                <MicroTitle className="text-muted-foreground">
                  {activeTab === 'carteira' ? t('credits.title') : t('creditsPackages.title')}
                </MicroTitle>
              </div>

              {contextMessage && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 border border-warning/30 text-warning text-xs leading-relaxed">
                  {contextMessage}
                </div>
              )}

              {/* 3-tab bar */}
              <SegmentedControl
                aria-label={t('creditsModal.tabsLabel')}
                size="sm"
                fullWidth
                value={activeTab}
                onChange={(v) => {
                  playClickSound();
                  setActiveTab(v);
                }}
                options={[
                  { value: 'carteira', label: t('creditsModal.tabs.wallet') },
                  { value: 'creditos', label: t('creditsModal.tabs.credits') },
                  { value: 'assinatura', label: t('creditsModal.tabs.subscription') },
                ]}
              />

              {/* Tab Content */}
              <div className="relative overflow-hidden">
                {/* ── Créditos tab ── */}
                {activeTab === 'creditos' && (
                  <div>
                    <div className="animate-fade-in py-4 space-y-3">
                      {/* Package card */}
                      <div className="bg-muted/40 border border-border rounded-xl p-5 sm:p-6 space-y-5">
                        {/* Selector row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl sm:text-5xl font-semibold text-foreground leading-none tabular-nums">
                              {animatedCredits}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {t('creditsModal.unit')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              onClick={() => {
                                playClickSound();
                                handlePrevious();
                              }}
                              disabled={selectedIndex === 0}
                              aria-label={t('creditsModal.prevPackage')}
                              className="h-8 w-8 p-0 border-border bg-muted hover:bg-accent hover:border-border-hover disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground"
                            >
                              <Minus size={14} />
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => {
                                playClickSound();
                                handleNext();
                              }}
                              disabled={selectedIndex === CREDIT_PACKAGES.length - 1}
                              aria-label={t('creditsModal.nextPackage')}
                              className="h-8 w-8 p-0 border-border bg-muted hover:bg-accent hover:border-border-hover disabled:opacity-30 disabled:cursor-not-allowed text-muted-foreground"
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
                              onClick={() => {
                                playClickSound();
                                setSelectedIndex(index);
                              }}
                              aria-label={t('creditsModal.unitCount', {
                                count: CREDIT_PACKAGES[index].credits,
                              })}
                              aria-pressed={index === selectedIndex}
                              className={`h-1.5 rounded-full transition-[width,background-color] duration-300 ${
                                index === selectedIndex
                                  ? 'bg-brand-cyan w-6'
                                  : 'bg-muted hover:bg-muted-foreground w-1.5'
                              }`}
                            />
                          ))}
                        </div>

                        {/* Price row */}
                        {currencyInfo && price > 0 && (
                          <div className="pt-4 border-t border-border flex items-end justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                {t('pricing.oneTimePayment')}
                              </p>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-3xl sm:text-4xl font-medium text-foreground tabular-nums">
                                  {formatPrice(
                                    animatedPrice,
                                    currencyInfo.currency,
                                    currencyInfo.locale
                                  )}
                                </span>
                              </div>
                            </div>
                            <span className="text-2xs font-mono text-muted-foreground text-right leading-relaxed">
                              $0.067 Google
                              <br />
                              $0.013 Infra
                            </span>
                          </div>
                        )}
                      </div>

                      <CreditYieldTable credits={currentPackage.credits} />

                      {/* Action buttons */}
                      <div className="flex flex-col gap-2 pt-1">
                        <Button
                          variant="brand"
                          onClick={() => {
                            playClickSound();
                            handleBuyCredits();
                          }}
                          className="w-full"
                        >
                          <CreditCard size={14} />
                          {t('creditsPackages.buy')}
                        </Button>
                        {currencyInfo?.currency === 'BRL' &&
                          ABACATEPAY_LINKS[currentPackage.credits] && (
                            <Button
                              onClick={() => {
                                playClickSound();
                                handleBuyWithPix();
                              }}
                              className="w-full bg-success/80 hover:bg-success text-black"
                            >
                              <QrCode size={14} />
                              {t('pix.payWithPix')}
                            </Button>
                          )}
                        <button
                          onClick={() => {
                            playClickSound();
                            setActiveTab('assinatura');
                          }}
                          className="w-full inline-flex items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground text-xs transition-colors hover:bg-accent rounded-md py-2"
                        >
                          {t('creditsPackages.viewPlans')}
                          <ArrowRight size={12} />
                        </button>
                      </div>

                      <p className="text-xs text-muted-foreground text-center pt-1">
                        {t('creditsPackages.note')}
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Assinatura tab ── */}
                {activeTab === 'assinatura' && (
                  <div className="py-4 space-y-3 animate-fade-in">
                    {subscriptionPlans.length > 0 ? (
                      <>
                        {/* Billing toggle */}
                        <div className="grid grid-cols-2 bg-muted p-1 rounded-md border border-border">
                          {(['monthly', 'yearly'] as const).map((cycle) => (
                            <button
                              key={cycle}
                              onClick={() => {
                                playClickSound();
                                setBillingCycle(cycle);
                              }}
                              className={`py-1.5 text-xs rounded transition-[color,background-color,border-color,box-shadow] flex items-center justify-center gap-1.5 ${
                                billingCycle === cycle
                                  ? 'bg-secondary text-secondary-foreground shadow-sm'
                                  : 'text-muted-foreground hover:text-foreground'
                              }`}
                            >
                              {cycle === 'monthly' ? t('pricing.monthly') : t('pricing.yearly')}
                              {cycle === 'yearly' && (
                                <span
                                  className={`text-2xs px-1 py-0.5 rounded font-medium ${
                                    billingCycle === 'yearly'
                                      ? 'bg-success/10 text-success'
                                      : 'bg-muted text-muted-foreground'
                                  }`}
                                >
                                  -16%
                                </span>
                              )}
                            </button>
                          ))}
                        </div>

                        {/* 2-column plan cards */}
                        <div className="grid grid-cols-2 gap-3">
                          {filteredPlans.map((plan) => {
                            const planPrice =
                              currencyInfo?.currency === 'USD' && plan.priceUSD
                                ? plan.priceUSD
                                : plan.priceBRL;
                            const benefits = (
                              plan.metadata?.features && Array.isArray(plan.metadata.features)
                                ? plan.metadata.features
                                : (plan.description?.split(',') ?? [])
                            ).slice(0, 4);
                            const isPopular = plan.displayOrder === 1;
                            return (
                              <div
                                key={plan.id}
                                className={`relative bg-muted/40 border rounded-xl p-4 space-y-4 flex flex-col ${
                                  isPopular ? 'border-ring' : 'border-border'
                                }`}
                              >
                                {isPopular && (
                                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                                    <Badge
                                      variant="neutral"
                                      className="text-2xs px-2 py-0.5 rounded-b-md rounded-t-none whitespace-nowrap"
                                    >
                                      {t('pricing.popular')}
                                    </Badge>
                                  </div>
                                )}

                                {/* Name */}
                                <div className="pt-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-base font-medium text-foreground leading-tight">
                                      {plan.name}
                                    </span>
                                    {plan.metadata?.storageMB &&
                                      parseInt(plan.metadata.storageMB) >= 5120 && (
                                        <Badge variant="neutral" className="text-2xs px-1">
                                          BYOK
                                        </Badge>
                                      )}
                                  </div>
                                </div>

                                {/* Price */}
                                <div className="border-t border-border pt-3">
                                  <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-semibold text-foreground tabular-nums">
                                      {formatPrice(
                                        planPrice,
                                        currencyInfo?.currency || 'BRL',
                                        currencyInfo?.locale || 'pt-BR'
                                      )}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {billingCycle === 'yearly'
                                        ? t('pricing.perYear')
                                        : t('pricing.perMonth')}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                    <Pickaxe size={10} />
                                    <span>
                                      {t('creditsModal.unitCount', { count: plan.credits })}
                                    </span>
                                  </div>
                                </div>

                                {/* Benefits */}
                                <div className="space-y-1.5 flex-1">
                                  {benefits.map((benefit: string, idx: number) => (
                                    <div
                                      key={idx}
                                      className="flex items-start gap-1.5 text-xs text-muted-foreground"
                                    >
                                      <CheckCircle2
                                        size={11}
                                        className="text-muted-foreground flex-shrink-0 mt-0.5"
                                      />
                                      <span>{benefit.trim()}</span>
                                    </div>
                                  ))}
                                </div>

                                {/* CTA */}
                                <Button
                                  onClick={() => {
                                    playClickSound();
                                    const link =
                                      currencyInfo?.currency === 'USD'
                                        ? plan.paymentLinkUSD
                                        : plan.paymentLinkBRL;
                                    if (link) {
                                      trackEvent('checkout_started', {
                                        type: 'subscription',
                                        plan: plan.name,
                                        currency: currencyInfo?.currency,
                                      });
                                      window.location.href = link;
                                    }
                                  }}
                                  variant={isPopular ? 'brand' : 'secondary'}
                                  className="w-full text-xs"
                                >
                                  <CreditCard size={12} />
                                  {t('pricing.subscribe')}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground text-sm">
                        {t('pricing.noPlansFound')}
                      </div>
                    )}
                  </div>
                )}

                {/* ── Carteira tab ── */}
                {activeTab === 'carteira' &&
                  subscriptionStatus &&
                  (() => {
                    const {
                      hasActiveSubscription,
                      subscriptionTier,
                      monthlyCredits,
                      creditsUsed,
                      creditsResetDate,
                      totalCreditsEarned,
                      totalCredits,
                    } = subscriptionStatus;

                    const totalCreditsAvailable =
                      typeof totalCredits === 'number' ? totalCredits : (totalCreditsEarned ?? 0);

                    const usedPercentage =
                      monthlyCredits > 0
                        ? Math.min(Math.round((creditsUsed / monthlyCredits) * 100), 100)
                        : 0;

                    return (
                      <div className="animate-slide-in-left py-4 sm:py-6 space-y-3">
                        {/* Header: balance + tier */}
                        <div className="bg-muted/40 border border-border rounded-xl p-5 sm:p-6 space-y-5">
                          {/* Balance row */}
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">
                                {t('credits.available')}
                              </p>
                              <div className="flex items-baseline gap-2">
                                <span className="text-4xl sm:text-5xl font-semibold text-foreground leading-none tabular-nums">
                                  {totalCreditsAvailable}
                                </span>
                                <span className="text-sm text-muted-foreground">
                                  {t('creditsModal.unit')}
                                </span>
                              </div>
                            </div>
                            {subscriptionTier && (
                              <Badge variant="neutral" className="px-2.5 py-1">
                                {subscriptionTier}
                              </Badge>
                            )}
                          </div>

                          {/* Monthly usage bar */}
                          {monthlyCredits > 0 && (
                            <div className="space-y-1.5">
                              <div className="flex justify-between text-xs text-muted-foreground">
                                <span>{t('credits.monthlyUsage')}</span>
                                <span className="tabular-nums">
                                  {creditsUsed} / {monthlyCredits}
                                </span>
                              </div>
                              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-muted-foreground rounded-full transition-colors duration-500"
                                  style={{ width: `${usedPercentage}%` }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Reset date */}
                          {creditsResetDate && (
                            <p className="text-xs text-muted-foreground">
                              {hasActiveSubscription
                                ? t('credits.renews', { date: formatDate(creditsResetDate) })
                                : t('credits.resets', { date: formatDate(creditsResetDate) })}
                            </p>
                          )}
                        </div>

                        <CreditYieldTable credits={totalCreditsAvailable} />

                        {/* Action buttons */}
                        <div className="flex flex-col gap-2 pt-1">
                          <Button
                            variant="brand"
                            onClick={() => {
                              playClickSound();
                              setActiveTab('creditos');
                            }}
                            className="w-full"
                          >
                            <CreditCard size={14} />
                            {t('creditsPackages.title')}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => {
                              playClickSound();
                              onClose();
                              navigate('/profile');
                              setTimeout(() => {
                                document
                                  .getElementById('usage-history-section')
                                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }, 300);
                            }}
                            className="w-full text-muted-foreground"
                          >
                            <FileText size={14} />
                            {t('usageHistory.title')}
                          </Button>
                        </div>
                      </div>
                    );
                  })()}

                {/* Carteira — no subscription */}
                {activeTab === 'carteira' && !subscriptionStatus && (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                    <p className="text-muted-foreground text-sm">{t('credits.noSubscription')}</p>
                    <button
                      onClick={() => {
                        playClickSound();
                        setActiveTab('creditos');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-foreground transition-colors px-3 py-2 hover:bg-accent rounded"
                    >
                      {t('creditsPackages.title')}
                      <ArrowRight size={12} />
                    </button>
                  </div>
                )}
              </div>

              <div className="pt-6 mt-4 border-t border-border flex items-center gap-4">
                <a
                  href="https://github.com/visantlabs"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Pickaxe size={12} />
                  <span>{t('creditsModal.openSource')}</span>
                </a>
                <a
                  href="https://discord.gg/visant"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Info size={12} />
                  <span>{t('creditsModal.community')}</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
