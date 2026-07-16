import { describe, it, expect } from 'vitest';
import {
  buildBrandContextJSON,
  buildBrandContextJSONString,
  buildBrandContext,
  buildBrandContextForImageGen,
  pickBrandSections,
  BRAND_SECTION_PRESETS,
} from '@server/lib/brandContextBuilder';

describe('buildBrandContextJSON (Structured Output)', () => {
  it('should build valid JSON contract from brand', () => {
    const brand = {
      identity: { name: 'Test Brand', tagline: 'Test' },
      colors: [{ name: 'primary', hex: '#00bcd4', rgb: 'rgb(0,188,212)', role: 'primary' }],
      typography: [{ role: 'heading', family: 'Inter', style: 'Bold' }],
    };

    const json = buildBrandContextJSON(brand as any);

    expect(json).toHaveProperty('brand');
    expect(json).toHaveProperty('colors');
    expect(json).toHaveProperty('typography');
    expect(json.brand.name).toBe('Test Brand');
    expect(json.colors).toHaveLength(1);
  });

  it('should convert hex colors to RGB format', () => {
    const brand = {
      identity: { name: 'Test' },
      colors: [{ name: 'test', hex: '#ffffff', rgb: 'rgb(255,255,255)' }],
      typography: [],
    };

    const json = buildBrandContextJSON(brand as any);
    const color = json.colors[0];

    expect(color.hex).toBe('#ffffff');
    expect(color.rgb).toBeDefined();
    expect(color.rgb.r).toBeCloseTo(1, 0.01);
  });

  it('should be JSON-serializable', () => {
    const brand = {
      identity: { name: 'Test' },
      colors: [{ name: 'test', hex: '#000000', rgb: 'rgb(0,0,0)' }],
      typography: [],
    };

    const json = buildBrandContextJSON(brand as any);
    expect(() => JSON.stringify(json)).not.toThrow();
  });
});

describe('buildBrandContextJSONString', () => {
  it('should wrap JSON in brand_context tags', () => {
    const brand = {
      identity: { name: 'Test' },
      colors: [],
      typography: [],
    };

    const str = buildBrandContextJSONString(brand as any);

    expect(str).toContain('<brand_context>');
    expect(str).toContain('</brand_context>');
    expect(str).toContain('INSTRUCTIONS:');
  });
});

describe('buildBrandContext (Human-Readable)', () => {
  it('should include brand name', () => {
    const brand = {
      identity: { name: 'Acme' },
      colors: [],
      typography: [],
    };

    const text = buildBrandContext(brand as any);

    expect(text).toContain('BRAND: Acme');
  });

  it('should format colors correctly', () => {
    const brand = {
      identity: { name: 'Test' },
      colors: [{ name: 'primary', hex: '#ff0000', role: 'primary' }],
      typography: [],
    };

    const text = buildBrandContext(brand as any);

    expect(text).toContain('COLORS:');
    expect(text).toContain('primary: #ff0000');
  });
});

describe('buildBrandContextForImageGen', () => {
  it('should return compact output', () => {
    const brand = {
      identity: { name: 'Test' },
      colors: [{ name: 'test', hex: '#000000', role: 'primary' }],
      typography: [{ role: 'body', family: 'Arial' }],
      logos: [{ variant: 'full', url: 'https://example.com/logo.png' }],
    };

    const text = buildBrandContextForImageGen(brand as any);

    expect(text).toContain('COLORS:');
    expect(text).not.toContain('LOGOS:');
  });
});

// The whole point of copyExamples: real shipped copy reaches the model as
// few-shot material. It's stored inside `strategy`, so it rides that section's
// presets — which is what keeps it out of image prompts.
describe('strategy.copyExamples', () => {
  const brand = {
    identity: { name: 'Urban Stay' },
    colors: [{ name: 'primary', hex: '#000000', role: 'primary' }],
    typography: [{ role: 'body', family: 'Arial' }],
    strategy: {
      copyExamples: [
        { text: 'A CIDADE PINTA. A GENTE EMOLDURA.', type: 'headline' },
        { text: 'BC EM TELA CHEIA.', type: 'headline' },
      ],
    },
  };

  it('reaches the JSON context under strategy', () => {
    const json = buildBrandContextJSON(brand as any);
    expect(json.strategy?.copyExamples).toHaveLength(2);
    expect(json.strategy?.copyExamples?.[0].text).toBe('A CIDADE PINTA. A GENTE EMOLDURA.');
  });

  it('reaches the text context with the copy verbatim', () => {
    const text = buildBrandContext(brand as any);
    expect(text).toContain('COPY EXAMPLES');
    expect(text).toContain('A CIDADE PINTA. A GENTE EMOLDURA.');
    expect(text).toContain('[headline]');
  });

  it('ships an instruction telling the model what to do with it', () => {
    // Data with no instruction gets ignored — the model needs to be told these
    // are voice samples to imitate, not text to reuse.
    const str = buildBrandContextJSONString(brand as any);
    expect(str).toMatch(/strategy\.copyExamples/);
    expect(str).toMatch(/never copy one verbatim/i);
  });

  it('stays out of image generation prompts', () => {
    // imageGen omits 'strategy' on purpose — copy would be dead weight (and
    // tokens) in a prompt that only draws.
    expect(BRAND_SECTION_PRESETS.imageGen).not.toContain('strategy');
    const text = buildBrandContextForImageGen(brand as any);
    expect(text).not.toContain('COPY EXAMPLES');
    expect(text).not.toContain('A CIDADE PINTA');
  });

  it('is carried by the copy preset', () => {
    expect(BRAND_SECTION_PRESETS.copy).toContain('strategy');
    const json = buildBrandContextJSON(brand as any, BRAND_SECTION_PRESETS.copy);
    expect(json.strategy?.copyExamples).toHaveLength(2);
  });

  it('stays out of the minimal preset the chat leans on', () => {
    // The chat surfaces inject `minimal` and fetch the rest via
    // get_brand_context. If minimal ever grew to carry strategy, every chat
    // turn would silently pay for the brand's whole copy bank again.
    const text = buildBrandContext(brand as any, { sections: BRAND_SECTION_PRESETS.minimal });
    expect(text).not.toContain('COPY EXAMPLES');
    expect(text).toContain('Urban Stay'); // identity still there
  });
});

