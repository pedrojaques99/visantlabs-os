import { describe, it, expect } from 'vitest';
import { validateExtracted } from '@server/lib/brand-extract';

// copyExamples are fed back to generation as few-shot, so what lands here is
// what the model will imitate later. That makes this normalizer the place where
// a sloppy extraction turns into a brand teaching itself the wrong voice.

describe('validateExtracted — strategy.copyExamples', () => {
  it('keeps real copy verbatim, with its type', () => {
    const out = validateExtracted({
      strategy: {
        copyExamples: [
          { text: 'A CIDADE PINTA. A GENTE EMOLDURA.', type: 'headline' },
          { text: 'Reserve agora', type: 'cta' },
        ],
      },
    });

    expect(out.strategy?.copyExamples).toEqual([
      { text: 'A CIDADE PINTA. A GENTE EMOLDURA.', type: 'headline' },
      { text: 'Reserve agora', type: 'cta' },
    ]);
  });

  it('accepts a bare string, since models drop the wrapper half the time', () => {
    const out = validateExtracted({ strategy: { copyExamples: ['BC EM TELA CHEIA.'] } });
    expect(out.strategy?.copyExamples).toEqual([{ text: 'BC EM TELA CHEIA.' }]);
  });

  it('drops an invented type rather than persisting one the union forbids', () => {
    // The copy is the valuable part; a bogus label shouldn't cost us the line.
    const out = validateExtracted({
      strategy: { copyExamples: [{ text: 'A vista é sua.', type: 'slogan' }] },
    });
    expect(out.strategy?.copyExamples).toEqual([{ text: 'A vista é sua.' }]);
  });

  it('dedupes — the same line twice teaches nothing and bills every prompt', () => {
    const out = validateExtracted({
      strategy: {
        copyExamples: [
          { text: 'A vista é sua.' },
          { text: 'a vista é sua.' },
          { text: '  A vista é sua.  ' },
        ],
      },
    });
    expect(out.strategy?.copyExamples).toHaveLength(1);
  });

  it('discards empty and malformed entries', () => {
    const out = validateExtracted({
      strategy: { copyExamples: [{ text: '   ' }, { type: 'headline' }, null, 42, { text: 'Real' }] },
    });
    expect(out.strategy?.copyExamples).toEqual([{ text: 'Real' }]);
  });

  it('omits the field entirely when nothing survives', () => {
    // Absent, not an empty array — the context builder gates on length, and an
    // empty COPY EXAMPLES header would just be noise in the prompt.
    const out = validateExtracted({ strategy: { copyExamples: [{ text: '' }] } });
    expect(out.strategy?.copyExamples).toBeUndefined();
  });

  it('leaves the rest of strategy alone', () => {
    const out = validateExtracted({
      strategy: {
        positioning: ['hotel-galeria'],
        copyExamples: [{ text: 'BC em tela cheia.' }],
      },
    });
    expect(out.strategy?.positioning).toEqual(['hotel-galeria']);
    expect(out.strategy?.copyExamples).toHaveLength(1);
  });
});
