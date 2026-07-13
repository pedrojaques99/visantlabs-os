import { describe, it, expect } from 'vitest';
import { request } from '../../helpers/app.js';
import { createAdmin } from '../../factories/user.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

/**
 * Smoke test for the split admin dashboard endpoints — confirms the batched
 * aggregations execute end-to-end (return 200, not 500) for an admin.
 */
describe('admin dashboard endpoints', () => {
  const paths = ['/api/admin/summary', '/api/admin/users', '/api/admin/charts'];

  it.each(paths)('GET %s → 200 with a JSON body for admin', async (path) => {
    const { user } = await createAdmin();
    const token = signTestToken({ userId: user.id, email: user.email });
    const agent = await request();
    const res = await agent.get(path).set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    expect(res.body).toBeTypeOf('object');
  });

  it('summary returns the expected KPI keys', async () => {
    const { user } = await createAdmin();
    const token = signTestToken({ userId: user.id, email: user.email });
    const agent = await request();
    const res = await agent.get('/api/admin/summary').set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    for (const key of [
      'totalUsers',
      'activeSubscriptions',
      'newUsers30d',
      'totalTransactions',
      'totalRevenueBRL',
      'totalApiCostUSD',
      'referralStats',
    ]) {
      expect(res.body).toHaveProperty(key);
    }
  });

  it('users returns an array under `users`', async () => {
    const { user } = await createAdmin();
    const token = signTestToken({ userId: user.id, email: user.email });
    const agent = await request();
    const res = await agent.get('/api/admin/users').set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });
});
