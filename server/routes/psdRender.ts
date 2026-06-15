import express from 'express';
import { authenticate, requireScope, requireAdmin, AuthRequest } from '../middleware/auth.js';
import { renderPsdMockup } from '../services/psdRenderService.js';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../db/prisma.js';
import { redisClient } from '../lib/redis.js';
import {
  resolvePsdPath,
  extractSceneFromPsd,
  uploadSceneAssets,
  saveSceneRecord,
  getSceneRecord,
  listScenes,
  deleteSceneRecord,
  signedSceneResponse,
} from '../services/sceneStore.js';

const router = express.Router();

// Interactive browser sessions get a tight per-account cap; trusted partner
// integrations (server-to-server via API key) proxy many end-users behind one
// account, so they get a configurable, larger budget.
const PARTNER_RENDER_MAX = parseInt(process.env.PSD_RENDER_PARTNER_MAX || '120', 10);
const INTERACTIVE_RENDER_MAX = 5;

const renderLimiter = rateLimit({
  windowMs: 60_000,
  max: (req: AuthRequest) =>
    req.authMethod === 'apikey' ? PARTNER_RENDER_MAX : INTERACTIVE_RENDER_MAX,
  // Key by account, not IP — a single partner proxy IP must not share a bucket
  // across unrelated users, and distinct API keys get distinct buckets.
  keyGenerator: (req: AuthRequest) => req.userId || req.ip!,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'Too many render requests. Please slow down.' },
});

interface TierRequest extends AuthRequest {
  psdTier?: 'all' | 'public';
}

/**
 * Tiers de acesso à biblioteca:
 *  - 'all'    (admin, membro da equipe, allowlist): biblioteca inteira + psdUrl
 *  - 'public' (qualquer user autenticado): só mockups BOXY
 *    (GOOGLE_DRIVE_PUBLIC_FOLDER_IDS)
 *
 * Equipe = doc na collection Mongo `team_members` com { email } ou { userId }.
 */
async function isTeamMember(userId?: string, email?: string): Promise<boolean> {
  try {
    const { getDb } = await import('../db/mongodb.js');
    const db = await getDb();
    const or: Record<string, string>[] = [];
    if (userId) or.push({ userId });
    if (email) or.push({ email: email.toLowerCase() });
    if (!or.length) return false;
    const member = await db.collection('team_members').findOne({ $or: or });
    return !!member;
  } catch (err) {
    console.error('[psd-render] team check error:', err);
    return false;
  }
}

async function resolveTier(req: TierRequest, _res: express.Response, next: express.NextFunction) {
  try {
    let isAdmin = req.isAdmin;
    let email = req.userEmail;

    // Caminhos OAuth/MCP/API-key não populam isAdmin/userEmail — resolve no banco
    if (req.userId && (isAdmin === undefined || !email)) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { isAdmin: true, email: true },
      });
      isAdmin = isAdmin ?? !!user?.isAdmin;
      email = email || user?.email || undefined;
    }

    const allowlist = (process.env.PSD_RENDER_ALLOWED_USERS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    const inAllowlist =
      (req.userId && allowlist.includes(req.userId.toLowerCase())) ||
      (email && allowlist.includes(email.toLowerCase()));

    req.psdTier =
      isAdmin || inAllowlist || (await isTeamMember(req.userId, email)) ? 'all' : 'public';
  } catch (err) {
    console.error('[psd-render] tier resolve error:', err);
    req.psdTier = 'public'; // falha = menor privilégio
  }
  next();
}

