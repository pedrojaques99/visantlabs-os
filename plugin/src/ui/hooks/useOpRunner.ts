import { useCallback, useState } from 'react';
import { useFigmaMessages } from './useFigmaMessages';

export interface RunOptions {
  /** Message types that signal completion. First match resolves. */
  responseTypes?: string[];
  /** Abort after N ms. Default 30_000. Set 0 to disable. */
  timeoutMs?: number;
  /** Async side-effect (e.g. fetch). Resolves the op when it settles. */
  task?: () => Promise<any>;
}

export interface OpRunner {
  /** Currently running op id, or null. */
  activeOp: string | null;
  /** True when this specific op is running. */
  isBusy: (id: string) => boolean;
  /** True when ANY op (including global isGenerating) is running. */
  anyBusy: boolean;
  /**
   * Run a sandbox round-trip or async task with automatic loading state.
   *
   *   run('lint', { type: 'BRAND_LINT' }, { responseTypes: ['BRAND_LINT_REPORT'] })
   *   run('save', null, { task: () => api.save() })
   */
  run: (opId: string, message: any | null, options?: RunOptions) => Promise<void>;
}

const TERMINAL_ERRORS = ['ERROR', 'OPERATION_ERROR'];

/**
 * Centralized loading-state manager for plugin workflows.
 *
 * Any new button/workflow gets loading UX for free — just call `run()`.
 * Auto-resolves on sandbox response message, async task completion, or timeout.
 */
export function useOpRunner(opts?: { globalBusy?: boolean }): OpRunner {
  const [activeOp, setActiveOp] = useState<string | null>(null);
  const { send } = useFigmaMessages();

  const run = useCallback(
    async (opId: string, message: any | null, options: RunOptions = {}) => {
      const { responseTypes = [], timeoutMs = 30000, task } = options;
      setActiveOp(opId);

      try {
        if (task) {
          await task();
          return;
        }

        if (message) send(message);

        if (responseTypes.length === 0) {
          // Fire-and-forget: clear on next tick so UI briefly flashes.
          await new Promise((r) => setTimeout(r, 300));
          return;
        }

        await new Promise<void>((resolve) => {
          const cleanup = () => {
            window.removeEventListener('message', handler);
            clearTimeout(timer);
            resolve();
          };
          const handler = (event: MessageEvent) => {
            const t = event.data?.pluginMessage?.type;
            if (t && (responseTypes.includes(t) || TERMINAL_ERRORS.includes(t))) cleanup();
          };
          const timer = timeoutMs > 0 ? setTimeout(cleanup, timeoutMs) : (undefined as any);
          window.addEventListener('message', handler);
        });
      } finally {
        setActiveOp((curr) => (curr === opId ? null : curr));
      }
    },
    [send]
  );

  const isBusy = useCallback((id: string) => activeOp === id, [activeOp]);
  const anyBusy = activeOp !== null || !!opts?.globalBusy;

  return { activeOp, isBusy, anyBusy, run };
}
