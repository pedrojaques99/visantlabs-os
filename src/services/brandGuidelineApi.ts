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

export const brandGuidelineApi = {
  async getAll(): Promise<BrandGuideline[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/brand-guidelines`, {
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

  async applyFigTokens(id: string, payload: {
    colors?: any[]; typography?: any[]; gradients?: any[]; shadows?: any[];
    borders?: any[]; tokens?: any; images?: string[]; replace?: boolean;
  }): Promise<{ guideline: BrandGuideline }> {
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

  async extractFig(id: string, file: File): Promise<{ extracted: any; preview: BrandGuideline; dryRun: true }> {
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

  async ingest(id: string, payload: { source: string; url?: string; data?: any; images?: string[]; filename?: string; dryRun?: boolean }): Promise<{ guideline?: BrandGuideline; extracted: any; preview?: BrandGuideline; dryRun?: boolean }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}/ingest`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || errorData.error || 'Failed to ingest brand guideline data');
    }
    const result = await response.json();
    return result;
  },

  // ── Media Kit ──

  async uploadMedia(guidelineId: string, base64Data: string, label?: string, contentType?: string): Promise<{ media: any; allMedia: any[] }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/media`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ data: base64Data, label, contentType }),
    });

    if (!response.ok) throw new Error('Failed to upload media');
    return response.json();
  },

  async uploadMediaFromUrl(guidelineId: string, url: string, label?: string, type?: 'image' | 'pdf'): Promise<{ media: any; allMedia: any[] }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/media`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ url, label, type }),
    });

    if (!response.ok) throw new Error('Failed to upload media from URL');
    return response.json();
  },

  async deleteMedia(guidelineId: string, mediaId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/media/${mediaId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error('Failed to delete media');
  },

  // ── Logos ──

  async uploadLogo(guidelineId: string, base64Data: string, variant?: string, label?: string): Promise<{ logo: any; allLogos: any[] }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/logos`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ data: base64Data, variant, label }),
    });

    if (!response.ok) throw new Error('Failed to upload logo');
    return response.json();
  },

  async uploadLogoFromUrl(guidelineId: string, url: string, variant?: string, label?: string): Promise<{ logo: any; allLogos: any[] }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/logos`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ url, variant, label }),
    });

    if (!response.ok) throw new Error('Failed to upload logo from URL');
    return response.json();
  },

  async deleteLogo(guidelineId: string, logoId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/logos/${logoId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) throw new Error('Failed to delete logo');
  },

  // ── Agent-First Context ──

  async getContext(guidelineId: string, format: 'structured' | 'prompt' = 'structured'): Promise<any> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/context?format=${format}`, {
      headers: getAuthHeaders(),
    });

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

  async share(guidelineId: string): Promise<{ publicSlug: string; shareUrl: string; isPublic: boolean }> {
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

  async getPublic(slug: string): Promise<BrandGuideline> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/public/${slug}`);

    if (!response.ok) throw new Error('Brand guideline not found or not public');
    const data = await response.json();
    return data.guideline;
  },

  // ── Figma Integration ──

  async linkFigmaFile(id: string, figmaFileUrl: string): Promise<{ figmaFileUrl: string; figmaFileKey: string; guideline: BrandGuideline }> {
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

  async syncFromFigma(id: string, data: {
    fileKey: string;
    variables?: { colors?: any[]; numbers?: any[] };
    styles?: { colors?: any[]; text?: any[]; effects?: any[] };
    components?: any[];
  }): Promise<{ guideline: BrandGuideline; syncedAt: string; stats: any }> {
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

  async importFromFigma(id: string, options: {
    importColors?: boolean;
    importTypography?: boolean;
    selectedLogos?: string[];
  }): Promise<{ success: boolean; imported: { colors: number; typography: number; logos: number }; guideline: BrandGuideline }> {
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

  async deleteKnowledge(guidelineId: string, fileId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/knowledge/${fileId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
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

  async addCollaborator(guidelineId: string, email: string, role: 'editor' | 'viewer'): Promise<BrandCollaborator> {
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
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${guidelineId}/collaborators/${userId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to remove collaborator');
  },
};

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
