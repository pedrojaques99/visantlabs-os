import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../db/prisma.js';
import { buildBrandContextForImageGen } from '../lib/brandContextBuilder.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';
import { sanitizeForPrompt } from '../utils/promptSanitize.js';
import { redisClient, isRedisHealthy } from '../lib/redis.js';
import { CacheKey, CACHE_TTL, hashQuery, hashObject } from '../lib/cache-utils.js';

// API rate limiter - general authenticated endpoints
// Using express-rate-limit for CodeQL recognition
const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_API || '60', 10),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
import {
  improvePrompt,
  describeImage,
  suggestCategories,
  generateSmartPrompt,
  suggestPromptVariations,
  analyzeMockupSetup,
  changeObjectInMockup,
  applyThemeToMockup,
  refineSuggestions,
} from '../services/geminiService.js';
import { getGeminiApiKey } from '../utils/geminiApiKey.js';
import { getAllAvailableTags } from '../services/tagService.js';
import type { UploadedImage, GeminiModel, Resolution } from '../../src/types/types.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { createUsageRecord } from '../utils/usageTracking.js';
import { incrementUserGenerations } from '../utils/usageTrackingUtils.js';
import { chargeCredits } from '../lib/credits.js';
import { completeCheapText, parseJsonLoose } from '../lib/ai-providers/cheapText.js';

const router = express.Router();

/**
 * POST /api/ai/improve-prompt
 * Improve a text prompt using AI
 */
router.post(
  '/improve-prompt',
  apiRateLimiter,
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const { prompt } = req.body;

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      // 🟢 CACHE CHECK
      const hash = hashQuery(prompt);
      const cacheKey = CacheKey.aiText('improve', req.userId!, hash);
      const cached = await redisClient.get(cacheKey).catch(() => null);
      if (cached) {
        console.log(`[Cache] HIT ai:improve:${hash.slice(0, 8)}`);
        return res.json({ ...JSON.parse(cached), fromCache: true });
      }

      // Try to use user's API key first, fallback to system key
      let userApiKey: string | undefined;
      try {
        userApiKey = await getGeminiApiKey(req.userId!);
      } catch (error) {
        // User doesn't have API key, will use system key
      }

      await chargeCredits(req.userId!, 1, { isUserApiKey: !!userApiKey });
      const result = await improvePrompt(prompt, userApiKey);

      // 💾 CACHE SET
      await redisClient.setex(cacheKey, CACHE_TTL.AI_TEXT, JSON.stringify(result)).catch(() => {});

      // Track usage asynchronously
      (async () => {
        try {
          await connectToMongoDB();
          const db = getDb();
          const usageRecord = createUsageRecord(
            req.userId!,
            0, // images
            GEMINI_MODELS.TEXT,
            false, // hasInputImage
            prompt.length,
            undefined, // resolution
            'branding', // feature
            'system',
            result.inputTokens,
            result.outputTokens
          );
          (usageRecord as any).type = 'branding';

          await db.collection('usage_records').insertOne(usageRecord);

          // Track total tokens for user stats
          const totalTokens = (result.inputTokens || 0) + (result.outputTokens || 0);
          if (totalTokens > 0) {
            await incrementUserGenerations(req.userId!, 0, totalTokens);
          }
        } catch (err) {
          console.error('Error tracking usage for improve-prompt:', err);
        }
      })();

      res.json({ improvedPrompt: result.improvedPrompt });
    } catch (error: any) {
      console.error('Error improving prompt:', error);
      next(error);
    }
  }
);

/**
 * POST /api/ai/describe-image
 * Generate a description of an image
 */
router.post(
  '/describe-image',
  apiRateLimiter,
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const { image } = req.body;

      if (!image) {
        return res.status(400).json({ error: 'Image is required' });
      }

      // Normalize image input - can be base64 string or UploadedImage object
      let imageInput: UploadedImage | string;
      if (typeof image === 'string') {
        imageInput = image;
      } else if ((image.base64 || image.url) && image.mimeType) {
        imageInput = image as UploadedImage;
      } else {
        return res.status(400).json({ error: 'Invalid image format' });
      }

      // 🟢 CACHE CHECK
      const imageHash = hashQuery(
        typeof imageInput === 'string'
          ? imageInput
          : (imageInput as any).base64 || (imageInput as any).url
      );
      const cacheKey = CacheKey.aiText('describe', req.userId!, imageHash);
      const cached = await redisClient.get(cacheKey).catch(() => null);
      if (cached) {
        console.log(`[Cache] HIT ai:describe:${imageHash.slice(0, 8)}`);
        return res.json({ ...JSON.parse(cached), fromCache: true });
      }

      // Try to use user's API key first, fallback to system key
      let userApiKey: string | undefined;
      try {
        userApiKey = await getGeminiApiKey(req.userId!);
      } catch (error) {
        // User doesn't have API key, will use system key
      }

      await chargeCredits(req.userId!, 1, { isUserApiKey: !!userApiKey });
      const result = await describeImage(imageInput, userApiKey);

      // 💾 CACHE SET
      await redisClient
        .setex(cacheKey, CACHE_TTL.AI_IMAGE_ANALYSIS, JSON.stringify(result))
        .catch(() => {});

      // Track usage asynchronously
      (async () => {
        try {
          await connectToMongoDB();
          const db = getDb();
          const usageRecord = createUsageRecord(
            req.userId!,
            0, // images
            GEMINI_MODELS.TEXT,
            true, // hasInputImage
            0, // promptLength
            undefined, // resolution
            'branding', // feature
            'system',
            result.inputTokens,
            result.outputTokens
          );
          (usageRecord as any).type = 'branding';

          await db.collection('usage_records').insertOne(usageRecord);

          // Track total tokens for user stats
          const totalTokens = (result.inputTokens || 0) + (result.outputTokens || 0);
          if (totalTokens > 0) {
            await incrementUserGenerations(req.userId!, 0, totalTokens);
          }
        } catch (err) {
          console.error('Error tracking usage for describe-image:', err);
        }
      })();

      res.json({
        description: result.description,
        title: result.title,
      });
    } catch (error: any) {
      console.error('Error describing image:', error);
      next(error);
    }
  }
);

/**
 * POST /api/ai/suggest-categories
 * Suggest mockup categories based on an image and branding tags
 */
