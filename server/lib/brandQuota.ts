/**
 * Brand quota — single source of truth for "marcas ativas" billing (Fase 2 do
 * Revenue-Centric Realignment).
 *
 * The billable unit is an ACTIVE BrandGuideline (status !== 'archived').
 * Archived brands are read-only, don't consume a slot and can't generate —
 * data is NEVER deleted because of billing.
 *
 * Enforcement is opt-in via the FEATURE_BRAND_BILLING flag (rollout pattern of
 * the plan): with the flag off, quotas are still computed/reported but never
 * block anything.
 */

import { prisma } from '../db/prisma.js';
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { flagEnabled } from './featureFlags.js';
import {
  sendBrandQuotaDowngradeEmail,
  sendBrandQuotaReminderEmail,
  sendBrandQuotaArchivedEmail,
} from '../services/emailService.js';

export interface AtRiskBrand {
  id: string;
  name: string;
}

export interface BrandQuota {
  /** Active (non-archived) brands OWNED by the user. Shared brands count on the owner. */
  used: number;
  /** Effective limit. `null` = unlimited (admin, or agency without a Stripe quantity cap). */
  max: number | null;
  /** Effective tier used for the limit ('free' when the subscription isn't active). */
  tier: string;
  /**
   * ISO date até quando marcas em excesso seguem ativas após um downgrade
   * (janela de tolerância de 7 dias). `null`/ausente = sem downgrade pendente.
   * Alimenta o banner de grace no frontend (RCD §3.5 — moldura de perda).
   */
  graceUntil?: string | null;
  /**
   * As marcas que o cron arquiva quando a janela expirar, na ordem em que ele
   * vai pegá-las. Só é preenchido durante uma janela de grace.
   *
   * Existe porque o e-mail de downgrade nomeia as marcas em risco e a tela não
   * nomeava: o usuário chegava pelo CTA "escolher quais manter" e via todas as
   * marcas iguais. Vem do MESMO seletor que o e-mail e o cron usam
   * (selectExcessBrands), então tela, e-mail e execução nunca divergem.
   */
  atRisk?: AtRiskBrand[];
}

/**
 * SSoT de "quais marcas caem primeiro". Menos recentemente atualizada primeiro,
 * que é a leitura de "menos usada" que o e-mail promete ao usuário.
 *
 * Três lugares precisam desta mesma lista (o aviso por e-mail, a quota que a
 * tela lê, e o cron que executa). Ter a consulta copiada nos três era garantia
 * de divergir com o tempo: bastava um mudar o `orderBy` e o e-mail passaria a
 * mentir sobre o que ia acontecer.
 */
async function selectExcessBrands(userId: string, excess: number): Promise<AtRiskBrand[]> {
  if (excess <= 0) return [];
  const rows = await prisma.brandGuideline.findMany({
    where: { userId, ...ACTIVE_BRAND_WHERE },
    orderBy: { updatedAt: 'asc' },
    take: excess,
    select: { id: true, identity: true },
  });
  return rows.map((b) => {
    const name = (b.identity as any)?.name;
    return {
      id: b.id,
      name: typeof name === 'string' && name.trim() ? name.trim() : 'Marca sem nome',
    };
  });
}

/**
 * Hardcoded fallbacks, same pattern as payments.ts monthlyCredits fallbacks.
 * Product.metadata.maxBrands (admin-managed) overrides these when present.
 * Agency is unlimited by default — the Stripe subscription `quantity`
 * (user.metadata.agencyBrandQuantity) is what caps it.
 *
 * Pricing v3 (starter/pro/vision) reuses the storage tier names but the
 * `pro` KEY is shared with the legacy tier — there is no separate namespace.
 * CONFLICT: legacy `pro` capped maxBrands at 10; the v3 spec defines the new
 * Pro tier as unlimited brands (null). Since both generations share the same
 * `tier` string, this fallback now resolves to `null` for ALL `pro` accounts,
 * legacy included, unless a Product.metadata.maxBrands override exists for
 * that specific product (tierLimitFromProduct is checked first, above this
 * fallback). If any legacy `pro` Stripe product still needs the old 10-brand
 * cap, set `maxBrands: 10` on its Product.metadata explicitly — no data
 * migration was performed here per the "no invented migration" constraint.
 * `starter` (v3 free-equivalent) and `vision` (v3 top tier) are new aliases
 * with no legacy collision.
 */
