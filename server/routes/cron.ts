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

// Payment reconciliation: catches PIX payments whose webhook never arrived
// (or failed). Compares pending payment records against AbacatePay's real
// status and grants missing credits, guarded by the same idempotency claim
// the webhooks use — so webhook + reconciler can never double-grant.
router.post('/reconcile-payments', verifyCronAuth, async (_req, res) => {
  try {
    const { connectToMongoDB, getDb } = await import('../db/mongodb.js');
    const { abacatepayService } = await import('../services/abacatepayService.js');
    const { claimPaymentEvent, releasePaymentEvent } = await import(
      '../lib/paymentIdempotency.js'
    );
    const { ObjectId } = await import('mongodb');

    await connectToMongoDB();
    const db = getDb();

    // Pending PIX payments between 10 minutes and 7 days old. Below 10min the
    // webhook may still be in flight; above 7 days the PIX charge has expired.
    const now = Date.now();
    const candidates = await db
      .collection('payments')
      .find({
        provider: 'abacatepay',
        status: { $nin: ['paid', 'completed', 'expired', 'cancelled'] },
        createdAt: {
          $gte: new Date(now - 7 * 24 * 60 * 60 * 1000),
          $lte: new Date(now - 10 * 60 * 1000),
        },
      })
      .limit(100)
      .toArray();

    let recovered = 0;
    let stillPending = 0;
    let errors = 0;

    for (const payment of candidates) {
      try {
        const billing = await abacatepayService.getPaymentStatus(payment.billId);
        const isPaid =
          billing.status === 'PAID' || billing.status === 'CONFIRMED' || billing.status === 'ACTIVE+';

        if (!isPaid) {
          stillPending++;
          continue;
        }

        // Paid at the provider but still pending here — webhook was missed.
        const claimed = await claimPaymentEvent(db, 'abacatepay', payment.billId);
        if (!claimed) {
          // Webhook actually processed it; just sync the record state
          await db
            .collection('payments')
            .updateOne({ billId: payment.billId }, { $set: { status: 'paid', paidAt: new Date() } });
          continue;
        }

        if (!payment.userId || !payment.credits || payment.credits <= 0) {
          await releasePaymentEvent(db, 'abacatepay', payment.billId);
          console.error('[reconcile] Payment record missing userId/credits:', payment.billId);
          errors++;
          continue;
        }

        const userId =
          payment.userId instanceof ObjectId ? payment.userId : new ObjectId(payment.userId);

        try {
          await db
            .collection('users')
            .updateOne({ _id: userId }, { $inc: { totalCreditsEarned: payment.credits } });
        } catch (grantError) {
          await releasePaymentEvent(db, 'abacatepay', payment.billId);
          throw grantError;
        }

        await db
          .collection('payments')
          .updateOne(
            { billId: payment.billId },
            { $set: { status: 'paid', paidAt: new Date(), reconciledAt: new Date() } }
          );

        console.log('[reconcile] ✅ Recovered missed payment:', {
          billId: payment.billId,
          userId: userId.toString(),
          credits: payment.credits,
        });
        recovered++;
      } catch (err: any) {
        console.error('[reconcile] Error processing payment:', payment.billId, err?.message);
        errors++;
      }
    }

    res.json({
      message: `Reconciliation done: ${recovered} recovered, ${stillPending} still pending, ${errors} errors`,
      checked: candidates.length,
      recovered,
      stillPending,
      errors,
    });
  } catch (error: any) {
    console.error('Payment reconciliation cron error:', error);
    res.status(500).json({ error: 'Reconciliation cron failed' });
  }
});

export default router;