router.post(
  '/suggest-categories',
  apiRateLimiter,
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const { baseImage, brandingTags } = req.body;

      if (!baseImage || (!baseImage.base64 && !baseImage.url) || !baseImage.mimeType) {
        return res.status(400).json({ error: 'Base image is required' });
      }

      if (!Array.isArray(brandingTags)) {
        return res.status(400).json({ error: 'Branding tags must be an array' });
      }

      // 🟢 CACHE CHECK
      const hash = hashObject({ baseImage, brandingTags });
      const cacheKey = CacheKey.aiText('categories', req.userId!, hash);
      const cached = await redisClient.get(cacheKey).catch(() => null);
      if (cached) {
        console.log(`[Cache] HIT ai:categories:${hash.slice(0, 8)}`);
        return res.json({ ...JSON.parse(cached), fromCache: true });
      }

      // Try to use user's API key first, fallback to system key
      let userApiKey: string | undefined;
      try {
        userApiKey = await getGeminiApiKey(req.userId!);
      } catch (error) {
        // User doesn't have API key, will use system key
      }

      await chargeCredits(req.userId!, 1, { isUserApiKey: !!userApiKey });
      const result = await suggestCategories(baseImage as UploadedImage, brandingTags, userApiKey);

      // 💾 CACHE SET
      await redisClient.setex(cacheKey, CACHE_TTL.AI_TEXT, JSON.stringify(result)).catch(() => {});

      // Track usage asynchronously
      (async () => {
        try {
          await connectToMongoDB();
          const db = getDb();
          const usageRecord = createUsageRecord(
            req.userId!,
            0, // images
            GEMINI_MODELS.TEXT,
            true, // hasInputImage
            0, // promptLength
            undefined, // resolution
            'branding', // feature
            'system',
            result.inputTokens,
            result.outputTokens
          );
          // Add specific type for admin stats
          (usageRecord as any).type = 'branding';

          await db.collection('usage_records').insertOne(usageRecord);

          // Track total tokens for user stats
          const totalTokens = (result.inputTokens || 0) + (result.outputTokens || 0);
          if (totalTokens > 0) {
            await incrementUserGenerations(req.userId!, 0, totalTokens);
          }
        } catch (err) {
          console.error('Error tracking usage for suggest-categories:', err);
        }
      })();

      res.json({ categories: result.categories });
    } catch (error: any) {
      console.error('Error suggesting categories:', error);
      next(error);
    }
  }
);

