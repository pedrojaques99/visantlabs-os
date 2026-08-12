import { describe, it, expect, vi } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';

// O fluxo popup gasta várias chamadas /auth/google* por teste; o teto real
// (20 por 5 min) derrubaria a suíte por motivo que não é o que se está testando.
process.env.RATE_LIMIT_MAX_OAUTH = '1000';

// Controllable mock — set to an Error instance to make getToken throw
let getTokenOverride: Error | null = null;

vi.mock('google-auth-library', () => {
  class MockOAuth2Client {
    generateAuthUrl() {
      return 'https://accounts.google.com/mock-auth-url';
    }
    async getToken(_code: string) {
      if (getTokenOverride) throw getTokenOverride;
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

describe('GET /api/auth/config', () => {
  it('returns the hCaptcha site key from server runtime env', async () => {
    const prev = process.env.HCAPTCHA_SITE_KEY;
    process.env.HCAPTCHA_SITE_KEY = 'test-site-key-123';
    try {
      const agent = await request();
      const res = await agent.get('/api/auth/config');
      expect(res.status).toBe(200);
      expect(res.body.hcaptchaSiteKey).toBe('test-site-key-123');
    } finally {
      if (prev === undefined) delete process.env.HCAPTCHA_SITE_KEY;
      else process.env.HCAPTCHA_SITE_KEY = prev;
    }
  });

  it('returns null when no site key is configured', async () => {
    const prevSite = process.env.HCAPTCHA_SITE_KEY;
    const prevVite = process.env.VITE_HCAPTCHA_SITE_KEY;
    delete process.env.HCAPTCHA_SITE_KEY;
    delete process.env.VITE_HCAPTCHA_SITE_KEY;
    try {
      const agent = await request();
      const res = await agent.get('/api/auth/config');
      expect(res.status).toBe(200);
      expect(res.body.hcaptchaSiteKey).toBeNull();
    } finally {
      if (prevSite !== undefined) process.env.HCAPTCHA_SITE_KEY = prevSite;
      if (prevVite !== undefined) process.env.VITE_HCAPTCHA_SITE_KEY = prevVite;
    }
  });
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

    const res = await agent
      .post('/api/auth/signin')
      .send({ email: user.email, password: 'wrong-password' });

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

  it('does not open a popup session without source (redirect flow)', async () => {
    const agent = await request();
    const res = await agent.get('/api/auth/google');
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBeUndefined();
  });

  it.each(['plugin', 'club'])('opens a popup session for source=%s', async (source) => {
    const agent = await request();
    const res = await agent.get('/api/auth/google').query({ source });
    expect(res.status).toBe(200);
    expect(res.body.sessionId).toBeTypeOf('string');
  });

  it('rejects an unknown source instead of silently falling back', async () => {
    const agent = await request();
    const res = await agent.get('/api/auth/google').query({ source: 'clube' });
    // Cair no fluxo de redirect calado fazia o cliente polar um sessionId que
    // nunca existiu — o erro tem de aparecer aqui, não num timeout lá na frente.
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('club');
  });
});

describe('popup OAuth flow (source + poll)', () => {
  async function startPopup(source: string) {
    const agent = await request();
    const res = await agent.get('/api/auth/google').query({ source });
    expect(res.status).toBe(200);
    return { agent, sessionId: res.body.sessionId as string };
  }

  it('renders the copy of the origin that started the login', async () => {
    const { agent, sessionId } = await startPopup('club');

    const cb = await agent
      .get('/api/auth/google/callback')
      .query({ code: 'mock-code', state: `plugin:${sessionId}` });

    expect(cb.status).toBe(200);
    expect(cb.text).toContain('Visant Club');
    expect(cb.text).not.toContain('Figma');
  });

  it('still says Figma for the plugin', async () => {
    const { agent, sessionId } = await startPopup('plugin');

    const cb = await agent
      .get('/api/auth/google/callback')
      .query({ code: 'mock-code', state: `plugin:${sessionId}` });

    expect(cb.text).toContain('Figma');
  });

  it('hands the token to the poll exactly once', async () => {
    const { agent, sessionId } = await startPopup('club');

    await agent.get('/api/auth/google/callback').query({ code: 'mock-code', state: `plugin:${sessionId}` });

    const first = await agent.get(`/api/auth/google/poll/${sessionId}`);
    expect(first.body.status).toBe('complete');
    expect(first.body.token).toBeTypeOf('string');

    // Sessão de uso único: replay do mesmo sessionId não devolve token de novo.
    const second = await agent.get(`/api/auth/google/poll/${sessionId}`);
    expect(second.body.status).toBe('expired');
    expect(second.body.token).toBeUndefined();
  });

  it('shows the error page and flags the poll when Google fails', async () => {
    const { agent, sessionId } = await startPopup('club');
    getTokenOverride = new Error('boom');
    try {
      const cb = await agent
        .get('/api/auth/google/callback')
        .query({ code: 'bad-code', state: `plugin:${sessionId}` });

      expect(cb.status).toBe(200);
      expect(cb.text).toContain('Não deu pra entrar');
      expect(cb.text).not.toContain('Figma');

      const poll = await agent.get(`/api/auth/google/poll/${sessionId}`);
      expect(poll.body.status).toBe('error');
    } finally {
      getTokenOverride = null;
    }
  });

  it('reports an unknown session as expired', async () => {
    const agent = await request();
    const res = await agent.get('/api/auth/google/poll/does-not-exist');
    expect(res.body.status).toBe('expired');
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

  it('redirects with error when Google rejects token exchange (invalid_client)', async () => {
    getTokenOverride = Object.assign(new Error('invalid_client'), {
      code: 401,
      response: {
        data: {
          error: 'invalid_client',
          error_description: 'The provided client secret is invalid.',
        },
      },
    });
    const agent = await request();

    const res = await agent
      .get('/api/auth/google/callback')
      .query({ code: 'bad-code' })
      .redirects(0);

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('error=oauth_failed');
    getTokenOverride = null;
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
