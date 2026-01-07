import express from 'express';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { ObjectId } from 'mongodb';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { uploadImageRateLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

// Helper function to check if preset ID exists in any collection (admin or community)
async function checkPresetIdExists(id: string): Promise<boolean> {
  await connectToMongoDB();
  const db = getDb();

  const collections = [
    'mockup_presets',
    'angle_presets',
    'texture_presets',
    'ambience_presets',
    'luminance_presets',
    'community_presets',
  ];

  for (const collectionName of collections) {
    const existing = await db.collection(collectionName).findOne({ id });
    if (existing) {
      return true;
    }
  }

  return false;
}

// Helper to normalize and validate category/presetType
function normalizeCategoryAndPresetType(body: any): { category: string; presetType?: string; error?: string } {
  const { category, presetType } = body;

  // Se tem category, usar ela
  if (category) {
    const validCategories = ['3d', 'presets', 'aesthetics', 'themes', 'mockup', 'angle', 'texture', 'ambience', 'luminance'];
    if (!validCategories.includes(category)) {
      return { category: '', error: 'Invalid category' };
    }

    // Se category é uma das antigas (mockup, angle, etc), não precisa de presetType
    if (['mockup', 'angle', 'texture', 'ambience', 'luminance'].includes(category)) {
      return { category };
    }

    // Se category é 'presets', presetType é obrigatório
    if (category === 'presets') {
      const validPresetTypes = ['mockup', 'angle', 'texture', 'ambience', 'luminance'];
      if (!presetType || !validPresetTypes.includes(presetType)) {
        return { category: '', error: 'presetType is required and must be valid when category is "presets"' };
      }
      return { category, presetType };
    }

    // Para outras categorias, não retornar presetType
    return { category };
  }

  // Compatibilidade: se não tem category mas tem presetType, inferir category = 'presets'
  if (presetType) {
    const validPresetTypes = ['mockup', 'angle', 'texture', 'ambience', 'luminance'];
    if (!validPresetTypes.includes(presetType)) {
      return { category: '', error: 'Invalid preset type' };
    }
    return { category: 'presets', presetType };
  }

  return { category: '', error: 'Either category or presetType is required' };
}

// Helper to migrate legacy preset (adds category if missing)
function migratePresetIfNeeded(preset: any): any {
  if (!preset.category && preset.presetType) {
    // Usa presetType como category diretamente
    return {
      ...preset,
      category: preset.presetType, // mockup, angle, etc vira category
      difficulty: preset.difficulty || 'intermediate',
      context: preset.presetType === 'mockup' ? 'mockup' : 'general',
      usageCount: preset.usageCount || 0,
    };
  }
  return preset;
}

// Create community preset
router.post('/presets', authenticate, async (req: AuthRequest, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();

    const { id, name, description, prompt, referenceImageUrl, aspectRatio, model, tags, difficulty, context, useCase, examples } = req.body;

    // Validation - campos obrigatórios
    if (!id || !name || !description || !prompt || !aspectRatio) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Normalizar category e presetType
    const categoryData = normalizeCategoryAndPresetType(req.body);
    if (categoryData.error) {
      return res.status(400).json({ error: categoryData.error });
    }

    // Check if ID already exists globally
    const idExists = await checkPresetIdExists(id);
    if (idExists) {
      return res.status(409).json({ error: 'Preset with this ID already exists' });
    }

    // Normalize tags - ensure it's an array of strings
    const normalizedTags = Array.isArray(tags)
      ? tags.filter(tag => typeof tag === 'string' && tag.trim().length > 0).map(tag => tag.trim())
      : [];

    // Normalize examples
    const normalizedExamples = Array.isArray(examples)
      ? examples.filter(ex => typeof ex === 'string' && ex.trim().length > 0).map(ex => ex.trim())
      : undefined;

    // Determinar se precisa de referenceImageUrl
    const needsReferenceImage = (categoryData.category === 'presets' && categoryData.presetType === 'mockup')
      || (categoryData.category !== 'presets' && referenceImageUrl);

    const preset: any = {
      userId: new ObjectId(req.userId!),
      category: categoryData.category,
      id,
      name,
      description,
      prompt,
      aspectRatio,
      model: model || undefined,
      tags: normalizedTags.length > 0 ? normalizedTags : undefined,
      isApproved: req.body.isApproved !== undefined ? req.body.isApproved : true, // Respect flag or auto-approval
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Adicionar presetType apenas se category for 'presets'
    if (categoryData.presetType) {
      preset.presetType = categoryData.presetType;
    }

    // Adicionar referenceImageUrl se necessário
    if (needsReferenceImage && referenceImageUrl) {
      preset.referenceImageUrl = referenceImageUrl;
    }

    // Adicionar novos campos opcionais
    if (difficulty) preset.difficulty = difficulty;
    if (context) preset.context = context;
    if (useCase) preset.useCase = useCase;
    if (normalizedExamples && normalizedExamples.length > 0) preset.examples = normalizedExamples;

    await db.collection('community_presets').insertOne(preset);

    // Create indexes if they don't exist
    try {
      await db.collection('community_presets').createIndex({ id: 1 }, { unique: true });
      await db.collection('community_presets').createIndex({ userId: 1 });
      await db.collection('community_presets').createIndex({ presetType: 1 });
      await db.collection('community_presets').createIndex({ category: 1 });
      await db.collection('community_presets').createIndex({ isApproved: 1 });
    } catch (e) {
      // Indexes might already exist, ignore
    }

    return res.status(201).json(preset);
  } catch (error: any) {
    console.error('Failed to create community preset:', error);
    if (error.code === 11000) {
      return res.status(409).json({ error: 'Preset with this ID already exists' });
    }
    return res.status(500).json({ error: 'Failed to create preset' });
  }
});

// Get public approved community presets (with optional auth for likes)
router.get('/presets/public', async (req, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();

    // Optional authentication for likes
    let userId: string | undefined;
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (token) {
        const jwt = await import('jsonwebtoken');
        const { JWT_SECRET } = await import('../utils/jwtSecret.js');
        const decoded = jwt.default.verify(token, JWT_SECRET) as { userId: string; email: string };
        userId = decoded.userId;
      }
    } catch (authError) {
      // Ignore auth errors - endpoint works without auth
    }

    const presets = await db.collection('community_presets')
      .find({ isApproved: true })
      .toArray();

    // Get likes data if user is authenticated
    const presetIds = presets.map((p: any) => p.id);
    const likesMap = userId ? await getPresetsLikesData(db, presetIds, userId) : new Map();

    // Migrar presets legados e agrupar por category
    const grouped: Record<string, any[]> = {
      '3d': [],
      'presets': [],
      'aesthetics': [],
      'themes': [],
      // Manter compatibilidade com formato antigo
      mockup: [],
      angle: [],
      texture: [],
      ambience: [],
      luminance: [],
    };

    presets.forEach((preset) => {
      // Migrar se necessário
      const migrated = migratePresetIfNeeded(preset);

      // Adicionar likes data
      const likesData = likesMap.get(migrated.id) || { likesCount: 0, isLikedByUser: false };
      const presetWithLikes = {
        ...migrated,
        likesCount: likesData.likesCount,
        isLikedByUser: likesData.isLikedByUser,
      };

      // Agrupar por category (nova estrutura)
      if (migrated.category && grouped[migrated.category]) {
        grouped[migrated.category].push(presetWithLikes);
      }

      // Manter compatibilidade: também agrupar por presetType (formato antigo)
      if (migrated.presetType && grouped[migrated.presetType]) {
        grouped[migrated.presetType].push(presetWithLikes);
      }
    });

    return res.json(grouped);
  } catch (error) {
    console.error('Failed to load community presets:', error);
    return res.json({
      '3d': [],
      'presets': [],
      'aesthetics': [],
      'themes': [],
      // Compatibilidade
      mockup: [],
      angle: [],
      texture: [],
      ambience: [],
      luminance: [],
    });
  }
});

