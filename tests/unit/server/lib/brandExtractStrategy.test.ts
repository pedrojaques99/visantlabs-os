import { describe, it, expect } from 'vitest';
import { validateExtracted } from '@server/lib/brand-extract';

// coreMessage / pillars / the structured manifesto used to be dropped here in
// silence: the prompt never asked for them, and this normalizer rebuilt strategy
// from a whitelist that didn't include them. The result was an ingest that read
// real brand material and threw the strategy away — the exact inverse of
// "guidelines are INPUT". These tests are the guard on that.

describe('validateExtracted — strategy.manifesto', () => {
  it('keeps a flat string, which is what running text ingests as', () => {
    const out = validateExtracted({ strategy: { manifesto: 'A cidade pinta. A gente emoldura.' } });
    expect(out.strategy?.manifesto).toBe('A cidade pinta. A gente emoldura.');
  });

  it('keeps the structured arc when the source actually lays it out', () => {
    const out = validateExtracted({
      strategy: {
        manifesto: {
          provocation: 'A cidade nunca para.',
          tension: 'Mas hospedagem virou commodity.',
          promise: 'Somos a lente que enquadra.',
          full: 'A cidade nunca para...',
        },
      },
    });
    expect(out.strategy?.manifesto).toEqual({
      provocation: 'A cidade nunca para.',
      tension: 'Mas hospedagem virou commodity.',
      promise: 'Somos a lente que enquadra.',
      full: 'A cidade nunca para...',
    });
  });

  it('keeps a partial arc — a deck may state the promise and nothing else', () => {
    const out = validateExtracted({
      strategy: { manifesto: { promise: 'Somos a lente.', provocation: '  ' } },
    });
    expect(out.strategy?.manifesto).toEqual({ promise: 'Somos a lente.' });
  });

  it('omits an empty manifesto rather than persisting a hollow object', () => {
    expect(validateExtracted({ strategy: { manifesto: '   ' } }).strategy?.manifesto).toBeUndefined();
    expect(
      validateExtracted({ strategy: { manifesto: { full: '' } } }).strategy?.manifesto
    ).toBeUndefined();
  });
});

describe('validateExtracted — strategy.coreMessage', () => {
  it('keeps all three parts', () => {
    const out = validateExtracted({
      strategy: {
        coreMessage: {
          product: 'Hospedagem urbana de curta duração',
          differential: 'experiência sensorial',
          emotionalBond: 'intensidade',
        },
      },
    });
    expect(out.strategy?.coreMessage).toEqual({
      product: 'Hospedagem urbana de curta duração',
      differential: 'experiência sensorial',
      emotionalBond: 'intensidade',
    });
  });

  it('drops a partial core message — the UI renders it as one sentence', () => {
    // "<product> com o diferencial de <differential>, transmitindo <bond>" reads
    // as a broken sentence with a hole in it, so half is worse than none.
    const out = validateExtracted({
      strategy: { coreMessage: { product: 'Hospedagem urbana', differential: 'sensorial' } },
    });
    expect(out.strategy?.coreMessage).toBeUndefined();
  });
});

describe('validateExtracted — strategy.pillars', () => {
  it('keeps named pillars with their descriptions', () => {
    const out = validateExtracted({
      strategy: {
        pillars: [
          { value: 'Intensidade', description: 'Nada morno.' },
          { value: 'Enquadramento', description: 'A lente da cidade.' },
        ],
      },
    });
    expect(out.strategy?.pillars).toEqual([
      { value: 'Intensidade', description: 'Nada morno.' },
      { value: 'Enquadramento', description: 'A lente da cidade.' },
    ]);
  });

  it('accepts bare strings, since models drop the wrapper half the time', () => {
    const out = validateExtracted({ strategy: { pillars: ['Intensidade'] } });
    expect(out.strategy?.pillars).toEqual([{ value: 'Intensidade', description: '' }]);
  });

  it('discards malformed entries and omits the field when nothing survives', () => {
    expect(
      validateExtracted({ strategy: { pillars: [{ description: 'sem nome' }, null, 42] } }).strategy
        ?.pillars
    ).toBeUndefined();
  });
});
