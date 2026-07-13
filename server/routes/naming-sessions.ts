import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../db/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';

/**
 * Naming Sessions — CRUD for persisted, per-user Naming Machine sessions.
 *
 * DESIGN: mirrors campaigns-crud.ts. The naming GENERATION endpoints live in
 * routes/ai.ts (/ai/generate-naming, /ai/naming-insight, ...). This router is
 * pure document CRUD over durable NamingSession records, so the app can list
 * "sessões anteriores", reopen, rename and delete them across devices —
 * replacing the old localStorage-only single session.
 *
 * Mounted at /api/naming-sessions
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

/** Campos escalares "promovidos" que a lista mostra sem carregar o blob `data`. */
type SessionScalars = {
  name?: string;
  brief?: string | null;
  phase?: string;
  brandGuidelineId?: string | null;
  likedCount?: number;
  seenCount?: number;
};

function sanitizeScalars(body: SessionScalars) {
  return {
    ...(typeof body.name === 'string' ? { name: body.name.trim().slice(0, 120) } : {}),
    ...(body.brief !== undefined
      ? { brief: typeof body.brief === 'string' ? body.brief.slice(0, 500) : null }
      : {}),
    ...(body.phase === 'briefing' || body.phase === 'deck' ? { phase: body.phase } : {}),
    ...(body.brandGuidelineId !== undefined ? { brandGuidelineId: body.brandGuidelineId } : {}),
    ...(Number.isFinite(body.likedCount) ? { likedCount: Number(body.likedCount) } : {}),
    ...(Number.isFinite(body.seenCount) ? { seenCount: Number(body.seenCount) } : {}),
  };
}

// List — "sessões anteriores". Drops the heavy `data` blob; preview scalars only.
router.get('/', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const sessions = await prisma.namingSession.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        brief: true,
        phase: true,
        brandGuidelineId: true,
        likedCount: true,
        seenCount: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json({ sessions: sessions.map(mapId) });
  } catch (err) {
    console.error('[naming-sessions GET /] error:', err);
    res.status(500).json({ error: 'Failed to list naming sessions' });
  }
});

// Get one — includes the full `data` blob to restore the session.
router.get('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const session = await prisma.namingSession.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!session) return res.status(404).json({ error: 'Not found' });

    res.json({ session: mapId(session) });
  } catch (err) {
    console.error('[naming-sessions GET /:id] error:', err);
    res.status(500).json({ error: 'Failed to load naming session' });
  }
});

// Create — persists a new session and returns it (with id for subsequent saves).
router.post('/', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const { data, ...scalars } = req.body as SessionScalars & { data?: unknown };
    if (data === undefined || data === null) {
      return res.status(400).json({ error: 'Missing session data' });
    }

    const session = await prisma.namingSession.create({
      data: {
        userId: req.userId,
        data: data as object,
        ...sanitizeScalars(scalars),
      },
    });

    res.json({ session: mapId(session) });
  } catch (err) {
    console.error('[naming-sessions POST /] error:', err);
    res.status(500).json({ error: 'Failed to create naming session' });
  }
});

// Update — the debounced autosave (blob + promoted scalars). Ownership-scoped.
router.put('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const existing = await prisma.namingSession.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    const { data, ...scalars } = req.body as SessionScalars & { data?: unknown };

    const session = await prisma.namingSession.update({
      where: { id: req.params.id },
      data: {
        ...(data !== undefined && data !== null ? { data: data as object } : {}),
        ...sanitizeScalars(scalars),
      },
    });

    res.json({ session: mapId(session) });
  } catch (err) {
    console.error('[naming-sessions PUT /:id] error:', err);
    res.status(500).json({ error: 'Failed to update naming session' });
  }
});

// Delete.
router.delete('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const existing = await prisma.namingSession.findFirst({
      where: { id: req.params.id, userId: req.userId },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ error: 'Not found' });

    await prisma.namingSession.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('[naming-sessions DELETE /:id] error:', err);
    res.status(500).json({ error: 'Failed to delete naming session' });
  }
});

export default router;
