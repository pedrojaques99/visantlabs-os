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

import { randomUUID } from 'crypto';
import express, { type Request, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { chargeCredits } from '../lib/credits.js';
import { regionForCountry, normalizeCountry } from '../../src/lib/references/taxonomy.js';
import {
  REFERENCE_DIMENSION_KEYS,
  FACET_DIMENSION_KEYS,
} from '../../src/constants/referenceDimensions.js';

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
  thumbHash: 1,
  dimensions: 1,
  provenance: 1,
  country: 1,
  region: 1,
  sourceUrl: 1,
  tags: 1,
  createdAt: 1,
} as const;

const DIMENSION_KEYS = REFERENCE_DIMENSION_KEYS;

/** Build a Mongo filter for the public library from query params. */
function buildLibraryFilter(query: Request['query']): Record<string, any> {
  // Visible in the public library: admin-curated OR explicitly public + approved,
  // and never flagged hiddenFromPublic (third-party studio mockups live admin-only).
  const filter: Record<string, any> = {
    category: 'reference',
    hiddenFromPublic: { $ne: true },
    $and: [{ $or: [{ isAdminCurated: true }, { isPublic: true, isApproved: true }] }],
  };

  // Coarse kind filter for the page toggle: branding (has a brand_artifact) vs mockup.
  if (query.kind === 'branding') filter['dimensions.brand_artifact.0'] = { $exists: true };
  else if (query.kind === 'mockup') filter['dimensions.mockup_type.0'] = { $exists: true };

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
router.post('/upload', ingestRateLimiter, authenticate, async (req: AuthRequest, res: Response) => {
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
});

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
      hiddenFromPublic: { $ne: true },
      $or: [{ isAdminCurated: true }, { isPublic: true, isApproved: true }],
    };

    // Structured dimension facets — designer-friendly filter groups (additive to the tag cloud)
    const facetStages: Record<string, any[]> = {};
    for (const k of FACET_DIMENSION_KEYS) {
      facetStages[k] = [
        { $unwind: { path: `$dimensions.${k}`, preserveNullAndEmptyArrays: false } },
        { $group: { _id: `$dimensions.${k}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 14 },
      ];
    }

    const [countries, regions, tagAgg, dimAgg] = await Promise.all([
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
      db
        .collection('community_presets')
        .aggregate([{ $match: base }, { $facet: facetStages }])
        .toArray(),
    ]);

    const dimensions: Record<string, Array<{ value: string; count: number }>> = {};
    const dimResult = (dimAgg[0] || {}) as Record<string, Array<{ _id: string; count: number }>>;
    for (const k of FACET_DIMENSION_KEYS) {
      const vals = (dimResult[k] || []).filter((v) => v._id);
      if (vals.length) dimensions[k] = vals.map((v) => ({ value: v._id, count: v.count }));
    }

    return res.json({
      countries: (countries as string[]).filter(Boolean).sort(),
      regions: (regions as string[]).filter(Boolean).sort(),
      tags: tagAgg.map((t: any) => ({ value: t._id, count: t.count })),
      dimensions,
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
        .find({ id: { $in: ids }, category: 'reference', hiddenFromPublic: { $ne: true } })
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
        hiddenFromPublic: { $ne: true },
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

// ─────────────────────────────────────────────────────────────────────────────
// Collections — per-user Are.na-like boards of references
// ─────────────────────────────────────────────────────────────────────────────

const COLLECTION_PROJECTION = {
  _id: 0,
  id: 1,
  name: 1,
  refIds: 1,
  coverUrl: 1,
  isPublic: 1,
  createdAt: 1,
  updatedAt: 1,
} as const;

const isSafeRefId = (id: unknown): id is string =>
  typeof id === 'string' && /^[a-zA-Z0-9_-]{6,64}$/.test(id);

// GET /collections — the authenticated user's boards (with item counts)
router.get('/collections', apiRateLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    await connectToMongoDB();
    const db = getDb();
    const cols = await db
      .collection('reference_collections')
      .find({ userId: String(userId) })
      .sort({ updatedAt: -1 })
      .project(COLLECTION_PROJECTION)
      .toArray();

    // Mosaic covers — first up to 4 thumbnails per board (one batched lookup).
    const firstIds = [...new Set(cols.flatMap((c: any) => (c.refIds || []).slice(0, 4)))];
    const thumbs = firstIds.length
      ? await db
          .collection('community_presets')
          .find({ id: { $in: firstIds } })
          .project({ _id: 0, id: 1, thumbnailUrl: 1, referenceImageUrl: 1 })
          .toArray()
      : [];
    const thumbById = new Map(
      thumbs.map((t: any) => [t.id, t.thumbnailUrl || t.referenceImageUrl])
    );

    return res.json({
      collections: cols.map((c: any) => ({
        ...c,
        count: (c.refIds || []).length,
        covers: (c.refIds || [])
          .slice(0, 4)
          .map((id: string) => thumbById.get(id))
          .filter(Boolean),
      })),
    });
  } catch (error: any) {
    console.error('[references] collections list error:', error);
    return res.status(500).json({ error: 'Failed to list collections' });
  }
});

// POST /collections — create a board
router.post('/collections', ingestRateLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    const name = typeof req.body.name === 'string' ? req.body.name.trim().slice(0, 120) : '';
    if (!name) return res.status(400).json({ error: 'name is required' });

    await connectToMongoDB();
    const db = getDb();
    const now = new Date();
    const doc = {
      id: randomUUID(),
      userId: String(userId),
      name,
      refIds: [] as string[],
      coverUrl: '',
      isPublic: req.body.isPublic === true,
      createdAt: now,
      updatedAt: now,
    };
    await db.collection('reference_collections').insertOne(doc);
    const { _id, userId: _u, ...pub } = doc as any;
    return res.json({ collection: { ...pub, count: 0 } });
  } catch (error: any) {
    console.error('[references] collection create error:', error);
    return res.status(500).json({ error: 'Failed to create collection' });
  }
});

// GET /collections/taste — infer the user's taste from saved items (semantic suggestion)
router.get('/collections/taste', apiRateLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    await connectToMongoDB();
    const db = getDb();
    const cols = await db
      .collection('reference_collections')
      .find({ userId: String(userId) })
      .project({ refIds: 1 })
      .toArray();
    const refIds = [...new Set(cols.flatMap((c: any) => c.refIds || []))];
    if (!refIds.length) return res.json({ taste: [] });

    const KEYS = ['type_style', 'aesthetic', 'vibe', 'brand_artifact'];
    const facetStages: Record<string, any[]> = {};
    for (const k of KEYS)
      facetStages[k] = [
        { $unwind: { path: `$dimensions.${k}`, preserveNullAndEmptyArrays: false } },
        { $group: { _id: `$dimensions.${k}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ];
    const [agg] = await db
      .collection('community_presets')
      .aggregate([{ $match: { id: { $in: refIds }, category: 'reference' } }, { $facet: facetStages }])
      .toArray();

    const taste: Array<{ key: string; value: string; count: number }> = [];
    for (const k of KEYS) {
      const top = ((agg as any)?.[k] || [])[0];
      if (top?._id) taste.push({ key: k, value: top._id, count: top.count });
    }
    taste.sort((a, b) => b.count - a.count);
    return res.json({ taste: taste.slice(0, 3) });
  } catch (error: any) {
    console.error('[references] taste error:', error);
    return res.status(500).json({ error: 'Failed to infer taste' });
  }
});

