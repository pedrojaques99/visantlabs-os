import { beforeAll, afterAll, afterEach } from 'vitest';
import { startTestMongo, stopTestMongo, resetDb } from './helpers/db.js';

/**
 * Integration-only lifecycle. Runs after the base tests/setup.ts.
 *
 * - Boots an in-memory Mongo replica set before ANY module evaluation
 * - Truncates collections between tests (fast, no re-migration)
 * - Tears down the replica set once the suite ends
 */
await startTestMongo();

beforeAll(async () => {
  // Prisma lazy-connects on first query — nothing else to do here.
}, 60_000);

afterEach(async () => {
  await resetDb();
});

afterAll(async () => {
  const { prisma } = await import('../server/db/prisma.js');
  await prisma.$disconnect().catch(() => {});
  await stopTestMongo();
});
