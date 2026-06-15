import { describe, it, expect, vi, beforeAll } from 'vitest';

/**
 * Fast path do POST /render via Scene Package.
 *
 * Mockamos a camada de storage (Spaces) e a resolução de Drive pra exercitar o
 * caminho real de render do engine (renderScene + node-canvas) sem rede:
 *   - isSpacesConfigured → true (destrava o fast path)
 *   - uploadPublicAsset  → devolve uma URL fake (sem subir nada)
 *   - downloadAsset      → devolve os bytes WebP/PNG de uma camada sintética
 * O registro `psd_scenes` é semeado direto no Mongo in-memory do harness.
 */

// Bytes reais de imagens (geradas com node-canvas) que o adapter consegue decodar.
let layerBytes: Buffer;
let artBase64: string;

vi.mock('../../../server/services/spacesService.js', async () => {
  const actual = await vi.importActual<any>('../../../server/services/spacesService.js');
  return {
    ...actual,
    isSpacesConfigured: () => true,
    uploadPublicAsset: async (_buf: Buffer, key: string) => `https://cdn.test/${key}`,
    // sceneStore.downloadSceneAssets chama downloadAsset(key) por camada.
    downloadAsset: async () => layerBytes,
  };
});

// resolvePsdPath é usado pelo fast path indiretamente? Não — o fast path do
// service NÃO resolve Drive (só lê a scene do Mongo + assets do Spaces). Mas a
// rota /render não chama resolvePsdPath no fast path; o service decide. OK.

import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

async function seedScene(psdFileName: string) {
  const { connectToMongoDB, getDb } = await import('../../../server/db/mongodb.js');
  const { SCENES_COLLECTION } = await import('../../../server/services/sceneStore.js');
  await connectToMongoDB();
  const db = getDb();

  // Scene mínima: 40x40, uma base e uma face axis-aligned ocupando o doc todo.
  const doc = {
    version: 1,
    width: 40,
    height: 40,
    faces: [
      {
        key: 'FACE1',
        name: 'Frente',
        quad: null,
        origin: { left: 0, top: 0 },
        innerW: 40,
        innerH: 40,
      },
    ],
    layers: [
      { role: 'base', src: 'base-0', blendMode: 'source-over', opacity: 1, left: 0, top: 0 },
    ],
    warnings: [],
  };
  await db.collection(SCENES_COLLECTION).updateOne(
    { psdFileName },
    {
      $set: {
        psdFileName,
        hash: 'testhash000000000000000',
        basePath: 'scenes/testhash',
        doc,
        files: [{ ref: 'base-0', key: 'scenes/testhash/base-0.webp', bytes: layerBytes.length }],
        faces: [{ key: 'FACE1', name: 'Frente', innerW: 40, innerH: 40 }],
        warnings: [],
        width: 40,
        height: 40,
        bytes: layerBytes.length,
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
}

beforeAll(async () => {
  const { createCanvas } = await import('canvas');
  const base = createCanvas(40, 40);
  const bctx = base.getContext('2d');
  bctx.fillStyle = '#ffffff';
  bctx.fillRect(0, 0, 40, 40);
  layerBytes = base.toBuffer('image/png');

  const art = createCanvas(32, 32);
  const actx = art.getContext('2d');
  actx.fillStyle = '#ff0000';
  actx.fillRect(0, 0, 32, 32);
  artBase64 = art.toBuffer('image/png').toString('base64');
});

describe('POST /render — Scene Package fast path', () => {
  it('renders from the scene (engine: "scene") when a scene exists and forcePsd is not set', async () => {
    const psdFileName = 'fastpath-fixture.psd';
    await seedScene(psdFileName);

    const { user } = await createUser();
    const token = signTestToken({ userId: user.id, email: user.email });

    const agent = await request();
    const res = await agent
      .post('/api/psd-render/render')
      .set('Authorization', bearer(token))
      .send({ psdFileName, arts: [{ smartObject: '*', artBase64 }] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.engine).toBe('scene');
    expect(res.body.data.url).toMatch(/^https:\/\/cdn\.test\//);
    expect(res.body.data.replaced).toContain('Frente');
  });

  it('falls back (does not use scene) when forcePsd=true — render still attempts the PSD pipeline', async () => {
    const psdFileName = 'fastpath-fixture.psd';
    await seedScene(psdFileName);

    const { user } = await createUser();
    const token = signTestToken({ userId: user.id, email: user.email });

    const agent = await request();
    const res = await agent
      .post('/api/psd-render/render')
      .set('Authorization', bearer(token))
      .send({ psdFileName, arts: [{ smartObject: '*', artBase64 }], forcePsd: true });

    // forcePsd skips the scene; the PSD pipeline then fails to resolve the file
    // (no Drive in the harness) → a non-200 error, proving the scene was bypassed.
    expect(res.status).not.toBe(200);
    if (res.body?.data) expect(res.body.data.engine).not.toBe('scene');
  });
});