// GET /collections/:id — board detail + hydrated reference items (owner, or public)
router.get('/collections/:id', apiRateLimiter, async (req: AuthRequest, res: Response) => {
  try {
    if (!isSafeRefId(req.params.id)) return res.status(400).json({ error: 'Invalid collection id' });
    await connectToMongoDB();
    const db = getDb();
    const col = await db.collection('reference_collections').findOne({ id: req.params.id });
    if (!col) return res.status(404).json({ error: 'Collection not found' });
    if (!col.isPublic && String(col.userId) !== String(req.userId || '')) {
      return res.status(403).json({ error: 'This collection is private' });
    }
    const refIds: string[] = col.refIds || [];
    const docs = refIds.length
      ? await db
          .collection('community_presets')
          .find({ id: { $in: refIds }, category: 'reference' })
          .project(PUBLIC_PROJECTION)
          .toArray()
      : [];
    // preserve insertion order
    const byId = new Map(docs.map((d: any) => [d.id, d]));
    const items = refIds.map((id) => byId.get(id)).filter(Boolean);
    return res.json({
      collection: {
        id: col.id,
        name: col.name,
        isPublic: !!col.isPublic,
        count: items.length,
        isOwner: String(col.userId) === String(req.userId || ''),
        createdAt: col.createdAt,
      },
      items,
    });
  } catch (error: any) {
    console.error('[references] collection detail error:', error);
    return res.status(500).json({ error: 'Failed to load collection' });
  }
});