// Stricter rate limiter for refine-suggestions (1 request per 2 seconds)
const refineSuggestionsLimiter = rateLimit({
  windowMs: 2000, // 2 seconds
  max: 1,
  message: { error: 'Please wait before refining suggestions again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/ai/refine-suggestions
 * Lightweight endpoint to refine tag suggestions based on current selections.
 * Uses text-only model for efficiency (no image re-processing).
 */
router.post(
  '/refine-suggestions',
  refineSuggestionsLimiter,
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const { imageDescription, selectedTags, changedCategory } = req.body;

      // Validate selectedTags structure
      if (!selectedTags || typeof selectedTags !== 'object') {
        return res.status(400).json({ error: 'selectedTags is required' });
      }

      if (!changedCategory || typeof changedCategory !== 'string') {
        return res.status(400).json({ error: 'changedCategory is required' });
      }

      // 🟢 CACHE CHECK
      const hash = hashObject({ imageDescription, selectedTags, changedCategory });
      const cacheKey = CacheKey.aiText('refine', req.userId!, hash);
      const cached = await redisClient.get(cacheKey).catch(() => null);
      if (cached) {
        console.log(`[Cache] HIT ai:refine:${hash.slice(0, 8)}`);
        return res.json({ ...JSON.parse(cached), fromCache: true });
      }

      // Get user's API key if available
      let userApiKey: string | undefined;
      try {
        userApiKey = await getGeminiApiKey(req.userId!);
      } catch {
        // Will use system key
      }

      await chargeCredits(req.userId!, 1, { isUserApiKey: !!userApiKey });
      const availableTags = await getAllAvailableTags();

      const result = await refineSuggestions(
        {
          imageDescription,
          selectedTags: {
            categories: selectedTags.categories || [],
            location: selectedTags.location || [],
            angle: selectedTags.angle || [],
            lighting: selectedTags.lighting || [],
            effects: selectedTags.effects || [],
            material: selectedTags.material || [],
          },
          changedCategory,
          availableTags,
        },
        userApiKey
      );

      // 💾 CACHE SET
      await redisClient.setex(cacheKey, CACHE_TTL.AI_TEXT, JSON.stringify(result)).catch(() => {});

      // Track usage asynchronously (lightweight tracking)
      (async () => {
        try {
          await connectToMongoDB();
          const db = getDb();
          const usageRecord = createUsageRecord(
            req.userId!,
            0,
            GEMINI_MODELS.TEXT,
            false, // no image
            100, // estimated prompt length
            undefined,
            'branding',
            'system',
            result.inputTokens,
            result.outputTokens
          );
          (usageRecord as any).type = 'refine-suggestions';
          await db.collection('usage_records').insertOne(usageRecord);

          const totalTokens = (result.inputTokens || 0) + (result.outputTokens || 0);
          if (totalTokens > 0) {
            await incrementUserGenerations(req.userId!, 0, totalTokens);
          }
        } catch (err) {
          console.error('Error tracking usage for refine-suggestions:', err);
        }
      })();

      res.json({
        categories: result.categories,
        locations: result.locations,
        angles: result.angles,
        lighting: result.lighting,
        effects: result.effects,
        materials: result.materials,
      });
    } catch (error: any) {
      console.error('Error refining suggestions:', error);
      next(error);
    }
  }
);

/**
 * POST /api/ai/analyze-setup
 * Comprehensive analysis of an image to suggest tags for all mockup sections
 */
router.post('/analyze-setup', authenticate, async (req: AuthRequest, res, next) => {
  const t0 = Date.now();
  if (process.env.NODE_ENV === 'development') console.log('[dev] analyze-setup: start');
  try {
    const { baseImage, instructions, userContext } = req.body;

    if (!baseImage || (!baseImage.base64 && !baseImage.url) || !baseImage.mimeType) {
      return res.status(400).json({ error: 'Base image is required' });
    }

    // 🟢 CACHE CHECK
    const hash = hashObject({ baseImage, instructions, userContext });
    const cacheKey = CacheKey.aiText('setup', req.userId!, hash);
    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) {
      console.log(`[Cache] HIT ai:setup:${hash.slice(0, 8)}`);
      return res.json({ ...JSON.parse(cached), fromCache: true });
    }

    // Run API key and tags fetch in parallel to reduce latency
    let userApiKey: string | undefined;
    const [apiKeyResult, availableTags] = await Promise.all([
      (async () => {
        try {
          return await getGeminiApiKey(req.userId!);
        } catch {
          return undefined;
        }
      })(),
      getAllAvailableTags(),
    ]);
    userApiKey = apiKeyResult;
    if (process.env.NODE_ENV === 'development')
      console.log(
        '[dev] analyze-setup: getGeminiApiKey + getAllAvailableTags done',
        ((Date.now() - t0) / 1000).toFixed(2) + 's'
      );

    // Load brand guideline context if provided (reusing pattern from mockups.ts)
    let enrichedUserContext = userContext;
    if (userContext?.brandGuidelineId) {
      try {
        const brandGuideline = await prisma.brandGuideline.findUnique({
          where: { id: userContext.brandGuidelineId },
        });
        if (brandGuideline) {
          const guidelineData = {
            id: brandGuideline.id,
            identity: brandGuideline.identity as any,
            logos: brandGuideline.logos as any,
            colors: brandGuideline.colors as any,
            typography: brandGuideline.typography as any,
            tags: brandGuideline.tags as any,
            media: brandGuideline.media as any,
            tokens: brandGuideline.tokens as any,
            guidelines: brandGuideline.guidelines as any,
          };
          const brandContext = buildBrandContextForImageGen(guidelineData);
          enrichedUserContext = {
            ...userContext,
            brandContext,
          };
          if (process.env.NODE_ENV === 'development') {
            console.log('[dev] analyze-setup: injected brand context', {
              guidelineId: userContext.brandGuidelineId,
              brandName: (guidelineData.identity as any)?.name || 'Unknown',
              contextLength: brandContext.length,
            });
          }
        }
      } catch (brandError: any) {
        console.warn('[analyze-setup] Failed to load brand guideline:', brandError.message);
      }
    }

    await chargeCredits(req.userId!, 1, { isUserApiKey: !!userApiKey });
    if (process.env.NODE_ENV === 'development')
      console.log('[dev] analyze-setup: calling analyzeMockupSetup');
    const result = await analyzeMockupSetup(
      baseImage as UploadedImage,
      userApiKey,
      availableTags,
      instructions,
      enrichedUserContext
    );
    if (process.env.NODE_ENV === 'development')
      console.log(
        '[dev] analyze-setup: analyzeMockupSetup done',
        ((Date.now() - t0) / 1000).toFixed(2) + 's'
      );

    // Track usage asynchronously
    (async () => {
      try {
        await connectToMongoDB();
        const db = getDb();
        const usageRecord = createUsageRecord(
          req.userId!,
          0, // images
          GEMINI_MODELS.TEXT,
          true, // hasInputImage
          0, // promptLength
          undefined, // resolution
          'branding', // feature
          'system',
          result.inputTokens,
          result.outputTokens
        );
        // Add specific type for admin stats
        (usageRecord as any).type = 'branding';

        await db.collection('usage_records').insertOne(usageRecord);

        // Track total tokens for user stats
        const totalTokens = (result.inputTokens || 0) + (result.outputTokens || 0);
        if (totalTokens > 0) {
          await incrementUserGenerations(req.userId!, 0, totalTokens);
        }
      } catch (err) {
        console.error('Error tracking usage for analyze-setup:', err);
      }
    })();

    // 💾 CACHE SET
    await redisClient.setex(cacheKey, CACHE_TTL.AI_TEXT, JSON.stringify(result)).catch(() => {});

    if (process.env.NODE_ENV === 'development')
      console.log('[dev] analyze-setup: res.json', ((Date.now() - t0) / 1000).toFixed(2) + 's');
    res.json(result);
  } catch (error: any) {
    const msg =
      (typeof error?.message === 'string' ? error.message : null) || 'Internal server error';
    if (process.env.NODE_ENV === 'development') {
      console.error('[analyze-setup]', msg, error?.stack || '');
    } else {
      console.error('[analyze-setup]', msg);
    }
    if (!res.headersSent) {
      res.status(500).json({ error: msg, code: 'ANALYZE_SETUP_FAILED' });
    } else {
      next(error);
    }
  }
});

/**
 * POST /api/ai/generate-smart-prompt
 * Generate a smart prompt based on user selections
 */
