import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────────
// The Canvas Chat proxy (`POST /canvas-generate`) only touches the Gemini SDK,
// the API-key resolver and the credit ledger. Everything else chat.ts imports is
// stubbed so the router loads cheaply in the unit project (no DB / network).

const generateContent = vi.fn();
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

const getGeminiApiKey = vi.fn();
vi.mock('../../utils/geminiApiKey.js', () => ({ getGeminiApiKey }));

const chargeCredits = vi.fn();
const refundCreditsWithRetry = vi.fn();
vi.mock('../../lib/credits.js', () => ({ chargeCredits, refundCreditsWithRetry }));

// Auth: inject a fixed userId, skip JWT verification.
vi.mock('../../middleware/auth.js', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = 'user-1';
    next();
  },
}));

// Heavy transitive deps used by the *session* chat routes — stubbed to keep the
// module import side-effect free. None are exercised by /canvas-generate.
vi.mock('../../services/knowledgeService.js', () => ({ knowledgeService: {} }));
vi.mock('../../lib/brandContextBuilder.js', () => ({ buildBrandContextCached: vi.fn() }));
vi.mock('../../db/mongodb.js', () => ({ getDb: vi.fn(), connectToMongoDB: vi.fn() }));
vi.mock('../../db/prisma.js', () => ({ prisma: {} }));
vi.mock('../../services/llmRouter.js', () => ({ chatWithLLM: vi.fn() }));
vi.mock('../../services/chat/toolRegistry.js', () => ({
  getChatTools: vi.fn(),
  executeChatTool: vi.fn(),
}));
vi.mock('../../lib/chat/history.js', () => ({ formatGeminiHistory: vi.fn() }));
vi.mock('../../lib/chat/ragScope.js', () => ({ resolveRagScope: vi.fn() }));

// ── Helpers ──────────────────────────────────────────────────────────────────

async function setupApp() {
  const express = (await import('express')).default;
  const supertest = (await import('supertest')).default;
  const { default: router } = await import('../chat.js');
  const app = express();
  app.use(express.json());
  app.use('/', router);
  return supertest(app);
}

const VALID_CONTENTS = [{ role: 'user', parts: [{ text: 'hi' }] }];

function okGeneration(text = 'olá') {
  generateContent.mockResolvedValue({ text });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: system key available, no user-own key.
  getGeminiApiKey.mockImplementation(async (_userId: string, opts?: { skipFallback?: boolean }) =>
    opts?.skipFallback ? undefined : 'system-key'
  );
  refundCreditsWithRetry.mockResolvedValue(undefined);
  chargeCredits.mockResolvedValue({
    charged: true,
    creditsDeducted: 1,
    deductionSource: { fromEarned: 1, fromMonthly: 0 },
    user: {},
    reason: 'charged',
  });
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('POST /canvas-generate', () => {
  it('rejects a missing/empty contents array', async () => {
    const request = await setupApp();
    const res = await request.post('/canvas-generate').send({});
    expect(res.status).toBe(400);
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('returns 503 when no API key is configured', async () => {
    getGeminiApiKey.mockResolvedValue(undefined);
    const request = await setupApp();
    const res = await request.post('/canvas-generate').send({ contents: VALID_CONTENTS });
    expect(res.status).toBe(503);
    expect(chargeCredits).not.toHaveBeenCalled();
  });

  it('proxies to Gemini and returns the text', async () => {
    okGeneration('resposta da IA');
    const request = await setupApp();
    const res = await request
      .post('/canvas-generate')
      .send({ contents: VALID_CONTENTS, userMessageCount: 1 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ text: 'resposta da IA' });
  });

  it('does not charge before the 4th user message', async () => {
    okGeneration();
    const request = await setupApp();
    const res = await request
      .post('/canvas-generate')
      .send({ contents: VALID_CONTENTS, userMessageCount: 2 });
    expect(res.status).toBe(200);
    expect(chargeCredits).not.toHaveBeenCalled();
  });

  it('charges one credit on every 4th user message', async () => {
    okGeneration();
    const request = await setupApp();
    const res = await request
      .post('/canvas-generate')
      .send({ contents: VALID_CONTENTS, userMessageCount: 4 });
    expect(res.status).toBe(200);
    expect(chargeCredits).toHaveBeenCalledWith('user-1', 1, { isUserApiKey: false });
  });

  it('skips the charge for BYOK (user-own key) accounts', async () => {
    okGeneration();
    getGeminiApiKey.mockImplementation(async () => 'user-own-key'); // returns a key even with skipFallback
    const request = await setupApp();
    const res = await request
      .post('/canvas-generate')
      .send({ contents: VALID_CONTENTS, userMessageCount: 4 });
    expect(res.status).toBe(200);
    expect(chargeCredits).toHaveBeenCalledWith('user-1', 1, { isUserApiKey: true });
  });

  it('forwards config (structured output) and returns usageMetadata', async () => {
    generateContent.mockResolvedValue({
      text: '{"ok":true}',
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    });
    const request = await setupApp();
    const config = { responseMimeType: 'application/json', responseSchema: { type: 'OBJECT' } };
    const res = await request.post('/canvas-generate').send({ contents: VALID_CONTENTS, config });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      text: '{"ok":true}',
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
    });
    // config is forwarded to the SDK; no userMessageCount → no credit charge (helper calls).
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({ config }));
    expect(chargeCredits).not.toHaveBeenCalled();
  });

  it('returns 402 when the user has insufficient credits', async () => {
    chargeCredits.mockRejectedValue(new Error('Insufficient credits. Required: 1, Available: 0'));
    const request = await setupApp();
    const res = await request
      .post('/canvas-generate')
      .send({ contents: VALID_CONTENTS, userMessageCount: 4 });
    expect(res.status).toBe(402);
    expect(res.body.error).toBe('insufficient_credits');
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('refunds the charged credit when generation fails', async () => {
    generateContent.mockRejectedValue(new Error('Gemini exploded'));
    const request = await setupApp();
    const res = await request
      .post('/canvas-generate')
      .send({ contents: VALID_CONTENTS, userMessageCount: 4 });
    expect(res.status).toBe(500);
    expect(refundCreditsWithRetry).toHaveBeenCalledWith('user-1', 1, {
      fromEarned: 1,
      fromMonthly: 0,
    });
  });

  it('refunds and returns 502 when Gemini yields empty text', async () => {
    okGeneration('   ');
    const request = await setupApp();
    const res = await request
      .post('/canvas-generate')
      .send({ contents: VALID_CONTENTS, userMessageCount: 4 });
    expect(res.status).toBe(502);
    expect(refundCreditsWithRetry).toHaveBeenCalled();
  });
});
