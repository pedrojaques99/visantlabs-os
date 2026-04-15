import { MongoMemoryReplSet } from 'mongodb-memory-server';

/**
 * In-memory MongoDB replica set.
 *
 * Prisma with the `mongodb` provider requires a replica set (for transactions),
 * so we spin up a single-node RS rather than a standalone instance.
 *
 * Lifecycle is managed by tests/setup.integration.ts — do not call start()
 * directly from individual tests.
 */
let mongoServer: MongoMemoryReplSet | null = null;

export async function startTestMongo(): Promise<string> {
  if (mongoServer) return mongoServer.getUri();
  mongoServer = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });
  const uri = mongoServer.getUri();
  process.env.MONGODB_URI = uri;
  process.env.DATABASE_URL = uri;
  return uri;
}

export async function stopTestMongo(): Promise<void> {
  if (!mongoServer) return;
  await mongoServer.stop();
  mongoServer = null;
}

/**
 * Truncate every collection between tests.
 *
 * Faster than tearing down the replica set. Safe because test collections
 * are created lazily by Prisma.
 */
export async function resetDb(): Promise<void> {
  const { prisma } = await import('../../server/db/prisma.js');
  const collections = (await (prisma as any).$runCommandRaw({ listCollections: 1, nameOnly: true })) as {
    cursor?: { firstBatch?: Array<{ name: string }> };
  };
  const names = collections.cursor?.firstBatch?.map((c) => c.name) ?? [];
  for (const name of names) {
    if (name.startsWith('system.')) continue;
    await (prisma as any).$runCommandRaw({ delete: name, deletes: [{ q: {}, limit: 0 }] });
  }
}
