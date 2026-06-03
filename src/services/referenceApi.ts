import { API_BASE } from '@/config/api';
import { authService } from './authService';
import { aiApi } from './aiApi';
import { mockupApi } from './mockupApi';

export interface ReferenceResult {
  id: string;
  name: string;
  description: string;
  referenceImageUrl: string;
  dimensions: Record<string, string[]>;
  prompt?: string;
  tags?: string[];
  relevanceScore: number;
  sanitized?: boolean;
}

interface SmartSearchParams {
  brandGuidelineId?: string | null;
  query?: string;
  limit?: number;
}

const cache = new Map<string, { data: ReferenceResult[]; ts: number }>();
const CACHE_TTL = 60_000;

export const referenceApi = {
  search: async (params: SmartSearchParams = {}): Promise<ReferenceResult[]> => {
    const searchParams = new URLSearchParams();
    if (params.brandGuidelineId) searchParams.set('brandGuidelineId', params.brandGuidelineId);
    if (params.query?.trim()) searchParams.set('query', params.query.trim());
    if (params.limit) searchParams.set('limit', String(params.limit));

    const cacheKey = searchParams.toString();
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.data;

    const token = authService.getToken();
    const response = await fetch(`${API_BASE}/community/references/smart?${searchParams}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!response.ok) throw new Error('Failed to fetch references');

    const data: ReferenceResult[] = await response.json();
    cache.set(cacheKey, { data, ts: Date.now() });
    return data;
  },

  clearCache: () => cache.clear(),

  sanitize: async (ref: ReferenceResult): Promise<string> => {
    const SANITIZE_PROMPT =
      'Remove all logos, text, branding, artwork, symbols, patterns and any design from this mockup. Make all design surfaces plain white or blank. Slightly shift the camera angle, focal point and scene background to create a unique composition. Keep the product/object and materials intact.';

    const base64 = await aiApi.changeObjectInMockup(
      { url: ref.referenceImageUrl, mimeType: 'image/png' },
      SANITIZE_PROMPT,
      'gemini',
      '1024x1024'
    );

    const newUrl = await mockupApi.uploadTempImage(base64, 'image/png');

    const token = authService.getToken();
    const resp = await fetch(`${API_BASE}/admin/references/${ref.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ referenceImageUrl: newUrl, sanitized: true }),
    });

    if (!resp.ok) throw new Error('Failed to update reference');

    cache.clear();
    return newUrl;
  },
};
