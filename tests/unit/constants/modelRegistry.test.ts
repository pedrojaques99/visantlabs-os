import { describe, it, expect } from 'vitest';
import {
  GEMINI_MODELS,
  MODEL_CONFIG,
  CHAT_MODELS,
  IMAGE_MODELS,
  AVAILABLE_IMAGE_MODELS,
  getModelConfig,
  getModelDisplayName,
  getMaxRefImages,
  getMaxHandles,
  isAdvancedModel,
} from '@/constants/geminiModels';
import {
  SEEDREAM_MODELS,
  SEEDREAM_IMAGE_MODELS,
  SEEDREAM_MODEL_CONFIG,
  isSeedreamModel,
} from '@/constants/seedreamModels';
import {
  OPENAI_IMAGE_MODELS,
  OPENAI_IMAGE_MODEL_LIST,
  OPENAI_IMAGE_MODEL_CONFIG,
  isOpenAIImageModel,
} from '@/constants/openaiModels';
import {
  IMAGEN_MODELS,
  IMAGEN_MODEL_LIST,
  IMAGEN_MODEL_CONFIG,
  isImagenModel,
} from '@/constants/imagenModels';
import {
  IDEOGRAM_MODELS,
  IDEOGRAM_MODEL_LIST,
  IDEOGRAM_MODEL_CONFIG,
  isIdeogramModel,
} from '@/constants/ideogramModels';
import {
  REVE_MODELS,
  REVE_MODEL_LIST,
  REVE_MODEL_CONFIG,
  isReveModel,
} from '@/constants/reveModels';
import {
  VIDEO_MODEL_IDS,
  VIDEO_MODEL_LIST,
  VIDEO_MODEL_CONFIG,
  getVideoModelConfig,
  isKlingModel,
  isVeoModel,
  isSeedanceVideoModel,
  getVideoProvider,
} from '@/constants/videoModels';
import { getCreditsRequired, getVideoCreditsRequired } from '@/utils/creditCalculator';

// ── Gemini Models ─────────────────────────────────────────────────────────────

describe('Gemini model registry', () => {
  it('every CHAT_MODELS entry has a MODEL_CONFIG', () => {
    for (const id of CHAT_MODELS) {
      expect(MODEL_CONFIG[id], `missing config for chat model ${id}`).toBeDefined();
    }
  });

  it('every IMAGE_MODELS entry has a MODEL_CONFIG', () => {
    for (const id of IMAGE_MODELS) {
      expect(MODEL_CONFIG[id], `missing config for image model ${id}`).toBeDefined();
    }
  });

  it('CHAT_MODELS includes Gemini 3.5 Flash at the top', () => {
    expect(CHAT_MODELS[0]).toBe(GEMINI_MODELS.FLASH_3_5);
  });

  it('CHAT_MODELS includes flagship models', () => {
    expect(CHAT_MODELS).toContain(GEMINI_MODELS.PRO_3_1);
    expect(CHAT_MODELS).toContain(GEMINI_MODELS.FLASH_3);
  });

  it('deprecated chat models are marked', () => {
    expect(MODEL_CONFIG[GEMINI_MODELS.FLASH_2_5]?.deprecated).toBe(true);
  });

  it('deprecated image models are marked', () => {
    expect(MODEL_CONFIG[GEMINI_MODELS.IMAGE_FLASH]?.deprecated).toBe(true);
  });

  it('non-deprecated models are NOT marked', () => {
    expect(MODEL_CONFIG[GEMINI_MODELS.FLASH_3_5]?.deprecated).toBeFalsy();
    expect(MODEL_CONFIG[GEMINI_MODELS.IMAGE_NB2]?.deprecated).toBeFalsy();
    expect(MODEL_CONFIG[GEMINI_MODELS.IMAGE_PRO]?.deprecated).toBeFalsy();
  });

  it('getModelDisplayName returns label for known models', () => {
    expect(getModelDisplayName(GEMINI_MODELS.FLASH_3_5)).toBe('Gemini 3.5 Flash');
    expect(getModelDisplayName(GEMINI_MODELS.IMAGE_NB2)).toBe('Nano Banana 2');
  });

  it('getModelConfig returns fallback for unknown model', () => {
    const config = getModelConfig('unknown-model');
    expect(config).toBeDefined();
    expect(config.label).toBeDefined();
  });

  it('advanced models support imageConfig', () => {
    expect(isAdvancedModel(GEMINI_MODELS.IMAGE_NB2)).toBe(true);
    expect(isAdvancedModel(GEMINI_MODELS.IMAGE_PRO)).toBe(true);
    expect(isAdvancedModel(GEMINI_MODELS.IMAGE_FLASH)).toBe(false);
  });
});

