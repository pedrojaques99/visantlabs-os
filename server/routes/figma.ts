import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';
import { generateFigmaOperations } from '../services/geminiService.js';
import { getGeminiApiKey } from '../utils/geminiApiKey.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { createUsageRecord } from '../utils/usageTracking.js';
import { incrementUserGenerations } from '../utils/usageTrackingUtils.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';
import { redisClient } from '../lib/redis.js';
import { CacheKey, CACHE_TTL, hashQuery, hashObject } from '../lib/cache-utils.js';

const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_API || '60', 10),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const router = express.Router();

/**
 * POST /api/figma/generate
 * Generate Figma operations from a prompt and canvas context
 */
router.post('/generate', apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { prompt, context } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    if (!context || typeof context !== 'object' || !Array.isArray(context.nodes)) {
      return res.status(400).json({ error: 'Context with nodes array is required' });
    }

    // 🟢 CACHE CHECK
    const hash = hashQuery(prompt, hashObject(context));
    const cacheKey = CacheKey.figmaGen(req.userId!, hash);
    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) {
      console.log(`[Cache] HIT figma:gen:${hash.slice(0, 8)}`);
      return res.json({ ...JSON.parse(cached), fromCache: true });
    }

    let userApiKey: string | undefined;
    try {
      userApiKey = await getGeminiApiKey(req.userId!);
    } catch {
      // Use system key
    }

    const result = await generateFigmaOperations(prompt.trim(), context, userApiKey);

    // 💾 CACHE SET
    await redisClient.setex(cacheKey, CACHE_TTL.FIGMA_GEN, JSON.stringify({ operations: result.operations })).catch(() => {});

    (async () => {
      try {
        await connectToMongoDB();
        const db = getDb();
        const usageRecord = createUsageRecord(
          req.userId!,
          0,
          GEMINI_MODELS.TEXT,
          false,
          prompt.length,
          undefined,
          'figma',
          'system',
          result.inputTokens,
          result.outputTokens
        );
        await db.collection('usage_records').insertOne(usageRecord);

        const totalTokens = (result.inputTokens || 0) + (result.outputTokens || 0);
        if (totalTokens > 0) {
          await incrementUserGenerations(req.userId!, 0, totalTokens);
        }
      } catch (err) {
        console.error('Error tracking usage for figma/generate:', err);
      }
    })();

    res.json({ operations: result.operations });
  } catch (error: any) {
    console.error('Error generating Figma operations:', error);
    next(error);
  }
});

export default router;
