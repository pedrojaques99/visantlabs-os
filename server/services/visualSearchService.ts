import { LRUCache } from 'lru-cache';
import { safeFetch } from '../utils/securityValidation.js';

// ── Types ──────────────────────────────────────────────────────────────────

export type SearchSource = 'unsplash' | 'pexels' | 'pixabay' | 'wikimedia' | 'clearbit' | 'svgl';
export type SearchIntent = 'letter' | 'logo' | 'layout' | 'typography' | 'mixed';

export interface VisualSearchResult {
  id: string;
  type: 'photo' | 'logo' | 'vector' | 'manuscript';
  source: SearchSource;
  imageUrl: string;
  thumbnailUrl: string;
  title: string;
  description?: string;
  tags: string[];
  dimensions: { width: number; height: number };
  attribution?: {
    author: string;
    authorUrl?: string;
    license: string;
  };
  relevanceScore: number;
  metadata?: {
    brandName?: string;
    category?: string;
    unsplashDownloadLocation?: string;
  };
}

interface SourceResult {
  source: SearchSource;
  results: VisualSearchResult[];
  error?: string;
}

// ── Intent Classification ──────────────────────────────────────────────────

const LETTER_PATTERNS = /^(letra|letter|character|glyph)\s+[a-zA-Z0-9]$/i;
const LOGO_PATTERNS = /\b(logo|marca|brand|logotipo|logomarca|emblem|badge)\b/i;
const LAYOUT_PATTERNS = /\b(layout|grid|editorial|diagramação|composição|composition)\b/i;
const TYPO_PATTERNS = /\b(tipografia|typography|font|typeface|lettering|caligrafia|calligraphy|serif|sans-serif)\b/i;

export function classifyIntent(query: string): SearchIntent {
  const q = query.trim().toLowerCase();
  if (LETTER_PATTERNS.test(q)) return 'letter';
  if (LOGO_PATTERNS.test(q)) return 'logo';
  if (LAYOUT_PATTERNS.test(q)) return 'layout';
  if (TYPO_PATTERNS.test(q)) return 'typography';
  return 'mixed';
}

// ── Source: Unsplash ───────────────────────────────────────────────────────

const unsplashCache = new LRUCache<string, VisualSearchResult[]>({ max: 200, ttl: 1000 * 60 * 30 });

const UNSPLASH_UTM = 'utm_source=visant_labs&utm_medium=referral';

async function searchUnsplash(query: string, perPage = 30, page = 1): Promise<SourceResult> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return { source: 'unsplash', results: [], error: 'UNSPLASH_ACCESS_KEY not configured' };

  const cacheKey = `unsplash:${query}:${perPage}:${page}`;
  const cached = unsplashCache.get(cacheKey);
  if (cached) return { source: 'unsplash', results: cached };

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=squarish`;
    const response = await safeFetch(url, {
      headers: { Authorization: `Client-ID ${key}` },
    });

    if (!response.ok) {
      const err = await response.text();
      return { source: 'unsplash', results: [], error: `Unsplash ${response.status}: ${err}` };
    }

    const data = await response.json() as any;
    const results: VisualSearchResult[] = (data.results || []).map((item: any, i: number) => ({
      id: `unsplash-${item.id}`,
      type: 'photo' as const,
      source: 'unsplash' as const,
      imageUrl: item.urls?.regular || item.urls?.small,
      thumbnailUrl: item.urls?.thumb || item.urls?.small,
      title: item.description || item.alt_description || query,
      description: item.alt_description,
      tags: (item.tags || []).slice(0, 5).map((t: any) => t.title || t),
      dimensions: { width: item.width || 400, height: item.height || 400 },
      attribution: {
        author: item.user?.name || 'Unknown',
        authorUrl: item.user?.links?.html ? `${item.user.links.html}?${UNSPLASH_UTM}` : undefined,
        license: 'Unsplash License',
      },
      relevanceScore: 1 - (i / (data.results?.length || 1)) * 0.3,
      metadata: {
        unsplashDownloadLocation: item.links?.download_location,
      },
    }));

    unsplashCache.set(cacheKey, results);
    return { source: 'unsplash', results };
  } catch (err: any) {
    return { source: 'unsplash', results: [], error: err.message };
  }
}

export async function triggerUnsplashDownload(downloadLocation: string): Promise<void> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key || !downloadLocation) return;
  await safeFetch(downloadLocation, {
    headers: { Authorization: `Client-ID ${key}` },
  }).catch(() => {});
}

// ── Source: Pexels ─────────────────────────────────────────────────────────

const pexelsCache = new LRUCache<string, VisualSearchResult[]>({ max: 200, ttl: 1000 * 60 * 30 });

async function searchPexels(query: string, perPage = 30, page = 1): Promise<SourceResult> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return { source: 'pexels', results: [], error: 'PEXELS_API_KEY not configured' };

  const cacheKey = `pexels:${query}:${perPage}:${page}`;
  const cached = pexelsCache.get(cacheKey);
  if (cached) return { source: 'pexels', results: cached };

  try {
    const url = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}`;
    const response = await safeFetch(url, {
      headers: { Authorization: key },
    });

    if (!response.ok) {
      return { source: 'pexels', results: [], error: `Pexels ${response.status}` };
    }

    const data = await response.json() as any;
    const results: VisualSearchResult[] = (data.photos || []).map((item: any, i: number) => ({
      id: `pexels-${item.id}`,
      type: 'photo' as const,
      source: 'pexels' as const,
      imageUrl: item.src?.large || item.src?.medium,
      thumbnailUrl: item.src?.medium || item.src?.small,
      title: item.alt || query,
      description: item.alt,
      tags: [],
      dimensions: { width: item.width || 400, height: item.height || 400 },
      attribution: {
        author: item.photographer || 'Unknown',
        authorUrl: item.photographer_url,
        license: 'Pexels License',
      },
      relevanceScore: 1 - (i / (data.photos?.length || 1)) * 0.3,
    }));

    pexelsCache.set(cacheKey, results);
    return { source: 'pexels', results };
  } catch (err: any) {
    return { source: 'pexels', results: [], error: err.message };
  }
}

