import express from 'express';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { ObjectId } from 'mongodb';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { getUserIdFromToken } from '../utils/auth.js';
import { prisma } from '../db/prisma.js';

const router = express.Router();

// Helper function to format mockup for JSON response
function formatMockup(mockup: any) {
  return {
    ...mockup,
    _id: mockup._id.toString(),
    userId: mockup.userId.toString(),
    createdAt: mockup.createdAt?.toISOString(),
    updatedAt: mockup.updatedAt?.toISOString(),
    isLiked: mockup.isLiked === true,
  };
}

// Helper function to find user by identifier (username or ID)
async function findUserByIdentifier(identifier: string) {
  await connectToMongoDB();

  // Try to find by username first (username is stored in lowercase)
  let user = await prisma.user.findUnique({
    where: { username: identifier.toLowerCase() },
  });

  // If not found by username, try by ID
  if (!user && ObjectId.isValid(identifier)) {
    user = await prisma.user.findUnique({
      where: { id: identifier },
    });
  }

  return user;
}

// Helper function to safely convert user ID to ObjectId
function getUserObjectId(userId: string): ObjectId {
  if (!userId) {
    throw new Error('User ID is required');
  }
  if (!ObjectId.isValid(userId)) {
    throw new Error(`Invalid user ID format: ${userId}`);
  }
  return new ObjectId(userId);
}

// Get user profile by username or ID
router.get('/:identifier', async (req, res) => {
  try {
    await connectToMongoDB();
    const { identifier } = req.params;

    const user = await findUserByIdentifier(identifier);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get stats
    const db = getDb();
    const userObjectId = getUserObjectId(user.id);

    // Count mockups (only blank mockups for public display)
    const mockupCount = await db.collection('mockups').countDocuments({
      userId: userObjectId,
      designType: 'blank',
    });

    // Count approved community presets
    const presetCount = await db.collection('community_presets').countDocuments({
      userId: userObjectId,
      isApproved: true,
    });

    // Return public profile data
    res.json({
      id: user.id,
      name: user.name,
      picture: user.picture,
      username: user.username,
      bio: user.bio,
      coverImageUrl: user.coverImageUrl,
      instagram: user.instagram,
      youtube: user.youtube,
      x: user.x,
      website: user.website,
      createdAt: user.createdAt.toISOString(),
      stats: {
        mockups: mockupCount,
        presets: presetCount,
      },
    });
  } catch (error: any) {
    console.error('Failed to get user profile:', error);
    res.status(500).json({ error: 'Failed to load user profile', message: error.message });
  }
});

// Get user's public mockups
router.get('/:identifier/mockups', async (req, res) => {
  try {
    await connectToMongoDB();
    const { identifier } = req.params;

    const user = await findUserByIdentifier(identifier);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const db = getDb();
    const userObjectId = getUserObjectId(user.id);

    // Get only blank mockups (public)
    const mockups = await db.collection('mockups')
      .find({
        userId: userObjectId,
        designType: 'blank',
      })
      .sort({ createdAt: -1 })
      .toArray();

    const formattedMockups = mockups.map(formatMockup);

    res.json(formattedMockups);
  } catch (error: any) {
    console.error('Failed to get user mockups:', error);
    res.status(500).json({ error: 'Failed to load mockups', message: error.message });
  }
});

// Get user's public presets
router.get('/:identifier/presets', async (req, res) => {
  try {
    await connectToMongoDB();
    const { identifier } = req.params;

    if (!identifier || identifier.trim() === '') {
      return res.status(400).json({ error: 'Invalid identifier' });
    }

    const user = await findUserByIdentifier(identifier);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.id) {
      console.error('User found but missing id:', { identifier, user });
      return res.status(500).json({ error: 'User data is invalid' });
    }

    const db = getDb();
    let userObjectId: ObjectId;

    try {
      userObjectId = getUserObjectId(user.id);
    } catch (idError: any) {
      console.error('Failed to convert user ID to ObjectId:', {
        error: idError.message,
        userId: user.id,
        identifier: req.params.identifier,
      });
      return res.status(500).json({
        error: 'Failed to load presets',
        message: 'Invalid user ID format'
      });
    }

    // Get approved community presets
    const presets = await db.collection('community_presets')
      .find({
        userId: userObjectId,
        isApproved: true,
      })
      .sort({ createdAt: -1 })
      .toArray();

    // Group by presetType
    const grouped: Record<string, any[]> = {
      mockup: [],
      angle: [],
      texture: [],
      ambience: [],
      luminance: [],
    };

    presets.forEach((preset) => {
      if (preset.presetType && grouped[preset.presetType]) {
        grouped[preset.presetType].push({
          ...preset,
          _id: preset._id?.toString() || preset._id,
          userId: preset.userId?.toString() || preset.userId,
          createdAt: preset.createdAt?.toISOString?.() || preset.createdAt,
          updatedAt: preset.updatedAt?.toISOString?.() || preset.updatedAt,
        });
      }
    });

    res.json(grouped);
  } catch (error: any) {
    console.error('Failed to get user presets:', {
      error: error.message,
      stack: error.stack,
      identifier: req.params.identifier,
    });
    res.status(500).json({
      error: 'Failed to load presets',
      message: error.message || 'An unexpected error occurred'
    });
  }
});

