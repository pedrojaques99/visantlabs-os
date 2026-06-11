/**
 * ImageLab API — Single source of truth for image processing operations.
 *
 * Import this from any app (canvas, imagelab UI, creative studio, etc.)
 * to call server-side image processing endpoints.
 */
import { authService } from './authService';
import type { AspectRatio, Resolution } from '../types/types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/imagelab${path}`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `ImageLab request failed: ${res.status}`);
  }
  return res.json();
}

// ── Types ──

export type ExpandDirection = 'up' | 'down' | 'left' | 'right' | 'all';

export interface ExpandAnchor {
  x: number;
  y: number;
}

export interface GenerativeExpandParams {
  imageUrl: string;
  direction?: ExpandDirection;
  anchor?: ExpandAnchor;
  targetAspectRatio?: AspectRatio;
  expandFactor?: number;
  prompt?: string;
  resolution?: Resolution;
  apiKey?: string;
}

export interface GenerativeExpandResult {
  imageUrl: string;
  base64: string;
  revisedPrompt?: string;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
}

export interface RemoveBackgroundParams {
  imageUrl: string;
  outputFormat?: 'png' | 'webp';
}

export interface RemoveBackgroundResult {
  imageUrl: string;
  format: string;
  engine: 'rembg' | 'imgly';
}

export type InpaintMode = 'replace' | 'remove' | 'retouch';

export interface MaskRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface InpaintParams {
  imageUrl: string;
  mode: InpaintMode;
  prompt?: string;
  maskBase64?: string;
  maskRegion?: MaskRegion;
  resolution?: Resolution;
  aspectRatio?: AspectRatio;
  apiKey?: string;
}

export interface InpaintResult {
  imageUrl: string;
  base64: string;
  revisedPrompt?: string;
  mode: InpaintMode;
}

export interface ApplyEffectParams {
  imageUrl: string;
  mode: string;
  preset?: string;
  settings?: Record<string, unknown>;
  format?: 'png' | 'jpeg';
  quality?: number;
}

export interface ApplyShaderParams {
  imageUrl: string;
  shaderType: string;
  settings?: Record<string, unknown>;
  format?: 'png' | 'jpeg';
}

// ── Async job types (mirror server/lib/imagelabJobs.ts) ──

export type ImageLabJobKind = 'generative-expand' | 'inpaint';
export type ImageLabJobStatus = 'pending' | 'processing' | 'done' | 'error';

export interface ImageLabJob<TResult = unknown> {
  jobId: string;
  kind?: ImageLabJobKind;
  status: ImageLabJobStatus;
  createdAt?: number;
  updatedAt?: number;
  result?: TResult;
  error?: string;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE_URL}/imagelab${path}`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `ImageLab request failed: ${res.status}`);
  }
  return res.json();
}

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 min — matches the server orphan window

/**
 * Poll an ImageLab job until it reaches a terminal status. Resolves with the
 * provider result on `done`; throws on `error` or timeout. `onTick` lets callers
 * surface progress without a new UI component (reuse existing spinner/toast).
 */
export async function pollImageLabJob<TResult>(
  jobId: string,
  opts: { onTick?: (job: ImageLabJob<TResult>) => void; signal?: AbortSignal } = {}
): Promise<TResult> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    if (opts.signal?.aborted) throw new Error('Polling aborted');
    const job = await get<ImageLabJob<TResult>>(`/jobs/${jobId}`);
    opts.onTick?.(job);
    if (job.status === 'done') {
      if (job.result === undefined) throw new Error('Job finished without a result');
      return job.result;
    }
    if (job.status === 'error') {
      throw new Error(job.error || 'Generation failed');
    }
    if (Date.now() > deadline) throw new Error('Generation timed out');
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

// ── API ──

export const imagelabApi = {
  generativeExpand(params: GenerativeExpandParams): Promise<GenerativeExpandResult> {
    return post('/generative-expand', params as unknown as Record<string, unknown>);
  },

  inpaint(params: InpaintParams): Promise<InpaintResult> {
    return post('/inpaint', params as unknown as Record<string, unknown>);
  },

  /** Async variant: returns a jobId immediately; poll with `pollImageLabJob`. */
  generativeExpandAsync(params: GenerativeExpandParams): Promise<{ jobId: string }> {
    return post('/generative-expand', { ...params, async: true } as unknown as Record<
      string,
      unknown
    >);
  },

  /** Async variant: returns a jobId immediately; poll with `pollImageLabJob`. */
  inpaintAsync(params: InpaintParams): Promise<{ jobId: string }> {
    return post('/inpaint', { ...params, async: true } as unknown as Record<string, unknown>);
  },

  getJob<TResult = unknown>(jobId: string): Promise<ImageLabJob<TResult>> {
    return get(`/jobs/${jobId}`);
  },

  removeBackground(params: RemoveBackgroundParams): Promise<RemoveBackgroundResult> {
    return post('/remove-background', params as unknown as Record<string, unknown>);
  },

  applyEffect(
    params: ApplyEffectParams
  ): Promise<{ base64: string; width: number; height: number; imageUrl?: string }> {
    return post('/apply-effect', params as unknown as Record<string, unknown>);
  },

  applyShader(
    params: ApplyShaderParams
  ): Promise<{ base64: string; width: number; height: number; imageUrl?: string }> {
    return post('/apply-shader', params as unknown as Record<string, unknown>);
  },

  listPresets(mode: string): Promise<Record<string, unknown>[]> {
    const url = `${API_BASE_URL}/imagelab/presets?mode=${encodeURIComponent(mode)}`;
    return fetch(url, { headers: getAuthHeaders() }).then((r) => {
      if (!r.ok) throw new Error(`Failed to fetch presets: ${r.status}`);
      return r.json();
    });
  },
};