// ── Source: Pixabay ────────────────────────────────────────────────────────

const pixabayCache = new LRUCache<string, VisualSearchResult[]>({ max: 200, ttl: 1000 * 60 * 30 });

async function searchPixabay(query: string, perPage = 30, imageType: 'all' | 'photo' | 'illustration' | 'vector' = 'all', page = 1): Promise<SourceResult> {
  const key = process.env.PIXABAY_API_KEY;
  if (!key) return { source: 'pixabay', results: [], error: 'PIXABAY_API_KEY not configured' };

  const cacheKey = `pixabay:${query}:${perPage}:${imageType}:${page}`;
  const cached = pixabayCache.get(cacheKey);
  if (cached) return { source: 'pixabay', results: cached };

  try {
    const params = new URLSearchParams({
      key,
      q: query,
      per_page: String(Math.min(perPage, 200)),
      page: String(page),
      image_type: imageType,
      lang: 'pt',
      min_width: '400',
      safesearch: 'true',
    });

    const url = `https://pixabay.com/api/?${params}`;
    const response = await safeFetch(url);

    if (!response.ok) {
      return { source: 'pixabay', results: [], error: `Pixabay ${response.status}` };
    }

    const data = await response.json() as any;
    const results: VisualSearchResult[] = (data.hits || []).map((item: any, i: number) => ({
      id: `pixabay-${item.id}`,
      type: (item.type === 'vector/svg' ? 'vector' : item.type === 'illustration' ? 'vector' : 'photo') as VisualSearchResult['type'],
      source: 'pixabay' as const,
      imageUrl: item.largeImageURL || item.webformatURL,
      thumbnailUrl: item.webformatURL || item.previewURL,
      title: item.tags || query,
      description: item.tags,
      tags: (item.tags || '').split(',').map((t: string) => t.trim()).filter(Boolean).slice(0, 5),
      dimensions: { width: item.imageWidth || item.webformatWidth || 400, height: item.imageHeight || item.webformatHeight || 400 },
      attribution: {
        author: item.user || 'Unknown',
        authorUrl: item.userImageURL ? `https://pixabay.com/users/${item.user}-${item.user_id}/` : undefined,
        license: 'Pixabay License',
      },
      relevanceScore: 0.95 - (i / (data.hits?.length || 1)) * 0.3,
    }));

    pixabayCache.set(cacheKey, results);
    return { source: 'pixabay', results };
  } catch (err: any) {
    return { source: 'pixabay', results: [], error: err.message };
  }
}

// ── Source: Wikimedia Commons ──────────────────────────────────────────────

const wikimediaCache = new LRUCache<string, VisualSearchResult[]>({ max: 200, ttl: 1000 * 60 * 30 });