router.post(
  '/render',
  authenticate,
  requireScope('generate'),
  renderLimiter,
  resolveTier,
  async (req: TierRequest, res) => {
    const { psdUrl, psdFileName, artUrl, smartObject, hideLayers, arts, preview, forcePsd } =
      req.body;

    // PSD: URL http(s) OU nome de arquivo no Google Drive
    if (psdUrl !== undefined && typeof psdUrl !== 'string') {
      return res.status(400).json({ error: 'psdUrl must be a string' });
    }
    if (psdFileName !== undefined && typeof psdFileName !== 'string') {
      return res.status(400).json({ error: 'psdFileName must be a string' });
    }
    if (!psdUrl && !psdFileName) {
      return res.status(400).json({ error: 'Provide psdUrl or psdFileName' });
    }
    if (psdUrl) {
      try {
        new URL(psdUrl);
      } catch {
        return res.status(400).json({ error: 'psdUrl must be a valid URL' });
      }
    }
    if (
      psdFileName &&
      (psdFileName.includes('/') || psdFileName.includes('\\') || psdFileName.includes('..'))
    ) {
      return res.status(400).json({ error: 'psdFileName must be a bare file name' });
    }

    // Arte: arts[] (multi-face) OU artUrl+smartObject (legado)
    let artList: Array<{ smartObject?: string; artUrl?: string; artBase64?: string }> | undefined;
    if (Array.isArray(arts) && arts.length > 0) {
      if (arts.length > 8) {
        return res.status(400).json({ error: 'Max 8 arts per render' });
      }
      for (const a of arts) {
        if (!a || typeof a !== 'object' || (!a.artUrl && !a.artBase64)) {
          return res.status(400).json({ error: 'Each arts[] item needs artUrl or artBase64' });
        }
        if (a.artUrl) {
          try {
            new URL(a.artUrl);
          } catch {
            return res.status(400).json({ error: 'arts[].artUrl must be a valid URL' });
          }
        }
      }
      artList = arts.map((a: any) => ({
        smartObject: typeof a.smartObject === 'string' ? a.smartObject : undefined,
        artUrl: typeof a.artUrl === 'string' ? a.artUrl : undefined,
        artBase64: typeof a.artBase64 === 'string' ? a.artBase64 : undefined,
      }));
    } else {
      if (!artUrl || typeof artUrl !== 'string') {
        return res.status(400).json({ error: 'Provide arts[] or artUrl' });
      }
      try {
        new URL(artUrl);
      } catch {
        return res.status(400).json({ error: 'artUrl must be a valid URL' });
      }
    }

    try {
      const result = await renderPsdMockup({
        psdUrl,
        psdFileName,
        arts: artList,
        artUrl,
        smartObject: typeof smartObject === 'string' ? smartObject : undefined,
        hideLayers: Array.isArray(hideLayers) ? hideLayers : [],
        preview: preview === true || typeof preview === 'number' ? preview : undefined,
        userId: req.userId!,
        accessTier: req.psdTier || 'public',
        forcePsd: forcePsd === true,
      });

      res.json({
        success: true,
        data: {
          url: result.url,
          sizeBytes: result.sizeBytes,
          durationMs: result.durationMs,
          engine: result.engine,
          replaced: result.replaced,
        },
      });
    } catch (err: any) {
      console.error('[psd-render] Error:', err.message || err, err.stack);
      const status = err.message?.includes('queue is full') ? 429 : 500;
      res.status(status).json({ error: err.message || 'Render failed' });
    }
  }
);

// ── Scene Packages ───────────────────────────────────────────────────────────
// Pré-processamento (1x por PSD) + catálogo + entrega por signed URL.
const SCENE_PREPARE_ACTIVE_KEY = 'psd-scene-prepare:active';
const SCENE_PREPARE_MAX = parseInt(process.env.PSD_SCENE_PREPARE_MAX_CONCURRENT || '1', 10);

function validBareFileName(name: unknown): name is string {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    !name.includes('/') &&
    !name.includes('\\') &&
    !name.includes('..')
  );
}

async function getMongo() {
  const { connectToMongoDB, getDb } = await import('../db/mongodb.js');
  await connectToMongoDB();
  return getDb();
}

/**
 * POST /scene-prepare — extrai e publica o Scene Package de um PSD.
 * Pesado, mas 1x por PSD; roda sob semáforo Redis. O acesso ao arquivo é validado
 * pela resolução via driveService (tier 'public' só enxerga as pastas BOXY).
 */
