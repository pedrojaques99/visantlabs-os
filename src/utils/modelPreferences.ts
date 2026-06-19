import type { ImageProvider } from '@/types/types';

const STORAGE_KEY = 'visant:model-preferences';

export interface ModelPreferences {
  imageModel?: string;
  imageProvider?: ImageProvider;
  chatModel?: string;
  videoModel?: string;
  /** Fallback ordering when the chosen image model is unavailable. */
  fallbackStrategy?: 'cost' | 'quality';
}

let cache: ModelPreferences | null = null;

function load(): ModelPreferences {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      cache = JSON.parse(raw);
      return cache!;
    }
  } catch {}

  // Migrate from legacy keys on first load
  const migrated: ModelPreferences = {};
  try {
    const legacyImage = localStorage.getItem('vsn-preferred-image-model');
    if (legacyImage) migrated.imageModel = legacyImage;
    const legacyProvider = localStorage.getItem('visantlabs-image-provider');
    if (legacyProvider) migrated.imageProvider = legacyProvider as ImageProvider;
  } catch {}

  cache = migrated;
  if (Object.keys(migrated).length > 0) save(migrated);
  return migrated;
}

function save(prefs: ModelPreferences) {
  cache = prefs;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

export function getModelPreference<K extends keyof ModelPreferences>(key: K): ModelPreferences[K] {
  return load()[key];
}

export function setModelPreference<K extends keyof ModelPreferences>(
  key: K,
  value: ModelPreferences[K]
) {
  const prefs = { ...load(), [key]: value };
  save(prefs);
}

export function getPreferredImageModel(): string {
  return load().imageModel || '';
}

export function getPreferredImageProvider(): ImageProvider {
  return load().imageProvider || 'gemini';
}

export function getPreferredChatModel(): string {
  return load().chatModel || '';
}

export function getPreferredVideoModel(): string {
  return load().videoModel || '';
}
