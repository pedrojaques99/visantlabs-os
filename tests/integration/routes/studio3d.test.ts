import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from '../../helpers/app.js';
import { signTestToken, bearer } from '../../helpers/auth.js';
import { createUser } from '../../factories/user.js';
import { prisma } from '../../../server/db/prisma.js';

// Mock the heavy GLB export service — geometry tracing/encoding is not under test
// here (it's covered by the service's own unit tests). We only assert the route
// wiring: auth, validation, and the success contract (binary GLB out).
vi.mock('../../../server/services/studio3dExportService.js', () => ({
  svgToGlb: vi.fn().mockResolvedValue(Buffer.from('GLB-MOCK-BYTES')),
}));

const VALID_SVG = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>';

async function createScene(userId: string, overrides: Record<string, any> = {}) {
  return prisma.studio3DScene.create({
    data: {
      userId,
      name: overrides.name ?? 'Test Scene',
      description: overrides.description ?? null,
      config: overrides.config ?? { material: 'metal', depth: 5 },
      svgData: overrides.svgData ?? VALID_SVG,
      inputMode: overrides.inputMode ?? 'svg',
      text: overrides.text ?? null,
      font: overrides.font ?? null,
      tags: overrides.tags ?? [],
      isPublic: overrides.isPublic ?? false,
      thumbnailUrl: overrides.thumbnailUrl ?? null,
    },
  });
}

