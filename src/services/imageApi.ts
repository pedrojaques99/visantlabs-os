import { authService } from './authService';

export interface InstagramPost {
  url: string;
  caption: string;
}

export interface InstagramExtractionResult {
  success: boolean;
  username: string;
  count: number;
  images: InstagramPost[];
  fromCache?: boolean;
}

export const imageApi = {
  extractInstagram: async (username: string, limit: number = 40): Promise<InstagramExtractionResult> => {
    const token = authService.getToken();
    const response = await fetch('/api/images/instagram-extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ username, limit }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to extract images');
    }

    return response.json();
  },

  getProxiedDownloadUrl: (imageUrl: string, filename: string): string => {
    const baseUrl = window.location.origin;
    const encodedUrl = encodeURIComponent(imageUrl);
    const encodedFilename = encodeURIComponent(filename);
    return `${baseUrl}/api/images/download?url=${encodedUrl}&filename=${encodedFilename}`;
  }
};
