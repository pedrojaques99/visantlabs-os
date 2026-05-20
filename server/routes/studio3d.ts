import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../db/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';

const router = Router();

const apiRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

function mapId<T extends { id: string }>(p: T): T & { _id: string } {
  return { ...p, _id: p.id };
}

// ─── Scene config validation ─────────────────────────────────────────────────

const VALID_MATERIALS = [
  'default', 'plastic', 'metal', 'glass', 'rubber', 'chrome', 'gold', 'clay',
  'emissive', 'holographic', 'brushedSteel', 'aluminum', 'copper', 'roseGold',
  'platinum', 'ceramic', 'marble', 'concrete', 'wood', 'velvet', 'leather',
  'frostedGlass', 'diamond', 'pearl', 'carbonFiber', 'carPaint', 'ice',
  'obsidian', 'wax', 'mattePaint',
];

const VALID_ANIMATIONS = ['none', 'spin', 'float', 'pulse', 'wobble', 'spinFloat', 'swing', 'physicsFall'];
const VALID_ENVIRONMENTS = ['studio', 'city', 'sunset', 'dawn', 'night', 'forest', 'apartment', 'warehouse', 'park', 'lobby'];
const VALID_BG_TYPES = ['solid', 'linear', 'radial'];
const VALID_SHAPE_TYPES = ['standard', 'coin'];
const VALID_EASINGS = ['linear', 'easeIn', 'easeOut', 'easeInOut'];

const HEX_RE = /^#[0-9A-Fa-f]{3,8}$/;

function validateConfig(config: any): string | null {
  if (!config || typeof config !== 'object') return 'config must be an object';
  if (config.material && !VALID_MATERIALS.includes(config.material)) return `Invalid material: ${config.material}`;
  if (config.animate && !VALID_ANIMATIONS.includes(config.animate)) return `Invalid animation: ${config.animate}`;
  if (config.environment && !VALID_ENVIRONMENTS.includes(config.environment)) return `Invalid environment: ${config.environment}`;
  if (config.bgType && !VALID_BG_TYPES.includes(config.bgType)) return `Invalid bgType: ${config.bgType}`;
  if (config.shapeType && !VALID_SHAPE_TYPES.includes(config.shapeType)) return `Invalid shapeType: ${config.shapeType}`;
  if (config.animateEasing && !VALID_EASINGS.includes(config.animateEasing)) return `Invalid easing: ${config.animateEasing}`;
  if (config.color && !HEX_RE.test(config.color)) return `Invalid color: ${config.color}`;
  if (config.background && !HEX_RE.test(config.background)) return `Invalid background: ${config.background}`;
  return null;
}

// ─── List scenes ─────────────────────────────────────────────────────────────

router.get('/', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const limit = Math.min(Number(req.query.limit) || 60, 200);
    const scenes = await prisma.studio3DScene.findMany({
      where: { userId: req.userId },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: {
        id: true, name: true, description: true, config: true,
        inputMode: true, text: true, font: true,
        thumbnailUrl: true, tags: true, isPublic: true,
        createdAt: true, updatedAt: true,
      },
    });
    return res.json({ scenes: scenes.map(mapId), total: scenes.length });
  } catch (err: any) {
    console.error('[studio3d] list error:', err.message);
    return res.status(500).json({ error: 'Failed to list scenes' });
  }
});

// ─── Get scene ───────────────────────────────────────────────────────────────

router.get('/:id', apiRateLimiter, async (req: AuthRequest, res) => {
  try {
    const scene = await prisma.studio3DScene.findUnique({ where: { id: req.params.id } });
    if (!scene) return res.status(404).json({ error: 'Scene not found' });

    // Public scenes are accessible by anyone; private scenes require auth
    if (!scene.isPublic) {
      if (!req.userId || req.userId !== scene.userId) {
        return res.status(404).json({ error: 'Scene not found' });
      }
    }

    return res.json({ scene: mapId(scene) });
  } catch (err: any) {
    console.error('[studio3d] get error:', err.message);
    return res.status(500).json({ error: 'Failed to get scene' });
  }
});

// ─── Create scene ────────────────────────────────────────────────────────────

router.post('/', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const { name, description, config, svgData, inputMode, text, font, tags, isPublic } = req.body;
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name is required' });
    if (!config || typeof config !== 'object') return res.status(400).json({ error: 'config is required' });

    const configErr = validateConfig(config);
    if (configErr) return res.status(400).json({ error: configErr });

    const scene = await prisma.studio3DScene.create({
      data: {
        userId: req.userId,
        name: name.slice(0, 200),
        description: description?.slice(0, 1000) || null,
        config,
        svgData: svgData || null,
        inputMode: inputMode || 'svg',
        text: text || null,
        font: font || null,
        tags: Array.isArray(tags) ? tags.slice(0, 20) : [],
        isPublic: isPublic === true,
      },
    });

    return res.status(201).json({ scene: mapId(scene) });
  } catch (err: any) {
    console.error('[studio3d] create error:', err.message);
    return res.status(500).json({ error: 'Failed to create scene' });
  }
});

// ─── Update scene ────────────────────────────────────────────────────────────

router.patch('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const existing = await prisma.studio3DScene.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const { name, description, config, svgData, inputMode, text, font, tags, isPublic } = req.body;

    if (config) {
      const configErr = validateConfig(config);
      if (configErr) return res.status(400).json({ error: configErr });
    }

    const scene = await prisma.studio3DScene.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name: name.slice(0, 200) } : {}),
        ...(description !== undefined ? { description: description?.slice(0, 1000) || null } : {}),
        ...(config !== undefined ? { config } : {}),
        ...(svgData !== undefined ? { svgData } : {}),
        ...(inputMode !== undefined ? { inputMode } : {}),
        ...(text !== undefined ? { text } : {}),
        ...(font !== undefined ? { font } : {}),
        ...(tags !== undefined ? { tags: Array.isArray(tags) ? tags.slice(0, 20) : [] } : {}),
        ...(isPublic !== undefined ? { isPublic: isPublic === true } : {}),
      },
    });

    return res.json({ scene: mapId(scene) });
  } catch (err: any) {
    console.error('[studio3d] update error:', err.message);
    return res.status(500).json({ error: 'Failed to update scene' });
  }
});

// ─── Delete scene ────────────────────────────────────────────────────────────

router.delete('/:id', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const existing = await prisma.studio3DScene.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    await prisma.studio3DScene.delete({ where: { id: req.params.id } });
    return res.json({ deleted: true });
  } catch (err: any) {
    console.error('[studio3d] delete error:', err.message);
    return res.status(500).json({ error: 'Failed to delete scene' });
  }
});

export default router;
