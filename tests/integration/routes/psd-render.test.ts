import { describe, it, expect } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser, createAdmin } from '../../factories/user.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

/**
 * Creates an API key for `user` with the given scopes via the public route and
 * returns the raw `visant_sk_*` token. Returns null if the route isn't mounted
 * in this harness (fail-soft, mirrors apiKeys.test.ts).
 */
async function createApiKey(userToken: string, scopes: string[]): Promise<string | null> {
  const agent = await request();
  const res = await agent
    .post('/api/apiKeys/create')
    .set('Authorization', bearer(userToken))
    .send({ name: `scope-${scopes.join('-')}`, scopes });
  if (res.status === 404) return null;
  expect([200, 201]).toContain(res.status);
  return res.body?.key ?? null;
}

describe('POST /api/psd-render/render — auth & scope gate', () => {
  it('401 without auth', async () => {
    const agent = await request();
    const res = await agent.post('/api/psd-render/render').send({});
    expect(res.status).toBe(401);
  });

  it('full JWT session bypasses scope (reaches validation → 400, not 403)', async () => {
    const { user } = await createUser();
    const token = signTestToken({ userId: user.id, email: user.email });
    const agent = await request();
    // Missing psdUrl/psdFileName → handler returns 400 before any render work.
    const res = await agent
      .post('/api/psd-render/render')
      .set('Authorization', bearer(token))
      .send({ arts: [{ smartObject: '*', artBase64: 'x' }] });
    expect(res.status).toBe(400);
  });

  it('API key WITHOUT generate scope is rejected with 403', async () => {
    const { user } = await createUser();
    const userToken = signTestToken({ userId: user.id, email: user.email });
    const rawKey = await createApiKey(userToken, ['read', 'write']);
    if (!rawKey) return; // route not mounted — fail soft
    const agent = await request();
    const res = await agent
      .post('/api/psd-render/render')
      .set('Authorization', bearer(rawKey))
      // A complete-looking body — must still be blocked at the scope gate,
      // before validation or any Drive/render work.
      .send({ psdFileName: 'boxy.psd', arts: [{ smartObject: '*', artBase64: 'x' }] });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/scope/i);
  });

  it('API key WITH generate scope passes the gate (reaches validation → 400, not 403)', async () => {
    const { user } = await createUser();
    const userToken = signTestToken({ userId: user.id, email: user.email });
    const rawKey = await createApiKey(userToken, ['read', 'write', 'generate']);
    if (!rawKey) return; // route not mounted — fail soft
    const agent = await request();
    const res = await agent
      .post('/api/psd-render/render')
      .set('Authorization', bearer(rawKey))
      // Missing psd source → 400 from validation, proving the scope gate opened.
      .send({ arts: [{ smartObject: '*', artBase64: 'x' }] });
    expect(res.status).toBe(400);
  });
});

describe('Scene Package endpoints — auth & validation', () => {
  it('POST /scene-prepare → 401 without auth', async () => {
    const agent = await request();
    const res = await agent.post('/api/psd-render/scene-prepare').send({ psdFileName: 'x.psd' });
    expect(res.status).toBe(401);
  });

  it('POST /scene-prepare → 403 for API key without generate scope', async () => {
    const { user } = await createUser();
    const userToken = signTestToken({ userId: user.id, email: user.email });
    const rawKey = await createApiKey(userToken, ['read', 'write']);
    if (!rawKey) return; // route not mounted — fail soft
    const agent = await request();
    const res = await agent
      .post('/api/psd-render/scene-prepare')
      .set('Authorization', bearer(rawKey))
      .send({ psdFileName: 'boxy.psd' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/scope/i);
  });

  it('POST /scene-prepare → 400 for a non-bare file name (full JWT, past scope gate)', async () => {
    const { user } = await createUser();
    const token = signTestToken({ userId: user.id, email: user.email });
    const agent = await request();
    const res = await agent
      .post('/api/psd-render/scene-prepare')
      .set('Authorization', bearer(token))
      .send({ psdFileName: '../etc/passwd' });
    expect(res.status).toBe(400);
  });

  it('GET /scenes → 401 without auth', async () => {
    const agent = await request();
    const res = await agent.get('/api/psd-render/scenes');
    expect(res.status).toBe(401);
  });

  it('GET /scenes → 200 with auth (catalog, possibly empty)', async () => {
    const { user } = await createUser();
    const token = signTestToken({ userId: user.id, email: user.email });
    const agent = await request();
    const res = await agent.get('/api/psd-render/scenes').set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.scenes)).toBe(true);
  });

  it('GET /scenes/:file → 404 when the scene does not exist', async () => {
    const { user } = await createUser();
    const token = signTestToken({ userId: user.id, email: user.email });
    const agent = await request();
    const res = await agent
      .get('/api/psd-render/scenes/does-not-exist.psd')
      .set('Authorization', bearer(token));
    expect(res.status).toBe(404);
  });

  it('DELETE /scenes/:file → 403 for a non-admin', async () => {
    const { user } = await createUser();
    const token = signTestToken({ userId: user.id, email: user.email });
    const agent = await request();
    const res = await agent
      .delete('/api/psd-render/scenes/x.psd')
      .set('Authorization', bearer(token));
    expect(res.status).toBe(403);
  });

  it('DELETE /scenes/:file → 200 for an admin (idempotent, deleted=false when absent)', async () => {
    const { user } = await createAdmin();
    const token = signTestToken({ userId: user.id, email: user.email });
    const agent = await request();
    const res = await agent
      .delete('/api/psd-render/scenes/x.psd')
      .set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.deleted).toBe(false);
  });
});
