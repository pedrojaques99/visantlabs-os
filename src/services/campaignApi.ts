import { authService } from './authService';
import { API_BASE } from '@/config/api';

function headers() {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export interface CampaignResult {
  index: number;
  adAngle: string;
  format: string;
  prompt: string;
  imageUrl?: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
}

export interface CampaignSummary {
  _id: string;
  id: string;
  name: string;
  brandGuidelineId: string | null;
  brief: string;
  productImageUrl: string | null;
  formats: string[];
  model: string | null;
  jobId: string | null;
  status: 'planning' | 'generating' | 'done' | 'error';
  totalCount: number;
  completedCount: number;
  /** First delivered image, derived server-side for grid thumbnails. */
  coverImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign extends CampaignSummary {
  results: CampaignResult[] | null;
  error: string | null;
}

export interface UpdateCampaignInput {
  name?: string;
  brandGuidelineId?: string | null;
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

export const campaignApi = {
  /** List persisted campaigns, optionally scoped to one brand (cockpit view). */
  list(brandId?: string): Promise<CampaignSummary[]> {
    const qs = brandId ? `?brandId=${encodeURIComponent(brandId)}` : '';
    return request<{ campaigns: CampaignSummary[] }>(`/campaigns${qs}`).then((r) => r.campaigns);
  },
  get(id: string): Promise<Campaign> {
    return request<{ campaign: Campaign }>(`/campaigns/${id}`).then((r) => r.campaign);
  },
  update(id: string, input: UpdateCampaignInput): Promise<Campaign> {
    return request<{ campaign: Campaign }>(`/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    }).then((r) => r.campaign);
  },
  remove(id: string): Promise<void> {
    return request<{ ok: true }>(`/campaigns/${id}`, { method: 'DELETE' }).then(() => undefined);
  },
};
