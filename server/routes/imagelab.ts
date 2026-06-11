/**
 * ImageLab API Routes
 *
 * Server-side image processing for halftone, texture, riso, and shader effects.
 * Used by MCP server (via visantFetch) and direct API clients.
 */
import { Router, json } from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { chargeCredits, refundCreditsWithRetry } from '../lib/credits.js';
import {
  imageLabApplyEffect,
  imageLabApplyShader,
  imageLabChain,
  imageLabListPresets,
} from '../services/imageLab/index.js';
import { removeBackgroundFromImage } from '../services/backgroundRemovalService.js';
import { generativeExpand } from '../services/generativeExpandService.js';
import { inpaint } from '../services/inpaintingService.js';
import { recordToolUsage } from '../utils/toolUsageTracking.js';
import {
  createJob,
  saveJob,
  loadJob,
  runImageLabJob,
  reconcileIfOrphaned,
  IMAGELAB_JOB_TTL_SECONDS,
} from '../lib/imagelabJobs.js';

const imagelabBodyParser = json({ limit: '10mb' });

const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_API || '30', 10),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generativeRateLimiter = rateLimit({
  windowMs: 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX_GENERATIVE || '10', 10),
  message: { error: 'Too many generative requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

router.post(
  '/apply-effect',
  imagelabBodyParser,
  apiRateLimiter,
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const { imageUrl, mode, preset, settings, format, quality } = req.body;
      if (!imageUrl || !mode) {
        return res.status(400).json({ error: 'imageUrl and mode are required.' });
      }
      const result = await imageLabApplyEffect(
        { imageUrl, mode, preset, settings, format, quality },
        req.userId!
      );
      recordToolUsage({
        userId: req.userId!,
        action: 'imagelab.apply-effect',
        meta: { mode, preset, format },
      });
      res.json(result);
    } catch (err: any) {
      if (err.message?.includes('headless-gl')) {
        return res.status(501).json({ error: err.message });
      }
      next(err);
    }
  }
);

router.post(
  '/apply-shader',
  imagelabBodyParser,
  apiRateLimiter,
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const { imageUrl, shaderType, settings, format } = req.body;
      if (!imageUrl || !shaderType) {
        return res.status(400).json({ error: 'imageUrl and shaderType are required.' });
      }
      const result = await imageLabApplyShader(
        { imageUrl, shaderType, settings, format },
        req.userId!
      );
      recordToolUsage({
        userId: req.userId!,
        action: 'imagelab.apply-shader',
        meta: { shaderType, format },
      });
      res.json(result);
    } catch (err: any) {
      if (err.message?.includes('headless-gl')) {
        return res.status(501).json({ error: err.message });
      }
      next(err);
    }
  }
);

router.post(
  '/chain',
  imagelabBodyParser,
  apiRateLimiter,
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const { imageUrl, effect, shader, effectOpacity, format } = req.body;
      if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl is required.' });
      }
      const result = await imageLabChain(
        { imageUrl, effect, shader, effectOpacity, format },
        req.userId!
      );
      recordToolUsage({
        userId: req.userId!,
        action: 'imagelab.chain',
        meta: { effect, shader, format },
      });
      res.json(result);
    } catch (err: any) {
      next(err);
    }
  }
);

// Intentionally public (no auth): presets are static metadata used to populate
// the UI before login. Still throttled with apiRateLimiter to prevent abuse.
router.get('/presets', apiRateLimiter, async (req, res, next) => {
  try {
    const mode = req.query.mode as string;
    if (!mode) {
      return res
        .status(400)
        .json({ error: 'mode query param required (halftone|texture|riso|shader).' });
    }
    const presets = imageLabListPresets(mode);
    res.json(presets);
  } catch (err: any) {
    next(err);
  }
});

router.post(
  '/generative-expand',
  imagelabBodyParser,
  generativeRateLimiter,
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const {
        imageUrl,
        direction,
        anchor,
        targetAspectRatio,
        expandFactor,
        prompt,
        resolution,
        apiKey,
        async: asyncMode,
      } = req.body;
      if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl is required.' });
      }
      const params = {
        imageUrl,
        direction,
        anchor,
        targetAspectRatio,
        expandFactor,
        prompt,
        resolution,
        apiKey,
      };
      // Charge BEFORE the operation; refund if it fails AFTER a successful charge.
      const charge = await chargeCredits(req.userId!, 2);

      // ── Async mode (opt-in via `async: true`) ──────────────────────────────
      // Returns { jobId } immediately; the operation runs in the background and
      // is polled via GET /jobs/:jobId. Default stays synchronous so the MCP
      // server and other existing callers are unaffected.
      if (asyncMode) {
        const job = createJob({
          kind: 'generative-expand',
          userId: req.userId!,
          creditsCharged: charge.charged ? charge.creditsDeducted : 0,
          deductionSource: charge.deductionSource,
        });
        await saveJob(job);
        res.status(202).json({ jobId: job.jobId, status: job.status });

        runImageLabJob(job, async () => {
          const result = await generativeExpand(params, req.userId!);
          recordToolUsage({
            userId: req.userId!,
            action: 'imagelab.generative-expand',
            creditsDeducted: charge.creditsDeducted,
            meta: { direction, targetAspectRatio, resolution, async: true },
            emitWebhook: true,
          });
          return result;
        }).catch((err) => console.error('[imagelab] generative-expand job error:', err));
        return;
      }

      // ── Synchronous mode (default) ─────────────────────────────────────────
      try {
        const result = await generativeExpand(params, req.userId!);
        recordToolUsage({
          userId: req.userId!,
          action: 'imagelab.generative-expand',
          creditsDeducted: charge.creditsDeducted,
          meta: { direction, targetAspectRatio, resolution },
          emitWebhook: true,
        });
        res.json(result);
      } catch (opErr: any) {
        if (charge.charged && charge.creditsDeducted > 0) {
          await refundCreditsWithRetry(
            req.userId!,
            charge.creditsDeducted,
            charge.deductionSource
          ).catch(() => {});
        }
        throw opErr;
      }
    } catch (err: any) {
      next(err);
    }
  }
);