// Get user's public workflows
router.get('/:identifier/workflows', async (req, res) => {
  try {
    await connectToMongoDB();
    const { identifier } = req.params;

    const user = await findUserByIdentifier(identifier);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const workflows = await prisma.canvasWorkflow.findMany({
      where: {
        userId: user.id,
        isPublic: true,
        isApproved: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        likes: true,
      },
    });

    // Check if current user has liked
    const currentUserId = getUserIdFromToken(req.headers.authorization);

    const formattedWorkflows = workflows.map(workflow => {
      const { likes, ...rest } = workflow;
      return {
        ...rest,
        isLikedByUser: currentUserId ? likes.some(like => like.userId === currentUserId) : false,
      };
    });

    res.json(formattedWorkflows);
  } catch (error: any) {
    console.error('Failed to get user workflows:', error);
    res.status(500).json({ error: 'Failed to load workflows', message: error.message });
  }
});

// Update own profile
router.put('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const {
      username,
      bio,
      instagram,
      youtube,
      x,
      website,
      coverImageBase64,
    } = req.body;

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prepare update data
    const updateData: any = {};

    // Validate and update username
    if (username !== undefined) {
      if (username === '') {
        updateData.username = null;
      } else {
        // Validate username format: alphanumeric, underscores, hyphens, 3-20 chars
        const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
        if (!usernameRegex.test(username)) {
          return res.status(400).json({
            error: 'Invalid username format',
            details: 'Username must be 3-20 characters and contain only letters, numbers, underscores, and hyphens',
          });
        }

        // Check if username is already taken by another user
        const existingUser = await prisma.user.findUnique({
          where: { username: username.toLowerCase() },
        });

        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ error: 'Username already taken' });
        }

        updateData.username = username.toLowerCase();
      }
    }

    // Update bio
    if (bio !== undefined) {
      updateData.bio = bio || null;
    }

    // Validate and update social media links
    const urlRegex = /^https?:\/\/.+/;

    if (instagram !== undefined) {
      if (instagram === '') {
        updateData.instagram = null;
      } else if (!urlRegex.test(instagram)) {
        return res.status(400).json({ error: 'Invalid Instagram URL format' });
      } else {
        updateData.instagram = instagram;
      }
    }

    if (youtube !== undefined) {
      if (youtube === '') {
        updateData.youtube = null;
      } else if (!urlRegex.test(youtube)) {
        return res.status(400).json({ error: 'Invalid YouTube URL format' });
      } else {
        updateData.youtube = youtube;
      }
    }

    if (x !== undefined) {
      if (x === '') {
        updateData.x = null;
      } else if (!urlRegex.test(x)) {
        return res.status(400).json({ error: 'Invalid X/Twitter URL format' });
      } else {
        updateData.x = x;
      }
    }

    if (website !== undefined) {
      if (website === '') {
        updateData.website = null;
      } else if (!urlRegex.test(website)) {
        return res.status(400).json({ error: 'Invalid website URL format' });
      } else {
        updateData.website = website;
      }
    }

    // Handle cover image upload
    if (coverImageBase64) {
      const r2Service = await import('../../src/services/r2Service.js');

      if (!r2Service.isR2Configured()) {
        return res.status(500).json({
          error: 'R2 storage is not configured',
          details: 'Please configure R2 environment variables.',
        });
      }

      try {
        // Get user info for storage limit check
        await connectToMongoDB();
        const db = getDb();
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        const subscriptionTier = user?.subscriptionTier || 'free';
        const isAdmin = user?.isAdmin || false;

        const coverImageUrl = await r2Service.uploadCoverImage(coverImageBase64, userId, subscriptionTier, isAdmin);
        updateData.coverImageUrl = coverImageUrl;
      } catch (uploadError: any) {
        console.error('Cover image upload error:', uploadError);
        return res.status(500).json({
          error: 'Failed to upload cover image',
          message: uploadError.message,
        });
      }
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    res.json({
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        picture: updatedUser.picture,
        username: updatedUser.username,
        bio: updatedUser.bio,
        coverImageUrl: updatedUser.coverImageUrl,
        instagram: updatedUser.instagram,
        youtube: updatedUser.youtube,
        x: updatedUser.x,
        website: updatedUser.website,
      },
    });
  } catch (error: any) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile', message: error.message });
  }
});

