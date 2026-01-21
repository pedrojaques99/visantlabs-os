import express from 'express';
import { prisma } from '../db/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { apiRateLimiter } from '../middleware/rateLimit.js';

const SurpriseMePreset = prisma.surpriseMePreset;
const router = express.Router();

// GET /api/surprise-me - Get all presets for the current user
router.get('/', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
    try {
        const presets = await prisma.surpriseMePreset.findMany({
            where: { userId: req.userId },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ presets });
    } catch (error: any) {
        console.error('Error fetching Surprise Me presets:', error);
        res.status(500).json({ error: 'Failed to fetch presets' });
    }
});

// POST /api/surprise-me - Create or update a preset
router.post('/', authenticate, async (req: AuthRequest, res) => {
    try {
        const { name, config, isDefault = false } = req.body;

        if (!name || !config) {
            return res.status(400).json({ error: 'Name and config are required' });
        }

        // If setting as default, unset other defaults
        if (isDefault) {
            await prisma.surpriseMePreset.updateMany({
                where: { userId: req.userId, isDefault: true },
                data: { isDefault: false },
            });
        }

        const preset = await prisma.surpriseMePreset.create({
            data: {
                userId: req.userId!,
                name,
                config,
                isDefault,
            },
        });

        res.json({ preset });
    } catch (error: any) {
        console.error('Error saving Surprise Me preset:', error);
        res.status(500).json({ error: 'Failed to save preset' });
    }
});

// DELETE /api/surprise-me/:id - Delete a preset
router.delete('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;

        const preset = await prisma.surpriseMePreset.findUnique({
            where: { id },
        });

        if (!preset || preset.userId !== req.userId) {
            return res.status(404).json({ error: 'Preset not found' });
        }

        await prisma.surpriseMePreset.delete({
            where: { id },
        });

        res.json({ success: true });
    } catch (error: any) {
        console.error('Error deleting Surprise Me preset:', error);
        res.status(500).json({ error: 'Failed to delete preset' });
    }
});

export default router;
