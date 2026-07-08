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

export interface BrandQuota {
  /** Active (non-archived) brands OWNED by the user. Shared brands count on the owner. */
  used: number;
  /** Effective limit. `null` = unlimited (admin, or agency without a Stripe quantity cap). */
  max: number | null;
  /** Effective tier used for the limit ('free' when the subscription isn't active). */
  tier: string;
}

/**
 * Hardcoded fallbacks, same pattern as payments.ts monthlyCredits fallbacks.
 * Product.metadata.maxBrands (admin-managed) overrides these when present.
 * Agency is unlimited by default — the Stripe subscription `quantity`
 * (user.metadata.agencyBrandQuantity) is what caps it.
 */
const FALLBACK_MAX_BRANDS: Record<string, number | null> = {
  free: 1,
  premium: 3,
  pro: 10,
  agency: null,
};

export function brandBillingEnabled(): boolean {
  return process.env.FEATURE_BRAND_BILLING === 'true';
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

async function tierMaxBrandsFromProduct(tier: string): Promise<number | null | undefined> {
  try {
    const products = await prisma.product.findMany({
      where: { type: 'subscription_plan', isActive: true },
    });
    // Match manually to avoid JSON filtering issues on MongoDB (payments.ts pattern).
    const product = products.find(
      (p) => (p.metadata as any)?.tier === tier || p.productId.includes(tier)
    );
    const raw = (product?.metadata as Record<string, any> | null)?.maxBrands;
    if (raw === undefined || raw === null) return undefined;
    if (raw === 'unlimited' || raw === -1 || raw === '-1') return null;
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) && n > 0 ? n : undefined;
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

  const status = user.subscriptionStatus || 'free';
  const rawTier = user.subscriptionTier || 'free';
  const tier = status === 'active' && rawTier !== 'free' ? rawTier : 'free';

  if (user.isAdmin === true) {
    return { used, max: null, tier };
  }

  const meta = (user.metadata as Record<string, any> | null) || {};

  let max: number | null;
  const fromProduct = await tierMaxBrandsFromProduct(tier);
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

  return { used, max, tier };
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
 */
const FALLBACK_MAX_EDITORS: Record<string, number | null> = {
  free: 0,
  premium: 1,
  pro: 3,
  agency: null,
};

async function tierMaxEditorsFromProduct(tier: string): Promise<number | null | undefined> {
  try {
    const products = await prisma.product.findMany({
      where: { type: 'subscription_plan', isActive: true },
    });
    const product = products.find(
      (p) => (p.metadata as any)?.tier === tier || p.productId.includes(tier)
    );
    const raw = (product?.metadata as Record<string, any> | null)?.maxEditorsPerBrand;
    if (raw === undefined || raw === null) return undefined;
    if (raw === 'unlimited' || raw === -1 || raw === '-1') return null;
    const n = parseInt(String(raw), 10);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  } catch {
    return undefined; // DB hiccup → hardcoded fallback
  }
}

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
 */
export async function getSeatQuota(
  user: QuotaUserShape,
  brandGuidelineId?: string
): Promise<SeatQuota> {
  const tier = effectiveTier(user);
  const used = brandGuidelineId ? await countEditorSeats(brandGuidelineId) : 0;

  if (user.isAdmin === true) {
    return { used, max: null, tier };
  }

  const fromProduct = await tierMaxEditorsFromProduct(tier);
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
): Promise<{ used: number; maxPerBrand: number | null; tier: string }> {
  const userId = String(user.id ?? user._id ?? '');
  const policy = await getSeatQuota(user); // no brand → policy only

  let used = 0;
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
      used += ids.size;
    }
    used += await prisma.brandInvite.count({
      where: {
        createdByUserId: userId,
        role: 'editor',
        status: 'pending',
        OR: notExpiredOr(),
      },
    });
  }

  return { used, maxPerBrand: policy.max, tier: policy.tier };
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
    // Keep an existing grace window (don't restart the clock on repeated webhooks).
    const graceUntil =
      typeof meta.brandQuotaGraceUntil === 'string' && meta.brandQuotaGraceUntil
        ? meta.brandQuotaGraceUntil
        : new Date(Date.now() + GRACE_PERIOD_MS).toISOString();
    meta.brandQuotaGraceUntil = graceUntil;
    meta.brandQuotaExcess = excess;
    await prisma.user.update({ where: { id: userId }, data: { metadata: meta } });
    // TODO(email): reuse server/services/emailService.ts with a dedicated
    // "brand quota downgrade" template — list the brands at risk and link to
    // /brand-guidelines so the user picks which ones to archive before the deadline.
    console.log('[BrandQuota] Downgrade grace window recorded', { userId, excess, graceUntil });
    return { excess, graceUntil };
  }

  // Back within limits — clear any pending grace window.
  if (meta.brandQuotaGraceUntil !== undefined || meta.brandQuotaExcess !== undefined) {
    delete meta.brandQuotaGraceUntil;
    delete meta.brandQuotaExcess;
    await prisma.user.update({ where: { id: userId }, data: { metadata: meta } });
  }
  return { excess: 0, graceUntil: null };
}

/**
 * Cron job body (mounted in server/routes/cron.ts): archives the excess brands
 * of users whose grace window expired. Archives the LEAST recently updated
 * first. Never deletes anything.
 */
export async function archiveExcessBrands(
  now: Date = new Date()
): Promise<{ usersProcessed: number; brandsArchived: number }> {
  if (!brandBillingEnabled()) return { usersProcessed: 0, brandsArchived: 0 };

  await connectToMongoDB();
  const db = getDb();

  // ISO strings compare lexicographically — $lte works for both Date and ISO string values.
  const dueUsers = await db
    .collection('users')
    .find(
      { 'metadata.brandQuotaGraceUntil': { $lte: now.toISOString() } },
      { projection: { _id: 1 } }
    )
    .limit(200)
    .toArray();

  let usersProcessed = 0;
  let brandsArchived = 0;

  for (const doc of dueUsers) {
    const userId = doc._id.toString();
    try {
      // Recompute at execution time — the user may have upgraded or archived
      // manually during the grace window.
      const quota = await getBrandQuotaForUserId(userId);
      const excess = quota.max === null ? 0 : Math.max(0, quota.used - quota.max);

      if (excess > 0) {
        const victims = await prisma.brandGuideline.findMany({
          where: { userId, ...ACTIVE_BRAND_WHERE },
          orderBy: { updatedAt: 'asc' },
          take: excess,
          select: { id: true },
        });
        if (victims.length > 0) {
          await prisma.brandGuideline.updateMany({
            where: { id: { in: victims.map((v) => v.id) } },
            data: { status: 'archived', archivedAt: now },
          });
          brandsArchived += victims.length;
        }
      }

      // Grace consumed either way — clear the flags.
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { metadata: true },
      });
      const meta = { ...((user?.metadata as Record<string, any> | null) || {}) };
      delete meta.brandQuotaGraceUntil;
      delete meta.brandQuotaExcess;
      await prisma.user.update({ where: { id: userId }, data: { metadata: meta } });
      usersProcessed++;
    } catch (err: any) {
      console.error('[BrandQuota] archiveExcessBrands failed for user', userId, err?.message);
    }
  }

  if (usersProcessed > 0) {
    console.log('[BrandQuota] Grace enforcement done', { usersProcessed, brandsArchived });
  }
  return { usersProcessed, brandsArchived };
}
