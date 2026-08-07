import { describe, it, expect, vi, beforeEach } from 'vitest';

// The bug this file exists for: chatWithAIContext used to pick EITHER the
// caller's systemInstruction OR the context, never both. brandHealth passes
// both, so the model audited an empty prompt (~348 input tokens) and invented a
// plausible brand — findings about a brand it had never seen, on the screen
// where the owner decides what to rewrite.

const generateContent = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
  Type: new Proxy({}, { get: () => 'STRING' }),
}));

vi.mock('../ai-resilience.js', () => ({
  withRetry: (fn: any) => fn(),
  shouldRetry: () => false,
}));

const brand = {
  identity: { name: 'Arbolt', description: 'Marca de reflorestamento com foco em bioinsumos.' },
  colors: [{ name: 'Musgo', hex: '#2C352F', role: 'primary' }],
  typography: [{ role: 'heading', family: 'Sora', size: 40 }],
  guidelines: { voice: 'Direta, técnica, sem adjetivo decorativo.' },
  strategy: {
    manifesto: 'Plantar é infraestrutura, não paisagismo.',
    pillars: [{ name: 'Rastreabilidade' }],
  },
} as any;

describe('chatWithAIContext — context must survive a systemInstruction', () => {
  beforeEach(() => {
    generateContent.mockReset();
    generateContent.mockResolvedValue({
      text: '{"score":70,"summary":"ok","insights":[],"recommendations":[]}',
      usageMetadata: { promptTokenCount: 4200, candidatesTokenCount: 120 },
    });
  });

  it('appends context to the caller systemInstruction instead of dropping it', async () => {
    const { chatWithAIContext } = await import('../../services/geminiService.js');

    await chatWithAIContext('Audit this.', '<brand_context>MUSGO_SENTINEL</brand_context>', [], {
      systemInstruction: 'You are a senior brand strategist.',
      model: 'gemini-3-flash-preview',
    });

    const sent = generateContent.mock.calls[0][0].config.systemInstruction as string;
    expect(sent).toContain('You are a senior brand strategist.');
    // The regression: this assertion failed for every caller passing both.
    expect(sent).toContain('MUSGO_SENTINEL');
  });

  it('leaves the systemInstruction alone when there is no context', async () => {
    const { chatWithAIContext } = await import('../../services/geminiService.js');

    await chatWithAIContext('Hi', '', [], { systemInstruction: 'ONLY_THIS' });

    const sent = generateContent.mock.calls[0][0].config.systemInstruction as string;
    expect(sent.trim()).toBe('ONLY_THIS');
  });
});

describe('runBrandHealth — refuses an audit the model could not have made', () => {
  beforeEach(() => generateContent.mockReset());

  it('throws BrandHealthContextError when the prompt is too small to contain the brand', async () => {
    // 348 tokens is the real signature of the shipped bug: the rubric alone.
    generateContent.mockResolvedValue({
      text: '{"score":52,"summary":"a voz e generica","insights":[],"recommendations":[]}',
      usageMetadata: { promptTokenCount: 348, candidatesTokenCount: 200 },
    });

    const { runBrandHealth, BrandHealthContextError } = await import('../brandHealth.js');

    await expect(runBrandHealth(brand)).rejects.toBeInstanceOf(BrandHealthContextError);
  });

  it('returns the report when the brand context actually arrived', async () => {
    generateContent.mockResolvedValue({
      text: '{"score":71,"summary":"coerente","insights":[],"recommendations":[]}',
      usageMetadata: { promptTokenCount: 4200, candidatesTokenCount: 200 },
    });

    const { runBrandHealth } = await import('../brandHealth.js');
    const report = await runBrandHealth(brand);

    expect(report.score).toBe(71);
    expect(report.tokens.input).toBe(4200);
  });

  it('still short-circuits an empty brand without calling the model', async () => {
    const { runBrandHealth } = await import('../brandHealth.js');
    const report = await runBrandHealth({ identity: { name: 'Vazia' } } as any);

    expect(report.model).toBe('deterministic');
    expect(generateContent).not.toHaveBeenCalled();
  });
});
