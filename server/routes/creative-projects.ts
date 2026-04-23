import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../db/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { redisClient } from '../lib/redis.js';
import { CacheKey, CACHE_TTL, CacheInvalidation } from '../lib/cache-utils.js';

/**
 * Creative Projects — CRUD for persisted Creative Studio documents.
 *
 * DESIGN: mirrors the CanvasProject pattern to keep consistency across
 * the codebase. Kept in a separate router (not mixed with /creative AI
 * endpoints) because concerns are different: this is document CRUD,
 * /creative is AI generation + observability.
 *
 * Mounted at /api/creative-projects
 */

const router = Router();

const apiRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

interface CreativeProjectPayload {
  name?: string;
  prompt: string;
  format: string;
  brandId?: string | null;
  backgroundUrl?: string | null;
  overlay?: unknown;
  layers: unknown;
  thumbnailUrl?: string | null;
}

function mapId<T extends { id: string }>(p: T): T & { _id: string } {
  return { ...p, _id: p.id };
}

// List — grid endpoint
router.get('/', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    // 🟢 CACHE CHECK
    const cacheKey = CacheKey.projectList(req.userId);
    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) {
      console.log(`[Cache] HIT projects:list:${req.userId.slice(0, 8)}`);
      return res.json({ ...JSON.parse(cached), fromCache: true });
    }

    const brandId = typeof req.query.brandId === 'string' ? req.query.brandId : undefined;
    const limit = Math.min(Number(req.query.limit) || 60, 200);

    const projects = await prisma.creativeProject.findMany({
      where: { userId: req.userId, ...(brandId ? { brandId } : {}) },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      // Lightweight list payload — omit heavy `layers` JSON from grid response
      select: {
        id: true,
        name: true,
        prompt: true,
        format: true,
        brandId: true,
        backgroundUrl: true,
        thumbnailUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const result = { projects: projects.map((p) => ({ ...p, _id: p.id })) };

    // 💾 CACHE SET
    await redisClient.setex(cacheKey, CACHE_TTL.CREATIVE_PROJECTS, JSON.stringify(result)).catch(() => {});

    res.json(result);
  } catch (err: any) {
    console.error('[creative-projects GET /] error:', err);
    res.status(500).json({ error: 'Failed to list creative projects' });
  }
});

// Get one — full payload for editor reload
router.get('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    // 🟢 CACHE CHECK
    const cacheKey = CacheKey.projectDetail(req.userId, req.params.id);
    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) {
      console.log(`[Cache] HIT projects:${req.userId.slice(0, 8)}:${req.params.id.slice(0, 8)}`);
      return res.json({ ...JSON.parse(cached), fromCache: true });
    }

    const project = await prisma.creativeProject.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!project) return res.status(404).json({ error: 'Not found' });

    const result = { project: mapId(project) };

    // 💾 CACHE SET
    await redisClient.setex(cacheKey, CACHE_TTL.CREATIVE_PROJECTS, JSON.stringify(result)).catch(() => {});

    res.json(result);
  } catch (err: any) {
    console.error('[creative-projects GET /:id] error:', err);
    res.status(500).json({ error: 'Failed to fetch creative project' });
  }
});

// Create
router.post('/', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const body = req.body as CreativeProjectPayload;
    if (!body?.prompt || !body?.format || body.layers === undefined) {
      return res.status(400).json({ error: 'prompt, format and layers are required' });
    }

    const project = await prisma.creativeProject.create({
      data: {
        userId: req.userId,
        name: body.name || 'Untitled Creative',
        prompt: body.prompt,
        format: body.format,
        brandId: body.brandId || null,
        backgroundUrl: body.backgroundUrl || null,
        overlay: (body.overlay ?? null) as any,
        layers: body.layers as any,
        thumbnailUrl: body.thumbnailUrl || null,
      },
    });

    // 🗑️ INVALIDATE user list cache
    const invalidationKeys = CacheInvalidation.onProjectMutation(req.userId);
    for (const pattern of invalidationKeys) {
      await redisClient.del(pattern).catch(() => {});
    }

    res.status(201).json({ project: mapId(project) });
  } catch (err: any) {
    console.error('[creative-projects POST /] error:', err);
    res.status(500).json({ error: 'Failed to create creative project' });
  }
});

// Update (partial)
router.put('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const existing = await prisma.creativeProject.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const body = req.body as Partial<CreativeProjectPayload>;
    const project = await prisma.creativeProject.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.prompt !== undefined && { prompt: body.prompt }),
        ...(body.format !== undefined && { format: body.format }),
        ...(body.brandId !== undefined && { brandId: body.brandId || null }),
        ...(body.backgroundUrl !== undefined && { backgroundUrl: body.backgroundUrl || null }),
        ...(body.overlay !== undefined && { overlay: (body.overlay ?? null) as any }),
        ...(body.layers !== undefined && { layers: body.layers as any }),
        ...(body.thumbnailUrl !== undefined && { thumbnailUrl: body.thumbnailUrl || null }),
      },
    });

    // 🗑️ INVALIDATE user list and detail cache
    const invalidationKeys = CacheInvalidation.onProjectMutation(req.userId, req.params.id);
    for (const pattern of invalidationKeys) {
      await redisClient.del(pattern).catch(() => {});
    }

    res.json({ project: mapId(project) });
  } catch (err: any) {
    console.error('[creative-projects PUT /:id] error:', err);
    res.status(500).json({ error: 'Failed to update creative project' });
  }
});

// Delete
router.delete('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const existing = await prisma.creativeProject.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await prisma.creativeProject.delete({ where: { id: existing.id } });

    // 🗑️ INVALIDATE user list and detail cache
    const invalidationKeys = CacheInvalidation.onProjectMutation(req.userId, req.params.id);
    for (const pattern of invalidationKeys) {
      await redisClient.del(pattern).catch(() => {});
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[creative-projects DELETE /:id] error:', err);
    res.status(500).json({ error: 'Failed to delete creative project' });
  }
});

export default router;
