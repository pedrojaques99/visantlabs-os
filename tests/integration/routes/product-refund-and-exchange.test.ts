import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { request } from '../../helpers/app.js';
import { buildWebhookRequest } from '../../mocks/stripe.js';
import { mswServer } from '../../mocks/server.js';
import { createUser } from '../../factories/user.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

/**
 * Quick wins de segurança do audit do Visant Club (03/10/2026):
 *  - reembolso total / chargeback tiram o entitlement do produto avulso;
 *  - o session_id do checkout vira login UMA vez só;
 *  - claim-club exige e-mail verificado.
 */

async function mongoUser(email: string) {
  const { connectToMongoDB, getDb } = await import('../../../server/db/mongodb.js');
  await connectToMongoDB();
  return getDb().collection('users').findOne({ email });
}

const productSession = (email: string, id: string, extra: Record<string, unknown> = {}) => ({
  id,
  object: 'checkout.session',
  mode: 'payment',
  payment_status: 'paid',
  status: 'complete',
  created: Math.floor(Date.now() / 1000),
  customer: null,
  customer_email: null,
  customer_details: { email, name: 'Comprador' },
  payment_intent: `pi_${id}`,
  amount_total: 29700,
  currency: 'brl',
  metadata: { kind: 'product', sku: 'ia-aplicada' },
  ...extra,
});

/** Stripe API: retrieve + list-by-payment_intent devolvem a mesma sessão. */
function stubSession(session: Record<string, unknown>) {
  mswServer.use(
    http.get('https://api.stripe.com/v1/checkout/sessions/:id', () => HttpResponse.json(session)),
    http.get('https://api.stripe.com/v1/checkout/sessions', () =>
      HttpResponse.json({ object: 'list', data: [session], has_more: false })
    )
  );
}

async function postWebhook(type: string, data: Record<string, unknown>) {
  const { payload, signature } = buildWebhookRequest(type, data);
  return (await request())
    .post('/api/payments/webhook')
    .set('Content-Type', 'application/json')
    .set('stripe-signature', signature)
    .send(payload);
}

async function grantViaWebhook(session: ReturnType<typeof productSession>) {
  const res = await postWebhook('checkout.session.completed', session);
  expect(res.status).toBe(200);
}

describe('webhook — reembolso e chargeback revogam o produto avulso', () => {
  it('charge.refunded total tira o entitlement, é idempotente e não deixa re-grant', async () => {
    const email = 'reembolso@example.com';
    const session = productSession(email, 'cs_refund_full');
    stubSession(session);
    await grantViaWebhook(session);
    expect((await mongoUser(email))?.entitlements).toHaveLength(1);

    const charge = {
      id: 'ch_full',
      object: 'charge',
      refunded: true,
      payment_intent: 'pi_cs_refund_full',
    };
    expect((await postWebhook('charge.refunded', charge)).status).toBe(200);
    expect((await mongoUser(email))?.entitlements).toHaveLength(0);

    // Segundo endpoint / retry do Stripe: nada muda, nada quebra.
    expect((await postWebhook('charge.refunded', charge)).status).toBe(200);

    // Redelivery do checkout.session.completed não devolve o acesso.
    await grantViaWebhook(session);
    expect((await mongoUser(email))?.entitlements).toHaveLength(0);

    // Nem a troca do session_id vira login.
    const exch = await (await request())
      .post('/api/auth/session-from-checkout')
      .send({ sessionId: session.id });
    expect(exch.status).toBe(410);
    expect(exch.body.expired).toBe(true);
  });

  it('reembolso parcial mantém o acesso', async () => {
    const email = 'parcial@example.com';
    const session = productSession(email, 'cs_refund_partial');
    stubSession(session);
    await grantViaWebhook(session);

    const res = await postWebhook('charge.refunded', {
      id: 'ch_partial',
      object: 'charge',
      refunded: false,
      payment_intent: 'pi_cs_refund_partial',
    });
    expect(res.status).toBe(200);
    expect((await mongoUser(email))?.entitlements).toHaveLength(1);
  });

  it('charge.dispute.created revoga só o entitlement daquela compra', async () => {
    const email = 'disputa@example.com';
    const session = productSession(email, 'cs_dispute');
    stubSession(session);
    await grantViaWebhook(session);

    // Outro produto, de outra via, fica intacto.
    const { connectToMongoDB, getDb } = await import('../../../server/db/mongodb.js');
    await connectToMongoDB();
    await getDb()
      .collection('users')
      .updateOne(
        { email },
        { $push: { entitlements: { sku: 'ebook', kind: 'product', source: 'manual' } } as any }
      );

    const res = await postWebhook('charge.dispute.created', {
      id: 'dp_1',
      object: 'dispute',
      charge: 'ch_dispute',
      payment_intent: 'pi_cs_dispute',
    });
    expect(res.status).toBe(200);
    const ents = (await mongoUser(email))?.entitlements;
    expect(ents.map((e: any) => e.sku)).toEqual(['ebook']);
  });

  it('assinatura não é tocada por este handler', async () => {
    const { user } = await createUser();
    stubSession({
      ...productSession(user.email, 'cs_sub_refund'),
      mode: 'subscription',
      metadata: { club: 'fundador' },
    });
    const res = await postWebhook('charge.refunded', {
      id: 'ch_sub',
      object: 'charge',
      refunded: true,
      payment_intent: 'pi_cs_sub_refund',
    });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/auth/session-from-checkout — uso único', () => {
  it('a primeira troca loga, a segunda devolve 410 "já foi usado"', async () => {
    const session = productSession('uso-unico@example.com', 'cs_single_use');
    stubSession(session);

    const first = await (await request())
      .post('/api/auth/session-from-checkout')
      .send({ sessionId: session.id });
    expect(first.status).toBe(200);
    expect(typeof first.body.token).toBe('string');

    const second = await (await request())
      .post('/api/auth/session-from-checkout')
      .send({ sessionId: session.id });
    expect(second.status).toBe(410);
    expect(second.body.expired).toBe(true);
    expect(second.body.token).toBeUndefined();
  });

  it('sessão com mais de 30 min já não vira login', async () => {
    const session = productSession('velha@example.com', 'cs_too_old', {
      created: Math.floor(Date.now() / 1000) - 31 * 60,
    });
    stubSession(session);

    const res = await (await request())
      .post('/api/auth/session-from-checkout')
      .send({ sessionId: session.id });
    expect(res.status).toBe(410);
  });
});

describe('POST /api/payments/claim-club — e-mail verificado', () => {
  it('conta com e-mail não verificado não reivindica compra', async () => {
    const { user } = await createUser();
    const res = await (await request())
      .post('/api/payments/claim-club')
      .set('Authorization', bearer(signTestToken({ userId: user.id, email: user.email })));
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ granted: false, reason: 'verify-email' });
  });
});
