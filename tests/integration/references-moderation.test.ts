import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from '../helpers/app.js';
import { createUser, createAdmin } from '../factories/user.js';
import { signTestToken, bearer } from '../helpers/auth.js';

/**
 * Reference moderation flow — the safety-critical property is that a user upload
 * (status 'pending', unenriched) is INVISIBLE to the public feed until a human
 * approves it. These tests seed docs directly (the light phase's output shape)
 * and drive the real routes.
 */

async function seedRef(overrides: Record<string, any>) {
  const { connectToMongoDB, getDb } = await import('../../server/db/mongodb.js');
  await connectToMongoDB();
  const doc = {
    id: overrides.id,
    name: overrides.name || 'Ref',
    category: 'reference',
    referenceImageUrl: 'https://cdn.example.com/x.png',
    thumbnailUrl: 'https://cdn.example.com/x.png',
    dimensions: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  await getDb().collection('community_presets').insertOne(doc);
  return doc;
}

describe('reference moderation — visibility gate', () => {
  it('hides a pending user upload from the public feed', async () => {
    await seedRef({
      id: 'pending-1',
      userId: 'u1',
      isAdminCurated: false,
      status: 'pending',
      isApproved: false,
      isPublic: true, // opted in, but still not approved
      enriched: false,
    });

    const agent = await request();
    const res = await agent.get('/api/references');
    expect(res.status).toBe(200);
    expect(res.body.references.map((r: any) => r.id)).not.toContain('pending-1');
  });

  it('shows an approved reference in the public feed', async () => {
    await seedRef({
      id: 'approved-1',
      userId: 'u1',
      isAdminCurated: false,
      status: 'approved',
      isApproved: true,
      isPublic: true,
      enriched: true,
    });

    const agent = await request();
    const res = await agent.get('/api/references');
    expect(res.body.references.map((r: any) => r.id)).toContain('approved-1');
  });
});

describe('reference moderation — admin queue', () => {
  it('403s for a non-admin', async () => {
    const { user } = await createUser();
    const token = signTestToken({ userId: user.id, email: user.email });
    const agent = await request();
    const res = await agent
      .get('/api/admin/references/pending')
      .set('Authorization', bearer(token));
    expect(res.status).toBe(403);
  });

  it('lists only pending references, oldest first', async () => {
    await seedRef({ id: 'p-old', status: 'pending', createdAt: new Date('2020-01-01') });
    await seedRef({ id: 'p-new', status: 'pending', createdAt: new Date('2021-01-01') });
    await seedRef({ id: 'a-1', status: 'approved', isApproved: true });

    const { user } = await createAdmin();
    const token = signTestToken({ userId: user.id, email: user.email });
    const agent = await request();
    const res = await agent
      .get('/api/admin/references/pending')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    const ids = res.body.items.map((r: any) => r.id);
    expect(ids).toEqual(['p-old', 'p-new']);
    expect(ids).not.toContain('a-1');
  });
});

describe('reference moderation — reject', () => {
  it('soft-rejects: keeps the row but never public', async () => {
    await seedRef({ id: 'rej-1', status: 'pending', isApproved: false, isPublic: true });
    const { user } = await createAdmin();
    const token = signTestToken({ userId: user.id, email: user.email });
    const agent = await request();

    const res = await agent
      .post('/api/admin/references/rej-1/reject')
      .set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');

    const { getDb } = await import('../../server/db/mongodb.js');
    const doc = await getDb().collection('community_presets').findOne({ id: 'rej-1' });
    expect(doc?.status).toBe('rejected');
    expect(doc?.isApproved).toBe(false);
    expect(doc?.isPublic).toBe(false);
  });
});

describe('reference moderation — approve enriches then reveals', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('runs enrichment and flips visibility only after it succeeds', async () => {
    // Enrichment fetches the image and calls Gemini + Pinecone — mock all three.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      })) as any
    );
    vi.doMock('../../server/services/geminiService.js', () => ({
      describeImage: vi.fn(async () => ({
        description: 'a minimalist logo',
        title: 'Logo',
        inputTokens: 10,
        outputTokens: 5,
      })),
      getMultimodalEmbedding: vi.fn(async () => ({ embedding: new Array(8).fill(0.1) })),
    }));
    vi.doMock('../../server/services/vectorService.js', () => ({
      vectorService: { upsert: vi.fn(async () => {}), delete: vi.fn(async () => {}) },
    }));
    // The GoogleGenAI dimension call — return empty dimensions (non-fatal path).
    vi.doMock('@google/genai', () => ({
      GoogleGenAI: class {
        models = { generateContent: async () => ({ text: '{"dimensions":{},"geoHint":{}}' }) };
      },
      Type: new Proxy({}, { get: () => 'STRING' }),
    }));

    await seedRef({
      id: 'app-flow',
      userId: 'u1',
      isAdminCurated: false,
      status: 'pending',
      isApproved: false,
      isPublic: true,
      enriched: false,
    });

    const { user } = await createAdmin();
    const token = signTestToken({ userId: user.id, email: user.email });
    const agent = await request();
    const res = await agent
      .post('/api/admin/references/app-flow/approve')
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('approved');

    const { getDb } = await import('../../server/db/mongodb.js');
    const doc = await getDb().collection('community_presets').findOne({ id: 'app-flow' });
    expect(doc?.status).toBe('approved');
    expect(doc?.isApproved).toBe(true);
    expect(doc?.enriched).toBe(true);
    expect(doc?.description).toBe('a minimalist logo');
  });
});
