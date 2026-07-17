import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, CreditCard, Zap } from '@/lib/ui/icons';
import { getUserLocale, type CurrencyInfo } from '@/utils/localeUtils';
import { getCreditPackageLink } from '@/utils/creditPackages';
import { useTranslation } from '@/hooks/useTranslation';
import { trackEvent } from '@/utils/analytics';
import {
  BreadcrumbWithBack,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '../components/ui/BreadcrumbWithBack';
import { SEO } from '../components/SEO';
import { productService, type Product } from '../services/productService';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { MicroTitle } from '../components/ui/MicroTitle';
import { cn } from '../lib/utils';
import { authService, type User } from '../services/authService';
import { getPricingCopy } from './pricing/pricingCopy';
import {
  PRICING_TIERS,
  yearlyTotal,
  formatTierPrice,
  matchPlanForTier,
  paymentLinkFor,
  type BillingCycle,
  type Currency,
  type TierPricing,
} from './pricing/pricingTiers';
import { glassSurface } from '@/lib/ui/glass';

export const PricingPage: React.FC = () => {
  const { locale } = useTranslation();
  const navigate = useNavigate();
  const copy = getPricingCopy(locale);

  const [currencyInfo, setCurrencyInfo] = useState<CurrencyInfo | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const [subscriptionPlans, setSubscriptionPlans] = useState<Product[]>([]);
  const [creditPackages, setCreditPackages] = useState<Product[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currency: Currency = currencyInfo?.currency === 'USD' ? 'USD' : 'BRL';

  useEffect(() => {
    setCurrencyInfo(getUserLocale());
    productService.getSubscriptionPlans().then(setSubscriptionPlans);
    productService.getCreditPackages().then(setCreditPackages);
    authService
      .verifyToken()
      .then((user) => user && setCurrentUser(user))
      .catch((err) => console.error('Auth verification failed:', err));
  }, []);

  // Assinatura: reaproveita o payment link real da API (mesmo fluxo Stripe/Abacate
  // que a página usava). Sem link (API fora), cai pro fluxo de entrar no app.
  const handleSubscribe = (tier: TierPricing) => {
    const plan = matchPlanForTier(subscriptionPlans, tier.id, billingCycle);
    const link = paymentLinkFor(plan, currency);
    if (link) {
      trackEvent('checkout_started', {
        type: 'subscription',
        plan: tier.id,
        cycle: billingCycle,
        currency,
      });
      window.location.href = link;
      return;
    }
    navigate('/');
  };

  // Pacote avulso de créditos (rodapé discreto) — mesmo Stripe Payment Link
  // com client_reference_id que o fluxo antigo usava, pego o pacote mais barato.
  const handleBuyCredits = async () => {
    if (creditPackages.length === 0) return;
    const pkg = creditPackages[0];
    const user = currentUser || (await authService.ensureAuthenticated());

    localStorage.setItem(
      'credit_purchase_pending',
      JSON.stringify({ timestamp: Date.now(), credits: pkg.credits })
    );

    let paymentLink = currency === 'USD' ? pkg.paymentLinkUSD : pkg.paymentLinkBRL;
    if (!paymentLink) paymentLink = getCreditPackageLink(pkg.credits, currency);
    if (!paymentLink) {
      setError('Payment link not found for this package');
      return;
    }

    const separator = paymentLink.includes('?') ? '&' : '?';
    const params: string[] = [];
    if (user?.id) params.push(`client_reference_id=${user.id}`);
    if (user?.email) params.push(`prefilled_email=${encodeURIComponent(user.email)}`);
    trackEvent('checkout_started', { type: 'credit_package', credits: pkg.credits, currency });
    window.location.href = params.length
      ? `${paymentLink}${separator}${params.join('&')}`
      : paymentLink;
  };

  return (
    <>
      <SEO
        title={copy.seoTitle}
        description={copy.seoDescription}
        keywords="pricing, planos, preços"
      />

      <div
        className="min-h-screen bg-background text-muted-foreground pt-12 md:pt-14"
        data-vsn-page="pricing"
        data-vsn-component="pricing-v3"
      >
        <div className="max-w-6xl mx-auto px-4 pt-6 pb-24" data-vsn-region="content">
          <div className="mb-4">
            <BreadcrumbWithBack to="/">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/">{copy.breadcrumbHome}</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{copy.breadcrumbPricing}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </BreadcrumbWithBack>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-md p-4 text-sm text-destructive font-mono mb-8 text-center">
              {error}
            </div>
          )}

          {/* Header */}
          <div className="text-center mb-10 md:mb-12">
            <h1 className="text-4xl md:text-5xl font-semibold text-foreground mb-4 tracking-tight">
              {copy.title}
            </h1>
            <p className="text-muted-foreground text-sm md:text-base max-w-2xl mx-auto">
              {copy.subtitle}
            </p>
          </div>

          {/* Billing toggle — mensal / anual (anual = 2 meses grátis) */}
          <div className="flex justify-center mb-12">
            <div className={cn('relative inline-flex p-1 rounded-full', glassSurface.control)}>
              <div
                className={cn(
                  'absolute inset-y-1 rounded-full bg-brand-cyan transition-all duration-300 ease-out',
                  billingCycle === 'monthly'
                    ? 'left-1 w-[calc(50%-4px)]'
                    : 'left-1/2 w-[calc(50%-4px)]'
                )}
              />
              <Button
                variant="ghost"
                onClick={() => setBillingCycle('monthly')}
                className={cn(
                  'relative z-10 px-6 py-2 text-sm rounded-full min-w-[104px] transition-colors',
                  billingCycle === 'monthly'
                    ? 'text-black font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {copy.monthly}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setBillingCycle('yearly')}
                className={cn(
                  'relative z-10 px-6 py-2 text-sm rounded-full min-w-[104px] flex items-center justify-center gap-2 transition-colors',
                  billingCycle === 'yearly'
                    ? 'text-black font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {copy.yearly}
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-bold',
                    billingCycle === 'yearly'
                      ? 'bg-neutral-950/20 text-black'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {copy.yearlyBadge}
                </span>
              </Button>
            </div>
          </div>

          {/* 3 cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch max-w-5xl mx-auto">
            {PRICING_TIERS.map((tier) => {
              const tc = copy.tiers[tier.id];
              const monthly = tier.monthlyList[currency];
              const amount = billingCycle === 'yearly' ? yearlyTotal(monthly) : monthly;
              const priceStr = tier.free ? copy.free : formatTierPrice(amount, currency);
              const cycleSuffix = tier.free
                ? ''
                : billingCycle === 'yearly'
                  ? copy.perYear
                  : copy.perMonth;
              const regularBase = tier.regularMonthly?.[currency];
              const regular =
                regularBase != null && billingCycle === 'yearly'
                  ? yearlyTotal(regularBase)
                  : regularBase;

              return (
                <div
                  key={tier.id}
                  className={cn(
                    'relative flex flex-col rounded-2xl border bg-card p-6',
                    tier.recommended
                      ? 'border-brand-cyan/40 bg-brand-cyan/[0.03]'
                      : 'border-border'
                  )}
                  data-vsn-region={`tier-${tier.id}`}
                >
                  {/* Selo topo — recomendado (brand-cyan) ou early access (neutro) */}
                  {(tier.recommended || tier.earlyAccess) && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      {tier.recommended ? (
                        <Badge className="bg-brand-cyan text-black font-bold text-[10px] uppercase tracking-widest px-3 py-0.5 rounded-full">
                          {copy.recommended}
                        </Badge>
                      ) : (
                        <Badge className="bg-muted text-muted-foreground border-none text-[10px] uppercase tracking-widest px-3 py-0.5 rounded-full inline-flex items-center gap-1">
                          <Zap size={10} />
                          {copy.earlyAccess}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Nome + tagline */}
                  <div className="mb-5 mt-1">
                    <h2 className="text-xl font-bold text-foreground">{tc.name}</h2>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{tc.tagline}</p>
                  </div>

                  {/* Preço grande */}
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <span
                      className={cn(
                        'text-4xl font-bold font-mono tracking-tight',
                        tier.recommended ? 'text-brand-cyan' : 'text-foreground'
                      )}
                    >
                      {priceStr}
                    </span>
                    {cycleSuffix && (
                      <span className="text-sm text-muted-foreground font-mono">{cycleSuffix}</span>
                    )}
                  </div>

                  {/* Preço "normal" riscado — só quando o ativo é promo de lançamento (Vision) */}
                  {regular != null && (
                    <p className="mt-2 mb-1 text-xs font-mono text-muted-foreground">
                      <span className="line-through">
                        {formatTierPrice(regular, currency)}
                        {cycleSuffix}
                      </span>
                      {' · '}
                      <span className={tier.recommended ? 'text-brand-cyan' : 'text-muted-foreground'}>
                        {copy.launchLabel}
                      </span>
                      <span className="text-muted-foreground"> · {copy.launchNote}</span>
                    </p>
                  )}

                  {/* Créditos — uma linha fair-use + tradução em resultado legível */}
                  <p className="mt-4 text-xs text-muted-foreground font-mono">{tc.credits}</p>
                  <p
                    className={cn(
                      'mt-1 text-xs font-mono',
                      tier.recommended ? 'text-brand-cyan' : 'text-muted-foreground'
                    )}
                  >
                    {tc.creditsOutcome}
                  </p>

                  {/* BYOK — badge discreto */}
                  <div className="mt-2">
                    <Badge className="bg-muted text-muted-foreground border border-border text-[10px] font-mono px-2 py-0.5 rounded-md">
                      {copy.byokBadge}
                    </Badge>
                  </div>

                  {/* Features */}
                  <ul className="mt-5 space-y-2.5 flex-1">
                    {tc.features.map((feature) => (
                      <li
                        key={feature}
                        className="flex items-start gap-2.5 text-sm text-muted-foreground"
                      >
                        <Check
                          size={15}
                          className={cn(
                            'mt-0.5 shrink-0',
                            tier.recommended ? 'text-brand-cyan' : 'text-muted-foreground'
                          )}
                        />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="mt-6">
                    {tier.free ? (
                      <Button variant="outline" className="w-full" asChild>
                        <Link to="/?signup=1">{tc.cta}</Link>
                      </Button>
                    ) : (
                      <Button
                        variant={tier.recommended ? 'brand' : 'outline'}
                        className="w-full"
                        onClick={() => handleSubscribe(tier)}
                      >
                        <CreditCard size={14} className="mr-2" />
                        {tc.cta}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rodapé — pacote avulso de créditos, discreto */}
          {creditPackages.length > 0 && (
            <div className="mt-14 text-center flex items-center justify-center gap-2 flex-wrap">
              <MicroTitle as="span" className="text-muted-foreground">
                {copy.moreCreditsQuestion}
              </MicroTitle>
              <Button
                variant="link"
                onClick={handleBuyCredits}
                className="text-xs text-muted-foreground hover:text-foreground h-auto p-0"
              >
                {copy.moreCreditsCta}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
