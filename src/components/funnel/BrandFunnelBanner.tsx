import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass, X } from '@/lib/ui/icons';
import { FEATURE_FUNNEL_BANNER } from '@/config/featureFlags';
import { useTranslation } from '@/hooks/useTranslation';
import { authService } from '@/services/authService';
import { useBrandGuidelines, hasRealBrand } from '@/hooks/queries/useBrandGuidelines';
import { trackEvent } from '@/utils/analytics';

// Higiene de funil (plano Revenue-Centric §Fase 5, task 5.1): banner de 1 linha
// reutilizado nas free tools — "isso ficaria melhor com a sua marca". Segue o
// padrão visual do DemoBrandBanner (Fase 3), mas é dismissível por tool via
// localStorage e some sozinho quando o user já tem marca real conectada.
//
// Analytics: `funnel_banner_click` vai via trackEvent (PostHog local) porque a
// allowlist do POST /api/analytics/events só aceita 'onboarding_step' e
// 'brand_ingested'. TODO(backend): adicionar 'funnel_banner_click' à allowlist
// e espelhar o evento no endpoint próprio.

const dismissKey = (toolId: string) => `vsn_funnel_banner_dismissed:${toolId}`;

const isDismissed = (toolId: string): boolean => {
  try {
    return localStorage.getItem(dismissKey(toolId)) === '1';
  } catch {
    return false;
  }
};

interface BrandFunnelBannerProps {
  /** Identificador estável da tool (ex.: 'color-palette') — chave do dismiss. */
  toolId: string;
  className?: string;
}

export const BrandFunnelBanner: React.FC<BrandFunnelBannerProps> = ({ toolId, className }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(() => isDismissed(toolId));
  const isAuthenticated = authService.isAuthenticated();
  const { data: guidelines = [] } = useBrandGuidelines(FEATURE_FUNNEL_BANNER && isAuthenticated);

  if (!FEATURE_FUNNEL_BANNER || dismissed) return null;

  // Quem já conectou uma marca real não precisa do funil.
  if (hasRealBrand(guidelines)) return null;

  const handleDismiss = () => {
    try {
      localStorage.setItem(dismissKey(toolId), '1');
    } catch {
      /* localStorage indisponível — dismiss só na sessão */
    }
    setDismissed(true);
  };

  const handleCta = () => {
    trackEvent('funnel_banner_click', { tool: toolId, authenticated: isAuthenticated });
    navigate(isAuthenticated ? '/brand-guidelines' : '/welcome');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className={
        className ??
        'fixed top-12 md:top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-full border border-white/10 bg-neutral-950/80 backdrop-blur-xl pl-3 pr-1.5 py-1.5 max-w-[calc(100vw-2rem)]'
      }
      role="status"
      data-vsn-component="BrandFunnelBanner"
    >
      <Compass size={13} className="text-muted-foreground shrink-0" />
      <span className="font-mono text-2xs text-neutral-300 truncate">
        {t('funnel.banner.message')}
      </span>
      <button
        onClick={handleCta}
        className="shrink-0 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1 font-mono text-2xs uppercase tracking-widest text-neutral-200 transition-colors"
      >
        {t('funnel.banner.cta')}
      </button>
      <button
        onClick={handleDismiss}
        aria-label={t('funnel.banner.dismiss')}
        className="shrink-0 p-1 rounded-full text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        <X size={12} />
      </button>
    </motion.div>
  );
};
