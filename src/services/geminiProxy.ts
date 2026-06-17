import { API_BASE } from '@/config/api';
import { authService } from './authService';

/**
 * Client-side proxy for Gemini text generation.
 *
 * The browser builds the request (contents + optional structured-output config)
 * and POSTs it to the backend (`/api/chat/canvas-generate`); the server holds the
 * API key and makes the actual Gemini call. This keeps the browser off
 * generativelanguage.googleapis.com — which the page CSP blocks — and keeps the
 * API key out of the client bundle. BYOK is resolved server-side.
 *
 * Use this instead of calling `@google/genai` directly from any browser code.
 */

export interface ProxyGenerateParams {
  /** Gemini `contents` — either an array of turns or a single `{ parts }` object. */
  contents: unknown;
  /** Optional Gemini `config` (e.g. responseMimeType + responseSchema for JSON). */
  config?: Record<string, unknown>;
  /** Running user-message count; when provided, the server meters credits (chat). */
  userMessageCount?: number;
}

export interface ProxyUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  [key: string]: unknown;
}

export interface ProxyGenerateResult {
  /** Raw model text (callers trim / JSON.parse as needed). */
  text: string;
  usageMetadata?: ProxyUsageMetadata;
}

export async function generateTextViaProxy(
  params: ProxyGenerateParams
): Promise<ProxyGenerateResult> {
  const token = authService.getToken();

  const res = await fetch(`${API_BASE}/chat/canvas-generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
    };
    if (errBody.error === 'insufficient_credits') {
      throw new Error('Créditos insuficientes para esta ação. Adicione créditos para continuar.');
    }
    throw new Error(errBody.message || errBody.error || `AI request failed (${res.status})`);
  }

  const data = (await res.json()) as ProxyGenerateResult;
  return { text: data.text ?? '', usageMetadata: data.usageMetadata };
}
