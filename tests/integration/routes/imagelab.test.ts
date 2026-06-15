import { describe, it, expect, vi, beforeEach } from 'vitest';
// Raise the generative rate limit so the suite's many generative POSTs don't trip
// the per-IP limiter (all tests share 127.0.0.1). Must be set before the router
// module evaluates the limiter at import time.
process.env.RATE_LIMIT_MAX_GENERATIVE = '1000';
import { request } from '../../helpers/app.js';
import { signTestToken, bearer } from '../../helpers/auth.js';
import { createUser } from '../../factories/user.js';

// ─── Mock the heavy imageLab service ─────────────────────────────────────────
// headless-gl / @napi-rs/canvas are not guaranteed in CI; mock at the module
// boundary so the route wiring (auth, validation, success contract) is what's
// under test. imageLabListPresets stays a light pure function we can fake.
const mockApplyEffect = vi.fn();
const mockApplyShader = vi.fn();
const mockChain = vi.fn();
const mockListPresets = vi.fn();

vi.mock('../../../server/services/imageLab/index.js', () => ({
  imageLabApplyEffect: (...args: any[]) => mockApplyEffect(...args),
  imageLabApplyShader: (...args: any[]) => mockApplyShader(...args),
  imageLabChain: (...args: any[]) => mockChain(...args),
  imageLabListPresets: (...args: any[]) => mockListPresets(...args),
}));

// ─── Mock generative/inpaint/background services (credit-charged paths) ──────
const mockGenerativeExpand = vi.fn();
const mockInpaint = vi.fn();
const mockRemoveBackground = vi.fn();

vi.mock('../../../server/services/generativeExpandService.js', () => ({
  generativeExpand: (...args: any[]) => mockGenerativeExpand(...args),
}));
vi.mock('../../../server/services/inpaintingService.js', () => ({
  inpaint: (...args: any[]) => mockInpaint(...args),
}));
vi.mock('../../../server/services/backgroundRemovalService.js', () => ({
  removeBackgroundFromImage: (...args: any[]) => mockRemoveBackground(...args),
}));

// ─── Mock credits so we can observe charge + refund without DB bookkeeping ───
const mockChargeCredits = vi.fn();
const mockRefund = vi.fn();

vi.mock('../../../server/lib/credits.js', () => ({
  chargeCredits: (...args: any[]) => mockChargeCredits(...args),
  refundCreditsWithRetry: (...args: any[]) => mockRefund(...args),
}));

// ─── In-memory Redis so the real async job logic (persist, poll, refund,
// orphan-reconcile in server/lib/imagelabJobs.ts) runs hermetically. The prod
// redisClient is a no-op when disconnected, which would make jobs invisible. ─
const redisStore = new Map<string, string>();
vi.mock('../../../server/lib/redis.js', () => ({
  redisClient: {
    setex: async (key: string, _ttl: number, value: string) => {
      redisStore.set(key, value);
      return 'OK';
    },
    get: async (key: string) => redisStore.get(key) ?? null,
    del: async (key: string) => (redisStore.delete(key) ? 1 : 0),
  },
}));

