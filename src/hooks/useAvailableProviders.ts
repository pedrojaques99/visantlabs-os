import { useState, useEffect } from 'react';
import type { ImageProvider } from '@/types/types';

export interface AvailableProviders {
  gemini: boolean;
  imagen: boolean;
  openai: boolean;
  seedream: boolean;
  ideogram: boolean;
  reve: boolean;
  kling: boolean;
  seedance: boolean;
  veo: boolean;
}

const DEFAULT: AvailableProviders = {
  gemini: true,
  imagen: true,
  openai: true,
  seedream: true,
  ideogram: true,
  reve: true,
  kling: true,
  seedance: true,
  veo: true,
};

let cache: AvailableProviders | null = null;
let fetchPromise: Promise<AvailableProviders> | null = null;

async function fetchProviders(): Promise<AvailableProviders> {
  try {
    const res = await fetch('/api/docs/providers');
    if (!res.ok) return DEFAULT;
    return await res.json();
  } catch {
    return DEFAULT;
  }
}

export function useAvailableProviders(): AvailableProviders {
  const [providers, setProviders] = useState<AvailableProviders>(() => cache || DEFAULT);

  useEffect(() => {
    if (cache) return;
    if (!fetchPromise) fetchPromise = fetchProviders();
    fetchPromise.then((data) => {
      cache = data;
      setProviders(data);
    });
  }, []);

  return providers;
}

export function isProviderAvailable(
  providers: AvailableProviders,
  provider: ImageProvider | 'kling' | 'seedance' | 'veo'
): boolean {
  return providers[provider] ?? true;
}
