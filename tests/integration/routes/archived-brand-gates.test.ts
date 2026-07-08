import { describe, it, expect } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { createBrandGuideline } from '../../factories/brandGuideline.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

// Money-bypass fix: an archived brand must never be usable to generate (it
// stopped consuming a billing slot, so it must also stop producing value).
// creative.ts and campaign.ts don't run through the shared checkSubscription
// middleware (see brand-quota.test.ts for that choke point) — they resolve
// the brand directly, so each route needs its own archived-brand guard.

function tokenFor(user: { id: string; email: string }) {
  return bearer(signTestToken({ userId: user.id, email: user.email }));
}

async function archiveBrand(brandId: string) {
  const { prisma } = await import('../../../server/db/prisma.js');
  await prisma.brandGuideline.update({
    where: { id: brandId },
    data: { status: 'archived', archivedAt: new Date() },
  });
}

describe('Archived brand guards — creative + campaign routes', () => {
  it('POST /api/creative/generate-from-brand → 403 brand_archived for an archived brand', async () => {
    const { user } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Archived Co' });
    await archiveBrand(guideline.id);
    const agent = await request();

    const res = await agent
      .post('/api/creative/generate-from-brand')
      .set('Authorization', tokenFor(user))
      .send({ brandId: guideline.id, intent: 'A poster' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('brand_archived');
    expect(res.body.reason).toBe('brand_archived');
  });

  it('POST /api/creative/generate-from-brand → 404 for a brand that does not belong to the user (unaffected by the archived fix)', async () => {
    const { user: owner } = await createUser();
    const { user: intruder } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: owner.id, name: 'Not Yours' });
    const agent = await request();

    const res = await agent
      .post('/api/creative/generate-from-brand')
      .set('Authorization', tokenFor(intruder))
      .send({ brandId: guideline.id, intent: 'A poster' });

    expect(res.status).toBe(404);
  });

  it('POST /api/canvas/generate-campaign → 403 brand_archived BEFORE charging credits', async () => {
    const { user } = await createUser();
    const { guideline } = await createBrandGuideline({
      userId: user.id,
      name: 'Archived Campaign Co',
    });
    await archiveBrand(guideline.id);
    const agent = await request();

    const { prisma } = await import('../../../server/db/prisma.js');
    const before = await prisma.user.findUnique({
      where: { id: user.id },
      select: { creditsUsed: true },
    });

    const res = await agent
      .post('/api/canvas/generate-campaign')
      .set('Authorization', tokenFor(user))
      .send({
        brandGuidelineId: guideline.id,
        productImageUrl: 'https://example.com/product.png',
        count: 1,
      });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('brand_archived');
    expect(res.body.reason).toBe('brand_archived');

    const after = await prisma.user.findUnique({
      where: { id: user.id },
      select: { creditsUsed: true },
    });
    expect(after?.creditsUsed ?? 0).toBe(before?.creditsUsed ?? 0); // no credits deducted
  });
});
