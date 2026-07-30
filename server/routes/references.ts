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
import { authenticate, optionalAuthenticate, type AuthRequest } from '../middleware/auth.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import {
  countUserReferences,
  referenceUploadLimit,
  referenceLimitPayload,
} from '../lib/references/quota.js';
import { regionForCountry, normalizeCountry } from '../../src/lib/references/taxonomy.js';
import {
  REFERENCE_DIMENSION_KEYS,
  FACET_DIMENSION_KEYS,
} from '../../src/constants/referenceDimensions.js';
import {
  PUBLIC_PROJECTION,
  searchReferences,
  hydrateVectorMatches,
  visibilityFilter,
  BROWSABLE,
  type ReferenceFilterParams,
} from '../lib/references/engine.js';

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

/**
 * Ingest is 3 AI calls + 2 uploads per image, and used to run one image at a
 * time — a 10-image batch meant ~30 serial AI round-trips inside one HTTP
 * request, which is how you meet a proxy timeout. Bounded rather than unbounded
 * so a full batch can't fan 30 calls at Gemini at once and get rate-limited.
 */
const INGEST_CONCURRENCY = 3;

/**
 * Promise.allSettled with a concurrency ceiling, preserving input order.
 * (No p-limit/p-queue in the dep tree, and this is the only caller.)
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;

  const worker = async () => {
    while (cursor < items.length) {
      const i = cursor++;
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i], i) };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

/** Map the HTTP query string onto the engine's typed filter params. */
function filterParamsFromQuery(query: Request['query']): ReferenceFilterParams {
  const dimensions: Record<string, string | undefined> = {};
  for (const key of REFERENCE_DIMENSION_KEYS) {
    const val = query[key];
    if (typeof val === 'string') dimensions[key] = val;
  }
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  return {
    visibility: 'public',
    search: str(query.search),
    kind: query.kind === 'branding' || query.kind === 'mockup' ? query.kind : 'all',
    country: str(query.country),
    region: str(query.region),
    tag: str(query.tag),
    // Narrows to refs tagged with this brand. `brandTerms` (ranking) is separate.
    brandGuidelineId: str(query.brandGuidelineId),
    // TEMPORÁRIO — inspeção de procedência. Ver ReferenceFilterParams.
    sourcePrefix: str(query.sourcePrefix),
    color: str(query.color),
    dimensions,
  };
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
    const { ingestReferenceLight } = await import('../lib/mockup/referenceIngestor.js');

    const brandGuidelineIds =
      typeof req.body.brandGuidelineId === 'string' ? [req.body.brandGuidelineId] : undefined;

    // Abuse ceiling — no credits. Uploading is free (a reference is INPUT that
    // enriches the library); the guard against mass-upload is a hard per-user cap.
    await connectToMongoDB();
    const db = getDb();
    const max = referenceUploadLimit();
    const owned = await countUserReferences(db, String(userId));
    if (owned + images.length > max) {
      return res.status(402).json(referenceLimitPayload(owned, max));
    }

    // Cheap phase only: store + hash + facts, status 'pending'. NO AI runs here —
    // enrichment is deferred to admin approval (POST /admin/references/:id/approve).
    const settled = await mapWithConcurrency(images, INGEST_CONCURRENCY, async (img) => {
      const base64 = typeof img === 'string' ? img : img.data;
      if (!base64) throw new Error('Missing image data');

      const presetId = `userref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const imageUrl = await r2Service.uploadMockupPresetReference(base64, presetId);

      return ingestReferenceLight({
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
        brandGuidelineIds,
        // User uploads await moderation; public only if they also opt in.
        isAdminCurated: false,
        isPublic: img.isPublic === true,
      });
    });

    const results: any[] = [];
    const errors: any[] = [];
    settled.forEach((outcome, i) => {
      if (outcome.status === 'fulfilled') results.push(outcome.value);
      else
        errors.push({ name: images[i]?.name, error: outcome.reason?.message || 'Ingest failed' });
    });

    const deduped = results.filter((r) => r.deduped).length;

    return res.json({
      success: true,
      // Uploaded and awaiting review — nothing is public or AI-analysed yet.
      ingested: results.length,
      deduped,
      pending: results.length - deduped,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error('[references] upload error:', error);
    return res.status(500).json({ error: 'Failed to ingest references', details: error.message });
  }
});

// ── GET / — public browse (intelligent feed) ─────────────────────────────────
// Without `seed`: legacy deterministic newest-first (back-compat). With `seed`:
// a blended ranking (session freshness + recency + brand affinity + user taste),
// so the feed is fresh per visit and personalized to the active brand. Auth is
// optional — a logged-in user contributes taste + novelty signals.
router.get('/', apiRateLimiter, optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    await connectToMongoDB();
    const db = getDb();

    const result = await searchReferences(db, {
      ...filterParamsFromQuery(req.query),
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 30,
      seed: typeof req.query.seed === 'string' ? req.query.seed : undefined,
      brandTerms: typeof req.query.brandTerms === 'string' ? req.query.brandTerms : undefined,
      viewerId: req.userId,
      // Rank by meaning when asked and there's a query (else lexical/ranked feed).
      semantic: req.query.semantic === '1' || req.query.semantic === 'true',
    });
    return res.json(result);
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
    // BROWSABLE here too: the facet COUNTS have to agree with the grid, or a
    // filter advertises results the feed will not show (the PSD catalogue).
    const base = { category: 'reference', ...BROWSABLE, ...visibilityFilter('public') };

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

      // Hydrate from Mongo so the UI gets full, public-safe records
      await connectToMongoDB();
      const ordered = await hydrateVectorMatches(getDb(), matches, { visibility: 'public' });
      return res.json({ references: ordered, total: ordered.length });
    } catch (error: any) {
      console.error('[references] search-by-image error:', error);
      return res.status(500).json({ error: 'Visual search failed', details: error.message });
    }
  }
);

// ── GET /item/:handle — one reference by slug OR id (the permalink) ─────────
// Sob /item/ de proposito: a raiz ja tem /facets, /mine, /collections, e um
// /:handle solto na raiz engoliria qualquer rota nova que viesse depois.
router.get('/item/:handle', apiRateLimiter, async (req: Request, res: Response) => {
  try {
    const handle = req.params.handle;
    if (typeof handle !== 'string' || handle.length < 3 || handle.length > 80) {
      return res.status(400).json({ error: 'Invalid reference handle' });
    }
    await connectToMongoDB();
    const db = getDb();
    // Aceita slug OU id: links antigos (por id) continuam resolvendo.
    const reference = await db.collection('community_presets').findOne(
      {
        category: 'reference',
        ...BROWSABLE,
        ...visibilityFilter('public'),
        $and: [{ $or: [{ slug: handle }, { id: handle }] }],
      },
      { projection: PUBLIC_PROJECTION as Record<string, 0 | 1> }
    );
    if (!reference) return res.status(404).json({ error: 'Reference not found' });
    return res.json({ reference });
  } catch (error: any) {
    console.error('[references] item error:', error);
    return res.status(500).json({ error: 'Failed to load reference' });
  }
});

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

    await connectToMongoDB();
    const ordered = await hydrateVectorMatches(getDb(), matches, {
      visibility: 'public',
      excludeId: id,
      limit,
    });
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
        // The uploader sees their own moderation state (pending/approved/rejected).
        .project({ ...PUBLIC_PROJECTION, isPublic: 1, status: 1, enriched: 1 })
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
router.get(
  '/collections',
  apiRateLimiter,
  authenticate,
  async (req: AuthRequest, res: Response) => {
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
  }
);

// POST /collections — create a board
router.post(
  '/collections',
  ingestRateLimiter,
  authenticate,
  async (req: AuthRequest, res: Response) => {
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
  }
);

// GET /collections/taste — infer the user's taste from saved items (semantic suggestion)
router.get(
  '/collections/taste',
  apiRateLimiter,
  authenticate,
  async (req: AuthRequest, res: Response) => {
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
        .aggregate([
          { $match: { id: { $in: refIds }, category: 'reference' } },
          { $facet: facetStages },
        ])
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
  }
);

// GET /collections/:id — board detail + hydrated reference items (owner, or public)
// optionalAuthenticate resolves req.userId when a token is present so the owner can
// read their own (private-by-default) board; anonymous requests still see public boards.
router.get(
  '/collections/:id',
  apiRateLimiter,
  optionalAuthenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      if (!isSafeRefId(req.params.id))
        return res.status(400).json({ error: 'Invalid collection id' });
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
  }
);

// PATCH /collections/:id — rename / toggle public
router.patch(
  '/collections/:id',
  ingestRateLimiter,
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      if (!isSafeRefId(req.params.id))
        return res.status(400).json({ error: 'Invalid collection id' });
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
  }
);

// DELETE /collections/:id
router.delete(
  '/collections/:id',
  ingestRateLimiter,
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      if (!isSafeRefId(req.params.id))
        return res.status(400).json({ error: 'Invalid collection id' });
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
  }
);

// POST /collections/:id/items — add a reference (sets cover if first)
router.post(
  '/collections/:id/items',
  ingestRateLimiter,
  authenticate,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.userId;
      if (!userId) return res.status(401).json({ error: 'Authentication required' });
      if (!isSafeRefId(req.params.id))
        return res.status(400).json({ error: 'Invalid collection id' });
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
        .findOne(
          { id: refId, category: 'reference' },
          { projection: { thumbnailUrl: 1, referenceImageUrl: 1 } }
        );
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
  }
);

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
