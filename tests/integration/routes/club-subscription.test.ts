import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { request } from '../../helpers/app.js';
import { buildWebhookRequest } from '../../mocks/stripe.js';
import { mswServer } from '../../mocks/server.js';

/**
 * Assinatura do Visant Club que chega ANTES da conta.
 *
 * Até 14/09/2026 quem assinava o Club pela landing sem ter conta no Labs pagava
 * e não recebia nada: o webhook de mode:'subscription' só procurava o usuário
 * e escrevia "User not found for customer" no log. E o link "Comprei e nunca
 * criei senha" respondia sucesso sem mandar e-mail pra conta sem senha. Os
 * dois defeitos passavam por todo portão, porque só aparecem na primeira venda
 * de alguém sem cadastro.
 */

const SUB_ID = 'sub_club_test';
const periodEnd = () => Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

async function mongoUser(email: string) {
  const { connectToMongoDB, getDb } = await import('../../../server/db/mongodb.js');
  await connectToMongoDB();
  return getDb().collection('users').findOne({ email });
}

function stubClubSubscription() {
  mswServer.use(
    http.get('https://api.stripe.com/v1/subscriptions/:id', ({ params }) =>
      HttpResponse.json({
        id: params.id,
        object: 'subscription',
        status: 'active',
        current_period_end: periodEnd(),
        items: {
          object: 'list',
          data: [
            {
              id: 'si_club_test',
              quantity: 1,
              current_period_end: periodEnd(),
              price: { id: 'price_club_test', product: 'prod_club_test' },
            },
          ],
        },
      })
    ),
    http.get('https://api.stripe.com/v1/products/:productId', ({ params }) =>
      HttpResponse.json({
        id: params.productId,
        object: 'product',
        active: true,
        name: 'Visant Club',
        metadata: { tier: 'club', monthlyCredits: '60' },
      })
    )
  );
}

const subscriptionSession = (
  email: string,
  sessionId: string,
  metadata: Record<string, string>
) => ({
  id: sessionId,
  object: 'checkout.session',
  mode: 'subscription',
  payment_status: 'paid',
  status: 'complete',
  created: Math.floor(Date.now() / 1000),
  customer: 'cus_club_new',
  customer_email: null,
  customer_details: { email, name: 'Assinante Novo' },
  subscription: SUB_ID,
  amount_total: 4990,
  currency: 'brl',
  metadata,
});

const CLUB_META = {
  club: 'fundador',
  kind: 'fundador',
  tier: 'club',
  ritmo: 'mensal',
  monthlyCredits: '60',
};

describe('POST /api/payments/webhook — assinatura sem conta', () => {
  beforeEach(stubClubSubscription);

  it('cria a conta sem senha e aplica o tier do produto', async () => {
    // Maiúscula de propósito: o Stripe devolve o e-mail como a pessoa digitou.
    const { payload, signature } = buildWebhookRequest(
      'checkout.session.completed',
      subscriptionSession('Novo.Assinante@Example.com', 'cs_sub_nova_conta', CLUB_META)
    );

    const res = await (await request())
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', signature)
      .send(payload);
    expect(res.status).not.toBe(400);

    const user = await mongoUser('novo.assinante@example.com');
    expect(user, 'a conta tinha que ter nascido').toBeTruthy();
    expect(user?.password ?? null).toBeNull();
    expect(user?.subscriptionStatus).toBe('active');
    expect(user?.subscriptionTier).toBe('club');
    expect(user?.monthlyCredits).toBe(60);
    expect(user?.stripeSubscriptionId).toBe(SUB_ID);
    expect(user?.stripeCustomerId).toBe('cus_club_new');
  });

  it('a mesma sessão chegando de novo não zera os créditos já usados', async () => {
    // Há DOIS endpoints de webhook cadastrados no Stripe apontando pra mesma
    // URL: toda sessão chega duas vezes em produção.
    const { payload, signature } = buildWebhookRequest(
      'checkout.session.completed',
      subscriptionSession('repete@example.com', 'cs_sub_repetida', CLUB_META)
    );
    const post = async () =>
      (await request())
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', signature)
        .send(payload);

    await post();
    const { connectToMongoDB, getDb } = await import('../../../server/db/mongodb.js');
    await connectToMongoDB();
    await getDb()
      .collection('users')
      .updateOne({ email: 'repete@example.com' }, { $set: { creditsUsed: 7 } });

    await post();
    const user = await mongoUser('repete@example.com');
    expect(user?.creditsUsed).toBe(7);
  });
});

describe('POST /api/auth/forgot-password — conta sem senha', () => {
  it('gera o token de senha pra conta criada pela compra', async () => {
    const { prisma } = await import('../../../server/db/prisma.js');
    await prisma.user.create({
      data: { email: 'sem-senha@example.com', entitlements: [] as any } as any,
    });

    const res = await (await request())
      .post('/api/auth/forgot-password')
      .send({ email: 'sem-senha@example.com', app: 'club' });
    expect(res.status).toBe(200);

    const user = await prisma.user.findUnique({ where: { email: 'sem-senha@example.com' } });
    expect(user?.passwordResetToken, 'sem token, o e-mail nunca teria o que mandar').toBeTruthy();
  });

  it('recusa um app que não está na lista (o link nunca vira URL livre)', async () => {
    const res = await (await request())
      .post('/api/auth/forgot-password')
      .send({ email: 'qualquer@example.com', app: 'https://evil.example' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/session-from-checkout — assinatura do Club', () => {
  function stubSession(session: Record<string, unknown>) {
    mswServer.use(
      http.get('https://api.stripe.com/v1/checkout/sessions/:id', () => HttpResponse.json(session))
    );
  }

  beforeEach(stubClubSubscription);

  it('troca a sessão paga por login e já deixa a conta no tier do Club', async () => {
    stubSession(subscriptionSession('chegou-agora@example.com', 'cs_sub_troca', CLUB_META));

    const res = await (await request())
      .post('/api/auth/session-from-checkout')
      .send({ sessionId: 'cs_sub_troca' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.sku).toBe('club');

    const user = await mongoUser('chegou-agora@example.com');
    expect(user?.subscriptionTier).toBe('club');
    expect(user?.subscriptionStatus).toBe('active');
  });

  it('recusa assinatura que não é do Club', async () => {
    stubSession(subscriptionSession('labs@example.com', 'cs_sub_labs', {}));

    const res = await (await request())
      .post('/api/auth/session-from-checkout')
      .send({ sessionId: 'cs_sub_labs' });

    expect(res.status).toBe(400);
  });
});
