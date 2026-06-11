import { Router, type NextFunction } from 'express';
import { rateLimit } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/prisma.js';
import { authenticate, type AuthRequest } from '../middleware/auth.js';
import { JWT_SECRET } from '../utils/jwtSecret.js';
import { tracePipeline, parseBase64Image } from './trace.js';

const router = Router();

// Populate req.userId when a valid token is present, but never reject. Used on
// GET /:id so owners can read their own *private* scenes (the route serves
// public scenes anonymously). Without this the private-scene branch could never
// see a userId and always 404'd, locking owners out of their own scenes.
function optionalAuth(req: AuthRequest, _res: unknown, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId?: string; sub?: string };
      if (decoded.userId) req.userId = decoded.userId;
      else if (decoded.sub) req.userId = decoded.sub;
    } catch {
      /* ignore invalid tokens — anonymous access still allowed for public scenes */
    }
  }
  next();
}

// ─── Export GLB (no Prisma dependency) ──────────────────────────────────────

const MAX_SVG_BYTES = 5 * 1024 * 1024; // 5MB
const EXPORT_TIMEOUT_MS = 10_000;
// Reject obviously dangerous SVG content (scripts / inline event handlers).
const UNSAFE_SVG_RE = /<script\b|\son\w+\s*=|javascript:/i;

class ExportTimeoutError extends Error {}

function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new ExportTimeoutError(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

function validateSvgString(svg: string): string | null {
  if (Buffer.byteLength(svg, 'utf8') > MAX_SVG_BYTES) return 'SVG too large (max 5MB)';
  if (UNSAFE_SVG_RE.test(svg)) return 'SVG contains disallowed scripting content';
  return null;
}

const exportLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  // Throttle per authenticated user (falls back to IP for safety).
  keyGenerator: (req) => (req as AuthRequest).userId || req.ip || 'anon',
});

router.post('/export-glb', authenticate, exportLimiter, async (req: AuthRequest, res) => {
  try {
    const {
      svgData,
      image,
      preset,
      threshold,
      turdSize,
      optTolerance,
      alphaMax,
      depth,
      smoothness,
      bevelEnabled,
      bevelThickness,
      bevelSize,
      color,
      metalness,
      roughness,
    } = req.body;

    let svg: string;

    if (svgData && typeof svgData === 'string' && svgData.includes('<svg')) {
      const svgErr = validateSvgString(svgData);
      if (svgErr) return res.status(422).json({ error: svgErr });
      svg = svgData;
    } else if (image && typeof image === 'string') {
      const buffer = parseBase64Image(image);
      if (!buffer) return res.status(400).json({ error: 'Invalid base64 image format' });
      if (buffer.length > 10 * 1024 * 1024)
        return res.status(413).json({ error: 'Image too large (max 10MB)' });
      svg = await withTimeout(
        tracePipeline(buffer, {
          preset: preset || 'logo',
          threshold,
          turdSize,
          optTolerance,
          alphaMax,
        }),
        EXPORT_TIMEOUT_MS,
        'trace'
      );
      const tracedErr = validateSvgString(svg);
      if (tracedErr) return res.status(422).json({ error: tracedErr });
    } else {
      return res.status(400).json({ error: 'Provide svgData (SVG string) or image (base64 PNG)' });
    }

    const { svgToGlb } = await import('../services/studio3dExportService.js');
    const glbBuffer = await withTimeout(
      svgToGlb(svg, {
        depth,
        smoothness,
        bevelEnabled,
        bevelThickness,
        bevelSize,
        color,
        metalness,
        roughness,
      }),
      EXPORT_TIMEOUT_MS,
      'svgToGlb'
    );

    res.setHeader('Content-Type', 'model/gltf-binary');
    res.setHeader('Content-Disposition', 'attachment; filename="scene.glb"');
    res.send(glbBuffer);
  } catch (error: any) {
    if (error instanceof ExportTimeoutError) {
      console.error('GLB export timeout:', error.message);
      return res.status(422).json({ error: 'SVG too complex to process within time limit' });
    }
    console.error('GLB export error:', error);
    res.status(500).json({ error: error.message || 'GLB export failed' });
  }
});

// Helper to resolve SVG from request body (shared by export/render routes)
async function resolveInputSvg(body: any): Promise<string> {
  const { svgData, image, preset, threshold, turdSize, optTolerance, alphaMax } = body;
  if (svgData && typeof svgData === 'string' && svgData.includes('<svg')) return svgData;
  if (image && typeof image === 'string') {
    const buffer = parseBase64Image(image);
    if (!buffer) throw new Error('Invalid base64 image format');
    if (buffer.length > 10 * 1024 * 1024) throw new Error('Image too large (max 10MB)');
    return tracePipeline(buffer, {
      preset: preset || 'logo',
      threshold,
      turdSize,
      optTolerance,
      alphaMax,
    });
  }
  throw new Error('Provide svgData (SVG string) or image (base64 PNG)');
}

