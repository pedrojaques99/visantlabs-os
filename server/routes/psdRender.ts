import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { renderPsdMockup } from '../services/psdRenderService.js';
import { rateLimit } from 'express-rate-limit';

const router = express.Router();

const renderLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  message: { error: 'Too many render requests. Max 5 per minute.' },
});

router.post('/render', authenticate, renderLimiter, async (req: AuthRequest, res) => {
  const { psdUrl, artUrl, smartObject, hideLayers } = req.body;

  if (!psdUrl || !artUrl || !smartObject) {
    return res.status(400).json({
      error: 'Missing required fields: psdUrl, artUrl, smartObject',
    });
  }

  if (typeof psdUrl !== 'string' || typeof artUrl !== 'string' || typeof smartObject !== 'string') {
    return res.status(400).json({ error: 'psdUrl, artUrl, and smartObject must be strings' });
  }

  try {
    new URL(psdUrl);
    new URL(artUrl);
  } catch {
    return res.status(400).json({ error: 'psdUrl and artUrl must be valid URLs' });
  }

  try {
    const result = await renderPsdMockup({
      psdUrl,
      artUrl,
      smartObject,
      hideLayers: Array.isArray(hideLayers) ? hideLayers : [],
      userId: req.userId!,
    });

    res.json({
      success: true,
      data: {
        url: result.url,
        sizeBytes: result.sizeBytes,
        durationMs: result.durationMs,
      },
    });
  } catch (err: any) {
    const status = err.message?.includes('queue is full') ? 429 : 500;
    res.status(status).json({ error: err.message || 'Render failed' });
  }
});

router.get('/status', authenticate, async (_req: AuthRequest, res) => {
  res.json({ available: true, maxConcurrent: 1 });
});

export default router;
