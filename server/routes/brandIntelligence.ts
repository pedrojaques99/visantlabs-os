// server/routes/brandIntelligence.ts
import express from 'express';
import { randomUUID } from 'crypto';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';
import { BrandIntelligenceService } from '../services/brandIntelligenceService.js';
import { uploadBrandMedia } from '../services/r2Service.js';
import { rateLimit } from 'express-rate-limit';
import { redisClient } from '../lib/redis.js';
import { CacheKey, CACHE_TTL, CacheInvalidation } from '../lib/cache-utils.js';

const router = express.Router();
const intelligenceService = new BrandIntelligenceService();

const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Too many requests. Please try again later.' },
});

// POST /api/brand-intelligence/:id/sync — Sync a design reference and analyze it
router.post('/:id/sync', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { imageData, name, context } = req.body;

    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!imageData) return res.status(400).json({ error: 'Image data is required' });

    // 1. Fetch the brand guideline
    const guideline = await prisma.brandGuideline.findFirst({
      where: { id, userId: req.userId },
    });

    if (!guideline) {
      return res.status(404).json({ error: 'Brand guideline not found' });
    }

    // 2. Perform intelligence analysis using Gemini
    console.log(`[Brand Intel] Analyzing design reference for brand: ${id}`);
    const analysis = await intelligenceService.analyzeDesignReference(imageData, {
      brandName: (guideline.identity as any)?.name || 'Unknown',
      referenceName: name,
      additionalContext: context
    });

    // 3. Update the guideline with the new reference and extracted principles
    const existingMedia = (guideline.media as any[]) || [];
    const existingGuidelines = (guideline.guidelines as any) || {};
    
    // Upload the reference image to R2 so we don't bloat the JSON column with base64
    const refId = `ref_${Date.now()}`;
    let storedUrl = imageData;
    try {
      storedUrl = await uploadBrandMedia(
        imageData,
        req.userId,
        id,
        refId,
        'image/png'
      );
    } catch (uploadErr: any) {
      console.warn('[Brand Intel] R2 upload failed, falling back to inline data:', uploadErr.message);
    }

    // Add to media kit as a reference
    const newReference = {
      id: refId,
      url: storedUrl,
      type: 'reference',
      label: name || 'Design Reference',
      tags: analysis.tags,
      analyzedAt: new Date().toISOString()
    };

    // Merge design principles (Dos and Don'ts)
    const updatedDos = [...new Set([...(existingGuidelines.dos || []), ...analysis.principles.dos])];
    const updatedDonts = [...new Set([...(existingGuidelines.donts || []), ...analysis.principles.donts])];

    const updatedGuideline = await prisma.brandGuideline.update({
      where: { id },
      data: {
        media: [...existingMedia, newReference],
        guidelines: {
          ...existingGuidelines,
          dos: updatedDos,
          donts: updatedDonts,
          designTips: analysis.principles.tips // Store latest tips
        }
      }
    });

    // 🗑️ INVALIDATE cache on brand edit
    const invalidationKeys = CacheInvalidation.onBrandEdit(id);
    for (const pattern of invalidationKeys) {
      await redisClient.del(pattern).catch(() => {});
    }

    res.json({
      success: true,
      analysis,
      guideline: {
        ...updatedGuideline,
        _id: updatedGuideline.id
      },
      generationId: randomUUID(), // UUID for RAG feedback loop (👍/👎)
    });

  } catch (error: any) {
    console.error('[Brand Intel API] Error:', error);
    res.status(500).json({ error: 'Failed to sync design intelligence', message: error.message });
  }
});

// GET /api/brand-intelligence/:id — Get intelligence summary for a brand
router.get('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!req.userId) return res.status(401).json({ error: 'Unauthorized' });

    // 🟢 CACHE CHECK
    const cacheKey = CacheKey.brandIntel(id);
    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) {
      console.log(`[Cache] HIT brand-intel:${id.slice(0, 8)}`);
      return res.json({ ...JSON.parse(cached), fromCache: true });
    }

    const guideline = await prisma.brandGuideline.findFirst({
      where: { id, userId: req.userId },
    });

    if (!guideline) return res.status(404).json({ error: 'Not found' });

    const media = (guideline.media as any[]) || [];
    const references = media.filter(m => m.type === 'reference');

    const result = {
      references,
      guidelines: guideline.guidelines
    };

    // 💾 CACHE SET
    await redisClient.setex(cacheKey, CACHE_TTL.BRAND_INTEL, JSON.stringify(result)).catch(() => {});

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch brand intelligence' });
  }
});

export default router;
