import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import {
  improvePrompt,
  describeImage,
  suggestCategories,
  generateSmartPrompt,
  suggestPromptVariations,
  analyzeMockupSetup,
  changeObjectInMockup,
  applyThemeToMockup,
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
router.post('/improve-prompt', authenticate, async (req: AuthRequest, res, next) => {
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
          'gemini-2.5-flash',
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
router.post('/describe-image', authenticate, async (req: AuthRequest, res, next) => {
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
          'gemini-2.5-flash',
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
router.post('/suggest-categories', authenticate, async (req: AuthRequest, res, next) => {
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
          'gemini-2.5-flash',
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

    if (process.env.NODE_ENV === 'development') console.log('[dev] analyze-setup: calling analyzeMockupSetup');
    const result = await analyzeMockupSetup(
      baseImage as UploadedImage,
      userApiKey,
      availableTags,
      instructions,
      userContext
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
          'gemini-2.5-flash',
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
router.post('/generate-smart-prompt', authenticate, async (req: AuthRequest, res, next) => {
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
router.post('/suggest-prompt-variations', authenticate, async (req: AuthRequest, res, next) => {
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
          'gemini-2.5-flash',
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
router.post('/change-object', authenticate, async (req: AuthRequest, res, next) => {
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
      (model as GeminiModel) || 'gemini-2.5-flash-image',
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
router.post('/apply-theme', authenticate, async (req: AuthRequest, res, next) => {
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
      (model as GeminiModel) || 'gemini-2.5-flash-image',
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

export default router;

