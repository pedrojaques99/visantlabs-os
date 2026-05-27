import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageShell } from '@/components/ui/PageShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/authService';
import { toast } from 'sonner';
import { Palette, Megaphone, Code, Building2, ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { id: 'designer', label: 'Designer', icon: Palette, desc: 'UI/UX, branding, visual design' },
  { id: 'agency', label: 'Agency', icon: Building2, desc: 'Clients, campaigns, deliverables' },
  { id: 'marketing', label: 'Marketing', icon: Megaphone, desc: 'Social media, content, growth' },
  { id: 'developer', label: 'Developer', icon: Code, desc: 'Code, integrations, automation' },
] as const;

export const OnboardingWizardPage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleComplete = async (skip = false) => {
    setIsSubmitting(true);
    try {
      await authService.completeOnboarding(skip ? undefined : selectedCategory || undefined);
      toast.success('Bem-vindo a Visant Labs!');
      navigate('/mockupmachine');
    } catch {
      toast.error('Erro ao completar onboarding');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => handleComplete(true);

  return (
    <PageShell pageId="onboarding-wizard" title="Bem-vindo" seoTitle="Bem-vindo" hideHeader>
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
                  Isso nos ajuda a personalizar sua experiencia.
                </p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all text-center',
                        selectedCategory === cat.id
                          ? 'border-violet-500 bg-violet-500/10 text-white'
                          : 'border-neutral-700/50 bg-neutral-800/30 text-neutral-400 hover:border-neutral-600'
                      )}
                    >
                      <cat.icon className="w-6 h-6" />
                      <span className="text-sm font-mono font-medium">{cat.label}</span>
                      <span className="text-xs text-neutral-500">{cat.desc}</span>
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button variant="ghost" onClick={handleSkip} disabled={isSubmitting} className="flex-1">
                    Pular
                  </Button>
                  <Button
                    onClick={() => selectedCategory ? setStep(1) : handleComplete(true)}
                    disabled={isSubmitting}
                    className="flex-1 gap-2"
                  >
                    Continuar <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step-1"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
              >
                <h2 className="text-xl font-semibold text-white font-mono mb-2">Crie seu primeiro mockup</h2>
                <p className="text-neutral-400 text-sm font-mono mb-6">
                  Veja o poder da plataforma em acao. Crie um mockup profissional em segundos.
                </p>

                <div className="flex gap-3">
                  <Button variant="ghost" onClick={handleSkip} disabled={isSubmitting} className="flex-1">
                    Pular
                  </Button>
                  <Button
                    onClick={() => handleComplete(false)}
                    disabled={isSubmitting}
                    className="flex-1 gap-2"
                  >
                    <Check className="w-4 h-4" /> Vamos la!
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassPanel>
      </div>
    </PageShell>
  );
};
