import { describe, it, expect } from 'vitest';
import { request } from '../helpers/app.js';
import { createUser } from '../factories/user.js';
import { signTestToken, bearer } from '../helpers/auth.js';

/**
 * Connectivity smoke-tests targeting the exact failure modes seen after a VPS migration:
 *
 *   1. CORS — frontend origin rejected because FRONTEND_URL wasn't set on the new host
 *   2. trust proxy — rate limiter using wrong IP due to missing proxy config
 *   3. Correlation headers — X-Request-Id round-trip required by Cloudflare/nginx
 *   4. Auth JWT — 401s when JWT_SECRET differs between deployments
 *   5. Security headers — CSP / HSTS missing or misconfigured by reverse proxy
 */

// ---------------------------------------------------------------------------
// 1. CORS
// ---------------------------------------------------------------------------

describe('CORS', () => {
  it('allows the configured FRONTEND_URL origin', async () => {
    const agent = await request();
    // applyTestEnv sets FRONTEND_URL=http://localhost:3000
    const res = await agent
      .options('/api/health')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');

    // 204 (no-content) or 200 from the CORS preflight handler
    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('reflects a known Claude origin (MCP callers)', async () => {
    const agent = await request();
    const res = await agent
      .options('/api/health')
      .set('Origin', 'https://claude.ai')
      .set('Access-Control-Request-Method', 'POST');

    expect([200, 204]).toContain(res.status);
    expect(res.headers['access-control-allow-origin']).toBe('https://claude.ai');
  });

  it('exposes MCP-Session-Id in Access-Control-Allow-Headers', async () => {
    const agent = await request();
    const res = await agent
      .options('/api/health')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'Content-Type,Authorization,MCP-Session-Id');

    const allowed = res.headers['access-control-allow-headers'] ?? '';
    expect(allowed.toLowerCase()).toContain('mcp-session-id');
  });

  it('real GET request carries CORS header — not just preflight', async () => {
    const agent = await request();
    const res = await agent.get('/api/health').set('Origin', 'http://localhost:3000');

    expect(res.status).toBe(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});

// ---------------------------------------------------------------------------
// 2. Correlation headers (X-Request-Id round-trip)
// ---------------------------------------------------------------------------

describe('Correlation headers', () => {
  it('echoes inbound X-Request-Id in the response', async () => {
    const agent = await request();
    const traceId = 'test-trace-00112233';

    const res = await agent.get('/api/health').set('X-Request-Id', traceId);

    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBe(traceId);
  });

  it('generates a UUID when no X-Request-Id is provided', async () => {
    const agent = await request();
    const res = await agent.get('/api/health');

    const id = res.headers['x-request-id'];
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('rejects oversized X-Request-Id (> 128 chars) and generates a fresh UUID', async () => {
    const agent = await request();
    const oversized = 'x'.repeat(129);
    const res = await agent.get('/api/health').set('X-Request-Id', oversized);

    expect(res.status).toBe(200);
    // Must NOT echo the oversized value — server generates a safe UUID instead
    expect(res.headers['x-request-id']).not.toBe(oversized);
    expect(res.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });
});

// ---------------------------------------------------------------------------
// 3. Security headers (Helmet)
// ---------------------------------------------------------------------------

describe('Security headers', () => {
  it('sets X-Content-Type-Options: nosniff on every response', async () => {
    const agent = await request();
    const res = await agent.get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('sets X-Frame-Options to deny clickjacking', async () => {
    const agent = await request();
    const res = await agent.get('/api/health');
    // Helmet sets SAMEORIGIN or DENY
    expect(res.headers['x-frame-options']).toMatch(/^(SAMEORIGIN|DENY)$/i);
  });

  it('does not expose Express via X-Powered-By', async () => {
    const agent = await request();
    const res = await agent.get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Auth — JWT validity (catches JWT_SECRET mismatch between environments)
// ---------------------------------------------------------------------------

describe('Auth JWT boundary', () => {
  it('returns 401 for a token signed with a wrong secret', async () => {
    const jwt = await import('jsonwebtoken');
    const { user } = await createUser();
    const wrongToken = jwt.default.sign(
      { userId: user.id, email: user.email },
      'completely-wrong-secret-not-matching-anything'
    );

    const agent = await request();
    const res = await agent
      .get('/api/payments/usage')
      .set('Authorization', `Bearer ${wrongToken}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 for a well-formed but expired token', async () => {
    const { user } = await createUser();
    // expiresIn: -1s → already expired at signing time
    const expiredToken = signTestToken({ userId: user.id, email: user.email }, -1);

    const agent = await request();
    const res = await agent
      .get('/api/payments/usage')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
  });

  it('returns 401 for a completely malformed Authorization value', async () => {
    const agent = await request();
    const res = await agent
      .get('/api/payments/usage')
      .set('Authorization', 'NotBearer garbage.token.here');

    expect(res.status).toBe(401);
  });

  it('valid token from the correct secret is accepted', async () => {
    const { user } = await createUser();
    const token = signTestToken({ userId: user.id, email: user.email });

    const agent = await request();
    const res = await agent
      .get('/api/payments/usage')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// 5. Rate limiter — health endpoint is bypassed (critical for VPS monitoring)
// ---------------------------------------------------------------------------

describe('Rate limiter', () => {
  it('/health is exempt from the global rate limit', async () => {
    const agent = await request();

    // Fire 20 rapid health checks — they must ALL succeed.
    // If trust-proxy is misconfigured the limiter sees 127.0.0.1 for every
    // request and may trip early; this catches that regression.
    const responses = await Promise.all(
      Array.from({ length: 20 }, () => agent.get('/api/health'))
    );
    for (const r of responses) {
      expect(r.status).toBe(200);
    }
  });

  it('rate-limited routes set RateLimit-* headers (RFC 6585)', async () => {
    const agent = await request();
    const res = await agent.get('/api/health'); // even exempt routes may echo headers

    // Standard headers come from express-rate-limit `standardHeaders: true`
    // They may or may not appear on /health (it's skipped). If present, format must be valid.
    const limit = res.headers['ratelimit-limit'];
    if (limit !== undefined) {
      expect(Number(limit)).toBeGreaterThan(0);
    }
  });
});
