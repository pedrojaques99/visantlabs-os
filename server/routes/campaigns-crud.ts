import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../db/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';

/**
 * Campaigns — CRUD for persisted, brand-scoped campaigns.
 *
 * DESIGN: mirrors the creative-projects router. The campaign GENERATION /
 * polling endpoints live in routes/campaign.ts (mounted at
 * /canvas/generate-campaign). This router is pure document CRUD over the
 * durable Campaign records that those jobs persist — so the brand cockpit can
 * list "campaigns for Brand A", reopen them, rename, and delete.
 *
 * Mounted at /api/campaigns
 */

const router = Router();

const apiRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

function mapId<T extends { id: string }>(p: T): T & { _id: string } {
  return { ...p, _id: p.id };
}

// List — grid endpoint. Optional ?brandId= filter scopes to one brand.
router.get('/', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const brandId =
      typeof req.query.brandId === 'string' ? req.query.brandId : undefined;
    const limit = Math.min(Number(req.query.limit) || 60, 200);

    const campaigns = await prisma.campaign.findMany({
      where: { userId: req.userId, ...(brandId ? { brandGuidelineId: brandId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        brandGuidelineId: true,
        brief: true,
        productImageUrl: true,
        formats: true,
        model: true,
        jobId: true,
        status: true,
        totalCount: true,
        completedCount: true,
        results: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Derive a lightweight cover thumbnail (first delivered image) and drop the
    // heavy results payload from the list response — full results come from GET /:id.
    const list = campaigns.map(({ results, ...c }) => {
      const arr = Array.isArray(results) ? (results as Array<{ imageUrl?: string }>) : [];
      const coverImageUrl = arr.find((r) => r?.imageUrl)?.imageUrl ?? null;
      return { ...mapId(c), coverImageUrl };
    });

    res.json({ campaigns: list });
  } catch (err) {
    console.error('[campaigns GET /] error:', err);
    res.status(500).json({ error: 'Failed to list campaigns' });
  }
});

// Get one — includes full results payload.
router.get('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const campaign = await prisma.campaign.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!campaign) return res.status(404).json({ error: 'Not found' });

    res.json({ campaign: mapId(campaign) });
  } catch (err) {
    console.error('[campaigns GET /:id] error:', err);
    res.status(500).json({ error: 'Failed to load campaign' });
  }
});

// List creatives produced under a campaign (CreativeProject.campaignId).
router.get(
  '/:id/creatives',
  apiRateLimiter,
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

      const owns = await prisma.campaign.findFirst({
        where: { id: req.params.id, userId: req.userId },
        select: { id: true },
      });
      if (!owns) return res.status(404).json({ error: 'Not found' });

      const projects = await prisma.creativeProject.findMany({
        where: { userId: req.userId, campaignId: req.params.id },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          prompt: true,
          format: true,
          brandId: true,
          campaignId: true,
          backgroundUrl: true,
          thumbnailUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      res.json({ projects: projects.map(mapId) });
    } catch (err) {
      console.error('[campaigns GET /:id/creatives] error:', err);
      res.status(500).json({ error: 'Failed to list campaign creatives' });
    }
  }
);

// Update — rename / re-link brand.
router.put('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const existing = await prisma.campaign.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { name, brandGuidelineId } = req.body as {
      name?: string;
      brandGuidelineId?: string | null;
    };

    const campaign = await prisma.campaign.update({
      where: { id: req.params.id },
      data: {
        ...(typeof name === 'string' ? { name: name.trim().slice(0, 120) } : {}),
        ...(brandGuidelineId !== undefined ? { brandGuidelineId } : {}),
      },
    });

    res.json({ campaign: mapId(campaign) });
  } catch (err) {
    console.error('[campaigns PUT /:id] error:', err);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// Delete.
router.delete('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const existing = await prisma.campaign.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await prisma.campaign.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[campaigns DELETE /:id] error:', err);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

export default router;
