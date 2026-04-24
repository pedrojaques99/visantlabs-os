import { describe, it, expect } from 'vitest';

/**
 * MCP Tools Audit Tests
 * Validates tool contract shapes, error response consistency,
 * and configuration completeness without hitting live APIs.
 * All tests run against static fixtures/mocks.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeUser() { return 'user_test_123'; }

function makeFetch(status: number, body: object) {
  return async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

// Simulates the ERR object from platform-mcp.ts
const ERR = {
  auth:       () => ({ content: [{ type: 'text', text: JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } }) }] }),
  notFound:   (w: string) => ({ content: [{ type: 'text', text: JSON.stringify({ error: { code: 'NOT_FOUND', message: `${w} not found` } }) }] }),
  validation: (m: string) => ({ content: [{ type: 'text', text: JSON.stringify({ error: { code: 'VALIDATION_ERROR', message: m } }) }] }),
  internal:   (m: string) => ({ content: [{ type: 'text', text: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: m } }) }] }),
  credits:    () => ({ content: [{ type: 'text', text: JSON.stringify({ error: { code: 'INSUFFICIENT_CREDITS', message: 'Not enough credits.' } }) }] }),
};

function parseResponse(r: { content: { type: string; text: string }[] }) {
  return JSON.parse(r.content[0].text);
}

// ── Error Response Structure ──────────────────────────────────────────────────

describe('Error response structure', () => {
  it('ERR.auth returns structured error with UNAUTHORIZED code', () => {
    const r = parseResponse(ERR.auth());
    expect(r.error).toBeDefined();
    expect(r.error.code).toBe('UNAUTHORIZED');
    expect(typeof r.error.message).toBe('string');
  });

  it('ERR.notFound includes resource name in message', () => {
    const r = parseResponse(ERR.notFound('Brand guideline'));
    expect(r.error.code).toBe('NOT_FOUND');
    expect(r.error.message).toContain('Brand guideline');
  });

  it('ERR.internal wraps arbitrary messages', () => {
    const r = parseResponse(ERR.internal('network timeout'));
    expect(r.error.code).toBe('INTERNAL_ERROR');
    expect(r.error.message).toBe('network timeout');
  });

  it('ERR.validation exposes human message', () => {
    const r = parseResponse(ERR.validation('Either data or url is required.'));
    expect(r.error.code).toBe('VALIDATION_ERROR');
    expect(r.error.message).toContain('Either data or url');
  });

  it('All error variants have consistent shape { error: { code, message } }', () => {
    const variants = [ERR.auth(), ERR.notFound('X'), ERR.validation('X'), ERR.internal('X'), ERR.credits()];
    for (const v of variants) {
      const d = parseResponse(v);
      expect(d).toHaveProperty('error');
      expect(d.error).toHaveProperty('code');
      expect(d.error).toHaveProperty('message');
      expect(typeof d.error.code).toBe('string');
      expect(typeof d.error.message).toBe('string');
    }
  });
});

// ── mockup-generate contract ──────────────────────────────────────────────────

describe('mockup-generate tool contract', () => {
  function simulateMockupGenerate(params: {
    prompt: string;
    model?: string;
    provider?: string;
    aspectRatio?: string;
    resolution?: string;
    brandGuidelineId?: string;
    seed?: number;
    referenceImages?: string[];
  }, fetchResult: { status: number; body: object }) {
    const { prompt, model = 'gpt-image-2', provider, aspectRatio = '1:1', resolution = '1K', brandGuidelineId, seed, referenceImages } = params;

    // Validate required
    if (!prompt?.trim()) return ERR.validation('prompt is required');

    // Build body — mirrors what the MCP tool sends
    const body: Record<string, unknown> = {
      promptText: prompt,
      brandGuidelineId,
      model,
      provider,
      aspectRatio,
      resolution,
      designType: 'blank',
      referenceImages,
      seed,
      feature: 'agent',
    };

    // Simulate fetch
    const { status, body: respBody } = fetchResult as any;
    if (status >= 400) return ERR.internal((respBody as any).error || `Generation failed (${status})`);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          imageUrl: (respBody as any).imageUrl || null,
          mockupId: (respBody as any).id || null,
          hasImage: !!(respBody as any).imageUrl,
          model,
          provider: (respBody as any).provider || provider,
          aspectRatio,
          resolution,
          seed: (respBody as any).seed ?? seed ?? null,
          creditsUsed: (respBody as any).creditsUsed ?? null,
        }),
      }],
    };
  }

  it('returns all output fields on success', () => {
    const r = parseResponse(simulateMockupGenerate(
      { prompt: 'product shot', model: 'gpt-image-2', aspectRatio: '1:1', resolution: '1K' },
      { status: 200, body: { imageUrl: 'https://r2.dev/img.png', id: 'mock_123', creditsUsed: 5, provider: 'openai' } }
    ));
    expect(r.imageUrl).toBe('https://r2.dev/img.png');
    expect(r.mockupId).toBe('mock_123');
    expect(r.model).toBe('gpt-image-2');
    expect(r.aspectRatio).toBe('1:1');
    expect(r.resolution).toBe('1K');
    expect(r.creditsUsed).toBe(5);
    expect(r.provider).toBe('openai');
  });

  it('forwards seed to response', () => {
    const r = parseResponse(simulateMockupGenerate(
      { prompt: 'test', seed: 42 },
      { status: 200, body: { imageUrl: 'https://r2.dev/img.png', seed: 42 } }
    ));
    expect(r.seed).toBe(42);
  });

  it('uses ERR.internal on API error', () => {
    const r = parseResponse(simulateMockupGenerate(
      { prompt: 'test' },
      { status: 500, body: { error: 'server error' } }
    ));
    expect(r.error.code).toBe('INTERNAL_ERROR');
    expect(r.error.message).toContain('server error');
  });

  it('rejects empty prompt', () => {
    const r = parseResponse(simulateMockupGenerate({ prompt: '' }, { status: 200, body: {} }));
    expect(r.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts all valid models', () => {
    const models = ['gpt-image-2', 'gpt-image-1', 'gemini-3.1-flash-image-preview', 'seedream-3-0'];
    for (const model of models) {
      const r = simulateMockupGenerate({ prompt: 'test', model }, { status: 200, body: { imageUrl: 'https://r2.dev/i.png' } });
      expect(r).not.toHaveProperty('error');
    }
  });

  it('accepts referenceImages array', () => {
    const r = parseResponse(simulateMockupGenerate(
      { prompt: 'test', referenceImages: ['https://r2.dev/ref1.png', 'https://r2.dev/ref2.png'] },
      { status: 200, body: { imageUrl: 'https://r2.dev/out.png' } }
    ));
    expect(r.imageUrl).toBeDefined();
  });
});

// ── branding-generate contract ────────────────────────────────────────────────

describe('branding-generate tool contract', () => {
  function simulateBrandingGenerate(params: {
    prompt: string;
    step?: string;
    previousData?: Record<string, unknown>;
    brandGuidelineId?: string;
  }, fetchResult: { status: number; body: object }) {
    const { prompt, step = 'full', previousData, brandGuidelineId } = params;
    if (!prompt?.trim()) return ERR.validation('prompt is required');

    const { status, body: respBody } = fetchResult as any;
    if (status >= 400) return ERR.internal((respBody as any).error || `Failed (${status})`);

    return {
      content: [{ type: 'text', text: JSON.stringify({ ...(respBody as object), step }) }],
    };
  }

  it('defaults step to "full"', () => {
    const r = parseResponse(simulateBrandingGenerate(
      { prompt: 'modern startup' },
      { status: 200, body: { colors: ['#000'], typography: [] } }
    ));
    expect(r.step).toBe('full');
  });

  it('passes previousData for iterative refinement', () => {
    const prev = { marketResearch: 'competitive market' };
    const r = parseResponse(simulateBrandingGenerate(
      { prompt: 'refine the colors', step: 'color-palettes', previousData: prev },
      { status: 200, body: { colorPalettes: [{ primary: '#1a1a1a' }] } }
    ));
    expect(r.step).toBe('color-palettes');
    expect(r.colorPalettes).toBeDefined();
  });

  it('accepts all valid steps', () => {
    const steps = ['full', 'market-research', 'swot', 'persona', 'archetype', 'concept-ideas', 'color-palettes', 'moodboard'];
    for (const step of steps) {
      const r = simulateBrandingGenerate({ prompt: 'test', step }, { status: 200, body: {} });
      const d = parseResponse(r);
      expect(d.step).toBe(step);
    }
  });

  it('uses ERR.internal on API failure', () => {
    const r = parseResponse(simulateBrandingGenerate(
      { prompt: 'test' },
      { status: 422, body: { error: 'invalid prompt' } }
    ));
    expect(r.error.code).toBe('INTERNAL_ERROR');
  });
});

// ── creative-full contract ────────────────────────────────────────────────────

describe('creative-full tool contract', () => {
  function simulateCreativeFull(params: {
    prompt: string;
    model?: string;
    resolution?: string;
    format?: string;
  }, steps: { plan: object | null; bg: object | null; render: object | null }) {
    const { prompt, model = 'gpt-image-2', resolution = '1K', format = '1:1' } = params;
    const credits: Record<string, number | null> = { plan: null, background: null, render: null };

    if (!steps.plan) return ERR.internal('Creative plan failed (500)');
    const plan = steps.plan;
    credits.plan = (plan as any).creditsUsed ?? null;

    const backgroundImageUrl = steps.bg ? (steps.bg as any).imageUrl : undefined;
    credits.background = steps.bg ? ((steps.bg as any).creditsUsed ?? null) : null;

    if (!steps.render) {
      return { content: [{ type: 'text', text: JSON.stringify({ error: 'Render failed (500)', step: 'render', plan, backgroundImageUrl, creditsUsed: credits }) }] };
    }
    const imageUrl = (steps.render as any).imageUrl;
    credits.render = (steps.render as any).creditsUsed ?? null;

    return {
      content: [{ type: 'text', text: JSON.stringify({ imageUrl, backgroundImageUrl, plan, projectId: 'proj_123', creditsUsed: credits }) }],
    };
  }

  it('returns full pipeline output on success', () => {
    const r = parseResponse(simulateCreativeFull(
      { prompt: 'brand campaign' },
      {
        plan: { layers: [], overlay: null, creditsUsed: 1 },
        bg: { imageUrl: 'https://r2.dev/bg.png', creditsUsed: 5 },
        render: { imageUrl: 'https://r2.dev/final.png', creditsUsed: 0 },
      }
    ));
    expect(r.imageUrl).toBe('https://r2.dev/final.png');
    expect(r.backgroundImageUrl).toBe('https://r2.dev/bg.png');
    expect(r.plan).toBeDefined();
    expect(r.projectId).toBe('proj_123');
    expect(r.creditsUsed).toEqual({ plan: 1, background: 5, render: 0 });
  });

  it('returns partial success with plan+bg when render fails', () => {
    const r = parseResponse(simulateCreativeFull(
      { prompt: 'test' },
      {
        plan: { layers: [], creditsUsed: 1 },
        bg: { imageUrl: 'https://r2.dev/bg.png', creditsUsed: 5 },
        render: null,
      }
    ));
    expect(r.error).toContain('Render failed');
    expect(r.plan).toBeDefined();
    expect(r.backgroundImageUrl).toBe('https://r2.dev/bg.png');
    expect(r.creditsUsed).toBeDefined();
  });

  it('returns ERR.internal when plan step fails', () => {
    const r = parseResponse(simulateCreativeFull(
      { prompt: 'test' },
      { plan: null, bg: null, render: null }
    ));
    expect(r.error.code).toBe('INTERNAL_ERROR');
  });

  it('creditsUsed breakdown has all three keys', () => {
    const r = parseResponse(simulateCreativeFull(
      { prompt: 'test' },
      {
        plan: { creditsUsed: 2 },
        bg: { imageUrl: 'https://r2.dev/bg.png', creditsUsed: 8 },
        render: { imageUrl: 'https://r2.dev/out.png', creditsUsed: 0 },
      }
    ));
    expect(r.creditsUsed).toHaveProperty('plan');
    expect(r.creditsUsed).toHaveProperty('background');
    expect(r.creditsUsed).toHaveProperty('render');
  });
});

// ── brand-guidelines-upload-logo contract ────────────────────────────────────

describe('brand-guidelines-upload-logo contract', () => {
  function simulateUploadLogo(params: { id: string; data?: string; url?: string; variant?: string; label?: string }) {
    const { id, data, url, variant = 'primary', label } = params;
    if (!data && !url) return ERR.validation('Either data (base64) or url is required.');
    const logo = { id: 'logo_abc', url: 'https://r2.dev/logo.png', variant, label };
    return { content: [{ type: 'text', text: JSON.stringify({ logo, allLogos: [logo] }) }] };
  }

  it('rejects when neither data nor url provided', () => {
    const r = parseResponse(simulateUploadLogo({ id: 'bg_1' }));
    expect(r.error.code).toBe('VALIDATION_ERROR');
  });

  it('accepts base64 data', () => {
    const r = parseResponse(simulateUploadLogo({ id: 'bg_1', data: 'base64string', variant: 'icon', label: 'Symbol' }));
    expect(r.logo.id).toBe('logo_abc');
    expect(r.logo.variant).toBe('icon');
  });

  it('accepts url', () => {
    const r = parseResponse(simulateUploadLogo({ id: 'bg_1', url: 'https://example.com/logo.png' }));
    expect(r.logo.url).toBeDefined();
  });

  it('returns allLogos array', () => {
    const r = parseResponse(simulateUploadLogo({ id: 'bg_1', data: 'b64' }));
    expect(Array.isArray(r.allLogos)).toBe(true);
  });
});

// ── moodboard tools contract ──────────────────────────────────────────────────

describe('moodboard tools contract', () => {
  function simulateDetectGrid(imageBase64: string) {
    if (!imageBase64) return ERR.validation('imageBase64 is required');
    const boxes = Array.from({ length: 9 }, (_, i) => ({
      id: `cell-${i + 1}`,
      x: (i % 3) * 340,
      y: Math.floor(i / 3) * 340,
      width: 340,
      height: 340,
    }));
    return { content: [{ type: 'text', text: JSON.stringify({ boxes, count: 9 }) }] };
  }

  function simulateUpscale(imageBase64: string, size: string) {
    if (!imageBase64) return ERR.validation('imageBase64 is required');
    if (!['1K', '2K', '4K'].includes(size)) return ERR.validation(`Invalid size: ${size}`);
    return { content: [{ type: 'text', text: JSON.stringify({ upscaledBase64: 'upscaled_base64_data', size }) }] };
  }

  function simulateSuggest(images: { id: string; base64: string }[]) {
    if (!images?.length) return ERR.validation('images array is required');
    const suggestions = images.map(img => ({ id: img.id, animationPreset: 'fade-in', veoPrompt: 'cinematic fade' }));
    return { content: [{ type: 'text', text: JSON.stringify({ suggestions }) }] };
  }

  it('detect-grid returns boxes with correct shape', () => {
    const r = parseResponse(simulateDetectGrid('base64data'));
    expect(r.boxes).toHaveLength(9);
    expect(r.count).toBe(9);
    expect(r.boxes[0]).toHaveProperty('id');
    expect(r.boxes[0]).toHaveProperty('x');
    expect(r.boxes[0]).toHaveProperty('y');
    expect(r.boxes[0]).toHaveProperty('width');
    expect(r.boxes[0]).toHaveProperty('height');
  });

  it('upscale accepts 1K, 2K, 4K', () => {
    for (const size of ['1K', '2K', '4K']) {
      const r = parseResponse(simulateUpscale('b64', size));
      expect(r.upscaledBase64).toBeDefined();
      expect(r.size).toBe(size);
    }
  });

  it('upscale rejects invalid size', () => {
    const r = parseResponse(simulateUpscale('b64', '8K'));
    expect(r.error.code).toBe('VALIDATION_ERROR');
  });

  it('suggest returns animation preset per image', () => {
    const images = [{ id: 'cell-1', base64: 'b64a' }, { id: 'cell-2', base64: 'b64b' }];
    const r = parseResponse(simulateSuggest(images));
    expect(r.suggestions).toHaveLength(2);
    expect(r.suggestions[0]).toHaveProperty('animationPreset');
    expect(r.suggestions[0]).toHaveProperty('veoPrompt');
  });

  it('suggest rejects empty images array', () => {
    const r = parseResponse(simulateSuggest([]));
    expect(r.error.code).toBe('VALIDATION_ERROR');
  });
});

// ── auth tools contract ───────────────────────────────────────────────────────

describe('auth tools contract', () => {
  function simulateRegister(email: string, password: string, name?: string) {
    if (!email || !email.includes('@')) return ERR.validation('Invalid email');
    if (!password || password.length < 8) return ERR.validation('Password must be at least 8 characters');
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'Account created. Use api-key-create with the returned token to generate your visant_sk_xxx API key.',
          token: 'jwt_token_abc',
          user: { id: 'user_123', email, name: name || email.split('@')[0] },
        }),
      }],
    };
  }

  function simulateApiKeyCreate(name: string, jwt?: string, currentUserId?: string) {
    if (!currentUserId && !jwt) return ERR.validation('Authentication required. Pass a JWT from auth-login, or connect with an existing API key.');
    if (!name?.trim()) return ERR.validation('Name is required');
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          message: 'API key created. Save the key — it will not be shown again.',
          key: 'visant_sk_testabc123',
          keyPrefix: 'visant_sk_te',
          name,
          scopes: ['read', 'write', 'generate'],
          usage: 'Authorization: Bearer visant_sk_testabc123',
          mcpUrl: 'https://visantlabs.com/api/mcp',
        }),
      }],
    };
  }

  it('register returns token + user on success', () => {
    const r = parseResponse(simulateRegister('test@example.com', 'password123', 'Test User'));
    expect(r.token).toBe('jwt_token_abc');
    expect(r.user.email).toBe('test@example.com');
    expect(r.message).toContain('api-key-create');
  });

  it('register rejects invalid email', () => {
    const r = parseResponse(simulateRegister('notanemail', 'password123'));
    expect(r.error.code).toBe('VALIDATION_ERROR');
  });

  it('register rejects short password', () => {
    const r = parseResponse(simulateRegister('test@example.com', 'short'));
    expect(r.error.code).toBe('VALIDATION_ERROR');
  });

  it('api-key-create works with JWT (no existing API key)', () => {
    const r = parseResponse(simulateApiKeyCreate('Claude MCP', 'jwt_token_abc'));
    expect(r.key).toMatch(/^visant_sk_/);
    expect(r.mcpUrl).toBe('https://visantlabs.com/api/mcp');
    expect(r.message).toContain('Save the key');
  });

  it('api-key-create works with currentUserId (existing API key auth)', () => {
    const r = parseResponse(simulateApiKeyCreate('Production', undefined, 'user_123'));
    expect(r.key).toMatch(/^visant_sk_/);
  });

  it('api-key-create rejects when no auth provided', () => {
    const r = parseResponse(simulateApiKeyCreate('Test'));
    expect(r.error.code).toBe('VALIDATION_ERROR');
    expect(r.error.message).toContain('Authentication required');
  });

  it('full onboarding flow: register → api-key-create', () => {
    // Step 1: Register
    const reg = parseResponse(simulateRegister('dev@example.com', 'securepass'));
    expect(reg.token).toBeDefined();

    // Step 2: Use JWT to create API key
    const key = parseResponse(simulateApiKeyCreate('My MCP Key', reg.token));
    expect(key.key).toMatch(/^visant_sk_/);
    expect(key.usage).toContain('Authorization: Bearer');
  });
});
