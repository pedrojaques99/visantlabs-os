/**
 * Shared feature-flag resolution (rollout pattern used by FEATURE_COPILOT /
 * FEATURE_BRAND_BILLING and future flags).
 *
 * Semantics (must match the frontend's flag reading — see src/ equivalent):
 * - An explicit env value ('true' | 'false') always wins.
 * - Unset → ON outside production (dev/test convenience, feature visible by
 *   default while building it) and OFF in production (safe default — a
 *   billing/behavior-changing flag must never silently turn on in prod).
 */
export function flagEnabled(name: string): boolean {
  const raw = process.env[name];
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return process.env.NODE_ENV !== 'production';
}
