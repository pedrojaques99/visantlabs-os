import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ArrowRight, FileText, Globe, Figma } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { onboardingApi } from '@/services/onboardingApi';
import { FEATURE_ONBOARDING_V2 } from '@/config/featureFlags';
import { useTranslation } from '@/hooks/useTranslation';
import { useActiveBrandSafe } from '@/contexts/ActiveBrandContext';
import { lazyWithRetry } from '@/utils/lazyWithRetry';

// Wizard de criação de marca — MESMO modal do EmptyState de /brand-guidelines
// (SSoT da criação). Carregado sob demanda: o dock flutuante não paga por ele.
const BrandGuidelineWizardModal = lazyWithRetry(() =>
  import('@/components/mockupmachine/BrandGuidelineWizardModal').then((m) => ({
    default: m.BrandGuidelineWizardModal,
  }))
);

// Lightweight first-run guide. Dismiss lives in localStorage; step completion is
// derived from GET /users/onboarding-progress when FEATURE_ONBOARDING_V2 is on
// (fallback gracioso: endpoint indisponível → comportamento legacy por
// localStorage, idêntico ao anterior). Neutral: progress and done state use
// foreground tokens, not the CTA cyan.
//
// Dois variants, MESMOS passos e MESMO progresso:
// - `floating` (default): dock fixo no canto da home TUI, dispensável.
// - `page`: estado de ativação da rota inicial (HomeRoute) quando o usuário
//   autenticado não tem marca nenhuma. Aqui a checklist é o conteúdo da tela,
//   não é dispensável, e o primeiro passo é a ÚNICA ação de criar marca: abre o
//   wizard na hora, sem mandar o usuário pra lista de arquivos.

const LS_KEY = 'vsn_getting_started';

interface ChecklistState {
  dismissed: boolean;
  done: Record<string, boolean>;
}

interface Step {
  id: string;
  labelKey: string;
  route: string;
  /** Server-derived completion (v2). Undefined = legacy localStorage mode. */
  done?: boolean;
}

const LEGACY_STEPS = [
  { id: 'brand', labelKey: 'onboarding.checklist.bringRealBrand', route: '/brand-guidelines' },
  { id: 'generate', labelKey: 'onboarding.checklist.generateOnBrand', route: '/mockupmachine' },
  { id: 'share', labelKey: 'onboarding.checklist.shareOrExport', route: '/brand-guidelines' },
] as const;

const readState = (): ChecklistState => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as ChecklistState;
  } catch {
    /* ignore */
  }
  return { dismissed: false, done: {} };
};

const writeState = (state: ChecklistState) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
};

interface GettingStartedChecklistProps {
  /** `page` = conteúdo da rota (não dispensável, CTA de criar marca inline). */
  variant?: 'floating' | 'page';
}

