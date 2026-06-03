import { useCallback, useRef } from 'react';
import type { AspectRatio, Resolution, GeminiModel, SeedreamModel } from '@/types/types';

export type NodeOutputType = 'prompt' | 'mockup' | 'video';

export interface OutputDefaults {
  model?: GeminiModel | SeedreamModel | string;
  aspectRatio?: AspectRatio;
  resolution?: Resolution;
}

const STORAGE_KEY = 'visant:output-defaults';

function loadAll(): Record<NodeOutputType, OutputDefaults> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { prompt: {}, mockup: {}, video: {} };
}

function saveAll(data: Record<NodeOutputType, OutputDefaults>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export function getOutputDefaults(nodeType: NodeOutputType): OutputDefaults {
  return loadAll()[nodeType] || {};
}

export function useOutputDefaults(nodeType: NodeOutputType) {
  const cacheRef = useRef<OutputDefaults | null>(null);

  if (!cacheRef.current) {
    cacheRef.current = getOutputDefaults(nodeType);
  }

  const defaults = cacheRef.current;

  const persist = useCallback(
    (partial: Partial<OutputDefaults>) => {
      const all = loadAll();
      all[nodeType] = { ...all[nodeType], ...partial };
      saveAll(all);
      cacheRef.current = all[nodeType];
    },
    [nodeType]
  );

  return { defaults, persist } as const;
}
