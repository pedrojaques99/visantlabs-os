export type CanvasEventType =
  | 'node_created'
  | 'node_deleted'
  | 'node_connected'
  | 'generation_started'
  | 'generation_completed'
  | 'generation_failed';

interface CanvasEvent {
  event: CanvasEventType;
  nodeType?: string;
  canvasId?: string;
  meta?: Record<string, unknown>;
  ts: number;
}

const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 30_000;

let buffer: CanvasEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  return viteApiUrl || '/api';
};

function flush() {
  if (buffer.length === 0) return;

  const events = buffer.splice(0);
  const url = `${getApiBaseUrl()}/canvas/events`;
  const body = JSON.stringify({ events });
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('auth_token') : null;

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: 'application/json' });
    const sent = navigator.sendBeacon(url, blob);
    if (!sent) {
      fetchFallback(url, body, token);
    }
  } else {
    fetchFallback(url, body, token);
  }
}

function fetchFallback(url: string, body: string, token: string | null) {
  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
    keepalive: true,
  }).catch(() => {});
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

export function trackCanvasEvent(
  event: CanvasEventType,
  nodeType?: string,
  canvasId?: string,
  meta?: Record<string, unknown>
) {
  buffer.push({ event, nodeType, canvasId, meta, ts: Date.now() });

  if (buffer.length >= BATCH_SIZE) {
    flush();
  } else {
    scheduleFlush();
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
