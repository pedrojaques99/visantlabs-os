import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageShell } from '@/components/ui/PageShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/authService';
import { toast } from 'sonner';
import { ArrowRight } from '@/lib/ui/icons';
import { useTranslation } from '@/hooks/useTranslation';
import { FEATURE_ONBOARDING_V2 } from '@/config/featureFlags';
import { OnboardingWizardV2 } from '@/components/onboarding/OnboardingWizardV2';
import { PersonaGrid } from '@/components/onboarding/PersonaGrid';
import { SEGMENTS, NO_BRAND_ROUTE } from '@/components/onboarding/onboardingSegments';

// Legacy wizard (flag off): 2 passos por persona, sem passo de marca.
// O wizard v2 (FEATURE_ONBOARDING_V2) adiciona o passo "Traga sua marca" para
// TODAS as personas — ver components/onboarding/OnboardingWizardV2.tsx.
const OnboardingWizardV1: React.FC = () => {
  const { t, tOr } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selected = SEGMENTS.find((s) => s.id === selectedId) || null;

  const finish = async (route: string, category?: string) => {
    setIsSubmitting(true);
    try {
      await authService.completeOnboarding(category);
      toast.success(t('onboarding.welcomeToast'));
      navigate(route);
    } catch {
      toast.error(t('onboarding.finishError'));
      setIsSubmitting(false);
    }
  };

  // O v1 NUNCA cria marca (não tem passo de marca), então quem pula aqui sai do
  // onboarding com zero marcas — o mesmo estado órfão do v2 quando a demo falha.
  // Por isso o destino é NO_BRAND_ROUTE e não DEFAULT_ROUTE: sem marca, o
  // mockupmachine entrega metade do produto. Não há o que avisar aqui (nada
  // falhou, o usuário só pulou), então não há toast: só o destino honesto.
  const handleSkip = () => finish(NO_BRAND_ROUTE);

  return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <GlassPanel className="max-w-lg w-full p-8">
        <AnimatePresence mode="wait">
          {step === 0 && (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {t('onboarding.persona.title')}
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                {t('onboarding.persona.subtitle')}
              </p>

              <PersonaGrid selectedId={selectedId} onSelect={setSelectedId} />

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {t('onboarding.skip')}
                </Button>
                <Button
                  onClick={() => (selected ? setStep(1) : handleSkip())}
                  disabled={isSubmitting}
                  className="flex-1 gap-2"
                >
                  {t('onboarding.continue')} <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === 1 && selected && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              <h2 className="text-xl font-semibold text-foreground mb-2">
                {tOr(`onboarding.persona.${selected.id}.actionTitle`, selected.actionTitle)}
              </h2>
              <p className="text-muted-foreground text-sm mb-6">
                {tOr(`onboarding.persona.${selected.id}.actionDesc`, selected.actionDesc)}
              </p>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setStep(0)}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {t('onboarding.back')}
                </Button>
                <Button
                  onClick={() => finish(selected.route, selected.id)}
                  disabled={isSubmitting}
                  className="flex-1 gap-2"
                >
                  {tOr(`onboarding.persona.${selected.id}.actionCta`, selected.actionCta)}{' '}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassPanel>
    </div>
  );
};

export const OnboardingWizardPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <PageShell
      pageId="onboarding-wizard"
      title={t('onboarding.pageTitle')}
      seoTitle={t('onboarding.pageTitle')}
      hideHeader
    >
      {FEATURE_ONBOARDING_V2 ? <OnboardingWizardV2 /> : <OnboardingWizardV1 />}
    </PageShell>
  );
};
