import { Router, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../db/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

const VALID_SCOPES = ['read', 'write', 'generate'];

// POST /create — Create a new API key
router.post('/create', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { name, scopes, expiresAt } = req.body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (name.length > 100) {
      return res.status(400).json({ error: 'Name must be 100 characters or less' });
    }

    // Validate scopes
    const resolvedScopes = scopes && Array.isArray(scopes) ? scopes : ['read'];
    for (const scope of resolvedScopes) {
      if (!VALID_SCOPES.includes(scope)) {
        return res.status(400).json({ error: `Invalid scope: ${scope}. Valid scopes: ${VALID_SCOPES.join(', ')}` });
      }
    }

    // Validate expiresAt if provided
    let parsedExpiresAt: Date | undefined;
    if (expiresAt) {
      parsedExpiresAt = new Date(expiresAt);
      if (isNaN(parsedExpiresAt.getTime())) {
        return res.status(400).json({ error: 'Invalid expiresAt date' });
      }
      if (parsedExpiresAt <= new Date()) {
        return res.status(400).json({ error: 'expiresAt must be in the future' });
      }
    }

    // Generate raw key: visant_sk_ + 32 random hex bytes
    const rawKey = `visant_sk_${crypto.randomBytes(32).toString('hex')}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.substring(0, 18);

    const apiKey = await prisma.apiKey.create({
      data: {
        userId: req.userId!,
        keyHash,
        keyPrefix,
        name: name.trim(),
        scopes: resolvedScopes,
        expiresAt: parsedExpiresAt || null,
      },
    });

    res.status(201).json({
      id: apiKey.id,
      key: rawKey,
      keyPrefix: apiKey.keyPrefix,
      name: apiKey.name,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      message: 'API key created. Save the key — it will not be shown again.',
    });
  } catch (error: any) {
    console.error('[apiKeys] Error creating API key:', error?.message);
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// GET / — List user's API keys
router.get('/', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { userId: req.userId! },
      select: {
        id: true,
        keyPrefix: true,
        name: true,
        scopes: true,
        lastUsed: true,
        createdAt: true,
        expiresAt: true,
        active: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ keys });
  } catch (error: any) {
    console.error('[apiKeys] Error listing API keys:', error?.message);
    res.status(500).json({ error: 'Failed to list API keys' });
  }
});

// DELETE /:id — Revoke (soft delete) an API key
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const apiKey = await prisma.apiKey.findUnique({ where: { id } });

    if (!apiKey || apiKey.userId !== req.userId) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await prisma.apiKey.update({
      where: { id },
      data: { active: false },
    });

    res.json({ message: 'API key revoked' });
  } catch (error: any) {
    console.error('[apiKeys] Error revoking API key:', error?.message);
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

export default router;
