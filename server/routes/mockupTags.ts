import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { getAllAvailableTags } from '../services/tagService.js';
import { ensureString, isValidObjectId } from '../utils/validation.js';

const router = Router();

// Get all available tags from all collections (unified endpoint)
router.get('/available', async (req, res) => {
    try {
        const tags = await getAllAvailableTags();
        res.json(tags);
    } catch (error) {
        console.error('Error fetching available tags:', error);
        res.status(500).json({ error: 'Failed to fetch available tags' });
    }
});

// Get all categorized tags
router.get('/categories', async (req, res) => {
    try {
        const categories = await prisma.mockupTagCategory.findMany({
            orderBy: { displayOrder: 'asc' },
            include: {
                tags: {
                    orderBy: { name: 'asc' }
                }
            }
        });

        res.json(categories);
    } catch (error) {
        console.error('Error fetching tag categories:', error);
        res.status(500).json({ error: 'Failed to fetch tag categories' });
    }
});

// Admin only: create a category
router.post('/categories', authenticate, async (req, res) => {
    if (!(req as any).user?.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, displayOrder } = req.body;

    const nameVal = ensureString(name, 200);
    if (!nameVal) {
        return res.status(400).json({ error: 'Name is required' });
    }
    const order = displayOrder != null ? parseInt(String(displayOrder), 10) : 0;

    try {
        const category = await prisma.mockupTagCategory.create({
            data: { name: nameVal, displayOrder: isNaN(order) ? 0 : order }
        });
        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create category' });
    }
});

// Admin only: add a tag to a category
router.post('/tags', authenticate, async (req, res) => {
    if (!(req as any).user?.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, categoryId } = req.body;

    const nameVal = ensureString(name, 200);
    if (!nameVal) {
        return res.status(400).json({ error: 'Name is required' });
    }
    if (!categoryId || !isValidObjectId(categoryId)) {
        return res.status(400).json({ error: 'Valid categoryId is required' });
    }

    try {
        const tag = await prisma.mockupTag.create({
            data: { name: nameVal, categoryId }
        });
        res.status(201).json(tag);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create tag' });
    }
});

export default router;