// Get global community stats
router.get('/stats', async (req, res) => {
  try {
    const { prisma } = await import('../db/prisma.js');
    await connectToMongoDB();
    const db = getDb();

    const [totalUsers, totalPresets, totalBlankMockups] = await Promise.all([
      prisma.user.count(),
      db.collection('community_presets').countDocuments({ isApproved: true }),
      db.collection('mockups').countDocuments({ designType: 'blank' }),
    ]);

    return res.json({
      totalUsers,
      totalPresets,
      totalBlankMockups,
    });
  } catch (error) {
    console.error('Failed to fetch community stats:', error);
    return res.status(500).json({ error: 'Failed to fetch community stats' });
  }
});

// Helper function to get likes data for presets
async function getPresetsLikesData(db: any, presetIds: string[], userId?: string): Promise<Map<string, { likesCount: number; isLikedByUser: boolean }>> {
  const likesMap = new Map<string, { likesCount: number; isLikedByUser: boolean }>();

  // Get all likes for these presets
  const likes = await db.collection('community_preset_likes')
    .find({ presetId: { $in: presetIds } })
    .toArray();

  // Initialize map with zero likes
  presetIds.forEach(presetId => {
    likesMap.set(presetId, { likesCount: 0, isLikedByUser: false });
  });

  // Count likes and check if user liked
  const userIdObjectId = userId ? new ObjectId(userId) : null;
  likes.forEach((like: any) => {
    const presetId = like.presetId;
    const current = likesMap.get(presetId) || { likesCount: 0, isLikedByUser: false };
    current.likesCount++;
    if (userIdObjectId && like.userId.equals(userIdObjectId)) {
      current.isLikedByUser = true;
    }
    likesMap.set(presetId, current);
  });

  return likesMap;
}

