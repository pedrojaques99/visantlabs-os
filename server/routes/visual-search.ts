import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { redisClient } from '../lib/redis.js';
import { CacheKey, CACHE_TTL, hashQuery } from '../lib/cache-utils.js';
import { aggregateSearch, classifyIntent, type SearchSource } from '../services/visualSearchService.js';

const router = express.Router();

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many search requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/visual-search/query
router.post('/query', searchLimiter, async (req, res) => {
  try {
    const { query, sources, limit = 60, page = 1 } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    const sanitized = query.trim().replace(/[<>"{}]/g, '').slice(0, 200);
    if (sanitized.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const validSources: SearchSource[] | undefined = sources
      ? (sources as string[]).filter((s): s is SearchSource =>
          ['unsplash', 'pexels', 'pixabay', 'wikimedia', 'clearbit', 'svgl'].includes(s))
      : undefined;

    const intent = classifyIntent(sanitized);
    const cacheHash = hashQuery(sanitized, `${intent}|${(validSources || []).join(',')}|${page}`);
    const redisCacheKey = CacheKey.visualSearch(cacheHash);

    const cached = await redisClient.get(redisCacheKey).catch(() => null);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        return res.json({ success: true, fromCache: true, ...parsed });
      } catch { /* cache corrupted, continue */ }
    }

    const result = await aggregateSearch({
      query: sanitized,
      intent,
      sources: validSources,
      limit,
      page,
    });

    const payload = {
      results: result.results,
      intent: result.intent,
      sources: result.sources,
      total: result.total,
      query: sanitized,
      page,
    };

    await redisClient.setex(
      redisCacheKey,
      CACHE_TTL.VISUAL_SEARCH,
      JSON.stringify(payload),
    ).catch(() => {});

    return res.json({ success: true, fromCache: false, ...payload });
  } catch (error: any) {
    console.error('[visual-search] Error:', error.message);
    return res.status(500).json({ error: 'Search failed', message: error.message });
  }
});

// GET /api/visual-search/sources — available sources and their status
router.get('/sources', (_req, res) => {
  const sources = [
    { id: 'unsplash', name: 'Unsplash', available: !!process.env.UNSPLASH_ACCESS_KEY, type: 'photos' },
    { id: 'pexels', name: 'Pexels', available: !!process.env.PEXELS_API_KEY, type: 'photos' },
    { id: 'pixabay', name: 'Pixabay', available: !!process.env.PIXABAY_API_KEY, type: 'photos' },
    { id: 'wikimedia', name: 'Wikimedia Commons', available: true, type: 'manuscripts' },
    { id: 'clearbit', name: 'Clearbit', available: true, type: 'logos' },
    { id: 'svgl', name: 'Svgl', available: true, type: 'vectors' },
  ];
  return res.json({ success: true, sources });
});

export default router;