async function searchWikimedia(query: string, limit = 20): Promise<SourceResult> {
  const cacheKey = `wikimedia:${query}:${limit}`;
  const cached = wikimediaCache.get(cacheKey);
  if (cached) return { source: 'wikimedia', results: cached };

  try {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrsearch: `${query} filetype:bitmap`,
      gsrlimit: String(limit),
      gsrnamespace: '6',
      prop: 'imageinfo',
      iiprop: 'url|size|extmetadata|mime',
      iiurlwidth: '800',
      format: 'json',
      origin: '*',
    });

    const url = `https://commons.wikimedia.org/w/api.php?${params}`;
    const response = await safeFetch(url, {
      headers: { 'User-Agent': 'VisantLabs/1.0 (visantlabs.com; visantsupply@gmail.com)' },
    });

    if (!response.ok) {
      return { source: 'wikimedia', results: [], error: `Wikimedia ${response.status}` };
    }

    const data = await response.json() as any;
    const pages = data.query?.pages || {};

    const results: VisualSearchResult[] = Object.values(pages)
      .filter((p: any) => p.imageinfo?.[0]?.mime?.startsWith('image/'))
      .map((page: any, i: number) => {
        const info = page.imageinfo[0];
        const meta = info.extmetadata || {};
        return {
          id: `wikimedia-${page.pageid}`,
          type: 'manuscript' as const,
          source: 'wikimedia' as const,
          imageUrl: info.thumburl || info.url,
          thumbnailUrl: info.thumburl || info.url,
          title: (page.title || '').replace('File:', '').replace(/\.\w+$/, ''),
          description: meta.ImageDescription?.value?.replace(/<[^>]+>/g, '').slice(0, 200),
          tags: [],
          dimensions: { width: info.thumbwidth || info.width || 400, height: info.thumbheight || info.height || 400 },
          attribution: {
            author: meta.Artist?.value?.replace(/<[^>]+>/g, '') || 'Wikimedia Commons',
            license: meta.LicenseShortName?.value || 'CC',
          },
          relevanceScore: 0.7 - (i / Object.keys(pages).length) * 0.2,
        };
      });

    wikimediaCache.set(cacheKey, results);
    return { source: 'wikimedia', results };
  } catch (err: any) {
    return { source: 'wikimedia', results: [], error: err.message };
  }
}

// ── Source: Svgl (SVG logos) ───────────────────────────────────────────────

const svglCache = new LRUCache<string, VisualSearchResult[]>({ max: 50, ttl: 1000 * 60 * 60 });

async function searchSvgl(query: string): Promise<SourceResult> {
  const cacheKey = `svgl:${query}`;
  const cached = svglCache.get(cacheKey);
  if (cached) return { source: 'svgl', results: cached };

  try {
    const url = `https://api.svgl.app/api/svgs?search=${encodeURIComponent(query)}`;
    const response = await safeFetch(url);

    if (!response.ok) {
      return { source: 'svgl', results: [], error: `Svgl ${response.status}` };
    }

    const data = await response.json() as any;
    const items = Array.isArray(data) ? data : data.svgs || [];

    const results: VisualSearchResult[] = items.slice(0, 20).map((item: any, i: number) => {
      const svgUrl = typeof item.route === 'string' ? item.route : item.route?.light || item.route;
      return {
        id: `svgl-${item.id || i}`,
        type: 'vector' as const,
        source: 'svgl' as const,
        imageUrl: svgUrl,
        thumbnailUrl: svgUrl,
        title: item.title || query,
        description: `${item.title} logo`,
        tags: [item.category].filter(Boolean),
        dimensions: { width: 200, height: 200 },
        attribution: {
          author: item.title || 'Unknown',
          license: 'Brand Asset',
        },
        relevanceScore: 0.85 - (i / items.length) * 0.2,
        metadata: {
          brandName: item.title,
          category: item.category,
        },
      };
    });

    svglCache.set(cacheKey, results);
    return { source: 'svgl', results };
  } catch (err: any) {
    return { source: 'svgl', results: [], error: err.message };
  }
}

// ── Source: Clearbit (company logos) ───────────────────────────────────────

