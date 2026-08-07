import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandGuidelineWizardModal } from '@/components/mockupmachine/BrandGuidelineWizardModal';
import { authService } from '@/services/authService';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { onboardingApi } from '@/services/onboardingApi';
import { isBrandLimitError } from '@/hooks/queries/useBrandGuidelines';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';
import { useTranslation } from '@/hooks/useTranslation';
import { toast } from 'sonner';
import { ArrowRight, Upload, PencilLine, Compass, Loader2 } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { PersonaGrid } from './PersonaGrid';
import { SEGMENTS, DEFAULT_ROUTE, NO_BRAND_ROUTE, type Segment } from './onboardingSegments';
import type { BrandGuideline } from '@/lib/figma-types';

// Wizard v2 (FEATURE_ONBOARDING_V2) — onboarding brand-first de verdade.
// Passo 0: persona (mantido do v1). Passo 1: "Traga sua marca" — ingestão
// existente reusada (modal), mini-form de 60s ou marca demo. Passo 2: ação da
// persona PRÉ-CARREGADA com a marca. Regra de ouro: ninguém chega numa
// ferramenta sem brandGuidelineId — real, mínima ou demo.

type BrandPath = 'real' | 'minimal' | 'demo';

/** Persona → rota final, sempre com a marca na mão quando houver. */
const routeFor = (seg: Segment | null, brandId: string | null): string => {
  if (!seg) return brandId ? `${DEFAULT_ROUTE}?brand=${brandId}` : NO_BRAND_ROUTE;
  if (seg.id === 'agency') return brandId ? `/brand-guidelines?id=${brandId}` : seg.route;
  return brandId ? `${seg.route}?brand=${brandId}` : seg.route;
};

