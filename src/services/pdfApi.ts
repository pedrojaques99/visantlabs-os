import { authService } from './authService';

export type CompressPreset = 'screen' | 'ebook' | 'printer' | 'prepress';

interface CompressResult {
  pdf: string;
  originalSize: number;
  compressedSize: number;
  savings: number;
}

interface ToImagesResult {
  images: { page: number; data: string; size: number }[];
  pageCount: number;
}

const getApiBaseUrl = () => (import.meta as any).env?.VITE_API_URL || '/api';

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const token = authService.getToken();
  const res = await fetch(`${getApiBaseUrl()}/pdf${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }

  return res.json();
}

export const pdfApi = {
  compress: (pdf: string, preset: CompressPreset = 'ebook') =>
    post<CompressResult>('/compress', { pdf, preset }),

  toImages: (pdf: string, opts?: { dpi?: number; format?: 'png' | 'jpeg'; pages?: string }) =>
    post<ToImagesResult>('/to-images', { pdf, ...opts }),

  fromImages: (images: string[]) =>
    post<{ pdf: string; size: number; pageCount: number }>('/from-images', { images }),

  merge: (pdfs: string[]) => post<{ pdf: string; size: number }>('/merge', { pdfs }),

  cmyk: (pdf: string) => post<{ pdf: string; size: number }>('/cmyk', { pdf }),

  pdfa: (pdf: string) => post<{ pdf: string; size: number }>('/pdfa', { pdf }),
};
