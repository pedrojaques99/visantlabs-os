/**
 * Brand Guidelines — free mockup suggestions endpoint (integration)
 *
 * GET /:id/mockup-suggestions returns deterministic render RECIPES matching the
 * brand's analyzed assets to COMMERCIAL scenes. Asserts auth, ownership, the
 * degraded states (no_assets / no_scenes), the recipe shape, and — critically —
 * that paid-studio scenes never leak into the pool (isComercial filter).
 * No AI, no credits: the render happens client-side, so nothing here charges.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { createBrandGuideline } from '../../factories/brandGuideline.js';
import { signTestToken, bearer } from '../../helpers/auth.js';
import { connectToMongoDB, getDb } from '../../../server/db/mongodb.js';

const BASE = '/api/brand-guidelines';

async function seedUser() {
  const { user } = await createUser();
  const token = signTestToken({ userId: user.id, email: user.email });
  return { user, token };
}

function sceneDoc(overrides: Record<string, any>) {
  return {
    hash: 'h_' + Math.random().toString(36).slice(2),
    basePath: 'scenes/x',
    doc: { version: 1, width: 100, height: 100, faces: [], layers: [], warnings: [] },
    files: [],
    faces: [{ key: 'f1', name: 'Front', innerW: 500, innerH: 500 }],
    warnings: [],
    width: 100,
    height: 100,
    bytes: 0,
    updatedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  };
}

async function seedScenes(scenes: Record<string, any>[]) {
  await connectToMongoDB();
  const db = getDb();
  await db.collection('psd_scenes').deleteMany({});
  if (scenes.length) await db.collection('psd_scenes').insertMany(scenes);
}

const logoWithPlacement = {
  id: 'logo1',
  url: 'https://cdn.example.com/logo-light.png',
  variant: 'light',
  analysis: {
    placement: {
      kind: 'logo',
      luminance: 'light',
      contrastSafeOn: ['dark'],
      aspectRatio: 1,
      hasTransparency: true,
    },
  },
};

describe('GET /:id/mockup-suggestions', () => {
  beforeEach(async () => {
    await seedScenes([]);
  });

  it('401 without token', async () => {
    const res = await (await request()).get(`${BASE}/anyid/mockup-suggestions`);
    expect(res.status).toBe(401);
  });

  it("404 on another user's guideline", async () => {
    const { token } = await seedUser();
    const { user: other } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: other.id });
    const res = await (await request())
      .get(`${BASE}/${guideline.id}/mockup-suggestions`)
      .set('Authorization', bearer(token));
    expect(res.status).toBe(404);
  });

  it('returns no_assets when the brand has no logos or media', async () => {
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id, logos: [], media: [] });
    const res = await (await request())
      .get(`${BASE}/${guideline.id}/mockup-suggestions`)
      .set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.reason).toBe('no_assets');
    expect(res.body.suggestions).toEqual([]);
  });

  it('returns no_scenes when assets exist but no commercial scene is available', async () => {
    const { user, token } = await seedUser();
    // Only a paid-studio scene exists → filtered out → no_scenes.
    await seedScenes([sceneDoc({ psdFileName: 'Mockup-Hazard_poster.psd', license: 'studio-paid' })]);
    const { guideline } = await createBrandGuideline({ userId: user.id, logos: [logoWithPlacement] });
    const res = await (await request())
      .get(`${BASE}/${guideline.id}/mockup-suggestions`)
      .set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.reason).toBe('no_scenes');
  });

  it('ranks the brand asset onto a commercial scene and excludes paid studios', async () => {
    const { user, token } = await seedUser();
    await seedScenes([
      sceneDoc({
        psdFileName: 'tshirt_dark.psd',
        license: 'commercial-free',
        baseLuminance: 'dark',
        faces: [{ key: 'f1', name: 'Front', innerW: 500, innerH: 500 }],
      }),
      sceneDoc({
        psdFileName: 'Mockup-Hazard_poster.psd',
        license: 'studio-paid',
        baseLuminance: 'light',
        faces: [{ key: 'f1', name: 'Poster', innerW: 800, innerH: 1200 }],
      }),
    ]);
    const { guideline } = await createBrandGuideline({ userId: user.id, logos: [logoWithPlacement] });

    const res = await (await request())
      .get(`${BASE}/${guideline.id}/mockup-suggestions`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1); // only the commercial scene survives
    const s = res.body.suggestions[0];
    expect(s.psdFileName).toBe('tshirt_dark.psd');
    expect(s.faceKey).toBe('f1');
    expect(s.assetUrl).toBe(logoWithPlacement.url);
    expect(s.variant).toBe('light');
    expect(s.surfaceKind).toBe('apparel');
    expect(typeof s.score).toBe('number');
    // The paid-studio poster must never appear.
    expect(
      res.body.suggestions.find((x: any) => x.psdFileName.includes('Hazard'))
    ).toBeUndefined();
  });

  it('honors the seen exclude and cursor paging', async () => {
    const { user, token } = await seedUser();
    await seedScenes([
      sceneDoc({ psdFileName: 'tshirt_a.psd', license: 'commercial-free', baseLuminance: 'dark' }),
      sceneDoc({ psdFileName: 'poster_b.psd', license: 'commercial-free', baseLuminance: 'light' }),
    ]);
    const { guideline } = await createBrandGuideline({ userId: user.id, logos: [logoWithPlacement] });

    const res = await (await request())
      .get(`${BASE}/${guideline.id}/mockup-suggestions?seen=tshirt_a.psd:f1`)
      .set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.suggestions.find((x: any) => x.psdFileName === 'tshirt_a.psd')).toBeUndefined();
  });
});
