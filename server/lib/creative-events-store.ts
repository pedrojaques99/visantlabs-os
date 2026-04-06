import { promises as fs } from 'fs';
import path from 'path';

/**
 * Append-only JSONL store for creative editing events.
 * Powers Brand Learning (#5) and Agent Observability (#6).
 *
 * Why JSONL: zero schema migration, inspectable with `tail`, trivial to upgrade
 * to Prisma later. Acceptable until ~10MB / ~100k events.
 */

export type CreativeEventType =
  | 'ai_generate'
  | 'layer_add'
  | 'layer_update'
  | 'layer_remove'
  | 'layer_meta'
  | 'export';

export interface CreativeEvent {
  id: string;
  ts: number;
  brandId: string | null;
  creativeId: string;
  type: CreativeEventType;
  layerId?: string;
  layerRole?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  diff?: Record<string, { from: unknown; to: unknown }>;
  // True when the mutation happened after AI hydration = correction signal
  isCorrection?: boolean;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const EVENTS_FILE = path.join(DATA_DIR, 'creative-events.jsonl');

let initPromise: Promise<void> | null = null;
async function ensureFile() {
  if (!initPromise) {
    initPromise = (async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      try {
        await fs.access(EVENTS_FILE);
      } catch {
        await fs.writeFile(EVENTS_FILE, '');
      }
    })();
  }
  return initPromise;
}

export async function appendEvents(events: CreativeEvent[]): Promise<void> {
  if (!events.length) return;
  await ensureFile();
  const lines = events.map((e) => JSON.stringify(e)).join('\n') + '\n';
  await fs.appendFile(EVENTS_FILE, lines);
}

export async function readEvents(filter?: {
  brandId?: string;
  creativeId?: string;
  limit?: number;
}): Promise<CreativeEvent[]> {
  await ensureFile();
  const raw = await fs.readFile(EVENTS_FILE, 'utf8');
  if (!raw.trim()) return [];
  const all: CreativeEvent[] = raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as CreativeEvent;
      } catch {
        return null;
      }
    })
    .filter((x): x is CreativeEvent => x !== null);

  let out = all;
  if (filter?.brandId) out = out.filter((e) => e.brandId === filter.brandId);
  if (filter?.creativeId) out = out.filter((e) => e.creativeId === filter.creativeId);
  // newest first
  out.sort((a, b) => b.ts - a.ts);
  if (filter?.limit) out = out.slice(0, filter.limit);
  return out;
}

// ---------- Aggregations ----------

export interface BrandInsights {
  sampleSize: number;
  creatives: number;
  avgEditsPerCreative: number;
  firstTryAcceptance: number; // 0..1
  fontSizeBias: number; // mean delta as fraction (e.g. -0.15 = shrunk 15%)
  colorOverrides: { from: string; to: string; count: number }[];
  logoPositionBias: { x: number; y: number } | null;
  removedRoles: { role: string; count: number }[];
  commonPatches: string[];
}

