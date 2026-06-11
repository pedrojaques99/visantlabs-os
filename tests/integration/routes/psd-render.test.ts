import { describe, it, expect } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

/**
 * Creates an API key for `user` with the given scopes via the public route and
 * returns the raw `visant_sk_*` token. Returns null if the route isn't mounted
 * in this harness (fail-soft, mirrors apiKeys.test.ts).
 */
async function createApiKey(
  userToken: string,
  scopes: string[]
): Promise<string | null> {
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
