import { authService } from './authService';
import type { CreativeLayer, CreativeOverlay } from '@/components/creative/store/creativeTypes';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

function headers() {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export interface CreativeProjectSummary {
  _id: string;
  id: string;
  name: string;
  prompt: string;
  format: string;
  brandId: string | null;
  backgroundUrl: string | null;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreativePage {
  id: string;
  format: string;
  layers: CreativeLayer[];
  backgroundUrl: string | null;
  overlay: CreativeOverlay | null;
}

export interface CreativeProject extends CreativeProjectSummary {
  overlay: CreativeOverlay | null;
  layers: CreativeLayer[];
  pages?: CreativePage[];
  activePageIndex?: number;
}

export interface SaveCreativeProjectInput {
  name?: string;
  prompt: string;
  format: string;
  brandId?: string | null;
  backgroundUrl?: string | null;
  overlay?: CreativeOverlay | null;
  layers: CreativeLayer[];
  pages?: CreativePage[];
  activePageIndex?: number;
  thumbnailUrl?: string | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export const creativeProjectApi = {
  list(brandId?: string): Promise<CreativeProjectSummary[]> {
    const qs = brandId ? `?brandId=${brandId}` : '';
    return request<{ projects: CreativeProjectSummary[] }>(`/creative-projects${qs}`).then(
      (r) => r.projects
    );
  },

  get(id: string): Promise<CreativeProject> {
    return request<{ project: CreativeProject }>(`/creative-projects/${id}`).then((r) => r.project);
  },

  create(
    input: SaveCreativeProjectInput,
    opts?: { signal?: AbortSignal }
  ): Promise<CreativeProject> {
    return request<{ project: CreativeProject }>(`/creative-projects`, {
      method: 'POST',
      body: JSON.stringify(input),
      signal: opts?.signal,
    }).then((r) => r.project);
  },

  update(
    id: string,
    input: Partial<SaveCreativeProjectInput>,
    opts?: { signal?: AbortSignal }
  ): Promise<CreativeProject> {
    return request<{ project: CreativeProject }>(`/creative-projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
      signal: opts?.signal,
    }).then((r) => r.project);
  },

  remove(id: string): Promise<void> {
    return request<{ ok: true }>(`/creative-projects/${id}`, { method: 'DELETE' }).then(
      () => undefined
    );
  },
};
