import { describe, expect, it } from 'vitest';
import { validateToolPreset } from '../../server/routes/toolPresets';

describe('validateToolPreset', () => {
  const ok = { tool: 'ink-bleed', name: ' Meu estilo ', data: { a: 1 } };

  it('accepts settings and trims the name', () => {
    expect(validateToolPreset(ok).value).toEqual({
      tool: 'ink-bleed',
      name: 'Meu estilo',
      data: { a: 1 },
    });
  });

  it.each([
    ['tool with odd characters', { ...ok, tool: '$where' }],
    ['tool that is not text', { ...ok, tool: { $ne: 1 } }],
    ['empty name', { ...ok, name: '   ' }],
    ['name too long', { ...ok, name: 'x'.repeat(81) }],
    ['data that is a list', { ...ok, data: [1] }],
    ['no data', { tool: 'x', name: 'y' }],
    ['a file inside the data', { ...ok, data: { image: 'x'.repeat(300 * 1024) } }],
  ])('rejects %s', (_, body) => {
    expect(validateToolPreset(body).error).toBeTruthy();
  });

  it('rejects an empty body', () => {
    expect(validateToolPreset(undefined).error).toBeTruthy();
  });
});
