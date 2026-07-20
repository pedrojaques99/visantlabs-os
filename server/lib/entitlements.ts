// Entitlements — permissões de PRODUTO avulso (ex.: e-book), distintas do
// subscriptionTier (club). Um usuário pode ter tier=free/club E possuir
// produtos avulsos. Fonte da verdade: campo `entitlements` no doc do usuário
// (Mongo/Prisma — mesma coleção `users`).
//
// Formato de cada entitlement:
//   { sku, kind:'product', source:'stripe', sessionId, grantedAt }

export interface Entitlement {
  sku: string;
  kind: string; // 'product'
  source: string; // 'stripe' | 'manual' | ...
  sessionId?: string; // idempotência + rastreio (Stripe checkout session id)
  grantedAt: string; // ISO
}

/** Normaliza o valor cru do campo (Json?) numa lista tipada. */
export function toEntitlements(raw: unknown): Entitlement[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is Entitlement => !!e && typeof e === 'object' && typeof (e as any).sku === 'string'
  );
}

/** O usuário possui o produto `sku`? */
export function hasEntitlement(raw: unknown, sku: string): boolean {
  const s = (sku || '').trim().toLowerCase();
  if (!s) return false;
  return toEntitlements(raw).some((e) => e.sku.toLowerCase() === s);
}

/** Já existe um entitlement gravado por esta sessão do Stripe? (idempotência) */
export function hasEntitlementForSession(raw: unknown, sessionId: string): boolean {
  if (!sessionId) return false;
  return toEntitlements(raw).some((e) => e.sessionId === sessionId);
}

/**
 * Retorna a nova lista de entitlements com o produto garantido (idempotente).
 * Não duplica por sku nem por sessionId. Retorna null se nada muda
 * (já possui o sku) — o chamador pode pular o write.
 */
export function withEntitlement(
  raw: unknown,
  entitlement: Omit<Entitlement, 'grantedAt'> & { grantedAt?: string }
): Entitlement[] | null {
  const list = toEntitlements(raw);
  const sku = entitlement.sku.trim().toLowerCase();
  const already = list.some((e) => e.sku.toLowerCase() === sku);
  if (already) return null;
  return [
    ...list,
    {
      sku: entitlement.sku,
      kind: entitlement.kind || 'product',
      source: entitlement.source || 'stripe',
      sessionId: entitlement.sessionId,
      grantedAt: entitlement.grantedAt || new Date().toISOString(),
    },
  ];
}
