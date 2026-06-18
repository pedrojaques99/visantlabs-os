import { authService } from './authService';
import type { BrandGuideline } from '../lib/figma-types';

const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl;
  }
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

/**
 * Build an Error that carries the server's machine-readable `error` code on a
 * `.code` property, so callers can map codes (e.g. `vision_not_configured`) to
 * friendly, user-facing copy instead of leaking raw "Set GEMINI_API_KEY…" text.
 */
const codedError = (body: any, fallback: string): Error & { code?: string } => {
  const err = new Error(body?.message || body?.error || fallback) as Error & { code?: string };
  if (typeof body?.error === 'string') err.code = body.error;
  return err;
};

export const brandGuidelineApi = {
  async getAll(params?: { limit?: number; offset?: number }): Promise<BrandGuideline[]> {
    try {
      const qs = new URLSearchParams();
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.offset) qs.set('offset', String(params.offset));
      const suffix = qs.toString() ? `?${qs}` : '';

      const response = await fetch(`${API_BASE_URL}/brand-guidelines${suffix}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch brand guidelines: ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data.guidelines) ? data.guidelines : [];
    } catch (error) {
      console.error('API Error fetching brand guidelines:', error);
      return [];
    }
  },

  async getById(id: string): Promise<BrandGuideline> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error('Failed to fetch brand guideline');
    const data = await response.json();
    return data.guideline;
  },

  async create(data: Partial<BrandGuideline>): Promise<BrandGuideline> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error('Failed to create brand guideline');
    const result = await response.json();
    return result.guideline;
  },

  async update(id: string, guideline: Partial<BrandGuideline>): Promise<BrandGuideline> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(guideline),
    });
    if (!response.ok) throw new Error('Failed to update brand guideline');
    const result = await response.json();
    return result.guideline;
  },

  async syncFromBrandingProject(projectId: string): Promise<BrandGuideline> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/sync/${projectId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to sync from branding project');
    }
    return response.json();
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error('Failed to delete brand guideline');
  },

  async duplicate(id: string): Promise<BrandGuideline> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}/duplicate`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error('Failed to duplicate brand guideline');
    const result = await response.json();
    return result.guideline;
  },

  async applyFigTokens(
    id: string,
    payload: {
      colors?: any[];
      typography?: any[];
      gradients?: any[];
      shadows?: any[];
      borders?: any[];
      tokens?: any;
      images?: string[];
      replace?: boolean;
    }
  ): Promise<{ guideline: BrandGuideline }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}/apply-fig-tokens`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to apply .fig tokens');
    }
    return response.json();
  },

  async extractFig(
    id: string,
    file: File
  ): Promise<{ extracted: any; preview: BrandGuideline; dryRun: true }> {
    const form = new FormData();
    form.append('file', file);
    const { Authorization } = getAuthHeaders() as any;
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}/extract-fig`, {
      method: 'POST',
      headers: Authorization ? { Authorization } : {},
      body: form,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to extract .fig file');
    }
    return response.json();
  },

  async ingest(
    id: string,
    payload: {
      source: string;
      url?: string;
      data?: any;
      images?: string[];
      filename?: string;
      dryRun?: boolean;
    }
  ): Promise<{
    guideline?: BrandGuideline;
    extracted: any;
    preview?: BrandGuideline;
    dryRun?: boolean;
    /** False when the source yielded no new brand data (so the UI can say so honestly). */
    changed?: boolean;
    /** Present when `changed` is false — a user-facing explanation. */
    warning?: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}/ingest`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message || errorData.error || 'Failed to ingest brand guideline data'
      );
    }
    const result = await response.json();
    return result;
  },

  async suggestMockups(
    id: string,
    count = 10
  ): Promise<{
    suggestions: Array<{ prompt: string; category: string; aspectRatio: string; label: string }>;
  }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}/suggest-mockups`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ count }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Failed to suggest mockups');
    }
    return response.json();
  },

  /** Seasonal/contextual on-brand IDEAS for the interactive panel (free, cached weekly). */
  async getSuggestions(
    id: string,
    opts: { count?: number; force?: boolean } = {}
  ): Promise<{
    suggestions: BrandSuggestion[];
    seasonal: { market: string; upcoming: Array<{ key: string; label: string; daysAway: number }> };
    provider?: string;
    cached?: boolean;
  }> {
    const qs = new URLSearchParams();
    if (opts.count) qs.set('count', String(opts.count));
    if (opts.force) qs.set('force', 'true');
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}/suggestions?${qs}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw codedError(body, 'Failed to load suggestions');
    }
    return response.json();
  },

  async aiPopulate(
    id: string,
    sections?: string[]
  ): Promise<{ patch: Record<string, any>; generated: string[] }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}/ai-populate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ sections }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Failed to generate brand content');
    }
    return response.json();
  },

  // ── Media Kit ──

  async uploadMedia(
    guidelineId: string,
    base64Data: string,
    label?: string,
    contentType?: string
  ): Promise<{ media: any; allMedia: any[] }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/media`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ data: base64Data, label, contentType }),
    });

    if (!response.ok) throw new Error('Failed to upload media');
    return response.json();
  },

  async uploadMediaFromUrl(
    guidelineId: string,
    url: string,
    label?: string,
    type?: 'image' | 'pdf'
  ): Promise<{ media: any; allMedia: any[] }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/media`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ url, label, type }),
    });

    if (!response.ok) throw new Error('Failed to upload media from URL');
    return response.json();
  },

  /** Re-derive per-color usage proportions from the brand's own assets. */
  async recomputeColorUsage(
    guidelineId: string
  ): Promise<{ colors: BrandGuideline['colors']; guideline?: BrandGuideline }> {
    const response = await fetch(
      `${API_BASE_URL}/brand-guidelines/${guidelineId}/color-usage/recompute`,
      { method: 'POST', headers: getAuthHeaders() }
    );
    if (!response.ok) throw new Error('Failed to compute color usage');
    return response.json();
  },

  /** Start an async asset-analysis job (returns immediately with a jobId). */
  async startAssetAnalysis(
    guidelineId: string,
    force = false
  ): Promise<{ jobId: string; status: string }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/assets/analyze`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ force }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw codedError(body, 'Failed to start asset analysis');
    }
    return response.json();
  },

  /** Fetch the current state of an asset-analysis job. */
  async getAssetAnalysisJob(
    guidelineId: string,
    jobId: string
  ): Promise<{
    status: 'pending' | 'processing' | 'done' | 'error';
    processed: number;
    total: number;
    analyzed: number;
    failed?: number;
    signature?: any;
    error?: string;
  }> {
    const response = await fetch(
      `${API_BASE_URL}/brand-guidelines/${guidelineId}/assets/analyze/${jobId}`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.message || body?.error || 'Failed to load analysis job');
    }
    return response.json();
  },

  /** Start + poll an asset-analysis job to completion, reporting progress. */
  async analyzeAssets(
    guidelineId: string,
    opts: { force?: boolean; onProgress?: (p: { processed: number; total: number }) => void } = {}
  ): Promise<{ analyzed: number; failed: number; total: number; signature: any }> {
    const { jobId } = await this.startAssetAnalysis(guidelineId, opts.force ?? false);
    const POLL_MS = 1500;
    const DEADLINE = Date.now() + 30 * 60 * 1000; // 30 min ceiling for huge brands
    for (;;) {
      const job = await this.getAssetAnalysisJob(guidelineId, jobId);
      opts.onProgress?.({ processed: job.processed, total: job.total });
      if (job.status === 'done')
        return {
          analyzed: job.analyzed,
          failed: job.failed ?? 0,
          total: job.total,
          signature: job.signature,
        };
      if (job.status === 'error') throw new Error(job.error || 'Analysis failed');
      if (Date.now() > DEADLINE) throw new Error('Analysis timed out');
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
  },

  /** Semantic search within a brand's own indexed assets. */
  async searchAssets(
    guidelineId: string,
    query: string,
    topK = 12
  ): Promise<{ query: string; results: any[] }> {
    const params = new URLSearchParams({ q: query, topK: String(topK) });
    const response = await fetch(
      `${API_BASE_URL}/brand-guidelines/${guidelineId}/assets/search?${params}`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw codedError(body, 'Failed to search assets');
    }
    return response.json();
  },

  /** "More like this" — assets semantically similar to a given asset. */
  async similarAssets(guidelineId: string, assetId: string): Promise<{ results: any[] }> {
    const response = await fetch(
      `${API_BASE_URL}/brand-guidelines/${guidelineId}/assets/${assetId}/similar`,
      { headers: getAuthHeaders() }
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.message || body?.error || 'Failed to find similar assets');
    }
    return response.json();
  },

  /** Auto-fill missing persona portraits from free stock photos. */
  async resolvePersonaImages(
    guidelineId: string,
    force = false
  ): Promise<{ personas: any[]; resolved: number; guideline?: BrandGuideline }> {
    const response = await fetch(
      `${API_BASE_URL}/brand-guidelines/${guidelineId}/personas/resolve-images`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ force }),
      }
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.message || body?.error || 'Failed to resolve persona images');
    }
    return response.json();
  },

  async deleteMedia(guidelineId: string, mediaId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/brand-guidelines/${guidelineId}/media/${mediaId}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) throw new Error('Failed to delete media');
  },

  // ── Logos ──

  async uploadLogo(
    guidelineId: string,
    base64Data: string,
    variant?: string,
    label?: string
  ): Promise<{ logo: any; allLogos: any[] }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/logos`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ data: base64Data, variant, label }),
    });

    if (!response.ok) throw new Error('Failed to upload logo');
    return response.json();
  },

  async uploadLogoFromUrl(
    guidelineId: string,
    url: string,
    variant?: string,
    label?: string
  ): Promise<{ logo: any; allLogos: any[] }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/logos`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ url, variant, label }),
    });

    if (!response.ok) throw new Error('Failed to upload logo from URL');
    return response.json();
  },

  async deleteLogo(guidelineId: string, logoId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/brand-guidelines/${guidelineId}/logos/${logoId}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) throw new Error('Failed to delete logo');
  },

  // ── Agent-First Context ──

  async getContext(
    guidelineId: string,
    format: 'structured' | 'prompt' = 'structured'
  ): Promise<any> {
    const response = await fetch(
      `${API_BASE_URL}/brand-guidelines/${guidelineId}/context?format=${format}`,
      {
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) throw new Error('Failed to fetch brand context');
    if (format === 'prompt') return response.text();
    return response.json();
  },

  async runHealthCheck(guidelineId: string): Promise<BrandHealthReport> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/health-check`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Failed to run brand health check');
    }
    const data = await response.json();
    return data.report as BrandHealthReport;
  },

  // ── Public Sharing ──

  async share(
    guidelineId: string
  ): Promise<{ publicSlug: string; shareUrl: string; isPublic: boolean }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/share`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error('Failed to create share link');
    return response.json();
  },

  async unshare(guidelineId: string): Promise<{ isPublic: boolean }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/share`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error('Failed to remove share');
    return response.json();
  },

  async getPublicConnectLink(slug: string): Promise<{ connectUrl: string }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/public/${slug}/connect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error('Failed to create connect link');
    return response.json();
  },

  async getPublic(slug: string): Promise<{ guideline: BrandGuideline; canEdit: boolean }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/public/${slug}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error('Brand guideline not found or not public');
    const data = await response.json();
    return { guideline: data.guideline, canEdit: data.canEdit ?? false };
  },

  // ── Figma Integration ──

  async linkFigmaFile(
    id: string,
    figmaFileUrl: string
  ): Promise<{ figmaFileUrl: string; figmaFileKey: string; guideline: BrandGuideline }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}/figma-link`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ figmaFileUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to link Figma file');
    }
    return response.json();
  },

  async unlinkFigmaFile(id: string): Promise<{ success: boolean; guideline: BrandGuideline }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}/figma-link`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error('Failed to unlink Figma file');
    return response.json();
  },

  async syncFromFigma(
    id: string,
    data: {
      fileKey: string;
      variables?: { colors?: any[]; numbers?: any[] };
      styles?: { colors?: any[]; text?: any[]; effects?: any[] };
      components?: any[];
    }
  ): Promise<{ guideline: BrandGuideline; syncedAt: string; stats: any }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}/figma-sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to sync from Figma');
    }
    return response.json();
  },

  // ── Figma REST API (without plugin) ──

  async previewFigmaFile(id: string): Promise<{
    colors: Array<{ hex: string; name: string; role?: string }>;
    typography: Array<{ family: string; style?: string; role: string; size?: number }>;
    components: Array<{ key: string; name: string; thumbnailUrl?: string; description?: string }>;
    message: string;
    needsToken?: boolean;
  }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}/figma-preview`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.needsToken) throw { needsToken: true, message: error.message };
      throw new Error(error.error || 'Failed to preview Figma file');
    }
    return response.json();
  },

  async importFromFigma(
    id: string,
    options: {
      importColors?: boolean;
      importTypography?: boolean;
      selectedLogos?: string[];
    }
  ): Promise<{
    success: boolean;
    imported: { colors: number; typography: number; logos: number };
    guideline: BrandGuideline;
  }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}/figma-import`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to import from Figma');
    }
    return response.json();
  },

  async previewFigmaUrl(figmaUrl: string): Promise<{
    fileKey: string;
    fileName: string;
    lastModified: string;
    colors: Array<{ hex: string; name: string; role?: string }>;
    typography: Array<{ family: string; style?: string; role: string; size?: number }>;
    components: Array<{ key: string; name: string; thumbnailUrl?: string; description?: string }>;
    needsToken?: boolean;
  }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/figma-preview-url`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ figmaUrl }),
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.needsToken) throw { needsToken: true, message: error.message };
      throw new Error(error.error || 'Failed to preview Figma URL');
    }
    return response.json();
  },

  async listKnowledge(guidelineId: string): Promise<BrandKnowledgeFile[]> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/knowledge`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to list knowledge files');
    const data = await response.json();
    return Array.isArray(data.files) ? data.files : [];
  },

  async compile(
    guidelineId: string,
    format: 'css' | 'tailwind' | 'react' | 'scss' | 'all' = 'all'
  ): Promise<{ outputs: Array<{ format: string; filename: string; content: string }> }> {
    if (format === 'all') {
      const response = await fetch(
        `${API_BASE_URL}/brand-guidelines/${guidelineId}/compile?format=all`,
        {
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error('Failed to compile tokens');
      return response.json();
    }
    const response = await fetch(
      `${API_BASE_URL}/brand-guidelines/${guidelineId}/compile?format=${format}`,
      {
        headers: getAuthHeaders(),
      }
    );
    if (!response.ok) throw new Error('Failed to compile tokens');
    const content = await response.text();
    const filename =
      response.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] ||
      `tokens.${format}`;
    return { outputs: [{ format, filename, content }] };
  },

  async uploadKnowledge(
    guidelineId: string,
    body: { source: string; data?: string; url?: string; filename?: string }
  ): Promise<BrandKnowledgeFile> {
    const response = await fetch(
      `${API_BASE_URL}/brand-guidelines/${guidelineId}/knowledge/upload`,
      {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to upload' }));
      throw new Error(err.error || 'Failed to upload knowledge file');
    }
    const data = await response.json();
    return data.file;
  },

  async deleteKnowledge(guidelineId: string, fileId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/brand-guidelines/${guidelineId}/knowledge/${fileId}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    );
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to delete' }));
      throw new Error(err.error || 'Failed to delete knowledge file');
    }
  },

  // ── Collaborators ──

  async getCollaborators(guidelineId: string): Promise<BrandCollaborator[]> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/collaborators`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch collaborators');
    const data = await response.json();
    return data.collaborators;
  },

  async addCollaborator(
    guidelineId: string,
    email: string,
    role: 'editor' | 'viewer'
  ): Promise<BrandCollaborator> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/collaborators`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ email, role }),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Failed to add collaborator' }));
      throw new Error(err.error || 'Failed to add collaborator');
    }
    const data = await response.json();
    return data.collaborator;
  },

  async removeCollaborator(guidelineId: string, userId: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/brand-guidelines/${guidelineId}/collaborators/${userId}`,
      {
        method: 'DELETE',
        headers: getAuthHeaders(),
      }
    );
    if (!response.ok) throw new Error('Failed to remove collaborator');
  },
};

export interface BrandSuggestion {
  title: string;
  rationale: string;
  prompt: string;
  kind: 'mockup' | 'social' | 'print';
  aspectRatio: string;
}

export interface BrandCollaborator {
  id: string;
  email: string;
  name?: string | null;
  picture?: string | null;
  role: 'editor' | 'viewer';
}

export interface BrandKnowledgeFile {
  id: string;
  fileName: string;
  source: 'pdf' | 'image' | 'url' | 'text';
  vectorIds: string[];
  addedByUserId: string;
  addedAt: string;
}

export interface BrandHealthInsight {
  level: 'pass' | 'warn' | 'fail';
  category: 'identity' | 'visual' | 'strategy' | 'voice' | 'tokens' | 'coherence';
  title: string;
  detail: string;
}

export interface BrandHealthRecommendation {
  action: string;
  reason: string;
}

export interface BrandHealthReport {
  score: number;
  summary: string;
  insights: BrandHealthInsight[];
  recommendations: BrandHealthRecommendation[];
  model: string;
  tokens: { input?: number; output?: number };
  generatedAt: string;
}
