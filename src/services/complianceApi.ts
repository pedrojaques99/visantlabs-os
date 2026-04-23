/**
 * Brand Compliance API Client
 *
 * Checks content compliance against brand guidelines.
 */

import { authService } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export interface ComplianceCheckInput {
  colors?: string[];
  text?: string;
  image?: {
    base64?: string;
    url?: string;
    mimeType?: string;
  };
  checkContrast?: boolean;
  checkColors?: boolean;
  checkTone?: boolean;
}

export interface ComplianceViolation {
  type: 'color-mismatch' | 'contrast' | 'tone' | 'imagery';
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  suggestion?: string;
  affected?: {
    hex?: string;
    contrast?: number;
    expected?: string;
  };
}

export interface ComplianceResult {
  complianceScore: number;
  violations: ComplianceViolation[];
  summary: {
    onBrandColors: number;
    contrastCompliance: 'AAA' | 'AA' | 'FAIL' | 'N/A';
    toneMatch: number;
  };
  aiAnalysis?: {
    isOnBrand: boolean;
    confidence: number;
    notes: string;
  };
}

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export const complianceApi = {
  /**
   * Check content compliance against a brand guideline
   */
  async check(guidelineId: string, input: ComplianceCheckInput): Promise<ComplianceResult> {
    const response = await fetch(
      `${API_BASE_URL}/brand-guidelines/${guidelineId}/compliance-check`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(input),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to check compliance');
    }

    return response.json();
  },

  /**
   * Quick color-only compliance check
   */
  async checkColors(guidelineId: string, colors: string[]): Promise<ComplianceResult> {
    return this.check(guidelineId, {
      colors,
      checkColors: true,
      checkContrast: true,
      checkTone: false,
    });
  },

  /**
   * Quick text tone check
   */
  async checkText(guidelineId: string, text: string): Promise<ComplianceResult> {
    return this.check(guidelineId, {
      text,
      checkTone: true,
      checkColors: false,
      checkContrast: false,
    });
  },
};