// PATCH /collections/:id — rename / toggle public
router.patch('/collections/:id', ingestRateLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (!isSafeRefId(req.params.id)) return res.status(400).json({ error: 'Invalid collection id' });
    await connectToMongoDB();
    const db = getDb();
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (typeof req.body.name === 'string' && req.body.name.trim())
      updates.name = req.body.name.trim().slice(0, 120);
    if (typeof req.body.isPublic === 'boolean') updates.isPublic = req.body.isPublic;
    const result = await db
      .collection('reference_collections')
      .updateOne({ id: req.params.id, userId: String(userId) }, { $set: updates });
    if (!result.matchedCount) return res.status(404).json({ error: 'Collection not found' });
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[references] collection update error:', error);
    return res.status(500).json({ error: 'Failed to update collection' });
  }
});

// DELETE /collections/:id
router.delete('/collections/:id', ingestRateLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (!isSafeRefId(req.params.id)) return res.status(400).json({ error: 'Invalid collection id' });
    await connectToMongoDB();
    const db = getDb();
    const result = await db
      .collection('reference_collections')
      .deleteOne({ id: req.params.id, userId: String(userId) });
    if (!result.deletedCount) return res.status(404).json({ error: 'Collection not found' });
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[references] collection delete error:', error);
    return res.status(500).json({ error: 'Failed to delete collection' });
  }
});

// POST /collections/:id/items — add a reference (sets cover if first)
router.post('/collections/:id/items', ingestRateLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (!isSafeRefId(req.params.id)) return res.status(400).json({ error: 'Invalid collection id' });
    const refId = req.body.refId;
    if (!isSafeRefId(refId)) return res.status(400).json({ error: 'Valid refId is required' });

    await connectToMongoDB();
    const db = getDb();
    const col = await db
      .collection('reference_collections')
      .findOne({ id: req.params.id, userId: String(userId) });
    if (!col) return res.status(404).json({ error: 'Collection not found' });

    const ref = await db
      .collection('community_presets')
      .findOne({ id: refId, category: 'reference' }, { projection: { thumbnailUrl: 1, referenceImageUrl: 1 } });
    if (!ref) return res.status(404).json({ error: 'Reference not found' });

    const updates: Record<string, any> = { updatedAt: new Date() };
    if (!col.coverUrl) updates.coverUrl = ref.thumbnailUrl || ref.referenceImageUrl || '';
    await db
      .collection('reference_collections')
      .updateOne({ id: req.params.id }, { $addToSet: { refIds: refId }, $set: updates });
    return res.json({ success: true });
  } catch (error: any) {
    console.error('[references] collection add item error:', error);
    return res.status(500).json({ error: 'Failed to add to collection' });
  }
});

// DELETE /collections/:id/items/:refId — remove a reference
router.delete(
  '/collections/:id/items/:refId',
  ingestRateLimiter,
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      if (!isSafeRefId(req.params.id) || !isSafeRefId(req.params.refId)) {
        return res.status(400).json({ error: 'Invalid id' });
      }
      await connectToMongoDB();
      const db = getDb();
      const result = await db
        .collection('reference_collections')
        .updateOne({ id: req.params.id, userId: String(userId) }, {
          $pull: { refIds: req.params.refId },
          $set: { updatedAt: new Date() },
        } as any);
      if (!result.matchedCount) return res.status(404).json({ error: 'Collection not found' });
      return res.json({ success: true });
    } catch (error: any) {
      console.error('[references] collection remove item error:', error);
      return res.status(500).json({ error: 'Failed to remove from collection' });
    }
  }
);

export default router;
