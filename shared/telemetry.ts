/**
 * Middleware de telemetria isomorfo (plugin dispatcher e /rpc server).
 * Envolve uma função `dispatch(env) => Result` e reporta a cada conclusão.
 */
import type { Envelope, Result, TelemetryEntry } from './protocol';

export type Reporter = (entry: TelemetryEntry) => void;

export function withTelemetry<F extends (env: Envelope) => Promise<Result>>(
  fn: F,
  report: Reporter
): F {
  return (async (env: Envelope) => {
    const r = await fn(env);
    report({
      op: env.op,
      ms: r.ms,
      ok: r.ok,
      errorCode: 'error' in r ? r.error.code : undefined,
      t: Date.now(),
    });
    return r;
  }) as F;
}

/** Batcher simples: agrega N entries e flusha a cada `intervalMs`. */
export function createBatcher(flush: (batch: TelemetryEntry[]) => void, intervalMs = 5000) {
  let buf: TelemetryEntry[] = [];
  let timer: ReturnType<typeof setInterval> | null = null;
  const tick = () => {
    if (!buf.length) return;
    const out = buf; buf = [];
    try { flush(out); } catch { /* swallow */ }
  };
  return {
    report: (e: TelemetryEntry) => {
      buf.push(e);
      timer ??= setInterval(tick, intervalMs);
    },
    flush: tick,
    stop: () => { if (timer) { clearInterval(timer); timer = null; } tick(); },
  };
}
