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
  /** Per-session seed — makes the feed order fresh per visit (see ReferencesPage). */
  seed?: string;
  /** Active brand id — used for ranking novelty/telemetry, not as a hard filter. */
  brandId?: string;
  /** Descriptive brand tokens — boost references that match the active brand. */
  brandTerms?: string;
  /** Rank a text query by meaning (vector search) instead of substring. */
  semantic?: boolean;
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
    if (params.seed) qs.set('seed', params.seed);
    if (params.brandId) qs.set('brandId', params.brandId);
    if (params.brandTerms) qs.set('brandTerms', params.brandTerms);
    // Semantic only matters with a query; skip the flag otherwise so the ranked
    // feed (no query) always takes the cheap lexical path.
    if (params.semantic && params.search) qs.set('semantic', '1');
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
  ): Promise<{
    success: boolean;
    ingested: number;
    /** Images already in the user's library — recognised by content hash. */
    deduped: number;
    /** New uploads now awaiting moderation (no AI ran, nothing public yet). */
    pending: number;
    failed: number;
    results: ReferenceItem[];
  }> {
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

// ── Admin curation (admin-only; enforced server-side by validateAdmin) ─────────
export interface ReferenceAdminPatch {
  name?: string;
  description?: string;
  tags?: string[];
  dimensions?: Record<string, string[]>;
  designer?: string;
  sourceUrl?: string;
  country?: string;
  region?: string;
  isPublic?: boolean;
  hiddenFromPublic?: boolean;
}

export interface DuplicateGroup {
  contentHash: string;
  count: number;
  /** The copy that survives a dedupe — the oldest of the group. */
  keep: { id: string; name?: string; createdAt: string };
  duplicates: Array<{ id: string; name?: string; createdAt: string }>;
}

export interface DuplicateReport {
  groups: DuplicateGroup[];
  redundant: number;
  /** Refs with no contentHash yet — not comparable, so not in any group. */
  unhashed: number;
  total: number;
}

export interface PendingReference {
  id: string;
  name?: string;
  referenceImageUrl?: string;
  thumbnailUrl?: string;
  thumbHash?: string;
  provenance?: ReferenceItem['provenance'];
  country?: string;
  palette?: string[];
  width?: number;
  height?: number;
  userId?: string;
  isPublic?: boolean;
  createdAt?: string;
}

export const adminReferencesApi = {
  /** Moderation queue — user uploads awaiting a human decision. Oldest first. */
  async pending(limit = 50, skip = 0): Promise<{ items: PendingReference[]; total: number }> {
    const resp = await fetch(`/api/admin/references/pending?limit=${limit}&skip=${skip}`, {
      headers: authHeaders(),
    });
    if (!resp.ok) throw new Error('Failed to load pending references');
    return resp.json();
  },

  /** Approve → runs the AI enrichment, then makes it public. Slow (AI). */
  async approve(id: string): Promise<void> {
    const resp = await fetch(`/api/admin/references/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!resp.ok) throw new Error((await resp.json().catch(() => ({})))?.error || 'Approve failed');
  },

  /** Reject. Soft by default (keeps the row); hard deletes it and its vector. */
  async reject(id: string, hard = false): Promise<void> {
    const resp = await fetch(
      `/api/admin/references/${encodeURIComponent(id)}/reject${hard ? '?hard=1' : ''}`,
      { method: 'POST', headers: authHeaders() }
    );
    if (!resp.ok) throw new Error('Reject failed');
  },

  /** Duplicate groups by content hash. Admin-only; read-only. */
  async duplicates(): Promise<DuplicateReport> {
    const resp = await fetch('/api/admin/references/duplicates', { headers: authHeaders() });
    if (!resp.ok) throw new Error('Failed to load duplicates');
    return resp.json();
  },

  /** Delete redundant copies (keeps the oldest). Dry run unless told otherwise. */
  async dedupe(
    dryRun = true
  ): Promise<{ dryRun: boolean; groups: number; wouldDelete?: number; deleted?: number }> {
    const resp = await fetch('/api/admin/references/dedupe', {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun }),
    });
    if (!resp.ok) throw new Error('Failed to dedupe');
    return resp.json();
  },

  async remove(id: string): Promise<void> {
    const resp = await fetch(`/api/admin/references/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!resp.ok) throw new Error('Failed to delete reference');
  },

  async update(id: string, patch: ReferenceAdminPatch): Promise<void> {
    const resp = await fetch(`/api/admin/references/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify(patch),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update reference');
    }
  },
};
