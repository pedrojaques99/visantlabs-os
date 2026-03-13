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

  async ingest(id: string, payload: { source: string; url?: string; data?: any; filename?: string }): Promise<{ guideline: BrandGuideline; extracted: any }> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/${id}/ingest`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error('Failed to ingest brand guideline data');
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
};
