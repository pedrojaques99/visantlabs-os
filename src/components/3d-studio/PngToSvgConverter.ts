const getApiBaseUrl = () => (import.meta as any).env?.VITE_API_URL || '/api';

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface TraceOptions {
  turdSize?: number;
  optTolerance?: number;
  threshold?: number;
}

async function traceApiFetch(endpoint: string, body: Record<string, unknown>): Promise<string> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${getApiBaseUrl()}/trace/${endpoint}`, {
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

export async function pngToSvg(file: File, options?: TraceOptions): Promise<string> {
  const dataUrl = await fileToDataURL(file);
  return traceApiFetch('png-to-svg', {
    image: dataUrl,
    turdSize: options?.turdSize,
    optTolerance: options?.optTolerance,
    threshold: options?.threshold,
  });
}

export async function optimizeSvgRemote(rawSvg: string): Promise<string> {
  return traceApiFetch('optimize', { svg: rawSvg });
}
