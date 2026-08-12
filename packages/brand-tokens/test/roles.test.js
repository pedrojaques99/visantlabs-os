import { describe, it, expect } from 'vitest';
import { wcagContrast } from 'culori';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { compileBrandTokens, emitCss, loadCraft, BrandTokenError } from '../src/engine.js';
import { normalizeBrand, brandSlug, BrandFetchError } from '../src/fetch-brand.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (n) => JSON.parse(readFileSync(join(here, `../src/fixtures/${n}.json`), 'utf8'));

const visant = fixture('visant');
const campo = fixture('campo-neon');
const turno = fixture('turno-e-turno');
const craft = loadCraft();

// ─────────────────────────────────────────────────────────────────────────────
// O bug que motivou tudo: brands não compartilham vocabulário de `role`, e o
// lookup por igualdade exata caía num default hardcoded da OUTRA marca — sem
// erro. Um site inteiro saía fora da marca e ninguém via até um humano abrir.
// ─────────────────────────────────────────────────────────────────────────────

describe('papéis de tipografia resolvem por marca, sem vazamento', () => {
  it('Campo Neon usa a própria fonte, não a fallback da Visant', () => {
    const t = compileBrandTokens(campo).type;
    expect(t.display).toBe('Archivo');
    expect(t.sans).toBe('Archivo');
    // A regressão exata: Manrope/Oswald são da Visant.
    expect(t.display).not.toBe('Oswald');
    expect(t.sans).not.toBe('Manrope');
  });

  it('Visant® põe a face de 96px no display, não no corpo', () => {
    // Regressão do mapeamento invertido: `primary` (Manrope, 96px) é display,
    // `secondary` (Oswald, 16px) é corpo. O mapa antigo trocava os dois.
    const t = compileBrandTokens(visant).type;
    expect(t.display).toBe('Manrope');
    expect(t.sans).toBe('Oswald');
  });

  it('marca de uma face só usa a mesma nos dois papéis, sem inventar a segunda', () => {
    const t = compileBrandTokens(turno).type;
    expect(t.display).toBe('Helvetica Neue LT');
    expect(t.sans).toBe('Helvetica Neue LT');
  });

  it('marca sem tipografia falha alto em vez de escolher por conta', () => {
    expect(() => compileBrandTokens({ ...campo, typography: [] })).toThrow(BrandTokenError);
  });
});

describe('papéis de cor resolvem por cadeia de fallback', () => {
  it('Campo Neon mantém o lime como --brand', () => {
    const c = compileBrandTokens(campo);
    expect(c.themes.light.brand.toLowerCase()).toBe('#bfff53');
  });

  it('Turno & Turno não tem `background`; usa cor da marca, nunca a da Visant', () => {
    // Só publica `text` e `accent`. O default antigo era #f4ebeb — da Visant.
    const c = compileBrandTokens(turno);
    const own = turno.colors.map((x) => x.hex.toLowerCase());
    expect(own).toContain(c.themes.light.brand.toLowerCase());
  });

  it('marca sem cor nenhuma falha alto, e diz o que procurou', () => {
    try {
      compileBrandTokens({ ...campo, colors: [] });
      expect.unreachable('deveria ter lançado');
    } catch (e) {
      expect(e).toBeInstanceOf(BrandTokenError);
      expect(e.detail.tried).toContain('background');
    }
  });
});

describe('contraste AA vale para TODA marca, não só para a fixture original', () => {
  for (const [name, brand] of [
    ['Visant®', visant],
    ['Campo Neon', campo],
    ['Turno & Turno', turno],
  ]) {
    for (const mode of ['light', 'dark']) {
      it(`${name} [${mode}]: corpo e tinta de marca passam AA`, () => {
        const t = compileBrandTokens(brand).themes[mode];
        expect(wcagContrast(t['muted-foreground'], t.background)).toBeGreaterThanOrEqual(4.5);
        expect(wcagContrast(t['accent-ink'], t.background)).toBeGreaterThanOrEqual(4.5);
        expect(wcagContrast(t['brand-foreground'], t.brand)).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe('proveniência viaja junto com o token', () => {
  it('meta carrega id, versão e completude da marca', () => {
    const m = compileBrandTokens(campo).meta;
    expect(m.name).toBe('Campo Neon');
    expect(m.brandId).toBe('fixture000000000000cneo');
    expect(m.completeness).toBe(36);
    expect(m.version).toBe(10);
  });

  it('o CSS emitido diz de qual marca e versão ele veio', () => {
    const css = emitCss(compileBrandTokens(campo), craft);
    expect(css).toContain('Campo Neon');
    expect(css).toContain('fixture000000000000cneo');
    expect(css).toContain('DO NOT EDIT BY HAND');
  });

  it('o cabeçalho não afirma Visant® para outra marca', () => {
    const css = emitCss(compileBrandTokens(campo), craft);
    expect(css).not.toContain('Visant®');
  });
});

describe('saída por marca, sem sobrescrita silenciosa', () => {
  it('marcas diferentes geram nomes de arquivo diferentes', () => {
    expect(brandSlug(campo)).toBe('campo-neon');
    expect(brandSlug(turno)).toBe('turno-turno');
    expect(brandSlug(campo)).not.toBe(brandSlug(turno));
  });

  it('marcas diferentes geram CSS diferente', () => {
    const a = emitCss(compileBrandTokens(campo), craft);
    const b = emitCss(compileBrandTokens(turno), craft);
    expect(a).not.toBe(b);
  });
});

describe('normalização do payload da API', () => {
  const payload = {
    id: 'abc123',
    identity: { name: 'Marca Teste' },
    colors: [
      { hex: '#101010', role: 'background', name: 'Preto' },
      { hex: '#ff8800', role: 'accent', name: 'Laranja' },
      { notAColor: true },
    ],
    typography: [{ family: 'Inter', role: 'body', size: 16 }, { role: 'sem familia' }],
    extraction: { completeness: 72 },
    currentVersion: 3,
  };

  it('descarta entrada sem hex e sem family em vez de propagar undefined', () => {
    const b = normalizeBrand(payload);
    expect(b.colors).toHaveLength(2);
    expect(b.typography).toHaveLength(1);
  });

  it('preserva id, nome, versão e completude para o carimbo', () => {
    const b = normalizeBrand(payload);
    expect(b.id).toBe('abc123');
    expect(b.name).toBe('Marca Teste');
    expect(b.currentVersion).toBe(3);
    expect(b.extraction.completeness).toBe(72);
  });

  it('payload sem cor nenhuma falha alto', () => {
    expect(() => normalizeBrand({ id: 'x', colors: [] })).toThrow(BrandFetchError);
  });

  it('o normalizado compila ponta a ponta', () => {
    const c = compileBrandTokens(normalizeBrand(payload));
    expect(c.type.sans).toBe('Inter');
    expect(c.meta.completeness).toBe(72);
  });
});
