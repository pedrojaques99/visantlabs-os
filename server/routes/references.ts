/**
 * References API — public, geo-tagged design reference library.
 *
 * Reuses the existing ingest pipeline (referenceIngestor) + Pinecone multimodal
 * vector store. Exposes the library to end users:
 *  - POST /upload          → user uploads an image, pipeline analyses + tags + populates
 *  - GET  /                → public browse with tag + country + region filters
 *  - GET  /facets          → distinct countries/regions/tags for the filter UI
 *  - POST /search-by-image → upload an image, find visually similar references
 *  - GET  /mine            → the authenticated user's own uploaded references
 */

import express, { type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { chargeCredits } from '../lib/credits.js';
import { regionForCountry, normalizeCountry } from '../../src/lib/references/taxonomy.js';

const router = express.Router();

const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_API || '60', 10),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const ingestRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many uploads. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public projection — never leak internal Mongo _id or owner internals
const PUBLIC_PROJECTION = {
  _id: 0,
  id: 1,
  name: 1,
  studio: 1,
  description: 1,
  referenceImageUrl: 1,
  thumbnailUrl: 1,
  dimensions: 1,
  provenance: 1,
  country: 1,
  region: 1,
  sourceUrl: 1,
  tags: 1,
  createdAt: 1,
} as const;

const DIMENSION_KEYS = [
  'niche',
  'aesthetic',
  'vibe',
  'lighting',
  'texture',
  'material',
  'angle',
  'color_mood',
  'mockup_type',
] as const;

/** Build a Mongo filter for the public library from query params. */
function buildLibraryFilter(query: Request['query']): Record<string, any> {
  // Visible in the public library: admin-curated OR explicitly public + approved
  const filter: Record<string, any> = {
    category: 'reference',
    $and: [{ $or: [{ isAdminCurated: true }, { isPublic: true, isApproved: true }] }],
  };

  const country = typeof query.country === 'string' ? normalizeCountry(query.country) : undefined;
  if (country) filter.country = country;

  if (typeof query.region === 'string' && query.region.trim()) {
    filter.region = query.region.trim();
  }

  // Free-text tag filter across the flattened tags array
  if (typeof query.tag === 'string' && query.tag.trim()) {
    filter.tags = { $in: query.tag.split(',').map((t) => t.trim().toLowerCase()) };
  }

  for (const key of DIMENSION_KEYS) {
    const val = query[key];
    if (typeof val === 'string' && val.trim()) {
      filter[`dimensions.${key}`] = { $in: val.split(',').map((v) => v.trim()) };
    }
  }

  if (typeof query.search === 'string' && query.search.trim()) {
    filter.$and.push({
      $or: [
        { name: { $regex: query.search.trim(), $options: 'i' } },
        { description: { $regex: query.search.trim(), $options: 'i' } },
        { studio: { $regex: query.search.trim(), $options: 'i' } },
      ],
    });
  }

  return filter;
}

