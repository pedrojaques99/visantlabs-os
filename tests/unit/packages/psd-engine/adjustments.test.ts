import { describe, it, expect } from 'vitest';
import { buildAdjustmentLut } from '@visant/psd-engine';

describe('buildAdjustmentLut', () => {
  it('retorna null para tipos não suportados', () => {
    expect(buildAdjustmentLut(undefined)).toBeNull();
    expect(buildAdjustmentLut({ type: 'vibrance' })).toBeNull();
  });

  it('levels: gamma neutro + range cheio = identidade', () => {
    const lut = buildAdjustmentLut({
      type: 'levels',
      rgb: { shadowInput: 0, highlightInput: 255, midtoneInput: 1, shadowOutput: 0, highlightOutput: 255 },
    })!;
    expect(lut.r[0]).toBe(0);
    expect(lut.r[128]).toBe(128);
    expect(lut.r[255]).toBe(255);
  });

  it('levels: aumentar shadowInput escurece os tons baixos (mais contraste)', () => {
    const lut = buildAdjustmentLut({
      type: 'levels',
      rgb: { shadowInput: 50, highlightInput: 205, midtoneInput: 1, shadowOutput: 0, highlightOutput: 255 },
    })!;
    expect(lut.r[50]).toBe(0); // tudo <=50 vira preto
    expect(lut.r[255]).toBe(255); // tudo >=205 vira branco
    expect(lut.r[128]).toBeGreaterThan(100); // midtone esticado
  });

  it('brightness/contrast: contraste positivo afasta do cinza médio', () => {
    const lut = buildAdjustmentLut({ type: 'brightness/contrast', brightness: 0, contrast: 50 })!;
    expect(lut.r[64]).toBeLessThan(64); // sombra mais escura
    expect(lut.r[192]).toBeGreaterThan(192); // luz mais clara
    expect(lut.r[127]).toBeCloseTo(127, 0); // pivô ~127 estável
  });

  it('curves: 2 pontos lineares interpolam', () => {
    const lut = buildAdjustmentLut({
      type: 'curves',
      rgb: [{ input: 0, output: 0 }, { input: 255, output: 255 }],
    })!;
    expect(lut.r[128]).toBe(128);
  });
});
