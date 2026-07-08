import type { Db } from 'mongodb';

let ensured = false;

/**
 * Single source of truth for hot-path indexes on collections that are written
 * from many scattered call sites (so no single writer owns their setup) and
 * read heavily by dashboards / user-scoped lists.
 *
 * Idempotent (once per process), fire-and-forget, and never throws —
 * `createIndex` is a no-op when the index already exists. Called at server
 * startup and lazily by the heaviest readers, so it runs regardless of the
 * entry path (long-running server, serverless, or tests).
 */
export async function ensureCoreIndexes(db: Db): Promise<void> {
  if (ensured) return;
  ensured = true;

  const jobs: Promise<unknown>[] = [
    // AI generation usage — per-user cost, global stats, and time series.
    db.collection('usage_records').createIndex({ userId: 1 }, { background: true }),
    db.collection('usage_records').createIndex({ timestamp: 1 }, { background: true }),
    db.collection('usage_records').createIndex({ userId: 1, type: 1 }, { background: true }),

    // RAG feedback dashboard — ~10 aggregations filtering createdAt + feature/rating.
    db.collection('generation_feedback').createIndex({ createdAt: -1 }, { background: true }),
    db
      .collection('generation_feedback')
      .createIndex({ feature: 1, rating: 1, createdAt: -1 }, { background: true }),

    // Payment history list + admin per-user grouping.
    db.collection('transactions').createIndex({ userId: 1, createdAt: -1 }, { background: true }),

    // Chat session lists (user + admin).
    db.collection('chat_sessions').createIndex({ userId: 1, updatedAt: -1 }, { background: true }),
    db
      .collection('admin_chat_sessions')
      .createIndex({ ownerId: 1, updatedAt: -1 }, { background: true }),
    db
      .collection('admin_chat_sessions')
      .createIndex({ sharedWithUserIds: 1, updatedAt: -1 }, { background: true }),

    // Moodboard project list.
    db
      .collection('moodboard_projects')
      .createIndex({ userId: 1, updatedAt: -1 }, { background: true }),

    // Pending payments lookup by email.
    db
      .collection('pending_payments')
      .createIndex({ customerEmail: 1, timestamp: -1 }, { background: true }),
  ];

  await Promise.allSettled(jobs);
}
