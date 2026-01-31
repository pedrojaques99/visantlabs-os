import { authService } from './authService';
import type { UploadedImage } from '../types/types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface MockupSetupAnalysis {
  branding: string[];
  categories: string[];
  locations: string[];
  angles: string[];
  lighting: string[];
  effects: string[];
  materials: string[];
  designType: 'logo' | 'layout';
}

export const aiApi = {
  /**
   * Improve a text prompt using AI
   */
  async improvePrompt(prompt: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/ai/improve-prompt`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to improve prompt' }));
      throw new Error(error.error || 'Failed to improve prompt');
    }

    const data = await response.json();
    return data.improvedPrompt;
  },

  /**
   * Generate a description of an image
   */
  async describeImage(image: UploadedImage | string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/ai/describe-image`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ image }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to describe image' }));
      throw new Error(error.error || 'Failed to describe image');
    }

    const data = await response.json();
    return data.description;
  },

  /**
   * Suggest mockup categories based on an image and branding tags
   */
  async suggestCategories(baseImage: UploadedImage, brandingTags: string[]): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/ai/suggest-categories`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ baseImage, brandingTags }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to suggest categories' }));
      throw new Error(error.error || 'Failed to suggest categories');
    }

    const data = await response.json();
    return data.categories;
  },

  async analyzeSetup(
    baseImage: UploadedImage,
    instructions?: string,
    userContext?: { selectedBrandingTags?: string[] }
  ): Promise<MockupSetupAnalysis> {
    const t0 = Date.now();
    if (import.meta.env.DEV) console.log('[dev] aiApi.analyzeSetup: fetch start');
    const response = await fetch(`${API_BASE_URL}/ai/analyze-setup`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ baseImage, instructions, userContext }),
    });
    if (import.meta.env.DEV) console.log('[dev] aiApi.analyzeSetup: fetch end', ((Date.now() - t0) / 1000).toFixed(2) + 's', 'ok=', response.ok, 'status=', response.status);

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const msg = body?.error || (response.status === 500 ? 'Internal server error' : 'Failed to analyze setup');
      const e = new Error(msg) as Error & { status?: number };
      e.status = response.status;
      throw e;
    }

    const data = await response.json();
    if (import.meta.env.DEV) console.log('[dev] aiApi.analyzeSetup: parse done', ((Date.now() - t0) / 1000).toFixed(2) + 's');
    return data;
  },

  /**
   * Generate a smart prompt based on user selections
   */
  async generateSmartPrompt(params: {
    baseImage: UploadedImage | null;
    designType: string;
    brandingTags: string[];
    categoryTags: string[];
    locationTags: string[];
    angleTags: string[];
    lightingTags: string[];
    effectTags: string[];
    selectedColors: string[];
    aspectRatio: string;
    generateText: boolean;
    withHuman: boolean;
    enhanceTexture: boolean;
    removeText: boolean;
    negativePrompt: string;
    additionalPrompt: string;
    instructions: string;
  }): Promise<{ prompt: string; inputTokens?: number; outputTokens?: number }> {
    const response = await fetch(`${API_BASE_URL}/ai/generate-smart-prompt`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to generate smart prompt' }));
      throw new Error(error.error || 'Failed to generate smart prompt');
    }

    return response.json();
  },

  /**
   * Generate variations of a prompt
   */
  async suggestPromptVariations(prompt: string): Promise<string[]> {
    const response = await fetch(`${API_BASE_URL}/ai/suggest-prompt-variations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to suggest variations' }));
      throw new Error(error.error || 'Failed to suggest variations');
    }

    const data = await response.json();
    return data.variations;
  },

  /**
   * Change an object in a mockup image
   */
  async changeObjectInMockup(
    baseImage: UploadedImage,
    newObject: string,
    model?: string,
    resolution?: string
  ): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/ai/change-object`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ baseImage, newObject, model, resolution }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to change object' }));
      throw new Error(error.error || 'Failed to change object');
    }

    const data = await response.json();
    return data.imageBase64;
  },

  /**
   * Apply a theme to a mockup image
   */
  async applyThemeToMockup(
    baseImage: UploadedImage,
    themes: string[],
    model?: string,
    resolution?: string
  ): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/ai/apply-theme`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ baseImage, themes, model, resolution }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to apply theme' }));
      throw new Error(error.error || 'Failed to apply theme');
    }

    const data = await response.json();
    return data.imageBase64;
  },
};


