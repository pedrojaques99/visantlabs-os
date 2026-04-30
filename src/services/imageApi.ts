import { authService } from './authService';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

export interface SearchImage {
  url: string;
  title: string;
  width: number;
  height: number;
  thumbnailUrl?: string;
  source?: string;
  domain?: string;
  link?: string;
}

export interface ImageSearchResult {
  success: boolean;
  count: number;
  images: SearchImage[];
  fromCache?: boolean;
}

export interface DocExtractionResult {
  success: boolean;
  pageNumber: number;
  data: {
    images: Array<{
      name: string;
      description: string;
      boundingBox: [number, number, number, number];
    }>;
  };
}

export type ContentMode = 'all' | 'logo' | 'illustration' | 'vector' | 'photo' | 'creative';

export interface DesignerParams {
  size?: 'large' | 'all';
  type?: 'transparent' | 'photo' | 'clipart' | 'lineart' | 'all';
  aspect?: 'square' | 'wide' | 'tall' | 'all';
  contentMode?: ContentMode;
}

export const imageApi = {
  searchImages: async (query: string, mode: 'google' | 'instagram' = 'google', limit: number = 40, designerParams?: DesignerParams): Promise<ImageSearchResult> => {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE}/images/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ query, mode, limit, designerParams }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to search images');
    }

    return response.json();
  },

  extractFromUrl: async (url: string, limit: number = 50): Promise<ImageSearchResult> => {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE}/images/extract-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ url, limit }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extract images');
    }

    return response.json();
  },

  analyzeDocPage: async (imageBase64: string, pageNumber: number): Promise<DocExtractionResult> => {
    const token = authService.getToken();
    const response = await fetch(`${API_BASE}/images/extract-doc`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ imageBase64, pageNumber }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to analyze page');
    }

    return response.json();
  },

  // Legacy (Redirected to search internally if needed, but keeping for compatibility)
  extractInstagram: async (username: string, limit: number = 40): Promise<ImageSearchResult> => {
    return imageApi.searchImages(username, 'instagram', limit);
  },

  getProxiedDownloadUrl: (imageUrl: string, filename: string): string => {
    const baseUrl = window.location.origin;
    const encodedUrl = encodeURIComponent(imageUrl);
    const encodedFilename = encodeURIComponent(filename);
    return `${baseUrl}/api/images/download?url=${encodedUrl}&filename=${encodedFilename}`;
  }
};
