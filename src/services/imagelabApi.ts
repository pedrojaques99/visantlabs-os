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

// ── API ──

export const imagelabApi = {
  generativeExpand(params: GenerativeExpandParams): Promise<GenerativeExpandResult> {
    return post('/generative-expand', params as unknown as Record<string, unknown>);
  },

  removeBackground(params: RemoveBackgroundParams): Promise<RemoveBackgroundResult> {
    return post('/remove-background', params as unknown as Record<string, unknown>);
  },

  applyEffect(params: ApplyEffectParams): Promise<{ base64: string; width: number; height: number; imageUrl?: string }> {
    return post('/apply-effect', params as unknown as Record<string, unknown>);
  },

  applyShader(params: ApplyShaderParams): Promise<{ base64: string; width: number; height: number; imageUrl?: string }> {
    return post('/apply-shader', params as unknown as Record<string, unknown>);
  },

  listPresets(mode: string): Promise<Record<string, unknown>[]> {
    const url = `${API_BASE_URL}/imagelab/presets?mode=${encodeURIComponent(mode)}`;
    return fetch(url, { headers: getAuthHeaders() }).then(r => {
      if (!r.ok) throw new Error(`Failed to fetch presets: ${r.status}`);
      return r.json();
    });
  },
};
