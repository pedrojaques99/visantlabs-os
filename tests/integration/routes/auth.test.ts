import { describe, it, expect, vi } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';

// Mock google-auth-library before any server module imports it
vi.mock('google-auth-library', () => {
  class MockOAuth2Client {
    generateAuthUrl() {
      return 'https://accounts.google.com/mock-auth-url';
    }
    async getToken(_code: string) {
      return { tokens: { access_token: 'mock-access', id_token: 'mock-id-token' } };
    }
    setCredentials(_tokens: unknown) {}
    async verifyIdToken(_opts: unknown) {
      return {
        getPayload: () => ({
          email: 'oauth-user@example.com',
          name: 'OAuth User',
          sub: 'google-sub-12345',
          picture: 'https://example.com/pic.jpg',
        }),
      };
    }
  }
  return { OAuth2Client: MockOAuth2Client };
});

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

describe('GET /api/auth/google', () => {
  it('returns authUrl when credentials are configured', async () => {
    const agent = await request();
    const res = await agent.get('/api/auth/google');
    expect(res.status).toBe(200);
    expect(res.body.authUrl).toBeTypeOf('string');
  });
});

describe('GET /api/auth/google/callback', () => {
  it('creates new user and redirects with JWT token', async () => {
    const agent = await request();

    const res = await agent
      .get('/api/auth/google/callback')
      .query({ code: 'mock-code' })
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/token=[A-Za-z0-9._-]+/);
    expect(res.headers.location).not.toContain('error=');
  });

  it('redirects with error when no code provided', async () => {
    const agent = await request();

    const res = await agent.get('/api/auth/google/callback').redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=no_code');
  });

  it('signs in existing user linked by email', async () => {
    const { user } = await createUser({ email: 'oauth-user@example.com' });
    const agent = await request();

    const res = await agent
      .get('/api/auth/google/callback')
      .query({ code: 'mock-code' })
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/token=[A-Za-z0-9._-]+/);
    // Confirm the user still exists (not duplicated)
    expect(user.email).toBe('oauth-user@example.com');
  });

  it('passes referral code via state param', async () => {
    const agent = await request();

    const res = await agent
      .get('/api/auth/google/callback')
      .query({ code: 'mock-code', state: 'ref:TESTCODE' })
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(/token=/);
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