// ── Seedream Models ───────────────────────────────────────────────────────────

describe('Seedream model registry', () => {
  it('every SEEDREAM_IMAGE_MODELS entry has config', () => {
    for (const id of SEEDREAM_IMAGE_MODELS) {
      expect(SEEDREAM_MODEL_CONFIG[id], `missing config for ${id}`).toBeDefined();
    }
  });

  it('isSeedreamModel detects seedream models', () => {
    expect(isSeedreamModel(SEEDREAM_MODELS.SD_5_LITE)).toBe(true);
    expect(isSeedreamModel(SEEDREAM_MODELS.SD_4_5)).toBe(true);
    expect(isSeedreamModel('gemini-2.5-flash')).toBe(false);
  });

  it('deprecated seedream models are marked', () => {
    expect(SEEDREAM_MODEL_CONFIG[SEEDREAM_MODELS.SD_3_T2I]?.deprecated).toBe(true);
    expect(SEEDREAM_MODEL_CONFIG[SEEDREAM_MODELS.SE_3_I2I]?.deprecated).toBe(true);
    expect(SEEDREAM_MODEL_CONFIG[SEEDREAM_MODELS.SD_4_0]?.deprecated).toBe(true);
  });

  it('featured seedream models are NOT deprecated', () => {
    expect(SEEDREAM_MODEL_CONFIG[SEEDREAM_MODELS.SD_5_LITE]?.deprecated).toBeFalsy();
    expect(SEEDREAM_MODEL_CONFIG[SEEDREAM_MODELS.SD_4_5]?.deprecated).toBeFalsy();
  });
});

// ── OpenAI Models ─────────────────────────────────────────────────────────────

describe('OpenAI model registry', () => {
  it('every model in list has config', () => {
    for (const id of OPENAI_IMAGE_MODEL_LIST) {
      expect(OPENAI_IMAGE_MODEL_CONFIG[id], `missing config for ${id}`).toBeDefined();
    }
  });

  it('isOpenAIImageModel detects correctly', () => {
    expect(isOpenAIImageModel('gpt-image-2')).toBe(true);
    expect(isOpenAIImageModel('gemini-2.5-flash')).toBe(false);
  });
});

// ── Imagen Models ─────────────────────────────────────────────────────────────

describe('Imagen model registry', () => {
  it('every model in list has config', () => {
    for (const id of IMAGEN_MODEL_LIST) {
      expect(IMAGEN_MODEL_CONFIG[id], `missing config for ${id}`).toBeDefined();
    }
  });

  it('includes all three tiers', () => {
    expect(IMAGEN_MODEL_LIST).toHaveLength(3);
    expect(IMAGEN_MODEL_LIST).toContain(IMAGEN_MODELS.IMAGEN_4_FAST);
    expect(IMAGEN_MODEL_LIST).toContain(IMAGEN_MODELS.IMAGEN_4);
    expect(IMAGEN_MODEL_LIST).toContain(IMAGEN_MODELS.IMAGEN_4_ULTRA);
  });

  it('isImagenModel detects correctly', () => {
    expect(isImagenModel('imagen-4.0-generate-001')).toBe(true);
    expect(isImagenModel('imagen-4.0-fast-generate-001')).toBe(true);
    expect(isImagenModel('gemini-2.5-flash')).toBe(false);
  });

  it('credits: fast=1, standard=1-2, ultra=2', () => {
    expect(getCreditsRequired(IMAGEN_MODELS.IMAGEN_4_FAST, '1K', 'imagen')).toBe(1);
    expect(getCreditsRequired(IMAGEN_MODELS.IMAGEN_4, '1K', 'imagen')).toBe(1);
    expect(getCreditsRequired(IMAGEN_MODELS.IMAGEN_4, '2K', 'imagen')).toBe(2);
    expect(getCreditsRequired(IMAGEN_MODELS.IMAGEN_4_ULTRA, '1K', 'imagen')).toBe(2);
  });
});