router.post(
  '/generate-smart-prompt',
  apiRateLimiter,
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const {
        baseImage,
        designType,
        brandingTags,
        categoryTags,
        locationTags,
        angleTags,
        lightingTags,
        effectTags,
        materialTags,
        selectedColors,
        aspectRatio,
        generateText,
        withHuman,
        enhanceTexture,
        removeText,
        negativePrompt,
        additionalPrompt,
        instructions,
        brandGuidelineId,
        vibeId,
        learnFromHistory,
        detectedLanguage,
      } = req.body;

      if (!designType) {
        return res.status(400).json({ error: 'Design type is required' });
      }

      // 🟢 CACHE CHECK
      const hash = hashObject({
        designType,
        brandingTags,
        categoryTags,
        locationTags,
        angleTags,
        lightingTags,
        effectTags,
        materialTags,
        selectedColors,
        aspectRatio,
        generateText,
        withHuman,
        enhanceTexture,
        removeText,
        negativePrompt,
        additionalPrompt,
        instructions,
        brandGuidelineId,
        vibeId,
        learnFromHistory,
        detectedLanguage,
      });
      const cacheKey = CacheKey.aiText('smartprompt', req.userId!, hash);
      const cached = await redisClient.get(cacheKey).catch(() => null);
      if (cached) {
        console.log(`[Cache] HIT ai:smartprompt:${hash.slice(0, 8)}`);
        return res.json({ ...JSON.parse(cached), fromCache: true });
      }

      // Try to use user's API key first, fallback to system key
      let userApiKey: string | undefined;
      try {
        userApiKey = await getGeminiApiKey(req.userId!);
      } catch (error) {
        // User doesn't have API key, will use system key
      }

      // Fetch brand guideline if id provided (ownership-checked)
      let brandGuideline: any = null;
      if (brandGuidelineId && typeof brandGuidelineId === 'string') {
        try {
          const bg = await prisma.brandGuideline.findFirst({
            where: { id: brandGuidelineId, userId: req.userId! },
          });
          if (bg) {
            brandGuideline = {
              id: bg.id,
              identity: bg.identity as any,
              logos: bg.logos as any,
              colors: bg.colors as any,
              typography: bg.typography as any,
              tags: bg.tags as any,
              media: bg.media as any,
              tokens: bg.tokens as any,
              guidelines: bg.guidelines as any,
              strategy: (bg as any).strategy,
            };
          }
        } catch (err) {
          console.warn('[generate-smart-prompt] failed to load brand guideline:', err);
        }
      }

      await chargeCredits(req.userId!, 1, { isUserApiKey: !!userApiKey });
      const result = await generateSmartPrompt(
        {
          baseImage: baseImage || null,
          designType,
          brandingTags: brandingTags || [],
          categoryTags: categoryTags || [],
          locationTags: locationTags || [],
          angleTags: angleTags || [],
          lightingTags: lightingTags || [],
          effectTags: effectTags || [],
          materialTags: materialTags || [],
          selectedColors: selectedColors || [],
          aspectRatio: aspectRatio || '16:9',
          generateText: generateText || false,
          withHuman: withHuman || false,
          enhanceTexture: enhanceTexture || false,
          removeText: removeText || false,
          negativePrompt: negativePrompt || '',
          additionalPrompt: additionalPrompt || '',
          instructions: instructions || '',
          brandGuideline,
          userId: req.userId,
          vibeId: typeof vibeId === 'string' ? vibeId : undefined,
          learnFromHistory: learnFromHistory !== false,
          detectedLanguage: typeof detectedLanguage === 'string' ? detectedLanguage : undefined,
        },
        userApiKey
      );

      // 💾 CACHE SET
      await redisClient.setex(cacheKey, CACHE_TTL.AI_TEXT, JSON.stringify(result)).catch(() => {});

      // Track total tokens
      (async () => {
        try {
          const totalTokens = (result.inputTokens || 0) + (result.outputTokens || 0);
          if (totalTokens > 0) {
            await incrementUserGenerations(req.userId!, 0, totalTokens);
          }
        } catch (err) {
          console.error('Error tracking tokens for smart prompt:', err);
        }
      })();

      res.json(result);
    } catch (error: any) {
      console.error('Error generating smart prompt:', error);
      next(error);
    }
  }
);

/**
 * POST /api/ai/suggest-prompt-variations
 * Generate variations of a prompt
 */
router.post(
  '/suggest-prompt-variations',
  apiRateLimiter,
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const { prompt } = req.body;

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      // 🟢 CACHE CHECK
      const hash = hashQuery(prompt);
      const cacheKey = CacheKey.aiText('variations', req.userId!, hash);
      const cached = await redisClient.get(cacheKey).catch(() => null);
      if (cached) {
        console.log(`[Cache] HIT ai:variations:${hash.slice(0, 8)}`);
        return res.json({ ...JSON.parse(cached), fromCache: true });
      }

      // Try to use user's API key first, fallback to system key
      let userApiKey: string | undefined;
      try {
        userApiKey = await getGeminiApiKey(req.userId!);
      } catch (error) {
        // User doesn't have API key, will use system key
      }

      await chargeCredits(req.userId!, 1, { isUserApiKey: !!userApiKey });
      const result = await suggestPromptVariations(prompt, userApiKey);

      // 💾 CACHE SET
      await redisClient.setex(cacheKey, CACHE_TTL.AI_TEXT, JSON.stringify(result)).catch(() => {});

      // Track usage asynchronously
      (async () => {
        try {
          await connectToMongoDB();
          const db = getDb();
          const usageRecord = createUsageRecord(
            req.userId!,
            0, // images
            GEMINI_MODELS.TEXT,
            false, // hasInputImage
            prompt.length,
            undefined, // resolution
            'branding', // feature
            'system',
            result.inputTokens,
            result.outputTokens
          );
          (usageRecord as any).type = 'branding';

          await db.collection('usage_records').insertOne(usageRecord);

          // Track total tokens for user stats
          const totalTokens = (result.inputTokens || 0) + (result.outputTokens || 0);
          if (totalTokens > 0) {
            await incrementUserGenerations(req.userId!, 0, totalTokens);
          }
        } catch (err) {
          console.error('Error tracking usage for suggest-prompt-variations:', err);
        }
      })();

      res.json({ variations: result.variations });
    } catch (error: any) {
      console.error('Error suggesting prompt variations:', error);
      next(error);
    }
  }
);

/**
 * POST /api/ai/change-object
 * Change an object in a mockup image
 */
router.post('/change-object', apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { baseImage, newObject, model, resolution } = req.body;

    if (!baseImage || (!baseImage.base64 && !baseImage.url) || !baseImage.mimeType) {
      return res.status(400).json({ error: 'Base image is required' });
    }

    if (!newObject || typeof newObject !== 'string' || newObject.trim().length === 0) {
      return res.status(400).json({ error: 'New object description is required' });
    }

    // 🟢 CACHE CHECK
    const hash = hashObject({ baseImage, newObject, model, resolution });
    const cacheKey = CacheKey.aiText('changeobj', req.userId!, hash);
    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) {
      console.log(`[Cache] HIT ai:changeobj:${hash.slice(0, 8)}`);
      return res.json({ ...JSON.parse(cached), fromCache: true });
    }

    // Try to use user's API key first, fallback to system key
    let userApiKey: string | undefined;
    try {
      userApiKey = await getGeminiApiKey(req.userId!);
    } catch (error) {
      // User doesn't have API key, will use system key
    }

    await chargeCredits(req.userId!, 2, { isUserApiKey: !!userApiKey });
    const imageBase64 = await changeObjectInMockup(
      baseImage as UploadedImage,
      newObject,
      (model as GeminiModel) || GEMINI_MODELS.IMAGE_FLASH,
      resolution as Resolution | undefined,
      undefined, // onRetry
      userApiKey
    );

    // 💾 CACHE SET
    await redisClient
      .setex(cacheKey, CACHE_TTL.AI_IMAGE_GEN, JSON.stringify({ imageBase64 }))
      .catch(() => {});

    // Track total generations
    (async () => {
      try {
        await incrementUserGenerations(req.userId!, 1, 0);
      } catch (err) {
        console.error('Error tracking generation for change-object:', err);
      }
    })();

    res.json({ imageBase64 });
  } catch (error: any) {
    console.error('Error changing object:', error);
    next(error);
  }
});