// ─── Prisma-dependent routes ────────────────────────────────────────────────

const hasModel = !!(prisma as any).studio3DScene;

router.use((_req, res, next) => {
  if (!hasModel) return res.json({ scenes: [], total: 0 });
  next();
});

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
  'default',
  'plastic',
  'metal',
  'glass',
  'rubber',
  'chrome',
  'gold',
  'clay',
  'emissive',
  'holographic',
  'brushedSteel',
  'aluminum',
  'copper',
  'roseGold',
  'platinum',
  'ceramic',
  'marble',
  'concrete',
  'wood',
  'velvet',
  'leather',
  'frostedGlass',
  'diamond',
  'pearl',
  'carbonFiber',
  'carPaint',
  'ice',
  'obsidian',
  'wax',
  'mattePaint',
];

const VALID_ANIMATIONS = [
  'none',
  'spin',
  'float',
  'pulse',
  'wobble',
  'spinFloat',
  'swing',
  'physicsFall',
];
const VALID_ENVIRONMENTS = [
  'studio',
  'city',
  'sunset',
  'dawn',
  'night',
  'forest',
  'apartment',
  'warehouse',
  'park',
  'lobby',
];
const VALID_BG_TYPES = ['solid', 'linear', 'radial', 'image'];
const VALID_SHAPE_TYPES = ['standard', 'coin', 'badge', 'stamp', 'shield', 'hexagon'];
const VALID_EASINGS = ['linear', 'easeIn', 'easeOut', 'easeInOut'];

const HEX_RE = /^#[0-9A-Fa-f]{3,8}$/;

// Numeric bounds per config field. Out-of-range or non-finite values are rejected
// (pathological numbers — e.g. huge depth/segments — can blow up server-side
// geometry generation and the export pipeline).
const NUMERIC_BOUNDS: Record<string, { min: number; max: number }> = {
  depth: { min: 0, max: 50 },
  smoothness: { min: 0, max: 1 },
  bevelThickness: { min: 0, max: 10 },
  bevelSize: { min: 0, max: 10 },
  objectScale: { min: 0.01, max: 100 },
  metalness: { min: 0, max: 1 },
  roughness: { min: 0, max: 1 },
  opacity: { min: 0, max: 1 },
  textureRepeat: { min: 0, max: 1000 },
  textureRotation: { min: -360, max: 360 },
  textureOpacity: { min: 0, max: 1 },
  lightIntensity: { min: 0, max: 100 },
  ambientIntensity: { min: 0, max: 100 },
  fillLightIntensity: { min: 0, max: 100 },
  bounceLightIntensity: { min: 0, max: 100 },
  pointLightIntensity: { min: 0, max: 100 },
  groundReflection: { min: 0, max: 1 },
  hdriBlur: { min: 0, max: 1 },
  hdriIntensity: { min: 0, max: 100 },
  hdriRotation: { min: -360, max: 360 },
  fogNear: { min: 0, max: 10000 },
  fogFar: { min: 0, max: 100000 },
  bloomIntensity: { min: 0, max: 100 },
  animateSpeed: { min: 0, max: 100 },
};

function validateConfig(config: any): string | null {
  if (!config || typeof config !== 'object') return 'config must be an object';
  for (const [field, { min, max }] of Object.entries(NUMERIC_BOUNDS)) {
    const v = config[field];
    if (v === undefined || v === null) continue;
    if (typeof v !== 'number' || !Number.isFinite(v))
      return `Invalid ${field}: must be a finite number`;
    if (v < min || v > max) return `Invalid ${field}: must be between ${min} and ${max}`;
  }
  if (config.material && !VALID_MATERIALS.includes(config.material))
    return `Invalid material: ${config.material}`;
  if (config.animate && !VALID_ANIMATIONS.includes(config.animate))
    return `Invalid animation: ${config.animate}`;
  if (config.environment && !VALID_ENVIRONMENTS.includes(config.environment))
    return `Invalid environment: ${config.environment}`;
  if (config.bgType && !VALID_BG_TYPES.includes(config.bgType))
    return `Invalid bgType: ${config.bgType}`;
  if (config.shapeType && !VALID_SHAPE_TYPES.includes(config.shapeType))
    return `Invalid shapeType: ${config.shapeType}`;
  if (config.animateEasing && !VALID_EASINGS.includes(config.animateEasing))
    return `Invalid easing: ${config.animateEasing}`;
  if (config.color && !HEX_RE.test(config.color)) return `Invalid color: ${config.color}`;
  if (config.background && !HEX_RE.test(config.background))
    return `Invalid background: ${config.background}`;
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
        id: true,
        name: true,
        description: true,
        config: true,
        inputMode: true,
        text: true,
        font: true,
        thumbnailUrl: true,
        tags: true,
        isPublic: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return res.json({ scenes: scenes.map(mapId), total: scenes.length });
  } catch (err: any) {
    console.error('[studio3d] list error:', err.message);
    return res.status(500).json({ error: 'Failed to list scenes' });
  }
});

