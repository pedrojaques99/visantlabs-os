/**
 * Funnel analytics events (§3.3 do Revenue-Centric Realignment).
 *
 * REUSES the existing `canvas_events` Mongo collection (same indexes, same
 * 90-day TTL, same admin aggregation surface) — no new analytics system.
 * Events here are the onboarding/activation funnel:
 *
 *   onboarding_step  { step, persona, skipped }
 *   brand_ingested   { source, duringOnboarding }
 *
 * Generation on-brand metrics ride the existing usage_records instead
 * (see usageTracking.createUsageRecord → onBrand/surface).
 */

import { connectToMongoDB, getDb } from '../db/mongodb.js';

export const FUNNEL_EVENTS = ['onboarding_step', 'brand_ingested'] as const;
export type FunnelEvent = (typeof FUNNEL_EVENTS)[number];

export function isFunnelEvent(event: unknown): event is FunnelEvent {
  return typeof event === 'string' && (FUNNEL_EVENTS as readonly string[]).includes(event);
}

/**
 * Best-effort insert — analytics must NEVER break a product flow. Callers can
 * `void trackFunnelEvent(...)` without awaiting.
 */
export async function trackFunnelEvent(
  event: FunnelEvent,
  userId: string | undefined,
  meta?: Record<string, unknown>
): Promise<void> {
  try {
    await connectToMongoDB();
    const db = getDb();
    await db.collection('canvas_events').insertOne({
      event,
      userId,
      meta: meta && typeof meta === 'object' ? meta : undefined,
      serverTs: new Date(),
    });
  } catch (err: any) {
    console.warn(`[FunnelEvents] Failed to record ${event}:`, err?.message);
  }
}