/**
 * POST /api/ai/apply-theme
 * Apply a theme to a mockup image
 */
router.post('/apply-theme', apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { baseImage, themes, model, resolution } = req.body;

    if (!baseImage || (!baseImage.base64 && !baseImage.url) || !baseImage.mimeType) {
      return res.status(400).json({ error: 'Base image is required' });
    }

    if (!themes || !Array.isArray(themes) || themes.length === 0) {
      return res.status(400).json({ error: 'Themes array is required' });
    }

    // 🟢 CACHE CHECK
    const hash = hashObject({ baseImage, themes, model, resolution });
    const cacheKey = CacheKey.aiText('theme', req.userId!, hash);
    const cached = await redisClient.get(cacheKey).catch(() => null);
    if (cached) {
      console.log(`[Cache] HIT ai:theme:${hash.slice(0, 8)}`);
      return res.json({ ...JSON.parse(cached), fromCache: true });
    }

    // Try to use user's API key first, fallback to system key
    let userApiKey: string | undefined;
    try {
      userApiKey = await getGeminiApiKey(req.userId!);
    } catch (error) {
      // User doesn't have API key, will use system key
    }

    await chargeCredits(req.userId!, 2, { isUserApiKey: !!userApiKey });
    const imageBase64 = await applyThemeToMockup(
      baseImage as UploadedImage,
      themes,
      (model as GeminiModel) || GEMINI_MODELS.IMAGE_FLASH,
      resolution as Resolution | undefined,
      undefined, // onRetry
      userApiKey
    );

    // 💾 CACHE SET
    await redisClient
      .setex(cacheKey, CACHE_TTL.AI_IMAGE_GEN, JSON.stringify({ imageBase64 }))
      .catch(() => {});

    // Track total generations
    (async () => {
      try {
        await incrementUserGenerations(req.userId!, 1, 0);
      } catch (err) {
        console.error('Error tracking generation for apply-theme:', err);
      }
    })();

    res.json({ imageBase64 });
  } catch (error: any) {
    console.error('Error applying theme:', error);
    next(error);
  }
});

/**
 * POST /api/ai/generate/stream
 * Stream AI text generation using Server-Sent Events (SSE).
 * Provides real-time response for better UX.
 */
router.post('/generate/stream', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  const { prompt, systemPrompt, brandGuidelineId } = req.body;

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  try {
    // Get user's API key or use system key
    let userApiKey: string | undefined;
    try {
      userApiKey = await getGeminiApiKey(req.userId!);
    } catch {
      // Use system key
    }

    // Build context with brand if provided
    let fullSystemPrompt = systemPrompt || '';
    if (brandGuidelineId) {
      try {
        const brandGuideline = await prisma.brandGuideline.findUnique({
          where: { id: brandGuidelineId },
        });
        if (brandGuideline) {
          const guidelineData = {
            id: brandGuideline.id,
            identity: brandGuideline.identity as any,
            logos: brandGuideline.logos as any,
            colors: brandGuideline.colors as any,
            typography: brandGuideline.typography as any,
            tags: brandGuideline.tags as any,
            media: brandGuideline.media as any,
            tokens: brandGuideline.tokens as any,
            guidelines: brandGuideline.guidelines as any,
          };
          const brandContext = buildBrandContextForImageGen(guidelineData);
          fullSystemPrompt = `${brandContext}\n\n${fullSystemPrompt}`;
        }
      } catch (err) {
        console.warn('[stream] Failed to load brand guideline:', err);
      }
    }

    await chargeCredits(req.userId!, 1, { isUserApiKey: !!userApiKey });

    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const { GENERIC_SYSTEM_PROMPT } = await import('../services/geminiService.js');
    const apiKey =
      userApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const model = genAI.getGenerativeModel({
      model: GEMINI_MODELS.TEXT,
      systemInstruction: fullSystemPrompt || GENERIC_SYSTEM_PROMPT,
    });

    // Build content
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];

    // Start streaming
    const result = await model.generateContentStream({ contents });

    let totalText = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) {
        totalText += text;
        // Send SSE event
        res.write(`data: ${JSON.stringify({ text, done: false })}\n\n`);
      }
    }

    // Send completion event
    res.write(`data: ${JSON.stringify({ text: '', done: true, fullText: totalText })}\n\n`);
    res.end();

    // Track usage asynchronously
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
          'branding',
          'system',
          Math.ceil(prompt.length / 4), // estimate input tokens
          Math.ceil(totalText.length / 4) // estimate output tokens
        );
        await db.collection('usage_records').insertOne(usageRecord);
      } catch (err) {
        console.error('Error tracking usage for stream:', err);
      }
    })();
  } catch (error: any) {
    console.error('Error in streaming generation:', error);
    // Send error as SSE event
    res.write(
      `data: ${JSON.stringify({ error: error.message || 'Stream failed', done: true })}\n\n`
    );
    res.end();
  }
});

/**
 * GET /api/ai/metrics
 * Get AI system metrics (cache hits, circuit breaker status).
 * Admin only.
 */
