import { describe, it, expect } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';

describe('POST /api/auth/signin', () => {
  it('returns 200 + token for valid credentials', async () => {
    const { user, password } = await createUser();
    const agent = await request();

    const res = await agent.post('/api/auth/signin').send({ email: user.email, password });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTypeOf('string');
    expect(res.body.user?.email).toBe(user.email);
  });

  it('returns 401 for wrong password', async () => {
    const { user } = await createUser();
    const agent = await request();

    const res = await agent.post('/api/auth/signin').send({ email: user.email, password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.token).toBeUndefined();
  });

  it('returns 400 for malformed email', async () => {
    const agent = await request();
    const res = await agent.post('/api/auth/signin').send({ email: 'not-an-email', password: 'x' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe('POST /api/auth/signup', () => {
  it('creates a user and returns a token', async () => {
    const agent = await request();
    const email = `signup-${Date.now()}@example.com`;

    const res = await agent.post('/api/auth/signup').send({
      email,
      password: 'Passw0rd!',
      name: 'Signup User',
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.token).toBeTypeOf('string');
  });

  it('rejects duplicate email', async () => {
    const { user } = await createUser();
    const agent = await request();

    const res = await agent.post('/api/auth/signup').send({
      email: user.email,
      password: 'Passw0rd!',
      name: 'Dup',
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});
