import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass } from '@/lib/ui/icons';
import { useBrandGuidelines, hasRealBrand } from '@/hooks/queries/useBrandGuidelines';
import { FEATURE_ONBOARDING_V2 } from '@/config/featureFlags';
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Banner leve e persistente: "você está na marca demo, traga a sua".
// Não existe conceito global de marca ativa, então o banner cobre os dois casos:
// - com `brandId` (ferramentas que recebem ?brand=): mostra se AQUELA marca é demo;
// - sem `brandId` (BrandGuidelinesPage): mostra se o user só tem marca demo
//   (nenhuma marca real ativa ainda).
// Fica no fluxo da página (não `fixed`): flutuando, encavalava no h1.
interface DemoBrandBannerProps {
  brandId?: string | null;
  /** Override do CTA. Por padrão navega pra /brand-guidelines. */
  onCta?: () => void;
  className?: string;
}

export const DemoBrandBanner: React.FC<DemoBrandBannerProps> = ({ brandId, onCta, className }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { data: guidelines = [] } = useBrandGuidelines(FEATURE_ONBOARDING_V2);

  if (!FEATURE_ONBOARDING_V2) return null;

  const isDemoActive = brandId
    ? guidelines.some((g) => g.id === brandId && g.isDemo)
    : guidelines.some((g) => g.isDemo) && !hasRealBrand(guidelines);

  if (!isDemoActive) return null;

  return (
    <div
      className={cn(
        'relative z-10 flex shrink-0 items-center gap-3 border-b border-border bg-card px-4 py-2',
        className
      )}
      role="status"
      data-vsn-component="DemoBrandBanner"
    >
      <Compass size={14} className="text-warning shrink-0" />
      <p className="min-w-0 flex-1 truncate text-xs text-foreground">
        {t('onboarding.demoBanner.label')}
        <span className="hidden sm:inline text-muted-foreground">
          {': '}
          {t('onboarding.demoBanner.message')}
        </span>
      </p>
      <Button
        variant="outline"
        size="xs"
        className="shrink-0"
        onClick={onCta ?? (() => navigate('/brand-guidelines'))}
      >
        {t('onboarding.demoBanner.cta')}
      </Button>
    </div>
  );
};
