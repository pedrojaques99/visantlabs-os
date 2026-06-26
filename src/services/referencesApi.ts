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
  /** Base64 thumbhash for an instant LQIP placeholder. */
  thumbHash?: string;
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

export interface FacetValue {
  value: string;
  count: number;
}

export interface ReferenceFacets {
  countries: string[];
  regions: string[];
  tags: FacetValue[];
  /** Structured dimension facets keyed by dimension (brand_artifact, type_style, ...). */
  dimensions?: Record<string, FacetValue[]>;
}

export interface ReferenceCollection {
  id: string;
  name: string;
  coverUrl?: string;
  /** First up to 4 thumbnails, for a mosaic cover. */
  covers?: string[];
  isPublic?: boolean;
  count: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TasteHint {
  key: string;
  value: string;
  count: number;
}

export interface CollectionDetail {
  collection: ReferenceCollection & { isOwner: boolean };
  items: ReferenceItem[];
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
  /** Coarse content filter for the page toggle. */
  kind?: 'all' | 'branding' | 'mockup';
  /** Structured dimension filters, e.g. { type_style: 'serif', vibe: 'premium' }. */
  dimensions?: Record<string, string>;
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
    if (params.kind && params.kind !== 'all') qs.set('kind', params.kind);
    if (params.dimensions) {
      for (const [k, v] of Object.entries(params.dimensions)) {
        if (v) qs.set(k, v);
      }
    }
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

// ── Collections (Are.na-like per-user boards) ──────────────────────────────────
export const collectionsApi = {
  async list(): Promise<{ collections: ReferenceCollection[] }> {
    const resp = await fetch(`${BASE}/collections`, { headers: authHeaders() });
    if (!resp.ok) throw new Error('Failed to load collections');
    return resp.json();
  },

  async taste(): Promise<{ taste: TasteHint[] }> {
    const resp = await fetch(`${BASE}/collections/taste`, { headers: authHeaders() });
    if (!resp.ok) throw new Error('Failed to load taste');
    return resp.json();
  },

  async create(name: string): Promise<{ collection: ReferenceCollection }> {
    const resp = await fetch(`${BASE}/collections`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ name }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to create collection');
    }
    return resp.json();
  },

  async get(id: string): Promise<CollectionDetail> {
    const resp = await fetch(`${BASE}/collections/${encodeURIComponent(id)}`, {
      headers: authHeaders(),
    });
    if (!resp.ok) throw new Error('Failed to load collection');
    return resp.json();
  },

  async update(id: string, patch: { name?: string; isPublic?: boolean }): Promise<void> {
    const resp = await fetch(`${BASE}/collections/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify(patch),
    });
    if (!resp.ok) throw new Error('Failed to update collection');
  },

  async remove(id: string): Promise<void> {
    const resp = await fetch(`${BASE}/collections/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!resp.ok) throw new Error('Failed to delete collection');
  },

  async addItem(id: string, refId: string): Promise<void> {
    const resp = await fetch(`${BASE}/collections/${encodeURIComponent(id)}/items`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ refId }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to add to collection');
    }
  },

  async removeItem(id: string, refId: string): Promise<void> {
    const resp = await fetch(
      `${BASE}/collections/${encodeURIComponent(id)}/items/${encodeURIComponent(refId)}`,
      { method: 'DELETE', headers: authHeaders() }
    );
    if (!resp.ok) throw new Error('Failed to remove from collection');
  },
};
