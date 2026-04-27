import express from 'express';
import rateLimit from 'express-rate-limit';
import { Liveblocks, WebhookHandler } from '@liveblocks/node';
import { prisma } from '../db/prisma.js';

const router = express.Router();

const webhookLimiter = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false });

const LIVEBLOCKS_SECRET_KEY = process.env.LIVEBLOCKS_SECRET_KEY;
const LIVEBLOCKS_WEBHOOK_SECRET = process.env.LIVEBLOCKS_WEBHOOK_SECRET;

// POST /api/liveblocks/webhook
// Receives storageUpdated events from Liveblocks and persists guideline to MongoDB.
// Body must be raw (express.raw middleware applied in app.ts before this route).
router.post('/webhook', webhookLimiter, async (req, res) => {
  if (!LIVEBLOCKS_SECRET_KEY || !LIVEBLOCKS_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Liveblocks not configured' });
  }

  const webhookHandler = new WebhookHandler(LIVEBLOCKS_WEBHOOK_SECRET);

  let event;
  try {
    event = webhookHandler.verifyRequest({
      headers: req.headers as Record<string, string>,
      rawBody: req.body.toString(),
    });
  } catch {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  if (event.type !== 'storageUpdated') {
    return res.status(200).json({ ok: true });
  }

  const roomId: string = event.data.roomId;
  if (!roomId.startsWith('brand-')) {
    return res.status(200).json({ ok: true });
  }

  const guidelineId = roomId.replace('brand-', '');

  try {
    const liveblocks = new Liveblocks({ secret: LIVEBLOCKS_SECRET_KEY });
    const { data: storage } = await liveblocks.getStorageDocument(roomId, 'json') as any;
    const guideline = storage?.guideline;

    if (!guideline || typeof guideline !== 'object') {
      return res.status(200).json({ ok: true });
    }

    // Strip Liveblocks internal fields and persist clean data
    const { id: _id, userId: _userId, ...patch } = guideline as any;

    await prisma.brandGuideline.update({
      where: { id: guidelineId },
      data: { ...patch, updatedAt: new Date() },
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[liveblocks webhook] persist failed:', err);
    return res.status(500).json({ error: 'Persist failed' });
  }
});

export default router;
