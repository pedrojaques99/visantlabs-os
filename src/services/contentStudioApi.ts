import { authService } from './authService';
import { API_BASE } from '@/config/api';
import type { SocialFormat } from '@/constants/socialFormats';

export interface ContentAsset {
  formatId: string;
  platform: string;
  label: string;
  ratio: string;
  width: number;
  height: number;
  imageUrl?: string;
  caption?: string;
  hashtags?: string[];
  status: 'pending' | 'generating' | 'done' | 'error';
  error?: string;
}

export interface ContentJob {
  jobId: string;
  status: 'planning' | 'generating-copy' | 'generating-images' | 'done' | 'error';
  brief: string;
  createdAt: number;
  totalCount: number;
  completedCount: number;
  assets: ContentAsset[];
  error?: string;
}

function headers() {
  const token = authService.getToken();
  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

export async function startContentGeneration(params: {
  brief: string;
  formats: SocialFormat[];
  brandGuidelineId?: string;
  model?: string;
  tone?: string;
}): Promise<{ jobId: string; totalCount: number; creditsCharged: number }> {
  const res = await fetch(`${API_BASE}/content-studio`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      brief: params.brief,
      formats: params.formats.map((f) => ({
        id: f.id,
        platform: f.platform,
        label: f.label,
        ratio: f.ratio,
        width: f.width,
        height: f.height,
        copyMaxChars: f.copyMaxChars,
      })),
      brandGuidelineId: params.brandGuidelineId,
      model: params.model,
      tone: params.tone,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Content Studio failed: ${res.status}`);
  }

  return res.json();
}

export async function pollContentJob(jobId: string): Promise<ContentJob> {
  const res = await fetch(`${API_BASE}/content-studio/${jobId}`, {
    headers: headers(),
  });

  if (!res.ok) {
    throw new Error(`Failed to poll job: ${res.status}`);
  }

  return res.json();
}
