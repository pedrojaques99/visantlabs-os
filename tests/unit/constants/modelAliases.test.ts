import { describe, it, expect } from 'vitest';
import { RETIRED_MODEL_ALIASES, resolveModelAlias } from '../../../src/constants/modelAliases';
import { GEMINI_MODELS } from '../../../src/constants/geminiModels';
import { KLING_VIDEO_MODEL_LIST } from '../../../src/constants/klingModels';

describe('modelos aposentados', () => {
  it('troca o id velho pelo substituto e deixa o atual intacto', () => {
    expect(resolveModelAlias('gemini-3.1-flash-image-preview')).toBe(GEMINI_MODELS.IMAGE_NB2);
    expect(resolveModelAlias('gemini-3-pro-image-preview')).toBe(GEMINI_MODELS.IMAGE_PRO);
    expect(resolveModelAlias('gemini-2.5-flash-image')).toBe(GEMINI_MODELS.IMAGE_FLASH);
    expect(resolveModelAlias('kling-v1-6')).toBe('kling-v3');
    expect(resolveModelAlias('kling-v3')).toBe('kling-v3');
    expect(resolveModelAlias(undefined)).toBeUndefined();
  });

  it('nenhum substituto é ele mesmo aposentado (sem cadeia)', () => {
    for (const alvo of Object.values(RETIRED_MODEL_ALIASES)) {
      expect(RETIRED_MODEL_ALIASES[alvo], alvo).toBeUndefined();
    }
  });

  it('as constantes em uso não apontam para ids aposentados', () => {
    for (const id of Object.values(GEMINI_MODELS)) {
      expect(RETIRED_MODEL_ALIASES[id], id).toBeUndefined();
    }
    for (const id of KLING_VIDEO_MODEL_LIST) {
      expect(RETIRED_MODEL_ALIASES[id], id).toBeUndefined();
    }
  });
});
