import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { request } from '../../helpers/app.js';
import { connectToMongoDB, closeConnection } from '../../../server/db/mongodb.js';

/**
 * Health endpoint contract tests.
 *
 * These run against the full Express app with an in-memory Mongo (no real VPS
 * connections), so they validate the HTTP contract — shape, status codes,
 * required fields — not the actual infra reachability.
 *
 * Complement with the real-infra smoke script in scripts/health-check.sh
 * when diagnosing a live VPS deployment.
 */

describe('GET /api/health', () => {
  it('returns 200 with status: ok', async () => {
    const agent = await request();
    const res = await agent.get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('response body contains required fields', async () => {
    const agent = await request();
    const { body } = await agent.get('/api/health');

    expect(body).toMatchObject({
      status: 'ok',
      message: expect.any(String),
      version: expect.stringMatching(/^\d+\.\d+\.\d+/),
      uptime: expect.any(Number),
    });
  });

  it('uptime is a non-negative integer (seconds)', async () => {
    const agent = await request();
    const { body } = await agent.get('/api/health');

    expect(body.uptime).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(body.uptime)).toBe(true);
  });

  it('env field reflects the current NODE_ENV', async () => {
    const agent = await request();
    const { body } = await agent.get('/api/health');

    // In the test harness NODE_ENV is set to 'test' by applyTestEnv()
    expect(body.env).toBe('test');
  });

  it('responds with application/json content-type', async () => {
    const agent = await request();
    const res = await agent.get('/api/health');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });

  it('does NOT require an Authorization header', async () => {
    // Health must be reachable by uptime monitors (no credentials)
    const agent = await request();
    const res = await agent.get('/api/health');
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });
});

// ---------------------------------------------------------------------------
// Database health sub-endpoint
// ---------------------------------------------------------------------------

// The health route uses the native MongoDB driver (getDb()), which requires
// connectToMongoDB() to have been called — separate from Prisma's lazy connect.
// We connect here using the MONGODB_URI set by startTestMongo() in setup.integration.ts.
beforeAll(async () => {
  await connectToMongoDB();
}, 30_000);

afterAll(async () => {
  await closeConnection();
});

describe('GET /api/health/db', () => {
  it('returns 200 and status: connected when Mongo is reachable', async () => {
    const agent = await request();
    // In-memory Mongo is started by setup.integration.ts — must be connected
    const res = await agent.get('/api/health/db');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('connected');
  });

  it('response includes database name and collections list', async () => {
    const agent = await request();
    const { body } = await agent.get('/api/health/db');

    expect(body.database).toBeTypeOf('string');
    expect(Array.isArray(body.collections)).toBe(true);
  });

  it('response includes storage stats with numeric values', async () => {
    const agent = await request();
    const { body } = await agent.get('/api/health/db');

    expect(body.stats).toBeDefined();
    expect(typeof body.stats.collections).toBe('number');
    expect(typeof body.stats.dataSize).toBe('number');
    expect(typeof body.stats.storageSize).toBe('number');
  });

  it('returns JSON content-type', async () => {
    const agent = await request();
    const res = await agent.get('/api/health/db');
    expect(res.headers['content-type']).toMatch(/application\/json/);
  });
});

// ---------------------------------------------------------------------------
// R2 storage health sub-endpoint
// ---------------------------------------------------------------------------

describe('GET /api/health/r2', () => {
  it('returns a JSON response (status 200 or 500)', async () => {
    // R2 credentials are not configured in the test environment.
    // We assert the endpoint responds gracefully rather than crashing the server.
    const agent = await request();
    const res = await agent.get('/api/health/r2');

    expect([200, 500]).toContain(res.status);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.status).toBeTypeOf('string');
  });

  it('reports not_configured or error when R2 env vars are absent', async () => {
    // Test environment has no R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / etc.
    const agent = await request();
    const res = await agent.get('/api/health/r2');
    const { body } = res;

    // Must always return a JSON object with a status string — never crash silently.
    expect(body.status).toBeTypeOf('string');

    if (body.status === 'not_configured') {
      // Route returned the structured "missing vars" report
      expect(body.missing).toBeDefined();
      const anyMissing = Object.values(body.missing as Record<string, boolean>).some(Boolean);
      expect(anyMissing).toBe(true);
    } else if (body.status === 'error') {
      // Dynamic import or AWS SDK threw — error field must be a non-empty string
      expect(body.error).toBeTypeOf('string');
    } else {
      // 'connected' is not expected in the test environment (no real R2 creds)
      // but if someone runs with real creds, accept it gracefully
      expect(body.status).toBe('connected');
    }
  });
});
