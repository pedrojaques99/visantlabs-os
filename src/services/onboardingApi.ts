import { authService } from './authService';
import { trackEvent } from '../utils/analytics';
import type { BrandGuideline } from '../lib/figma-types';

/**
 * API do onboarding brand-first (plano Revenue-Centric Realignment, Fase 3).
 * Contrato assumido (backend em implementação paralela):
 * - POST /brand-guidelines/demo        → clona marca-exemplo isDemo (não conta quota)
 * - GET  /users/onboarding-progress    → { hasRealBrand, hasOnBrandGeneration, hasConnectedAgent }
 * - POST /analytics/events             → { events: [{ event: 'onboarding_step', meta: { step, persona, skipped } }] }
 */

const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  if (viteApiUrl) return viteApiUrl;
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

/** Progresso real do usuário — deriva o checklist v2 (substitui o localStorage puro). */
export interface OnboardingProgress {
  hasRealBrand: boolean;
  hasOnBrandGeneration: boolean;
  hasConnectedAgent: boolean;
}

export const onboardingApi = {
  /** Clona a marca-exemplo (isDemo) pro user — caminho "explorar antes"/skip do wizard. */
  async createDemoBrand(): Promise<BrandGuideline> {
    const response = await fetch(`${API_BASE_URL}/brand-guidelines/demo`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.message || body?.error || 'Failed to create demo brand');
    }
    const data = await response.json();
    return data.guideline ?? data;
  },

  /**
   * Progresso do onboarding. `null` em QUALQUER falha (404 = backend com flag off,
   * rede, shape inesperado) — o caller cai graciosamente no comportamento antigo.
   */
  async getProgress(): Promise<OnboardingProgress | null> {
    try {
      const response = await fetch(`${API_BASE_URL}/users/onboarding-progress`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      const data = await response.json();
      if (typeof data?.hasRealBrand !== 'boolean') return null;
      return {
        hasRealBrand: !!data.hasRealBrand,
        hasOnBrandGeneration: !!data.hasOnBrandGeneration,
        hasConnectedAgent: !!data.hasConnectedAgent,
      };
    } catch {
      return null;
    }
  },

  /** Evento de funil `onboarding_step` — fire-and-forget, NUNCA bloqueia a UX. */
  trackStep(step: string, persona?: string | null, skipped = false): void {
    try {
      void fetch(`${API_BASE_URL}/analytics/events`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          events: [
            {
              event: 'onboarding_step',
              meta: { step, persona: persona ?? undefined, skipped },
            },
          ],
        }),
      }).catch(() => {});
    } catch {
      /* fire-and-forget */
    }
    trackEvent('onboarding_step', { step, persona: persona ?? undefined, skipped });
  },
};
