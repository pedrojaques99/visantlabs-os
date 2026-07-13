import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageShell } from '@/components/ui/PageShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/authService';
import { toast } from 'sonner';
import { ArrowRight } from 'lucide-react';
import { FEATURE_ONBOARDING_V2 } from '@/config/featureFlags';
import { OnboardingWizardV2 } from '@/components/onboarding/OnboardingWizardV2';
import { PersonaGrid } from '@/components/onboarding/PersonaGrid';
import { SEGMENTS, DEFAULT_ROUTE } from '@/components/onboarding/onboardingSegments';

// Legacy wizard (flag off): 2 passos por persona, sem passo de marca.
// O wizard v2 (FEATURE_ONBOARDING_V2) adiciona o passo "Traga sua marca" para
// TODAS as personas — ver components/onboarding/OnboardingWizardV2.tsx.
const OnboardingWizardV1: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selected = SEGMENTS.find((s) => s.id === selectedId) || null;

  const finish = async (route: string, category?: string) => {
    setIsSubmitting(true);
    try {
      await authService.completeOnboarding(category);
      toast.success('Bem-vindo a Visant Labs!');
      navigate(route);
    } catch {
      toast.error('Erro ao completar onboarding');
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => finish(DEFAULT_ROUTE);

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
              <h2 className="text-xl font-semibold text-white font-mono mb-2">O que voce faz?</h2>
              <p className="text-neutral-400 text-sm font-mono mb-6">
                Isso nos leva direto a ferramenta certa pra voce.
              </p>

              <PersonaGrid selectedId={selectedId} onSelect={setSelectedId} />

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Pular
                </Button>
                <Button
                  onClick={() => (selected ? setStep(1) : handleSkip())}
                  disabled={isSubmitting}
                  className="flex-1 gap-2"
                >
                  Continuar <ArrowRight className="w-4 h-4" />
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
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-neutral-800/50 border border-white/10">
                  <selected.icon className="w-5 h-5 text-brand-cyan" />
                </div>
                <h2 className="text-xl font-semibold text-white font-mono">
                  {selected.actionTitle}
                </h2>
              </div>
              <p className="text-neutral-400 text-sm font-mono mb-6">{selected.actionDesc}</p>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setStep(0)}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  Voltar
                </Button>
                <Button
                  onClick={() => finish(selected.route, selected.id)}
                  disabled={isSubmitting}
                  className="flex-1 gap-2"
                >
                  {selected.actionCta} <ArrowRight className="w-4 h-4" />
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
  return (
    <PageShell pageId="onboarding-wizard" title="Bem-vindo" seoTitle="Bem-vindo" hideHeader>
      {FEATURE_ONBOARDING_V2 ? <OnboardingWizardV2 /> : <OnboardingWizardV1 />}
    </PageShell>
  );
};