const FALLBACK_MAX_BRANDS: Record<string, number | null> = {
  free: 1,
  premium: 3,
  pro: null, // v3 Pro = unlimited brands (was 10 under the legacy-only tier)
  agency: null,
  starter: 1,
  vision: null,
};

export function brandBillingEnabled(): boolean {
  return flagEnabled('FEATURE_BRAND_BILLING');
}

/**
 * "Active" filter that also matches legacy docs created before the status field
 * existed. Demo brands (onboarding "explore first" clone) never consume a slot
 * and are never archived by billing — training wheels, not inventory.
 */
export const ACTIVE_BRAND_WHERE = {
  NOT: { status: 'archived' },
  isDemo: { not: true },
} as const;

// In-memory cache for the subscription_plan product list — shared by both the
// brand and seat limit lookups (tierLimitFromProduct below). 60s TTL: admin
// edits to Product.metadata (maxBrands/maxEditorsPerBrand) don't need to be
// instant, and this collection is tiny/rarely-changing but read on every
// quota check (creation, invite, subscription-status).
let productCache: {
  at: number;
  products: Awaited<ReturnType<typeof prisma.product.findMany>>;
} | null = null;
const PRODUCT_CACHE_TTL_MS = 60_000;

async function getSubscriptionProducts() {
  if (productCache && Date.now() - productCache.at < PRODUCT_CACHE_TTL_MS) {
    return productCache.products;
  }
  const products = await prisma.product.findMany({
    where: { type: 'subscription_plan', isActive: true },
  });
  productCache = { at: Date.now(), products };
  return products;
}

/**
 * Shared resolver for both Product.metadata.maxBrands and
 * .maxEditorsPerBrand — same lookup/parsing rules, only the metadata key and
 * the "0 is valid" rule differ (seats allow 0 = no editors on that tier;
 * brands never allow 0 — everyone gets at least one brand).
 */
async function tierLimitFromProduct(
  tier: string,
  metadataKey: 'maxBrands' | 'maxEditorsPerBrand',
  { allowZero = false }: { allowZero?: boolean } = {}
): Promise<number | null | undefined> {
  try {
    const products = await getSubscriptionProducts();
    // Match manually to avoid JSON filtering issues on MongoDB (payments.ts pattern).
    const product = products.find(
      (p) => (p.metadata as any)?.tier === tier || p.productId.includes(tier)
    );
    const raw = (product?.metadata as Record<string, any> | null)?.[metadataKey];
    if (raw === undefined || raw === null) return undefined;
    if (raw === 'unlimited' || raw === -1 || raw === '-1') return null;
    const n = parseInt(String(raw), 10);
    if (!Number.isFinite(n)) return undefined;
    return n > 0 || (allowZero && n === 0) ? n : undefined;
  } catch {
    return undefined; // DB hiccup → hardcoded fallback
  }
}

interface QuotaUserShape {
  id?: string;
  _id?: any;
  subscriptionStatus?: string | null;
  subscriptionTier?: string | null;
  isAdmin?: boolean | null;
  metadata?: any;
}

/**
 * Compute the brand quota for a user record (Prisma or raw Mongo doc).
 *
 * Rules (plan §Fase 2):
 * - effective tier = subscriptionTier only while the subscription is active;
 *   churned users fall back to 'free' (grandfather does NOT survive churn of a
 *   paid plan — but legacyBrands from the one-time migration still applies).
 * - limit = Product.metadata.maxBrands → hardcoded fallback.
 * - agency: limit = user.metadata.agencyBrandQuantity (Stripe quantity) when set.
 * - grandfathering: effective limit = max(tierLimit, user.metadata.legacyBrands).
 * - admins: unlimited (consistent with every other money gate in the repo).
 */
