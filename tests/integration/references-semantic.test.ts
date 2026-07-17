import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Semantic text search — rank by meaning (embed → Pinecone → hydrate), with a
 * graceful fall back to the lexical/regex path when there are no vectors, the
 * embedding fails, or Pinecone is unconfigured (mock mode → empty matches).
 */

async function db() {
  const { connectToMongoDB, getDb } = await import('../../server/db/mongodb.js');
  await connectToMongoDB();
  return getDb();
}

async function seed(overrides: Record<string, any>) {
  const d = await db();
  await d.collection('community_presets').insertOne({
    category: 'reference',
    isAdminCurated: true,
    isApproved: true,
    isPublic: true,
    enriched: true,
    referenceImageUrl: 'https://cdn.example.com/x.png',
    dimensions: {},
    tags: [],
    createdAt: new Date(),
    ...overrides,
  });
}

describe('semantic search — rank by meaning', () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.restoreAllMocks());

  it('returns refs in Pinecone similarity order, not substring order', async () => {
    vi.doMock('../../server/services/geminiService.js', () => ({
      getMultimodalEmbedding: vi.fn(async () => ({ embedding: new Array(8).fill(0.1) })),
    }));
    // Vector store ranks 'calm-serif' above 'loud-sans' for the query — note
    // neither name contains the query word, so regex could never do this.
    vi.doMock('../../server/services/vectorService.js', () => ({
      vectorService: {
        query: vi.fn(async () => [
          { id: 'calm-serif', score: 0.92 },
          { id: 'loud-sans', score: 0.41 },
        ]),
      },
    }));

    await seed({ id: 'calm-serif', name: 'Editorial identity' });
    await seed({ id: 'loud-sans', name: 'Sports poster' });

    const { searchReferences } = await import('../../server/lib/references/engine.js');
    const res = await searchReferences(await db(), {
      search: 'quiet elegant typography',
      semantic: true,
    });

    expect(res.references.map((r: any) => r.id)).toEqual(['calm-serif', 'loud-sans']);
  });

  it('falls back to lexical regex when the vector store returns nothing', async () => {
    vi.doMock('../../server/services/geminiService.js', () => ({
      getMultimodalEmbedding: vi.fn(async () => ({ embedding: new Array(8).fill(0.1) })),
    }));
    // Mock-mode Pinecone (or no hits) → empty matches.
    vi.doMock('../../server/services/vectorService.js', () => ({
      vectorService: { query: vi.fn(async () => []) },
    }));

    await seed({ id: 'has-word', name: 'A brutalist poster', description: 'brutalist grid' });
    await seed({ id: 'no-word', name: 'Soft pastel logo' });

    const { searchReferences } = await import('../../server/lib/references/engine.js');
    const res = await searchReferences(await db(), { search: 'brutalist', semantic: true });

    // Regex fallback finds the substring match — semantic didn't silently return empty.
    const ids = res.references.map((r: any) => r.id);
    expect(ids).toContain('has-word');
    expect(ids).not.toContain('no-word');
  });

  it('falls back to lexical when the embedding throws', async () => {
    vi.doMock('../../server/services/geminiService.js', () => ({
      getMultimodalEmbedding: vi.fn(async () => {
        throw new Error('gemini down');
      }),
    }));
    vi.doMock('../../server/services/vectorService.js', () => ({
      vectorService: { query: vi.fn(async () => []) },
    }));

    await seed({ id: 'lex', name: 'minimal grid' });
    const { searchReferences } = await import('../../server/lib/references/engine.js');
    const res = await searchReferences(await db(), { search: 'minimal', semantic: true });
    expect(res.references.map((r: any) => r.id)).toContain('lex');
  });

  it('applies residual structured filters (kind) to semantic hits', async () => {
    vi.doMock('../../server/services/geminiService.js', () => ({
      getMultimodalEmbedding: vi.fn(async () => ({ embedding: new Array(8).fill(0.1) })),
    }));
    vi.doMock('../../server/services/vectorService.js', () => ({
      vectorService: {
        query: vi.fn(async () => [
          { id: 'a-logo', score: 0.9 },
          { id: 'a-mockup', score: 0.8 },
        ]),
      },
    }));

    await seed({ id: 'a-logo', dimensions: { brand_artifact: ['logo'] } });
    await seed({ id: 'a-mockup', dimensions: { mockup_type: ['packaging'] } });

    const { searchReferences } = await import('../../server/lib/references/engine.js');
    const res = await searchReferences(await db(), {
      search: 'anything',
      semantic: true,
      kind: 'branding',
    });
    const ids = res.references.map((r: any) => r.id);
    expect(ids).toContain('a-logo');
    expect(ids).not.toContain('a-mockup');
  });
});
