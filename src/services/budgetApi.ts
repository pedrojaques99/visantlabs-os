import { authService } from './authService';
import type { BudgetData, CustomPdfPreset } from '../types/types';

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

export interface BudgetProject {
  _id: string;
  userId: string;
  template: string;
  name?: string | null;
  clientName: string;
  projectDescription: string;
  startDate: string;
  endDate: string;
  deliverables: any;
  observations?: string | null;
  links: any;
  faq: any;
  brandColors: string[];
  brandName: string;
  brandLogo?: string | null;
  brandBackgroundColor?: string | null;
  brandAccentColor?: string | null;
  timeline?: any;
  paymentInfo?: any;
  signatures?: any;
  giftOptions?: any;
  customContent?: any;
  finalCTAText?: string | null;
  year?: string | null;
  shareId?: string | null;
  data?: any;
  createdAt: string;
  updatedAt: string;
}

export const budgetApi = {
  async getAll(): Promise<BudgetProject[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/budget`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `Failed to fetch budgets: ${response.status} ${response.statusText}`;

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
      return Array.isArray(data.budgets) ? data.budgets : [];
    } catch (error: any) {
      if (error?.message?.includes('Failed to fetch') ||
        error?.message?.includes('NetworkError') ||
        error?.name === 'TypeError') {
        console.error('Network error fetching budgets:', error);
        return [];
      }
      throw error;
    }
  },

  async getById(id: string): Promise<BudgetProject> {
    if (!id || id.trim() === '' || id === 'undefined') {
      throw new Error('Invalid budget ID');
    }

    const response = await fetch(`${API_BASE_URL}/budget/${id}`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to fetch budget';

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
    return data.budget;
  },

  async save(data: BudgetData, projectId?: string, name?: string): Promise<BudgetProject> {
    const url = projectId
      ? `${API_BASE_URL}/budget/${projectId}`
      : `${API_BASE_URL}/budget`;

    const method = projectId ? 'PUT' : 'POST';

    // Convert BudgetData to the format expected by the backend
    const payload = {
      template: data.template,
      name: name || undefined,
      clientName: data.clientName,
      projectName: data.projectName,
      projectDescription: data.projectDescription,
      startDate: data.startDate,
      endDate: data.endDate,
      deliverables: data.deliverables,
      observations: data.observations || '',
      links: data.links,
      faq: data.faq,
      brandColors: data.brandColors,
      brandName: data.brandName,
      brandLogo: data.brandLogo,
      brandBackgroundColor: data.brandBackgroundColor,
      brandAccentColor: data.brandAccentColor,
      timeline: data.timeline,
      paymentInfo: data.paymentInfo,
      signatures: data.signatures,
      giftOptions: data.giftOptions,
      customContent: data.customContent,
      finalCTAText: data.finalCTAText,
      year: data.year,
      serviceTitle: data.serviceTitle,
      coverBackgroundColor: data.coverBackgroundColor,
      coverTextColor: data.coverTextColor,
      customPdfUrl: data.customPdfUrl,
      pdfFieldMappings: data.pdfFieldMappings,
      data: data, // Keep full data for backup
    };

    const response = await fetch(url, {
      method,
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to ${projectId ? 'update' : 'create'} budget`;

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
    return result.budget;
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/budget/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to delete budget';

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

  async share(id: string): Promise<{ shareId: string; shareUrl: string }> {
    const response = await fetch(`${API_BASE_URL}/budget/${id}/share`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to generate share link';

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

    return await response.json();
  },

  async duplicate(id: string): Promise<BudgetProject> {
    const response = await fetch(`${API_BASE_URL}/budget/${id}/duplicate`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to duplicate budget';

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
    return data.budget;
  },

  async getShared(shareId: string): Promise<BudgetProject> {
    const response = await fetch(`${API_BASE_URL}/budget/shared/${shareId}`);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to fetch shared budget';

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
    return data.budget;
  },

  async uploadLogo(budgetId: string, imageBase64: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/budget/${budgetId}/logo`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ imageBase64 }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to upload logo';

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
    return result.imageUrl;
  },

  async uploadGiftImage(budgetId: string, imageBase64: string, giftIndex: number): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/budget/${budgetId}/gift-image`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ imageBase64, giftIndex }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to upload gift image';

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
    return result.imageUrl;
  },

  async uploadPdf(budgetId: string, pdfBase64: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/budget/${budgetId}/pdf`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pdfBase64 }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to upload PDF';

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
    return result.pdfUrl;
  },

  async createPdfPreset(pdfBase64: string, name: string): Promise<CustomPdfPreset> {
    const response = await fetch(`${API_BASE_URL}/budget/pdf-presets`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ pdfBase64, name }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to create PDF preset';

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
    return result.preset;
  },

  async getPdfPresets(): Promise<CustomPdfPreset[]> {
    const response = await fetch(`${API_BASE_URL}/budget/pdf-presets`, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to fetch PDF presets';

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
    return result.presets || [];
  },

  async deletePdfPreset(presetId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/budget/pdf-presets/${presetId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to delete PDF preset';

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