// ── Ideogram Models ──────────────────────────────────────────────────────────

describe('Ideogram model registry', () => {
  it('every model in list has config', () => {
    for (const id of IDEOGRAM_MODEL_LIST) {
      expect(IDEOGRAM_MODEL_CONFIG[id], `missing config for ${id}`).toBeDefined();
    }
  });

  it('includes V4 and V3', () => {
    expect(IDEOGRAM_MODEL_LIST).toHaveLength(2);
    expect(IDEOGRAM_MODEL_LIST).toContain(IDEOGRAM_MODELS.V4);
    expect(IDEOGRAM_MODEL_LIST).toContain(IDEOGRAM_MODELS.V3);
  });

  it('isIdeogramModel detects correctly', () => {
    expect(isIdeogramModel('ideogram-v4')).toBe(true);
    expect(isIdeogramModel('ideogram-v3')).toBe(true);
    expect(isIdeogramModel('gemini-2.5-flash')).toBe(false);
  });

  it('credits scale with resolution', () => {
    expect(getCreditsRequired(IDEOGRAM_MODELS.V4, '1K', 'ideogram')).toBe(2);
    expect(getCreditsRequired(IDEOGRAM_MODELS.V4, '2K', 'ideogram')).toBe(3);
    expect(getCreditsRequired(IDEOGRAM_MODELS.V3, '1K', 'ideogram')).toBe(2);
    expect(getCreditsRequired(IDEOGRAM_MODELS.V3, '2K', 'ideogram')).toBe(3);
  });
});

// ── REVE Models ─────────────────────────────────────────────────────────────

describe('REVE model registry', () => {
  it('every model in list has config', () => {
    for (const id of REVE_MODEL_LIST) {
      expect(REVE_MODEL_CONFIG[id], `missing config for ${id}`).toBeDefined();
    }
  });

  it('includes Reve 1', () => {
    expect(REVE_MODEL_LIST).toContain(REVE_MODELS.REVE_1);
  });

  it('isReveModel detects correctly', () => {
    expect(isReveModel('reve-image-1.0')).toBe(true);
    expect(isReveModel('gemini-2.5-flash')).toBe(false);
    expect(isReveModel('ideogram-v4')).toBe(false);
  });

  it('credits scale with resolution', () => {
    expect(getCreditsRequired(REVE_MODELS.REVE_1, '1K', 'reve')).toBe(2);
    expect(getCreditsRequired(REVE_MODELS.REVE_1, '2K', 'reve')).toBe(3);
  });
});

// ── Video Models ──────────────────────────────────────────────────────────────