export async function computeBrandInsights(brandId: string): Promise<BrandInsights> {
  const events = await readEvents({ brandId });
  const corrections = events.filter((e) => e.isCorrection);

  const creativeIds = new Set(events.map((e) => e.creativeId));
  const editsPerCreative = new Map<string, number>();
  for (const e of corrections) {
    editsPerCreative.set(e.creativeId, (editsPerCreative.get(e.creativeId) ?? 0) + 1);
  }
  const totalEdits = [...editsPerCreative.values()].reduce((a, b) => a + b, 0);
  const avgEdits = creativeIds.size ? totalEdits / creativeIds.size : 0;
  const firstTry =
    creativeIds.size === 0
      ? 0
      : [...editsPerCreative.values()].filter((n) => n <= 2).length / creativeIds.size;

  // Font size bias — look at layer_update diffs touching fontSize
  const fontDeltas: number[] = [];
  for (const e of corrections) {
    const fs = e.diff?.fontSize;
    if (fs && typeof fs.from === 'number' && typeof fs.to === 'number' && fs.from > 0) {
      fontDeltas.push((fs.to - fs.from) / fs.from);
    }
  }
  const fontSizeBias =
    fontDeltas.length > 0 ? fontDeltas.reduce((a, b) => a + b, 0) / fontDeltas.length : 0;

  // Color overrides
  const colorMap = new Map<string, number>();
  for (const e of corrections) {
    const c = e.diff?.color;
    if (c && typeof c.from === 'string' && typeof c.to === 'string' && c.from !== c.to) {
      const key = `${c.from}->${c.to}`;
      colorMap.set(key, (colorMap.get(key) ?? 0) + 1);
    }
  }
  const colorOverrides = [...colorMap.entries()]
    .map(([k, count]) => {
      const [from, to] = k.split('->');
      return { from, to, count };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Logo position bias — look at logo layer position diffs
  const logoXDeltas: number[] = [];
  const logoYDeltas: number[] = [];
  for (const e of corrections) {
    if (e.layerRole !== 'logo') continue;
    const pos = e.diff?.position as { from?: any; to?: any } | undefined;
    if (pos?.from && pos?.to) {
      if (typeof pos.from.x === 'number' && typeof pos.to.x === 'number')
        logoXDeltas.push(pos.to.x - pos.from.x);
      if (typeof pos.from.y === 'number' && typeof pos.to.y === 'number')
        logoYDeltas.push(pos.to.y - pos.from.y);
    }
  }
  const logoPositionBias =
    logoXDeltas.length > 0
      ? {
          x: logoXDeltas.reduce((a, b) => a + b, 0) / logoXDeltas.length,
          y: logoYDeltas.reduce((a, b) => a + b, 0) / logoYDeltas.length,
        }
      : null;

  // Removed roles
  const removedMap = new Map<string, number>();
  for (const e of corrections) {
    if (e.type === 'layer_remove' && e.layerRole) {
      removedMap.set(e.layerRole, (removedMap.get(e.layerRole) ?? 0) + 1);
    }
  }
  const removedRoles = [...removedMap.entries()]
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count);

  // Human-readable patches for prompt injection
  const commonPatches: string[] = [];
  if (fontSizeBias < -0.05)
    commonPatches.push(`shrink headline font ~${Math.round(Math.abs(fontSizeBias) * 100)}%`);
  if (fontSizeBias > 0.05)
    commonPatches.push(`enlarge headline font ~${Math.round(fontSizeBias * 100)}%`);
  if (logoPositionBias && Math.abs(logoPositionBias.x) > 0.02) {
    commonPatches.push(`move logo ${logoPositionBias.x < 0 ? 'left' : 'right'}`);
  }
  if (logoPositionBias && Math.abs(logoPositionBias.y) > 0.02) {
    commonPatches.push(`move logo ${logoPositionBias.y < 0 ? 'up' : 'down'}`);
  }
  for (const c of colorOverrides.slice(0, 2)) {
    commonPatches.push(`prefer ${c.to} over ${c.from}`);
  }
  for (const r of removedRoles.slice(0, 1)) {
    if (r.count >= 2) commonPatches.push(`avoid ${r.role} layer (often removed)`);
  }

  return {
    sampleSize: corrections.length,
    creatives: creativeIds.size,
    avgEditsPerCreative: Number(avgEdits.toFixed(2)),
    firstTryAcceptance: Number(firstTry.toFixed(2)),
    fontSizeBias: Number(fontSizeBias.toFixed(3)),
    colorOverrides,
    logoPositionBias,
    removedRoles,
    commonPatches,
  };
}

export async function computeMetrics(brandId?: string) {
  const events = await readEvents(brandId ? { brandId } : undefined);
  const corrections = events.filter((e) => e.isCorrection);
  const creativeIds = new Set(events.map((e) => e.creativeId));
  const editsPer = new Map<string, number>();
  for (const e of corrections) {
    editsPer.set(e.creativeId, (editsPer.get(e.creativeId) ?? 0) + 1);
  }
  const totalEdits = [...editsPer.values()].reduce((a, b) => a + b, 0);
  return {
    creatives: creativeIds.size,
    totalEvents: events.length,
    totalCorrections: corrections.length,
    avgEditsPerCreative: creativeIds.size ? Number((totalEdits / creativeIds.size).toFixed(2)) : 0,
    firstTryAcceptance: creativeIds.size
      ? Number(
          ([...editsPer.values()].filter((n) => n <= 2).length / creativeIds.size).toFixed(2)
        )
      : 0,
  };
}
