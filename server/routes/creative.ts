import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  appendEvents,
  readEvents,
  computeBrandInsights,
  computeMetrics,
  type CreativeEvent,
} from '../lib/creative-events-store.js';
import { renderCreativePlan } from '../lib/creative-renderer.js';
import { uploadCanvasImage } from '../services/r2Service.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import {
  planFromBrand,
  PlanValidationError,
  sanitizeForPrompt,
  type CreativeFormat,
} from '../lib/creative-plan-engine.js';
import type { BrandGuideline } from '../../src/lib/figma-types.js';

const router = Router();

interface CreativePlanRequest {
  prompt: string;
  format: CreativeFormat;
  brandId?: string;
  // Full BrandGuideline — server builds rich structured context, picks brand
  // media as background candidate, and snaps invented colors/fonts back to
  // the brand. The legacy minimal `brandContext` shape is no longer accepted.
  brandGuideline?: BrandGuideline;
}

async function getLearnedBiasLine(brandId?: string): Promise<string> {
  if (!brandId) return '';
  try {
    const insights = await computeBrandInsights(brandId);
    if (insights.sampleSize >= 3 && insights.commonPatches.length > 0) {
      return `Brand-learned preferences (from ${insights.sampleSize} past edits across ${insights.creatives} creatives): ${insights.commonPatches.join('; ')}. Apply these proactively.`;
    }
  } catch (e) {
    console.warn('[creative/plan] insights unavailable:', (e as Error).message);
  }
  return '';
}

router.post('/plan', async (req, res) => {
  try {
    const { prompt, format, brandGuideline, brandId } =
      req.body as CreativePlanRequest;

    if (!prompt || !format) {
      return res.status(400).json({ error: 'prompt and format are required' });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }

    const learnedBiasLine = await getLearnedBiasLine(brandId);

    try {
      const { plan, pickedMedia } = await planFromBrand({
        prompt,
        format,
        brandGuideline: brandGuideline ?? null,
        learnedBiasLine,
      });
      // pickedMedia carries the brand-media URL the engine selected for this
      // format; the client uses it as the background and only falls back to
      // AI image gen when it's null.
      return res.json({ ...plan, pickedMedia });
    } catch (err) {
      if (err instanceof PlanValidationError) {
        return res.status(502).json({ error: err.reason, raw: err.raw });
      }
      throw err;
    }
  } catch (err: any) {
    console.error('[creative/plan] error:', err);
    return res.status(500).json({ error: err?.message ?? 'unknown error' });
  }
});

// ---------- Creative Events (Brand Learning #5 + Observability #6) ----------

router.post('/events', async (req, res) => {
  try {
    const body = req.body as { events?: CreativeEvent[] };
    if (!body?.events || !Array.isArray(body.events)) {
      return res.status(400).json({ error: 'events array required' });
    }
    if (body.events.length > 200) {
      return res.status(413).json({ error: 'too many events in one batch' });
    }
    const now = Date.now();
    const events = body.events.map((e) => ({
      ...e,
      ts: e.ts || now,
      id: e.id || `${now}_${Math.random().toString(36).slice(2, 8)}`,
    }));
    await appendEvents(events);
    return res.json({ ok: true, count: events.length });
  } catch (err: any) {
    console.error('[creative/events POST] error:', err);
    return res.status(500).json({ error: err?.message ?? 'unknown error' });
  }
});

router.get('/events', async (req, res) => {
  try {
    const brandId = (req.query.brandId as string) || undefined;
    const creativeId = (req.query.creativeId as string) || undefined;
    const limit = Math.min(Number(req.query.limit) || 100, 500);
    const events = await readEvents({ brandId, creativeId, limit });
    return res.json({ events });
  } catch (err: any) {
    console.error('[creative/events GET] error:', err);
    return res.status(500).json({ error: err?.message ?? 'unknown error' });
  }
});

router.get('/events/metrics', async (req, res) => {
  try {
    const brandId = (req.query.brandId as string) || undefined;
    const metrics = await computeMetrics(brandId);
    return res.json(metrics);
  } catch (err: any) {
    console.error('[creative/events/metrics] error:', err);
    return res.status(500).json({ error: err?.message ?? 'unknown error' });
  }
});

router.get('/brand/:brandId/insights', async (req, res) => {
  try {
    const insights = await computeBrandInsights(req.params.brandId);
    return res.json(insights);
  } catch (err: any) {
    console.error('[creative/brand/:id/insights] error:', err);
    return res.status(500).json({ error: err?.message ?? 'unknown error' });
  }
});

// ─── Server-side render ───────────────────────────────────────────────────────
// POST /api/creative/render: plan + bg URL → PNG → R2.