// The chat used to inject the whole brand on every turn. These lock the size of
// what each surface actually pays for, so a future "just add it to the preset"
// shows up as a failing number instead of a slow bill.
describe('context size by preset', () => {
  const heavyBrand = {
    identity: { name: 'Urban Stay', tagline: 'A vista é sua', website: 'urbanstay.com' },
    colors: Array.from({ length: 8 }, (_, i) => ({
      name: `c${i}`,
      hex: '#112233',
      role: 'primary',
    })),
    typography: [{ role: 'heading', family: 'Inter', style: 'Bold' }],
    guidelines: {
      voice: 'Direto, sensorial',
      dos: ['Falar da vista', 'Usar a metáfora da moldura'],
      donts: ['Prometer o que a janela não entrega'],
    },
    strategy: {
      manifesto: {
        provocation: 'A cidade é obra.',
        tension: 'Ninguém olha.',
        promise: 'Emoldure.',
      },
      positioning: ['hotel-galeria'],
      coreMessage: { product: 'Hotel', differential: 'Vista', emotionalBond: 'Contemplação' },
      pillars: Array.from({ length: 3 }, (_, i) => ({
        value: `p${i}`,
        description: 'x'.repeat(80),
      })),
      personas: Array.from({ length: 3 }, (_, i) => ({
        name: `Persona ${i}`,
        age: 30,
        occupation: 'Arquiteta',
        bio: 'x'.repeat(200),
        traits: ['a', 'b', 'c'],
        desires: ['x'.repeat(60)],
        painPoints: ['x'.repeat(60)],
      })),
      marketResearch: {
        competitors: Array.from({ length: 6 }, (_, i) => `Concorrente ${i}`),
        gaps: ['x'.repeat(120)],
        opportunities: ['x'.repeat(120)],
        notes: 'x'.repeat(300),
      },
      copyExamples: Array.from({ length: 20 }, (_, i) => ({
        text: `Headline número ${i} — a cidade pinta, a gente emoldura.`,
        type: 'headline',
      })),
    },
    media: Array.from({ length: 11 }, (_, i) => ({
      id: `m${i}`,
      url: `https://cdn.example.com/very/long/media/path/asset-${i}.png`,
      type: 'image',
    })),
    knowledgeFiles: Array.from({ length: 4 }, (_, i) => ({
      fileName: `doc-${i}.pdf`,
      source: 'pdf',
    })),
  };

  it('minimal is a fraction of full — that gap is the whole point', () => {
    const full = buildBrandContext(heavyBrand as any).length;
    const minimal = buildBrandContext(heavyBrand as any, {
      sections: BRAND_SECTION_PRESETS.minimal,
    }).length;

    // Measured on this brand: 5096 chars (~1274 tok) full vs 293 (~73 tok)
    // minimal — 6%. Recorded so the win is a number, not a claim.
    expect(full).toBeGreaterThan(4500);
    expect(minimal).toBeLessThan(full / 10);
  });

  it('a big copy bank never reaches an image prompt', () => {
    const imageGen = buildBrandContext(heavyBrand as any, {
      sections: BRAND_SECTION_PRESETS.imageGen,
    });
    expect(imageGen).not.toContain('Headline número');
    expect(imageGen).not.toContain('COPY EXAMPLES');
  });
});

describe('pickBrandSections', () => {
  const row = {
    id: 'abc',
    identity: { name: 'Urban Stay' },
    colors: [{ hex: '#000' }],
    typography: [{ family: 'Arial' }],
    guidelines: { voice: 'direct' },
    strategy: { positioning: ['x'] },
    logos: [{ url: 'l' }],
    media: [{ url: 'm' }],
    colorThemes: [{ name: 't' }],
    knowledgeFiles: [{ fileName: 'k' }],
    gradients: [{ name: 'g' }],
  };

  it('keeps only the requested sections', () => {
    const out = pickBrandSections(row, BRAND_SECTION_PRESETS.copy) as any;
    expect(out.identity).toBeDefined();
    expect(out.guidelines).toBeDefined(); // voice
    expect(out.strategy).toBeDefined();
    expect('colors' in out).toBe(false);
    expect('logos' in out).toBe(false);
    expect('media' in out).toBe(false);
  });

  it('maps sections to the row fields that actually hold them', () => {
    const out = pickBrandSections(row, ['themes', 'knowledge']) as any;
    expect(out.colorThemes).toBeDefined();
    expect(out.knowledgeFiles).toBeDefined();
    expect('identity' in out).toBe(false);
  });

  it('passes through fields no section claims, rather than dropping them', () => {
    // gradients has no section — filtering must not make it disappear.
    const out = pickBrandSections(row, ['colors']) as any;
    expect(out.id).toBe('abc');
    expect(out.gradients).toBeDefined();
  });

  it('returns everything when no sections are given', () => {
    expect(pickBrandSections(row, undefined)).toBe(row);
  });
});
