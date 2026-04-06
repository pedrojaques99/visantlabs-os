/**
 * Client-side batcher for Creative edit events.
 * Feeds backend JSONL store → Brand Learning (#5) + Observability (#6).
 *
 * - Debounces 500ms, flushes on batch >=20 or on pagehide.
 * - Fire-and-forget: never blocks the UI, swallows errors.
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
  isCorrection?: boolean;
}

const ENDPOINT = '/api/creative/events';
const FLUSH_MS = 500;
const MAX_BATCH = 20;

let queue: CreativeEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function makeId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function flush() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  try {
    await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch }),
      keepalive: true,
    });
  } catch {
    // swallow — telemetry must never break the app
  }
}

export function trackCreativeEvent(evt: Omit<CreativeEvent, 'id' | 'ts'>) {
  queue.push({ ...evt, id: makeId(), ts: Date.now() });
  if (queue.length >= MAX_BATCH) {
    void flush();
    return;
  }
  if (!timer) {
    timer = setTimeout(() => void flush(), FLUSH_MS);
  }
}

/** Compute a shallow diff between two objects for event payloads. */
export function shallowDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const k of keys) {
    const a = before[k];
    const b = after[k];
    if (a === b) continue;
    // Only stringify for non-primitive (object/array) comparison
    if (typeof a === 'object' || typeof b === 'object') {
      if (JSON.stringify(a) === JSON.stringify(b)) continue;
    }
    diff[k] = { from: a, to: b };
  }
  return diff;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => void flush());
  window.addEventListener('beforeunload', () => void flush());
}
