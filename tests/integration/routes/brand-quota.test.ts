import { describe, it, expect } from 'vitest';
import express from 'express';
import supertest from 'supertest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { createBrandGuideline } from '../../factories/brandGuideline.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

// Must be set BEFORE the app/lib is used — enforcement is behind the flag.
process.env.FEATURE_BRAND_BILLING = 'true';

function tokenFor(user: { id: string; email: string }) {
  return bearer(signTestToken({ userId: user.id, email: user.email }));
}

async function setUserFields(userId: string, fields: Record<string, any>) {
  const { prisma } = await import('../../../server/db/prisma.js');
  await prisma.user.update({ where: { id: userId }, data: fields });
  // Mirror into Mongo — subscription/quota code reads the raw collection too.
  const { connectToMongoDB, getDb } = await import('../../../server/db/mongodb.js');
  const { ObjectId } = await import('mongodb');
  await connectToMongoDB();
  const db = getDb();
  await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: fields });
}

describe('Brand billing — active brand quota (money gates)', () => {
  it('free user: first brand OK, second → 402 brand_limit with paywall payload', async () => {
    const { user } = await createUser();
    const agent = await request();

    const first = await agent
      .post('/api/brand-guidelines')
      .set('Authorization', tokenFor(user))
      .send({ identity: { name: 'Brand One' } });
    expect(first.status).toBe(201);

    const second = await agent
      .post('/api/brand-guidelines')
      .set('Authorization', tokenFor(user))
      .send({ identity: { name: 'Brand Two' } });
    expect(second.status).toBe(402);
    expect(second.body.error).toBe('brand_limit');
    expect(second.body.reason).toBe('brand_limit');
    expect(second.body.used).toBe(1);
    expect(second.body.max).toBe(1);
    expect(second.body.upgradeUrl).toBe('/pricing');
  });

  it('archive frees the slot; unarchive beyond the limit → 402 brand_limit', async () => {
    const { user } = await createUser();
    const agent = await request();
    const { guideline: first } = await createBrandGuideline({ userId: user.id, name: 'A' });

    // Archive the only brand → slot freed → creating a new one works.
    const archived = await agent
      .post(`/api/brand-guidelines/${first.id}/archive`)
      .set('Authorization', tokenFor(user));
    expect(archived.status).toBe(200);
    expect(archived.body.guideline.status).toBe('archived');
    expect(archived.body.guideline.archivedAt).toBeTruthy();

    const created = await agent
      .post('/api/brand-guidelines')
      .set('Authorization', tokenFor(user))
      .send({ identity: { name: 'B' } });
    expect(created.status).toBe(201);

    // Reactivating the archived one would exceed the limit → 402.
    const unarchive = await agent
      .post(`/api/brand-guidelines/${first.id}/unarchive`)
      .set('Authorization', tokenFor(user));
    expect(unarchive.status).toBe(402);
    expect(unarchive.body.error).toBe('brand_limit');
    expect(unarchive.body.reason).toBe('brand_limit');
  });

  it('archived brand is read-only: PUT → 403 brand_archived', async () => {
    const { user } = await createUser();
    const agent = await request();
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'RO' });

    await agent
      .post(`/api/brand-guidelines/${guideline.id}/archive`)
      .set('Authorization', tokenFor(user));

    const res = await agent
      .put(`/api/brand-guidelines/${guideline.id}`)
      .set('Authorization', tokenFor(user))
      .send({ identity: { name: 'Renamed' } });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('brand_archived');
    expect(res.body.reason).toBe('brand_archived');
  });

  it('archive/unarchive are owner-only (foreign brand → 404)', async () => {
    const { user: owner } = await createUser();
    const { user: intruder } = await createUser();
    const agent = await request();
    const { guideline } = await createBrandGuideline({ userId: owner.id, name: 'Mine' });

    const res = await agent
      .post(`/api/brand-guidelines/${guideline.id}/archive`)
      .set('Authorization', tokenFor(intruder));
    expect(res.status).toBe(404);
  });

  it('generation referencing an archived brand → 403 brand_archived (checkSubscription choke point)', async () => {
    const { user } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Gen' });
    const { prisma } = await import('../../../server/db/prisma.js');
    await prisma.brandGuideline.update({
      where: { id: guideline.id },
      data: { status: 'archived', archivedAt: new Date() },
    });

    // Minimal app mounting the exact production middleware chain used by every
    // generation route (mockups/branding/video/moodboard + MCP reuse).
    const { authenticate } = await import('../../../server/middleware/auth.js');
    const { checkSubscription } = await import('../../../server/middleware/subscription.js');
    const app = express();
    app.use(express.json());
    app.post('/gen', authenticate as any, checkSubscription as any, (_req, res) =>
      res.json({ ok: true })
    );

    const blocked = await supertest(app)
      .post('/gen')
      .set('Authorization', tokenFor(user))
      .send({ brandGuidelineId: guideline.id, prompt: 'x' });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toBe('brand_archived');
    expect(blocked.body.reason).toBe('brand_archived');

    // Same request against an ACTIVE brand passes the gate.
    await prisma.brandGuideline.update({
      where: { id: guideline.id },
      data: { status: 'active', archivedAt: null },
    });
    const allowed = await supertest(app)
      .post('/gen')
      .set('Authorization', tokenFor(user))
      .send({ brandGuidelineId: guideline.id, prompt: 'x' });
    expect(allowed.status).toBe(200);
    expect(allowed.body.ok).toBe(true);
  });

  it('grandfathering: metadata.legacyBrands raises the effective limit', async () => {
    const { user } = await createUser();
    await setUserFields(user.id, { metadata: { legacyBrands: 3 } });
    const agent = await request();

    // Seed 2 pre-existing brands (as the migration snapshot would have counted).
    await createBrandGuideline({ userId: user.id, name: 'Legacy 1' });
    await createBrandGuideline({ userId: user.id, name: 'Legacy 2' });

    // Free tier limit is 1, but legacyBrands=3 → third brand still allowed.
    const third = await agent
      .post('/api/brand-guidelines')
      .set('Authorization', tokenFor(user))
      .send({ identity: { name: 'Legacy 3' } });
    expect(third.status).toBe(201);

    // Beyond the grandfathered count → blocked.
    const fourth = await agent
      .post('/api/brand-guidelines')
      .set('Authorization', tokenFor(user))
      .send({ identity: { name: 'Over' } });
    expect(fourth.status).toBe(402);
    expect(fourth.body.max).toBe(3);
  });

  it('agency tier: Stripe quantity caps the quota; without quantity it is unlimited', async () => {
    const { user } = await createUser();
    await setUserFields(user.id, {
      subscriptionStatus: 'active',
      subscriptionTier: 'agency',
      metadata: { agencyBrandQuantity: 2 },
    });
    const agent = await request();

    await createBrandGuideline({ userId: user.id, name: 'Client 1' });
    await createBrandGuideline({ userId: user.id, name: 'Client 2' });

    const over = await agent
      .post('/api/brand-guidelines')
      .set('Authorization', tokenFor(user))
      .send({ identity: { name: 'Client 3' } });
    expect(over.status).toBe(402);
    expect(over.body.max).toBe(2);
    expect(over.body.tier).toBe('agency');

    // Remove the quantity cap → unlimited (Stripe quantity is the only cap for agency).
    await setUserFields(user.id, { metadata: {} });
    const unlimited = await agent
      .post('/api/brand-guidelines')
      .set('Authorization', tokenFor(user))
      .send({ identity: { name: 'Client 3' } });
    expect(unlimited.status).toBe(201);
  });

  it('brands shared WITH the user do not count against their own quota', async () => {
    const { user: owner } = await createUser();
    const { user: editor } = await createUser();
    // Owner's brand shared with editor (canEdit) — counts on the owner only.
    await createBrandGuideline({ userId: owner.id, name: 'Shared', canEdit: [editor.id] });

    const agent = await request();
    const res = await agent
      .post('/api/brand-guidelines')
      .set('Authorization', tokenFor(editor))
      .send({ identity: { name: 'Own Brand' } });
    expect(res.status).toBe(201);
  });

  it('BYOK: user API key still costs 0 credits (chargeCredits reason user-key)', async () => {
    const { user } = await createUser();
    const { chargeCredits } = await import('../../../server/lib/credits.js');

    const result = await chargeCredits(user.id, 5, { isUserApiKey: true });
    expect(result.charged).toBe(false);
    expect(result.creditsDeducted).toBe(0);
    expect(result.reason).toBe('user-key');

    // Credits untouched in the DB.
    const { connectToMongoDB, getDb } = await import('../../../server/db/mongodb.js');
    const { ObjectId } = await import('mongodb');
    await connectToMongoDB();
    const db = getDb();
    const doc = await db.collection('users').findOne({ _id: new ObjectId(user.id) });
    expect(doc?.creditsUsed ?? 0).toBe(0);
  });

  it('BYOK v2: usage records carry byok:true when the user key was used', async () => {
    const { createUsageRecord } = await import('../../../server/utils/usageTracking.js');
    const byokRecord = createUsageRecord(
      'someUserId',
      1,
      'gemini-test-model',
      false,
      10,
      undefined,
      'mockupmachine',
      'user'
    );
    expect(byokRecord.byok).toBe(true);
    expect(byokRecord.apiKeySource).toBe('user');

    const systemRecord = createUsageRecord('someUserId', 1, 'gemini-test-model', false);
    expect(systemRecord.byok).toBe(false);
  });

  it('downgrade: grace window recorded (nothing archived), then cron archives the excess', async () => {
    const { user } = await createUser();
    const { prisma } = await import('../../../server/db/prisma.js');
    const { enforceBrandQuotaOnDowngrade, archiveExcessBrands } =
      await import('../../../server/lib/brandQuota.js');

    // 3 active brands on a free account (limit 1) — e.g. after churn from pro.
    const { guideline: b1 } = await createBrandGuideline({ userId: user.id, name: 'Old 1' });
    const { guideline: b2 } = await createBrandGuideline({ userId: user.id, name: 'Old 2' });
    const { guideline: b3 } = await createBrandGuideline({ userId: user.id, name: 'Newest' });
    // Make b3 the most recently updated (survivor).
    await prisma.brandGuideline.update({
      where: { id: b3.id },
      data: { folder: 'touch' },
    });

    // Webhook path: records grace, archives NOTHING yet.
    const { excess, graceUntil } = await enforceBrandQuotaOnDowngrade(user.id);
    expect(excess).toBe(2);
    expect(graceUntil).toBeTruthy();
    const stillActive = await prisma.brandGuideline.count({
      where: { userId: user.id, NOT: { status: 'archived' } },
    });
    expect(stillActive).toBe(3);

    // Expire the grace window and run the cron job body.
    const meta = {
      brandQuotaGraceUntil: new Date(Date.now() - 1000).toISOString(),
      brandQuotaExcess: 2,
    };
    await setUserFields(user.id, { metadata: meta });
    const result = await archiveExcessBrands();
    expect(result.brandsArchived).toBeGreaterThanOrEqual(2);

    const after = await prisma.brandGuideline.findMany({
      where: { userId: user.id },
      select: { id: true, status: true },
    });
    const activeIds = after.filter((g) => g.status !== 'archived').map((g) => g.id);
    expect(activeIds).toEqual([b3.id]); // least-recently-updated were archived
    expect(
      after
        .filter((g) => g.status === 'archived')
        .map((g) => g.id)
        .sort()
    ).toEqual([b1.id, b2.id].sort());

    // Grace flags cleared (idempotent for the next run).
    const fresh = await prisma.user.findUnique({
      where: { id: user.id },
      select: { metadata: true },
    });
    expect((fresh?.metadata as any)?.brandQuotaGraceUntil).toBeUndefined();
  });

  it('subscription-status exposes brandQuota {used, max, tier}', async () => {
    const { user } = await createUser();
    await createBrandGuideline({ userId: user.id, name: 'Only' });
    const agent = await request();

    const res = await agent
      .get('/api/payments/subscription-status')
      .set('Authorization', tokenFor(user));
    expect(res.status).toBe(200);
    expect(res.body.brandQuota).toEqual({ used: 1, max: 1, tier: 'free' });
  });

  it('pricing v3 tiers: starter/pro/vision resolve maxBrands via getBrandQuota fallbacks', async () => {
    const { getBrandQuota } = await import('../../../server/lib/brandQuota.js');
    const { user: starterUser } = await createUser();
    const { user: proUser } = await createUser();
    const { user: visionUser } = await createUser();

    await setUserFields(starterUser.id, {
      subscriptionStatus: 'active',
      subscriptionTier: 'starter',
    });
    await setUserFields(proUser.id, { subscriptionStatus: 'active', subscriptionTier: 'pro' });
    await setUserFields(visionUser.id, {
      subscriptionStatus: 'active',
      subscriptionTier: 'vision',
    });

    const starterQuota = await getBrandQuota({
      ...starterUser,
      subscriptionStatus: 'active',
      subscriptionTier: 'starter',
    } as any);
    expect(starterQuota.max).toBe(1);
    expect(starterQuota.tier).toBe('starter');

    // v3 Pro = unlimited brands (shared `pro` key with the legacy tier —
    // see FALLBACK_MAX_BRANDS comment in brandQuota.ts for the reconciliation).
    const proQuota = await getBrandQuota({
      ...proUser,
      subscriptionStatus: 'active',
      subscriptionTier: 'pro',
    } as any);
    expect(proQuota.max).toBeNull();
    expect(proQuota.tier).toBe('pro');

    const visionQuota = await getBrandQuota({
      ...visionUser,
      subscriptionStatus: 'active',
      subscriptionTier: 'vision',
    } as any);
    expect(visionQuota.max).toBeNull();
    expect(visionQuota.tier).toBe('vision');
  });

  it('duplicate counts as creation: blocked at the limit with 402 brand_limit', async () => {
    const { user } = await createUser();
    const agent = await request();
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Solo' });

    const res = await agent
      .post(`/api/brand-guidelines/${guideline.id}/duplicate`)
      .set('Authorization', tokenFor(user));
    expect(res.status).toBe(402);
    expect(res.body.error).toBe('brand_limit');
  });
});
