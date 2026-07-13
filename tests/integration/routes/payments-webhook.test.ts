import { describe, it, expect } from 'vitest';
import { request } from '../../helpers/app.js';
import { buildWebhookRequest } from '../../mocks/stripe.js';
import { createUser } from '../../factories/user.js';

/** Read the Mongo user doc the webhook handler writes to (not the Prisma row). */
async function getMongoUser(email: string) {
  const { connectToMongoDB, getDb } = await import('../../../server/db/mongodb.js');
  await connectToMongoDB();
  return getDb().collection('users').findOne({ email });
}

/**
 * Stripe webhook signature contract.
 *
 * Why this matters: a signature bypass here = free credits / payment forgery.
 * Keep these tests even if coverage elsewhere slips.
 */
describe('POST /api/payments/webhook', () => {
  it('rejects requests without signature header', async () => {
    const { payload } = buildWebhookRequest('checkout.session.completed', { id: 'cs_test' });
    const agent = await request();

    const res = await agent
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .send(payload);

    expect(res.status).toBe(400);
  });

  it('rejects invalid signature', async () => {
    const { payload } = buildWebhookRequest('checkout.session.completed', { id: 'cs_test' });
    const agent = await request();

    const res = await agent
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1,v1=deadbeef')
      .send(payload);

    expect(res.status).toBe(400);
  });

  it('accepts request signed with the test webhook secret', async () => {
    const { payload, signature } = buildWebhookRequest('checkout.session.completed', {
      id: 'cs_test_valid',
      customer: 'cus_test',
      metadata: {},
    });
    const agent = await request();

    const res = await agent
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);

    // Signature valid → handler proceeds. Exact status depends on event type
    // but MUST NOT be a signature-rejection (400).
    expect(res.status).not.toBe(400);
  });
});

/**
 * Visant Club — one-time "Fundador" grant via the payment-mode branch.
 *
 * The branch reads only session.metadata + does DB ops (no Stripe API call),
 * so it's fully exercisable here with a real signed webhook. Guards the
 * money path: metadata.club must flip the user to the club tier, must NOT
 * fall through to the credit flow, and must be idempotent on redelivery.
 */
describe('POST /api/payments/webhook — Visant Club grant', () => {
  const clubMetadata = {
    club: 'fundador',
    tier: 'club',
    lifetime: 'true',
    monthlyCredits: '1000',
  };

  const clubSession = (email: string, sessionId: string) => ({
    id: sessionId,
    object: 'checkout.session',
    mode: 'payment',
    payment_status: 'paid',
    customer: 'cus_club_test',
    customer_email: email,
    amount_total: 49900,
    currency: 'usd',
    metadata: clubMetadata,
  });

  it('grants the club tier to an existing user matched by email', async () => {
    const { user } = await createUser({ subscriptionTier: 'free' });
    const { payload, signature } = buildWebhookRequest(
      'checkout.session.completed',
      clubSession(user.email, 'cs_club_grant')
    );

    const res = await (await request())
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);

    expect(res.status).not.toBe(400);

    const updated = await getMongoUser(user.email);
    expect(updated?.subscriptionStatus).toBe('active');
    expect(updated?.subscriptionTier).toBe('club');
    expect(updated?.monthlyCredits).toBe(1000);
    expect(updated?.metadata?.clubFounder).toBe(true);
    // Lifetime → subscriptionEndDate pushed far into the future.
    expect(new Date(updated?.subscriptionEndDate).getFullYear()).toBeGreaterThan(2090);
    // Matched by email → customerId gets associated for next time.
    expect(updated?.stripeCustomerId).toBe('cus_club_test');
  });

  it('is idempotent — a redelivery does not re-reset the founder', async () => {
    const { user } = await createUser({ subscriptionTier: 'free' });
    // Build one signed request and replay the exact same bytes twice —
    // idempotency keys on session.id, which is stable across the redelivery.
    const { payload, signature } = buildWebhookRequest(
      'checkout.session.completed',
      clubSession(user.email, 'cs_club_dupe')
    );
    const post = async () =>
      (await request())
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', signature)
        .send(payload);

    await post();
    // Founder spends some credits between deliveries.
    const { connectToMongoDB, getDb } = await import('../../../server/db/mongodb.js');
    await connectToMongoDB();
    await getDb()
      .collection('users')
      .updateOne({ email: user.email }, { $set: { creditsUsed: 42 } });

    // Same session id redelivered → idempotency claim skips the re-grant,
    // so creditsUsed is NOT reset back to 0.
    await post();

    const updated = await getMongoUser(user.email);
    expect(updated?.subscriptionTier).toBe('club');
    expect(updated?.creditsUsed).toBe(42);
  });
});
