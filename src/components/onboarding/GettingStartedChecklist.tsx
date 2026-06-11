import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, X, ArrowRight, Rocket } from 'lucide-react';
import { cn } from '@/lib/utils';

// Lightweight first-run guide. State lives in localStorage (no schema/API coupling);
// a step is marked done when the user follows it. Self-dismisses once dismissed or
// fully complete. Matches the home TUI aesthetic (mono, neutral, brand-cyan only for
// confirmed/active state).

const LS_KEY = 'vsn_getting_started';

interface ChecklistState {
  dismissed: boolean;
  done: Record<string, boolean>;
}

const STEPS = [
  { id: 'brand', label: 'Criar sua marca', route: '/brand-guidelines' },
  { id: 'generate', label: 'Gerar sua primeira peca', route: '/mockupmachine' },
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
  const [state, setState] = useState<ChecklistState>(readState);

  const completed = STEPS.filter((s) => state.done[s.id]).length;
  const allDone = completed === STEPS.length;

  const dismiss = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, dismissed: true };
      writeState(next);
      return next;
    });
  }, []);

  const handleStep = useCallback(
    (id: string, route: string) => {
      setState((prev) => {
        const next = { ...prev, done: { ...prev.done, [id]: true } };
        writeState(next);
        return next;
      });
      navigate(route);
    },
    [navigate]
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
            <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-400">
              Primeiros passos
            </span>
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
              animate={{ width: `${(completed / STEPS.length) * 100}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <span className="font-mono text-[10px] text-neutral-500">
            {completed}/{STEPS.length}
          </span>
        </div>

        {allDone ? (
          <div className="flex items-center justify-between pt-1">
            <span className="font-mono text-[11px] text-brand-cyan">Tudo pronto.</span>
            <button
              onClick={dismiss}
              className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              Fechar
            </button>
          </div>
        ) : (
          <ul className="flex flex-col gap-1">
            {STEPS.map((s) => {
              const done = !!state.done[s.id];
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
