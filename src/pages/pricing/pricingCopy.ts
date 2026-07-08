/**
 * Pricing v3 — copy bilíngue LOCAL (pt/en).
 *
 * TODO: migrar pro src/locales/*.json quando as sessões paralelas liberarem os
 * arquivos. Mantido local de propósito: evita (1) a salada PT/EN da página v2 e
 * (2) colidir com outras sessões que estão editando os locales compartilhados
 * AO VIVO. Toda string visível da página sai daqui — nada hardcoded no JSX.
 */
import type { TierId } from './pricingTiers';

export type PricingLang = 'pt' | 'en';

/** i18n.language começa com 'pt' → pt; senão en. */
export const pricingLang = (locale: string): PricingLang =>
  locale?.toLowerCase().startsWith('pt') ? 'pt' : 'en';

interface TierCopy {
  name: string;
  tagline: string;
  /** Uma linha "fair-use" de créditos por card. */
  credits: string;
  /** Features da tabela travada (sem repetir créditos). */
  features: string[];
  cta: string;
}

interface PricingCopy {
  seoTitle: string;
  seoDescription: string;
  breadcrumbHome: string;
  breadcrumbPricing: string;
  title: string;
  subtitle: string;
  monthly: string;
  yearly: string;
  yearlyBadge: string;
  perMonth: string;
  perYear: string;
  free: string;
  recommended: string;
  earlyAccess: string;
  founderLabel: string;
  founderNote: string;
  byokBadge: string;
  moreCreditsQuestion: string;
  moreCreditsCta: string;
  tiers: Record<TierId, TierCopy>;
}

const PRICING_COPY: Record<PricingLang, PricingCopy> = {
  pt: {
    seoTitle: 'Preços e planos',
    seoDescription:
      'Planos simples: Starter, Pro e Vision. Marcas ilimitadas, Copilot, MCP e BYOK.',
    breadcrumbHome: 'Início',
    breadcrumbPricing: 'Preços',
    title: 'Planos',
    subtitle:
      'Um plano por marca ou infinitas marcas. Sem cobrança por seat, com Copilot e API em todos.',
    monthly: 'Mensal',
    yearly: 'Anual',
    yearlyBadge: '2 meses grátis',
    perMonth: '/mês',
    perYear: '/ano',
    free: 'Grátis',
    recommended: 'Recomendado',
    earlyAccess: 'Early access',
    founderLabel: 'Preço fundador',
    founderNote: 'primeiros 200 · travado enquanto assinar',
    byokBadge: 'BYOK · use sua chave, economize crédito',
    moreCreditsQuestion: 'Precisa de mais créditos?',
    moreCreditsCta: 'Comprar pacote avulso',
    tiers: {
      starter: {
        name: 'Starter',
        tagline: 'Pra experimentar e lançar a primeira marca.',
        credits: '50 créditos/mês (resetam) · fair-use',
        features: [
          '1 marca ativa',
          '1 GB de storage',
          '1 seat',
          'Copilot, MCP e API',
          'Experimentais: 3D, vídeo, playground',
        ],
        cta: 'Começar grátis',
      },
      pro: {
        name: 'Pro',
        tagline: 'Pra quem toca várias marcas em produção.',
        credits: '500 créditos/mês (resetam) · fair-use',
        features: [
          'Marcas ilimitadas',
          '20 GB de storage',
          '5 seats — sem cobrar por seat',
          'Copilot, MCP e API',
          'Experimentais: 3D, vídeo, playground',
        ],
        cta: 'Assinar Pro',
      },
      vision: {
        name: 'Vision',
        tagline: 'Topo de linha: prioridade e acesso antecipado.',
        credits: '1000 créditos/mês + fair-use',
        features: [
          'Marcas ilimitadas',
          '100 GB de storage',
          'Seats ilimitados',
          'Copilot prioritário, MCP e API',
          'Early access: 3D, vídeo, playground',
        ],
        cta: 'Assinar Vision',
      },
    },
  },
  en: {
    seoTitle: 'Pricing & plans',
    seoDescription:
      'Simple plans: Starter, Pro and Vision. Unlimited brands, Copilot, MCP and BYOK.',
    breadcrumbHome: 'Home',
    breadcrumbPricing: 'Pricing',
    title: 'Plans',
    subtitle: 'One brand or infinite brands. No per-seat billing, Copilot and API on every plan.',
    monthly: 'Monthly',
    yearly: 'Yearly',
    yearlyBadge: '2 months free',
    perMonth: '/mo',
    perYear: '/yr',
    free: 'Free',
    recommended: 'Recommended',
    earlyAccess: 'Early access',
    founderLabel: 'Founding price',
    founderNote: 'first 200 · locked while subscribed',
    byokBadge: 'BYOK · use your key, save credits',
    moreCreditsQuestion: 'Need more credits?',
    moreCreditsCta: 'Buy a credit pack',
    tiers: {
      starter: {
        name: 'Starter',
        tagline: 'To try it out and launch your first brand.',
        credits: '50 credits/mo (reset) · fair-use',
        features: [
          '1 active brand',
          '1 GB storage',
          '1 seat',
          'Copilot, MCP and API',
          'Experimental: 3D, video, playground',
        ],
        cta: 'Start free',
      },
      pro: {
        name: 'Pro',
        tagline: 'For running several brands in production.',
        credits: '500 credits/mo (reset) · fair-use',
        features: [
          'Unlimited brands',
          '20 GB storage',
          '5 seats — no per-seat billing',
          'Copilot, MCP and API',
          'Experimental: 3D, video, playground',
        ],
        cta: 'Subscribe to Pro',
      },
      vision: {
        name: 'Vision',
        tagline: 'Top tier: priority and early access.',
        credits: '1000 credits/mo + fair-use',
        features: [
          'Unlimited brands',
          '100 GB storage',
          'Unlimited seats',
          'Priority Copilot, MCP and API',
          'Early access: 3D, video, playground',
        ],
        cta: 'Subscribe to Vision',
      },
    },
  },
};

export const getPricingCopy = (locale: string): PricingCopy => PRICING_COPY[pricingLang(locale)];
