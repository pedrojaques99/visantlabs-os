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
import {
  withEntitlement,
  hasEntitlementForSession,
  hasEntitlement,
  type Entitlement,
} from '../lib/entitlements.js';

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
