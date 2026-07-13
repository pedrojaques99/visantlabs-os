import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { createBrandGuideline } from '../../factories/brandGuideline.js';

// Regression test for the MCP brand-injection bug.
//
// `creative-generate` / `creative-full` POST to /api/creative/plan with
// `{ prompt, format, brandGuidelineId }` and an `x-mcp-user-id` header. The
// route used to destructure only `brandGuideline` (the full object), so
// `brandGuidelineId` was silently dropped and planFromBrand got `null` — zero
// brand context. The route now resolves the user-owned brand from Prisma via
// `optionalAuthenticate` + the id and passes it through.
//
// We keep the real Prisma (in-memory Mongo) so the actual ownership lookup runs,
// and mock only planFromBrand so we can (a) avoid the network Gemini call and
// (b) capture exactly what brandGuideline the route handed it.
const planFromBrand = vi.fn(async (_args: any) => ({
  plan: { format: '1:1', layers: [] },
  pickedMedia: null,
}));

vi.mock('../../../server/lib/creative-plan-engine.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../server/lib/creative-plan-engine.js')>();
  return {
    ...actual,
    planFromBrand: (args: any) => planFromBrand(args),
  };
});

describe('POST /api/creative/plan — MCP brand injection (brandGuidelineId)', () => {
  beforeEach(() => {
    planFromBrand.mockClear();
  });

  it('resolves the user-owned brand from brandGuidelineId and passes it to planFromBrand', async () => {
    const { user } = await createUser();
    const { guideline } = await createBrandGuideline({
      userId: user.id,
      name: 'Injected Brand',
    });

    const agent = await request();
    const res = await agent
      .post('/api/creative/plan')
      .set('x-mcp-user-id', user.id)
      .send({ prompt: 'A launch post', format: '1:1', brandGuidelineId: guideline.id });

    expect(res.status).toBe(200);
    expect(planFromBrand).toHaveBeenCalledTimes(1);

    const passedBrand = planFromBrand.mock.calls[0][0].brandGuideline;
    expect(passedBrand).not.toBeNull();
    expect(passedBrand.id).toBe(guideline.id);
    expect((passedBrand.identity as any)?.name).toBe('Injected Brand');
  });

  it('does not leak a brand owned by another user', async () => {
    const { user: owner } = await createUser();
    const { user: stranger } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: owner.id });

    const agent = await request();
    const res = await agent
      .post('/api/creative/plan')
      .set('x-mcp-user-id', stranger.id)
      .send({ prompt: 'A post', format: '1:1', brandGuidelineId: guideline.id });

    expect(res.status).toBe(200);
    expect(planFromBrand).toHaveBeenCalledTimes(1);
    // Not owned by the caller → not resolved → null (current fallback behavior).
    expect(planFromBrand.mock.calls[0][0].brandGuideline).toBeNull();
  });
});
