import { describe, it, expect } from 'vitest';
import { request } from '../helpers/app.js';
import { createUser, createAdmin } from '../factories/user.js';
import { signTestToken, bearer } from '../helpers/auth.js';

/**
 * GET /api/admin/analytics — product analytics aggregates.
 *
 * Data-bearing tests always pass refresh=1 so a locally running Redis
 * can never leak a cached payload from a previous test.
 */

async function adminToken() {
  const { user } = await createAdmin();
  return signTestToken({ userId: user.id, email: user.email });
}

describe('GET /api/admin/analytics — auth', () => {
  it('returns 401 without a token', async () => {
    const agent = await request();
    const res = await agent.get('/api/admin/analytics');
    expect(res.status).toBe(401);
  });

  it('returns 403 for a non-admin user', async () => {
    const { user } = await createUser();
    const token = signTestToken({ userId: user.id, email: user.email });
    const agent = await request();
    const res = await agent.get('/api/admin/analytics').set('Authorization', bearer(token));
    expect(res.status).toBe(403);
  });
});

describe('GET /api/admin/analytics — payload shape', () => {
  it('returns all sections with an empty database', async () => {
    const token = await adminToken();
    const agent = await request();
    const res = await agent
      .get('/api/admin/analytics?days=30&refresh=1')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.days).toBe(30);
    expect(res.body.features.mockups).toMatchObject({
      total: 0,
      distinctUsers: 0,
      byDay: [],
    });
    for (const key of [
      'brandings',
      'guidelines',
      'campaigns',
      'creativeProjects',
      'canvasProjects',
      'budgets',
      'mockups',
    ]) {
      expect(res.body.features[key]).toBeDefined();
    }
    expect(res.body.mcp).toMatchObject({ totalEnabled: 0, activeCallers: 0 });
    expect(res.body.funnel.steps).toHaveLength(4);
    expect(res.body.funnel.steps.map((s: any) => s.key)).toEqual([
      'signedUp',
      'createdBrand',
      'firstGeneration',
      'paying',
    ]);
    expect(res.body.retention).toMatchObject({ dau: 0, wau: 0, mau: 0 });
    expect(res.body.naming).toMatchObject({
      batches: 0,
      namesGenerated: 0,
      tokensSpent: 0,
      uniqueUsers: 0,
      swipes: { nope: 0, like: 0, superlike: 0 },
      likeRate: 0,
      byModel: [],
    });
  });
});

describe('GET /api/admin/analytics — naming section', () => {
  it('aggregates naming_events batches, tokens, swipes and byModel', async () => {
    const { connectToMongoDB, getDb } = await import('../../server/db/mongodb.js');

    const { user: admin } = await createAdmin();
    const token = signTestToken({ userId: admin.id, email: admin.email });
    const { user: userA } = await createUser();
    const { user: userB } = await createUser();

    await connectToMongoDB();
    const db = getDb();
    const now = new Date();
    await db.collection('naming_events').insertMany([
      {
        type: 'generate',
        userId: userA.id,
        model: 'gemini-3-flash-preview',
        requested: 10,
        returned: 8,
        tokens: 500,
        ruler: 'strict',
        createdAt: now,
      },
      {
        type: 'generate',
        userId: userB.id,
        model: 'gemini-3-flash-preview',
        requested: 10,
        returned: 6,
        tokens: 300,
        ruler: 'balanced',
        createdAt: now,
      },
      {
        type: 'generate',
        userId: userA.id,
        model: 'gemini-3.5-flash',
        requested: 5,
        returned: 5,
        tokens: 200,
        ruler: 'strict',
        createdAt: now,
      },
      { type: 'swipe', userId: userA.id, verdict: 'like', createdAt: now },
      { type: 'swipe', userId: userA.id, verdict: 'like', createdAt: now },
      { type: 'swipe', userId: userA.id, verdict: 'superlike', createdAt: now },
      { type: 'swipe', userId: userA.id, verdict: 'nope', createdAt: now },
    ]);

    const agent = await request();
    const res = await agent
      .get('/api/admin/analytics?days=30&refresh=1')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.naming.batches).toBe(3);
    expect(res.body.naming.namesGenerated).toBe(19);
    expect(res.body.naming.tokensSpent).toBe(1000);
    expect(res.body.naming.uniqueUsers).toBe(2);
    expect(res.body.naming.swipes).toEqual({ nope: 1, like: 2, superlike: 1 });
    expect(res.body.naming.likeRate).toBeCloseTo(0.75, 2);
    expect(res.body.naming.byModel).toEqual(
      expect.arrayContaining([
        { model: 'gemini-3-flash-preview', batches: 2, tokens: 800 },
        { model: 'gemini-3.5-flash', batches: 1, tokens: 200 },
      ])
    );
  });

  it('excludes naming_events outside the days window', async () => {
    const { connectToMongoDB, getDb } = await import('../../server/db/mongodb.js');
    const { user: admin } = await createAdmin();
    const token = signTestToken({ userId: admin.id, email: admin.email });
    const { user: userA } = await createUser();

    await connectToMongoDB();
    const db = getDb();
    const old = new Date(Date.now() - 60 * 24 * 3_600_000); // 60 days ago
    await db.collection('naming_events').insertOne({
      type: 'generate',
      userId: userA.id,
      model: 'gemini-3-flash-preview',
      requested: 10,
      returned: 10,
      tokens: 999,
      ruler: 'strict',
      createdAt: old,
    });

    const agent = await request();
    const res = await agent
      .get('/api/admin/analytics?days=30&refresh=1')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.naming.batches).toBe(0);
    expect(res.body.naming.tokensSpent).toBe(0);
  });
});

