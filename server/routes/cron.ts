import express from 'express';
import { prisma } from '../db/prisma.js';

const router = express.Router();

const CRON_SECRET = process.env.CRON_SECRET;

const verifyCronAuth = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  if (CRON_SECRET && req.headers.authorization !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Drip email sequence: day 1 (welcome), day 3 (tips), day 7 (upgrade CTA)
router.post('/email-drip', verifyCronAuth, async (_req, res) => {
  try {
    const { sendWelcomeEmail, isEmailConfigured } = await import('../services/emailService.js');

    if (!isEmailConfigured()) {
      return res.json({ message: 'Email not configured, skipping' });
    }

    const now = new Date();
    let sent = 0;

    // Day 1: users created 23-25 hours ago with welcomeEmailsSent === 0
    const day1Start = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    const day1End = new Date(now.getTime() - 23 * 60 * 60 * 1000);

    const day1Users = await prisma.user.findMany({
      where: {
        createdAt: { gte: day1Start, lte: day1End },
        welcomeEmailsSent: 0,
        subscriptionStatus: { not: 'deleted' },
      },
      select: { id: true, email: true, name: true },
      take: 100,
    });

    for (const user of day1Users) {
      try {
        await sendWelcomeEmail({ email: user.email, name: user.name || undefined });
        await prisma.user.update({ where: { id: user.id }, data: { welcomeEmailsSent: 1 } });
        sent++;
      } catch (err) {
        console.error(`Drip day1 failed for ${user.id}:`, err);
      }
    }

    // Day 3: users created ~3 days ago with welcomeEmailsSent === 1
    const day3Start = new Date(now.getTime() - 73 * 60 * 60 * 1000);
    const day3End = new Date(now.getTime() - 71 * 60 * 60 * 1000);

    const day3Users = await prisma.user.findMany({
      where: {
        createdAt: { gte: day3Start, lte: day3End },
        welcomeEmailsSent: 1,
        subscriptionStatus: { not: 'deleted' },
      },
      select: { id: true, email: true, name: true },
      take: 100,
    });

    for (const user of day3Users) {
      try {
        // Reuse welcome email for now — can create dedicated templates later
        await sendWelcomeEmail({ email: user.email, name: user.name || undefined });
        await prisma.user.update({ where: { id: user.id }, data: { welcomeEmailsSent: 2 } });
        sent++;
      } catch (err) {
        console.error(`Drip day3 failed for ${user.id}:`, err);
      }
    }

    // Day 7: users created ~7 days ago with welcomeEmailsSent === 2
    const day7Start = new Date(now.getTime() - 169 * 60 * 60 * 1000);
    const day7End = new Date(now.getTime() - 167 * 60 * 60 * 1000);

    const day7Users = await prisma.user.findMany({
      where: {
        createdAt: { gte: day7Start, lte: day7End },
        welcomeEmailsSent: 2,
        subscriptionStatus: { not: 'deleted' },
      },
      select: { id: true, email: true, name: true },
      take: 100,
    });

    for (const user of day7Users) {
      try {
        await sendWelcomeEmail({ email: user.email, name: user.name || undefined });
        await prisma.user.update({ where: { id: user.id }, data: { welcomeEmailsSent: 3 } });
        sent++;
      } catch (err) {
        console.error(`Drip day7 failed for ${user.id}:`, err);
      }
    }

    res.json({
      message: `Drip emails sent: ${sent}`,
      day1: day1Users.length,
      day3: day3Users.length,
      day7: day7Users.length,
    });
  } catch (error: any) {
    console.error('Email drip cron error:', error);
    res.status(500).json({ error: 'Drip cron failed' });
  }
});

export default router;
