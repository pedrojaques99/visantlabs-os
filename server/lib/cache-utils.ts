import crypto from 'crypto';

export const CACHE_TTL = {
  EXPERT_RAG: 24 * 60 * 60,        // 24h
  MOCKUP_GEN: 7 * 24 * 60 * 60,    // 7d
  PLUGIN_CTX: 60 * 60,              // 1h
  BRAND_CTX: 24 * 60 * 60,          // 24h
  PRESET_SEARCH: 7 * 24 * 60 * 60, // 7d
  SHARE_PUBLIC: 7 * 24 * 60 * 60,  // 7d
  // P1: Secondary routes
  AI_TEXT: 7 * 24 * 60 * 60,          // 7d — Gemini text responses
  AI_IMAGE_ANALYSIS: 30 * 24 * 60 * 60, // 30d — describe image (images stable)
  AI_IMAGE_GEN: 7 * 24 * 60 * 60,    // 7d — change-object, apply-theme
  BRAND_INTEL: 24 * 60 * 60,         // 24h — brand intelligence reads
  CREATIVE_PROJECTS: 60 * 60,        // 1h — project list/detail
  // P2: Tertiary routes
  VIDEO_GEN: 30 * 24 * 60 * 60,      // 30d — Veo generations (expensive + stable)
  FIGMA_GEN: 60 * 60,                // 1h — figma canvas context volatile
  IMAGE_SEARCH: 7 * 24 * 60 * 60,    // 7d — image search results
  INSTAGRAM: 24 * 60 * 60,           // 24h — instagram extractions
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

  // P1: AI endpoints
  aiText: (op: string, userId: string, hash: string) =>
    `ai:${op}:${userId}:${hash}`,

  // P1: Brand intelligence
  brandIntel: (guidelineId: string) =>
    `brand-intel:${guidelineId}`,

  // P1: Creative projects
  projectList: (userId: string) =>
    `projects:list:${userId}`,

  projectDetail: (userId: string, projectId: string) =>
    `projects:${userId}:${projectId}`,

  // P2: Video generation
  videoGen: (userId: string, hash: string) =>
    `video:${userId}:${hash}`,

  // P2: Image search/extraction
  imageSearch: (userId: string, hash: string) =>
    `images:search:${userId}:${hash}`,

  imageExtract: (userId: string, hash: string) =>
    `images:extract:${userId}:${hash}`,

  instagramExtract: (userId: string, hash: string) =>
    `images:instagram:${userId}:${hash}`,

  // P2: Figma
  figmaGen: (userId: string, hash: string) =>
    `figma:gen:${userId}:${hash}`,
} as const;

export const CacheInvalidation = {
  onBrandEdit: (guidelineId: string, pattern = '*') =>
    [`context:${guidelineId}:${pattern}`, `plugin:ctx:*:${guidelineId}:${pattern}`, `brand-intel:${guidelineId}`],

  onTemplateChange: () =>
    [`plugin:ctx:*:*:*`],

  onPresetChange: (category: string) =>
    [`preset:${category}:*`],

  onProjectMutation: (userId: string, projectId?: string) => {
    const keys = [`projects:list:${userId}`];
    if (projectId) keys.push(`projects:${userId}:${projectId}`);
    return keys;
  },
} as const;