/** Poll the async job endpoint until it leaves a non-terminal state. */
async function pollUntilDone(agent: any, token: string, jobId: string) {
  for (let i = 0; i < 50; i++) {
    const res = await agent.get(`/api/imagelab/jobs/${jobId}`).set('Authorization', bearer(token));
    if (res.status !== 200) return res;
    if (res.body.status === 'done' || res.body.status === 'error') return res;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('Job did not reach a terminal state in time');
}

const PUBLIC_IMG = 'https://cdn.example.com/photo.png';

async function authedUser() {
  const { user } = await createUser();
  const token = signTestToken({ userId: user.id, email: user.email });
  return { user, token };
}

describe('ImageLab Routes Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisStore.clear();
    // Default: a successful charge (1 credit from the monthly bucket).
    mockChargeCredits.mockResolvedValue({
      charged: true,
      creditsDeducted: 2,
      deductionSource: { fromEarned: 0, fromMonthly: 2 },
      reason: 'charged',
    });
    mockRefund.mockResolvedValue(undefined);
  });

  // ─── POST /apply-effect ────────────────────────────────────────────────────

  describe('POST /api/imagelab/apply-effect', () => {
    it('applies an effect for an authenticated user', async () => {
      const { token } = await authedUser();
      mockApplyEffect.mockResolvedValue({
        imageUrl: 'https://cdn.test/out.png',
        format: 'png',
        width: 100,
        height: 100,
        mode: 'halftone',
      });

      const agent = await request();
      const res = await agent
        .post('/api/imagelab/apply-effect')
        .set('Authorization', bearer(token))
        .send({ imageUrl: PUBLIC_IMG, mode: 'halftone' });

      expect(res.status).toBe(200);
      expect(res.body.imageUrl).toBe('https://cdn.test/out.png');
      expect(mockApplyEffect).toHaveBeenCalledOnce();
    });

    it('returns 401 without a token', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/imagelab/apply-effect')
        .send({ imageUrl: PUBLIC_IMG, mode: 'halftone' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when imageUrl or mode missing', async () => {
      const { token } = await authedUser();
      const agent = await request();
      const res = await agent
        .post('/api/imagelab/apply-effect')
        .set('Authorization', bearer(token))
        .send({ mode: 'halftone' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/imageUrl/i);
    });

    it('returns 501 when headless-gl is unavailable', async () => {
      const { token } = await authedUser();
      mockApplyEffect.mockRejectedValue(new Error('Riso rendering failed — headless-gl ...'));

      const agent = await request();
      const res = await agent
        .post('/api/imagelab/apply-effect')
        .set('Authorization', bearer(token))
        .send({ imageUrl: PUBLIC_IMG, mode: 'riso' });
      expect(res.status).toBe(501);
    });
  });

  // ─── POST /apply-shader ────────────────────────────────────────────────────

  describe('POST /api/imagelab/apply-shader', () => {
    it('applies a shader for an authenticated user', async () => {
      const { token } = await authedUser();
      mockApplyShader.mockResolvedValue({
        imageUrl: 'https://cdn.test/shader.png',
        format: 'png',
        width: 50,
        height: 50,
        mode: 'shader',
      });

      const agent = await request();
      const res = await agent
        .post('/api/imagelab/apply-shader')
        .set('Authorization', bearer(token))
        .send({ imageUrl: PUBLIC_IMG, shaderType: 'vhs' });
      expect(res.status).toBe(200);
      expect(res.body.imageUrl).toBe('https://cdn.test/shader.png');
    });

    it('returns 400 without shaderType', async () => {
      const { token } = await authedUser();
      const agent = await request();
      const res = await agent
        .post('/api/imagelab/apply-shader')
        .set('Authorization', bearer(token))
        .send({ imageUrl: PUBLIC_IMG });
      expect(res.status).toBe(400);
    });

    it('returns 401 without a token', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/imagelab/apply-shader')
        .send({ imageUrl: PUBLIC_IMG, shaderType: 'vhs' });
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /chain ───────────────────────────────────────────────────────────

  describe('POST /api/imagelab/chain', () => {
    it('chains effect + shader', async () => {
      const { token } = await authedUser();
      mockChain.mockResolvedValue({
        imageUrl: 'https://cdn.test/chained.png',
        format: 'png',
        width: 10,
        height: 10,
      });

      const agent = await request();
      const res = await agent
        .post('/api/imagelab/chain')
        .set('Authorization', bearer(token))
        .send({
          imageUrl: PUBLIC_IMG,
          effect: { mode: 'halftone' },
          shader: { shaderType: 'vhs' },
        });
      expect(res.status).toBe(200);
      expect(res.body.imageUrl).toBe('https://cdn.test/chained.png');
      expect(mockChain).toHaveBeenCalledOnce();
    });

    it('returns 400 without imageUrl', async () => {
      const { token } = await authedUser();
      const agent = await request();
      const res = await agent
        .post('/api/imagelab/chain')
        .set('Authorization', bearer(token))
        .send({ effect: { mode: 'halftone' } });
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /presets (public) ─────────────────────────────────────────────────

  describe('GET /api/imagelab/presets', () => {
    it('returns presets for a mode without authentication', async () => {
      mockListPresets.mockReturnValue({ dots: { frequency: 40 } });
      const agent = await request();
      const res = await agent.get('/api/imagelab/presets?mode=halftone');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('dots');
      expect(mockListPresets).toHaveBeenCalledWith('halftone');
    });

    it('returns 400 when mode query param is missing', async () => {
      const agent = await request();
      const res = await agent.get('/api/imagelab/presets');
      expect(res.status).toBe(400);
    });
  });

  // ─── Credit charge + refund (Phase 1.3 regression) ─────────────────────────

  describe('POST /api/imagelab/generative-expand — charge + refund', () => {
    it('charges credits and returns the result on success', async () => {
      const { user, token } = await authedUser();
      mockGenerativeExpand.mockResolvedValue({ imageUrl: 'https://cdn.test/expanded.png' });

      const agent = await request();
      const res = await agent
        .post('/api/imagelab/generative-expand')
        .set('Authorization', bearer(token))
        .send({ imageUrl: PUBLIC_IMG, direction: 'right' });

      expect(res.status).toBe(200);
      expect(mockChargeCredits).toHaveBeenCalledWith(user.id, 2);
      // No failure → no refund.
      expect(mockRefund).not.toHaveBeenCalled();
    });

    it('refunds credits when the operation fails AFTER charging', async () => {
      const { user, token } = await authedUser();
      mockGenerativeExpand.mockRejectedValue(new Error('upstream model exploded'));

      const agent = await request();
      const res = await agent
        .post('/api/imagelab/generative-expand')
        .set('Authorization', bearer(token))
        .send({ imageUrl: PUBLIC_IMG, direction: 'right' });

      // Error bubbles to the global error handler (5xx), but credits are refunded.
      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(mockChargeCredits).toHaveBeenCalledWith(user.id, 2);
      expect(mockRefund).toHaveBeenCalledOnce();
      expect(mockRefund).toHaveBeenCalledWith(user.id, 2, { fromEarned: 0, fromMonthly: 2 });
    });

    it('does NOT refund when nothing was charged (e.g. admin/unlimited)', async () => {
      const { token } = await authedUser();
      mockChargeCredits.mockResolvedValue({
        charged: false,
        creditsDeducted: 0,
        deductionSource: { fromEarned: 0, fromMonthly: 0 },
        reason: 'admin',
      });
      mockGenerativeExpand.mockRejectedValue(new Error('boom'));

      const agent = await request();
      const res = await agent
        .post('/api/imagelab/generative-expand')
        .set('Authorization', bearer(token))
        .send({ imageUrl: PUBLIC_IMG, direction: 'right' });

      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(mockRefund).not.toHaveBeenCalled();
    });

    it('returns 400 without imageUrl', async () => {
      const { token } = await authedUser();
      const agent = await request();
      const res = await agent
        .post('/api/imagelab/generative-expand')
        .set('Authorization', bearer(token))
        .send({ direction: 'right' });
      expect(res.status).toBe(400);
      // Validation happens before charging.
      expect(mockChargeCredits).not.toHaveBeenCalled();
    });

    it('returns 401 without a token', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/imagelab/generative-expand')
        .send({ imageUrl: PUBLIC_IMG });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/imagelab/inpaint — charge + refund', () => {
    it('refunds credits when inpaint fails after charge', async () => {
      const { user, token } = await authedUser();
      mockInpaint.mockRejectedValue(new Error('inpaint failed'));

      const agent = await request();
      const res = await agent
        .post('/api/imagelab/inpaint')
        .set('Authorization', bearer(token))
        .send({ imageUrl: PUBLIC_IMG, mode: 'remove', maskRegion: { x: 0, y: 0, w: 1, h: 1 } });

      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(mockRefund).toHaveBeenCalledOnce();
    });

    it('returns 400 for invalid mode', async () => {
      const { token } = await authedUser();
      const agent = await request();
      const res = await agent
        .post('/api/imagelab/inpaint')
        .set('Authorization', bearer(token))
        .send({ imageUrl: PUBLIC_IMG, mode: 'bogus', maskRegion: {} });
      expect(res.status).toBe(400);
      expect(mockChargeCredits).not.toHaveBeenCalled();
    });

    it('returns 400 when neither mask is provided', async () => {
      const { token } = await authedUser();
      const agent = await request();
      const res = await agent
        .post('/api/imagelab/inpaint')
        .set('Authorization', bearer(token))
        .send({ imageUrl: PUBLIC_IMG, mode: 'remove' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/imagelab/remove-background — charge + refund', () => {
    it('refunds credits when background removal fails after charge', async () => {
      const { token } = await authedUser();
      mockRemoveBackground.mockRejectedValue(new Error('bg removal failed'));

      const agent = await request();
      const res = await agent
        .post('/api/imagelab/remove-background')
        .set('Authorization', bearer(token))
        .send({ imageUrl: PUBLIC_IMG });

      expect(res.status).toBeGreaterThanOrEqual(500);
      expect(mockRefund).toHaveBeenCalledOnce();
    });

    it('charges 1 credit and returns result on success', async () => {
      const { user, token } = await authedUser();
      mockChargeCredits.mockResolvedValue({
        charged: true,
        creditsDeducted: 1,
        deductionSource: { fromEarned: 0, fromMonthly: 1 },
        reason: 'charged',
      });
      mockRemoveBackground.mockResolvedValue({ imageUrl: 'https://cdn.test/nobg.png' });

      const agent = await request();
      const res = await agent
        .post('/api/imagelab/remove-background')
        .set('Authorization', bearer(token))
        .send({ imageUrl: PUBLIC_IMG });

      expect(res.status).toBe(200);
      expect(mockChargeCredits).toHaveBeenCalledWith(user.id, 1);
      expect(mockRefund).not.toHaveBeenCalled();
    });
  });

  // ─── Async job queue (async: true) ─────────────────────────────────────────

  describe('Async generative job queue', () => {
    it('generative-expand async: creates a job (202 + jobId) and polls to done', async () => {
      const { user, token } = await authedUser();
      mockGenerativeExpand.mockResolvedValue({
        imageUrl: 'https://cdn.test/expanded.png',
        base64: 'AAAA',
      });

      const agent = await request();
      const create = await agent
        .post('/api/imagelab/generative-expand')
        .set('Authorization', bearer(token))
        .send({ imageUrl: PUBLIC_IMG, direction: 'right', async: true });

      expect(create.status).toBe(202);
      expect(create.body.jobId).toBeTruthy();
      expect(create.body.status).toBe('pending');
      expect(mockChargeCredits).toHaveBeenCalledWith(user.id, 2);

      const done = await pollUntilDone(agent, token, create.body.jobId);
      expect(done.status).toBe(200);
      expect(done.body.status).toBe('done');
      expect(done.body.kind).toBe('generative-expand');
      expect(done.body.result.imageUrl).toBe('https://cdn.test/expanded.png');
      expect(mockRefund).not.toHaveBeenCalled();
    });

    it('inpaint async: job ends as error and refunds credits on failure', async () => {
      const { user, token } = await authedUser();
      mockInpaint.mockRejectedValue(new Error('inpaint model exploded'));

      const agent = await request();
      const create = await agent
        .post('/api/imagelab/inpaint')
        .set('Authorization', bearer(token))
        .send({
          imageUrl: PUBLIC_IMG,
          mode: 'remove',
          maskRegion: { x: 0, y: 0, w: 1, h: 1 },
          async: true,
        });

      expect(create.status).toBe(202);

      const done = await pollUntilDone(agent, token, create.body.jobId);
      expect(done.body.status).toBe('error');
      expect(done.body.error).toMatch(/exploded/i);
      // Failure path refunds the exact charged amount/buckets once.
      expect(mockRefund).toHaveBeenCalledOnce();
      expect(mockRefund).toHaveBeenCalledWith(user.id, 2, { fromEarned: 0, fromMonthly: 2 });
    });

    it('returns 404 for an unknown job id', async () => {
      const { token } = await authedUser();
      const agent = await request();
      const res = await agent
        .get('/api/imagelab/jobs/does-not-exist')
        .set('Authorization', bearer(token));
      expect(res.status).toBe(404);
    });

    it('returns 403 when polling a job owned by another user', async () => {
      const owner = await authedUser();
      mockGenerativeExpand.mockResolvedValue({
        imageUrl: 'https://cdn.test/x.png',
        base64: 'AAAA',
      });

      const agent = await request();
      const create = await agent
        .post('/api/imagelab/generative-expand')
        .set('Authorization', bearer(owner.token))
        .send({ imageUrl: PUBLIC_IMG, direction: 'right', async: true });
      expect(create.status).toBe(202);

      const intruder = await authedUser();
      const res = await agent
        .get(`/api/imagelab/jobs/${create.body.jobId}`)
        .set('Authorization', bearer(intruder.token));
      expect(res.status).toBe(403);
    });

    it('returns 401 when polling without a token', async () => {
      const agent = await request();
      const res = await agent.get('/api/imagelab/jobs/whatever');
      expect(res.status).toBe(401);
    });
  });
});