describe('GET /api/admin/analytics — funnel math', () => {
  it('computes step counts, pctOfPrev and median hours from seeded milestones', async () => {
    const { prisma } = await import('../../server/db/prisma.js');
    const { connectToMongoDB, getDb } = await import('../../server/db/mongodb.js');

    const { user: admin } = await createAdmin();
    const token = signTestToken({ userId: admin.id, email: admin.email });

    const { user: userA } = await createUser();
    const { user: userB } = await createUser();
    await createUser(); // user C: signup only

    const now = Date.now();
    // A: brand 2h after signup, generation 4h after, payment 10h after
    await prisma.brandingProject.create({
      data: {
        userId: userA.id,
        prompt: 'brand A',
        data: {},
        createdAt: new Date(now + 2 * 3_600_000),
      },
    });
    await prisma.transaction.create({
      data: {
        userId: userA.id,
        status: 'completed',
        amount: 5000,
        createdAt: new Date(now + 10 * 3_600_000),
      },
    });
    // B: brand 6h after signup, nothing else
    await prisma.brandingProject.create({
      data: {
        userId: userB.id,
        prompt: 'brand B',
        data: {},
        createdAt: new Date(now + 6 * 3_600_000),
      },
    });

    await connectToMongoDB();
    const db = getDb();
    // usage_records stores userId as a STRING (unlike Prisma collections)
    await db.collection('usage_records').insertOne({
      userId: userA.id,
      type: 'image',
      feature: 'mockupmachine',
      imagesGenerated: 1,
      timestamp: new Date(now + 4 * 3_600_000),
    });

    const agent = await request();
    const res = await agent
      .get('/api/admin/analytics?days=30&refresh=1')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    const steps = res.body.funnel.steps;
    // Cohort = admin + A + B + C = 4
    expect(steps[0]).toMatchObject({ key: 'signedUp', count: 4, pctOfPrev: 100 });
    expect(steps[1]).toMatchObject({ key: 'createdBrand', count: 2, pctOfPrev: 50 });
    expect(steps[2]).toMatchObject({ key: 'firstGeneration', count: 1, pctOfPrev: 50 });
    expect(steps[3]).toMatchObject({ key: 'paying', count: 1, pctOfPrev: 100 });
    // Median hours: brand = median(2, 6) = 4; generation = 4; payment = 10
    expect(steps[1].medianHoursToStep).toBeCloseTo(4, 0);
    expect(steps[2].medianHoursToStep).toBeCloseTo(4, 0);
    expect(steps[3].medianHoursToStep).toBeCloseTo(10, 0);

    // Feature adoption picked up the two branding projects
    expect(res.body.features.brandings).toMatchObject({ total: 2, distinctUsers: 2 });
  });
});

describe('GET /api/admin/analytics — MCP adoption', () => {
  it('counts the union of api-key, oauth and active-caller users', async () => {
    const { prisma } = await import('../../server/db/prisma.js');
    const { connectToMongoDB, getDb } = await import('../../server/db/mongodb.js');

    const { user: admin } = await createAdmin();
    const token = signTestToken({ userId: admin.id, email: admin.email });

    const { user: keyUser } = await createUser();
    const { user: oauthUser } = await createUser();
    const { user: callerUser } = await createUser();

    await prisma.apiKey.create({
      data: {
        userId: keyUser.id,
        keyHash: `hash-${keyUser.id}`,
        keyPrefix: 'visant_sk_test',
        name: 'Test key',
        scopes: ['read'],
        active: true,
      },
    });
    await prisma.oAuthClient.create({
      data: {
        clientId: 'client-test',
        clientName: 'Claude Test',
        redirectUris: ['http://localhost/cb'],
        grantTypes: ['authorization_code'],
      },
    });
    await prisma.oAuthRefreshToken.create({
      data: {
        token: `rt-${oauthUser.id}`,
        userId: oauthUser.id,
        clientId: 'client-test',
        scopes: ['read'],
        expiresAt: new Date(Date.now() + 24 * 3_600_000),
      },
    });
    await connectToMongoDB();
    const db = getDb();
    await db.collection('mcp_tool_calls').insertOne({
      toolName: 'mockup-list',
      userId: callerUser.id, // string, matching mcp-tracking.ts
      scope: 'read',
      durationMs: 12,
      success: true,
      createdAt: new Date(),
    });

    const agent = await request();
    const res = await agent
      .get('/api/admin/analytics?days=30&refresh=1')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.mcp).toMatchObject({
      activeApiKeyUsers: 1,
      oauthUsers: 1,
      activeCallers: 1,
      totalEnabled: 3,
      enabledAndActive: 0,
    });
    expect(res.body.mcp.byClient).toEqual([{ clientName: 'Claude Test', users: 1 }]);
    // Retention picks up the usage-free environment: mcp calls don't count as usage
    expect(res.body.retention.mau).toBe(0);
  });

  it('excludes expired refresh tokens from the enabled set', async () => {
    const { prisma } = await import('../../server/db/prisma.js');
    const { user: admin } = await createAdmin();
    const token = signTestToken({ userId: admin.id, email: admin.email });
    const { user: expiredUser } = await createUser();

    await prisma.oAuthRefreshToken.create({
      data: {
        token: `rt-expired-${expiredUser.id}`,
        userId: expiredUser.id,
        clientId: 'client-gone',
        scopes: ['read'],
        expiresAt: new Date(Date.now() - 3_600_000), // already expired
      },
    });

    const agent = await request();
    const res = await agent
      .get('/api/admin/analytics?days=30&refresh=1')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.mcp.oauthUsers).toBe(0);
    expect(res.body.mcp.totalEnabled).toBe(0);
  });
});
