/**
 * Cliente unificado: figma | http | ws → um único `request(op, payload)`.
 * Substitui useApi + useWebSocket + postMessage cru (migração incremental).
 * Ver .agent/plans/plugin-webapp-unification.md (Fase 2).
 */
import type {
  Envelope, OpName, PayloadOf, ResultOf, Result, Channel, TelemetryEntry,
} from '@shared/protocol';
import { makeId } from '@shared/protocol';

export interface ClientOptions {
  baseUrl: string;
  getToken: () => string | null;
  getBrandId?: () => string | null;
  /** Tempo máximo para aguardar resposta do canal figma/ws. */
  timeoutMs?: number;
  onUnauthorized?: () => void;
}

/** Mapeia cada op ao canal — única fonte de roteamento. */
const ROUTE: Record<OpName, Channel> = {
  // figma (sandbox)
  'canvas.applyOperations': 'figma',
  'canvas.undoLastBatch':   'figma',
  'canvas.selectAndZoom':   'figma',
  'canvas.deleteSelection': 'figma',
  'context.get':            'figma',
  'context.getEnriched':    'figma',
  'context.reportSelection':'figma',
  'components.getInFile':   'figma',
  'components.getAgent':    'figma',
  'components.captureSelection': 'figma',
  'components.importFromSelection': 'figma',
  'templates.get':          'figma',
  'templates.scaffold':     'figma',
  'variables.getColors':    'figma',
  'variables.getFonts':     'figma',
  'variables.getFontFamilies':'figma',
  'image.paste':            'figma',
  'image.exportNode':       'figma',
  'storage.get':            'figma',
  'storage.set':            'figma',
  'storage.delete':         'figma',
  'brand.applyLocal':       'figma',
  'brand.lint':             'figma',
  'brand.fixIssues':        'figma',
  'brand.generateGrid':     'figma',
  'brand.generateSocial':   'figma',
  'brand.importLogos':      'figma',
  'brand.useSelectionAsLogo':'figma',
  'brand.useSelectionAsFont':'figma',
  'sync.extract':           'figma',
  'sync.push':              'figma',
  'dev.stickyPrompt':       'figma',
  'dev.varyColors':         'figma',
  'dev.selectionToSlices':  'figma',
  'dev.multiplyResponsive': 'figma',
  'text.scanFonts':         'figma',
  'text.swapFonts':         'figma',
  'text.getStyles':         'figma',
  'export.textToMarkdown':  'figma',

  // http (server)
  'ai.chat':       'http',
  'ai.generate':   'http',
  'telemetry.log': 'http',
};

export interface Client {
  request<K extends OpName>(op: K, payload: PayloadOf<K>): Promise<ResultOf<K>>;
  /** Envia entries de telemetria (invocado pelo handler de TELEMETRY_BATCH). */
  reportTelemetry(entries: TelemetryEntry[]): Promise<void>;
  dispose(): void;
}

export function createClient(opts: ClientOptions): Client {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const pending = new Map<string, { resolve: (r: Result) => void; timer: ReturnType<typeof setTimeout> }>();

  // Single listener para respostas vindas do sandbox Figma
  const onWindowMessage = (ev: MessageEvent) => {
    const data = (ev.data as any)?.pluginMessage ?? ev.data;
    if (!data || typeof data !== 'object') return;
    if (typeof data.id !== 'string' || typeof data.ok !== 'boolean') return;
    const p = pending.get(data.id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.delete(data.id);
    p.resolve(data as Result);
  };
  window.addEventListener('message', onWindowMessage);

  function viaFigma(env: Envelope): Promise<Result> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        pending.delete(env.id);
        resolve({ id: env.id, ok: false, error: { code: 'TIMEOUT', message: `Figma op "${env.op}" timed out` }, ms: timeoutMs });
      }, timeoutMs);
      pending.set(env.id, { resolve, timer });
      parent.postMessage({ pluginMessage: env }, '*');
    });
  }

  async function viaHttp(env: Envelope): Promise<Result> {
    const t0 = performance.now();
    try {
      const token = opts.getToken();
      const res = await fetch(`${opts.baseUrl}/api/rpc`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(env),
      });
      if (res.status === 401 || res.status === 403) {
        opts.onUnauthorized?.();
        return { id: env.id, ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authorized' }, ms: performance.now() - t0 };
      }
      const body = await res.json();
      if (body && typeof body.ok === 'boolean' && typeof body.id === 'string') return body as Result;
      return { id: env.id, ok: true, data: body, ms: performance.now() - t0 };
    } catch (e: any) {
      return { id: env.id, ok: false, error: { code: 'NETWORK', message: e?.message ?? String(e) }, ms: performance.now() - t0 };
    }
  }

  async function request<K extends OpName>(op: K, payload: PayloadOf<K>): Promise<ResultOf<K>> {
    const env: Envelope<PayloadOf<K>> = {
      v: 1,
      id: makeId(),
      op,
      payload,
      meta: { t0: Date.now(), brandId: opts.getBrandId?.() ?? undefined },
    };
    const channel = ROUTE[op];
    const result = channel === 'http' ? await viaHttp(env) : await viaFigma(env);
    if ('error' in result) {
      const err = new Error(result.error.message);
      (err as any).code = result.error.code;
      throw err;
    }
    return result.data as ResultOf<K>;
  }

  async function reportTelemetry(entries: TelemetryEntry[]) {
    if (!entries.length) return;
    try { await request('telemetry.log', { entries }); } catch { /* fire-and-forget */ }
  }

  return {
    request,
    reportTelemetry,
    dispose() {
      window.removeEventListener('message', onWindowMessage);
      for (const p of pending.values()) clearTimeout(p.timer);
      pending.clear();
    },
  };
}
