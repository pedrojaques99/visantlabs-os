import express from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { renderPsdMockup } from '../services/psdRenderService.js';
import { rateLimit } from 'express-rate-limit';
import { prisma } from '../db/prisma.js';

const router = express.Router();

const renderLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  message: { error: 'Too many render requests. Max 5 per minute.' },
});

/**
 * O render dá acesso indireto à biblioteca de PSDs licenciados (Maison/Hazard)
 * — DENY por padrão. Permitido apenas: admins e usuários listados em
 * PSD_RENDER_ALLOWED_USERS (CSV de IDs e/ou e-mails, case-insensitive).
 */
async function allowPsdRender(req: AuthRequest, res: express.Response, next: express.NextFunction) {
  try {
    if (req.isAdmin) return next();

    const allowlist = (process.env.PSD_RENDER_ALLOWED_USERS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    const idMatch = req.userId && allowlist.includes(req.userId.toLowerCase());
    const emailMatch = req.userEmail && allowlist.includes(req.userEmail.toLowerCase());
    if (idMatch || emailMatch) return next();

    // Caminhos OAuth/MCP/API-key não populam isAdmin/userEmail — resolve no banco
    if (req.userId && req.isAdmin === undefined) {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { isAdmin: true, email: true },
      });
      if (user?.isAdmin) return next();
      if (user?.email && allowlist.includes(user.email.toLowerCase())) return next();
    }

    return res.status(403).json({
      error: 'PSD render restrito — peça acesso a um admin (PSD_RENDER_ALLOWED_USERS)',
    });
  } catch (err) {
    console.error('[psd-render] access check error:', err);
    return res.status(403).json({ error: 'PSD render restrito' });
  }
}

router.post('/render', authenticate, allowPsdRender, renderLimiter, async (req: AuthRequest, res) => {
  const { psdUrl, psdFileName, artUrl, smartObject, hideLayers, arts, preview } = req.body;

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
    try { new URL(psdUrl); } catch {
      return res.status(400).json({ error: 'psdUrl must be a valid URL' });
    }
  }
  if (psdFileName && (psdFileName.includes('/') || psdFileName.includes('\\') || psdFileName.includes('..'))) {
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
        try { new URL(a.artUrl); } catch {
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
    try { new URL(artUrl); } catch {
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
});

router.get('/status', authenticate, async (_req: AuthRequest, res) => {
  res.json({
    available: true,
    engine: process.env.PSD_RENDER_ENGINE || 'agpsd',
    maxConcurrent: parseInt(process.env.PSD_RENDER_MAX_CONCURRENT || '2', 10),
    driveConfigured: !!(
      process.env.GOOGLE_SERVICE_ACCOUNT_KEY ||
      (process.env.GOOGLE_DRIVE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    ),
    spacesConfigured: !!(process.env.DO_SPACES_BUCKET && process.env.DO_SPACES_KEY),
  });
});

export default router;
