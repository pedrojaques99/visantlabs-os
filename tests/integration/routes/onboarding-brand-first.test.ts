import { describe, it, expect } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { createBrandGuideline } from '../../factories/brandGuideline.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

// Must be set BEFORE the app/lib is used — brand quota enforcement is behind
// the flag, and the demo-doesn't-count-in-quota test depends on it.
process.env.FEATURE_BRAND_BILLING = 'true';

function tokenFor(user: { id: string; email: string }) {
  return bearer(signTestToken({ userId: user.id, email: user.email }));
}

describe('Fase 3 — onboarding brand-first (backend)', () => {
  // ── 3.4 completeOnboarding(category, brandGuidelineId?) ──────────────────

  it('complete-onboarding persists userCategory + brandGuidelineId (metadata)', async () => {
    const { user } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Mine' });
    const agent = await request();

    const res = await agent
      .post('/api/auth/complete-onboarding')
      .set('Authorization', tokenFor(user))
      .send({ userCategory: 'designer', brandGuidelineId: guideline.id });
    expect(res.status).toBe(200);

    const { prisma } = await import('../../../server/db/prisma.js');
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh?.onboardingCompleted).toBe(true);
    expect(fresh?.userCategory).toBe('designer');
    expect((fresh?.metadata as any)?.onboardingBrandGuidelineId).toBe(guideline.id);
  });

  it('complete-onboarding still works WITHOUT brandGuidelineId (backwards compatible)', async () => {
    const { user } = await createUser();
    const agent = await request();

    const res = await agent
      .post('/api/auth/complete-onboarding')
      .set('Authorization', tokenFor(user))
      .send({ userCategory: 'developer' });
    expect(res.status).toBe(200);

    const { prisma } = await import('../../../server/db/prisma.js');
    const fresh = await prisma.user.findUnique({ where: { id: user.id } });
    expect(fresh?.onboardingCompleted).toBe(true);
    expect((fresh?.metadata as any)?.onboardingBrandGuidelineId).toBeUndefined();
  });

  it("complete-onboarding rejects someone else's brand → 400", async () => {
    const { user: owner } = await createUser();
    const { user: intruder } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: owner.id, name: 'Foreign' });
    const agent = await request();

    const res = await agent
      .post('/api/auth/complete-onboarding')
      .set('Authorization', tokenFor(intruder))
      .send({ userCategory: 'agency', brandGuidelineId: guideline.id });
    expect(res.status).toBe(400);

    const { prisma } = await import('../../../server/db/prisma.js');
    const fresh = await prisma.user.findUnique({ where: { id: intruder.id } });
    expect(fresh?.onboardingCompleted).toBe(false);
  });

  // ── 3.2 Marca mínima (60s) ────────────────────────────────────────────────

  it('minimal brand {name, 2 colors, tone} → 201 and a usable brand context', async () => {
    const { user } = await createUser();
    const agent = await request();

    const res = await agent
      .post('/api/brand-guidelines')
      .set('Authorization', tokenFor(user))
      .send({
        identity: { name: 'Minimal Co' },
        colors: [
          { hex: '#112233', name: 'Ink', role: 'primary' },
          { hex: '#FFEEDD', name: 'Paper', role: 'background' },
        ],
        guidelines: { voice: 'Direct, warm and jargon-free.' },
      });
    expect(res.status).toBe(201);
    const guideline = res.body.guideline;
    expect(guideline.id).toBeTruthy();

    // The minimal payload must survive every brand-context path used by
    // generation (mockups, plugin, MCP) without throwing.
    const { buildBrandContext, buildBrandContextForImageGen, buildBrandContextJSON } =
      await import('../../../server/lib/brandContextBuilder.js');

    const full = buildBrandContext(guideline as any);
    expect(full).toContain('Minimal Co');
    expect(full).toContain('#112233');

    const imageGen = buildBrandContextForImageGen(guideline as any);
    expect(imageGen).toContain('Minimal Co');

    const json = buildBrandContextJSON(guideline as any);
    expect(json.brand.name).toBe('Minimal Co');
    expect(json.colors.map((c) => c.hex)).toContain('#112233');
    expect(json.voice?.tone).toContain('jargon-free');
  });

  // ── 3.3 Demo brand ────────────────────────────────────────────────────────

  it('POST /demo clones the seed brand with isDemo:true and is idempotent', async () => {
    const { user } = await createUser();
    const agent = await request();

    const first = await agent
      .post('/api/brand-guidelines/demo')
      .set('Authorization', tokenFor(user));
    expect(first.status).toBe(201);
    expect(first.body.created).toBe(true);
    expect(first.body.guideline.isDemo).toBe(true);
    expect(first.body.guideline.identity.name).toBe('Aurora Coffee');
    // Complete enough to generate well: palette + typography + voice present.
    expect(first.body.guideline.colors.length).toBeGreaterThanOrEqual(2);
    expect(first.body.guideline.typography.length).toBeGreaterThanOrEqual(1);
    expect(first.body.guideline.guidelines.voice).toBeTruthy();

    const again = await agent
      .post('/api/brand-guidelines/demo')
      .set('Authorization', tokenFor(user));
    expect(again.status).toBe(200);
    expect(again.body.created).toBe(false);
    expect(again.body.guideline.id).toBe(first.body.guideline.id);

    // Demo brand context is valid for generation too.
    const { buildBrandContextForImageGen } =
      await import('../../../server/lib/brandContextBuilder.js');
    expect(buildBrandContextForImageGen(first.body.guideline as any)).toContain('Aurora Coffee');
  });

  it('demo brand does NOT count toward the brand quota (free limit 1 still available)', async () => {
    const { user } = await createUser();
    const agent = await request();

    // Demo first (skip path) — must not consume the single free slot.
    const demo = await agent
      .post('/api/brand-guidelines/demo')
      .set('Authorization', tokenFor(user));
    expect(demo.status).toBe(201);

    // Real brand still fits in the free limit of 1.
    const real = await agent
      .post('/api/brand-guidelines')
      .set('Authorization', tokenFor(user))
      .send({ identity: { name: 'Real Brand' } });
    expect(real.status).toBe(201);

    // A second REAL brand exceeds the limit — used counts only the real one.
    const second = await agent
      .post('/api/brand-guidelines')
      .set('Authorization', tokenFor(user))
      .send({ identity: { name: 'Too Many' } });
    expect(second.status).toBe(402);
    expect(second.body.error).toBe('brand_limit');
    expect(second.body.used).toBe(1); // demo excluded from the count
    expect(second.body.max).toBe(1);
  });

  // ── 3.7 Eventos de funil (§3.3) ──────────────────────────────────────────

  it('POST /api/analytics/events stores onboarding_step in canvas_events', async () => {
    const { user } = await createUser();
    const agent = await request();

    const res = await agent
      .post('/api/analytics/events')
      .set('Authorization', tokenFor(user))
      .send({
        events: [
          {
            event: 'onboarding_step',
            meta: { step: 'bring_your_brand', persona: 'designer', skipped: false },
            ts: Date.now(),
          },
        ],
      });
    expect(res.status).toBe(204);

    const { connectToMongoDB, getDb } = await import('../../../server/db/mongodb.js');
    await connectToMongoDB();
    const db = getDb();
    const doc = await db
      .collection('canvas_events')
      .findOne({ event: 'onboarding_step', userId: user.id });
    expect(doc).toBeTruthy();
    expect(doc?.meta?.step).toBe('bring_your_brand');
    expect(doc?.meta?.persona).toBe('designer');
  });

  it('POST /api/analytics/events rejects unknown event names → 400', async () => {
    const agent = await request();
    const res = await agent
      .post('/api/analytics/events')
      .send({ events: [{ event: 'totally_made_up' }] });
    expect(res.status).toBe(400);
  });

  it('createUsageRecord enriches generation records with onBrand + surface', async () => {
    const { createUsageRecord } = await import('../../../server/utils/usageTracking.js');

    const onBrand = createUsageRecord(
      'u1',
      1,
      'gemini-test-model',
      false,
      10,
      undefined,
      'mockupmachine',
      'system',
      undefined,
      undefined,
      'brand123',
      'mcp'
    );
    expect(onBrand.onBrand).toBe(true);
    expect(onBrand.brandGuidelineId).toBe('brand123');
    expect(onBrand.surface).toBe('mcp');

    // Defaults: no brand → offBrand, surface 'ui'; existing callers unaffected.
    const offBrand = createUsageRecord('u1', 1, 'gemini-test-model', false);
    expect(offBrand.onBrand).toBe(false);
    expect(offBrand.brandGuidelineId).toBeUndefined();
    expect(offBrand.surface).toBe('ui');
  });

  // ── 3.6 Checklist v2 — GET /api/users/onboarding-progress ────────────────

  it('onboarding-progress derives state from existing data (no new state)', async () => {
    const { user } = await createUser();
    const agent = await request();
    const auth = tokenFor(user);
    const { prisma } = await import('../../../server/db/prisma.js');

    // Fresh user: everything false.
    let res = await agent.get('/api/users/onboarding-progress').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      hasRealBrand: false,
      hasOnBrandGeneration: false,
      hasConnectedAgent: false,
    });

    // Demo brand alone does NOT satisfy hasRealBrand.
    await agent.post('/api/brand-guidelines/demo').set('Authorization', auth);
    res = await agent.get('/api/users/onboarding-progress').set('Authorization', auth);
    expect(res.body.hasRealBrand).toBe(false);

    // Real brand flips hasRealBrand.
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Real' });
    res = await agent.get('/api/users/onboarding-progress').set('Authorization', auth);
    expect(res.body.hasRealBrand).toBe(true);
    expect(res.body.hasOnBrandGeneration).toBe(false);

    // A generation linked to a brand flips hasOnBrandGeneration.
    await prisma.mockup.create({
      data: { userId: user.id, prompt: 'on-brand poster', brandGuidelineId: guideline.id },
    });
    res = await agent.get('/api/users/onboarding-progress').set('Authorization', auth);
    expect(res.body.hasOnBrandGeneration).toBe(true);

    // An active API key flips hasConnectedAgent.
    await prisma.apiKey.create({
      data: {
        userId: user.id,
        keyHash: `test-hash-${user.id}`,
        keyPrefix: 'visant_sk_test',
        name: 'Test Agent',
        scopes: ['read'],
        active: true,
      },
    });
    res = await agent.get('/api/users/onboarding-progress').set('Authorization', auth);
    expect(res.body.hasConnectedAgent).toBe(true);
  });

  it('archived real brand no longer counts as hasRealBrand', async () => {
    const { user } = await createUser();
    const agent = await request();
    const auth = tokenFor(user);
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Solo' });

    await agent.post(`/api/brand-guidelines/${guideline.id}/archive`).set('Authorization', auth);

    const res = await agent.get('/api/users/onboarding-progress').set('Authorization', auth);
    expect(res.body.hasRealBrand).toBe(false);
  });
});
