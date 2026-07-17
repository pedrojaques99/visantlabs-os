/**
 * Reference upload quota — the abuse ceiling that replaces per-image credits.
 *
 * Ingest no longer costs credits: a reference is INPUT to generation, and
 * charging to feed the library taxes the very behaviour that makes the product
 * better. So the guard against "upload 10k images to burn free enrichment" is a
 * hard per-user cap on OWNED (non-admin-curated) references, not a toll.
 *
 * Deliberately simple: one env-tunable ceiling, no tier table. Admins are
 * exempt (their content is curated, not user-owned). If this ever needs to vary
 * by plan, it plugs into the same shape as server/lib/brandQuota.ts —
 * FALLBACK_MAX_* by tier gated on FEATURE_BRAND_BILLING — but that's a
 * monetization decision, not an abuse guard, so it's not invented here.
 */

import type { Db } from 'mongodb';

/** Hard ceiling on a single user's own uploaded references. Env-tunable. */
export const referenceUploadLimit = (): number =>
  parseInt(process.env.MAX_USER_REFERENCES || '500', 10);

/** How many references this user already owns (their uploads, not curated ones). */
export async function countUserReferences(db: Db, userId: string): Promise<number> {
  return db
    .collection('community_presets')
    .countDocuments({ category: 'reference', userId: String(userId), isAdminCurated: false });
}

/** 402-style payload, mirroring brandLimitPayload so the frontend paywall is uniform. */
export function referenceLimitPayload(used: number, max: number) {
  return {
    error: 'reference_limit',
    reason: 'reference_limit',
    used,
    max,
    upgradeUrl: '/pricing',
  };
}