export async function getBrandQuota(user: QuotaUserShape): Promise<BrandQuota> {
  const userId = String(user.id ?? user._id ?? '');
  const used = userId
    ? await prisma.brandGuideline.count({ where: { userId, ...ACTIVE_BRAND_WHERE } })
    : 0;

  const tier = effectiveTier(user);

  if (user.isAdmin === true) {
    return { used, max: null, tier };
  }

  const meta = (user.metadata as Record<string, any> | null) || {};

  let max: number | null;
  const fromProduct = await tierLimitFromProduct(tier, 'maxBrands');
  // NOTE: `null` means unlimited, so `??` would wrongly coerce agency to the
  // free fallback — use an explicit key check instead.
  const tierLimit =
    fromProduct !== undefined
      ? fromProduct
      : tier in FALLBACK_MAX_BRANDS
        ? FALLBACK_MAX_BRANDS[tier]
        : FALLBACK_MAX_BRANDS.free;

  if (tier === 'agency') {
    const qty = Number(meta.agencyBrandQuantity);
    max = Number.isFinite(qty) && qty > 0 ? qty : tierLimit;
  } else {
    max = tierLimit;
  }

  // Grandfathering: early users keep everything they had at migration time.
  const legacy = Number(meta.legacyBrands);
  if (max !== null && Number.isFinite(legacy) && legacy > max) {
    max = legacy;
  }

  // Janela de tolerância de downgrade (só relevante enquanto ainda há excesso).
  const graceUntil =
    typeof meta.brandQuotaGraceUntil === 'string' && meta.brandQuotaGraceUntil
      ? meta.brandQuotaGraceUntil
      : null;

  // Só durante a janela: fora dela a consulta extra não paga o custo, e a tela
  // não tem o que destacar.
  const excess = max === null ? 0 : Math.max(0, used - max);
  const atRisk = graceUntil && excess > 0 ? await selectExcessBrands(userId, excess) : undefined;

  return { used, max, tier, graceUntil, atRisk };
}

/** Load the user and compute the quota. */
export async function getBrandQuotaForUserId(userId: string): Promise<BrandQuota> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      subscriptionStatus: true,
      subscriptionTier: true,
      isAdmin: true,
      metadata: true,
    },
  });
  if (!user) return { used: 0, max: FALLBACK_MAX_BRANDS.free, tier: 'free' };
  return getBrandQuota(user);
}

/**
 * Gate for CREATING or UNARCHIVING a brand. Existing brands are never blocked
 * retroactively — this is the only enforcement point besides generation-on-archived.
 */
export async function checkBrandActivation(
  userId: string
): Promise<{ allowed: boolean; quota: BrandQuota }> {
  const quota = await getBrandQuotaForUserId(userId);
  if (!brandBillingEnabled()) return { allowed: true, quota };
  const allowed = quota.max === null || quota.used < quota.max;
  return { allowed, quota };
}

