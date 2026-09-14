// Assinatura que chega ANTES da conta.
//
// O Visant Club vende assinatura pela landing (visantismo/api/checkout.js), e
// quem assina não precisa ter conta no Labs. Até 14/09/2026 o webhook de
// `checkout.session.completed` em mode:'subscription' só procurava o usuário
// (customerId → e-mail → subscriptionId) e, sem achar, escrevia
// "User not found for customer" no log: a pessoa pagava e não recebia tier.
//
// Este arquivo é o que os dois caminhos da assinatura dividem:
//   - o webhook (server/routes/payments.ts), que é a VERDADE do acesso;
//   - o /auth/session-from-checkout, que é a conveniência do success_url.
//
// A conta nasce passwordless, igual à do produto avulso (productGrantService):
// sem `password`, entra por Google ou pelo e-mail de "definir senha".
import type Stripe from 'stripe';
import type { Db } from 'mongodb';
import { ObjectId } from 'mongodb';
import { prisma } from '../db/prisma.js';

export interface SubscriberInput {
  email: string;
  name?: string;
  stripeCustomerId?: string;
}

export interface SubscriberResult {
  id: string;
  email: string;
  created: boolean;
}

/**
 * Acha a conta pelo e-mail ou cria uma sem senha.
 *
 * Os dois webhooks do Stripe apontam pra mesma URL (há dois endpoints
 * cadastrados), então a mesma sessão chega em paralelo. A corrida entre dois
 * `create` com o mesmo e-mail é resolvida pelo índice único: quem perde recebe
 * P2002 e relê a conta que o outro criou.
 */
export async function findOrCreateSubscriber(input: SubscriberInput): Promise<SubscriberResult> {
  const email = (input.email || '').toLowerCase().trim();
  if (!email) throw new Error('findOrCreateSubscriber: email is required');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { id: existing.id, email: existing.email, created: false };

  try {
    const user = await prisma.user.create({
      data: {
        email,
        name: input.name,
        ...(input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : {}),
        entitlements: [] as any,
      } as any,
    });
    return { id: user.id, email: user.email, created: true };
  } catch (error: any) {
    if (error?.code === 'P2002') {
      const again = await prisma.user.findUnique({ where: { email } });
      if (again) return { id: again.id, email: again.email, created: false };
    }
    throw error;
  }
}

export interface StripePlanInfo {
  tier: string;
  monthlyCredits: number;
  quantity?: number;
}

/**
 * Tier e créditos saem da metadata do PRODUTO do Stripe, não da sessão.
 * Movido de server/routes/payments.ts sem mudar a regra, pra o
 * /auth/session-from-checkout ler o mesmo tier que o webhook grava.
 */
export async function getStripePlanInfo(
  stripe: Stripe | null,
  subscriptionId: string
): Promise<StripePlanInfo | null> {
  if (!stripe) return null;

  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const priceId = subscription.items.data[0]?.price?.id;
    const quantity = subscription.items.data[0]?.quantity;

    if (!priceId) return null;

    const price = await stripe.prices.retrieve(priceId);
    const productId = typeof price.product === 'string' ? price.product : price.product?.id;

    if (!productId) return null;

    const product = await stripe.products.retrieve(productId);
    const metadata = product.metadata || {};

    // Legacy tiers (premium/pro/agency) coexist with the v3 pricing tiers
    // (starter/pro/vision) — 'pro' is shared by both generations and is
    // numerically compatible (500 credits either way; only maxBrands differs,
    // see FALLBACK_MAX_BRANDS in brandQuota.ts for that reconciliation).
    const tier = metadata.tier || 'premium';
    const monthlyCredits = metadata.monthlyCredits
      ? parseInt(metadata.monthlyCredits, 10)
      : tier === 'premium'
        ? 100
        : tier === 'pro'
          ? 500
          : tier === 'agency'
            ? 1000
            : tier === 'starter'
              ? 50
              : tier === 'vision'
                ? 1000
                : 3;

    return { tier, monthlyCredits, quantity };
  } catch (error) {
    console.error('Error fetching Stripe plan info:', error);
    return null;
  }
}

/** Fim do período atual, nas duas formas que a API do Stripe já usou. */
export function periodEndOf(subscription: Stripe.Subscription): Date {
  const raw =
    (subscription as any).items?.data?.[0]?.current_period_end ??
    (subscription as any).current_period_end;
  return typeof raw === 'number'
    ? new Date(raw * 1000)
    : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000);
}

export interface ActivateInput {
  db: Db;
  userId: string;
  subscriptionId: string;
  customerId?: string;
  tier: string;
  monthlyCredits: number;
  periodEnd: Date;
}

/**
 * Aplica o tier quando a assinatura AINDA NÃO está gravada nesta conta.
 *
 * Usado pelo /auth/session-from-checkout, que corre em paralelo com o webhook.
 * Se o webhook já gravou esta assinatura, não mexe: reescrever zeraria o
 * `creditsUsed` de quem já começou a usar. Devolve `true` quando escreveu.
 */
export async function activateIfPending(input: ActivateInput): Promise<boolean> {
  const _id = new ObjectId(input.userId);
  const current = await input.db.collection('users').findOne({ _id });
  if (
    current?.stripeSubscriptionId === input.subscriptionId &&
    current?.subscriptionStatus === 'active'
  ) {
    return false;
  }

  await input.db.collection('users').updateOne(
    { _id },
    {
      $set: {
        subscriptionStatus: 'active',
        subscriptionTier: input.tier,
        stripeSubscriptionId: input.subscriptionId,
        ...(input.customerId ? { stripeCustomerId: input.customerId } : {}),
        subscriptionEndDate: input.periodEnd,
        monthlyCredits: input.monthlyCredits,
        creditsUsed: 0,
        creditsResetDate: input.periodEnd,
      },
    }
  );
  return true;
}
