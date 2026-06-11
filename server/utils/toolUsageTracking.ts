/**
 * Fire-and-forget usage tracking + webhook dispatch for the 3D Studio and
 * ImageLab tools (Phase 5.2 — metering + observability).
 *
 * These tools are currently free (no credit charge) or charge separately; this
 * module only records an audit/usage trail so the `/developer/usage` dashboard
 * and webhook subscribers can see activity. It mirrors the pattern in
 * `server/routes/mockups.ts` (insert into the `usage_records` collection +
 * `dispatchWebhookEvent`), but is intentionally non-throwing: a tracking
 * failure must NEVER break the underlying route, so every call is best-effort
 * and swallows its own errors.
 */
import { connectToMongoDB, getDb } from '../db/mongodb.js';
import { dispatchWebhookEvent } from './webhookDispatch.js';

export interface ToolUsageInput {
  userId: string;
  /** Dotted action name, e.g. `studio3d.export`, `imagelab.inpaint`. */
  action: string;
  /** Credits charged for this action (0 for free-but-tracked operations). */
  creditsDeducted?: number;
  /** Optional id of a persisted resource (scene id, etc.). */
  resourceId?: string;
  /** Free-form extra metadata (mode, shaderType, format, …). */
  meta?: Record<string, unknown>;
  /** When true, also emit a `generation.complete` webhook event. */
  emitWebhook?: boolean;
}

/**
 * Record a tool usage event. Fire-and-forget: callers should NOT await the
 * result on the request hot path — call it and move on. Any error (db down,
 * webhook failure) is logged and contained here.
 */
export function recordToolUsage(input: ToolUsageInput): void {
  void (async () => {
    try {
      await connectToMongoDB();
      const db = getDb();
      await db.collection('usage_records').insertOne({
        userId: input.userId,
        type: input.action,
        feature: input.action.split('.')[0], // 'studio3d' | 'imagelab'
        action: input.action,
        creditsDeducted: input.creditsDeducted ?? 0,
        imagesGenerated: 0,
        cost: 0,
        resourceId: input.resourceId ?? null,
        meta: input.meta ?? {},
        timestamp: new Date(),
        createdAt: new Date(),
      });
    } catch (err) {
      console.error(`[usage] failed to record ${input.action}:`, err);
    }

    if (input.emitWebhook) {
      try {
        await dispatchWebhookEvent(input.userId, 'generation.complete', {
          type: input.action,
          id: input.resourceId ?? null,
          ...input.meta,
        });
      } catch (err) {
        console.error(`[usage] webhook dispatch failed for ${input.action}:`, err);
      }
    }
  })();
}
