/**
 * feedbackApi — cliente unificado pra feedback de geração (👍/👎).
 *
 * Use esse de QUALQUER feature do app que gera conteúdo IA: mockup, canvas,
 * creative, brand-intelligence, node-builder, chat, image-gen.
 *
 * No backend, thumbs up alimentam o RAG (Pinecone) que o `generateSmartPrompt`
 * consulta pra melhorar gerações futuras do mesmo user/brand.
 */

import { authService } from './authService';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || '/api';

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export type FeedbackRating = 'up' | 'down';

export type FeedbackFeature =
  | 'mockup'
  | 'branding'
  | 'canvas'
  | 'creative'
  | 'brand-intelligence'
  | 'node-builder'
  | 'chat'
  | 'admin-chat'
  | 'image-gen';

export interface FeedbackContext {
  prompt?: string;
  userInput?: string;
  imageUrl?: string;
  tags?: {
    branding?: string[];
    category?: string[];
    location?: string[];
    angle?: string[];
    lighting?: string[];
    effect?: string[];
    material?: string[];
  };
  brandGuidelineId?: string;
  brandBrief?: string;
  vibeId?: string;
  designType?: string;
  aspectRatio?: string;
  model?: string;
  rationale?: string[];
  extra?: Record<string, unknown>;
}

export interface SubmitFeedbackParams {
  /** UUID que veio no response da geração (ex: generateSmartPrompt). */
  generationId: string;
  feature: FeedbackFeature;
  rating: FeedbackRating;
  reason?: string;
  context: FeedbackContext;
}

export const feedbackApi = {
  /**
   * Envia feedback 👍/👎 pro backend.
   * Never throws — degrada silenciosamente em caso de erro de rede.
   */
  async submit(params: SubmitFeedbackParams): Promise<{ success: boolean; vectorized?: boolean }> {
    try {
      const res = await fetch(`${API_BASE_URL}/feedback/generation`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(params),
      });
      if (!res.ok) {
        console.warn('[feedbackApi] submit failed:', res.status);
        return { success: false };
      }
      return res.json();
    } catch (err) {
      console.warn('[feedbackApi] submit threw:', err);
      return { success: false };
    }
  },

  /**
   * Remove feedback (undo do thumb).
   */
  async remove(generationId: string): Promise<{ success: boolean }> {
    try {
      const res = await fetch(`${API_BASE_URL}/feedback/generation/${encodeURIComponent(generationId)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) return { success: false };
      return res.json();
    } catch {
      return { success: false };
    }
  },

  /**
   * Lista feedbacks recentes do user (debug/admin/history).
   */
  async listRecent(feature?: FeedbackFeature, limit = 20) {
    const params = new URLSearchParams();
    if (feature) params.set('feature', feature);
    params.set('limit', String(limit));
    const res = await fetch(`${API_BASE_URL}/feedback/generation/recent?${params}`, {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) return { items: [] };
    return res.json();
  },
};
