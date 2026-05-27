import express from 'express';
import { prisma } from '../db/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';
import { getClientIp } from '../utils/auth.js';

const router = express.Router();

const sessionsRateLimiter = rateLimit({
  windowMs: 60000,
  max: 30,
  message: { error: 'Too many requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// List active sessions
router.get('/', sessionsRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const sessions = await prisma.session.findMany({
      where: { userId: req.userId },
      orderBy: { lastUsed: 'desc' },
      take: 20,
    });

    res.json({ sessions });
  } catch (error: any) {
    console.error('List sessions error:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// Revoke a session
router.delete('/:sessionId', sessionsRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { sessionId } = req.params;

    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: req.userId },
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    await prisma.session.delete({ where: { id: sessionId } });

    res.json({ message: 'Session revoked' });
  } catch (error: any) {
    console.error('Revoke session error:', error);
    res.status(500).json({ error: 'Failed to revoke session' });
  }
});

// Helper: record a session (called from auth routes)
export async function recordSession(userId: string, req: express.Request): Promise<void> {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers['user-agent'] || null;

    await prisma.session.create({
      data: {
        userId,
        ip,
        userAgent,
        lastUsed: new Date(),
      },
    });

    // Cleanup: keep only the 20 most recent sessions per user
    const sessions = await prisma.session.findMany({
      where: { userId },
      orderBy: { lastUsed: 'desc' },
      skip: 20,
      select: { id: true },
    });

    if (sessions.length > 0) {
      await prisma.session.deleteMany({
        where: { id: { in: sessions.map(s => s.id) } },
      });
    }
  } catch (error) {
    console.error('Failed to record session:', error);
  }
}

export default router;