describe('Video model registry', () => {
  it('every VIDEO_MODEL_LIST entry has config', () => {
    for (const id of VIDEO_MODEL_LIST) {
      expect(VIDEO_MODEL_CONFIG[id], `missing config for video model ${id}`).toBeDefined();
    }
  });

  it('includes Veo 3.1 Lite', () => {
    expect(VIDEO_MODEL_LIST).toContain(VIDEO_MODEL_IDS.VEO_3_1_LITE);
    expect(VIDEO_MODEL_CONFIG[VIDEO_MODEL_IDS.VEO_3_1_LITE]).toBeDefined();
  });

  it('includes Kling Video O1', () => {
    expect(VIDEO_MODEL_LIST).toContain(VIDEO_MODEL_IDS.KLING_VIDEO_O1);
    expect(VIDEO_MODEL_CONFIG[VIDEO_MODEL_IDS.KLING_VIDEO_O1]).toBeDefined();
    expect(VIDEO_MODEL_CONFIG[VIDEO_MODEL_IDS.KLING_VIDEO_O1].badge).toBe('reasoning');
  });

  it('deprecated video models are marked', () => {
    expect(VIDEO_MODEL_CONFIG[VIDEO_MODEL_IDS.KLING_V1]?.deprecated).toBe(true);
    expect(VIDEO_MODEL_CONFIG[VIDEO_MODEL_IDS.KLING_V1_5]?.deprecated).toBe(true);
    expect(VIDEO_MODEL_CONFIG[VIDEO_MODEL_IDS.KLING_V1_6]?.deprecated).toBe(true);
    expect(VIDEO_MODEL_CONFIG[VIDEO_MODEL_IDS.KLING_V2_MASTER]?.deprecated).toBe(true);
    expect(VIDEO_MODEL_CONFIG[VIDEO_MODEL_IDS.KLING_V2_1]?.deprecated).toBe(true);
  });

  it('featured video models are NOT deprecated', () => {
    expect(VIDEO_MODEL_CONFIG[VIDEO_MODEL_IDS.VEO_3_1]?.deprecated).toBeFalsy();
    expect(VIDEO_MODEL_CONFIG[VIDEO_MODEL_IDS.VEO_3_1_FAST]?.deprecated).toBeFalsy();
    expect(VIDEO_MODEL_CONFIG[VIDEO_MODEL_IDS.VEO_3_1_LITE]?.deprecated).toBeFalsy();
    expect(VIDEO_MODEL_CONFIG[VIDEO_MODEL_IDS.KLING_V3_OMNI]?.deprecated).toBeFalsy();
    expect(VIDEO_MODEL_CONFIG[VIDEO_MODEL_IDS.KLING_V3]?.deprecated).toBeFalsy();
  });

  it('provider detection works correctly', () => {
    expect(getVideoProvider('veo-3.1-lite-generate-preview')).toBe('veo');
    expect(getVideoProvider('kling-video-o1')).toBe('kling');
    expect(getVideoProvider('seedance-2-0')).toBe('seedance');
  });

  it('isKlingModel / isVeoModel / isSeedanceVideoModel classify correctly', () => {
    expect(isKlingModel('kling-v3-omni')).toBe(true);
    expect(isKlingModel('kling-video-o1')).toBe(true);
    expect(isVeoModel('veo-3.1-lite-generate-preview')).toBe(true);
    expect(isSeedanceVideoModel('seedance-2-0')).toBe(true);
    expect(isKlingModel('veo-3.1-generate-preview')).toBe(false);
  });
});

// ── Credit Calculator ─────────────────────────────────────────────────────────

