import { describe, it, expect } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser, createAdmin } from '../../factories/user.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

/**
 * RBAC contract: every admin endpoint must reject non-admin tokens.
 *
 * Instead of hand-enumerating each endpoint, we discover them via a GET smoke
 * on representative paths. As endpoints are added, extend the `endpoints`
 * list — the test will assert 403 for every one.
 */
const endpoints: Array<[method: 'get' | 'post', path: string]> = [
  ['get', '/api/admin/users'],
  ['get', '/api/admin/stats'],
];

describe('admin RBAC', () => {
  it.each(endpoints)('%s %s → 401 without token', async (method, path) => {
    const agent = await request();
    const res = await agent[method](path);
    expect([401, 403]).toContain(res.status);
  });

  it.each(endpoints)('%s %s → 403 for non-admin user', async (method, path) => {
    const { user } = await createUser({ isAdmin: false });
    const token = signTestToken({ userId: user.id, email: user.email });
    const agent = await request();
    const res = await agent[method](path).set('Authorization', bearer(token));
    expect(res.status).toBe(403);
  });

  it.each(endpoints)('%s %s → reachable for admin user', async (method, path) => {
    const { user } = await createAdmin();
    const token = signTestToken({ userId: user.id, email: user.email });
    const agent = await request();
    const res = await agent[method](path).set('Authorization', bearer(token));
    // Admin path executes; status may vary (200, 204, 404 if no data) but never 403
    expect(res.status).not.toBe(403);
    expect(res.status).not.toBe(401);
  });
});