// ── POST /upload — user uploads images, pipeline tags + populates ────────────
router.post(
  '/upload',
  ingestRateLimiter,
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const { images } = req.body;
      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'images array is required (max 10)' });
      }
      if (images.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 images per batch' });
      }

      const r2Service = await import('../../src/services/r2Service.js');
      if (!r2Service.isR2Configured()) {
        return res.status(503).json({ error: 'Storage is not configured' });
      }
      const { ingestReference } = await import('../lib/mockup/referenceIngestor.js');

      // Charge 1 credit per image up-front (AI analysis cost)
      await chargeCredits(userId, images.length);

      const results: any[] = [];
      const errors: any[] = [];

      for (const img of images) {
        try {
          const base64 = typeof img === 'string' ? img : img.data;
          if (!base64) {
            errors.push({ name: img?.name, error: 'Missing image data' });
            continue;
          }

          const presetId = `userref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const imageUrl = await r2Service.uploadMockupPresetReference(base64, presetId);

          const result = await ingestReference({
            imageBase64: base64,
            imageUrl,
            name: img.name,
            studio: img.studio,
            userId: String(userId),
            tags: Array.isArray(img.tags) ? img.tags : undefined,
            country: img.country,
            region: img.region,
            designer: img.designer,
            sourceUrl: img.sourceUrl,
            awardSource: img.awardSource,
            year: typeof img.year === 'number' ? img.year : undefined,
            // User uploads are owned by the user; public only if they opt in
            isAdminCurated: false,
            isPublic: img.isPublic === true,
          });

          results.push(result);
        } catch (err: any) {
          errors.push({ name: img?.name, error: err.message });
        }
      }

      return res.json({
        success: true,
        ingested: results.length,
        failed: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error('[references] upload error:', error);
      return res.status(500).json({ error: 'Failed to ingest references', details: error.message });
    }
  }
);

// ── GET / — public browse ────────────────────────────────────────────────────
router.get('/', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    await connectToMongoDB();
    const db = getDb();

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(60, Math.max(1, parseInt(req.query.limit as string) || 30));
    const skip = (page - 1) * limit;

    const filter = buildLibraryFilter(req.query);

    const [refs, total] = await Promise.all([
      db
        .collection('community_presets')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .project(PUBLIC_PROJECTION)
        .toArray(),
      db.collection('community_presets').countDocuments(filter),
    ]);

    return res.json({ references: refs, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    console.error('[references] list error:', error);
    return res.status(500).json({ error: 'Failed to list references' });
  }
});

// ── GET /facets — filter options ─────────────────────────────────────────────
router.get('/facets', apiRateLimiter, async (_req: Request, res: Response) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    const base = {
      category: 'reference',
      $or: [{ isAdminCurated: true }, { isPublic: true, isApproved: true }],
    };

    const [countries, regions, tagAgg] = await Promise.all([
      db.collection('community_presets').distinct('country', base),
      db.collection('community_presets').distinct('region', base),
      db
        .collection('community_presets')
        .aggregate([
          { $match: base },
          { $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } },
          { $group: { _id: '$tags', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 40 },
        ])
        .toArray(),
    ]);

    return res.json({
      countries: (countries as string[]).filter(Boolean).sort(),
      regions: (regions as string[]).filter(Boolean).sort(),
      tags: tagAgg.map((t: any) => ({ value: t._id, count: t.count })),
    });
  } catch (error: any) {
    console.error('[references] facets error:', error);
    return res.status(500).json({ error: 'Failed to load facets' });
  }
});

// ── POST /search-by-image — visual similarity ────────────────────────────────
router.post(
  '/search-by-image',
  ingestRateLimiter,
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });

      const { imageBase64 } = req.body;
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'imageBase64 is required' });
      }
      const limit = Math.min(60, Math.max(1, parseInt(req.body.limit) || 24));

      const { getMultimodalEmbedding } = await import('../services/geminiService.js');
      const { vectorService } = await import('../services/vectorService.js');

      const rawBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '');
      const { embedding } = await getMultimodalEmbedding([
        { inlineData: { data: rawBase64, mimeType: 'image/png' } },
      ]);

      // Scope to reference vectors; optionally narrow by provenance
      const vectorFilter: Record<string, any> = { feature: 'reference' };
      const country =
        typeof req.body.country === 'string' ? normalizeCountry(req.body.country) : undefined;
      if (country) vectorFilter.country = { $eq: country };
      if (typeof req.body.region === 'string' && req.body.region.trim()) {
        vectorFilter.region = { $eq: req.body.region.trim() };
      }

      const matches = await vectorService.query(embedding, limit, vectorFilter);
      const ids = matches.map((m: any) => m.id).filter(Boolean);
      if (ids.length === 0) return res.json({ references: [], total: 0 });

      // Hydrate from Mongo so the UI gets full, public-safe records
      await connectToMongoDB();
      const db = getDb();
      const docs = await db
        .collection('community_presets')
        .find({ id: { $in: ids }, category: 'reference' })
        .project(PUBLIC_PROJECTION)
        .toArray();

      // Preserve similarity order + attach score
      const scoreById = new Map(matches.map((m: any) => [m.id, m.score]));
      const ordered = ids
        .map((id: string) => {
          const doc = docs.find((d: any) => d.id === id);
          return doc ? { ...doc, score: scoreById.get(id) ?? 0 } : null;
        })
        .filter(Boolean);

      return res.json({ references: ordered, total: ordered.length });
    } catch (error: any) {
      console.error('[references] search-by-image error:', error);
      return res.status(500).json({ error: 'Visual search failed', details: error.message });
    }
  }
);

// ── GET /:id/similar — "more like this" (the exploration loop) ───────────────
router.get('/:id/similar', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    if (!/^[a-zA-Z0-9_-]{6,64}$/.test(id)) {
      return res.status(400).json({ error: 'Invalid reference id' });
    }
    const limit = Math.min(40, Math.max(1, parseInt(req.query.limit as string) || 24));

    const { vectorService } = await import('../services/vectorService.js');
    // +1 because the record itself comes back as the top match
    const matches = await vectorService.queryById(id, limit + 1, { feature: 'reference' });
    const ids = matches.map((m: any) => m.id).filter((mid: string) => mid && mid !== id);
    if (ids.length === 0) return res.json({ references: [], total: 0 });

    await connectToMongoDB();
    const db = getDb();
    const docs = await db
      .collection('community_presets')
      .find({
        id: { $in: ids },
        category: 'reference',
        $or: [{ isAdminCurated: true }, { isPublic: true, isApproved: true }],
      })
      .project(PUBLIC_PROJECTION)
      .toArray();

    const scoreById = new Map(matches.map((m: any) => [m.id, m.score]));
    const ordered = ids
      .map((mid: string) => {
        const doc = docs.find((d: any) => d.id === mid);
        return doc ? { ...doc, score: scoreById.get(mid) ?? 0 } : null;
      })
      .filter(Boolean)
      .slice(0, limit);

    return res.json({ references: ordered, total: ordered.length });
  } catch (error: any) {
    console.error('[references] similar error:', error);
    return res.status(500).json({ error: 'Failed to find similar references' });
  }
});

// ── GET /mine — the authenticated user's uploads ─────────────────────────────
router.get('/mine', apiRateLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });

    await connectToMongoDB();
    const db = getDb();

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(60, Math.max(1, parseInt(req.query.limit as string) || 30));
    const skip = (page - 1) * limit;

    const filter = { category: 'reference', userId: String(userId), isAdminCurated: false };
    const [refs, total] = await Promise.all([
      db
        .collection('community_presets')
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .project({ ...PUBLIC_PROJECTION, isPublic: 1 })
        .toArray(),
      db.collection('community_presets').countDocuments(filter),
    ]);

    return res.json({ references: refs, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (error: any) {
    console.error('[references] mine error:', error);
    return res.status(500).json({ error: 'Failed to list your references' });
  }
});

export default router;
