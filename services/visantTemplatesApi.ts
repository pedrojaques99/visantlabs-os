import type { VisantTemplate, VisantLayout } from '../types/visant';

const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  if (viteApiUrl) {
    return viteApiUrl;
  }
  return '/api';
};

const API_BASE_URL = getApiBaseUrl();

const getAuthHeaders = () => {
  const token = localStorage.getItem('admin-password');
  return {
    'Content-Type': 'application/json',
    ...(token && { 'X-Admin-Password': token }),
  };
};

export const visantTemplatesApi = {
  async getAll(): Promise<VisantTemplate[]> {
    const response = await fetch(`${API_BASE_URL}/visant-templates`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to fetch templates';

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.templates || [];
  },

  async getActive(): Promise<VisantTemplate | null> {
    const response = await fetch(`${API_BASE_URL}/visant-templates/active`);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch active template');
    }

    const data = await response.json();
    return data.template || null;
  },

  async create(template: Omit<VisantTemplate, '_id' | 'id' | 'createdAt' | 'updatedAt'>): Promise<VisantTemplate> {
    const response = await fetch(`${API_BASE_URL}/visant-templates`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(template),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to create template';

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.template;
  },

  async update(id: string, updates: Partial<VisantTemplate>): Promise<VisantTemplate> {
    const response = await fetch(`${API_BASE_URL}/visant-templates/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to update template';

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.template;
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/visant-templates/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to delete template';

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }

      throw new Error(errorMessage);
    }
  },

  async activate(id: string): Promise<VisantTemplate> {
    const response = await fetch(`${API_BASE_URL}/visant-templates/${id}/activate`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to activate template';

      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error || errorData.message || errorMessage;
      } catch {
        if (errorText) {
          errorMessage = errorText;
        }
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.template;
  },
};