/** Standard 402 payload for the frontend paywall (variant `brand_limit`). */
export function brandLimitPayload(quota: BrandQuota) {
  return {
    error: 'brand_limit',
    reason: 'brand_limit',
    used: quota.used,
    max: quota.max,
    tier: quota.tier,
    upgradeUrl: '/pricing',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SEAT QUOTA — editors per brand (Fase 4, tasks 4.2/4.5/4.6)
//
// A "seat" is an EDITOR on a brand (canEdit[]). Viewers are ALWAYS free —
// viewer = the end client approving work; it's bait, not cost. The owner never
// counts against their own seats. Pending editor invites count as used seats
// so the gate lives at invite CREATION (no race on accept).
// ═══════════════════════════════════════════════════════════════════════════

export interface SeatQuota {
  /** Editor seats in use on the brand: canEdit[] (minus owner) + pending editor invites. */
  used: number;
  /** Editor seats allowed per brand for the tier. `null` = unlimited. */
  max: number | null;
  /** Effective tier (same resolution rules as BrandQuota). */
  tier: string;
}

/**
 * Hardcoded fallbacks (plan §Fase 2 table: seats/marca). Product.metadata
 * .maxEditorsPerBrand (admin-managed) overrides these when present.
 *
 * `used` here excludes the owner (see SeatQuota docstring), so these numbers
 * are "seats" MINUS ONE vs. the v3 pricing table (Starter 1 seat total = 0
 * extra editors, Pro 5 seats total = 4 extra editors, Vision unlimited seats
 * = null). Same `pro` KEY collision as FALLBACK_MAX_BRANDS: legacy `pro`
 * allowed 3 extra editors (4 seats total); v3 Pro allows 4 (5 seats total).
 * Resolved by bumping the shared `pro` fallback to the v3 value (4) — legacy
 * `pro` subscribers gain one extra editor seat unless their Product.metadata
 * .maxEditorsPerBrand pins the old value. `vision` mirrors `agency`
 * (unlimited); `starter` mirrors `free` (owner only).
 */
const FALLBACK_MAX_EDITORS: Record<string, number | null> = {
  free: 0,
  premium: 1,
  pro: 4, // v3 Pro = 5 seats total (was 3 extra editors / 4 seats under legacy)
  agency: null,
  starter: 0,
  vision: null,
};

function effectiveTier(user: QuotaUserShape): string {
  const status = user.subscriptionStatus || 'free';
  const rawTier = user.subscriptionTier || 'free';
  return status === 'active' && rawTier !== 'free' ? rawTier : 'free';
}

/**
 * "Not expired" filter for BrandInvite. Mongo connector caveat: invites created
 * without expiry leave the field UNSET, and neither `null` equality nor a
 * negated comparison matches unset fields — `isSet: false` is required.
 */
function notExpiredOr() {
  return [{ expiresAt: { isSet: false } }, { expiresAt: null }, { expiresAt: { gt: new Date() } }];
}

/** Editor seats in use on ONE brand: unique canEdit ids (minus owner) + pending editor invites. */
async function countEditorSeats(brandGuidelineId: string): Promise<number> {
  const guideline = await prisma.brandGuideline.findUnique({
    where: { id: brandGuidelineId },
    select: { userId: true, canEdit: true },
  });
  if (!guideline) return 0;

  const editorIds = new Set(
    (Array.isArray(guideline.canEdit) ? (guideline.canEdit as string[]) : []).filter(
      (id) => typeof id === 'string' && id !== guideline.userId
    )
  );

  // Pending, non-expired editor invites hold a seat until accepted or revoked.
  const pendingInvites = await prisma.brandInvite.count({
    where: {
      brandGuidelineId,
      role: 'editor',
      status: 'pending',
      OR: notExpiredOr(),
    },
  });

  return editorIds.size + pendingInvites;
}

/**
 * Seat quota for a user (the brand OWNER). When `brandGuidelineId` is given,
 * `used` reflects that brand; without it, `used` is 0 (policy lookup only).
 * Not exported — external callers go through getSeatQuotaForUserId.
 */
async function getSeatQuota(user: QuotaUserShape, brandGuidelineId?: string): Promise<SeatQuota> {
  const tier = effectiveTier(user);
  const used = brandGuidelineId ? await countEditorSeats(brandGuidelineId) : 0;

  if (user.isAdmin === true) {
    return { used, max: null, tier };
  }

  const fromProduct = await tierLimitFromProduct(tier, 'maxEditorsPerBrand', { allowZero: true });
  // `null` means unlimited — explicit key check, same rationale as maxBrands.
  const max =
    fromProduct !== undefined
      ? fromProduct
      : tier in FALLBACK_MAX_EDITORS
        ? FALLBACK_MAX_EDITORS[tier]
        : FALLBACK_MAX_EDITORS.free;

  return { used, max, tier };
}

/** Load the user and compute the seat quota. */
export async function getSeatQuotaForUserId(
  userId: string,
  brandGuidelineId?: string
): Promise<SeatQuota> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      subscriptionStatus: true,
      subscriptionTier: true,
      isAdmin: true,
      metadata: true,
    },
  });
  if (!user) {
    return {
      used: brandGuidelineId ? await countEditorSeats(brandGuidelineId) : 0,
      max: FALLBACK_MAX_EDITORS.free,
      tier: 'free',
    };
  }
  return getSeatQuota(user, brandGuidelineId);
}

/**
 * Gate for adding ONE editor seat to a brand (editor invite creation or
 * viewer→editor promotion). Viewer operations must never call this.
 */
export async function checkEditorSeat(
  ownerUserId: string,
  brandGuidelineId: string
): Promise<{ allowed: boolean; quota: SeatQuota }> {
  const quota = await getSeatQuotaForUserId(ownerUserId, brandGuidelineId);
  if (!brandBillingEnabled()) return { allowed: true, quota };
  const allowed = quota.max === null || quota.used < quota.max;
  return { allowed, quota };
}

/** Standard 402 payload for the frontend paywall (variant `seat_limit`). */
export function seatLimitPayload(quota: SeatQuota) {
  return {
    error: 'seat_limit',
    reason: 'seat_limit',
    used: quota.used,
    max: quota.max,
    tier: quota.tier,
    upgradeUrl: '/pricing',
  };
}

