import { describe, it, expect } from 'vitest';
import { createUser } from '../../factories/user.js';

/**
 * Prisma repository contract tests.
 *
 * These hit the in-memory Mongo replica set started by setup.integration.ts.
 * Goal: confirm model constraints + indexes behave as the schema promises.
 */
describe('User repository', () => {
  it('enforces unique email', async () => {
    const { user } = await createUser();
    await expect(createUser({ email: user.email })).rejects.toThrow();
  });

  it('stores default credit fields', async () => {
    const { user } = await createUser();
    expect(user.monthlyCredits).toBeGreaterThanOrEqual(0);
    expect(user.creditsUsed).toBeGreaterThanOrEqual(0);
    expect(user.subscriptionTier).toBeDefined();
  });

  it('findUnique by id returns the created user', async () => {
    const { prisma } = await import('../../../server/db/prisma.js');
    const { user } = await createUser();
    const found = await prisma.user.findUnique({ where: { id: user.id } });
    expect(found?.email).toBe(user.email);
  });

  it('soft delete semantics: actual delete removes the row', async () => {
    const { prisma } = await import('../../../server/db/prisma.js');
    const { user } = await createUser();
    await prisma.user.delete({ where: { id: user.id } });
    const after = await prisma.user.findUnique({ where: { id: user.id } });
    expect(after).toBeNull();
  });
});
