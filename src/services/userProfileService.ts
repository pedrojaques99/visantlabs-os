import { authService } from './authService';

// Get API URL from environment or use current origin for production
const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl;
  }
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

export interface UserProfile {
  id: string;
  name: string | null;
  picture: string | null;
  username: string | null;
  bio: string | null;
  coverImageUrl: string | null;
  instagram: string | null;
  youtube: string | null;
  x: string | null;
  website: string | null;
  createdAt: string;
  stats: {
    mockups: number;
    presets: number;
  };
}

export interface UpdateProfileData {
  username?: string;
  bio?: string;
  instagram?: string;
  youtube?: string;
  x?: string;
  website?: string;
  coverImageBase64?: string;
}

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export const userProfileService = {
  /**
   * Get user profile by username or ID
   */
  async getUserProfile(identifier: string): Promise<UserProfile> {
    const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(identifier)}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to fetch user profile: ${response.status} ${response.statusText}`;

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

    return response.json();
  },

  /**
   * Get user's public mockups
   */
  async getUserMockups(identifier: string) {
    const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(identifier)}/mockups`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to fetch user mockups: ${response.status} ${response.statusText}`;

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
    return Array.isArray(data) ? data : [];
  },

  /**
   * Get user's public presets
   */
  async getUserPresets(identifier: string) {
    const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(identifier)}/presets`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to fetch user presets: ${response.status} ${response.statusText}`;

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

    return response.json();
  },

  /**
   * Get user's public workflows
   */
  async getUserWorkflows(identifier: string) {
    const response = await fetch(`${API_BASE_URL}/users/${encodeURIComponent(identifier)}/workflows`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(), // Include auth headers for liking status
      },
    });

    if (!response.ok) {
      // Similar error handling as other methods
      const errorText = await response.text();
      let errorMessage = `Failed to fetch user workflows: ${response.status} ${response.statusText}`;

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

    return response.json();
  },

  /**
   * Update own profile
   */
  async updateProfile(data: UpdateProfileData) {
    const response = await fetch(`${API_BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to update profile: ${response.status} ${response.statusText}`;
      let errorDetails: string | undefined;

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
        errorDetails = errorData.details;
      } catch {
        if (errorText) {
          errorMessage = errorText || errorMessage;
        }
      }

      const error = new Error(errorMessage);
      (error as any).status = response.status;
      (error as any).details = errorDetails;
      throw error;
    }

    return response.json();
  },
};

