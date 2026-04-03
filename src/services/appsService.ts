import { authService } from './authService';

export interface AppConfig {
  id: string;
  appId: string;
  name: string;
  description: string;
  link: string;
  thumbnail?: string;
  badge?: string;
  badgeVariant: 'featured' | 'premium' | 'free' | 'comingSoon' | 'admin';
  category: string;
  isExternal: boolean;
  free: boolean;
  span?: string;
  databaseInfo?: string;
  displayOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl;
  }
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

const getAuthHeaders = async () => {
  const token = await authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
  };
};

export const appsService = {
  async getAll(): Promise<AppConfig[]> {
    const response = await fetch(`${API_BASE_URL}/apps`);
    if (!response.ok) throw new Error('Failed to fetch apps');
    const data = await response.json();
    return data.apps || [];
  },

  async seed(apps: any[]): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/apps/seed`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ apps }),
    });
    if (!response.ok) throw new Error('Failed to seed apps');
  },

  async create(app: Partial<AppConfig>): Promise<AppConfig> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/apps`, {
      method: 'POST',
      headers,
      body: JSON.stringify(app),
    });
    if (!response.ok) throw new Error('Failed to create app');
    const data = await response.json();
    return data.app;
  },

  async update(id: string, updates: Partial<AppConfig>): Promise<AppConfig> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/apps/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });
    if (!response.ok) throw new Error('Failed to update app');
    const data = await response.json();
    return data.app;
  },

  async delete(id: string): Promise<void> {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE_URL}/apps/${id}`, {
      method: 'DELETE',
      headers,
    });
    if (!response.ok) throw new Error('Failed to delete app');
  },
};