router.post(
  '/inpaint',
  imagelabBodyParser,
  generativeRateLimiter,
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const {
        imageUrl,
        mode,
        prompt,
        maskBase64,
        maskRegion,
        resolution,
        aspectRatio,
        apiKey,
        async: asyncMode,
      } = req.body;
      if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl is required.' });
      }
      if (!mode || !['replace', 'remove', 'retouch'].includes(mode)) {
        return res.status(400).json({ error: 'mode is required (replace, remove, or retouch).' });
      }
      if (!maskBase64 && !maskRegion) {
        return res.status(400).json({ error: 'Either maskBase64 or maskRegion is required.' });
      }
      const params = { imageUrl, mode, prompt, maskBase64, maskRegion, resolution, aspectRatio, apiKey };
      // Charge BEFORE the operation; refund if it fails AFTER a successful charge.
      const charge = await chargeCredits(req.userId!, 2);

      // ── Async mode (opt-in via `async: true`) ──────────────────────────────
      if (asyncMode) {
        const job = createJob({
          kind: 'inpaint',
          userId: req.userId!,
          creditsCharged: charge.charged ? charge.creditsDeducted : 0,
          deductionSource: charge.deductionSource,
        });
        await saveJob(job);
        res.status(202).json({ jobId: job.jobId, status: job.status });

        runImageLabJob(job, async () => {
          const result = await inpaint(params, req.userId!);
          recordToolUsage({
            userId: req.userId!,
            action: 'imagelab.inpaint',
            creditsDeducted: charge.creditsDeducted,
            meta: { mode, resolution, aspectRatio, async: true },
            emitWebhook: true,
          });
          return result;
        }).catch((err) => console.error('[imagelab] inpaint job error:', err));
        return;
      }

      // ── Synchronous mode (default) ─────────────────────────────────────────
      try {
        const result = await inpaint(params, req.userId!);
        recordToolUsage({
          userId: req.userId!,
          action: 'imagelab.inpaint',
          creditsDeducted: charge.creditsDeducted,
          meta: { mode, resolution, aspectRatio },
          emitWebhook: true,
        });
        res.json(result);
      } catch (opErr: any) {
        if (charge.charged && charge.creditsDeducted > 0) {
          await refundCreditsWithRetry(
            req.userId!,
            charge.creditsDeducted,
            charge.deductionSource
          ).catch(() => {});
        }
        throw opErr;
      }
    } catch (err: any) {
      next(err);
    }
  }
);

router.post(
  '/remove-background',
  imagelabBodyParser,
  apiRateLimiter,
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const { imageUrl, outputFormat } = req.body;
      if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl is required.' });
      }
      // Charge BEFORE the operation; refund if it fails AFTER a successful charge.
      const charge = await chargeCredits(req.userId!, 1);
      try {
        const result = await removeBackgroundFromImage({ imageUrl, outputFormat }, req.userId!);
        recordToolUsage({
          userId: req.userId!,
          action: 'imagelab.remove-background',
          creditsDeducted: charge.creditsDeducted,
          meta: { outputFormat },
          emitWebhook: true,
        });
        res.json(result);
      } catch (opErr: any) {
        if (charge.charged && charge.creditsDeducted > 0) {
          await refundCreditsWithRetry(
            req.userId!,
            charge.creditsDeducted,
            charge.deductionSource
          ).catch(() => {});
        }
        throw opErr;
      }
    } catch (err: any) {
      next(err);
    }
  }
);

// ─── GET /api/imagelab/jobs/:jobId ─────────────────────────────────────────
// Polling endpoint for async generative jobs. Only the job owner can read it.
router.get('/jobs/:jobId', apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const job = await loadJob(req.params.jobId);
    if (!job) {
      return res
        .status(404)
        .json({ error: `Job not found or expired (TTL: ${IMAGELAB_JOB_TTL_SECONDS / 3600}h).` });
    }
    if (job.userId !== req.userId) {
      return res.status(403).json({ error: 'Forbidden.' });
    }
    // Detect server-restart orphans: mark failed + refund once if stale.
    const reconciled = await reconcileIfOrphaned(job);
    res.json({
      jobId: reconciled.jobId,
      kind: reconciled.kind,
      status: reconciled.status,
      createdAt: reconciled.createdAt,
      updatedAt: reconciled.updatedAt,
      result: reconciled.result,
      error: reconciled.error,
    });
  } catch (err: any) {
    next(err);
  }
});

export default router;
