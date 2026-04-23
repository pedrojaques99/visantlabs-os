import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { rateLimit } from 'express-rate-limit';
import { brandingFeedbackSchema, mockupFeedbackSchema, formatZodError } from '../utils/schemas.js';
import { feedbackStore } from '../lib/feedback/feedbackStore.js';
import type { FeedbackFeature, FeedbackRating, GenerationFeedback } from '../lib/feedback/types.js';

// API rate limiter - general authenticated endpoints
// Using express-rate-limit for CodeQL recognition
const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_API || '60', 10),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

// Save branding example feedback (thumbs up)
router.post('/branding', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const parsed = brandingFeedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }
    const { prompt, step, output, rating } = parsed.data;

    // Only save positive feedback (thumbs up = rating 1)
    const feedbackRating = rating || 1;
    if (feedbackRating !== 1) {
      return res.status(400).json({ error: 'Only positive feedback (thumbs up) is saved as examples' });
    }

    // Check if example already exists for this prompt + step combination
    const existing = await prisma.brandingExample.findFirst({
      where: {
        prompt: prompt.trim(),
        step: parseInt(step.toString()),
      },
    });

    if (existing) {
      // Update existing example with new output and higher rating
      const updated = await prisma.brandingExample.update({
        where: { id: existing.id },
        data: {
          output: output as any,
          rating: Math.max(existing.rating, feedbackRating),
          updatedAt: new Date(),
        },
      });

      return res.json({ 
        success: true, 
        message: 'Feedback updated',
        example: updated 
      });
    }

    // Create new example
    const example = await prisma.brandingExample.create({
      data: {
        prompt: prompt.trim(),
        step: parseInt(step.toString()),
        output: output as any,
        rating: feedbackRating,
      },
    });

    res.json({ 
      success: true, 
      message: 'Feedback saved as example',
      example 
    });
  } catch (error: any) {
    console.error('Error saving branding feedback:', error);
    res.status(500).json({ error: 'Failed to save feedback', message: error.message });
  }
});

// Save mockup example feedback (thumbs up)
router.post('/mockup', authenticate, async (req: AuthRequest, res) => {
  try {
    const parsed = mockupFeedbackSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: formatZodError(parsed.error) });
    }
    const { prompt, imageUrl, designType, tags, brandingTags, aspectRatio, rating } = parsed.data;

    // Only save positive feedback (thumbs up = rating 1)
    const feedbackRating = rating || 1;
    if (feedbackRating !== 1) {
      return res.status(400).json({ error: 'Only positive feedback (thumbs up) is saved as examples' });
    }

    // Check if example already exists for this prompt + imageUrl combination
    const existing = await prisma.mockupExample.findFirst({
      where: {
        prompt: prompt.trim(),
        imageUrl: imageUrl,
      },
    });

    if (existing) {
      // Update existing example with higher rating
      const updated = await prisma.mockupExample.update({
        where: { id: existing.id },
        data: {
          rating: Math.max(existing.rating, feedbackRating),
          updatedAt: new Date(),
        },
      });

      return res.json({ 
        success: true, 
        message: 'Feedback updated',
        example: updated 
      });
    }

    // Create new example
    const example = await prisma.mockupExample.create({
      data: {
        prompt: prompt.trim(),
        imageUrl: imageUrl,
        designType: designType || 'blank',
        tags: tags || [],
        brandingTags: brandingTags || [],
        aspectRatio: aspectRatio || '16:9',
        rating: feedbackRating,
      },
    });

    res.json({ 
      success: true, 
      message: 'Feedback saved as example',
      example 
    });
  } catch (error: any) {
    console.error('Error saving mockup feedback:', error);
    res.status(500).json({ error: 'Failed to save feedback', message: error.message });
  }
});

