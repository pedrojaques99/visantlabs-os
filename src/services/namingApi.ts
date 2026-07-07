import { authService } from './authService';
import { API_BASE } from '@/config/api';
import type { NamingCard } from '@/lib/naming/tasteProfile';

/* ── Shared request helper (padrão contentStudioApi) ─────────────────────── */

function headers() {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const error = new Error(err.error || `Request failed: ${res.status}`) as Error & {
      status?: number;
    };
    error.status = res.status;
    throw error;
  }

  return res.json();
}

/* ── generate-naming (custa 1 crédito) ───────────────────────────────────── */

export interface GenerateNamingParams {
  brief: string;
  count?: number; // <= 20
  style?: string;
  brandGuidelineId?: string;
  seen?: string[];
  liked?: string[];
  superliked?: string[];
  rejected?: string[];
  tasteReading?: string;
  territories?: string[];
}

export interface GenerateNamingResponse {
  names: NamingCard[];
}

export function generateNaming(params: GenerateNamingParams): Promise<GenerateNamingResponse> {
  return post<GenerateNamingResponse>('/ai/generate-naming', params);
}

/* ── naming-briefing (grátis) ────────────────────────────────────────────── */

export type BriefingQuestionKind = 'chips' | 'binary' | 'cards' | 'text' | 'toggle';

export interface BriefingQuestion {
  id: string;
  kind: BriefingQuestionKind;
  prompt: string;
  options?: string[];
}

export interface BriefingAnswer {
  id: string;
  value: string;
}

export interface NamingBriefingParams {
  concept: string;
  answers?: BriefingAnswer[];
  brief?: Record<string, unknown> | null;
  imageUrl?: string;
}

export interface NamingBriefingResponse {
  brief: Record<string, unknown>;
  nextQuestion: BriefingQuestion | null;
  done: boolean;
  briefText: string;
}

export function namingBriefing(params: NamingBriefingParams): Promise<NamingBriefingResponse> {
  return post<NamingBriefingResponse>('/ai/naming-briefing', params);
}

/* ── naming-insight (grátis) ─────────────────────────────────────────────── */

export interface NamingPatternInsightParams {
  mode: 'pattern';
  liked: NamingCard[];
  superliked: NamingCard[];
  rejected: NamingCard[];
  stats?: Record<string, unknown>;
}

export interface NamingPatternInsightResponse {
  reading: string;
}

export interface NamingDefenseInsightParams {
  mode: 'defense';
  name: string;
  briefText: string;
}

export interface NamingDefenseInsightResponse {
  concept: string;
  layers: string[];
  risks: string[];
}

export function namingPatternInsight(
  params: NamingPatternInsightParams
): Promise<NamingPatternInsightResponse> {
  return post<NamingPatternInsightResponse>('/ai/naming-insight', params);
}

export function namingDefenseInsight(
  params: NamingDefenseInsightParams
): Promise<NamingDefenseInsightResponse> {
  return post<NamingDefenseInsightResponse>('/ai/naming-insight', params);
}

/* ── image upload (referência visual opcional) ───────────────────────────── */

export async function uploadNamingImage(
  base64: string,
  contentType = 'image/png'
): Promise<string> {
  const res = await post<{ url: string }>('/images/upload', {
    data: base64,
    contentType,
    label: 'naming-reference',
  });
  return res.url;
}
