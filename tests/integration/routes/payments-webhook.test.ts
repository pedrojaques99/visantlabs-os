import { describe, it, expect } from 'vitest';
import { request } from '../../helpers/app.js';
import { buildWebhookRequest } from '../../mocks/stripe.js';

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
