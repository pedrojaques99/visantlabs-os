import { describe, it, expect } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser, createAdmin } from '../../factories/user.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

// Must be set BEFORE the app is built (getApp caches per process) —
// /api/copilot only mounts when the flag is on.
process.env.FEATURE_COPILOT = 'true';

/** Promote a fresh user to active subscriber directly in Mongo (validateSubscriber reads Mongo first). */
async function createSubscriber() {
  const { user } = await createUser({ isAdmin: false });
  const { connectToMongoDB, getDb } = await import('../../../server/db/mongodb.js');
  const { ObjectId } = await import('mongodb');
  await connectToMongoDB();
  const db = getDb();
  await db
    .collection('users')
    .updateOne({ _id: new ObjectId(user.id) }, { $set: { subscriptionStatus: 'active' } });
  return user;
}

function tokenFor(user: { id: string; email: string }) {
  return bearer(signTestToken({ userId: user.id, email: user.email }));
}

describe('Brand Copilot tier gate (/api/copilot)', () => {
  it('rejects unauthenticated requests with 401', async () => {
    const agent = await request();
    const res = await agent.post('/api/copilot/sessions').send({});
    expect(res.status).toBe(401);
  });

  it('free user → 403 subscription_required with upgrade payload (money gate)', async () => {
    const { user } = await createUser({ isAdmin: false });
    const agent = await request();
    const res = await agent
      .post('/api/copilot/sessions')
      .set('Authorization', tokenFor(user))
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('subscription_required');
    expect(res.body.reason).toBe('subscription_required');
    expect(res.body.upgradeUrl).toBe('/pricing');
  });

  it('active subscriber → can create and list copilot sessions', async () => {
    const user = await createSubscriber();
    const agent = await request();

    const created = await agent
      .post('/api/copilot/sessions')
      .set('Authorization', tokenFor(user))
      .send({});
    expect(created.status).toBe(201);
    expect(created.body.session).toBeTruthy();
    expect(created.body.session.ownerId).toBe(user.id);

    const listed = await agent.get('/api/copilot/sessions').set('Authorization', tokenFor(user));
    expect(listed.status).toBe(200);
    expect(listed.body.sessions.map((s: any) => s._id)).toContain(created.body.session._id);
  });

  it('admin → passes the subscriber gate without an active subscription', async () => {
    const { user } = await createAdmin();
    const agent = await request();
    const res = await agent
      .post('/api/copilot/sessions')
      .set('Authorization', tokenFor(user))
      .send({});
    expect(res.status).toBe(201);
  });

  it('subscriber (non-admin) still CANNOT access /api/admin-chat (zero breaking change)', async () => {
    const user = await createSubscriber();
    const agent = await request();
    const res = await agent
      .post('/api/admin-chat/sessions')
      .set('Authorization', tokenFor(user))
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Admin access required');
  });

  it('admin keeps access to /api/admin-chat (zero breaking change)', async () => {
    const { user } = await createAdmin();
    const agent = await request();
    const res = await agent
      .post('/api/admin-chat/sessions')
      .set('Authorization', tokenFor(user))
      .send({});
    expect(res.status).toBe(201);
  });

  it('sessions are userId-scoped across surfaces (copilot user cannot read foreign session)', async () => {
    const owner = await createSubscriber();
    const intruder = await createSubscriber();
    const agent = await request();

    const created = await agent
      .post('/api/copilot/sessions')
      .set('Authorization', tokenFor(owner))
      .send({});
    expect(created.status).toBe(201);

    const res = await agent
      .get(`/api/copilot/sessions/${created.body.session._id}`)
      .set('Authorization', tokenFor(intruder));
    expect(res.status).toBe(404);
  });
});
