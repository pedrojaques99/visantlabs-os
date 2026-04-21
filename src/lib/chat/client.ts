import { authService } from '@/services/authService';

const getApiBaseUrl = (): string => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  return viteApiUrl || '/api';
};

const API_BASE_URL = getApiBaseUrl();

const buildAuthHeaders = (): Record<string, string> => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface ChatRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  errorMessage?: string;
  /** When true, resolves to `undefined` instead of parsing JSON (for 204/no-content ops). */
  expectNoContent?: boolean;
}

/**
 * Unified fetch wrapper for chat surfaces. Applies the same auth header,
 * JSON envelope, and error-shaping that `chatApi.ts` and `adminChatApi.ts`
 * were duplicating in every method.
 *
 * Throws `Error(error.error ?? fallback)` on non-2xx responses.
 */
export async function chatApiRequest<T>(path: string, options: ChatRequestOptions = {}): Promise<T> {
  const { method = 'GET', body, errorMessage = 'Chat API request failed', expectNoContent } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: buildAuthHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    let errPayload: any = null;
    try {
      errPayload = await response.json();
    } catch {
      // non-JSON error body — fall through
    }
    throw new Error(errPayload?.error || errorMessage);
  }

  if (expectNoContent) return undefined as unknown as T;
  return (await response.json()) as T;
}
