import { BoundingBox, AnimationSuggestion, MoodboardProject, CroppedImage } from '../types/moodboard';
import { authService } from './authService';

const BASE = '/api/moodboard';

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = authService.getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options as any).headers || {}),
    },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const moodboardApi = {
  detectGrid: (imageBase64: string): Promise<{ boxes: BoundingBox[] }> =>
    req('/detect-grid', { method: 'POST', body: JSON.stringify({ imageBase64 }) }),

  upscale: (imageBase64: string, size: '1K' | '2K' | '4K' = '4K'): Promise<{ upscaledBase64: string }> =>
    req('/upscale', { method: 'POST', body: JSON.stringify({ imageBase64, size }) }),

  suggest: (images: { id: string; base64: string }[]): Promise<{ suggestions: AnimationSuggestion[] }> =>
    req('/suggest', { method: 'POST', body: JSON.stringify({ images }) }),

  saveProject: (project: { id?: string; name?: string; sourceUrl?: string; images?: CroppedImage[]; brandGuidelineId?: string }): Promise<{ id: string }> =>
    req('/projects', { method: 'POST', body: JSON.stringify(project) }),

  listProjects: (): Promise<{ projects: MoodboardProject[] }> =>
    req('/projects'),

  getProject: (id: string): Promise<{ project: MoodboardProject & { images: CroppedImage[] } }> =>
    req(`/projects/${id}`),

  deleteProject: (id: string): Promise<{ ok: boolean }> =>
    req(`/projects/${id}`, { method: 'DELETE' }),
};
