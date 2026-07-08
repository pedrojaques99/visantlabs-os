/**
 * Pricing v3 — canonical tier data (Starter / Pro / Vision).
 *
 * Fonte da verdade travada pelo founder. Os NÚMEROS aqui são o fallback de
 * exibição; o CHECKOUT usa os payment links reais vindos de /payments/products
 * (productService), casados por `metadata.tier` (ver matchPlanForTier). Assim o
 * layout fica travado no design e a compra continua real.
 */
import type { Product } from '../../services/productService';

export type TierId = 'starter' | 'pro' | 'vision';
export type BillingCycle = 'monthly' | 'yearly';
export type Currency = 'BRL' | 'USD';

export interface TierPricing {
  id: TierId;
  free?: boolean;
  /** Único card com destaque brand-cyan. */
  recommended?: boolean;
  /** Selo "early access" no topo. */
  earlyAccess?: boolean;
  /** Preço de lista MENSAL por moeda. Anual = mensal × 10 (2 meses grátis). */
  monthlyList: Record<Currency, number>;
  /** Preço fundador travado (mensal) — ribbon nos primeiros 200. */
  founderMonthly?: Record<Currency, number>;
}

/** Tabela canônica travada. */
export const PRICING_TIERS: TierPricing[] = [
  {
    id: 'starter',
    free: true,
    monthlyList: { BRL: 0, USD: 0 },
  },
  {
    id: 'pro',
    recommended: true,
    monthlyList: { BRL: 49, USD: 12 },
    founderMonthly: { BRL: 29, USD: 7 },
  },
  {
    id: 'vision',
    earlyAccess: true,
    monthlyList: { BRL: 149, USD: 29 },
    founderMonthly: { BRL: 89, USD: 18 },
  },
];

/** Anual paga 10 meses (2 grátis). Total do ano por moeda. */
export const yearlyTotal = (monthly: number): number => monthly * 10;

/** Moeda por locale: R$ no pt-BR, US$ no en-US. Inteiros (preços redondos). */
export const formatTierPrice = (amount: number, currency: Currency): string =>
  currency === 'BRL'
    ? `R$${amount.toLocaleString('pt-BR')}`
    : `US$${amount.toLocaleString('en-US')}`;

const isYearlyPlan = (p: Product): boolean =>
  (p.metadata as any)?.interval === 'year' || /anual|yearly|annual/i.test(p.name || '');

/**
 * Casa um Product da API ao tier + ciclo, pra reaproveitar o payment link real.
 * Match por metadata.tier (SSoT do backend) com fallback pra productId/name.
 */
export const matchPlanForTier = (
  plans: Product[],
  tierId: TierId,
  cycle: BillingCycle
): Product | undefined =>
  plans.find((p) => {
    const tier = String((p.metadata as any)?.tier || '').toLowerCase();
    const haystack = `${p.productId || ''} ${p.name || ''}`.toLowerCase();
    const matchesTier = tier === tierId || haystack.includes(tierId);
    const matchesCycle = cycle === 'yearly' ? isYearlyPlan(p) : !isYearlyPlan(p);
    return matchesTier && matchesCycle;
  });

/** Payment link da moeda ativa, com fallback pra outra se faltar. */
export const paymentLinkFor = (plan: Product | undefined, currency: Currency): string | null => {
  if (!plan) return null;
  return currency === 'USD'
    ? plan.paymentLinkUSD || plan.paymentLinkBRL
    : plan.paymentLinkBRL || plan.paymentLinkUSD;
};
