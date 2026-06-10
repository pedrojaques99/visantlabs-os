/**
 * Payment reconciliation — catches PIX payments whose webhook never arrived
 * (or failed). Compares pending payment records against AbacatePay's real
 * status and grants missing credits, guarded by the same idempotency claim
 * the webhooks use — so webhook + reconciler can never double-grant.
 *
 * Runs two ways:
 *   • In-process scheduler started from server/index.ts (every 15 min)
 *   • POST /api/cron/reconcile-payments for external schedulers / manual runs
 */

import { ObjectId } from 'mongodb';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { abacatepayService } from './abacatepayService.js';
import { claimPaymentEvent, releasePaymentEvent } from '../lib/paymentIdempotency.js';

export interface ReconciliationResult {
  checked: number;
  recovered: number;
  stillPending: number;
  errors: number;
}

export async function reconcilePayments(): Promise<ReconciliationResult> {
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

  return { checked: candidates.length, recovered, stillPending, errors };
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/**
 * In-process scheduler — no external cron required. Safe to run on multiple
 * instances simultaneously: the idempotency claim makes double-grants
 * impossible, and the work itself is read-mostly.
 */
export function startPaymentReconciliationScheduler(): void {
  const run = async () => {
    try {
      const result = await reconcilePayments();
      if (result.recovered > 0 || result.errors > 0) {
        console.log('[reconcile] Scheduled run:', result);
      }
    } catch (err: any) {
      console.error('[reconcile] Scheduled run failed:', err?.message);
    }
  };

  // First pass shortly after boot (let DB/provider connections settle),
  // then every 15 minutes. unref() so the timers never block shutdown.
  setTimeout(run, 60 * 1000).unref();
  setInterval(run, FIFTEEN_MINUTES).unref();
  console.log('✅ Payment reconciliation scheduler started (every 15min)');
}
