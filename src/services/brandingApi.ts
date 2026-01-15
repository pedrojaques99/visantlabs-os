import { authService } from './authService';
import type { BrandingData, BrandingProject } from '../types/branding';

// Get API URL from environment or use current origin for production
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


export const brandingApi = {
  async getAll(): Promise<BrandingProject[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/branding`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to fetch branding projects: ${response.status} ${response.statusText}`;

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
      return Array.isArray(data.projects) ? data.projects : [];
    } catch (error: any) {
      if (error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('NetworkError') ||
        error?.name === 'TypeError') {
        console.error('Network error fetching branding projects:', error);
        return [];
      }
      throw error;
    }
  },

  async getById(id: string): Promise<BrandingProject> {
    if (!id || id.trim() === '' || id === 'undefined') {
      throw new Error('Invalid project ID');
    }

    const response = await fetch(`${API_BASE_URL}/branding/${id}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to fetch branding project';

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
    return data.project;
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/branding/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to delete branding project';

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
  },

  async save(data: BrandingData, projectId?: string, name?: string): Promise<BrandingProject> {
    const response = await fetch(`${API_BASE_URL}/branding/save`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        prompt: data.prompt,
        data,
        projectId,
        name,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to save branding project';

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

    const result = await response.json();
    return result.project;
  },

  async saveBrandingFeedback(params: {
    prompt: string;
    step: number;
    output: any;
    rating?: number;
  }): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/feedback/branding`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        prompt: params.prompt,
        step: params.step,
        output: params.output,
        rating: params.rating || 1,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to save feedback';

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
  },
};

