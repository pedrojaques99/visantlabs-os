import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { redisClient } from '../lib/redis.js';
import { CacheKey, CACHE_TTL, hashQuery } from '../lib/cache-utils.js';
import { aggregateSearch, classifyIntent, type SearchSource } from '../services/visualSearchService.js';
import { processLetterCrops, getLibraryCrops } from '../services/letterCropService.js';

const router = express.Router();

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many search requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const LETTER_PATTERN = /\b(?:letra|letter|character|glyph)\s+([a-zA-Z0-9])\b/i;

// POST /api/visual-search/query
router.post('/query', searchLimiter, async (req, res) => {
  try {
    const { query, sources } = req.body;
    const limit = Math.min(Math.max(Number(req.body.limit) || 60, 1), 100);
    const page = Math.min(Math.max(Number(req.body.page) || 1, 1), 100);

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query is required' });
    }

    const sanitized = query.trim().replace(/[<>"{}]/g, '').slice(0, 200);
    if (sanitized.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const validSources: SearchSource[] | undefined = sources
      ? (sources as string[]).filter((s): s is SearchSource =>
          ['unsplash', 'pexels', 'pixabay', 'wikimedia', 'clearbit', 'svgl', 'google'].includes(s))
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

    // Letter crop pipeline: process top results on first page
    let letterCrops: any[] = [];
    const letterMatch = sanitized.match(LETTER_PATTERN);
    if (intent === 'letter' && letterMatch && page === 1) {
      letterCrops = await processLetterCrops(result.results, letterMatch[1]).catch(err => {
        console.error('[visual-search] Letter crop pipeline error:', err.message);
        return [];
      });
    }

    const payload = {
      results: result.results,
      intent: result.intent,
      sources: result.sources,
      total: result.total,
      hasMore: result.hasMore,
      query: sanitized,
      page,
      letterCrops,
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

// GET /api/visual-search/library — persistent letter crop library
router.get('/library', async (req, res) => {
  try {
    const letter = typeof req.query.letter === 'string' ? req.query.letter : undefined;
    const style = typeof req.query.style === 'string' ? req.query.style : undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await getLibraryCrops(letter, style, limit, offset);
    return res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[visual-search] Library error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch library' });
  }
});

// GET /api/visual-search/sources
router.get('/sources', (_req, res) => {
  const sources = [
    { id: 'unsplash', name: 'Unsplash', available: !!process.env.UNSPLASH_ACCESS_KEY, type: 'photos' },
    { id: 'pexels', name: 'Pexels', available: !!process.env.PEXELS_API_KEY, type: 'photos' },
    { id: 'pixabay', name: 'Pixabay', available: !!process.env.PIXABAY_API_KEY, type: 'photos' },
    { id: 'wikimedia', name: 'Wikimedia Commons', available: true, type: 'manuscripts' },
    { id: 'clearbit', name: 'Clearbit', available: true, type: 'logos' },
    { id: 'svgl', name: 'Svgl', available: true, type: 'vectors' },
    { id: 'google', name: 'Google', available: !!process.env.SERPER_API_KEY, type: 'images' },
  ];
  return res.json({ success: true, sources });
});

export default router;
