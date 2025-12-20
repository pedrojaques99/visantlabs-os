import express from 'express';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { ObjectId } from 'mongodb';
import { authenticate, AuthRequest } from '../middleware/auth.js';

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

// Create community preset
router.post('/presets', authenticate, async (req: AuthRequest, res) => {
  try {
    await connectToMongoDB();
    const db = getDb();
    
    const { presetType, id, name, description, prompt, referenceImageUrl, aspectRatio, model, tags } = req.body;
    
    // Validation
    if (!presetType || !id || !name || !description || !prompt || !aspectRatio) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const validPresetTypes = ['mockup', 'angle', 'texture', 'ambience', 'luminance'];
    if (!validPresetTypes.includes(presetType)) {
      return res.status(400).json({ error: 'Invalid preset type' });
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
    
    const preset = {
      userId: new ObjectId(req.userId!),
      presetType,
      id,
      name,
      description,
      prompt,
      referenceImageUrl: presetType === 'mockup' ? (referenceImageUrl || '') : undefined,
      aspectRatio,
      model: model || undefined,
      tags: normalizedTags.length > 0 ? normalizedTags : undefined,
      isApproved: true, // Auto-approval
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await db.collection('community_presets').insertOne(preset);
    
    // Create indexes if they don't exist
    try {
      await db.collection('community_presets').createIndex({ id: 1 }, { unique: true });
      await db.collection('community_presets').createIndex({ userId: 1 });
      await db.collection('community_presets').createIndex({ presetType: 1 });
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
    
    // Group by presetType and add likes data
    const grouped: Record<string, any[]> = {
      mockup: [],
      angle: [],
      texture: [],
      ambience: [],
      luminance: [],
    };
    
    presets.forEach((preset) => {
      if (grouped[preset.presetType]) {
        const likesData = likesMap.get(preset.id) || { likesCount: 0, isLikedByUser: false };
        grouped[preset.presetType].push({
          ...preset,
          likesCount: likesData.likesCount,
          isLikedByUser: likesData.isLikedByUser,
        });
      }
    });
    
    return res.json(grouped);
  } catch (error) {
    console.error('Failed to load community presets:', error);
    return res.json({
      mockup: [],
      angle: [],
      texture: [],
      ambience: [],
      luminance: [],
    });
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
    
    // Add likes data to presets
    const presetsWithLikes = presets.map((preset: any) => {
      const likesData = likesMap.get(preset.id) || { likesCount: 0, isLikedByUser: false };
      return {
        ...preset,
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
    const { name, description, prompt, referenceImageUrl, aspectRatio, model, tags } = req.body;
    
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
    
    // Build update object
    const update: any = {
      updatedAt: new Date().toISOString(),
    };
    
    if (name !== undefined) update.name = name;
    if (description !== undefined) update.description = description;
    if (prompt !== undefined) update.prompt = prompt;
    if (aspectRatio !== undefined) update.aspectRatio = aspectRatio;
    if (model !== undefined) update.model = model;
    if (normalizedTags !== undefined) {
      update.tags = normalizedTags.length > 0 ? normalizedTags : undefined;
    }
    if (preset.presetType === 'mockup' && referenceImageUrl !== undefined) {
      update.referenceImageUrl = referenceImageUrl;
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
    
    if (preset.presetType !== 'mockup') {
      return res.status(400).json({ error: 'Reference images are only supported for mockup presets' });
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


