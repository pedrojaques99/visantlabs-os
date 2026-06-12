import { Router, type Response as ExpressResponse, type NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../utils/jwtSecret.js';
import type { AuthRequest } from '../middleware/auth.js';
import {
  trace as tracePipeline,
  traceImage,
  cleanSvgPipeline,
  optimizeSvg,
  sanitizeSvg,
  parseBase64Image,
  TRACE_PRESETS,
} from '@visant/logo-trace';

const router = Router();

const traceLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { error: 'Too many trace requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function optionalAuth(req: AuthRequest, _res: ExpressResponse, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string };
      if (decoded.userId) req.userId = decoded.userId;
    } catch {
      /* ignore invalid tokens */
    }
  }
  next();
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/**
 * POST /api/trace/png-to-svg
 * Full pipeline: PNG → potrace → sanitize → optimize → clean SVG.
 */
router.post(
  '/png-to-svg',
  traceLimiter,
  optionalAuth,
  async (req: AuthRequest, res: ExpressResponse) => {
    try {
      const { image, turdSize, optTolerance, threshold, alphaMax, color, preset } = req.body;

      if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'Missing image (base64 data URL)' });
      }

      const buffer = parseBase64Image(image);
      if (!buffer) {
        return res.status(400).json({ error: 'Invalid base64 image format' });
      }

      const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
      if (buffer.length > MAX_IMAGE_SIZE) {
        return res.status(413).json({ error: 'Image too large (max 10MB)' });
      }

      const svg = await tracePipeline(buffer, {
        turdSize,
        optTolerance,
        threshold,
        alphaMax,
        color,
        preset,
      });

      res.json({ svg });
    } catch (error: unknown) {
      console.error('PNG→SVG trace error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  }
);

/**
 * POST /api/trace/optimize
 * Sanitize + optimize raw SVG (e.g. pasted from Figma, Illustrator, etc.)
 */
router.post(
  '/optimize',
  traceLimiter,
  optionalAuth,
  async (req: AuthRequest, res: ExpressResponse) => {
    try {
      const { svg: rawSvg } = req.body;

      if (!rawSvg || typeof rawSvg !== 'string') {
        return res.status(400).json({ error: 'Missing svg string' });
      }

      if (!rawSvg.includes('<svg')) {
        return res.status(400).json({ error: 'Invalid SVG: missing <svg> element' });
      }

      const svg = await cleanSvgPipeline(rawSvg);

      res.json({ svg });
    } catch (error: unknown) {
      console.error('SVG optimize error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      res.status(500).json({ error: message });
    }
  }
);

router.get('/presets', (_req, res: ExpressResponse) => {
  res.json({ presets: TRACE_PRESETS });
});

export {
  traceImage,
  tracePipeline,
  cleanSvgPipeline,
  optimizeSvg,
  sanitizeSvg,
  parseBase64Image,
  TRACE_PRESETS,
};
export default router;