/**
 * Copilot session sharing gate (plan task 4.6): sharing a session with the
 * team is collaboration — it requires a tier with seats > 0. Free doesn't
 * share. Participants are NOT counted per-seat (keep it simple).
 */
export async function checkCopilotShare(
  userId: string
): Promise<{ allowed: boolean; quota: SeatQuota }> {
  const quota = await getSeatQuotaForUserId(userId);
  if (!brandBillingEnabled()) return { allowed: true, quota };
  const allowed = quota.max === null || quota.max > 0;
  return { allowed, quota };
}

/**
 * Aggregate view for /payments/subscription-status: total editor seats in use
 * across the user's OWNED brands (canEdit minus owner, deduped per brand,
 * plus pending editor invites created by the user) vs the per-brand policy.
 */
export async function getSeatOverview(
  user: QuotaUserShape
): Promise<{ totalEditors: number; maxPerBrand: number | null; tier: string }> {
  const userId = String(user.id ?? user._id ?? '');
  const policy = await getSeatQuota(user); // no brand → policy only

  let totalEditors = 0;
  if (userId) {
    const brands = await prisma.brandGuideline.findMany({
      where: { userId },
      select: { canEdit: true },
    });
    for (const b of brands) {
      const ids = new Set(
        (Array.isArray(b.canEdit) ? (b.canEdit as string[]) : []).filter(
          (id) => typeof id === 'string' && id !== userId
        )
      );
      totalEditors += ids.size;
    }
    totalEditors += await prisma.brandInvite.count({
      where: {
        createdByUserId: userId,
        role: 'editor',
        status: 'pending',
        OR: notExpiredOr(),
      },
    });
  }

  return { totalEditors, maxPerBrand: policy.max, tier: policy.tier };
}

const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days (plan §2.7)

/**
 * Called from the Stripe webhook on subscription updated/deleted. NEVER archives
 * immediately: records a 7-day grace window in user.metadata so the user can
 * choose which brands to keep. The cron job below does the actual archiving
 * after the grace expires.
 */
export async function enforceBrandQuotaOnDowngrade(
  userId: string
): Promise<{ excess: number; graceUntil: string | null }> {
  if (!brandBillingEnabled()) return { excess: 0, graceUntil: null };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      subscriptionStatus: true,
      subscriptionTier: true,
      isAdmin: true,
      metadata: true,
    },
  });
  if (!user) return { excess: 0, graceUntil: null };

  const quota = await getBrandQuota(user);
  const excess = quota.max === null ? 0 : Math.max(0, quota.used - quota.max);
  const meta = { ...((user.metadata as Record<string, any> | null) || {}) };

  if (excess > 0) {
    // Keep an existing grace window (don't restart the clock on repeated
    // webhooks for the SAME excess) — but a NEW downgrade that increases the
    // excess (e.g. another Stripe quantity cut while already in grace) gets a
    // fresh 7-day window on the larger number, so the user isn't shortchanged.
    const priorGrace =
      typeof meta.brandQuotaGraceUntil === 'string' ? meta.brandQuotaGraceUntil : null;
    const storedExcess = Number(meta.brandQuotaExcess);
    const hasLargerExcess = Number.isFinite(storedExcess) && excess > storedExcess;
    const graceUntil =
      priorGrace && !hasLargerExcess
        ? priorGrace
        : new Date(Date.now() + GRACE_PERIOD_MS).toISOString();
    meta.brandQuotaGraceUntil = graceUntil;
    meta.brandQuotaExcess = excess;
    await prisma.user.update({ where: { id: userId }, data: { metadata: meta } });
    console.log('[BrandQuota] Downgrade grace window recorded', { userId, excess, graceUntil });

    // Warn the user ONCE per fresh grace window (not on every repeated webhook).
    // Non-blocking and non-throwing — the in-app banner is the fallback notice.
    //
    // Um envio que falha não pode sumir em silêncio: a janela de 7 dias corre
    // igual, e o usuário perderia acesso de edição sem NUNCA ter sido avisado.
    // Marcamos `brandQuotaNoticePending` e o cron reenvia até passar.
    if (user.email && graceUntil !== priorGrace) {
      let delivered = false;
      try {
        delivered = await sendBrandQuotaDowngradeEmail({
          email: user.email,
          name: user.name ?? undefined,
          atRiskBrands: (await selectExcessBrands(userId, excess)).map((b) => b.name),
          keepCount: quota.max ?? 0,
          graceUntil,
        });
      } catch (err: any) {
        console.error('[BrandQuota] downgrade email failed:', err?.message || err);
      }
      if (!delivered) {
        meta.brandQuotaNoticePending = true;
        await prisma.user.update({ where: { id: userId }, data: { metadata: meta } });
      }
    }

    return { excess, graceUntil };
  }

  // Back within limits — clear any pending grace window.
  if (GRACE_META_KEYS.some((k) => meta[k] !== undefined)) {
    clearGraceMeta(meta);
    await prisma.user.update({ where: { id: userId }, data: { metadata: meta } });
  }
  return { excess: 0, graceUntil: null };
}

