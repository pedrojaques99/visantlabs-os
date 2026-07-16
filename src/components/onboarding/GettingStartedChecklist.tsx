import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ArrowRight, Rocket } from '@/lib/ui/icons';
import { cn } from '@/lib/utils';
import { onboardingApi } from '@/services/onboardingApi';
import { FEATURE_ONBOARDING_V2 } from '@/config/featureFlags';
import { useTranslation } from '@/hooks/useTranslation';

// Lightweight first-run guide. Dismiss lives in localStorage; step completion is
// derived from GET /users/onboarding-progress when FEATURE_ONBOARDING_V2 is on
// (fallback gracioso: endpoint indisponível → comportamento legacy por
// localStorage, idêntico ao anterior). Matches the home TUI aesthetic (mono,
// neutral, brand-cyan only for confirmed/active state).

const LS_KEY = 'vsn_getting_started';

interface ChecklistState {
  dismissed: boolean;
  done: Record<string, boolean>;
}

interface Step {
  id: string;
  label: string;
  route: string;
  /** Server-derived completion (v2). Undefined = legacy localStorage mode. */
  done?: boolean;
}

const LEGACY_STEPS = [
  { id: 'brand', label: 'Criar sua marca', route: '/brand-guidelines' },
  { id: 'generate', label: 'Gerar sua primeira peça', route: '/mockupmachine' },
  { id: 'share', label: 'Compartilhar ou exportar', route: '/brand-guidelines' },
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

export const GettingStartedChecklist: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [state, setState] = useState<ChecklistState>(readState);

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
          label: t('onboarding.checklist.bringRealBrand'),
          route: '/brand-guidelines',
          done: progress!.hasRealBrand,
        },
        {
          id: 'generate',
          label: t('onboarding.checklist.generateOnBrand'),
          route: '/mockupmachine',
          done: progress!.hasOnBrandGeneration,
        },
        {
          id: 'connect',
          label: t('onboarding.checklist.connectAgent'),
          route: '/docs/getting-started',
          done: progress!.hasConnectedAgent,
        },
      ]
    : LEGACY_STEPS.map((s) => ({ ...s }));

  const isDone = (s: Step) => (apiMode ? !!s.done : !!state.done[s.id]);
  const completed = steps.filter(isDone).length;
  const allDone = completed === steps.length;

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
      navigate(route);
    },
    [navigate, apiMode]
  );

  if (state.dismissed) return null;

  return (
    <AnimatePresence>
      <motion.aside
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ delay: 0.6, duration: 0.3 }}
        className="hidden lg:flex fixed bottom-6 left-6 z-30 w-72 flex-col gap-3 rounded-xl border border-white/10 bg-neutral-950/80 backdrop-blur-xl p-4"
        aria-label="Primeiros passos"
        data-vsn-component="GettingStartedChecklist"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket size={12} className="text-neutral-500" />
            <span className="text-xs font-medium text-neutral-300">Primeiros passos</span>
          </div>
          <button
            onClick={dismiss}
            className="text-neutral-600 hover:text-neutral-300 transition-colors"
            aria-label="Dispensar"
          >
            <X size={13} />
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-px bg-neutral-800 overflow-hidden rounded-full">
            <motion.div
              className="h-full bg-brand-cyan"
              initial={false}
              animate={{ width: `${(completed / steps.length) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <span className="font-mono text-[10px] text-neutral-500">
            {completed}/{steps.length}
          </span>
        </div>

        {allDone ? (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-medium text-neutral-300">Tudo pronto.</span>
            <button
              onClick={dismiss}
              className="text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Fechar
            </button>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {steps.map((s) => {
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
                          ? 'border-brand-cyan/40 bg-brand-cyan/10 text-brand-cyan'
                          : 'border-neutral-700 text-transparent group-hover:border-neutral-500'
                      )}
                    >
                      <Check size={10} strokeWidth={3} />
                    </span>
                    <span
                      className={cn(
                        'flex-1 font-mono text-[11px] transition-colors',
                        done
                          ? 'text-neutral-600 line-through'
                          : 'text-neutral-400 group-hover:text-neutral-200'
                      )}
                    >
                      {s.label}
                    </span>
                    {!done && (
                      <ArrowRight
                        size={11}
                        className="text-neutral-700 group-hover:text-neutral-400 transition-colors"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </motion.aside>
    </AnimatePresence>
  );
};
