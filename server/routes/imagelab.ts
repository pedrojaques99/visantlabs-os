/**
 * ImageLab API Routes
 *
 * Server-side image processing for halftone, texture, riso, and shader effects.
 * Used by MCP server (via visantFetch) and direct API clients.
 */
import { Router, json } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { imageLabApplyEffect, imageLabApplyShader, imageLabChain, imageLabListPresets } from '../services/imageLab/index.js';
import { removeBackgroundFromImage } from '../services/backgroundRemovalService.js';
import { generativeExpand } from '../services/generativeExpandService.js';

const imagelabBodyParser = json({ limit: '10mb' });

const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_API || '30', 10),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.post('/apply-effect', imagelabBodyParser, apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { imageUrl, mode, preset, settings, format, quality } = req.body;
    if (!imageUrl || !mode) {
      return res.status(400).json({ error: 'imageUrl and mode are required.' });
    }
    const result = await imageLabApplyEffect(
      { imageUrl, mode, preset, settings, format, quality },
      req.userId!,
    );
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes('headless-gl')) {
      return res.status(501).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/apply-shader', imagelabBodyParser, apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { imageUrl, shaderType, settings, format } = req.body;
    if (!imageUrl || !shaderType) {
      return res.status(400).json({ error: 'imageUrl and shaderType are required.' });
    }
    const result = await imageLabApplyShader(
      { imageUrl, shaderType, settings, format },
      req.userId!,
    );
    res.json(result);
  } catch (err: any) {
    if (err.message?.includes('headless-gl')) {
      return res.status(501).json({ error: err.message });
    }
    next(err);
  }
});

router.post('/chain', imagelabBodyParser, apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { imageUrl, effect, shader, effectOpacity, format } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required.' });
    }
    const result = await imageLabChain(
      { imageUrl, effect, shader, effectOpacity, format },
      req.userId!,
    );
    res.json(result);
  } catch (err: any) {
    next(err);
  }
});

router.get('/presets', async (req, res, next) => {
  try {
    const mode = req.query.mode as string;
    if (!mode) {
      return res.status(400).json({ error: 'mode query param required (halftone|texture|riso|shader).' });
    }
    const presets = imageLabListPresets(mode);
    res.json(presets);
  } catch (err: any) {
    next(err);
  }
});

router.post('/generative-expand', imagelabBodyParser, apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { imageUrl, direction, anchor, targetAspectRatio, expandFactor, prompt, resolution, apiKey } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required.' });
    }
    const result = await generativeExpand(
      { imageUrl, direction, anchor, targetAspectRatio, expandFactor, prompt, resolution, apiKey },
      req.userId!,
    );
    res.json(result);
  } catch (err: any) {
    next(err);
  }
});

router.post('/remove-background', imagelabBodyParser, apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { imageUrl, outputFormat } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required.' });
    }
    const result = await removeBackgroundFromImage(
      { imageUrl, outputFormat },
      req.userId!,
    );
    res.json(result);
  } catch (err: any) {
    next(err);
  }
});

export default router;
