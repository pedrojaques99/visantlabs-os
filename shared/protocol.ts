/**
 * Visant — contrato único plugin ↔ UI ↔ server.
 * Importado por plugin/src/*, plugin/src/ui/*, e server/*.
 * Ver .agent/plans/plugin-webapp-unification.md
 */

export type OpId = string;

export type Channel = 'figma' | 'http' | 'ws';

export interface EnvelopeMeta {
  t0: number;
  brandId?: string;
  userId?: string;
}

/** Toda mensagem nova passa por Envelope. Legado (msg.type = '...') coexiste até Fase 2. */
export interface Envelope<P = unknown> {
  v: 1;
  id: OpId;
  op: OpName;
  payload: P;
  meta?: EnvelopeMeta;
}

/**
 * Registro canônico de operações.
 * Adicionar nova op: 1) adicionar entrada aqui, 2) implementar no registry do ambiente dono.
 */
export interface OpMap {
  // ── Canvas / Operations ──
  'canvas.applyOperations': { payload: { operations: unknown[] }; result: { appliedCount: number } };
  'canvas.undoLastBatch':   { payload: Record<string, never>;     result: { ok: boolean } };
  'canvas.selectAndZoom':   { payload: { nodeId: string };        result: { ok: boolean } };
  'canvas.deleteSelection': { payload: Record<string, never>;     result: { ok: boolean } };

  // ── Context / Selection ──
  'context.get':           { payload: Record<string, never>; result: unknown };
  'context.getEnriched':   { payload: Record<string, never>; result: unknown };
  'context.reportSelection': { payload: Record<string, never>; result: unknown };

  // ── Components / Templates ──
  'components.getInFile':          { payload: Record<string, never>;                result: unknown };
  'components.getAgent':           { payload: Record<string, never>;                result: unknown };
  'components.captureSelection':   { payload: Record<string, never>;                result: unknown };
  'components.importFromSelection':{ payload: { folderPath?: string };              result: unknown };
  'templates.get':                 { payload: Record<string, never>;                result: unknown };
  'templates.scaffold':            { payload: { libraryName?: string };             result: unknown };

  // ── Variables ──
  'variables.getColors':       { payload: Record<string, never>; result: unknown };
  'variables.getFonts':        { payload: Record<string, never>; result: unknown };
  'variables.getFontFamilies': { payload: Record<string, never>; result: unknown };

  // ── Text ──
  'text.scanFonts':  { payload: Record<string, never>; result: { groups: FontGroup[] } };
  'text.swapFonts':  { payload: { swaps: FontSwapEntry[] }; result: { swapped: number; failed: string[] } };
  'text.getStyles':  { payload: { family: string }; result: { styles: string[] } };

  // ── Images ──
  'image.paste':    { payload: { data: string; mimeType?: string }; result: { ok: boolean } };
  'image.exportNode': { payload: { nodeId: string; format?: string }; result: { data: string } };

  // ── Storage (plugin clientStorage) ──
  'storage.get':    { payload: { key: string };              result: { value: unknown } };
  'storage.set':    { payload: { key: string; value: unknown }; result: { ok: boolean } };
  'storage.delete': { payload: { key: string };              result: { ok: boolean } };

  // ── Brand ──
  'brand.applyLocal':     { payload: { guidelineId?: string; guideline?: unknown }; result: unknown };
  'brand.lint':           { payload: { nodeId?: string };                            result: unknown };
  'brand.fixIssues':      { payload: { issues: unknown[] };                          result: unknown };
  'brand.generateGrid':   { payload: Record<string, unknown>;                        result: unknown };
  'brand.generateSocial': { payload: Record<string, unknown>;                        result: unknown };
  'brand.importLogos':    { payload: Record<string, unknown>;                        result: unknown };
  'brand.useSelectionAsLogo': { payload: Record<string, never>;                      result: unknown };
  'brand.useSelectionAsFont': { payload: Record<string, never>;                      result: unknown };

  // ── Sync (Figma ↔ server) ──
  'sync.extract':  { payload: Record<string, unknown>; result: unknown };
  'sync.push':     { payload: { nodes: unknown[] };    result: unknown };

  // ── AI (server) ──
  'ai.chat':      { payload: { prompt: string; messages?: unknown[]; stream?: boolean }; result: { text: string } };
  'ai.generate':  { payload: { context: unknown; instruction: string };                  result: unknown };

  // ── Export ──
  'export.textToMarkdown': { payload: { includeHidden?: boolean }; result: { markdown: string; filename: string } };

  // ── Dev / Misc ──
  'dev.stickyPrompt':      { payload: { text?: string }; result: unknown };
  'dev.varyColors':        { payload: Record<string, unknown>; result: unknown };
  'dev.selectionToSlices': { payload: Record<string, unknown>; result: unknown };
  'dev.multiplyResponsive':{ payload: Record<string, unknown>; result: unknown };

  // ── Telemetry (batch de ops concluídas) ──
  'telemetry.log': { payload: { entries: TelemetryEntry[] }; result: { ok: boolean } };
}

export interface FontGroup {
  key: string;
  family: string;
  style: string;
  count: number;
  nodeIds: string[];
}

export interface FontSwapEntry {
  nodeIds: string[];
  oldFamily: string;
  oldStyle: string;
  newFamily: string;
  newStyle: string;
}

export type OpName = keyof OpMap;
export type PayloadOf<K extends OpName> = OpMap[K]['payload'];
export type ResultOf<K extends OpName>  = OpMap[K]['result'];

export type Ok<T>  = { id: OpId; ok: true;  data: T; ms: number };
export type Err    = { id: OpId; ok: false; error: { code: string; message: string }; ms: number };
export type Result<K extends OpName = OpName> = Ok<ResultOf<K>> | Err;

export interface TelemetryEntry {
  op: OpName;
  ms: number;
  ok: boolean;
  errorCode?: string;
  t: number; // epoch ms
}

/** Detecta se uma mensagem segue o novo protocolo (vs legado msg.type = '...'). */
export function isEnvelope(x: unknown): x is Envelope {
  return !!x && typeof x === 'object'
    && (x as any).v === 1
    && typeof (x as any).id === 'string'
    && typeof (x as any).op === 'string';
}

export function makeId(): OpId {
  // Figma sandbox nem sempre tem crypto.randomUUID
  const g: any = (globalThis as any);
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
