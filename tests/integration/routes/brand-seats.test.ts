import { describe, it, expect } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { createBrandGuideline } from '../../factories/brandGuideline.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

// Must be set BEFORE the app/lib is used — enforcement is behind the flags.
process.env.FEATURE_BRAND_BILLING = 'true';
process.env.FEATURE_COPILOT = 'true';

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

async function createTierUser(tier: string) {
  const { user } = await createUser();
  await setUserFields(user.id, { subscriptionStatus: 'active', subscriptionTier: tier });
  return user;
}

describe('Seats — editor seats per brand (Fase 4 money gates)', () => {
  it('free owner: editor invite → 402 seat_limit with paywall payload; viewer invite always passes', async () => {
    const { user } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Free Brand' });
    const agent = await request();

    const editor = await agent
      .post(`/api/brand-guidelines/${guideline.id}/invite`)
      .set('Authorization', tokenFor(user))
      .send({ role: 'editor' });
    expect(editor.status).toBe(402);
    expect(editor.body.error).toBe('seat_limit');
    expect(editor.body.reason).toBe('seat_limit');
    expect(editor.body.used).toBe(0);
    expect(editor.body.max).toBe(0);
    expect(editor.body.upgradeUrl).toBe('/pricing');

    const viewer = await agent
      .post(`/api/brand-guidelines/${guideline.id}/invite`)
      .set('Authorization', tokenFor(user))
      .send({ role: 'viewer' });
    expect(viewer.status).toBe(201);
    expect(viewer.body.invite.role).toBe('viewer');
  });

  it('premium (1 seat): first editor invite OK, second blocked — pending invite HOLDS the seat', async () => {
    const user = await createTierUser('premium');
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Premium Brand' });
    const agent = await request();

    const first = await agent
      .post(`/api/brand-guidelines/${guideline.id}/invite`)
      .set('Authorization', tokenFor(user))
      .send({ role: 'editor' });
    expect(first.status).toBe(201);

    const second = await agent
      .post(`/api/brand-guidelines/${guideline.id}/invite`)
      .set('Authorization', tokenFor(user))
      .send({ role: 'editor' });
    expect(second.status).toBe(402);
    expect(second.body.error).toBe('seat_limit');
    expect(second.body.used).toBe(1);
    expect(second.body.max).toBe(1);

    // Viewer invites are unaffected by a full seat quota.
    const viewer = await agent
      .post(`/api/brand-guidelines/${guideline.id}/invite`)
      .set('Authorization', tokenFor(user))
      .send({ role: 'viewer' });
    expect(viewer.status).toBe(201);
  });

  it('revoking a pending editor invite frees the seat', async () => {
    const user = await createTierUser('premium');
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Revoke Brand' });
    const agent = await request();

    const first = await agent
      .post(`/api/brand-guidelines/${guideline.id}/invite`)
      .set('Authorization', tokenFor(user))
      .send({ role: 'editor' });
    expect(first.status).toBe(201);

    const revoked = await agent
      .delete(`/api/brand-guidelines/${guideline.id}/invite/${first.body.invite._id}`)
      .set('Authorization', tokenFor(user));
    expect(revoked.status).toBe(200);

    const again = await agent
      .post(`/api/brand-guidelines/${guideline.id}/invite`)
      .set('Authorization', tokenFor(user))
      .send({ role: 'editor' });
    expect(again.status).toBe(201);
  });

  it('accepted editors (canEdit[]) count as used seats; owner never counts', async () => {
    const user = await createTierUser('premium');
    const { user: existingEditor } = await createUser();
    // Owner accidentally present in canEdit must NOT consume a seat.
    const { guideline } = await createBrandGuideline({
      userId: user.id,
      name: 'Team Brand',
      canEdit: [existingEditor.id, user.id],
    });
    const agent = await request();

    const res = await agent
      .post(`/api/brand-guidelines/${guideline.id}/invite`)
      .set('Authorization', tokenFor(user))
      .send({ role: 'editor' });
    expect(res.status).toBe(402);
    expect(res.body.used).toBe(1); // only the real editor — owner excluded
    expect(res.body.max).toBe(1);
  });

  it('collaborators route: viewer→editor promotion is gated; keeping an existing editor is not', async () => {
    const user = await createTierUser('premium');
    const { user: editor } = await createUser();
    const { user: viewer } = await createUser();
    const { guideline } = await createBrandGuideline({
      userId: user.id,
      name: 'Promo Brand',
      canEdit: [editor.id],
      canView: [viewer.id],
    });
    const agent = await request();

    // Promotion beyond the limit → 402 seat_limit.
    const promote = await agent
      .post(`/api/brand-guidelines/${guideline.id}/collaborators`)
      .set('Authorization', tokenFor(user))
      .send({ email: viewer.email, role: 'editor' });
    expect(promote.status).toBe(402);
    expect(promote.body.error).toBe('seat_limit');

    // Re-asserting the existing editor's role is a no-op — always allowed.
    const keep = await agent
      .post(`/api/brand-guidelines/${guideline.id}/collaborators`)
      .set('Authorization', tokenFor(user))
      .send({ email: editor.email, role: 'editor' });
    expect(keep.status).toBe(200);

    // Adding another viewer is always free.
    const { user: viewer2 } = await createUser();
    const addViewer = await agent
      .post(`/api/brand-guidelines/${guideline.id}/collaborators`)
      .set('Authorization', tokenFor(user))
      .send({ email: viewer2.email, role: 'viewer' });
    expect(addViewer.status).toBe(200);
  });

  it('pro tier allows 4 editors (v3 Pro = 5 seats total, owner + 4); agency is unlimited', async () => {
    // The `pro` tier key is shared between the legacy plan and the v3 pricing
    // spec (starter/pro/vision) — reconciled to the v3 value (4 extra editors
    // = 5 seats total) in FALLBACK_MAX_EDITORS (server/lib/brandQuota.ts).
    const pro = await createTierUser('pro');
    const { guideline: proBrand } = await createBrandGuideline({ userId: pro.id, name: 'Pro' });
    const agent = await request();

    for (let i = 0; i < 4; i++) {
      const res = await agent
        .post(`/api/brand-guidelines/${proBrand.id}/invite`)
        .set('Authorization', tokenFor(pro))
        .send({ role: 'editor' });
      expect(res.status).toBe(201);
    }
    const fifth = await agent
      .post(`/api/brand-guidelines/${proBrand.id}/invite`)
      .set('Authorization', tokenFor(pro))
      .send({ role: 'editor' });
    expect(fifth.status).toBe(402);
    expect(fifth.body.max).toBe(4);

    const agency = await createTierUser('agency');
    const { guideline: agencyBrand } = await createBrandGuideline({
      userId: agency.id,
      name: 'Agency',
    });
    for (let i = 0; i < 5; i++) {
      const res = await agent
        .post(`/api/brand-guidelines/${agencyBrand.id}/invite`)
        .set('Authorization', tokenFor(agency))
        .send({ role: 'editor' });
      expect(res.status).toBe(201);
    }
  });

  it('flag off → no gate (quota still computed but never blocks)', async () => {
    process.env.FEATURE_BRAND_BILLING = 'false';
    try {
      const { user } = await createUser(); // free tier, seats = 0
      const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Flag Off' });
      const agent = await request();

      const res = await agent
        .post(`/api/brand-guidelines/${guideline.id}/invite`)
        .set('Authorization', tokenFor(user))
        .send({ role: 'editor' });
      expect(res.status).toBe(201);
    } finally {
      process.env.FEATURE_BRAND_BILLING = 'true';
    }
  });

  it('expired pending editor invites do not hold a seat', async () => {
    const user = await createTierUser('premium');
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Expired' });
    const { prisma } = await import('../../../server/db/prisma.js');
    await prisma.brandInvite.create({
      data: {
        token: `expired-${guideline.id}`,
        brandGuidelineId: guideline.id,
        createdByUserId: user.id,
        role: 'editor',
        status: 'pending',
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const agent = await request();
    const res = await agent
      .post(`/api/brand-guidelines/${guideline.id}/invite`)
      .set('Authorization', tokenFor(user))
      .send({ role: 'editor' });
    expect(res.status).toBe(201);
  });

  it('GET /brand-guidelines/:id exposes seatQuota {used, max}', async () => {
    const user = await createTierUser('pro');
    const { user: editor } = await createUser();
    const { guideline } = await createBrandGuideline({
      userId: user.id,
      name: 'Detail',
      canEdit: [editor.id],
    });
    const agent = await request();

    const res = await agent
      .get(`/api/brand-guidelines/${guideline.id}`)
      .set('Authorization', tokenFor(user));
    expect(res.status).toBe(200);
    expect(res.body.seatQuota).toEqual({ used: 1, max: 4 });
  });

  it('subscription-status exposes seatQuota {totalEditors, maxPerBrand, tier}', async () => {
    const user = await createTierUser('premium');
    const { user: editor } = await createUser();
    await createBrandGuideline({ userId: user.id, name: 'S1', canEdit: [editor.id] });
    await createBrandGuideline({ userId: user.id, name: 'S2' });
    const agent = await request();

    const res = await agent
      .get('/api/payments/subscription-status')
      .set('Authorization', tokenFor(user));
    expect(res.status).toBe(200);
    expect(res.body.seatQuota).toEqual({ totalEditors: 1, maxPerBrand: 1, tier: 'premium' });
  });
});

describe('Seats — Copilot session sharing (Fase 4 task 4.6)', () => {
  it('subscriber WITHOUT a seat tier (free seats=0) cannot share a session → 402 seat_limit', async () => {
    // Active subscription but no paid tier → effective tier 'free' → 0 seats.
    const { user } = await createUser();
    await setUserFields(user.id, { subscriptionStatus: 'active' });
    const agent = await request();

    const created = await agent
      .post('/api/copilot/sessions')
      .set('Authorization', tokenFor(user))
      .send({});
    expect(created.status).toBe(201);

    const share = await agent
      .post(`/api/copilot/sessions/${created.body.session._id}/share`)
      .set('Authorization', tokenFor(user))
      .send({ isShared: true });
    expect(share.status).toBe(402);
    expect(share.body.error).toBe('seat_limit');
    expect(share.body.reason).toBe('seat_limit');
    expect(share.body.upgradeUrl).toBe('/pricing');

    // Creating a session ALREADY shared is also gated.
    const preShared = await agent
      .post('/api/copilot/sessions')
      .set('Authorization', tokenFor(user))
      .send({ isShared: true });
    expect(preShared.status).toBe(402);
    expect(preShared.body.error).toBe('seat_limit');
  });

  it('premium subscriber (seats > 0) can share; unsharing always passes', async () => {
    const user = await createTierUser('premium');
    const { user: teammate } = await createUser();
    const agent = await request();

    const created = await agent
      .post('/api/copilot/sessions')
      .set('Authorization', tokenFor(user))
      .send({});
    expect(created.status).toBe(201);

    const share = await agent
      .post(`/api/copilot/sessions/${created.body.session._id}/share`)
      .set('Authorization', tokenFor(user))
      .send({ isShared: true, sharedWithUserIds: [teammate.id] });
    expect(share.status).toBe(200);
    expect(share.body.session.isShared).toBe(true);
    expect(share.body.session.sharedWithUserIds).toEqual([teammate.id]);

    const unshare = await agent
      .post(`/api/copilot/sessions/${created.body.session._id}/share`)
      .set('Authorization', tokenFor(user))
      .send({ isShared: false, sharedWithUserIds: [] });
    expect(unshare.status).toBe(200);
    expect(unshare.body.session.isShared).toBe(false);
  });
});
