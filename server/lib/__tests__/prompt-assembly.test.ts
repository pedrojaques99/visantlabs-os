import { describe, it, expect } from 'vitest';
import { classifyIntent, isChatOnly } from '../prompt/classifier.js';
import { assemblePrompt } from '../prompt/index.js';

// ─── classifyIntent ────────────────────────────────────────────────────────────

describe('classifyIntent', () => {
  it('classifies creation keywords', () => {
    const r = classifyIntent('cria um post para instagram', false);
    expect(r.intent).toBe('create');
  });

  it('classifies complex creation with quantity + format', () => {
    const r = classifyIntent('cria 5 slides de carrossel', false);
    expect(r.intent).toBe('create');
    expect(r.complexity).toBe('complex');
  });

  it('classifies edit keywords', () => {
    const r = classifyIntent('muda a cor desse frame', true);
    expect(r.intent).toBe('edit');
    expect(r.hasSelection).toBe(true);
  });

  it('classifies "alterar" as edit', () => {
    const r = classifyIntent('altera a fonte desse texto', false);
    expect(r.intent).toBe('edit');
  });

  it('flags hasSelection when elements present', () => {
    const r = classifyIntent('qualquer coisa', true);
    expect(r.hasSelection).toBe(true);
  });

  it('does not flag hasSelection with empty selection', () => {
    const r = classifyIntent('cria um banner', false);
    expect(r.hasSelection).toBe(false);
  });

  it('detects carrossel as complex format', () => {
    const r = classifyIntent('cria um carrossel de instagram', false);
    expect(r.complexity).toBe('complex');
  });
});

describe('isChatOnly', () => {
  it('detects greetings as chat', () => {
    expect(isChatOnly('oi tudo bem')).toBe(true);
    expect(isChatOnly('olá')).toBe(true);
    expect(isChatOnly('hello')).toBe(true);
  });

  it('detects "me explica" as chat', () => {
    expect(isChatOnly('me explica a diferença entre kerning e tracking')).toBe(true);
  });

  it('does not flag design commands as chat', () => {
    expect(isChatOnly('cria um post')).toBe(false);
    expect(isChatOnly('muda a cor')).toBe(false);
  });

  it('short messages are chat', () => {
    expect(isChatOnly('ok')).toBe(true);
  });
});

// ─── assemblePrompt ────────────────────────────────────────────────────────────

const BRAND = {
  brandColors: [
    { name: 'Lava', value: '#D4491B', role: 'primary' },
    { name: 'Areia', value: '#F2EAD7', role: 'secondary' },
  ],
  brandFonts: {
    primary: { family: 'Bebas Neue', style: 'Regular', size: 48 },
    secondary: { family: 'Inter', style: 'Regular', size: 16 },
  },
  brandLogos: {
    light: { name: 'Logo Light', key: 'abc123' },
  },
};

describe('assemblePrompt', () => {
  it('returns non-empty system prompt and positive token estimate', () => {
    const r = assemblePrompt({ command: 'cria um banner', ...BRAND });
    expect(r.system.length).toBeGreaterThan(50);
    expect(r.tokenEstimate).toBeGreaterThan(0);
  });

  it('create intent includes create_rules module', () => {
    const r = assemblePrompt({ command: 'cria um post instagram', ...BRAND });
    expect(r.modules).toContain('create_rules');
  });

  it('create with brand includes brand module', () => {
    const r = assemblePrompt({ command: 'cria um post', ...BRAND });
    expect(r.modules).toContain('brand');
    expect(r.system).toContain('Bebas Neue');
  });

  it('brand module includes typography instruction', () => {
    const r = assemblePrompt({ command: 'cria um post', ...BRAND });
    expect(r.system).toMatch(/fontFamily|TIPOGRAFIA/i);
  });

  it('complex create includes multi_frames but NOT premium_hint (removed)', () => {
    const r = assemblePrompt({ command: 'cria 5 slides de carrossel completo', ...BRAND });
    expect(r.modules).toContain('multi_frames');
    expect(r.modules).not.toContain('premium_hint');
  });

  it('design_excellence does NOT contain blob creation rule (regression)', async () => {
    const { DESIGN_EXCELLENCE_RULES } = await import('../prompt/modules/design-excellence.js');
    expect(DESIGN_EXCELLENCE_RULES).not.toMatch(/blob/i);
    expect(DESIGN_EXCELLENCE_RULES).not.toMatch(/CREATE_ELLIPSE/);
    expect(DESIGN_EXCELLENCE_RULES).not.toMatch(/LAYER_BLUR.*fundo/i);
  });

  it('edit intent includes edit_rules', () => {
    const r = assemblePrompt({
      command: 'muda a cor',
      selectedElements: [{ type: 'FRAME', id: '1:1' }],
      ...BRAND,
    });
    expect(r.modules).toContain('edit_rules');
  });

  it('edit_rules includes SET_AUTO_LAYOUT with primaryAxisSizingMode guidance', () => {
    const r = assemblePrompt({
      command: 'muda o layout',
      selectedElements: [{ type: 'FRAME', id: '1:1' }],
      ...BRAND,
    });
    expect(r.system).toMatch(/primaryAxisSizingMode/);
  });

  it('useBrand=false injects brand_disabled, not brand', () => {
    const r = assemblePrompt({ command: 'cria um post', useBrand: false, ...BRAND });
    expect(r.modules).toContain('brand_disabled');
    expect(r.modules).not.toContain('brand');
  });

  it('brand without fonts does NOT inject typography instruction', () => {
    const r = assemblePrompt({
      command: 'cria um post',
      brandColors: BRAND.brandColors,
      brandFonts: undefined,
    });
    // typography instruction only appears when fonts are present
    expect(r.system).not.toMatch(/INSTRUÇÃO TIPOGRAFIA/);
  });

  it('greeting returns chat_only module', () => {
    const r = assemblePrompt({ command: 'oi tudo bem' });
    expect(r.modules).toContain('chat_only');
    expect(r.intent.intent).toBe('chat');
  });

  it('thinkMode injects think_mode module', () => {
    const r = assemblePrompt({ command: 'cria um banner', thinkMode: true, ...BRAND });
    expect(r.modules).toContain('think_mode');
  });
});
