import Stripe from 'stripe';
import { TEST_STRIPE_WEBHOOK_SECRET } from '../helpers/env.js';

/**
 * Build a Stripe webhook payload + signature using the real Stripe SDK.
 *
 * Using the SDK's own signer guarantees our fixtures match what Stripe sends
 * in production, so the signature-verification code path is exercised for
 * real rather than stubbed.
 */
export function buildWebhookRequest<T extends Record<string, unknown>>(
  eventType: string,
  data: T,
  opts: { secret?: string; tolerance?: number } = {}
): { payload: string; signature: string } {
  const secret = opts.secret ?? TEST_STRIPE_WEBHOOK_SECRET;
  const event = {
    id: `evt_${Math.random().toString(36).slice(2)}`,
    object: 'event',
    api_version: '2024-06-20',
    created: Math.floor(Date.now() / 1000),
    type: eventType,
    data: { object: data },
    livemode: false,
    pending_webhooks: 0,
    request: { id: null, idempotency_key: null },
  };
  const payload = JSON.stringify(event);
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret });
  return { payload, signature: header };
}
