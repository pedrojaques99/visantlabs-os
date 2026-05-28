import { API_BASE } from '@/config/api';

export type SearchSource = 'unsplash' | 'pexels' | 'pixabay' | 'wikimedia' | 'clearbit' | 'svgl' | 'google';
export type SearchIntent = 'letter' | 'logo' | 'layout' | 'typography' | 'mixed';

export interface VisualSearchResult {
  id: string;
  type: 'photo' | 'logo' | 'vector' | 'manuscript';
  source: SearchSource;
  imageUrl: string;
  thumbnailUrl: string;
  title: string;
  description?: string;
  tags: string[];
  dimensions: { width: number; height: number };
  attribution?: {
    author: string;
    authorUrl?: string;
    license: string;
  };
  relevanceScore: number;
  metadata?: {
    brandName?: string;
    category?: string;
  };
}

export interface LetterCrop {
  id: string;
  letter: string;
  cropUrl: string;
  thumbnailUrl: string;
  style?: string;
  source: string;
  sourceImageUrl: string;
  dimensions: { width: number; height: number };
}

export interface VisualSearchResponse {
  success: boolean;
  fromCache: boolean;
  results: VisualSearchResult[];
  intent: SearchIntent;
  sources: { source: SearchSource; count: number; error?: string }[];
  total: number;
  hasMore: boolean;
  query: string;
  page: number;
  letterCrops?: LetterCrop[];
}

export interface SourceInfo {
  id: SearchSource;
  name: string;
  available: boolean;
  type: string;
}

export const visualSearchApi = {
  search: async (
    query: string,
    options?: { sources?: SearchSource[]; limit?: number; page?: number },
  ): Promise<VisualSearchResponse> => {
    const response = await fetch(`${API_BASE}/visual-search/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        sources: options?.sources,
        limit: options?.limit || 60,
        page: options?.page || 1,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Search failed' }));
      throw new Error(error.error || 'Failed to search');
    }

    return response.json();
  },

  getSources: async (): Promise<{ sources: SourceInfo[] }> => {
    const response = await fetch(`${API_BASE}/visual-search/sources`);
    if (!response.ok) throw new Error('Failed to fetch sources');
    return response.json();
  },

  getLibrary: async (
    options?: { letter?: string; style?: string; limit?: number; offset?: number },
  ): Promise<{ crops: LetterCrop[]; total: number }> => {
    const params = new URLSearchParams();
    if (options?.letter) params.set('letter', options.letter);
    if (options?.style) params.set('style', options.style);
    if (options?.limit) params.set('limit', String(options.limit));
    if (options?.offset) params.set('offset', String(options.offset));

    const response = await fetch(`${API_BASE}/visual-search/library?${params}`);
    if (!response.ok) throw new Error('Failed to fetch library');
    return response.json();
  },
};
