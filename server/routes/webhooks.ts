import { Router, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../db/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

const VALID_EVENTS = ['generation.complete', 'credits.depleted', 'brand.updated'];
const MAX_WEBHOOKS_PER_USER = 5;

// POST / — Register a new webhook
router.post('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { url, events } = req.body;

    // Validate url
    if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
      return res.status(400).json({ error: 'url must be a valid HTTPS URL' });
    }

    // Validate events
    if (!Array.isArray(events) || events.length === 0) {
      return res.status(400).json({ error: 'events must be a non-empty array' });
    }
    for (const event of events) {
      if (!VALID_EVENTS.includes(event)) {
        return res.status(400).json({
          error: `Invalid event: ${event}. Valid events: ${VALID_EVENTS.join(', ')}`,
        });
      }
    }

    // Enforce max webhooks per user
    const existingCount = await prisma.webhook.count({ where: { userId } });
    if (existingCount >= MAX_WEBHOOKS_PER_USER) {
      return res.status(400).json({
        error: `Maximum of ${MAX_WEBHOOKS_PER_USER} webhooks allowed per user`,
      });
    }

    // Generate HMAC-SHA256 signing secret
    const secret = crypto.randomBytes(32).toString('hex');

    const webhook = await prisma.webhook.create({
      data: { userId, url, events, secret },
    });

    return res.status(201).json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      secret: webhook.secret, // Only returned on creation
      active: webhook.active,
      createdAt: webhook.createdAt,
    });
  } catch (error: any) {
    console.error('Error creating webhook:', error);
    return res.status(500).json({ error: 'Failed to create webhook' });
  }
});

// GET / — List user's webhooks (without secret)
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const webhooks = await prisma.webhook.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Omit secret from list response
    const result = webhooks.map(({ secret: _secret, ...rest }) => rest);

    return res.json(result);
  } catch (error: any) {
    console.error('Error listing webhooks:', error);
    return res.status(500).json({ error: 'Failed to list webhooks' });
  }
});

// DELETE /:id — Remove a webhook (ownership enforced via userId)
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    await prisma.webhook.deleteMany({ where: { id, userId } });

    return res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting webhook:', error);
    return res.status(500).json({ error: 'Failed to delete webhook' });
  }
});

export default router;
