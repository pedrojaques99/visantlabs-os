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

/** "Active" filter that also matches legacy docs created before the status field existed. */
export const ACTIVE_BRAND_WHERE = { NOT: { status: 'archived' } } as const;

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
