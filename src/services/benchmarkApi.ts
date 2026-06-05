import { authService } from './authService';

const getApiBaseUrl = () => {
  const viteApiUrl = (import.meta as any).env?.VITE_API_URL;
  return viteApiUrl || '/api';
};

const API_BASE_URL = getApiBaseUrl();

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
};

export type BenchmarkTier = 'flagship' | 'balanced' | 'fast' | 'legacy';

export interface BenchmarkModel {
  id: string;
  provider: string;
  label: string;
  description: string;
  tier: BenchmarkTier;
  released: string;
  strengths: string[];
  supportsLogoRef: boolean;
  available: boolean;
  creditsCost1K: number;
}

export interface BenchmarkResult {
  model: string;
  provider: string;
  imageUrl?: string;
  durationMs?: number;
  error?: string;
  creditsCost: number;
  votes: number;
}

export interface BenchmarkItem {
  id: string;
  prompt: string;
  models: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  results: BenchmarkResult[];
  resolution?: string;
  aspectRatio?: string;
  winnerModel?: string;
  voted: boolean;
  viewCount: number;
  totalCreditsCharged: number;
  creditsRefunded: number;
  createdAt: string;
  completedAt?: string;
  user?: { name: string; picture?: string; username?: string };
}

export interface GalleryItem {
  id: string;
  prompt: string;
  models: string[];
  winnerModel?: string;
  voted: boolean;
  viewCount: number;
  thumbnails: { model: string; imageUrl: string }[];
  createdAt: string;
  user?: { name: string; picture?: string; username?: string };
}

export interface SSEResultEvent {
  model: string;
  label: string;
  provider: string;
  imageUrl?: string;
  durationMs?: number;
  error?: string;
  creditsCost: number;
  generationSucceeded?: boolean;
  completedCount: number;
  totalModels: number;
}

export interface SSEStartEvent {
  benchmarkId: string;
  models: string[];
  totalCreditsCharged: number;
  totalModels: number;
}

export interface SSECompleteEvent {
  benchmarkId: string;
  totalModels: number;
  successCount: number;
  failedCount: number;
  creditsRefunded: number;
}

export const benchmarkApi = {
  async getAvailableModels(): Promise<{
    models: BenchmarkModel[];
    tiers: Record<BenchmarkTier, string>;
    maxPerBenchmark: number;
  }> {
    const res = await fetch(`${API_BASE_URL}/benchmark/models`);
    if (!res.ok) throw new Error('Failed to fetch models');
    return res.json();
  },

  runStream(
    params: {
      prompt: string;
      models: string[];
      resolution?: string;
      aspectRatio?: string;
      brandGuidelineId?: string;
      isPublic?: boolean;
    },
    callbacks: {
      onStart?: (data: SSEStartEvent) => void;
      onGenerating?: (data: { model: string; label: string; provider: string }) => void;
      onResult?: (data: SSEResultEvent) => void;
      onError?: (data: {
        model: string;
        label: string;
        provider: string;
        error: string;
        durationMs?: number;
        creditsCost?: number;
        completedCount: number;
        totalModels: number;
      }) => void;
      onComplete?: (data: SSECompleteEvent) => void;
      onFail?: (error: string) => void;
    }
  ): AbortController {
    const controller = new AbortController();

    fetch(`${API_BASE_URL}/benchmark/run`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(params),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: 'Request failed' }));
          callbacks.onFail?.(err.error || `HTTP ${res.status}`);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          callbacks.onFail?.('No stream');
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ') && currentEvent) {
              try {
                const data = JSON.parse(line.slice(6));
                switch (currentEvent) {
                  case 'start':
                    callbacks.onStart?.(data);
                    break;
                  case 'generating':
                    callbacks.onGenerating?.(data);
                    break;
                  case 'result':
                    callbacks.onResult?.(data);
                    break;
                  case 'error':
                    callbacks.onError?.(data);
                    break;
                  case 'complete':
                    callbacks.onComplete?.(data);
                    break;
                }
              } catch {
                /* skip malformed */
              }
              currentEvent = '';
            }
          }
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          callbacks.onFail?.(err.message || 'Stream failed');
        }
      });

    return controller;
  },

  async get(id: string): Promise<BenchmarkItem> {
    const res = await fetch(`${API_BASE_URL}/benchmark/${id}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Benchmark not found');
    return res.json();
  },

  async vote(
    id: string,
    winnerModel: string
  ): Promise<{ success: boolean; creditsRefunded: number; message: string }> {
    const res = await fetch(`${API_BASE_URL}/benchmark/${id}/vote`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ winnerModel }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Vote failed' }));
      throw new Error(err.error || 'Failed to vote');
    }
    return res.json();
  },

  async gallery(
    page = 1,
    limit = 12
  ): Promise<{ items: GalleryItem[]; total: number; page: number; totalPages: number }> {
    const res = await fetch(`${API_BASE_URL}/benchmark?page=${page}&limit=${limit}`);
    if (!res.ok) throw new Error('Failed to fetch gallery');
    return res.json();
  },
};
