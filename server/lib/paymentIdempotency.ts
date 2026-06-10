/**
 * Payment event idempotency — prevents double credit grants when a payment
 * provider retries a webhook, or when the same payment reaches us through
 * more than one path (inline /webhook handler, /abacate-webhook service
 * handler, reconciliation job).
 *
 * Claim BEFORE granting credits. If the grant fails, release the claim so a
 * provider retry can reprocess the event.
 */

import type { Db } from 'mongodb';
import { Sentry } from './sentry.js';

const COLLECTION = 'processed_payment_events';

let indexEnsured = false;

async function ensureIndex(db: Db): Promise<void> {
  if (indexEnsured) return;
  try {
    await db.collection(COLLECTION).createIndex({ provider: 1, eventId: 1 }, { unique: true });
    indexEnsured = true;
  } catch (error: any) {
    // Index creation race between instances is harmless — insert still
    // enforces uniqueness once any instance has created it.
    console.warn('[PAYMENT-IDEMPOTENCY] createIndex failed (non-fatal):', error?.message);
  }
}

/**
 * Atomically claim a payment event. Returns true if this caller owns the
 * event (safe to grant credits), false if it was already processed.
 */
export async function claimPaymentEvent(
  db: Db,
  provider: 'abacatepay' | 'stripe',
  eventId: string
): Promise<boolean> {
  await ensureIndex(db);
  try {
    await db.collection(COLLECTION).insertOne({ provider, eventId, createdAt: new Date() });
    return true;
  } catch (error: any) {
    if (error?.code === 11000) {
      console.log(`[PAYMENT-IDEMPOTENCY] Duplicate ${provider} event skipped:`, eventId);
      return false;
    }
    throw error;
  }
}

/**
 * Release a claim after a failed credit grant so the provider's retry (or the
 * reconciliation job) can process the event again.
 */
export async function releasePaymentEvent(
  db: Db,
  provider: 'abacatepay' | 'stripe',
  eventId: string
): Promise<void> {
  try {
    await db.collection(COLLECTION).deleteOne({ provider, eventId });
  } catch (error: any) {
    // Claim is stuck: credits were NOT granted and retries will be rejected.
    Sentry.captureMessage('CRITICAL: failed to release payment event claim', {
      level: 'fatal',
      extra: { provider, eventId, error: error?.message },
    });
    console.error('[PAYMENT-IDEMPOTENCY] CRITICAL: failed to release claim', {
      provider,
      eventId,
      error: error?.message,
    });
  }
}
