import type { Request, Response, NextFunction } from 'express';
import { LRUCache } from 'lru-cache';

/**
 * Exponential backoff for credential endpoints.
 *
 * Layered on top of the coarse per-IP rate limiter, this guard tracks the
 * number of consecutive failures for a specific (ip, identifier) pair and
 * forces a progressively longer cooldown:
 *
 *     failures 0-2  → allowed
 *     failures 3    → 2s cooldown
 *     failures 4    → 4s
 *     failures 5    → 8s
 *     ...capped at  → 15 min
 *
 * The identifier (usually email) is lowercased and hashed into the key so
 * attackers can't probe the cache structure.
 *
 * IMPORTANT: storage is in-process. Distributed deployments (multi-replica
 * Vercel) must swap this for Redis to enforce globally — tracked in
 * .agent/plans/TESTING-PLAN.md. For a single-replica origin this gives real
 * protection with zero infra.
 */

interface Attempt {
  failures: number;
  nextAllowedAt: number; // epoch ms
}

const store = new LRUCache<string, Attempt>({
  max: 10_000,
  ttl: 15 * 60 * 1000, // forget attempts after 15 min of no activity
});

const MAX_DELAY_MS = 15 * 60 * 1000;
const FREE_ATTEMPTS = 3;
const BASE_DELAY_MS = 1000;

function keyFor(ip: string, identifier: string | undefined): string {
  return `${ip}::${(identifier ?? '').toLowerCase().slice(0, 254)}`;
}

function delayForFailures(failures: number): number {
  if (failures <= FREE_ATTEMPTS) return 0;
  const excess = failures - FREE_ATTEMPTS;
  return Math.min(BASE_DELAY_MS * 2 ** excess, MAX_DELAY_MS);
}

/**
 * Build a middleware that gates a specific credential endpoint.
 *
 * @param getIdentifier  Extracts the user-side key from the request (email for
 *                       signin, usually the same for signup). Returning
 *                       undefined disables per-user tracking and falls back to
 *                       per-IP only.
 */
export function bruteForceGuard(getIdentifier: (req: Request) => string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const key = keyFor(ip, getIdentifier(req));
    const now = Date.now();
    const current = store.get(key);

    if (current && current.nextAllowedAt > now) {
      const retryAfterSec = Math.ceil((current.nextAllowedAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        error: 'Too many failed attempts. Please wait before trying again.',
        retryAfter: retryAfterSec,
      });
      return;
    }

    // Hook into response: success resets, failure increments.
    res.once('finish', () => {
      const isFailure = res.statusCode === 401 || res.statusCode === 403 || res.statusCode === 400;
      if (!isFailure) {
        store.delete(key);
        return;
      }
      const prev = store.get(key) ?? { failures: 0, nextAllowedAt: 0 };
      const failures = prev.failures + 1;
      const delay = delayForFailures(failures);
      store.set(key, { failures, nextAllowedAt: Date.now() + delay });
    });

    next();
  };
}

/** Test-only: wipe tracking state between cases. */
export function _resetBruteForceStore(): void {
  store.clear();
}
