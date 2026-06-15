import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PageShell } from '@/components/ui/PageShell';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { authService } from '@/services/authService';
import { toast } from 'sonner';
import { Palette, Megaphone, Code, Building2, ArrowRight, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

// Each persona gets a tailored first action + destination route. This is the core
// of brand-first onboarding: send the user to the tool that matches their job,
// instead of dumping everyone on the mockup machine.
interface Segment {
  id: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  route: string;
  actionTitle: string;
  actionDesc: string;
  actionCta: string;
}

const SEGMENTS: Segment[] = [
  {
    id: 'designer',
    label: 'Designer',
    desc: 'UI/UX, branding, visual design',
    icon: Palette,
    route: '/mockupmachine',
    actionTitle: 'Crie seu primeiro mockup',
    actionDesc: 'Veja o poder da plataforma em acao — um mockup profissional em segundos.',
    actionCta: 'Criar mockup',
  },
  {
    id: 'agency',
    label: 'Agency',
    desc: 'Clientes, campanhas, entregas',
    icon: Building2,
    route: '/brand-guidelines',
    actionTitle: 'Centralize a marca dos seus clientes',
    actionDesc:
      'Uma fonte de verdade por cliente — compartilhe, gere e repita sem copiar hex na mao.',
    actionCta: 'Criar brand guideline',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    desc: 'Redes sociais, conteudo, growth',
    icon: Megaphone,
    route: '/content-studio',
    actionTitle: 'Gere conteudo para todas as redes',
    actionDesc: 'Um brief, varias pecas — copy e imagem consistentes com a marca, de uma vez.',
    actionCta: 'Abrir Content Studio',
  },
  {
    id: 'developer',
    label: 'Developer',
    desc: 'Codigo, integracoes, automacao',
    icon: Code,
    route: '/developer/getting-started',
    actionTitle: 'Conecte via API e MCP',
    actionDesc:
      'Design tokens como codigo e contexto de marca em qualquer agente. Comece pelos docs.',
    actionCta: 'Ver documentacao',
  },
];

const DEFAULT_ROUTE = '/mockupmachine';

export const OnboardingWizardPage: React.FC = () => {
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
                  Isso nos leva direto a ferramenta certa pra voce.
                </p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {SEGMENTS.map((seg) => (
                    <button
                      key={seg.id}
                      onClick={() => setSelectedId(seg.id)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-4 rounded-lg border transition-all text-center',
                        selectedId === seg.id
                          ? 'border-brand-cyan/40 bg-brand-cyan/5 text-white'
                          : 'border-neutral-700/50 bg-neutral-800/30 text-neutral-400 hover:border-neutral-600'
                      )}
                    >
                      <seg.icon className="w-6 h-6" />
                      <span className="text-sm font-mono font-medium">{seg.label}</span>
                      <span className="text-xs text-neutral-500">{seg.desc}</span>
                    </button>
                  ))}
                </div>

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
    </PageShell>
  );
};
