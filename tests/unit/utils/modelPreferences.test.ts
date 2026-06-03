// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GEMINI_MODELS } from '@/constants/geminiModels';

describe('Model preferences persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  async function loadModule() {
    return await import('@/utils/modelPreferences');
  }

  it('persists and retrieves image model', async () => {
    const m = await loadModule();
    m.setModelPreference('imageModel', GEMINI_MODELS.IMAGE_PRO);
    expect(m.getPreferredImageModel()).toBe(GEMINI_MODELS.IMAGE_PRO);
  });

  it('persists and retrieves chat model', async () => {
    const m = await loadModule();
    m.setModelPreference('chatModel', GEMINI_MODELS.FLASH_3_5);
    expect(m.getPreferredChatModel()).toBe(GEMINI_MODELS.FLASH_3_5);
  });

  it('persists and retrieves video model', async () => {
    const m = await loadModule();
    m.setModelPreference('videoModel', 'veo-3.1-lite-generate-preview');
    expect(m.getPreferredVideoModel()).toBe('veo-3.1-lite-generate-preview');
  });

  it('persists and retrieves image provider', async () => {
    const m = await loadModule();
    m.setModelPreference('imageProvider', 'seedream');
    expect(m.getPreferredImageProvider()).toBe('seedream');
  });

  it('returns empty string for unset preferences', async () => {
    const m = await loadModule();
    expect(m.getPreferredImageModel()).toBe('');
    expect(m.getPreferredChatModel()).toBe('');
    expect(m.getPreferredVideoModel()).toBe('');
  });

  it('returns gemini as default provider', async () => {
    const m = await loadModule();
    expect(m.getPreferredImageProvider()).toBe('gemini');
  });

  it('overwrites previous value', async () => {
    const m = await loadModule();
    m.setModelPreference('imageModel', GEMINI_MODELS.IMAGE_NB2);
    m.setModelPreference('imageModel', GEMINI_MODELS.IMAGE_PRO);
    expect(m.getPreferredImageModel()).toBe(GEMINI_MODELS.IMAGE_PRO);
  });

  it('preserves other keys when setting one', async () => {
    const m = await loadModule();
    m.setModelPreference('imageModel', GEMINI_MODELS.IMAGE_NB2);
    m.setModelPreference('chatModel', GEMINI_MODELS.FLASH_3_5);
    expect(m.getPreferredImageModel()).toBe(GEMINI_MODELS.IMAGE_NB2);
    expect(m.getPreferredChatModel()).toBe(GEMINI_MODELS.FLASH_3_5);
  });

  it('migrates from legacy vsn-preferred-image-model key', async () => {
    localStorage.setItem('vsn-preferred-image-model', GEMINI_MODELS.IMAGE_PRO);
    const m = await loadModule();
    expect(m.getPreferredImageModel()).toBe(GEMINI_MODELS.IMAGE_PRO);
  });

  it('migrates from legacy visantlabs-image-provider key', async () => {
    localStorage.setItem('visantlabs-image-provider', 'seedream');
    const m = await loadModule();
    expect(m.getPreferredImageProvider()).toBe('seedream');
  });

  it('data survives module reload (localStorage persistence)', async () => {
    const m1 = await loadModule();
    m1.setModelPreference('chatModel', GEMINI_MODELS.PRO_3_1);

    vi.resetModules();
    const m2 = await loadModule();
    expect(m2.getPreferredChatModel()).toBe(GEMINI_MODELS.PRO_3_1);
  });
});
