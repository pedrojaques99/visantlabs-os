import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { checkSubscription, SubscriptionRequest } from '../middleware/subscription.js';
import type { Request } from 'express';

interface AuthRequest extends Request {
  userId?: string;
  userEmail?: string;
}
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { ObjectId } from 'mongodb';
import {
  detectGridItems,
  upscaleImageMoodboard,
  suggestAnimationPresets,
} from '../services/geminiService.js';

const router = express.Router();

const apiRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_API_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_API || '60', 10),
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const generationRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_MOCKUP_WINDOW_MS || '60000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_MOCKUP || '20', 10),
  message: { error: 'Too many generation requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/moodboard/detect-grid
// Detects individual image bounding boxes in a moodboard/grid image
router.post(
  '/detect-grid',
  generationRateLimiter,
  authenticate,
  checkSubscription,
  async (req: SubscriptionRequest, res, next) => {
    try {
      const { imageBase64 } = req.body;
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'imageBase64 is required' });
      }

      const boxes = await detectGridItems(imageBase64);
      res.json({ boxes });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/moodboard/upscale
// Upscales an image using Gemini image enhancement
router.post(
  '/upscale',
  generationRateLimiter,
  authenticate,
  checkSubscription,
  async (req: SubscriptionRequest, res, next) => {
    try {
      const { imageBase64, size = '4K' } = req.body;
      if (!imageBase64 || typeof imageBase64 !== 'string') {
        return res.status(400).json({ error: 'imageBase64 is required' });
      }
      if (!['1K', '2K', '4K'].includes(size)) {
        return res.status(400).json({ error: 'size must be 1K, 2K, or 4K' });
      }

      const upscaledBase64 = await upscaleImageMoodboard(imageBase64, size as '1K' | '2K' | '4K');
      res.json({ upscaledBase64 });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/moodboard/suggest
// Suggests Remotion animation preset + Veo 3 prompt per image
router.post(
  '/suggest',
  generationRateLimiter,
  authenticate,
  checkSubscription,
  async (req: SubscriptionRequest, res, next) => {
    try {
      const { images } = req.body;
      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: 'images array is required' });
      }

      const normalized = images
        .filter((img: any) => img?.id && img?.base64)
        .map((img: any) => ({ id: img.id, base64: img.base64 }));

      if (normalized.length === 0) {
        return res.status(400).json({ error: 'No valid images provided' });
      }

      const suggestions = await suggestAnimationPresets(normalized);
      res.json({ suggestions });
    } catch (err) {
      next(err);
    }
  }
);

// POST /api/moodboard/projects
// Save or update a moodboard project
router.post(
  '/projects',
  apiRateLimiter,
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      await connectToMongoDB();
      const db = getDb();

      const { id, name, sourceUrl, images, brandGuidelineId } = req.body;
      const userId = req.userId!;

      const doc = {
        userId,
        name: name || 'Untitled Moodboard',
        sourceUrl: sourceUrl || null,
        images: images || [],
        brandGuidelineId: brandGuidelineId || null,
        updatedAt: new Date(),
      };

      if (id) {
        const existing = await db.collection('moodboard_projects').findOne({
          _id: new ObjectId(id),
          userId,
        });
        if (!existing) {
          return res.status(404).json({ error: 'Project not found' });
        }
        await db.collection('moodboard_projects').updateOne(
          { _id: new ObjectId(id) },
          { $set: doc }
        );
        return res.json({ id });
      }

      const result = await db.collection('moodboard_projects').insertOne({
        ...doc,
        createdAt: new Date(),
      });
      res.json({ id: result.insertedId.toString() });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/moodboard/projects
// List user's moodboard projects
router.get(
  '/projects',
  apiRateLimiter,
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      await connectToMongoDB();
      const db = getDb();
      const userId = req.userId!;

      const projects = await db
        .collection('moodboard_projects')
        .find({ userId })
        .sort({ updatedAt: -1 })
        .limit(50)
        .project({ images: 0 })
        .toArray();

      res.json({ projects: projects.map(p => ({ ...p, id: p._id.toString(), _id: undefined })) });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/moodboard/projects/:id
// Load a specific project
router.get(
  '/projects/:id',
  apiRateLimiter,
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      await connectToMongoDB();
      const db = getDb();
      const userId = req.userId!;

      let projectId: ObjectId;
      try {
        projectId = new ObjectId(req.params.id);
      } catch {
        return res.status(400).json({ error: 'Invalid project id' });
      }

      const project = await db.collection('moodboard_projects').findOne({
        _id: projectId,
        userId,
      });

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json({ project: { ...project, id: project._id.toString(), _id: undefined } });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/moodboard/projects/:id
router.delete(
  '/projects/:id',
  apiRateLimiter,
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      await connectToMongoDB();
      const db = getDb();
      const userId = req.userId!;

      let projectId: ObjectId;
      try {
        projectId = new ObjectId(req.params.id);
      } catch {
        return res.status(400).json({ error: 'Invalid project id' });
      }

      const result = await db.collection('moodboard_projects').deleteOne({
        _id: projectId,
        userId,
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
