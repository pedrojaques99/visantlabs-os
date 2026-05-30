import { API_BASE } from '@/config/api';

export interface TraceOptions {
  turdSize?: number;
  optTolerance?: number;
  threshold?: number;
  color?: string;
}

export const DEFAULT_TRACE_OPTIONS: Required<Omit<TraceOptions, 'color'>> & { color?: string } = {
  turdSize: 2,
  optTolerance: 0.2,
  threshold: 128,
};

async function traceApiFetch(endpoint: string, body: Record<string, unknown>): Promise<string> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}/trace/${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error: ${res.status}`);
  }

  const { svg } = await res.json();
  return svg;
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function tracePng(file: File, options?: TraceOptions): Promise<string> {
  const dataUrl = await fileToDataURL(file);
  return traceApiFetch('png-to-svg', {
    image: dataUrl,
    turdSize: options?.turdSize,
    optTolerance: options?.optTolerance,
    threshold: options?.threshold,
    color: options?.color,
  });
}

export async function optimizeSvgRemote(rawSvg: string): Promise<string> {
  return traceApiFetch('optimize', { svg: rawSvg });
}
