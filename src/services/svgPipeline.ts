import { API_BASE } from '@/config/api';

export type TracePreset = 'logo' | 'lettering' | 'lineArt' | 'stamp' | 'custom';

export interface TraceOptions {
  turdSize?: number;
  optTolerance?: number;
  threshold?: number | 'auto';
  alphaMax?: number;
  color?: string;
  preset?: TracePreset;
}

export const TRACE_PRESETS: Record<
  Exclude<TracePreset, 'custom'>,
  { label: string; description: string; defaults: Required<Omit<TraceOptions, 'color' | 'preset'>> }
> = {
  logo: {
    label: 'Logo',
    description: 'Sharp corners, clean shapes',
    defaults: { turdSize: 3, optTolerance: 0.3, threshold: 'auto', alphaMax: 0.8 },
  },
  lettering: {
    label: 'Lettering',
    description: 'High fidelity curves',
    defaults: { turdSize: 1, optTolerance: 0.15, threshold: 'auto', alphaMax: 0.5 },
  },
  lineArt: {
    label: 'Line Art',
    description: 'Maximum detail, thin strokes',
    defaults: { turdSize: 0, optTolerance: 0.1, threshold: 128, alphaMax: 1.0 },
  },
  stamp: {
    label: 'Stamp',
    description: 'Simplified, noise-resistant',
    defaults: { turdSize: 5, optTolerance: 0.5, threshold: 'auto', alphaMax: 0.8 },
  },
};

export const DEFAULT_TRACE_OPTIONS: Required<Omit<TraceOptions, 'color'>> & { color?: string } = {
  turdSize: 2,
  optTolerance: 0.2,
  threshold: 128,
  alphaMax: 1,
  preset: 'logo',
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
    alphaMax: options?.alphaMax,
    color: options?.color,
    preset: options?.preset,
  });
}

export async function optimizeSvgRemote(rawSvg: string): Promise<string> {
  return traceApiFetch('optimize', { svg: rawSvg });
}
