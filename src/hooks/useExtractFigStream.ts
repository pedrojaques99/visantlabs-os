import { useState, useCallback, useRef } from 'react';

export type FigCategory =
  | 'colors' | 'typography' | 'gradients' | 'shadows'
  | 'borders' | 'radii' | 'components' | 'images' | 'strategy';

export interface FigStreamState {
  status: 'idle' | 'streaming' | 'done' | 'error';
  statusMessage: string;
  colors?: any[];
  typography?: any[];
  gradients?: any[];
  shadows?: any[];
  borders?: any[];
  radii?: number[];
  components?: any[];
  images?: string[];
  strategy?: { manifesto?: string; tagline?: string; description?: string; claims?: string[] };
  error?: string;
}

// Bypass Vite proxy for large streaming uploads — proxy buffers the response.
// Use VITE_API_URL if set, otherwise probe backend ports using a public endpoint.
let _cachedBase: string | null = null;
async function getBackendBase(): Promise<string> {
  if (_cachedBase) return _cachedBase;
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) { _cachedBase = envUrl; return _cachedBase; }
  for (const port of [3001, 3100, 3002, 3003]) {
    try {
      // Probe a public endpoint that returns non-5xx without auth
      const r = await fetch(`http://localhost:${port}/api/brand-guidelines/public/__probe__`, {
        signal: AbortSignal.timeout(800),
      });
      if (r.status < 500) {
        _cachedBase = `http://localhost:${port}/api`;
        return _cachedBase;
      }
    } catch { /* try next */ }
  }
  return '/api'; // fallback to Vite proxy
}

const API_BASE = '/api';

/**
 * Generic streaming hook — reusable for any multipart file extraction endpoint
 * that returns NDJSON events in the FigStreamState format.
 */
export function useExtractFileStream(guidelineId: string, endpointSuffix: string) {
  const [state, setState] = useState<FigStreamState>({ status: 'idle', statusMessage: '' });
  const abortRef = useRef<AbortController | null>(null);

  const stream = useCallback(async (file: File) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setState({ status: 'streaming', statusMessage: 'Uploading…' });

    const form = new FormData();
    form.append('file', file);
    const token = localStorage.getItem('auth_token') || '';
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const base = await getBackendBase();

    try {
      const response = await fetch(`${base}/brand-guidelines/${guidelineId}/${endpointSuffix}`, {
        method: 'POST',
        headers,
        body: form,
        signal: ctrl.signal,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        setState(s => ({ ...s, status: 'error', error: err.error || 'Upload failed' }));
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed);
            setState(prev => applyEvent(prev, event));
          } catch { /* malformed line, skip */ }
        }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setState(s => ({ ...s, status: 'error', error: err?.message || 'Stream failed' }));
    }
  }, [guidelineId, endpointSuffix]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ status: 'idle', statusMessage: '' });
  }, []);

  return { state, stream, reset };
}

/** Backwards-compatible alias for .fig extraction */
export function useExtractFigStream(guidelineId: string) {
  return useExtractFileStream(guidelineId, 'extract-fig');
}

function applyEvent(prev: FigStreamState, event: any): FigStreamState {
  switch (event.type) {
    case 'status':     return { ...prev, statusMessage: event.message };
    case 'colors':     return { ...prev, colors: event.data };
    case 'typography': return { ...prev, typography: event.data };
    case 'gradients':  return { ...prev, gradients: event.data };
    case 'shadows':    return { ...prev, shadows: event.data };
    case 'borders':    return { ...prev, borders: event.data };
    case 'radii':      return { ...prev, radii: event.data };
    case 'components': return { ...prev, components: event.data };
    case 'images':     return { ...prev, images: event.data };
    case 'strategy':   return { ...prev, strategy: event.data };
    case 'done':       return { ...prev, status: 'done', statusMessage: 'Complete' };
    case 'error':      return { ...prev, status: 'error', error: event.message };
    default:           return prev;
  }
}
