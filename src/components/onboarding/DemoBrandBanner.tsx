import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Compass } from '@/lib/ui/icons';
import { useBrandGuidelines, hasRealBrand } from '@/hooks/queries/useBrandGuidelines';
import { FEATURE_ONBOARDING_V2 } from '@/config/featureFlags';
import { useTranslation } from '@/hooks/useTranslation';

// Banner leve e persistente: "você está na marca demo — traga a sua".
// Não existe conceito global de marca ativa, então o banner cobre os dois casos:
// - com `brandId` (ferramentas que recebem ?brand=): mostra se AQUELA marca é demo;
// - sem `brandId` (BrandGuidelinesPage): mostra se o user só tem marca demo
//   (nenhuma marca real ativa ainda).
interface DemoBrandBannerProps {
  brandId?: string | null;
  /** Override do CTA — por padrão navega pra /brand-guidelines. */
  onCta?: () => void;
}

export const DemoBrandBanner: React.FC<DemoBrandBannerProps> = ({ brandId, onCta }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: guidelines = [] } = useBrandGuidelines(FEATURE_ONBOARDING_V2);

  if (!FEATURE_ONBOARDING_V2) return null;

  const isDemoActive = brandId
    ? guidelines.some((g) => g.id === brandId && g.isDemo)
    : guidelines.some((g) => g.isDemo) && !hasRealBrand(guidelines);

  if (!isDemoActive) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed top-12 md:top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 rounded-full border border-white/10 bg-neutral-950/80 backdrop-blur-xl pl-3 pr-1.5 py-1.5 max-w-[calc(100vw-2rem)]"
      role="status"
      data-vsn-component="DemoBrandBanner"
    >
      <Compass size={13} className="text-warning shrink-0" />
      <span className="font-mono text-2xs text-neutral-300 truncate">
        {t('onboarding.demoBanner.label')}
        <span className="hidden sm:inline text-neutral-500">
          {' '}
          — {t('onboarding.demoBanner.message')}
        </span>
      </span>
      <button
        onClick={onCta ?? (() => navigate('/brand-guidelines'))}
        className="shrink-0 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1 font-mono text-2xs uppercase tracking-widest text-neutral-200 transition-colors"
      >
        {t('onboarding.demoBanner.cta')}
      </button>
    </motion.div>
  );
};