describe('Credit calculator', () => {
  describe('image credits', () => {
    it('Gemini NB1 (deprecated) = 1 credit', () => {
      expect(getCreditsRequired(GEMINI_MODELS.IMAGE_FLASH, undefined, 'gemini')).toBe(1);
    });

    it('Gemini NB2 scales with resolution', () => {
      expect(getCreditsRequired(GEMINI_MODELS.IMAGE_NB2, '512px', 'gemini')).toBe(1);
      expect(getCreditsRequired(GEMINI_MODELS.IMAGE_NB2, '1K', 'gemini')).toBe(2);
      expect(getCreditsRequired(GEMINI_MODELS.IMAGE_NB2, '2K', 'gemini')).toBe(3);
      expect(getCreditsRequired(GEMINI_MODELS.IMAGE_NB2, '4K', 'gemini')).toBe(4);
    });

    it('Gemini Pro scales with resolution', () => {
      expect(getCreditsRequired(GEMINI_MODELS.IMAGE_PRO, '1K', 'gemini')).toBe(3);
      expect(getCreditsRequired(GEMINI_MODELS.IMAGE_PRO, '2K', 'gemini')).toBe(5);
      expect(getCreditsRequired(GEMINI_MODELS.IMAGE_PRO, '4K', 'gemini')).toBe(7);
    });

    it('OpenAI credits scale with resolution', () => {
      expect(getCreditsRequired('gpt-image-2', '1K', 'openai')).toBe(2);
      expect(getCreditsRequired('gpt-image-2', '2K', 'openai')).toBe(3);
      expect(getCreditsRequired('gpt-image-2', '4K', 'openai')).toBe(4);
    });

    it('Seedream credits scale with resolution', () => {
      expect(getCreditsRequired(SEEDREAM_MODELS.SD_5_LITE, '2K', 'seedream')).toBe(2);
      expect(getCreditsRequired(SEEDREAM_MODELS.SD_5_LITE, '3K', 'seedream')).toBe(3);
      expect(getCreditsRequired(SEEDREAM_MODELS.SD_5_LITE, '4K', 'seedream')).toBe(4);
    });

    it('fallback returns 1 for unknown model', () => {
      expect(getCreditsRequired('unknown-model')).toBe(1);
    });
  });

  describe('video credits', () => {
    it('Veo 3.1 Standard = 40 credits', () => {
      expect(getVideoCreditsRequired('veo-3.1-generate-preview')).toBe(40);
    });

    it('Veo 3.1 Fast = 15 credits', () => {
      expect(getVideoCreditsRequired('veo-3.1-fast-generate-preview')).toBe(15);
    });

    it('Veo 3.1 Lite = 8 credits', () => {
      expect(getVideoCreditsRequired('veo-3.1-lite-generate-preview')).toBe(8);
    });

    it('Seedance 2.0 = 35, fast = 20, lite = 10', () => {
      expect(getVideoCreditsRequired('seedance-2-0')).toBe(35);
      expect(getVideoCreditsRequired('seedance-2-0-fast')).toBe(20);
      expect(getVideoCreditsRequired('seedance-1-0-lite')).toBe(10);
      expect(getVideoCreditsRequired('seedance-1-5-pro')).toBe(25);
    });

    it('Kling mode-aware pricing', () => {
      expect(getVideoCreditsRequired('kling-v3', 'std')).toBe(20);
      expect(getVideoCreditsRequired('kling-v3', 'pro')).toBe(30);
      expect(getVideoCreditsRequired('kling-v3', '4k')).toBe(40);
      expect(getVideoCreditsRequired('kling-v2-5-turbo')).toBe(15);
      expect(getVideoCreditsRequired('kling-v2-1-master')).toBe(30);
      expect(getVideoCreditsRequired('kling-video-o1', 'pro')).toBe(35);
    });
  });
});

// ── Cross-registry consistency ────────────────────────────────────────────────

describe('Cross-registry consistency', () => {
  it('no model ID appears in both image and chat lists', () => {
    const imageSet = new Set([
      ...AVAILABLE_IMAGE_MODELS,
      ...SEEDREAM_IMAGE_MODELS,
      ...OPENAI_IMAGE_MODEL_LIST,
      ...IDEOGRAM_MODEL_LIST,
      ...REVE_MODEL_LIST,
    ]);
    for (const chatId of CHAT_MODELS) {
      expect(imageSet.has(chatId as any)).toBe(false);
    }
  });

  it('all featured (non-deprecated) image models have at least 1 credit cost defined', () => {
    for (const id of AVAILABLE_IMAGE_MODELS) {
      const config = MODEL_CONFIG[id];
      if (config?.deprecated) continue;
      const credits = getCreditsRequired(id, config?.defaultResolution, 'gemini');
      expect(credits, `${id} should have positive credits`).toBeGreaterThan(0);
    }
  });

  it('all video models have positive credit cost', () => {
    for (const id of VIDEO_MODEL_LIST) {
      const credits = getVideoCreditsRequired(id);
      expect(credits, `${id} should have positive video credits`).toBeGreaterThan(0);
    }
  });
});