function searchClearbit(query: string): SourceResult {
  const domains = guessDomains(query);
  const results: VisualSearchResult[] = domains.map((domain, i) => ({
    id: `clearbit-${domain}`,
    type: 'logo' as const,
    source: 'clearbit' as const,
    imageUrl: `https://logo.clearbit.com/${domain}?size=400`,
    thumbnailUrl: `https://logo.clearbit.com/${domain}?size=128`,
    title: `${domain.split('.')[0]} logo`,
    tags: ['logo', 'brand'],
    dimensions: { width: 400, height: 400 },
    attribution: {
      author: domain,
      license: 'Clearbit',
    },
    relevanceScore: 0.9 - i * 0.05,
    metadata: { brandName: domain.split('.')[0] },
  }));

  return { source: 'clearbit', results };
}

function guessDomains(query: string): string[] {
  const q = query.toLowerCase().replace(/\s+logo\b/i, '').trim();
  const clean = q.replace(/[^a-z0-9]/g, '');
  if (!clean) return [];
  return [
    `${clean}.com`,
    `${clean}.io`,
    `${clean}.co`,
  ];
}

// ── Aggregator ─────────────────────────────────────────────────────────────

interface SearchOptions {
  query: string;
  intent?: SearchIntent;
  sources?: SearchSource[];
  limit?: number;
  page?: number;
}

export async function aggregateSearch(opts: SearchOptions): Promise<{
  results: VisualSearchResult[];
  intent: SearchIntent;
  sources: { source: SearchSource; count: number; error?: string }[];
  total: number;
  hasMore: boolean;
  page: number;
}> {
  const { query, limit = 60, page = 1 } = opts;
  const intent = opts.intent || classifyIntent(query);

  const activeSources = opts.sources || getSourcesForIntent(intent);
  const perSource = Math.ceil(limit / activeSources.length);

  const sourcePromises = activeSources.map((source) => {
    switch (source) {
      case 'unsplash': return searchUnsplash(enhanceQuery(query, intent, 'unsplash'), perSource, page);
      case 'pexels':   return searchPexels(enhanceQuery(query, intent, 'pexels'), perSource, page);
      case 'pixabay':  return searchPixabay(enhanceQuery(query, intent, 'pixabay'), perSource, intent === 'logo' ? 'vector' : 'all', page);
      case 'wikimedia': return searchWikimedia(enhanceQuery(query, intent, 'wikimedia'), Math.min(perSource, 20));
      case 'svgl':     return searchSvgl(query);
      case 'clearbit': return Promise.resolve(searchClearbit(query));
      default:         return Promise.resolve({ source, results: [] } as SourceResult);
    }
  });

  const sourceResults = await Promise.allSettled(sourcePromises);

  const allResults: VisualSearchResult[] = [];
  const sourceSummary: { source: SearchSource; count: number; error?: string }[] = [];

  for (const settled of sourceResults) {
    if (settled.status === 'fulfilled') {
      const sr = settled.value;
      allResults.push(...sr.results);
      sourceSummary.push({ source: sr.source, count: sr.results.length, error: sr.error });
    } else {
      sourceSummary.push({ source: 'unsplash', count: 0, error: settled.reason?.message });
    }
  }

  allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const hasMore = activeSources.some(s => !['svgl', 'clearbit', 'wikimedia'].includes(s)) &&
    allResults.length >= perSource;

  return {
    results: allResults,
    intent,
    sources: sourceSummary,
    total: allResults.length,
    hasMore,
    page,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getSourcesForIntent(intent: SearchIntent): SearchSource[] {
  switch (intent) {
    case 'letter':     return ['unsplash', 'pexels', 'pixabay', 'wikimedia'];
    case 'logo':       return ['svgl', 'clearbit', 'pixabay', 'unsplash'];
    case 'layout':     return ['unsplash', 'pexels', 'pixabay'];
    case 'typography': return ['unsplash', 'pexels', 'pixabay', 'wikimedia'];
    case 'mixed':      return ['unsplash', 'pexels', 'pixabay', 'svgl'];
  }
}

function enhanceQuery(query: string, intent: SearchIntent, source: SearchSource): string {
  const q = query.trim();

  if (source === 'wikimedia') {
    switch (intent) {
      case 'letter':     return `${q} illuminated manuscript lettering`;
      case 'typography': return `${q} vintage typography poster`;
      default:           return `${q} design`;
    }
  }

  if (source === 'unsplash' || source === 'pexels' || source === 'pixabay') {
    switch (intent) {
      case 'letter':     return `${q} typography lettering`;
      case 'layout':     return `${q} editorial design layout`;
      case 'typography': return `${q} typeface design`;
      default:           return q;
    }
  }

  return q;
}
