/**
 * Lightweight product-analytics ingestion (Fase 3 §3.3).
 *
 * POST /api/analytics/events — the frontend reports funnel events here
 * (onboarding_step from the wizard, brand_ingested fallbacks). Mirrors the
 * POST /api/canvas/events pattern: optional JWT (sendBeacon can't send auth
 * headers), batched payload, writes into the existing `canvas_events`
 * collection — NOT a new analytics system.
 */

import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { isFunnelEvent, ensureEventIndexes } from '../lib/funnelEvents.js';
import { getJwtSecret } from '../utils/jwtSecret.js';

const router = express.Router();

const eventsRateLimiter = rateLimit({
  windowMs: 60_000,
  max: parseInt(process.env.RATE_LIMIT_MAX_API || '60', 10),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/analytics/events — body: { events: [{ event, meta?, ts? }] }
router.post('/events', eventsRateLimiter, async (req, res) => {
  try {
    const { events } = req.body;
    if (!Array.isArray(events) || events.length === 0 || events.length > 20) {
      return res.status(400).json({ error: 'Invalid events payload' });
    }

    // Allowlist — this endpoint only accepts funnel events (§3.3).
    if (!events.every((e: any) => isFunnelEvent(e?.event))) {
      return res.status(400).json({ error: 'Unknown event name' });
    }

    // Auth is optional (sendBeacon), but we honor a Bearer token when present.
    let userId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = await import('jsonwebtoken');
        const decoded = jwt.default.verify(authHeader.slice(7), getJwtSecret()) as any;
        userId = decoded.userId;
      } catch {
        /* invalid token → anonymous event */
      }
    }

    await connectToMongoDB();
    const db = getDb();
    await ensureEventIndexes(db);
    const docs = events.map((e: any) => ({
      event: String(e.event).slice(0, 50),
      meta: e.meta && typeof e.meta === 'object' ? e.meta : undefined,
      userId,
      clientTs: typeof e.ts === 'number' ? new Date(e.ts) : undefined,
      serverTs: new Date(),
    }));
    await db.collection('canvas_events').insertMany(docs, { ordered: false });

    res.status(204).end();
  } catch (error: any) {
    console.error('[Analytics] Error storing events:', error?.message);
    res.status(500).json({ error: 'Failed to store events' });
  }
});

export default router;
