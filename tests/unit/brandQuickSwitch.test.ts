import { describe, it, expect } from 'vitest';
import { resolvePreviousBrandId } from '@/hooks/useBrandQuickSwitch';

describe('resolvePreviousBrandId', () => {
  const valid = new Set(['a', 'b', 'c']);

  it('retorna a primeira do MRU que não é a ativa e ainda existe', () => {
    // MRU (mais recente primeiro): a = ativa; anterior = b
    expect(resolvePreviousBrandId(['a', 'b', 'c'], 'a', valid)).toBe('b');
  });

  it('pula a ativa mesmo que não esteja no topo do MRU', () => {
    expect(resolvePreviousBrandId(['b', 'a', 'c'], 'a', valid)).toBe('b');
  });

  it('ignora ids que não existem mais na lista', () => {
    expect(resolvePreviousBrandId(['x', 'y', 'b'], 'a', valid)).toBe('b');
  });

  it('sem marca ativa ("Todas"), pega a primeira válida do MRU', () => {
    expect(resolvePreviousBrandId(['c', 'a'], null, valid)).toBe('c');
  });

  it('retorna null quando não há anterior utilizável', () => {
    expect(resolvePreviousBrandId(['a'], 'a', valid)).toBeNull();
    expect(resolvePreviousBrandId([], 'a', valid)).toBeNull();
    expect(resolvePreviousBrandId(['x', 'y'], 'a', valid)).toBeNull();
  });
});
