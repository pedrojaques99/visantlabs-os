import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import {
  improvePrompt,
  describeImage,
  suggestCategories,
  generateSmartPrompt,
  suggestPromptVariations,
  changeObjectInMockup,
  applyThemeToMockup,
} from '@/services/geminiService.js';
import { getGeminiApiKey } from '../utils/geminiApiKey.js';
import type { UploadedImage, GeminiModel, Resolution } from '@/types/types.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { createUsageRecord } from '../utils/usageTracking.js';

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

    const improvedPrompt = await improvePrompt(prompt, userApiKey);

    res.json({ improvedPrompt });
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
    } else if (image.base64 && image.mimeType) {
      imageInput = image as UploadedImage;
    } else {
      return res.status(400).json({ error: 'Invalid image format' });
    }

    const description = await describeImage(imageInput, userApiKey);

    res.json({ description });
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

    if (!baseImage || !baseImage.base64 || !baseImage.mimeType) {
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
          'mockupmachine', // feature
          'system',
          result.inputTokens,
          result.outputTokens
        );
        // Add specific type for admin stats
        (usageRecord as any).type = 'branding';

        await db.collection('usage_records').insertOne(usageRecord);
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
  try {
    const { baseImage } = req.body;

    if (!baseImage || !baseImage.base64 || !baseImage.mimeType) {
      return res.status(400).json({ error: 'Base image is required' });
    }

    // Try to use user's API key first, fallback to system key
    let userApiKey: string | undefined;
    try {
      userApiKey = await getGeminiApiKey(req.userId!);
    } catch (error) {
      // User doesn't have API key
    }

    // Fetch all available tags/presets from database
    let availableTags: any = undefined;
    try {
      await connectToMongoDB();
      const db = getDb();

      const [
        brandingDocs,
        mockupDocs,
        locationDocs,
        angleDocs,
        lightingDocs,
        effectDocs,
        textureDocs
      ] = await Promise.all([
        db.collection('branding_presets').find({}, { projection: { name: 1 } }).toArray(),
        db.collection('mockup_presets').find({}, { projection: { name: 1 } }).toArray(),
        db.collection('ambience_presets').find({}, { projection: { name: 1 } }).toArray(),
        db.collection('angle_presets').find({}, { projection: { name: 1 } }).toArray(),
        db.collection('luminance_presets').find({}, { projection: { name: 1 } }).toArray(),
        db.collection('effect_presets').find({}, { projection: { name: 1 } }).toArray(),
        db.collection('texture_presets').find({}, { projection: { name: 1 } }).toArray()
      ]);

      availableTags = {
        branding: brandingDocs.map(d => d.name),
        categories: [...new Set(mockupDocs.map(d => d.name))], // Mockup presets usually mapped to categories
        locations: locationDocs.map(d => d.name),
        angles: angleDocs.map(d => d.name),
        lighting: lightingDocs.map(d => d.name),
        effects: effectDocs.map(d => d.name),
        materials: textureDocs.map(d => d.name)
      };
    } catch (dbError) {
      console.warn('Failed to fetch dynamic tags for analysis, falling back to defaults:', dbError);
      // availableTags stays undefined, service uses defaults
    }

    const { analyzeMockupSetup } = await import('@/services/geminiService.js');
    const analysis = await analyzeMockupSetup(baseImage as UploadedImage, userApiKey, availableTags);

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
          'mockupmachine', // feature
          'system',
          analysis.inputTokens,
          analysis.outputTokens
        );
        // Add specific type for admin stats
        (usageRecord as any).type = 'branding';

        await db.collection('usage_records').insertOne(usageRecord);
      } catch (err) {
        console.error('Error tracking usage for analyze-setup:', err);
      }
    })();

    res.json(analysis);
  } catch (error: any) {
    console.error('Error analyzing mockup setup:', error);
    next(error);
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
    }, userApiKey);

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

    const variations = await suggestPromptVariations(prompt, userApiKey);

    res.json({ variations });
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

    if (!baseImage || !baseImage.base64 || !baseImage.mimeType) {
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

    if (!baseImage || !baseImage.base64 || !baseImage.mimeType) {
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

    res.json({ imageBase64 });
  } catch (error: any) {
    console.error('Error applying theme:', error);
    next(error);
  }
});

export default router;

