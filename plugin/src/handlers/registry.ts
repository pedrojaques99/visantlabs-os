/// <reference types="@figma/plugin-typings" />
/**
 * Registry tipado: OpName → handler.
 * Single source of dispatch para o novo protocolo (shared/protocol.ts).
 * Legacy `msg.type === '...'` continua no code.ts até Fase 2 migrar o UI.
 */
import type { Envelope, OpName, PayloadOf, ResultOf, Result } from '@shared/protocol';
import { withTelemetry, createBatcher } from '@shared/telemetry';
import { postToUI } from '../utils/postMessage';
import * as H from './index';
import { getEnrichedContext } from '../utils/serialize';

type HandlerFn<K extends OpName> = (p: PayloadOf<K>) => Promise<ResultOf<K>> | ResultOf<K>;
type Registry = { [K in OpName]?: HandlerFn<K> };

/**
 * Adaptadores finos — reencaixam payloads do protocolo nas assinaturas existentes.
 * Handlers não são modificados; este arquivo é a única cola.
 */
export const registry: Registry = {
  // Canvas
  'canvas.applyOperations': async ({ operations }) => {
    await H.applyOperations(operations as any);
    return { appliedCount: operations.length };
  },
  'canvas.deleteSelection': async () => {
    H.deleteSelection();
    return { ok: true };
  },

  // Context
  'context.get':         async () => getEnrichedContext(),
  'context.getEnriched': async () => getEnrichedContext(),

  // Components / Templates
  'components.getInFile': async () => H.getComponentsInCurrentFile() as any,
  'components.getAgent':  async () => H.getAgentComponents() as any,
  'templates.get':        async () => H.getTemplates() as any,
  'templates.scaffold':   async ({ libraryName }) => {
    await H.scaffoldAgentLibrary({ name: libraryName ?? 'Agent' } as any);
    return { ok: true } as any;
  },

  // Variables
  'variables.getColors':       async () => H.getColorVariablesFromFile() as any,
  'variables.getFonts':        async () => H.getFontVariablesFromFile() as any,
  'variables.getFontFamilies': async () => H.getAvailableFontFamilies() as any,

  // Storage
  'storage.get': async ({ key }) => ({ value: await figma.clientStorage.getAsync(key) }),
  'storage.set': async ({ key, value }) => { await figma.clientStorage.setAsync(key, value); return { ok: true }; },
  'storage.delete': async ({ key }) => { await figma.clientStorage.deleteAsync(key); return { ok: true }; },

  // Brand
  'brand.applyLocal':     async (p) => H.applyBrandGuidelinesLocally((p as any).guideline ?? p) as any,
  'brand.lint':           async (p) => H.lintBrandAdherence(p as any) as any,
  'brand.fixIssues':      async (p) => H.fixBrandIssues(p as any) as any,
  'brand.generateGrid':   async () => H.generateBrandGrid() as any,
  'brand.generateSocial': async (p) => H.generateSocialFrames((p as any).brandColors ?? []) as any,
  'brand.importLogos':    async () => H.importLogoCandidates() as any,

  // Sync
  'sync.extract': async () => H.extractForSync() as any,
  'sync.push':    async (p) => H.pushToFigma(p as any) as any,

  // Export
  'export.textToMarkdown': async (p) => H.exportTextToMarkdown(p),

  // Dev
  'dev.stickyPrompt':       async (p) => H.createStickyPrompt((p as any).text ?? '', 'Prompt') as any,
  'dev.varyColors':         async (p) => H.varySelectionColors((p as any).brandColors) as any,
  'dev.selectionToSlices':  async () => H.selectionToSlices() as any,
  'dev.multiplyResponsive': async (p) => H.multiplyResponsive((p as any).formats) as any,
};

/** Batcher de telemetria: flusha para a UI, que encaminha para /rpc. */
const telemetryBatcher = createBatcher((entries) => {
  postToUI({ type: 'TELEMETRY_BATCH', entries } as any);
});

async function dispatchRaw(env: Envelope): Promise<Result> {
  const t0 = performance.now();
  const handler = (registry as any)[env.op] as HandlerFn<OpName> | undefined;
  if (!handler) {
    return {
      id: env.id, ok: false,
      error: { code: 'UNKNOWN_OP', message: `No handler for op "${env.op}"` },
      ms: performance.now() - t0,
    };
  }
  try {
    const data = await handler(env.payload as any);
    return { id: env.id, ok: true, data, ms: performance.now() - t0 };
  } catch (e: any) {
    return {
      id: env.id, ok: false,
      error: { code: e?.code ?? 'HANDLER_ERROR', message: e?.message ?? String(e) },
      ms: performance.now() - t0,
    };
  }
}

/** Entry point: UI envia Envelope, recebe Result correlacionado por id. */
export const dispatch = withTelemetry(dispatchRaw, telemetryBatcher.report);
