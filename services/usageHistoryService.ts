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

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export type FeatureType = 'brandingmachine' | 'mockupmachine' | 'canvas';

export interface UsageHistoryRecord {
  id: string;
  timestamp: Date | string;
  feature: FeatureType;
  creditsDeducted: number;
  model?: string;
  resolution?: string;
  stepNumber?: number; // Only for branding
  imagesGenerated: number;
  type?: string; // 'branding' or undefined
}

export interface UsageHistoryFilters {
  feature?: FeatureType;
}

export interface UsageHistoryPagination {
  limit?: number;
  offset?: number;
}


export interface UsageStats {
  totalRecords: number;
  totalCredits: number;
  byFeature: {
    mockupmachine: { count: number; credits: number };
    brandingmachine: { count: number; credits: number };
    canvas: { count: number; credits: number };
  };
  last7Days: { count: number; credits: number };
  last30Days: { count: number; credits: number };
  byModel: Record<string, number>;
}

export interface UsageHistoryResponse {
  records: UsageHistoryRecord[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  stats?: UsageStats;
}

export const usageHistoryService = {
  async getUsageHistory(
    filters?: UsageHistoryFilters,
    pagination?: UsageHistoryPagination
  ): Promise<UsageHistoryResponse> {
    const params = new URLSearchParams();

    if (filters?.feature) {
      params.append('feature', filters.feature);
    }

    if (pagination?.limit) {
      params.append('limit', pagination.limit.toString());
    }

    if (pagination?.offset) {
      params.append('offset', pagination.offset.toString());
    }

    const url = `${API_BASE_URL}/usage/history${params.toString() ? `?${params.toString()}` : ''}`;

    const response = await fetch(url, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `Failed to fetch usage history: ${response.status} ${response.statusText}`;

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

    // Convert timestamp strings to Date objects
    const records = data.records.map((record: UsageHistoryRecord) => ({
      ...record,
      timestamp: new Date(record.timestamp),
    }));

    return {
      ...data,
      records,
    };
  },
};