router.post(
  '/scene-prepare',
  authenticate,
  requireScope('generate'),
  renderLimiter,
  resolveTier,
  async (req: TierRequest, res) => {
    const { psdFileName } = req.body;
    if (!validBareFileName(psdFileName)) {
      return res.status(400).json({ error: 'psdFileName must be a bare file name' });
    }

    const active = await redisClient.get(SCENE_PREPARE_ACTIVE_KEY);
    if (active && parseInt(active, 10) >= SCENE_PREPARE_MAX) {
      return res
        .status(429)
        .json({ error: 'Scene preparation queue is full. Try again in a moment.' });
    }
    await redisClient.incr(SCENE_PREPARE_ACTIVE_KEY);
    await redisClient.expire(SCENE_PREPARE_ACTIVE_KEY, 600);

    try {
      // resolvePsdPath aplica o escopo de pastas do tier — 403-equivalente vira erro.
      const psdPath = await resolvePsdPath(psdFileName, req.psdTier || 'public');
      const { record, uploads } = await extractSceneFromPsd(psdPath, psdFileName);
      await uploadSceneAssets(uploads);
      const db = await getMongo();
      await saveSceneRecord(db, record);

      res.json({
        success: true,
        scene: { hash: record.hash, faces: record.faces, warnings: record.warnings },
      });
    } catch (err: any) {
      console.error('[psd-render] scene-prepare error:', err.message || err);
      const msg = err.message || 'Scene preparation failed';
      const status = /não encontrado|fora do seu acesso|indisponíveis/i.test(msg) ? 403 : 500;
      res.status(status).json({ error: msg });
    } finally {
      await redisClient.decr(SCENE_PREPARE_ACTIVE_KEY);
    }
  }
);

/** GET /scenes — catálogo (resumo) das scenes disponíveis. */
router.get('/scenes', authenticate, async (_req: AuthRequest, res) => {
  try {
    const db = await getMongo();
    const scenes = await listScenes(db);
    res.json({ success: true, scenes });
  } catch (err: any) {
    console.error('[psd-render] list scenes error:', err.message || err);
    res.status(500).json({ error: err.message || 'Failed to list scenes' });
  }
});

/**
 * GET /scenes/:psdFileName — SceneDoc + signed URLs (TTL ~10min) das imagens.
 * Mesma validação de acesso ao arquivo que o /render: um user 'public' não pode
 * pegar a scene de um PSD que não está nas pastas públicas.
 */
router.get('/scenes/:psdFileName', authenticate, resolveTier, async (req: TierRequest, res) => {
  const psdFileName = req.params.psdFileName;
  if (!validBareFileName(psdFileName)) {
    return res.status(400).json({ error: 'psdFileName must be a bare file name' });
  }
  try {
    const db = await getMongo();
    const record = await getSceneRecord(db, psdFileName);
    if (!record) {
      return res.status(404).json({ error: 'Scene not found' });
    }
    // Revalida o acesso ao PSD de origem (tier). resolvePsdPath lança se fora do escopo.
    try {
      await resolvePsdPath(psdFileName, req.psdTier || 'public');
    } catch {
      return res.status(403).json({ error: 'PSD fora do seu acesso' });
    }
    const payload = await signedSceneResponse(record, 600);
    res.json({ success: true, ...payload });
  } catch (err: any) {
    console.error('[psd-render] get scene error:', err.message || err);
    res.status(500).json({ error: err.message || 'Failed to get scene' });
  }
});

/** DELETE /scenes/:psdFileName — limpeza/regeneração (admin). */
router.delete('/scenes/:psdFileName', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const psdFileName = req.params.psdFileName;
  if (!validBareFileName(psdFileName)) {
    return res.status(400).json({ error: 'psdFileName must be a bare file name' });
  }
  try {
    const db = await getMongo();
    const deleted = await deleteSceneRecord(db, psdFileName);
    res.json({ success: true, deleted });
  } catch (err: any) {
    console.error('[psd-render] delete scene error:', err.message || err);
    res.status(500).json({ error: err.message || 'Failed to delete scene' });
  }
});

router.get('/status', authenticate, async (_req: AuthRequest, res) => {
  res.json({
    available: true,
    engine: process.env.PSD_RENDER_ENGINE || 'agpsd',
    maxConcurrent: parseInt(process.env.PSD_RENDER_MAX_CONCURRENT || '2', 10),
    driveConfigured: !!(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      (process.env.GOOGLE_DRIVE_REFRESH_TOKEN &&
        process.env.GOOGLE_CLIENT_ID &&
        process.env.GOOGLE_CLIENT_SECRET)
    ),
    spacesConfigured: !!(process.env.DO_SPACES_BUCKET && process.env.DO_SPACES_KEY),
  });
});

export default router;
