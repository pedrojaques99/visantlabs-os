import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../db/prisma.js';
import { buildBrandContextForImageGen } from '../lib/brandContextBuilder.js';
import { GEMINI_MODELS } from '../../src/constants/geminiModels.js';

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

const router = express.Router();

/**
 * POST /api/ai/improve-prompt
 * Improve a text prompt using AI
 */
router.post('/improve-prompt', apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Try to use user's API key first, fallback to system key
    let userApiKey: string | undefined;
    try {
      userApiKey = await getGeminiApiKey(req.userId!);
    } catch (error) {
      // User doesn't have API key, will use system key
    }

    const result = await improvePrompt(prompt, userApiKey);

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
});

/**
 * POST /api/ai/describe-image
 * Generate a description of an image
 */
router.post('/describe-image', apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ error: 'Image is required' });
    }

    // Try to use user's API key first, fallback to system key
    let userApiKey: string | undefined;
    try {
      userApiKey = await getGeminiApiKey(req.userId!);
    } catch (error) {
      // User doesn't have API key, will use system key
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

    const result = await describeImage(imageInput, userApiKey);

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
});

/**
 * POST /api/ai/suggest-categories
 * Suggest mockup categories based on an image and branding tags
 */
router.post('/suggest-categories', apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { baseImage, brandingTags } = req.body;

    if (!baseImage || (!baseImage.base64 && !baseImage.url) || !baseImage.mimeType) {
      return res.status(400).json({ error: 'Base image is required' });
    }

    if (!Array.isArray(brandingTags)) {
      return res.status(400).json({ error: 'Branding tags must be an array' });
    }

    // Try to use user's API key first, fallback to system key
    let userApiKey: string | undefined;
    try {
      userApiKey = await getGeminiApiKey(req.userId!);
    } catch (error) {
      // User doesn't have API key, will use system key
    }

    const result = await suggestCategories(baseImage as UploadedImage, brandingTags, userApiKey);

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
});

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
router.post('/refine-suggestions', refineSuggestionsLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { imageDescription, selectedTags, changedCategory } = req.body;

    // Validate selectedTags structure
    if (!selectedTags || typeof selectedTags !== 'object') {
      return res.status(400).json({ error: 'selectedTags is required' });
    }

    if (!changedCategory || typeof changedCategory !== 'string') {
      return res.status(400).json({ error: 'changedCategory is required' });
    }

    // Get user's API key if available
    let userApiKey: string | undefined;
    try {
      userApiKey = await getGeminiApiKey(req.userId!);
    } catch {
      // Will use system key
    }

    // Get available tags for validation
    const availableTags = await getAllAvailableTags();

    const result = await refineSuggestions({
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
    }, userApiKey);

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
});

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
    if (process.env.NODE_ENV === 'development') console.log('[dev] analyze-setup: getGeminiApiKey + getAllAvailableTags done', ((Date.now() - t0) / 1000).toFixed(2) + 's');

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

    if (process.env.NODE_ENV === 'development') console.log('[dev] analyze-setup: calling analyzeMockupSetup');
    const result = await analyzeMockupSetup(
      baseImage as UploadedImage,
      userApiKey,
      availableTags,
      instructions,
      enrichedUserContext
    );
    if (process.env.NODE_ENV === 'development') console.log('[dev] analyze-setup: analyzeMockupSetup done', ((Date.now() - t0) / 1000).toFixed(2) + 's');

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

    if (process.env.NODE_ENV === 'development') console.log('[dev] analyze-setup: res.json', ((Date.now() - t0) / 1000).toFixed(2) + 's');
    res.json(result);
  } catch (error: any) {
    const msg = (typeof error?.message === 'string' ? error.message : null) || 'Internal server error';
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
router.post('/generate-smart-prompt', apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
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
      selectedColors,
      aspectRatio,
      generateText,
      withHuman,
      enhanceTexture,
      removeText,
      negativePrompt,
      additionalPrompt,
      instructions,
    } = req.body;

    if (!designType) {
      return res.status(400).json({ error: 'Design type is required' });
    }

    // Try to use user's API key first, fallback to system key
    let userApiKey: string | undefined;
    try {
      userApiKey = await getGeminiApiKey(req.userId!);
    } catch (error) {
      // User doesn't have API key, will use system key
    }

    const result = await generateSmartPrompt({
      baseImage: baseImage || null,
      designType,
      brandingTags: brandingTags || [],
      categoryTags: categoryTags || [],
      locationTags: locationTags || [],
      angleTags: angleTags || [],
      lightingTags: lightingTags || [],
      effectTags: effectTags || [],
      selectedColors: selectedColors || [],
      aspectRatio: aspectRatio || '16:9',
      generateText: generateText || false,
      withHuman: withHuman || false,
      enhanceTexture: enhanceTexture || false,
      removeText: removeText || false,
      negativePrompt: negativePrompt || '',
      additionalPrompt: additionalPrompt || '',
      instructions: instructions || '',
    }, userApiKey);

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
});

/**
 * POST /api/ai/suggest-prompt-variations
 * Generate variations of a prompt
 */
router.post('/suggest-prompt-variations', apiRateLimiter, authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Try to use user's API key first, fallback to system key
    let userApiKey: string | undefined;
    try {
      userApiKey = await getGeminiApiKey(req.userId!);
    } catch (error) {
      // User doesn't have API key, will use system key
    }

    const result = await suggestPromptVariations(prompt, userApiKey);

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
});

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

    // Try to use user's API key first, fallback to system key
    let userApiKey: string | undefined;
    try {
      userApiKey = await getGeminiApiKey(req.userId!);
    } catch (error) {
      // User doesn't have API key, will use system key
    }

    const imageBase64 = await changeObjectInMockup(
      baseImage as UploadedImage,
      newObject,
      (model as GeminiModel) || GEMINI_MODELS.IMAGE_FLASH,
      resolution as Resolution | undefined,
      undefined, // onRetry
      userApiKey
    );

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

    // Try to use user's API key first, fallback to system key
    let userApiKey: string | undefined;
    try {
      userApiKey = await getGeminiApiKey(req.userId!);
    } catch (error) {
      // User doesn't have API key, will use system key
    }

    const imageBase64 = await applyThemeToMockup(
      baseImage as UploadedImage,
      themes,
      (model as GeminiModel) || GEMINI_MODELS.IMAGE_FLASH,
      resolution as Resolution | undefined,
      undefined, // onRetry
      userApiKey
    );

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

    // Import Gemini SDK for streaming
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const { GENERIC_SYSTEM_PROMPT } = await import('../services/geminiService.js');
    const apiKey = userApiKey || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';
    const genAI = new GoogleGenerativeAI(apiKey.trim());
    const model = genAI.getGenerativeModel({ 
      model: GEMINI_MODELS.TEXT,
      systemInstruction: fullSystemPrompt || GENERIC_SYSTEM_PROMPT
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
    res.write(`data: ${JSON.stringify({ error: error.message || 'Stream failed', done: true })}\n\n`);
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

export default router;

