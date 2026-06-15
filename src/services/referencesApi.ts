/**
 * referencesApi — client for the geo-tagged design reference library.
 * Talks to /api/references (see server/routes/references.ts).
 */
import { authService } from './authService';

export interface ReferenceProvenance {
  country?: string;
  region?: string;
  countryInferred?: boolean;
  designer?: string;
  sourceUrl?: string;
  awardSource?: string;
  year?: number;
}

export interface ReferenceItem {
  id: string;
  name: string;
  studio?: string;
  description: string;
  referenceImageUrl: string;
  thumbnailUrl?: string;
  dimensions: Record<string, string[]>;
  provenance?: ReferenceProvenance;
  country?: string;
  region?: string;
  sourceUrl?: string;
  tags: string[];
  createdAt: string;
  score?: number;
  isPublic?: boolean;
}

export interface ReferenceListResponse {
  references: ReferenceItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ReferenceFacets {
  countries: string[];
  regions: string[];
  tags: Array<{ value: string; count: number }>;
}

export interface ReferenceUploadInput {
  data: string; // base64 (no data: prefix)
  name?: string;
  studio?: string;
  designer?: string;
  country?: string;
  region?: string;
  sourceUrl?: string;
  awardSource?: string;
  year?: number;
  tags?: string[];
  isPublic?: boolean;
}

export interface ReferenceListParams {
  page?: number;
  limit?: number;
  search?: string;
  country?: string;
  region?: string;
  tag?: string;
}

const BASE = '/api/references';

function authHeaders(json = false): Record<string, string> {
  const headers: Record<string, string> = {};
  const token = authService.getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

export const referencesApi = {
  async list(params: ReferenceListParams = {}): Promise<ReferenceListResponse> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.search) qs.set('search', params.search);
    if (params.country) qs.set('country', params.country);
    if (params.region) qs.set('region', params.region);
    if (params.tag) qs.set('tag', params.tag);
    const resp = await fetch(`${BASE}?${qs}`, { headers: authHeaders() });
    if (!resp.ok) throw new Error('Failed to load references');
    return resp.json();
  },

  async facets(): Promise<ReferenceFacets> {
    const resp = await fetch(`${BASE}/facets`, { headers: authHeaders() });
    if (!resp.ok) throw new Error('Failed to load facets');
    return resp.json();
  },

  async upload(
    images: ReferenceUploadInput[]
  ): Promise<{ success: boolean; ingested: number; failed: number; results: ReferenceItem[] }> {
    const resp = await fetch(`${BASE}/upload`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ images }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'Upload failed');
    }
    return resp.json();
  },

  async searchByImage(
    imageBase64: string,
    opts: { country?: string; region?: string; limit?: number } = {}
  ): Promise<{ references: ReferenceItem[]; total: number }> {
    const resp = await fetch(`${BASE}/search-by-image`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ imageBase64, ...opts }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'Visual search failed');
    }
    return resp.json();
  },

  async similarTo(id: string, limit = 24): Promise<{ references: ReferenceItem[]; total: number }> {
    const resp = await fetch(`${BASE}/${encodeURIComponent(id)}/similar?limit=${limit}`, {
      headers: authHeaders(),
    });
    if (!resp.ok) throw new Error('Failed to load similar references');
    return resp.json();
  },

  async mine(params: ReferenceListParams = {}): Promise<ReferenceListResponse> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));
    const resp = await fetch(`${BASE}/mine?${qs}`, { headers: authHeaders() });
    if (!resp.ok) throw new Error('Failed to load your references');
    return resp.json();
  },
};