router.post('/render', authenticate, async (req: AuthRequest, res) => {
  try {
    const { plan, format, accentColor, backgroundImageUrl } = req.body as {
      plan: Record<string, any>;
      format?: string;
      accentColor?: string;
      backgroundImageUrl?: string;
    };

    if (!plan || !plan.layers) {
      return res.status(400).json({ error: 'plan with layers is required' });
    }

    const resolvedPlan = { ...plan, backgroundImageUrl: backgroundImageUrl ?? plan.backgroundImageUrl };

    const pngBuffer = await renderCreativePlan(resolvedPlan as any, {
      format: (format as any) ?? '1:1',
      accentColor: accentColor ?? '#ffffff',
    });

    try {
      const base64 = `data:image/png;base64,${pngBuffer.toString('base64')}`;
      const userId = req.userId ?? 'system';
      const imageUrl = await uploadCanvasImage(base64, userId, 'creative-render', `render-${Date.now()}`);
      return res.json({ imageUrl });
    } catch {
      return res.json({ imageBase64: pngBuffer.toString('base64') });
    }
  } catch (err: any) {
    console.error('[creative/render] error:', err);
    return res.status(500).json({ error: err?.message ?? 'render failed' });
  }
});

// ─── Brand-driven generation ──────────────────────────────────────────────────
// POST /api/creative/generate-from-brand: load brand → plan → render → R2.

const generateFromBrandLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/generate-from-brand',
  generateFromBrandLimiter,
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      const { brandId, format = '1:1', intent, feedback, previousPlan } = req.body as {
        brandId: string;
        format?: CreativeFormat;
        intent?: string;
        feedback?: string;
        previousPlan?: Record<string, any>;
      };

      if (!brandId) {
        return res.status(400).json({ error: 'brandId is required' });
      }
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
      }

      const brand = await prisma.brandGuideline.findFirst({
        where: { id: brandId, userId: req.userId! },
      });
      if (!brand) {
        return res.status(404).json({ error: 'Brand guideline not found' });
      }

      // Stitch intent + feedback into the prompt; engine handles brand context.
      const promptParts = [
        intent ? `Creative intent: ${sanitizeForPrompt(intent)}` : '',
        feedback && previousPlan
          ? `User feedback on previous plan: ${sanitizeForPrompt(feedback)}\nPrevious plan JSON:\n${JSON.stringify(
              previousPlan
            )}\nRefine the plan based on the feedback.`
          : '',
      ]
        .filter(Boolean)
        .join('\n');

      let plan: Record<string, any>;
      let pickedMedia: { url: string } | null = null;
      try {
        const result = await planFromBrand({
          prompt: promptParts || (intent ?? 'Create a brand-aligned creative.'),
          format,
          brandGuideline: brand as unknown as BrandGuideline,
        });
        plan = result.plan;
        pickedMedia = result.pickedMedia;
      } catch (err) {
        if (err instanceof PlanValidationError) {
          return res.status(502).json({ error: err.reason, raw: err.raw });
        }
        throw err;
      }

      // Logo URL injection happens in the engine via applyBrandFidelityPasses
      // (forces a logo layer if missing). Attach the URL here from prisma data
      // since the engine doesn't fill URLs (kept format-agnostic).
      const logos = (brand.logos as any[]) ?? [];
      const logoUrls = logos.slice(0, 2).map((l: any) => l.url).filter(Boolean);
      if (logoUrls.length && Array.isArray(plan.layers)) {
        let i = 0;
        plan.layers = plan.layers.map((layer: any) =>
          layer.type === 'logo' && !layer.url && logoUrls[i]
            ? { ...layer, url: logoUrls[i++] }
            : layer
        );
      }

      const colors = (brand.colors as any[]) ?? [];
      const accentColor =
        colors.find((c: any) => c.role === 'accent' || c.role === 'secondary')?.hex ??
        colors.find((c: any) => c.role === 'primary')?.hex ??
        colors[0]?.hex ??
        '#000000';

      const pngBuffer = await renderCreativePlan(
        { ...plan, backgroundImageUrl: pickedMedia?.url } as any,
        { format, accentColor }
      );

      const base64 = `data:image/png;base64,${pngBuffer.toString('base64')}`;
      const userId = req.userId ?? 'system';
      try {
        const imageUrl = await uploadCanvasImage(
          base64,
          userId,
          'creative-render',
          `brand-gen-${Date.now()}`
        );
        return res.json({
          imageUrl,
          plan,
          pickedMedia,
          brandUsed: {
            colors: colors.slice(0, 4),
            fonts: ((brand.typography as any[]) ?? []).slice(0, 2),
            logos: logoUrls,
          },
        });
      } catch {
        return res.json({
          imageBase64: base64,
          plan,
          pickedMedia,
          brandUsed: {
            colors: colors.slice(0, 4),
            fonts: ((brand.typography as any[]) ?? []).slice(0, 2),
            logos: logoUrls,
          },
        });
      }
    } catch (err: any) {
      console.error('[creative/generate-from-brand] error:', err);
      return res.status(500).json({ error: err?.message ?? 'generation failed' });
    }
  }
);

export default router;