export const OnboardingWizardV2: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setActiveBrand } = useActiveBrand();

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [brandPath, setBrandPath] = useState<BrandPath | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Passo 1 — ingestão embutida (modal existente) + mini-form
  const [isIngestOpen, setIsIngestOpen] = useState(false);
  const [showMiniForm, setShowMiniForm] = useState(false);
  const [isCreatingDemo, setIsCreatingDemo] = useState(false);

  // Mini-form de 60s: nome + 2 cores + tom
  const [miniName, setMiniName] = useState('');
  const [miniColor1, setMiniColor1] = useState('#111111');
  const [miniColor2, setMiniColor2] = useState('#00c2d4');
  const [miniTone, setMiniTone] = useState('');
  const [isCreatingMinimal, setIsCreatingMinimal] = useState(false);

  const selected = SEGMENTS.find((s) => s.id === selectedId) || null;
  const isBusy = isSubmitting || isCreatingDemo || isCreatingMinimal;

  /** Retorna `true` só quando concluiu e navegou — o caller decide o que dizer depois. */
  const finish = async (
    route: string,
    category?: string,
    finalBrandId?: string | null
  ): Promise<boolean> => {
    setIsSubmitting(true);
    try {
      await authService.completeOnboarding(category, finalBrandId ?? undefined);
      onboardingApi.trackStep('complete', category ?? null, !category);
      toast.success(t('onboarding.welcomeToast'));
      navigate(route);
      return true;
    } catch {
      toast.error(t('onboarding.finishError'));
      setIsSubmitting(false);
      return false;
    }
  };

  const advanceWithBrand = (guideline: BrandGuideline, path: BrandPath) => {
    const id = guideline.id ?? null;
    setBrandId(id);
    setBrandPath(path);
    // Persiste a marca recém-criada como ATIVA (localStorage) já aqui — senão, na
    // primeira visita a '/', o HomeRoute lê activeBrand=null e faz bounce pro grid
    // em vez de abrir o cockpit (COCKPIT_HOME). Ver ActiveBrandContext (init lê LS).
    if (id) setActiveBrand(id);
    onboardingApi.trackStep('brand', selectedId, path === 'demo');
    setStep(2);
  };

  // Caminho (c): marca demo — nunca trava o wizard; erro cai no mini-form.
  const handleDemoPath = async (): Promise<BrandGuideline | null> => {
    setIsCreatingDemo(true);
    try {
      const guideline = await onboardingApi.createDemoBrand();
      return guideline;
    } catch {
      toast.warning(t('onboarding.demoError'));
      setShowMiniForm(true);
      return null;
    } finally {
      setIsCreatingDemo(false);
    }
  };

  const handleExplore = async () => {
    const guideline = await handleDemoPath();
    if (guideline) advanceWithBrand(guideline, 'demo');
  };

  // Caminho (b): marca mínima de 60s — nome + 2 cores + tom.
  const handleCreateMinimal = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = miniName.trim();
    if (!name || isCreatingMinimal) return;
    setIsCreatingMinimal(true);
    try {
      // Contrato backend Fase 3: POST /brand-guidelines aceita payload mínimo
      // {name, colors[2], toneOfVoice}. `identity.name` vai junto por compat
      // com o shape que o restante do frontend lê.
      const guideline = await brandGuidelineApi.create({
        name,
        identity: { name },
        colors: [
          { hex: miniColor1, name: 'Primary', role: 'primary' },
          { hex: miniColor2, name: 'Secondary', role: 'secondary' },
        ],
        toneOfVoice: miniTone.trim() || undefined,
      } as Partial<BrandGuideline>);
      toast.success(t('onboarding.manualCreated'));
      advanceWithBrand(guideline, 'minimal');
    } catch (err) {
      if (isBrandLimitError(err)) {
        toast.error(t('brandQuota.limitMessage', { used: err.used ?? '?', max: err.max ?? '?' }));
      } else {
        toast.error(t('onboarding.manualError'));
      }
    } finally {
      setIsCreatingMinimal(false);
    }
  };

  // Caminho (a): ingestão real reusando o modal existente (PDF/URL/imagens/Figma,
  // com loading honesto). Se a ingestão falhar lá dentro, a guideline já foi
  // criada e o modal ainda chama onSuccess — nunca travamos o wizard. Se o user
  // fechar sem concluir, volta pro passo 1 com o mini-form disponível (fallback).
  const handleIngestSuccess = (id: string) => {
    setIsIngestOpen(false);
    toast.success(t('onboarding.ingestDone'));
    advanceWithBrand({ id } as BrandGuideline, 'real');
  };

  // Recuperação do "pular" que ficou sem marca: roda fora do wizard (o toast vive
  // no Toaster global), então navega e ativa a marca por conta própria. Reanexa a
  // marca ao onboarding JÁ concluído — /auth/complete-onboarding é idempotente e
  // só grava `onboardingBrandGuidelineId` quando o brandGuidelineId é do usuário.
  const retryDemoBrand = async () => {
    try {
      const guideline = await onboardingApi.createDemoBrand();
      const id = guideline.id ?? null;
      if (!id) throw new Error('demo brand without id');
      setActiveBrand(id);
      await authService.completeOnboarding(selected?.id, id).catch(() => {});
      onboardingApi.trackStep('skip_demo_recovered', selectedId, true);
      toast.success(t('onboarding.skipDemoRetryDone'));
      navigate(routeFor(selected, id));
    } catch {
      onboardingApi.trackStep('skip_demo_retry_failed', selectedId, true);
      toast.error(t('onboarding.skipDemoRetryError'));
    }
  };

  // "Pular" total — passa pelo caminho demo (regra de ouro): a ferramenta de
  // destino sempre recebe uma marca. Se até o demo falhar, seguimos sem marca
  // (nunca bloquear o signup), MAS sem mentir: o usuário é avisado do que falhou,
  // ganha um retry e vai parar em NO_BRAND_ROUTE (a superfície onde ele traz a
  // marca), não num gerador que sem marca entrega metade do valor. O silêncio era
  // o defeito aqui, não a resiliência.
  const handleSkipAll = async () => {
    if (isBusy) return;
    setIsCreatingDemo(true);
    let demoId: string | null = null;
    try {
      const guideline = await onboardingApi.createDemoBrand();
      demoId = guideline.id ?? null;
    } catch {
      /* tratado abaixo — o erro NÃO é engolido */
    } finally {
      setIsCreatingDemo(false);
    }
    // Resposta 2xx sem id conta como falha: o efeito pro usuário é o mesmo.
    const demoFailed = !demoId;

    onboardingApi.trackStep('skip', selectedId, true);
    if (demoFailed) onboardingApi.trackStep('skip_demo_failed', selectedId, true);

    // Mesma razão do advanceWithBrand: sem isso o HomeRoute lê activeBrand=null.
    if (demoId) setActiveBrand(demoId);

    const done = await finish(
      demoFailed ? NO_BRAND_ROUTE : routeFor(selected, demoId),
      selected?.id,
      demoId
    );
    // Só avisa depois de realmente ter saído do wizard — se o finish falhou, o
    // usuário continua aqui e o toast de erro dele já é a mensagem certa.
    if (done && demoFailed) {
      toast.warning(t('onboarding.skipDemoError'), {
        duration: 10000,
        action: {
          label: t('onboarding.skipDemoRetry'),
          onClick: () => void retryDemoBrand(),
        },
      });
    }
  };

  const handleContinueFromPersona = () => {
    if (!selected) {
      void handleSkipAll();
      return;
    }
    onboardingApi.trackStep('persona', selected.id);
    setStep(1);
  };

  const pathCard =
    'w-full flex items-start gap-3 p-4 rounded-lg border text-left transition-[color,background-color,border-color,opacity] border-neutral-700/50 bg-neutral-800/30 hover:border-neutral-600 disabled:opacity-50';

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
              <h2 className="text-xl font-semibold text-white font-mono mb-2">
                {t('onboarding.persona.title')}
              </h2>
              <p className="text-neutral-400 text-sm font-mono mb-6">
                {t('onboarding.persona.subtitle')}
              </p>

              <PersonaGrid selectedId={selectedId} onSelect={setSelectedId} />

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={handleSkipAll}
                  disabled={isBusy}
                  className="flex-1"
                >
                  {t('onboarding.skip')}
                </Button>
                <Button
                  onClick={handleContinueFromPersona}
                  disabled={isBusy}
                  className="flex-1 gap-2"
                >
                  {t('onboarding.continue')} <ArrowRight className="w-4 h-4" />
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
              <h2 className="text-xl font-semibold text-white font-mono mb-2">
                {t('onboarding.step1Title')}
              </h2>
              <p className="text-neutral-400 text-sm font-mono mb-6">
                {t('onboarding.step1Subtitle')}
              </p>

              <div className="flex flex-col gap-3 mb-6">
                {/* (a) Ingestão real — PDF / URL / imagens / Figma */}
                <button
                  onClick={() => setIsIngestOpen(true)}
                  disabled={isBusy}
                  className={pathCard}
                >
                  <Upload className="w-5 h-5 mt-0.5 shrink-0 text-neutral-400" />
                  <span className="min-w-0">
                    <span className="block text-sm font-mono font-medium text-white">
                      {t('onboarding.pathIngestTitle')}
                    </span>
                    <span className="block text-xs text-neutral-500 mt-0.5">
                      {t('onboarding.pathIngestDesc')}
                    </span>
                  </span>
                </button>

                {/* (b) Mini-form 60s */}
                <button
                  onClick={() => setShowMiniForm((v) => !v)}
                  disabled={isBusy}
                  className={cn(pathCard, showMiniForm && 'border-brand-cyan/40 bg-brand-cyan/5')}
                >
                  <PencilLine className="w-5 h-5 mt-0.5 shrink-0 text-neutral-400" />
                  <span className="min-w-0">
                    <span className="block text-sm font-mono font-medium text-white">
                      {t('onboarding.pathManualTitle')}
                    </span>
                    <span className="block text-xs text-neutral-500 mt-0.5">
                      {t('onboarding.pathManualDesc')}
                    </span>
                  </span>
                </button>

                {showMiniForm && (
                  <form
                    onSubmit={handleCreateMinimal}
                    className="flex flex-col gap-3 p-4 rounded-lg border border-white/10 bg-neutral-900/40"
                  >
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="onboarding-mini-name" className="text-xs text-neutral-400">
                        {t('onboarding.manualNameLabel')}
                      </label>
                      <Input
                        id="onboarding-mini-name"
                        autoFocus
                        value={miniName}
                        onChange={(e) => setMiniName(e.target.value)}
                        placeholder={t('onboarding.manualNamePlaceholder')}
                        disabled={isCreatingMinimal}
                      />
                    </div>
                    <div className="flex items-end gap-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs text-neutral-400">
                          {t('onboarding.manualColorsLabel')}
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            aria-label={t('onboarding.manualColorsLabel')}
                            value={miniColor1}
                            onChange={(e) => setMiniColor1(e.target.value)}
                            disabled={isCreatingMinimal}
                            className="h-9 w-12 rounded-md border border-white/10 bg-neutral-900/60 p-1 cursor-pointer"
                          />
                          <input
                            type="color"
                            aria-label={t('onboarding.manualColorsLabel')}
                            value={miniColor2}
                            onChange={(e) => setMiniColor2(e.target.value)}
                            disabled={isCreatingMinimal}
                            className="h-9 w-12 rounded-md border border-white/10 bg-neutral-900/60 p-1 cursor-pointer"
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                        <label htmlFor="onboarding-mini-tone" className="text-xs text-neutral-400">
                          {t('onboarding.manualToneLabel')}
                        </label>
                        <Input
                          id="onboarding-mini-tone"
                          value={miniTone}
                          onChange={(e) => setMiniTone(e.target.value)}
                          placeholder={t('onboarding.manualTonePlaceholder')}
                          disabled={isCreatingMinimal}
                        />
                      </div>
                    </div>
                    <Button
                      type="submit"
                      disabled={!miniName.trim() || isCreatingMinimal}
                      className="gap-2"
                    >
                      {isCreatingMinimal && <Loader2 className="w-4 h-4 animate-spin" />}
                      {t('onboarding.manualSubmit')}
                    </Button>
                  </form>
                )}

                {/* (c) Explorar antes — marca demo */}
                <button onClick={handleExplore} disabled={isBusy} className={pathCard}>
                  <Compass className="w-5 h-5 mt-0.5 shrink-0 text-neutral-400" />
                  <span className="min-w-0">
                    <span className="block text-sm font-mono font-medium text-white">
                      {isCreatingDemo
                        ? t('onboarding.demoCreating')
                        : t('onboarding.pathDemoTitle')}
                    </span>
                    <span className="block text-xs text-neutral-500 mt-0.5">
                      {t('onboarding.pathDemoDesc')}
                    </span>
                  </span>
                </button>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setStep(0)}
                  disabled={isBusy}
                  className="flex-1"
                >
                  {t('onboarding.back')}
                </Button>
                <Button
                  variant="ghost"
                  onClick={handleSkipAll}
                  disabled={isBusy}
                  className="flex-1"
                >
                  {t('onboarding.skip')}
                </Button>
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step-2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
            >
              {selected ? (
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-lg bg-neutral-800/50 border border-white/10">
                    <selected.icon className="w-5 h-5 text-brand-cyan" />
                  </div>
                  <h2 className="text-xl font-semibold text-white font-mono">
                    {t(`onboarding.persona.${selected.id}.actionTitle`) || selected.actionTitle}
                  </h2>
                </div>
              ) : (
                <h2 className="text-xl font-semibold text-white font-mono mb-2">
                  {t('onboarding.step2Ready')}
                </h2>
              )}
              <p className="text-neutral-400 text-sm font-mono mb-2">
                {selected
                  ? t(`onboarding.persona.${selected.id}.actionDesc`) || selected.actionDesc
                  : t('onboarding.step2Desc')}
              </p>
              <p className="text-xs font-mono text-brand-cyan/80 mb-6">
                {brandPath === 'demo'
                  ? t('onboarding.step2BrandDemo')
                  : t('onboarding.step2BrandLoaded')}
              </p>

              <div className="flex gap-3">
                <Button
                  onClick={() => finish(routeFor(selected, brandId), selected?.id, brandId)}
                  disabled={isSubmitting}
                  className="flex-1 gap-2"
                >
                  {selected
                    ? t(`onboarding.persona.${selected.id}.actionCta`) || selected.actionCta
                    : t('onboarding.continue')}{' '}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </GlassPanel>

      {/* Ingestão reusada — mesmo modal do brand-guidelines/mockup machine,
          com loading honesto ("extraindo cores, tipografia, tom de voz…"). */}
      <BrandGuidelineWizardModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onSuccess={handleIngestSuccess}
      />
    </div>
  );
};
