import { authService } from './authService';
import { API_BASE } from '@/config/api';
import type { NamingSession } from '@/lib/naming/tasteProfile';

/**
 * namingSessionApi — CRUD para sessões da Naming Machine persistidas no backend
 * (per-user, multi-dispositivo). Espelha campaignApi. Substitui o localStorage
 * como fonte da verdade quando o usuário está logado; localStorage vira só
 * cache/fallback anônimo (ver tasteProfile.ts).
 *
 * Mounted server-side em /api/naming-sessions.
 */

function headers() {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/** Linha da lista "sessões anteriores" — sem o blob pesado. */
export interface NamingSessionSummary {
  _id: string;
  id: string;
  name: string;
  brief: string | null;
  phase: 'briefing' | 'deck';
  brandGuidelineId: string | null;
  likedCount: number;
  seenCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Sessão completa — inclui o blob `data` (a NamingSession do frontend). */
export interface NamingSessionRecord extends NamingSessionSummary {
  data: NamingSession;
}

/** Escalares promovidos derivados da sessão, enviados junto do blob. */
export interface NamingSessionScalars {
  name?: string;
  brief?: string | null;
  phase?: 'briefing' | 'deck';
  brandGuidelineId?: string | null;
  likedCount?: number;
  seenCount?: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...headers(), ...(init?.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${path}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export const namingSessionApi = {
  /** Lista as sessões do usuário (mais recente primeiro). */
  list(): Promise<NamingSessionSummary[]> {
    return request<{ sessions: NamingSessionSummary[] }>('/naming-sessions').then(
      (r) => r.sessions
    );
  },
  /** Carrega uma sessão completa (com o blob) para restaurar. */
  get(id: string): Promise<NamingSessionRecord> {
    return request<{ session: NamingSessionRecord }>(`/naming-sessions/${id}`).then(
      (r) => r.session
    );
  },
  /** Cria uma nova sessão; retorna o registro (com id) para os saves seguintes. */
  create(data: NamingSession, scalars: NamingSessionScalars): Promise<NamingSessionRecord> {
    return request<{ session: NamingSessionRecord }>('/naming-sessions', {
      method: 'POST',
      body: JSON.stringify({ data, ...scalars }),
    }).then((r) => r.session);
  },
  /** Autosave (blob + escalares) de uma sessão existente. */
  save(
    id: string,
    data: NamingSession,
    scalars: NamingSessionScalars
  ): Promise<NamingSessionRecord> {
    return request<{ session: NamingSessionRecord }>(`/naming-sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ data, ...scalars }),
    }).then((r) => r.session);
  },
  remove(id: string): Promise<void> {
    return request<{ ok: true }>(`/naming-sessions/${id}`, { method: 'DELETE' }).then(
      () => undefined
    );
  },
};
