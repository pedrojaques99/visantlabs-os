import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { prisma } from '../db/prisma.js';

const router = express.Router();

// Save branding example feedback (thumbs up)
router.post('/branding', authenticate, async (req: AuthRequest, res) => {
  try {
    const { prompt, step, output, rating } = req.body;

    if (!prompt || step === undefined || !output) {
      return res.status(400).json({ error: 'Prompt, step, and output are required' });
    }

    // Only save positive feedback (thumbs up = rating 1)
    const feedbackRating = rating || 1;
    if (feedbackRating !== 1) {
      return res.status(400).json({ error: 'Only positive feedback (thumbs up) is saved as examples' });
    }

    // Check if example already exists for this prompt + step combination
    const existing = await prisma.brandingExample.findFirst({
      where: {
        prompt: prompt.trim(),
        step: parseInt(step.toString()),
      },
    });

    if (existing) {
      // Update existing example with new output and higher rating
      const updated = await prisma.brandingExample.update({
        where: { id: existing.id },
        data: {
          output: output as any,
          rating: Math.max(existing.rating, feedbackRating),
          updatedAt: new Date(),
        },
      });

      return res.json({ 
        success: true, 
        message: 'Feedback updated',
        example: updated 
      });
    }

    // Create new example
    const example = await prisma.brandingExample.create({
      data: {
        prompt: prompt.trim(),
        step: parseInt(step.toString()),
        output: output as any,
        rating: feedbackRating,
      },
    });

    res.json({ 
      success: true, 
      message: 'Feedback saved as example',
      example 
    });
  } catch (error: any) {
    console.error('Error saving branding feedback:', error);
    res.status(500).json({ error: 'Failed to save feedback', message: error.message });
  }
});

// Save mockup example feedback (thumbs up)
router.post('/mockup', authenticate, async (req: AuthRequest, res) => {
  try {
    const { prompt, imageUrl, designType, tags, brandingTags, aspectRatio, rating } = req.body;

    if (!prompt || !imageUrl) {
      return res.status(400).json({ error: 'Prompt and imageUrl are required' });
    }

    // Only save positive feedback (thumbs up = rating 1)
    const feedbackRating = rating || 1;
    if (feedbackRating !== 1) {
      return res.status(400).json({ error: 'Only positive feedback (thumbs up) is saved as examples' });
    }

    // Check if example already exists for this prompt + imageUrl combination
    const existing = await prisma.mockupExample.findFirst({
      where: {
        prompt: prompt.trim(),
        imageUrl: imageUrl,
      },
    });

    if (existing) {
      // Update existing example with higher rating
      const updated = await prisma.mockupExample.update({
        where: { id: existing.id },
        data: {
          rating: Math.max(existing.rating, feedbackRating),
          updatedAt: new Date(),
        },
      });

      return res.json({ 
        success: true, 
        message: 'Feedback updated',
        example: updated 
      });
    }

    // Create new example
    const example = await prisma.mockupExample.create({
      data: {
        prompt: prompt.trim(),
        imageUrl: imageUrl,
        designType: designType || 'blank',
        tags: tags || [],
        brandingTags: brandingTags || [],
        aspectRatio: aspectRatio || '16:9',
        rating: feedbackRating,
      },
    });

    res.json({ 
      success: true, 
      message: 'Feedback saved as example',
      example 
    });
  } catch (error: any) {
    console.error('Error saving mockup feedback:', error);
    res.status(500).json({ error: 'Failed to save feedback', message: error.message });
  }
});

// Get mockup examples (for RAG - no auth required for reading examples)
router.get('/mockup-examples', async (req, res) => {
  try {
    const { designType, limit = 10 } = req.query;

    const where: any = {
      rating: 1, // Only positive examples
    };

    if (designType) {
      where.designType = designType;
    }

    const examples = await prisma.mockupExample.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: parseInt(limit.toString()),
    });

    res.json({ examples });
  } catch (error: any) {
    console.error('Error fetching mockup examples:', error);
    res.status(500).json({ error: 'Failed to fetch examples', message: error.message });
  }
});

export default router;