// Get user's own presets
router.get('/presets/my', authenticate, async (req: AuthRequest, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();

    const presets = await db.collection('community_presets')
      .find({ userId: new ObjectId(req.userId!) })
      .sort({ createdAt: -1 })
      .toArray();

    // Get likes data for all presets
    const presetIds = presets.map((p: any) => p.id);
    const likesMap = await getPresetsLikesData(db, presetIds, req.userId);

    // Add likes data to presets and migrate if needed
    const presetsWithLikes = presets.map((preset: any) => {
      const migrated = migratePresetIfNeeded(preset);
      const likesData = likesMap.get(migrated.id) || { likesCount: 0, isLikedByUser: false };
      return {
        ...migrated,
        likesCount: likesData.likesCount,
        isLikedByUser: likesData.isLikedByUser,
      };
    });

    return res.json(presetsWithLikes);
  } catch (error) {
    console.error('Failed to load user presets:', error);
    return res.status(500).json({ error: 'Failed to load presets' });
  }
});

// Update user's own preset
router.put('/presets/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();

    const presetId = req.params.id;
    const { name, description, prompt, referenceImageUrl, aspectRatio, model, tags, category, presetType, difficulty, context, useCase, examples } = req.body;

    // Find preset and verify ownership
    const preset = await db.collection('community_presets').findOne({ id: presetId });

    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    if (preset.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'You can only edit your own presets' });
    }

    // Normalize tags - ensure it's an array of strings
    const normalizedTags = tags !== undefined
      ? (Array.isArray(tags)
        ? tags.filter(tag => typeof tag === 'string' && tag.trim().length > 0).map(tag => tag.trim())
        : [])
      : undefined;

    // Normalize examples
    const normalizedExamples = examples !== undefined
      ? (Array.isArray(examples)
        ? examples.filter(ex => typeof ex === 'string' && ex.trim().length > 0).map(ex => ex.trim())
        : [])
      : undefined;

    // Build update object
    const update: any = {
      updatedAt: new Date().toISOString(),
    };

    // Validar category/presetType se fornecidos
    if (category !== undefined || presetType !== undefined) {
      const categoryData = normalizeCategoryAndPresetType({ category: category || preset?.category, presetType: presetType || preset?.presetType });
      if (categoryData.error) {
        return res.status(400).json({ error: categoryData.error });
      }
      if (categoryData.category) update.category = categoryData.category;
      if (categoryData.presetType) update.presetType = categoryData.presetType;
    }

    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (prompt !== undefined) update.prompt = prompt;
    if (aspectRatio !== undefined) update.aspectRatio = aspectRatio;
    if (model !== undefined) update.model = model;
    if (normalizedTags !== undefined) {
      update.tags = normalizedTags.length > 0 ? normalizedTags : undefined;
    }

    // Determinar se precisa de referenceImageUrl
    const currentCategory = category || preset.category || (preset.presetType ? 'presets' : undefined);
    const currentPresetType = presetType || preset.presetType;
    const needsReferenceImage = (currentCategory === 'presets' && currentPresetType === 'mockup')
      || (currentCategory && currentCategory !== 'presets' && referenceImageUrl);

    if (needsReferenceImage && referenceImageUrl !== undefined) {
      update.referenceImageUrl = referenceImageUrl;
    }

    // Novos campos opcionais
    if (difficulty !== undefined) update.difficulty = difficulty;
    if (context !== undefined) update.context = context;
    if (useCase !== undefined) update.useCase = useCase;
    if (normalizedExamples !== undefined) {
      update.examples = normalizedExamples.length > 0 ? normalizedExamples : undefined;
    }

    await db.collection('community_presets').updateOne(
      { id: presetId },
      { $set: update }
    );

    const updated = await db.collection('community_presets').findOne({ id: presetId });

    return res.json(updated);
  } catch (error: any) {
    console.error('Failed to update community preset:', error);
    return res.status(500).json({ error: 'Failed to update preset' });
  }
});

// Delete user's own preset
router.delete('/presets/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();

    const presetId = req.params.id;

    // Find preset and verify ownership
    const preset = await db.collection('community_presets').findOne({ id: presetId });

    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    if (preset.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'You can only delete your own presets' });
    }

    await db.collection('community_presets').deleteOne({ id: presetId });

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Failed to delete community preset:', error);
    return res.status(500).json({ error: 'Failed to delete preset' });
  }
});