describe('Studio3D Routes Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── POST /api/studio3d (create) ───────────────────────────────────────────

  describe('POST /api/studio3d', () => {
    it('creates a scene for an authenticated user', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/studio3d')
        .set('Authorization', bearer(token))
        .send({ name: 'My Scene', config: { material: 'metal', depth: 5 } });

      if (res.status !== 201) console.log('create error:', res.body);
      expect(res.status).toBe(201);
      expect(res.body.scene.name).toBe('My Scene');
      expect(res.body.scene._id).toBeDefined();
    });

    it('returns 401 without a token', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/studio3d')
        .send({ name: 'X', config: { material: 'metal' } });
      expect(res.status).toBe(401);
    });

    it('rejects missing name (400)', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/studio3d')
        .set('Authorization', bearer(token))
        .send({ config: { material: 'metal' } });
      expect(res.status).toBe(400);
    });

    // validateConfig — numeric bounds added in Phase 1.7
    it('rejects out-of-range numeric config (metalness > 1)', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/studio3d')
        .set('Authorization', bearer(token))
        .send({ name: 'Bad', config: { metalness: 5 } });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/metalness/i);
    });

    it('rejects non-finite numeric config (depth = Infinity-ish via string)', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      // JSON can't carry Infinity, but a non-number value must be rejected.
      const res = await agent
        .post('/api/studio3d')
        .set('Authorization', bearer(token))
        .send({ name: 'Bad', config: { depth: 'lots' } });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/depth/i);
    });

    it('rejects negative depth (below min)', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/studio3d')
        .set('Authorization', bearer(token))
        .send({ name: 'Bad', config: { depth: -1 } });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/depth/i);
    });

    it('rejects invalid enum (material)', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/studio3d')
        .set('Authorization', bearer(token))
        .send({ name: 'Bad', config: { material: 'unobtanium' } });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/material/i);
    });

    it('rejects invalid hex color', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/studio3d')
        .set('Authorization', bearer(token))
        .send({ name: 'Bad', config: { color: 'not-a-hex' } });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/color/i);
    });

    it('accepts a config with in-range numbers and valid enums', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/studio3d')
        .set('Authorization', bearer(token))
        .send({
          name: 'Good',
          config: {
            material: 'gold',
            depth: 10,
            metalness: 0.5,
            roughness: 0.2,
            color: '#ff8800',
            animate: 'spin',
          },
        });
      expect(res.status).toBe(201);
    });
  });

  // ─── GET /api/studio3d (list) ──────────────────────────────────────────────

  describe('GET /api/studio3d', () => {
    it('returns only the caller scenes', async () => {
      const { user } = await createUser();
      const { user: other } = await createUser();
      await createScene(user.id, { name: 'Mine' });
      await createScene(other.id, { name: 'Theirs' });
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent.get('/api/studio3d').set('Authorization', bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.scenes[0].name).toBe('Mine');
    });

    it('returns 401 without a token', async () => {
      const agent = await request();
      const res = await agent.get('/api/studio3d');
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /api/studio3d/:id ─────────────────────────────────────────────────

  describe('GET /api/studio3d/:id', () => {
    it('owner can read their private scene', async () => {
      const { user } = await createUser();
      const scene = await createScene(user.id);
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent.get(`/api/studio3d/${scene.id}`).set('Authorization', bearer(token));
      expect(res.status).toBe(200);
      expect(res.body.scene._id).toBe(scene.id);
    });

    it('private scene is 404 for a different user', async () => {
      const { user } = await createUser();
      const { user: other } = await createUser();
      const scene = await createScene(user.id, { isPublic: false });
      const token = signTestToken({ userId: other.id, email: other.email });

      const agent = await request();
      const res = await agent.get(`/api/studio3d/${scene.id}`).set('Authorization', bearer(token));
      expect(res.status).toBe(404);
    });

    it('public scene is readable without auth', async () => {
      const { user } = await createUser();
      const scene = await createScene(user.id, { isPublic: true });

      const agent = await request();
      const res = await agent.get(`/api/studio3d/${scene.id}`);
      expect(res.status).toBe(200);
      expect(res.body.scene._id).toBe(scene.id);
    });
  });

  // ─── GET /api/studio3d/public (gallery) ────────────────────────────────────

  describe('GET /api/studio3d/public', () => {
    it('lists only public scenes, with trimmed config', async () => {
      const { user } = await createUser();
      await createScene(user.id, { name: 'Public One', isPublic: true });
      await createScene(user.id, { name: 'Private One', isPublic: false });

      const agent = await request();
      const res = await agent.get('/api/studio3d/public');
      expect(res.status).toBe(200);
      expect(res.body.scenes.length).toBe(1);
      expect(res.body.scenes[0].name).toBe('Public One');
      // Public gallery exposes only a trimmed config (no svgData / heavy fields).
      expect(res.body.scenes[0].config).toHaveProperty('material');
      expect(res.body.scenes[0]).not.toHaveProperty('svgData');
    });

    it('is reachable without authentication', async () => {
      const agent = await request();
      const res = await agent.get('/api/studio3d/public');
      expect(res.status).toBe(200);
    });
  });

  // ─── PATCH /api/studio3d/:id ───────────────────────────────────────────────

  describe('PATCH /api/studio3d/:id', () => {
    it('owner can update', async () => {
      const { user } = await createUser();
      const scene = await createScene(user.id, { name: 'Old' });
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .patch(`/api/studio3d/${scene.id}`)
        .set('Authorization', bearer(token))
        .send({ name: 'New' });
      expect(res.status).toBe(200);
      expect(res.body.scene.name).toBe('New');
    });

    it('non-owner gets 404', async () => {
      const { user } = await createUser();
      const { user: other } = await createUser();
      const scene = await createScene(user.id);
      const token = signTestToken({ userId: other.id, email: other.email });

      const agent = await request();
      const res = await agent
        .patch(`/api/studio3d/${scene.id}`)
        .set('Authorization', bearer(token))
        .send({ name: 'Hacked' });
      expect(res.status).toBe(404);
    });

    it('rejects out-of-range config on update', async () => {
      const { user } = await createUser();
      const scene = await createScene(user.id);
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .patch(`/api/studio3d/${scene.id}`)
        .set('Authorization', bearer(token))
        .send({ config: { roughness: 99 } });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/roughness/i);
    });
  });

  // ─── DELETE /api/studio3d/:id ──────────────────────────────────────────────

  describe('DELETE /api/studio3d/:id', () => {
    it('owner can delete', async () => {
      const { user } = await createUser();
      const scene = await createScene(user.id);
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .delete(`/api/studio3d/${scene.id}`)
        .set('Authorization', bearer(token));
      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);

      const gone = await prisma.studio3DScene.findUnique({ where: { id: scene.id } });
      expect(gone).toBeNull();
    });

    it('non-owner gets 404 and scene survives', async () => {
      const { user } = await createUser();
      const { user: other } = await createUser();
      const scene = await createScene(user.id);
      const token = signTestToken({ userId: other.id, email: other.email });

      const agent = await request();
      const res = await agent
        .delete(`/api/studio3d/${scene.id}`)
        .set('Authorization', bearer(token));
      expect(res.status).toBe(404);

      const survives = await prisma.studio3DScene.findUnique({ where: { id: scene.id } });
      expect(survives).not.toBeNull();
    });
  });

  // ─── POST /api/studio3d/:id/fork ───────────────────────────────────────────

  describe('POST /api/studio3d/:id/fork', () => {
    it('forks a public scene into the caller account', async () => {
      const { user: owner } = await createUser();
      const { user: forker } = await createUser();
      const source = await createScene(owner.id, { name: 'Original', isPublic: true });
      const token = signTestToken({ userId: forker.id, email: forker.email });

      const agent = await request();
      const res = await agent
        .post(`/api/studio3d/${source.id}/fork`)
        .set('Authorization', bearer(token));
      expect(res.status).toBe(201);
      expect(res.body.scene.name).toBe('Original (fork)');
      expect(res.body.scene.userId).toBe(forker.id);
      expect(res.body.scene.isPublic).toBe(false);
    });

    it('cannot fork a private scene owned by someone else (404)', async () => {
      const { user: owner } = await createUser();
      const { user: forker } = await createUser();
      const source = await createScene(owner.id, { isPublic: false });
      const token = signTestToken({ userId: forker.id, email: forker.email });

      const agent = await request();
      const res = await agent
        .post(`/api/studio3d/${source.id}/fork`)
        .set('Authorization', bearer(token));
      expect(res.status).toBe(404);
    });

    it('requires auth (401)', async () => {
      const { user: owner } = await createUser();
      const source = await createScene(owner.id, { isPublic: true });

      const agent = await request();
      const res = await agent.post(`/api/studio3d/${source.id}/fork`);
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/studio3d/export-glb ─────────────────────────────────────────

  describe('POST /api/studio3d/export-glb', () => {
    // Regression for Phase 1.1 — route was previously unauthenticated.
    it('returns 401 without a token', async () => {
      const agent = await request();
      const res = await agent.post('/api/studio3d/export-glb').send({ svgData: VALID_SVG });
      expect(res.status).toBe(401);
    });

    it('exports a GLB for an authenticated user with valid SVG', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/studio3d/export-glb')
        .set('Authorization', bearer(token))
        .buffer(true)
        .parse((resp, cb) => {
          const chunks: Buffer[] = [];
          resp.on('data', (c) => chunks.push(Buffer.from(c)));
          resp.on('end', () => cb(null, Buffer.concat(chunks)));
        })
        .send({ svgData: VALID_SVG });

      if (res.status !== 200) console.log('export error:', res.body);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('model/gltf-binary');
      expect(res.headers['content-disposition']).toContain('scene.glb');
      expect(Buffer.isBuffer(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it('rejects SVG containing a <script> tag (422)', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });

      const malicious = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>';
      const agent = await request();
      const res = await agent
        .post('/api/studio3d/export-glb')
        .set('Authorization', bearer(token))
        .send({ svgData: malicious });
      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/scripting/i);
    });

    it('rejects SVG containing an inline event handler (422)', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });

      const malicious =
        '<svg xmlns="http://www.w3.org/2000/svg"><rect onload="evil()" width="1" height="1"/></svg>';
      const agent = await request();
      const res = await agent
        .post('/api/studio3d/export-glb')
        .set('Authorization', bearer(token))
        .send({ svgData: malicious });
      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/scripting/i);
    });

    it('rejects an oversized SVG (>5MB) with 422', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });

      // Build a >5MB SVG string. Body parser limit is well above 5MB for this route's app,
      // so the explicit byte-size guard is what we exercise here.
      const filler = '<rect width="1" height="1"/>'.repeat(220_000); // ~5.9MB
      const bigSvg = `<svg xmlns="http://www.w3.org/2000/svg">${filler}</svg>`;
      const agent = await request();
      const res = await agent
        .post('/api/studio3d/export-glb')
        .set('Authorization', bearer(token))
        .send({ svgData: bigSvg });
      expect(res.status).toBe(422);
      expect(res.body.error).toMatch(/too large/i);
    });

    it('rejects a request with neither svgData nor image (400)', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/studio3d/export-glb')
        .set('Authorization', bearer(token))
        .send({});
      expect(res.status).toBe(400);
    });
  });

  // ─── Rate limits ───────────────────────────────────────────────────────────
  //
  // The export-glb limiter (10/min, keyed by userId) and the apiRateLimiter
  // (120/min) use express-rate-limit's default in-memory store, which is shared
  // across the cached app instance for the whole test file. Hammering it to
  // observe a 429 would poison the per-user counters for every other test in
  // this file (fileParallelism is off, one app instance). We therefore skip the
  // 429 assertion here — it's better covered by an isolated limiter unit test —
  // and instead assert the limiter is wired (standard rate-limit headers present).
  describe('rate limiting', () => {
    it('emits standard RateLimit headers on the export route (limiter wired)', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/studio3d/export-glb')
        .set('Authorization', bearer(token))
        .send({ svgData: VALID_SVG });

      // express-rate-limit standardHeaders: true → RateLimit-* present.
      const hasLimitHeader =
        res.headers['ratelimit-limit'] !== undefined ||
        res.headers['ratelimit'] !== undefined ||
        res.headers['ratelimit-policy'] !== undefined;
      expect(hasLimitHeader).toBe(true);
    });
  });
});