export const GettingStartedChecklist: React.FC<GettingStartedChecklistProps> = ({
  variant = 'floating',
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  // Safe: a checklist também monta em shells que podem viver fora do provider.
  const activeBrandCtx = useActiveBrandSafe();
  const isPage = variant === 'page';
  const [state, setState] = useState<ChecklistState>(readState);
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  // v2: progresso real do backend. `null` (404/erro) → fallback legacy.
  const { data: progress } = useQuery({
    queryKey: ['onboarding-progress'],
    queryFn: () => onboardingApi.getProgress(),
    enabled: FEATURE_ONBOARDING_V2,
    staleTime: 10 * 60_000,
    retry: false,
  });

  const apiMode = FEATURE_ONBOARDING_V2 && !!progress;

  const steps: Step[] = apiMode
    ? [
        {
          id: 'brand',
          labelKey: 'onboarding.checklist.bringRealBrand',
          route: '/brand-guidelines',
          done: progress!.hasRealBrand,
        },
        {
          id: 'generate',
          labelKey: 'onboarding.checklist.generateOnBrand',
          route: '/mockupmachine',
          done: progress!.hasOnBrandGeneration,
        },
        {
          id: 'connect',
          labelKey: 'onboarding.checklist.connectAgent',
          route: '/docs/getting-started',
          done: progress!.hasConnectedAgent,
        },
      ]
    : LEGACY_STEPS.map((s) => ({ ...s }));

  const isDone = (s: Step) => (apiMode ? !!s.done : !!state.done[s.id]);
  // Na página o passo da marca vira o CTA principal e sai da lista.
  const listSteps = isPage ? steps.filter((s) => s.id !== 'brand') : steps;
  const completed = listSteps.filter(isDone).length;
  const allDone = completed === listSteps.length;

  const dismiss = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, dismissed: true };
      writeState(next);
      return next;
    });
  }, []);

  const handleStep = useCallback(
    (id: string, route: string) => {
      // Legacy mode marca o passo localmente; v2 confia no backend.
      if (!apiMode) {
        setState((prev) => {
          const next = { ...prev, done: { ...prev.done, [id]: true } };
          writeState(next);
          return next;
        });
      }
      // No variant de página o passo da marca é o próprio motivo da tela: abre o
      // wizard aqui em vez de navegar (navegar = a perda de contexto que a gente
      // está consertando).
      if (isPage && id === 'brand') {
        setIsWizardOpen(true);
        return;
      }
      navigate(route);
    },
    [navigate, apiMode, isPage]
  );

  // Marca criada → vira a marca ativa e abre o cockpit dela (a marca vive na URL).
  const handleBrandCreated = useCallback(
    (id: string) => {
      setIsWizardOpen(false);
      activeBrandCtx?.setActiveBrand(id);
      navigate(`/cockpit/${id}`);
    },
    [activeBrandCtx, navigate]
  );

  const progressBar = (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-px bg-muted overflow-hidden rounded-full">
        <motion.div
          className="h-full bg-foreground"
          initial={false}
          animate={{ width: `${(completed / listSteps.length) * 100}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {completed}/{listSteps.length}
      </span>
    </div>
  );

  const stepList = (
    <ul className="flex flex-col gap-1">
      {listSteps.map((s) => {
        const done = isDone(s);
        return (
          <li key={s.id}>
            <button
              onClick={() => handleStep(s.id, s.route)}
              className="group w-full flex items-center gap-2.5 py-1.5 text-left transition-colors"
            >
              <span
                className={cn(
                  'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors',
                  done
                    ? 'border-border bg-muted text-foreground'
                    : 'border-border text-transparent group-hover:border-border-hover'
                )}
              >
                <Check size={10} strokeWidth={3} />
              </span>
              <span
                className={cn(
                  'flex-1 text-sm transition-colors',
                  done
                    ? 'text-muted-foreground line-through'
                    : 'text-muted-foreground group-hover:text-foreground'
                )}
              >
                {t(s.labelKey)}
              </span>
              {!done && (
                <ArrowRight
                  size={11}
                  className="text-muted-foreground group-hover:text-foreground transition-colors"
                />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );

  const wizard = isWizardOpen ? (
    <React.Suspense fallback={null}>
      <BrandGuidelineWizardModal
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSuccess={handleBrandCreated}
      />
    </React.Suspense>
  ) : null;

  // ── Variant de página: a promessa ("traga sua marca") + o caminho (checklist).
  // O CTA principal é a única ação de criar marca da tela (o passo 1 sai da lista).
  if (isPage) {
    return (
      <div
        className="w-full min-h-[70vh] flex items-center justify-center px-6 py-12"
        data-vsn-region="brand-activation"
        data-vsn-component="GettingStartedChecklist"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="w-full max-w-md flex flex-col items-center text-center gap-6"
        >
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground tracking-tight">
              {t('onboarding.step1Title')}
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {t('onboarding.step1Subtitle')}
            </p>
          </div>
          <Button
            size="lg"
            className="w-full"
            onClick={() => handleStep('brand', '/brand-guidelines')}
          >
            {t('onboarding.bringBrandCta')}
          </Button>
          {/* De onde a marca pode vir. */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <FileText size={13} strokeWidth={1.5} /> PDF
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Globe size={13} strokeWidth={1.5} /> Website
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Figma size={13} strokeWidth={1.5} /> Figma
            </span>
          </div>

          <div className="w-full flex flex-col gap-3 rounded-xl border border-border bg-card/60 p-4 text-left">
            <span className="text-sm font-medium text-foreground">
              {t('onboarding.checklist.title')}
            </span>
            {progressBar}
            {stepList}
          </div>

          {/* Escape hatch: o wizard completo (persona + marca demo) pra quem quer
              explorar antes de trazer a marca real. */}
          <button
            onClick={() => navigate('/welcome')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {t('onboarding.pathDemoTitle')}
          </button>
        </motion.div>
        {wizard}
      </div>
    );
  }

  if (state.dismissed) return null;

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ delay: 0.6, duration: 0.3 }}
        className="hidden lg:flex fixed bottom-6 left-6 z-30 w-72 flex-col gap-3 rounded-xl border border-border bg-card/80 backdrop-blur-xl p-4"
        aria-label={t('onboarding.checklist.title')}
        data-vsn-component="GettingStartedChecklist"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">
            {t('onboarding.checklist.title')}
          </span>
          <button
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={t('common.dismiss')}
          >
            <X size={13} />
          </button>
        </div>

        {/* Progress */}
        {progressBar}

        {allDone ? (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-medium text-foreground">
              {t('onboarding.checklist.allDone')}
            </span>
            <button
              onClick={dismiss}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {t('common.close')}
            </button>
          </div>
        ) : (
          stepList
        )}
      </motion.aside>
    </AnimatePresence>
  );
};
