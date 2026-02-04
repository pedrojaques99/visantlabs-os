import { authService } from './authService';

// Get API URL from environment or use current origin for production
const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl;
  }
  // Use relative URL - works in both local (with proxy) and production
  // In production on Vercel: /api redirects to serverless function
  // In local dev: vite.config.ts proxy redirects /api to http://localhost:3001
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

export interface GenerateVideoParams {
  prompt: string;
  negativePrompt?: string;
  mode?: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: string;

  // Media inputs (Base64 or URL)
  startFrame?: string;
  endFrame?: string;
  referenceImages?: string[];
  inputVideo?: string;

  isLooping?: boolean;

  model?: string;
  canvasId?: string;
  nodeId?: string;
}

export interface GenerateVideoResponse {
  videoUrl?: string; // R2 URL (preferred)
  videoBase64?: string; // Base64 fallback (only if R2 URL not available)
  creditsDeducted: number;
  creditsRemaining: number;
  isAdmin: boolean;
}

export const videoApi = {
  /**
   * Generate video using backend endpoint (validates and deducts credits BEFORE generation)
   */
  async generate(params: GenerateVideoParams): Promise<GenerateVideoResponse> {
    const response = await fetch(`${API_BASE_URL}/video/generate`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        prompt: params.prompt,
        negativePrompt: params.negativePrompt,
        mode: params.mode,
        aspectRatio: params.aspectRatio,
        resolution: params.resolution,
        duration: params.duration,

        startFrame: params.startFrame,
        endFrame: params.endFrame,
        referenceImages: params.referenceImages,
        inputVideo: params.inputVideo,

        isLooping: params.isLooping,

        model: params.model || 'veo-3.1-generate-preview',
        canvasId: params.canvasId,
        nodeId: params.nodeId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to generate video: ${response.status} ${response.statusText}`;

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }

      const error = new Error(errorMessage);
      (error as any).status = response.status;
      throw error;
    }

    const data = await response.json();
    return data;
  },
};