// Get mockup examples (for RAG - no auth required for reading examples)
router.get('/mockup-examples', apiRateLimiter, async (req, res) => {
  try {
    const { designType, limit = 10 } = req.query;

    const where: any = {
      rating: 1, // Only positive examples
    };

    if (designType) {
      where.designType = designType;
    }

    const examples = await prisma.mockupExample.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: parseInt(limit.toString()),
    });

    res.json({ examples });
  } catch (error: any) {
    console.error('Error fetching mockup examples:', error);
    res.status(500).json({ error: 'Failed to fetch examples', message: error.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// UNIVERSAL FEEDBACK — usado por QUALQUER rota de geração (mockup, canvas,
// creative, brand-intelligence, etc). Thumbs up/down persistidos em Mongo;
// thumbs up também vão pro Pinecone pra alimentar o RAG loop.
// ─────────────────────────────────────────────────────────────────────────────

const VALID_FEATURES: FeedbackFeature[] = [
  'mockup', 'branding', 'canvas', 'creative',
  'brand-intelligence', 'node-builder', 'chat', 'admin-chat', 'image-gen',
];

/**
 * POST /api/feedback/generation
 * Body: {
 *   generationId: string,
 *   feature: FeedbackFeature,
 *   rating: 'up' | 'down',
 *   reason?: string,
 *   context: { prompt, imageUrl?, tags?, brandGuidelineId?, brandBrief?, vibeId?, ... }
 * }
 */
router.post('/generation', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { generationId, feature, rating, reason, context } = req.body ?? {};

    if (!generationId || typeof generationId !== 'string') {
      return res.status(400).json({ error: 'generationId is required' });
    }
    if (!VALID_FEATURES.includes(feature)) {
      return res.status(400).json({ error: `feature must be one of: ${VALID_FEATURES.join(', ')}` });
    }
    if (rating !== 'up' && rating !== 'down') {
      return res.status(400).json({ error: "rating must be 'up' or 'down'" });
    }

    const feedback: GenerationFeedback = {
      generationId,
      userId: req.userId!,
      feature: feature as FeedbackFeature,
      rating: rating as FeedbackRating,
      reason: typeof reason === 'string' ? reason.slice(0, 500) : undefined,
      context: context && typeof context === 'object' ? context : {},
      createdAt: new Date(),
    };

    const result = await feedbackStore.record(feedback);

    // Mirror thumbs-up em Prisma MockupExample pra manter retrieval
    // estruturado (filtro por designType) funcionando lado-a-lado com RAG.
    if (rating === 'up' && feature === 'mockup' && context?.prompt) {
      try {
        await prisma.mockupExample.create({
          data: {
            prompt: String(context.prompt).trim().slice(0, 5000),
            imageUrl: context.imageUrl ?? null,
            designType: context.designType ?? 'blank',
            tags: Array.isArray(context.tags?.category) ? context.tags.category : [],
            brandingTags: Array.isArray(context.tags?.branding) ? context.tags.branding : [],
            aspectRatio: context.aspectRatio ?? '16:9',
            rating: 1,
          },
        });
      } catch (mirrorErr) {
        console.warn('[feedback/generation] prisma mirror failed:', mirrorErr);
      }

      // Auto-promoção de patterns: se o prompt for bom, incrementa o score global do pattern
      if (context?.prompt) {
        try {
          const normalizedPrompt = String(context.prompt).trim().slice(0, 5000);
          const threshold = parseInt(process.env.PATTERN_PROMOTION_THRESHOLD || '5', 10);
          
          const pattern = await prisma.mockupPattern.upsert({
            where: { prompt: normalizedPrompt },
            update: { rating: { increment: 1 } },
            create: {
              prompt: normalizedPrompt,
              designType: context.designType || 'blank',
              tags: Array.isArray(context.tags?.category) ? context.tags.category : [],
              rating: 1
            }
          });

          if (pattern.rating >= threshold && !pattern.isOfficial && process.env.AUTO_PROMOTE_PATTERNS === 'true') {
            await prisma.mockupPattern.update({
              where: { id: pattern.id },
              data: { isOfficial: true }
            });
            if (process.env.NODE_ENV !== 'production') {
              console.log(`[feedback/generation] Pattern auto-promoted to official: ${pattern.id}`);
            }
          }
        } catch (patternErr) {
          console.warn('[feedback/generation] pattern auto-promotion failed:', patternErr);
        }
      }
    }

    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[feedback/generation] error:', error);
    res.status(500).json({ error: 'Failed to record feedback', message: error.message });
  }
});

/**
 * DELETE /api/feedback/generation/:generationId
 * "Undo" — remove feedback (Mongo + Pinecone).
 */
router.delete('/generation/:generationId', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { generationId } = req.params;
    const removed = await feedbackStore.remove(generationId, req.userId!);
    res.json({ success: true, removed });
  } catch (error: any) {
    console.error('[feedback/generation] delete error:', error);
    res.status(500).json({ error: 'Failed to remove feedback' });
  }
});

/**
 * GET /api/feedback/generation/recent?feature=mockup&limit=20
 * Audit log pro usuário — lista feedbacks recentes.
 */
router.get('/generation/recent', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const feature = req.query.feature as FeedbackFeature | undefined;
    const limit = Math.min(parseInt(String(req.query.limit ?? '20'), 10) || 20, 100);
    const items = await feedbackStore.listRecent(req.userId!, feature, limit);
    res.json({ items });
  } catch (error: any) {
    console.error('[feedback/generation] list error:', error);
    res.status(500).json({ error: 'Failed to list feedback' });
  }
});

export default router;

