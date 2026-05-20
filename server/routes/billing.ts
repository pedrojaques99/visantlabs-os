import { Router, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = Router();

const balanceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// GET /balance — Returns credit balance and quota for the authenticated user
router.get('/balance', balanceLimiter, authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        monthlyCredits: true,
        creditsUsed: true,
        freeGenerationsUsed: true,
        subscriptionTier: true,
        creditsResetDate: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const creditsRemaining = Math.max(0, user.monthlyCredits - user.creditsUsed);

    return res.json({
      balance: {
        monthlyCredits: user.monthlyCredits,
        creditsUsed: user.creditsUsed,
        creditsRemaining,
        freeGenerationsUsed: user.freeGenerationsUsed,
        subscriptionTier: user.subscriptionTier,
        creditsResetDate: user.creditsResetDate ?? null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching billing balance:', error);
    return res.status(500).json({ error: 'Failed to fetch billing balance' });
  }
});

export default router;
