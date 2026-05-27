import express from 'express';
import { prisma } from '../db/prisma.js';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { rateLimit } from 'express-rate-limit';
import crypto from 'crypto';
import { generateSecret, generateURI, verifySync, TOTP } from 'otplib';

const router = express.Router();

const totpRateLimiter = rateLimit({
  windowMs: 300000,
  max: 10,
  message: { error: 'Too many 2FA requests.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const totp = new TOTP();

// Generate TOTP secret + provisioning URI
router.post('/setup', totpRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.totpEnabled) {
      return res.status(400).json({ error: '2FA is already enabled' });
    }

    const secret = generateSecret();

    await prisma.user.update({
      where: { id: req.userId },
      data: { totpSecret: secret },
    });

    const otpauthUrl = generateURI({ issuer: 'Visant Labs', label: user.email, secret });

    res.json({ secret, otpauthUrl });
  } catch (error: any) {
    console.error('TOTP setup error:', error);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

// Verify TOTP code and enable 2FA
router.post('/enable', totpRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !user.totpSecret) {
      return res.status(400).json({ error: 'Setup 2FA first' });
    }

    const isValid = verifySync({ token: code, secret: user.totpSecret });
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString('hex')
    );

    await prisma.user.update({
      where: { id: req.userId },
      data: {
        totpEnabled: true,
        totpBackupCodes: backupCodes,
      },
    });

    res.json({ message: '2FA enabled', backupCodes });
  } catch (error: any) {
    console.error('TOTP enable error:', error);
    res.status(500).json({ error: 'Failed to enable 2FA' });
  }
});

// Disable 2FA
router.post('/disable', totpRateLimiter, authenticate, async (req: AuthRequest, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'Verification code is required' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return res.status(400).json({ error: '2FA is not enabled' });
    }

    const isValid = verifySync({ token: code, secret: user.totpSecret });
    if (!isValid) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: {
        totpEnabled: false,
        totpSecret: null,
        totpBackupCodes: [],
      },
    });

    res.json({ message: '2FA disabled' });
  } catch (error: any) {
    console.error('TOTP disable error:', error);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

// Verify TOTP during signin
router.post('/verify', totpRateLimiter, async (req, res) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ error: 'userId and code are required' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.totpEnabled || !user.totpSecret) {
      return res.status(400).json({ error: '2FA is not enabled for this user' });
    }

    const isValid = verifySync({ token: code, secret: user.totpSecret });
    if (isValid) {
      return res.json({ valid: true });
    }

    // Check backup codes
    if (user.totpBackupCodes.includes(code)) {
      await prisma.user.update({
        where: { id: userId },
        data: {
          totpBackupCodes: user.totpBackupCodes.filter(c => c !== code),
        },
      });
      return res.json({ valid: true, usedBackupCode: true });
    }

    res.status(401).json({ error: 'Invalid code' });
  } catch (error: any) {
    console.error('TOTP verify error:', error);
    res.status(500).json({ error: 'Failed to verify 2FA' });
  }
});

export default router;
