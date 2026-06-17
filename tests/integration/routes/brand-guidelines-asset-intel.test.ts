/**
 * Brand Guidelines — Asset Intelligence endpoints (integration)
 *
 * Covers the level-up endpoints: color-usage recompute, persona stock-photo
 * resolution, and asset visual analysis. Asserts auth, ownership isolation, and
 * the graceful-degradation contract (503 when a provider key is missing).
 * No network / AI calls — the happy paths of the underlying analyzers are unit-tested.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { createBrandGuideline } from '../../factories/brandGuideline.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

async function seedUser() {
  const { user } = await createUser();
  const token = signTestToken({ userId: user.id, email: user.email });
  return { user, token };
}

const BASE = '/api/brand-guidelines';

// ─── color-usage/recompute ──────────────────────────────────────────────────

describe('POST /:id/color-usage/recompute', () => {
  it('401 without token', async () => {
    const res = await (await request()).post(`${BASE}/anyid/color-usage/recompute`);
    expect(res.status).toBe(401);
  });

  it("404 on another user's guideline", async () => {
    const { token } = await seedUser();
    const { user: other } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: other.id });
    const res = await (await request())
      .post(`${BASE}/${guideline.id}/color-usage/recompute`)
      .set('Authorization', bearer(token));
    expect(res.status).toBe(404);
  });

  it('200 returns colors unchanged when there are no assets to analyze', async () => {
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({
      userId: user.id,
      colors: [{ name: 'Lava', hex: '#D4491B', role: 'primary' }],
      logos: [],
    });
    const res = await (await request())
      .post(`${BASE}/${guideline.id}/color-usage/recompute`)
      .set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.colors).toBeInstanceOf(Array);
    expect(res.body.colors[0].hex).toBe('#D4491B');
  });
});

// ─── personas/resolve-images ────────────────────────────────────────────────

describe('POST /:id/personas/resolve-images', () => {
  const ORIG = { u: process.env.UNSPLASH_ACCESS_KEY, p: process.env.PEXELS_API_KEY };
  beforeEach(() => {
    delete process.env.UNSPLASH_ACCESS_KEY;
    delete process.env.PEXELS_API_KEY;
  });
  afterEach(() => {
    if (ORIG.u) process.env.UNSPLASH_ACCESS_KEY = ORIG.u;
    if (ORIG.p) process.env.PEXELS_API_KEY = ORIG.p;
  });

  it('401 without token', async () => {
    const res = await (await request()).post(`${BASE}/anyid/personas/resolve-images`);
    expect(res.status).toBe(401);
  });

  it("404 on another user's guideline", async () => {
    const { token } = await seedUser();
    const { user: other } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: other.id });
    const res = await (await request())
      .post(`${BASE}/${guideline.id}/personas/resolve-images`)
      .set('Authorization', bearer(token));
    expect(res.status).toBe(404);
  });

  it('503 when no stock provider is configured', async () => {
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });
    const res = await (await request())
      .post(`${BASE}/${guideline.id}/personas/resolve-images`)
      .set('Authorization', bearer(token));
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('stock_provider_not_configured');
  });
});

// ─── assets/analyze ─────────────────────────────────────────────────────────

describe('POST /:id/assets/analyze', () => {
  const ORIG = {
    g: process.env.GEMINI_API_KEY,
    v: process.env.VITE_GEMINI_API_KEY,
    va: process.env.VITE_API_KEY,
  };
  beforeEach(() => {
    delete process.env.GEMINI_API_KEY;
    delete process.env.VITE_GEMINI_API_KEY;
    delete process.env.VITE_API_KEY;
  });
  afterEach(() => {
    if (ORIG.g) process.env.GEMINI_API_KEY = ORIG.g;
    if (ORIG.v) process.env.VITE_GEMINI_API_KEY = ORIG.v;
    if (ORIG.va) process.env.VITE_API_KEY = ORIG.va;
  });

  it('401 without token', async () => {
    const res = await (await request()).post(`${BASE}/anyid/assets/analyze`);
    expect(res.status).toBe(401);
  });

  it("404 on another user's guideline", async () => {
    const { token } = await seedUser();
    const { user: other } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: other.id });
    const res = await (await request())
      .post(`${BASE}/${guideline.id}/assets/analyze`)
      .set('Authorization', bearer(token));
    expect(res.status).toBe(404);
  });

  it('503 when no vision provider is configured', async () => {
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });
    const res = await (await request())
      .post(`${BASE}/${guideline.id}/assets/analyze`)
      .set('Authorization', bearer(token));
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('vision_not_configured');
  });
});