// ─── Public gallery — browse community scenes ──────────────────────────────

router.get('/public', apiRateLimiter, async (_req, res) => {
  try {
    const limit = Math.min(Number(_req.query.limit) || 40, 100);
    const cursor = (_req.query.cursor as string) || undefined;
    const tag = (_req.query.tag as string) || undefined;

    const where: any = { isPublic: true };
    if (tag) where.tags = { has: tag };
    if (cursor) where.id = { lt: cursor };

    let scenes: any[];
    try {
      scenes = await prisma.studio3DScene.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          thumbnailUrl: true,
          tags: true,
          inputMode: true,
          config: true,
          createdAt: true,
          updatedAt: true,
          user: { select: { name: true } },
        },
      });
    } catch {
      scenes = await prisma.studio3DScene.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          name: true,
          description: true,
          thumbnailUrl: true,
          tags: true,
          inputMode: true,
          config: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    const nextCursor = scenes.length === limit ? scenes[scenes.length - 1].id : null;

    return res.json({
      scenes: scenes.map((s) => ({
        ...mapId(s),
        config: {
          material: (s.config as any)?.material,
          background: (s.config as any)?.background,
          shapeType: (s.config as any)?.shapeType,
        },
      })),
      nextCursor,
    });
  } catch (err: any) {
    console.error('[studio3d] public gallery error:', err.message);
    return res.status(500).json({ error: 'Failed to list public scenes' });
  }
});

// ─── Get scene ───────────────────────────────────────────────────────────────

router.get('/:id', apiRateLimiter, optionalAuth, async (req: AuthRequest, res) => {
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

    const {
      name,
      description,
      config,
      svgData,
      inputMode,
      text,
      font,
      tags,
      isPublic,
      thumbnailUrl,
    } = req.body;
    if (!name || typeof name !== 'string')
      return res.status(400).json({ error: 'name is required' });
    if (!config || typeof config !== 'object')
      return res.status(400).json({ error: 'config is required' });

    const configErr = validateConfig(config);
    if (configErr) return res.status(400).json({ error: configErr });

    const thumb =
      typeof thumbnailUrl === 'string' &&
      thumbnailUrl.startsWith('data:image/') &&
      thumbnailUrl.length < 20_000
        ? thumbnailUrl
        : null;

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
        thumbnailUrl: thumb,
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

    const {
      name,
      description,
      config,
      svgData,
      inputMode,
      text,
      font,
      tags,
      isPublic,
      thumbnailUrl,
    } = req.body;

    if (config) {
      const configErr = validateConfig(config);
      if (configErr) return res.status(400).json({ error: configErr });
    }

    const thumb =
      typeof thumbnailUrl === 'string' &&
      thumbnailUrl.startsWith('data:image/') &&
      thumbnailUrl.length < 20_000
        ? thumbnailUrl
        : undefined;

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
        ...(thumb !== undefined ? { thumbnailUrl: thumb } : {}),
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

// ─── Fork scene — clone a public scene into your account ────────────────────

router.post('/:id/fork', apiRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) return res.status(401).json({ error: 'Unauthenticated' });

    const source = await prisma.studio3DScene.findUnique({ where: { id: req.params.id } });
    if (!source || (!source.isPublic && source.userId !== req.userId)) {
      return res.status(404).json({ error: 'Scene not found' });
    }

    const scene = await prisma.studio3DScene.create({
      data: {
        userId: req.userId,
        name: `${source.name} (fork)`.slice(0, 200),
        description: source.description,
        config: source.config as any,
        svgData: source.svgData,
        inputMode: source.inputMode,
        text: source.text,
        font: source.font,
        tags: source.tags,
        isPublic: false,
      },
    });

    return res.status(201).json({ scene: mapId(scene) });
  } catch (err: any) {
    console.error('[studio3d] fork error:', err.message);
    return res.status(500).json({ error: 'Failed to fork scene' });
  }
});

export default router;