router.get('/metrics', authenticate, async (req: AuthRequest, res) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const { getAIMetrics } = await import('../lib/ai-wrapper.js');
    const metrics = getAIMetrics();
    res.json(metrics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /ai/generate-naming
 * Generate brand/product name suggestions from a brief.
 *
 * Naming Machine additions (all optional, appended at the end of the body —
 * additive/retrocompatible, see .agent/plans/NAMING-MACHINE.md):
 *   seen, liked, superliked, rejected — string[] of names from prior rounds
 *   tasteReading — qualitative read of the user's taste (from naming-insight)
 *   territories — symbolic territories to distribute this round across
 */
router.post('/generate-naming', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  const {
    brief,
    count = 10,
    style,
    brandGuidelineId,
    seen,
    liked,
    superliked,
    rejected,
    tasteReading,
    territories,
  } = req.body;
  if (!brief || typeof brief !== 'string') {
    return res.status(400).json({ error: 'brief is required' });
  }
  if (count !== undefined && (typeof count !== 'number' || count < 1 || count > 50)) {
    return res.status(400).json({ error: 'count must be a number between 1 and 50' });
  }

  const MAX_LIST = 200;
  const MAX_ITEM_LEN = 120;
  const validStringArray = (val: unknown, name: string): string[] | undefined => {
    if (val === undefined) return undefined;
    if (!Array.isArray(val) || val.length > MAX_LIST) {
      throw Object.assign(new Error(`${name} must be an array of at most ${MAX_LIST} strings`), {
        status: 400,
      });
    }
    return val
      .filter((v) => typeof v === 'string')
      .map((v) => sanitizeForPrompt(v, MAX_ITEM_LEN));
  };

  let seenArr: string[] | undefined;
  let likedArr: string[] | undefined;
  let superlikedArr: string[] | undefined;
  let rejectedArr: string[] | undefined;
  let territoriesArr: string[] | undefined;
  try {
    seenArr = validStringArray(seen, 'seen');
    likedArr = validStringArray(liked, 'liked');
    superlikedArr = validStringArray(superliked, 'superliked');
    rejectedArr = validStringArray(rejected, 'rejected');
    territoriesArr = validStringArray(territories, 'territories');
  } catch (err: any) {
    return res.status(err.status || 400).json({ error: err.message });
  }
  if (tasteReading !== undefined && typeof tasteReading !== 'string') {
    return res.status(400).json({ error: 'tasteReading must be a string' });
  }

  try {
    const userOwnKey = await getGeminiApiKey(req.userId!, { skipFallback: true });
    const apiKey = userOwnKey || (await getGeminiApiKey(req.userId!));
    if (!apiKey) throw new Error('Gemini API key not configured');
    await chargeCredits(req.userId!, 1, { isUserApiKey: !!userOwnKey });
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODELS.FLASH });

    let brandContext = '';
    if (brandGuidelineId) {
      const g = await prisma.brandGuideline.findUnique({ where: { id: brandGuidelineId } });
      if (g) brandContext = buildBrandContextForImageGen(g as any);
    }

    const { buildNamingPrompt } = await import('../lib/prompts/namingPrompt.js');
    const prompt = buildNamingPrompt({
      brief: sanitizeForPrompt(brief, 2000),
      count,
      style: style ? sanitizeForPrompt(style, 200) : undefined,
      brandContext: brandContext || undefined,
      seen: seenArr,
      liked: likedArr,
      superliked: superlikedArr,
      rejected: rejectedArr,
      tasteReading: tasteReading ? sanitizeForPrompt(tasteReading, 800) : undefined,
      territories: territoriesArr,
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Failed to parse naming response' });
    const parsed = JSON.parse(jsonMatch[0]);

    // Server-side dedupe against `seen` — belt and suspenders on top of the prompt instruction.
    if (Array.isArray(parsed?.names) && seenArr?.length) {
      const seenLower = new Set(seenArr.map((s) => s.toLowerCase().trim()));
      parsed.names = parsed.names.filter(
        (n: any) => !seenLower.has(String(n?.name || '').toLowerCase().trim())
      );
    }

    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /ai/naming-briefing
 * Naming Machine — conversational briefing extraction (Imersão step of the
 * naming methodology). No credit charge — runs on completeCheapText.
 * Body: { concept: string, answers?: Array<{ id: string, value: string }>,
 *          brief?: object|null, imageUrl?: string }
 */
router.post('/naming-briefing', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  const { concept, answers, brief, imageUrl } = req.body;
  if (!concept || typeof concept !== 'string' || !concept.trim()) {
    return res.status(400).json({ error: 'concept is required' });
  }
  if (concept.length > 4000) {
    return res.status(400).json({ error: 'concept is too long (max 4000 chars)' });
  }
  if (answers !== undefined) {
    if (!Array.isArray(answers) || answers.length > 20) {
      return res.status(400).json({ error: 'answers must be an array of at most 20 items' });
    }
    for (const a of answers) {
      if (!a || typeof a.id !== 'string' || typeof a.value !== 'string') {
        return res.status(400).json({ error: 'each answer needs { id: string, value: string }' });
      }
    }
  }
  if (imageUrl !== undefined && typeof imageUrl !== 'string') {
    return res.status(400).json({ error: 'imageUrl must be a string' });
  }

  const conceptSafe = sanitizeForPrompt(concept, 4000);
  const answersSafe = Array.isArray(answers)
    ? answers.map((a: any) => ({
        id: sanitizeForPrompt(String(a.id), 60),
        value: sanitizeForPrompt(String(a.value), 300),
      }))
    : [];

  // Best-effort image description — only if a describe-image path is available
  // AND free. describeImage() in geminiService.ts charges credits, which would
  // break this endpoint's "no credit charge" contract, so we deliberately skip
  // it rather than silently billing the user. Kept as a documented decision.
  const imageNote = '';

  const fallback = () => {
    res.json({
      brief: null,
      nextQuestion: null,
      done: true,
      briefText: conceptSafe,
    });
  };

  try {
    const system = `You are conducting the "Imersão" (immersion) step of the Visant naming methodology: extracting the essence of a brand/product before generating names.

Extract from the concept (and any prior answers) a structured brief:
{ "produto": string, "diferencial": string, "eloEmocional": string, "atributos": string[] (3-5 essence attributes), "decisor": string (who signs off / the buying decision-maker), "territorios": string[] (symbolic territories to explore, e.g. "solidez", "energia", "guardião"), "proibidos": string[] (forbidden territories/associations, business-driven — semantics before aesthetics), "estilos": string[] (naming technique/style leanings), "geografia": string|null, "idioma": "pt"|"en"|other }

Also return "faltando": string[] — which of the above fields are still missing or too vague to use, and "confianca": an object mapping each field name to a 0-1 confidence score.

Ask ONLY about what's missing. Maximum 4 questions total across the whole session (track via the answers already given). Vary the question format — never the same kind twice in a row: "chips" (multi-select suggestions), "binary" (a forced pair, e.g. "Pertencer ⟷ Vencer"), "cards" (named technique examples to pick from), "text" (short open field), "toggle" (yes/no). Respond in the same language as the concept.

Respond ONLY with strict JSON: { "brief": {...fields above...}, "faltando": string[], "confianca": {...}, "nextQuestion": { "id": string, "kind": "chips"|"binary"|"cards"|"text"|"toggle", "prompt": string, "options"?: string[] } | null, "done": boolean, "briefText": string }
"briefText" is a rich prose paragraph of the brief so far, ready to be used verbatim as the naming brief. "done" is true when nothing essential is missing, or when the answers already cover everything (max 4 questions reached).`;

    const userParts = [`Concept: ${conceptSafe}`];
    if (brief && typeof brief === 'object') {
      userParts.push(`Prior extracted brief: ${JSON.stringify(brief).slice(0, 3000)}`);
    }
    if (answersSafe.length) {
      userParts.push(
        `Answers so far:\n${answersSafe.map((a) => `- ${a.id}: ${a.value}`).join('\n')}`
      );
    }
    if (imageNote) userParts.push(imageNote);

    const { text } = await completeCheapText({
      system,
      user: userParts.join('\n\n'),
      userId: req.userId,
      json: true,
      maxTokens: 900,
      temperature: 0.6,
    });

    const parsed = parseJsonLoose<any>(text);
    if (!parsed || typeof parsed !== 'object') return fallback();

    const kinds = ['chips', 'binary', 'cards', 'text', 'toggle'];
    let nextQuestion = null;
    if (parsed.nextQuestion && typeof parsed.nextQuestion === 'object') {
      const nq = parsed.nextQuestion;
      if (kinds.includes(nq.kind) && typeof nq.prompt === 'string') {
        nextQuestion = {
          id: typeof nq.id === 'string' ? nq.id : 'q',
          kind: nq.kind,
          prompt: nq.prompt,
          ...(Array.isArray(nq.options) ? { options: nq.options.slice(0, 8) } : {}),
        };
      }
    }

    res.json({
      brief: parsed.brief && typeof parsed.brief === 'object' ? parsed.brief : null,
      nextQuestion: answersSafe.length >= 4 ? null : nextQuestion,
      done: !!parsed.done || answersSafe.length >= 4 || !nextQuestion,
      briefText: typeof parsed.briefText === 'string' ? parsed.briefText : conceptSafe,
    });
  } catch (error: any) {
    console.warn('[naming-briefing] falling back:', error?.message || error);
    fallback();
  }
});

/**
 * POST /ai/naming-insight
 * Naming Machine — qualitative taste-pattern reading (self-learning loop
 * layer 2) and full finalist defense. No credit charge — completeCheapText.
 */
router.post('/naming-insight', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  const { mode } = req.body;
  if (mode !== 'pattern' && mode !== 'defense') {
    return res.status(400).json({ error: 'mode must be "pattern" or "defense"' });
  }

  const MAX_LIST = 200;
  const asStringArray = (val: unknown, name: string): string[] => {
    if (val === undefined) return [];
    if (!Array.isArray(val) || val.length > MAX_LIST) {
      throw Object.assign(new Error(`${name} must be an array of at most ${MAX_LIST} strings`), {
        status: 400,
      });
    }
    return val.filter((v) => typeof v === 'string').map((v) => sanitizeForPrompt(v, 120));
  };

  try {
    if (mode === 'pattern') {
      const liked = asStringArray(req.body.liked, 'liked');
      const superliked = asStringArray(req.body.superliked, 'superliked');
      const rejected = asStringArray(req.body.rejected, 'rejected');
      const stats =
        req.body.stats && typeof req.body.stats === 'object' ? req.body.stats : undefined;

      const fallback = () => res.json({ reading: '' });
      try {
        const system = `You read taste patterns for a brand-naming swipe deck. Given liked/superliked/rejected name lists (and optional stats by territory/technique), produce a 1-2 sentence qualitative reading of the user's taste — phonetic pattern, symbolic territory, naming technique. Weight rejection heavily: "rejeição clara é presente" — a clear rejection pattern is worth more than ten positive references, so lead with what's being avoided when it's clear. Respond in the same language as the input names (default Portuguese). Respond ONLY with JSON: { "reading": string }`;
        const user = [
          `Liked: ${liked.join(', ') || '(none)'}`,
          `Superliked: ${superliked.join(', ') || '(none)'}`,
          `Rejected: ${rejected.join(', ') || '(none)'}`,
          stats ? `Stats: ${JSON.stringify(stats).slice(0, 1500)}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        const { text } = await completeCheapText({
          system,
          user,
          userId: req.userId,
          json: true,
          maxTokens: 300,
          temperature: 0.5,
        });
        const parsed = parseJsonLoose<any>(text);
        const reading = typeof parsed?.reading === 'string' ? parsed.reading : '';
        return res.json({ reading });
      } catch (err: any) {
        console.warn('[naming-insight:pattern] falling back:', err?.message || err);
        return fallback();
      }
    }

    // mode === 'defense'
    const { name, briefText } = req.body;
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'name is required' });
    }
    if (briefText !== undefined && typeof briefText !== 'string') {
      return res.status(400).json({ error: 'briefText must be a string' });
    }
    const nameSafe = sanitizeForPrompt(name, 60);
    const briefSafe = sanitizeForPrompt(briefText || '', 3000);

    const fallback = () =>
      res.json({ concept: nameSafe, layers: [], risks: [] });
    try {
      const system = `You write the "full finalist defense" of a brand name, following the Visant naming methodology's presentation format (section 7): a name is consequence of a concept, never the other way around. Produce 3-6 GENUINE layers only (linguistic roots, cultural resonance, symbolic associations, brand-architecture fit, practical advantages) — never force a layer that doesn't exist. Also list honest risks (famous homonyms, pronunciation ambiguity, cultural traps, domain availability) — never promise legal/trademark clearance. Respond in the same language as the brief (default Portuguese). Respond ONLY with JSON: { "concept": string, "layers": string[], "risks": string[] }`;
      const user = `Name: ${nameSafe}\nBrief: ${briefSafe || '(no brief provided)'}`;

      const { text } = await completeCheapText({
        system,
        user,
        userId: req.userId,
        json: true,
        maxTokens: 700,
        temperature: 0.6,
      });
      const parsed = parseJsonLoose<any>(text);
      if (!parsed || typeof parsed !== 'object') return fallback();
      res.json({
        concept: typeof parsed.concept === 'string' ? parsed.concept : nameSafe,
        layers: Array.isArray(parsed.layers) ? parsed.layers.filter((l: any) => typeof l === 'string').slice(0, 6) : [],
        risks: Array.isArray(parsed.risks) ? parsed.risks.filter((r: any) => typeof r === 'string').slice(0, 6) : [],
      });
    } catch (err: any) {
      console.warn('[naming-insight:defense] falling back:', err?.message || err);
      fallback();
    }
  } catch (error: any) {
    res.status(error.status || 500).json({ error: error.message });
  }
});

/**
 * POST /ai/rename-colors
 * Generate brand-coherent 1-word names for colors and compute all color codes.
 * Body: { colors: Array<{ hex: string; currentName?: string }>, brandGuidelineId: string }
 */
router.post('/rename-colors', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  const { colors, brandGuidelineId } = req.body;
  if (!colors?.length) return res.status(400).json({ error: 'colors array is required' });

  try {
    const userOwnKey = await getGeminiApiKey(req.userId!, { skipFallback: true });
    const apiKey = userOwnKey || (await getGeminiApiKey(req.userId!));
    if (!apiKey) throw new Error('Gemini API key not configured');
    await chargeCredits(req.userId!, 1, { isUserApiKey: !!userOwnKey });
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODELS.FLASH });

    let brandContext = '';
    if (brandGuidelineId) {
      const g = await prisma.brandGuideline.findUnique({ where: { id: brandGuidelineId } });
      if (g) {
        const { buildBrandContext } = await import('../lib/brandContextBuilder.js');
        brandContext = buildBrandContext(g as any, {
          sections: ['identity', 'strategy', 'voice'],
          compact: true,
          includeLogos: false,
          includeMedia: false,
        });
      }
    }

    const colorList = colors
      .map(
        (c: any, i: number) =>
          `${i + 1}. HEX: ${c.hex}${c.currentName ? ` (current: "${c.currentName}")` : ''}`
      )
      .join('\n');

    const prompt = `${
      brandContext ? `Brand context:\n${brandContext}\n\n` : ''
    }You are a brand color naming expert.

Given these ${colors.length} colors, generate a unique single-word name for each that:
- Reflects the tone/mood of the color AND the brand personality
- Is evocative, memorable, and poetic (not generic like "Blue" or "Dark")
- Uses words from nature, emotions, materials, or abstract concepts
- Each name must be UNIQUE — no repeated words
- Names should feel cohesive as a palette family
- Maximum 1 word per color, in the brand's primary language (detect from brand context, default Portuguese)

Colors:
${colorList}

Also compute the exact color codes for each. Use the HEX value provided to calculate:
- RGB (R, G, B values 0-255)
- HSL (H degrees, S percentage, L percentage)
- CMYK (C, M, Y, K values 0-100)
- Nearest Pantone color (use closest standard Pantone Coated reference)

Respond ONLY with valid JSON:
{
  "colors": [
    {
      "index": 0,
      "hex": "#XXXXXX",
      "name": "SingleWord",
      "rgb": { "r": 0, "g": 0, "b": 0 },
      "hsl": { "h": 0, "s": 0, "l": 0 },
      "cmyk": { "c": 0, "m": 0, "y": 0, "k": 0 },
      "pantone": "Pantone XXXX C"
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Failed to parse color naming response' });
    res.json(JSON.parse(jsonMatch[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /ai/extract-colors
 * Extract a color palette from an image URL or base64.
 */
router.post('/extract-colors', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  const { image } = req.body; // { base64?, url?, mimeType? }
  if (!image) return res.status(400).json({ error: 'image is required' });

  try {
    const userOwnKey = await getGeminiApiKey(req.userId!, { skipFallback: true });
    const apiKey = userOwnKey || (await getGeminiApiKey(req.userId!));
    if (!apiKey) throw new Error('Gemini API key not configured');
    await chargeCredits(req.userId!, 1, { isUserApiKey: !!userOwnKey });
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: GEMINI_MODELS.FLASH });

    let base64Data = image.base64;
    let mimeType = image.mimeType || 'image/png';

    if (!base64Data && image.url) {
      const { safeFetch } = await import('../utils/securityValidation.js');
      const resp = await safeFetch(image.url);
      if (!resp.ok) return res.status(400).json({ error: 'Failed to fetch image URL' });
      const buf = Buffer.from(await resp.arrayBuffer());
      base64Data = buf.toString('base64');
      mimeType = resp.headers.get('content-type') || mimeType;
    }

    if (!base64Data) return res.status(400).json({ error: 'Could not resolve image data' });

    const result = await model.generateContent([
      {
        inlineData: { data: base64Data, mimeType },
      },
      `Analyze this image and extract the dominant color palette.
Respond ONLY with valid JSON:
{
  "colors": [
    { "hex": string, "name": string, "role": "primary"|"secondary"|"accent"|"background"|"neutral", "frequency": "dominant"|"common"|"rare" }
  ]
}
Order colors from most dominant to least dominant. Extract between 4 and 10 colors.`,
    ]);

    const text = result.response.text().trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch)
      return res.status(500).json({ error: 'Failed to parse color extraction response' });
    res.json(JSON.parse(jsonMatch[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/ai/riso-enhance
 * Apply AI risograph enhancement to an image using Gemini image generation.
 */
router.post('/riso-enhance', apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { image, prompt } = req.body;

    if (!image || (!image.base64 && !image.url) || !image.mimeType) {
      return res.status(400).json({ error: 'Image is required (base64 or url + mimeType)' });
    }
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    let userApiKey: string | undefined;
    try {
      userApiKey = await getGeminiApiKey(req.userId!);
    } catch {
      // Will use system key
    }

    await chargeCredits(req.userId!, 2, { isUserApiKey: !!userApiKey });
    const { resolveImageBase64 } = await import('../services/geminiService.js');
    const { GoogleGenAI, Modality } = await import('@google/genai');

    const apiKey =
      userApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    const genAI = new GoogleGenAI({ apiKey: apiKey.trim() });

    const base64Data = await resolveImageBase64(image as UploadedImage);

    const response = await genAI.models.generateContent({
      model: GEMINI_MODELS.IMAGE_FLASH,
      contents: [
        {
          parts: [{ inlineData: { data: base64Data, mimeType: image.mimeType } }, { text: prompt }],
        },
      ],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const imageBase64 = part.inlineData.data as string;
        const mimeType = part.inlineData.mimeType || 'image/png';
        const dataUrl = `data:${mimeType};base64,${imageBase64}`;

        (async () => {
          try {
            await incrementUserGenerations(req.userId!, 1, 0);
          } catch (err) {
            console.error('Error tracking generation for riso-enhance:', err);
          }
        })();

        return res.json({ imageUrl: dataUrl });
      }
    }

    res.status(500).json({ error: 'No image was generated' });
  } catch (error: any) {
    console.error('Error in riso-enhance:', error);
    next(error);
  }
});

export default router;