/**
 * Tudo que uma janela de grace escreve na metadata do usuário. Some junto, senão
 * um `brandQuotaReminderSentFor` órfão faz o próximo downgrade nascer sem
 * lembrete.
 */
const GRACE_META_KEYS = [
  'brandQuotaGraceUntil',
  'brandQuotaExcess',
  'brandQuotaNoticePending',
  'brandQuotaReminderSentFor',
] as const;

function clearGraceMeta(meta: Record<string, any>): void {
  for (const k of GRACE_META_KEYS) delete meta[k];
}

/** Manda o lembrete quando faltarem 48h ou menos para o prazo. */
const REMINDER_LEAD_MS = 48 * 60 * 60 * 1000;

/**
 * Segunda metade do cron (roda ANTES de archiveExcessBrands): cuida de quem
 * ainda está dentro da janela.
 *
 * Duas coisas que faltavam na jornada:
 * - o aviso inicial que falhou no webhook nunca era reenviado, e a janela corria
 *   igual. Aqui ele é retomado enquanto houver prazo.
 * - entre o dia 0 e o arquivamento havia 7 dias de silêncio. O lembrete de 48h
 *   sai uma vez por janela, marcado por `brandQuotaReminderSentFor` (guarda o
 *   graceUntil, então um downgrade novo ganha lembrete novo).
 */
export async function sendBrandQuotaReminders(
  now: Date = new Date()
): Promise<{ noticesRetried: number; remindersSent: number }> {
  if (!brandBillingEnabled()) return { noticesRetried: 0, remindersSent: 0 };

  await connectToMongoDB();
  const db = getDb();

  const nowIso = now.toISOString();
  const dueUsers = await db
    .collection('users')
    .find(
      {
        'metadata.brandQuotaGraceUntil': { $gt: nowIso },
        $or: [
          { 'metadata.brandQuotaNoticePending': true },
          {
            'metadata.brandQuotaGraceUntil': {
              $gt: nowIso,
              $lte: new Date(now.getTime() + REMINDER_LEAD_MS).toISOString(),
            },
          },
        ],
      },
      { projection: { _id: 1 } }
    )
    .limit(200)
    .toArray();

  let noticesRetried = 0;
  let remindersSent = 0;

  for (const doc of dueUsers) {
    const userId = doc._id.toString();
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, metadata: true },
      });
      if (!user?.email) continue;

      const meta = { ...((user.metadata as Record<string, any> | null) || {}) };
      const graceUntil = meta.brandQuotaGraceUntil as string;

      // Recalcula: o usuário pode ter arquivado à mão ou feito upgrade.
      const quota = await getBrandQuotaForUserId(userId);
      const excess = quota.max === null ? 0 : Math.max(0, quota.used - quota.max);
      if (excess <= 0) {
        clearGraceMeta(meta);
        await prisma.user.update({ where: { id: userId }, data: { metadata: meta } });
        continue;
      }

      const atRiskBrands = (await selectExcessBrands(userId, excess)).map((b) => b.name);
      const common = {
        email: user.email,
        name: user.name ?? undefined,
        atRiskBrands,
        keepCount: quota.max ?? 0,
        graceUntil,
      };

      if (meta.brandQuotaNoticePending === true) {
        if (await sendBrandQuotaDowngradeEmail(common)) {
          delete meta.brandQuotaNoticePending;
          noticesRetried++;
        }
      } else if (
        meta.brandQuotaReminderSentFor !== graceUntil &&
        new Date(graceUntil).getTime() - now.getTime() <= REMINDER_LEAD_MS
      ) {
        if (await sendBrandQuotaReminderEmail(common)) {
          meta.brandQuotaReminderSentFor = graceUntil;
          remindersSent++;
        }
      }

      await prisma.user.update({ where: { id: userId }, data: { metadata: meta } });
    } catch (err: any) {
      console.error('[BrandQuota] reminder pass failed for user', userId, err?.message);
    }
  }

  if (noticesRetried || remindersSent) {
    console.log('[BrandQuota] Reminder pass done', { noticesRetried, remindersSent });
  }
  return { noticesRetried, remindersSent };
}