// Save/Update Gemini API Key
router.put('/settings/gemini-api-key', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { apiKey } = req.body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return res.status(400).json({ error: 'API key is required' });
    }

    // Basic validation: Gemini API keys are typically long strings
    // They should be at least 20 characters and contain alphanumeric characters
    const trimmedKey = apiKey.trim();
    if (trimmedKey.length < 20) {
      return res.status(400).json({ error: 'Invalid API key format' });
    }

    // Check if encryption is configured
    if (!process.env.API_KEY_ENCRYPTION_KEY) {
      return res.status(500).json({
        error: 'API key encryption is not configured',
        details: 'Please contact support or configure API_KEY_ENCRYPTION_KEY environment variable.'
      });
    }

    // Encrypt the API key
    const { encryptApiKey } = await import('../utils/encryption.js');
    const encryptedKey = encryptApiKey(trimmedKey);

    // Update user with encrypted key
    await prisma.user.update({
      where: { id: userId },
      data: {
        encryptedGeminiApiKey: encryptedKey,
      },
    });

    res.json({
      success: true,
      message: 'API key saved successfully'
    });
  } catch (error: any) {
    console.error('Failed to save API key:', error);

    // Don't leak encryption errors to client
    if (error.message.includes('encrypt') || error.message.includes('decrypt')) {
      return res.status(500).json({
        error: 'Failed to save API key',
        message: 'An encryption error occurred. Please try again.'
      });
    }

    res.status(500).json({
      error: 'Failed to save API key',
      message: error.message
    });
  }
});

// Delete Gemini API Key
router.delete('/settings/gemini-api-key', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Remove the encrypted key
    await prisma.user.update({
      where: { id: userId },
      data: {
        encryptedGeminiApiKey: null,
      },
    });

    res.json({
      success: true,
      message: 'API key deleted successfully'
    });
  } catch (error: any) {
    console.error('Failed to delete API key:', error);
    res.status(500).json({
      error: 'Failed to delete API key',
      message: error.message
    });
  }
});

// Check if user has API key (returns boolean only, not the key itself)
router.get('/settings/gemini-api-key', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        encryptedGeminiApiKey: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      hasApiKey: !!user.encryptedGeminiApiKey
    });
  } catch (error: any) {
    console.error('Failed to check API key:', error);
    res.status(500).json({
      error: 'Failed to check API key',
      message: error.message
    });
  }
});

// Get user canvas settings
router.get('/settings/canvas', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        canvasSettings: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user.canvasSettings || {});
  } catch (error: any) {
    console.error('Failed to get canvas settings:', error);
    res.status(500).json({
      error: 'Failed to get canvas settings',
      message: error.message
    });
  }
});

// Update user canvas settings
router.put('/settings/canvas', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const settings = req.body;

    // Validate settings is an object
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      return res.status(400).json({
        error: 'Invalid settings format',
        message: 'Settings must be a valid JSON object'
      });
    }

    // Update user with new settings
    await prisma.user.update({
      where: { id: userId },
      data: {
        canvasSettings: settings,
      },
    });

    res.json({
      success: true,
      message: 'Canvas settings updated successfully'
    });
  } catch (error: any) {
    console.error('[Canvas Settings] Failed to update:', error);
    console.error('[Canvas Settings] Error stack:', error?.stack);

    // Handle Prisma-specific errors
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'User not found',
        message: 'User does not exist'
      });
    }

    res.status(500).json({
      error: 'Failed to update canvas settings',
      message: error.message || 'An error occurred'
    });
  }
});

export default router;

