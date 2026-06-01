import { API_BASE } from '@/config/api';
import { authService } from './authService';

export interface ReferenceResult {
  id: string;
  name: string;
  description: string;
  referenceImageUrl: string;
  dimensions: Record<string, string[]>;
  prompt?: string;
  tags?: string[];
  relevanceScore: number;
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
};
