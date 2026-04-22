/**
 * Brand Guideline Version API Client
 *
 * Manages version history for brand guidelines.
 */

import { authService } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface VersionListItem {
  versionNumber: number;
  changeNote: string | null;
  changedFields: string[];
  createdAt: string;
  createdBy: string | null;
  isCurrent: boolean;
}

export interface VersionDetail {
  versionNumber: number;
  snapshot: Record<string, unknown>;
  changeNote: string | null;
  changedFields: string[];
  createdAt: string;
  createdBy: string | null;
}

export interface VersionDiff {
  from: { versionNumber: number; createdAt: string };
  to: { versionNumber: number; createdAt: string };
  diff: Record<string, { added?: unknown[]; removed?: unknown[]; changed?: unknown }>;
}

export interface VersionListResponse {
  versions: VersionListItem[];
  total: number;
  currentVersion: number;
}

export interface RestoreResponse {
  guideline: Record<string, unknown>;
  restoredFrom: number;
  newVersion: number;
  message: string;
}

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export const brandGuidelineVersionApi = {
  /**
   * List version history for a guideline
   */
  async list(guidelineId: string, options?: { limit?: number; offset?: number }): Promise<VersionListResponse> {
    const params = new URLSearchParams();
    if (options?.limit) params.set('limit', options.limit.toString());
    if (options?.offset) params.set('offset', options.offset.toString());

    const url = `${API_BASE_URL}/brand-guidelines/${guidelineId}/versions${params.toString() ? '?' + params : ''}`;

    const response = await fetch(url, {
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to list versions');
    }

    return response.json();
  },

  /**
   * Get a specific version's snapshot
   */
  async get(guidelineId: string, versionNumber: number): Promise<{ version: VersionDetail }> {
    const response = await fetch(
      `${API_BASE_URL}/brand-guidelines/${guidelineId}/versions/${versionNumber}`,
      {
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to get version');
    }

    return response.json();
  },

  /**
   * Compare two versions
   */
  async compare(guidelineId: string, v1: number, v2: number): Promise<VersionDiff> {
    const response = await fetch(
      `${API_BASE_URL}/brand-guidelines/${guidelineId}/versions/${v1}/compare/${v2}`,
      {
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to compare versions');
    }

    return response.json();
  },

  /**
   * Restore a guideline to a previous version
   */
  async restore(guidelineId: string, versionNumber: number): Promise<RestoreResponse> {
    const response = await fetch(
      `${API_BASE_URL}/brand-guidelines/${guidelineId}/versions/${versionNumber}/restore`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to restore version');
    }

    return response.json();
  },
};
