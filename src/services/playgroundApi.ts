import { authService } from './authService';

const API_BASE = '/api/playground';

function getHeaders() {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export interface MiniAppSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  category: string;
  thumbnail?: string;
  likesCount: number;
  forksCount: number;
  viewsCount: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt?: string;
  author?: { name: string | null; picture: string | null; username: string | null } | null;
}

export interface MiniAppFull extends MiniAppSummary {
  spec: Record<string, unknown>;
  stateDefaults?: Record<string, unknown>;
  files?: Record<string, string>;
  dependencies?: Record<string, string>;
  isEjected: boolean;
  actionsUsed: string[];
  forkedFromId?: string;
  shareId?: string;
  userId: string;
}

export type GenerateEvent =
  | { event: 'status'; data: { message: string } }
  | { event: 'spec'; data: { spec: Record<string, unknown>; meta: Record<string, unknown> } }
  | { event: 'clarification'; data: { questions: string[]; suggestion: string } }
  | { event: 'complete'; data: { message: string } }
  | { event: 'error'; data: { message: string } };

export async function generateMiniApp(
  prompt: string,
  opts?: { brandContext?: string; model?: string; images?: string[] },
  onEvent?: (event: GenerateEvent) => void
): Promise<{ spec: Record<string, unknown>; meta: Record<string, unknown> } | null> {
  const res = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ prompt, ...opts }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Generation failed' }));
    throw new Error(err.error || 'Generation failed');
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  let buffer = '';
  let result: { spec: Record<string, unknown>; meta: Record<string, unknown> } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let eventName = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventName = line.slice(7).trim();
      } else if (line.startsWith('data: ') && eventName) {
        try {
          const data = JSON.parse(line.slice(6));
          const event = { event: eventName, data } as GenerateEvent;
          onEvent?.(event);

          if (eventName === 'spec') {
            result = { spec: data.spec, meta: data.meta };
          }
          if (eventName === 'error') {
            throw new Error(data.message);
          }
        } catch (e) {
          if (e instanceof Error && e.message !== 'Generation failed') throw e;
        }
        eventName = '';
      }
    }
  }

  return result;
}

export async function iterateMiniApp(
  prompt: string,
  currentSpec: Record<string, unknown>,
  opts?: { brandContext?: string; model?: string; images?: string[] },
  onEvent?: (event: GenerateEvent) => void
) {
  const res = await fetch(`${API_BASE}/iterate`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ prompt, currentSpec, ...opts }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Iteration failed' }));
    throw new Error(err.error || 'Iteration failed');
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response stream');

  const decoder = new TextDecoder();
  let buffer = '';
  let result: { spec: Record<string, unknown>; meta: Record<string, unknown> } | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    let eventName = '';
    for (const line of lines) {
      if (line.startsWith('event: ')) {
        eventName = line.slice(7).trim();
      } else if (line.startsWith('data: ') && eventName) {
        try {
          const data = JSON.parse(line.slice(6));
          onEvent?.({ event: eventName, data } as GenerateEvent);
          if (eventName === 'spec') result = { spec: data.spec, meta: data.meta };
          if (eventName === 'error') throw new Error(data.message);
        } catch (e) {
          if (e instanceof Error && e.message !== 'Iteration failed') throw e;
        }
        eventName = '';
      }
    }
  }

  return result;
}

export async function saveMiniApp(data: {
  title: string;
  description?: string;
  tags?: string[];
  category?: string;
  spec: Record<string, unknown>;
  actionsUsed?: string[];
  thumbnail?: string;
}) {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save');
  return res.json();
}

export async function updateMiniApp(id: string, data: Partial<MiniAppFull>) {
  const res = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update');
  return res.json();
}

export async function deleteMiniApp(id: string) {
  const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE', headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to delete');
  return res.json();
}

export async function getMiniApp(slug: string) {
  const res = await fetch(`${API_BASE}/${slug}`);
  if (!res.ok) throw new Error('Not found');
  return res.json() as Promise<{ miniApp: MiniAppFull }>;
}

export async function getMyMiniApps() {
  const res = await fetch(`${API_BASE}/my`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json() as Promise<{ miniApps: MiniAppSummary[] }>;
}

export async function getFeed(params?: {
  category?: string;
  sort?: string;
  search?: string;
  skip?: number;
  take?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.category) qs.set('category', params.category);
  if (params?.sort) qs.set('sort', params.sort);
  if (params?.search) qs.set('search', params.search);
  if (params?.skip) qs.set('skip', String(params.skip));
  if (params?.take) qs.set('take', String(params.take));
  const res = await fetch(`${API_BASE}/feed?${qs}`);
  if (!res.ok) throw new Error('Failed to fetch feed');
  return res.json() as Promise<{ miniApps: MiniAppSummary[]; total: number }>;
}

export async function publishMiniApp(id: string) {
  const res = await fetch(`${API_BASE}/${id}/publish`, { method: 'POST', headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to publish');
  return res.json();
}

export async function forkMiniApp(id: string) {
  const res = await fetch(`${API_BASE}/${id}/fork`, { method: 'POST', headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fork');
  return res.json();
}

export async function likeMiniApp(id: string) {
  const res = await fetch(`${API_BASE}/${id}/like`, { method: 'POST', headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to toggle like');
  return res.json() as Promise<{ liked: boolean }>;
}

export async function shareMiniApp(id: string) {
  const res = await fetch(`${API_BASE}/${id}/share`, { method: 'POST', headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to share');
  return res.json() as Promise<{ shareId: string; shareUrl: string }>;
}

export async function getBrandContext(
  guidelineId: string
): Promise<{ context: string; brandName: string }> {
  const res = await fetch(`${API_BASE}/brand-context/${guidelineId}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch brand context');
  return res.json();
}
