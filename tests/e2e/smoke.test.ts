import { describe, it, expect } from 'vitest';
import { request } from '../helpers/app.js';
import { createUser } from '../factories/user.js';

/**
 * E2E smoke — one happy-path journey proves the whole app wires up.
 *
 * If this fails, CI blocks the PR. Everything else is diagnostic.
 */
describe('Smoke: server boots + core endpoints reachable', () => {
  it('GET /api/health returns 200', async () => {
    const agent = await request();
    const res = await agent.get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/payments/plans returns 200 (no auth)', async () => {
    const agent = await request();
    const res = await agent.get('/api/payments/plans');
    expect(res.status).toBe(200);
  });

  it('Auth roundtrip: signup → signin → authenticated read', async () => {
    const agent = await request();
    const { user, password } = await createUser();

    const signin = await agent.post('/api/auth/signin').send({ email: user.email, password });
    expect(signin.status).toBe(200);
    const token = signin.body.token;
    expect(token).toBeTypeOf('string');

    const me = await agent.get('/api/payments/subscription-status').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
  });
});
