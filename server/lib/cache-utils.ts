import crypto from 'crypto';

export const CACHE_TTL = {
  EXPERT_RAG: 24 * 60 * 60,        // 24h
  MOCKUP_GEN: 7 * 24 * 60 * 60,    // 7d
  PLUGIN_CTX: 60 * 60,              // 1h
  BRAND_CTX: 24 * 60 * 60,          // 24h
  PRESET_SEARCH: 7 * 24 * 60 * 60, // 7d
  SHARE_PUBLIC: 7 * 24 * 60 * 60,  // 7d
} as const;

export function hashQuery(text: string, extra?: string): string {
  return crypto.createHash('md5').update(`${text}|${extra || ''}`).digest('hex');
}

export function hashObject(obj: any): string {
  return crypto.createHash('md5').update(JSON.stringify(obj)).digest('hex');
}

export const CacheKey = {
  expertRag: (userId: string, projectId: string, queryHash: string) =>
    `expert:${userId}:${projectId}:${queryHash}`,

  mockupGen: (userId: string, promptHash: string) =>
    `mockup:${userId}:${promptHash}`,

  pluginContext: (fileId: string, brandId: string, hash: string) =>
    `plugin:ctx:${fileId}:${brandId}:${hash}`,

  brandContext: (guidelineId: string, format: string) =>
    `context:${guidelineId}:${format}`,

  presetSearch: (category: string, queryHash: string, page: number) =>
    `preset:${category}:${queryHash}:p${page}`,

  sharePublic: (shareId: string) =>
    `share:${shareId}`,
} as const;

export const CacheInvalidation = {
  onBrandEdit: (guidelineId: string, pattern = '*') =>
    [`context:${guidelineId}:${pattern}`, `plugin:ctx:*:${guidelineId}:${pattern}`],

  onTemplateChange: () =>
    [`plugin:ctx:*:*:*`],

  onPresetChange: (category: string) =>
    [`preset:${category}:*`],
} as const;
