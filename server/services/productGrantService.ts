// Grant de PRODUTO avulso (e-book etc.) — cria/acha o usuário por email e
// garante o entitlement. Usa Prisma (provider mongodb) para que os defaults do
// User sejam aplicados corretamente ao criar contas passwordless (comprou antes
// de ter conta). Idempotente por sessionId e por sku.
//
// Reusado por: api/payments/webhook.ts (verdade) e /auth/session-from-checkout.
//
// NOTA: o campo `entitlements` foi adicionado ao schema Prisma; enquanto
// `prisma generate` não roda com o server parado, os tipos não o conhecem —
// por isso os casts `as any` nos acessos a esse campo (só nele).
import { prisma } from '../db/prisma.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import {
  claimPaymentEvent,
  releasePaymentEvent,
  isPaymentEventClaimed,
} from '../lib/paymentIdempotency.js';
import {
  withEntitlement,
  hasEntitlementForSession,
  hasEntitlement,
  type Entitlement,
} from '../lib/entitlements.js';

/**
 * Marcador durável de "esta compra foi reembolsada/contestada". Mora em
 * `processed_payment_events` (índice único já existente), então serve ao mesmo
 * tempo de idempotência da revogação e de trava contra re-grant: um redelivery
 * do checkout.session.completed ou a troca do session_id não devolvem o acesso.
 */
const revokeMarker = (sessionId: string) => `product-revoke:${sessionId}`;

/** A compra desta sessão foi revogada (reembolso/chargeback). */
export class ProductGrantRevokedError extends Error {
  constructor(public readonly sessionId: string) {
    super('Product purchase was refunded or disputed');
    this.name = 'ProductGrantRevokedError';
  }
}

export interface GrantProductInput {
  email: string;
  sku: string;
  sessionId?: string;
  source?: string; // 'stripe' | 'manual'
  name?: string;
  stripeCustomerId?: string;
}

export interface GrantProductResult {
  userId: string;
  email: string;
  granted: boolean; // true = escreveu agora; false = já tinha
  created: boolean; // true = conta criada agora (passwordless)
  entitlements: Entitlement[];
}

export async function grantProduct(input: GrantProductInput): Promise<GrantProductResult> {
  const email = (input.email || '').toLowerCase().trim();
  if (!email) throw new Error('grantProduct: email is required');
  const sku = (input.sku || '').trim();
  if (!sku) throw new Error('grantProduct: sku is required');

  if (input.sessionId) {
    await connectToMongoDB();
    if (await isPaymentEventClaimed(getDb(), 'stripe', revokeMarker(input.sessionId))) {
      throw new ProductGrantRevokedError(input.sessionId);
    }
  }

  let user = await prisma.user.findUnique({ where: { email } });
  let created = false;

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        name: input.name,
        ...(input.stripeCustomerId ? { stripeCustomerId: input.stripeCustomerId } : {}),
        // conta passwordless: sem `password` → signin exige Google/definir senha.
        entitlements: [] as any,
      } as any,
    });
    created = true;
  } else if (input.stripeCustomerId && !user.stripeCustomerId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId: input.stripeCustomerId },
    });
  }

  const raw = (user as any).entitlements;

  // Idempotência: já gravado por esta sessão OU já possui o sku.
  if (
    (input.sessionId && hasEntitlementForSession(raw, input.sessionId)) ||
    hasEntitlement(raw, sku)
  ) {
    const { toEntitlements } = await import('../lib/entitlements.js');
    return {
      userId: user.id,
      email: user.email,
      granted: false,
      created,
      entitlements: toEntitlements(raw),
    };
  }

  const next = withEntitlement(raw, {
    sku,
    kind: 'product',
    source: input.source || 'stripe',
    sessionId: input.sessionId,
  });

  // withEntitlement retorna null se nada muda (já possui) — coberto acima, mas
  // guardamos por segurança.
  if (!next) {
    const { toEntitlements } = await import('../lib/entitlements.js');
    return {
      userId: user.id,
      email: user.email,
      granted: false,
      created,
      entitlements: toEntitlements(raw),
    };
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { entitlements: next as any },
  });

  return {
    userId: updated.id,
    email: updated.email,
    granted: true,
    created,
    entitlements: next,
  };
}

export interface RevokeProductGrantResult {
  revoked: boolean; // true = tirou o entitlement agora
  already: boolean; // true = esta sessão já tinha sido revogada antes
  userId?: string;
  sku?: string;
}

/**
 * Revoga o entitlement concedido por UMA sessão de checkout (reembolso total ou
 * chargeback). Casa pelo `sessionId` gravado no entitlement, não por e-mail nem
 * por sku: um sku que o usuário tem por outra via (grant manual, outra compra)
 * continua intacto.
 *
 * Idempotente: o marcador é carimbado antes do write e liberado se o write
 * falhar (mesmo padrão do claim de pagamento), então o retry do Stripe e o
 * segundo endpoint de webhook não fazem nada duas vezes.
 */
export async function revokeProductGrant(input: {
  sessionId: string;
}): Promise<RevokeProductGrantResult> {
  const sessionId = (input.sessionId || '').trim();
  if (!sessionId) throw new Error('revokeProductGrant: sessionId is required');

  await connectToMongoDB();
  const db = getDb();
  const marker = revokeMarker(sessionId);

  if (!(await claimPaymentEvent(db, 'stripe', marker))) {
    return { revoked: false, already: true };
  }

  try {
    const users = db.collection('users');
    const user = await users.findOne(
      { 'entitlements.sessionId': sessionId },
      { projection: { _id: 1, entitlements: 1 } }
    );
    if (!user) return { revoked: false, already: false };

    const sku = (Array.isArray(user.entitlements) ? user.entitlements : []).find(
      (e: any) => e && e.sessionId === sessionId
    )?.sku;

    await users.updateOne({ _id: user._id }, { $pull: { entitlements: { sessionId } } as any });
    return { revoked: true, already: false, userId: String(user._id), sku };
  } catch (error) {
    await releasePaymentEvent(db, 'stripe', marker);
    throw error;
  }
}