// Toggle like on a preset
router.post('/presets/:id/like', authenticate, async (req: AuthRequest, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();

    const presetId = req.params.id;
    const userId = new ObjectId(req.userId!);

    // Verify preset exists
    const preset = await db.collection('community_presets').findOne({ id: presetId });
    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    // Create index for likes collection if it doesn't exist
    try {
      await db.collection('community_preset_likes').createIndex(
        { presetId: 1, userId: 1 },
        { unique: true }
      );
    } catch (e) {
      // Index might already exist, ignore
    }

    // Check if like already exists
    const existingLike = await db.collection('community_preset_likes').findOne({
      presetId,
      userId,
    });

    if (existingLike) {
      // Remove like
      await db.collection('community_preset_likes').deleteOne({
        presetId,
        userId,
      });
    } else {
      // Add like
      await db.collection('community_preset_likes').insertOne({
        presetId,
        userId,
        createdAt: new Date().toISOString(),
      });
    }

    // Get updated likes count and status
    const likesCount = await db.collection('community_preset_likes').countDocuments({ presetId });
    const isLikedByUser = !existingLike; // If we just added it, user liked it

    return res.json({
      likesCount,
      isLikedByUser,
    });
  } catch (error: any) {
    console.error('Failed to toggle like:', error);
    if (error.code === 11000) {
      // Duplicate key error - like already exists, try to remove it
      try {
        await connectToMongoDB();
        const db = getDb();
        const presetId = req.params.id;
        const userId = new ObjectId(req.userId!);
        await db.collection('community_preset_likes').deleteOne({ presetId, userId });
        const likesCount = await db.collection('community_preset_likes').countDocuments({ presetId });
        return res.json({ likesCount, isLikedByUser: false });
      } catch (deleteError) {
        return res.status(500).json({ error: 'Failed to toggle like' });
      }
    }
    return res.status(500).json({ error: 'Failed to toggle like' });
  }
});

// Upload generic preset reference image to R2 (for new presets or updates)
router.post('/upload-image', authenticate, uploadImageRateLimiter, async (req: AuthRequest, res) => {
  try {
    const { base64Image, id } = req.body;

    if (!base64Image) {
      return res.status(400).json({ error: 'base64Image is required' });
    }

    // Use provided ID or generate a temporary one if creating a new preset
    const presetId = id || `temp-${Date.now()}`;

    const r2Service = await import('../../services/r2Service.js');

    if (!r2Service.isR2Configured()) {
      return res.status(500).json({
        error: 'R2 storage is not configured',
        details: 'R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL must be set.'
      });
    }

    const imageUrl = await r2Service.uploadMockupPresetReference(base64Image, presetId);

    return res.json({ url: imageUrl });
  } catch (error: any) {
    console.error('Failed to upload preset reference image:', error);
    return res.status(500).json({
      error: 'Failed to upload image',
      details: error.message || 'Unknown error'
    });
  }
});

// Upload preset reference image to R2 (for mockup presets)
router.post('/presets/:id/upload-image', authenticate, async (req: AuthRequest, res) => {
  try {
    const { base64Image } = req.body;
    const presetId = req.params.id;

    if (!base64Image) {
      return res.status(400).json({ error: 'base64Image is required' });
    }

    if (!presetId) {
      return res.status(400).json({ error: 'Preset ID is required' });
    }

    // Verify preset exists and belongs to user
    await connectToMongoDB();
    const db = getDb();
    const preset = await db.collection('community_presets').findOne({ id: presetId });

    if (!preset) {
      return res.status(404).json({ error: 'Preset not found' });
    }

    if (preset.userId.toString() !== req.userId) {
      return res.status(403).json({ error: 'You can only upload images for your own presets' });
    }

    // Verificar se pode ter referenceImageUrl
    const migrated = migratePresetIfNeeded(preset);
    const canHaveImage = (migrated.category === 'presets' && migrated.presetType === 'mockup')
      || (migrated.category && migrated.category !== 'presets');

    if (!canHaveImage) {
      return res.status(400).json({ error: 'Reference images are only supported for mockup presets or non-preset categories' });
    }

    const r2Service = await import('../../services/r2Service.js');

    if (!r2Service.isR2Configured()) {
      return res.status(500).json({
        error: 'R2 storage is not configured',
        details: 'R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL must be set.'
      });
    }

    const imageUrl = await r2Service.uploadMockupPresetReference(base64Image, presetId);

    // Update preset with image URL
    await db.collection('community_presets').updateOne(
      { id: presetId },
      { $set: { referenceImageUrl: imageUrl, updatedAt: new Date().toISOString() } }
    );

    return res.json({ url: imageUrl });
  } catch (error: any) {
    console.error('Failed to upload preset reference image:', error);
    return res.status(500).json({
      error: 'Failed to upload image',
      details: error.message || 'Unknown error'
    });
  }
});

export default router;


