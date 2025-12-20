import express from 'express';
import { prisma } from '../db/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';

const router = express.Router();

// Helper function to generate unique referral code
const generateReferralCode = (): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Get referral code for authenticated user
router.get('/code', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { referralCode: true },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let code = user.referralCode;

    // Generate code if user doesn't have one
    if (!code) {
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!isUnique && attempts < maxAttempts) {
        code = generateReferralCode();
        const existing = await prisma.user.findUnique({
          where: { referralCode: code },
          select: { id: true },
        });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        return res.status(500).json({ error: 'Failed to generate unique referral code' });
      }

      // Update user with referral code
      await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
      });
    }

    res.json({ referralCode: code });
  } catch (error: any) {
    console.error('Error getting referral code:', error);
    res.status(500).json({ error: 'Failed to get referral code', message: error.message });
  }
});

// Get referral statistics
router.get('/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        referralCode: true,
        referralCount: true,
        totalCreditsEarned: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let code = user.referralCode;

    // Generate code if user doesn't have one
    if (!code) {
      let isUnique = false;
      let attempts = 0;
      const maxAttempts = 10;

      while (!isUnique && attempts < maxAttempts) {
        code = generateReferralCode();
        const existing = await prisma.user.findUnique({
          where: { referralCode: code },
          select: { id: true },
        });
        if (!existing) {
          isUnique = true;
        }
        attempts++;
      }

      if (!isUnique) {
        return res.status(500).json({ error: 'Failed to generate unique referral code' });
      }

      // Update user with referral code
      await prisma.user.update({
        where: { id: userId },
        data: { referralCode: code },
      });
    }

    // Count how many users were referred by this user
    const referredUsers = await prisma.user.count({
      where: { referredBy: userId },
    });

    res.json({
      referralCode: code,
      referralCount: user.referralCount || 0,
      referredUsersCount: referredUsers,
      totalCreditsEarned: user.totalCreditsEarned || 0,
    });
  } catch (error: any) {
    console.error('Error getting referral stats:', error);
    res.status(500).json({ error: 'Failed to get referral stats', message: error.message });
  }
});

// Generate new referral code (regenerate)
router.post('/generate', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let code: string;
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      code = generateReferralCode();
      const existing = await prisma.user.findUnique({
        where: { referralCode: code },
        select: { id: true },
      });
      if (!existing) {
        isUnique = true;
      }
      attempts++;
    }

    if (!isUnique) {
      return res.status(500).json({ error: 'Failed to generate unique referral code' });
    }

    // Update user with new referral code
    await prisma.user.update({
      where: { id: userId },
      data: { referralCode: code! },
    });

    res.json({ referralCode: code! });
  } catch (error: any) {
    console.error('Error generating referral code:', error);
    res.status(500).json({ error: 'Failed to generate referral code', message: error.message });
  }
});

export default router;