/**
 * Cron job body (mounted in server/routes/cron.ts): archives the excess brands
 * of users whose grace window expired. Archives the LEAST recently updated
 * first. Never deletes anything.
 */
const ARCHIVE_BATCH = 200;

export async function archiveExcessBrands(
  now: Date = new Date()
): Promise<{ usersProcessed: number; brandsArchived: number; usersRemaining: number }> {
  if (!brandBillingEnabled()) return { usersProcessed: 0, brandsArchived: 0, usersRemaining: 0 };

  await connectToMongoDB();
  const db = getDb();

  // ISO strings compare lexicographically — $lte works for both Date and ISO string values.
  const overdue = { 'metadata.brandQuotaGraceUntil': { $lte: now.toISOString() } };
  const dueUsers = await db
    .collection('users')
    .find(overdue, { projection: { _id: 1 } })
    .limit(ARCHIVE_BATCH)
    .toArray();
  // Quantos ficaram para a próxima execução. Sem isso, uma fila maior que o lote
  // se parece com "acabou o trabalho" no log e ninguém percebe o atraso.
  const usersRemaining =
    dueUsers.length < ARCHIVE_BATCH
      ? 0
      : Math.max(0, (await db.collection('users').countDocuments(overdue)) - dueUsers.length);

  let usersProcessed = 0;
  let brandsArchived = 0;

  for (const doc of dueUsers) {
    const userId = doc._id.toString();
    try {
      // Recompute at execution time — the user may have upgraded or archived
      // manually during the grace window.
      const quota = await getBrandQuotaForUserId(userId);
      const excess = quota.max === null ? 0 : Math.max(0, quota.used - quota.max);

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, name: true, metadata: true },
      });
      const meta = { ...((user?.metadata as Record<string, any> | null) || {}) };

      let victims: AtRiskBrand[] = [];
      if (excess > 0) {
        victims = await selectExcessBrands(userId, excess);
        if (victims.length > 0) {
          await prisma.brandGuideline.updateMany({
            where: { id: { in: victims.map((v) => v.id) } },
            data: { status: 'archived', archivedAt: now },
          });
          brandsArchived += victims.length;
          // Quem foi arquivado POR BILLING, para separar de quem o usuário
          // arquivou à mão — é o que um upgrade precisa saber para devolver.
          meta.brandQuotaArchived = {
            at: now.toISOString(),
            ids: victims.map((v) => v.id),
          };
        }
      }

      // Grace consumed either way — clear the flags.
      clearGraceMeta(meta);
      await prisma.user.update({ where: { id: userId }, data: { metadata: meta } });
      usersProcessed++;

      // O arquivamento era silencioso: o usuário descobria sozinho que perdeu
      // acesso de edição. Best-effort, nunca derruba o cron.
      if (user?.email && victims.length > 0) {
        await sendBrandQuotaArchivedEmail({
          email: user.email,
          name: user.name ?? undefined,
          archivedBrands: victims.map((v) => v.name),
          keepCount: quota.max ?? 0,
        }).catch((err: any) =>
          console.error('[BrandQuota] archived notice failed:', err?.message || err)
        );
      }
    } catch (err: any) {
      console.error('[BrandQuota] archiveExcessBrands failed for user', userId, err?.message);
    }
  }

  if (usersProcessed > 0) {
    console.log('[BrandQuota] Grace enforcement done', {
      usersProcessed,
      brandsArchived,
      usersRemaining,
    });
  }
  return { usersProcessed, brandsArchived, usersRemaining };
}
