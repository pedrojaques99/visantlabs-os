import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  resolveFalEndpoint,
  useFalForKling,
  buildFalInput,
  centerCropBox,
  getFalUnitPrice,
  getFalBalanceUsd,
} from '../falVideoService.js';

const base = { model: 'kling-v3', prompt: 'x' };

describe('resolveFalEndpoint', () => {
  it('mapeia v3 e omni (o3) por modo e tipo', () => {
    expect(resolveFalEndpoint('kling-v3', 'pro', 'image-to-video')).toBe(
      'fal-ai/kling-video/v3/pro/image-to-video'
    );
    expect(resolveFalEndpoint('kling-v3', 'std', 'text-to-video')).toBe(
      'fal-ai/kling-video/v3/standard/text-to-video'
    );
    expect(resolveFalEndpoint('kling-v3-omni', 'pro', 'image-to-video')).toBe(
      'fal-ai/kling-video/o3/pro/image-to-video'
    );
  });

  it('aceita o nome com ponto do enum (kling-v2.6)', () => {
    expect(resolveFalEndpoint('kling-v2.6', 'pro', 'image-to-video')).toBe(
      'fal-ai/kling-video/v2.6/pro/image-to-video'
    );
  });

  it('devolve null quando o fal não tem a combinação (cai na Kling direta)', () => {
    expect(resolveFalEndpoint('kling-v1-6', 'pro', 'image-to-video')).toBeNull();
    expect(resolveFalEndpoint('kling-v3-omni', '4k', 'image-to-video')).toBeNull();
    expect(resolveFalEndpoint('kling-v2-6', 'std', 'image-to-video')).toBeNull();
  });
});

describe('useFalForKling', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  it('só usa fal com FAL_KEY e sem KLING_PROVIDER=direct', () => {
    delete process.env.FAL_KEY;
    delete process.env.KLING_PROVIDER;
    expect(useFalForKling(base)).toBe(false);
    process.env.FAL_KEY = 'k';
    expect(useFalForKling(base)).toBe(true);
    process.env.KLING_PROVIDER = 'direct';
    expect(useFalForKling(base)).toBe(false);
  });

  it('modelo sem endpoint no fal fica na Kling direta mesmo com FAL_KEY', () => {
    process.env.FAL_KEY = 'k';
    delete process.env.KLING_PROVIDER;
    expect(useFalForKling({ ...base, model: 'kling-v1-6' })).toBe(false);
  });
});

describe('buildFalInput', () => {
  const url = 'https://example.com/a.jpg';

  it('v3 image-to-video: start_image_url, sem áudio por padrão, duração sem "s"', async () => {
    const input = await buildFalInput(
      { ...base, startFrame: url, duration: '5s' },
      'fal-ai/kling-video/v3/pro/image-to-video'
    );
    expect(input).toMatchObject({
      start_image_url: url,
      duration: '5',
      generate_audio: false,
      prompt: 'x',
    });
    expect(input).not.toHaveProperty('aspect_ratio');
  });

  it('omni (o3) usa image_url e não manda negative_prompt/cfg_scale', async () => {
    const input = await buildFalInput(
      { ...base, model: 'kling-v3-omni', startFrame: url, negativePrompt: 'n', cfgScale: 0.7 },
      'fal-ai/kling-video/o3/pro/image-to-video'
    );
    expect(input.image_url).toBe(url);
    expect(input).not.toHaveProperty('start_image_url');
    expect(input).not.toHaveProperty('negative_prompt');
    expect(input).not.toHaveProperty('cfg_scale');
  });

  it('text-to-video leva aspect_ratio; sound=on liga o áudio', async () => {
    const input = await buildFalInput(
      { ...base, aspectRatio: '9:16', sound: 'on' },
      'fal-ai/kling-video/v3/standard/text-to-video'
    );
    expect(input).toMatchObject({ aspect_ratio: '9:16', generate_audio: true });
  });

  it('image-to-video sem frame inicial falha com mensagem clara', async () => {
    await expect(
      buildFalInput({ ...base, mode: 'image_to_video' }, 'fal-ai/kling-video/v3/pro/image-to-video')
    ).rejects.toThrow(/frame inicial/);
  });
});

describe('centerCropBox', () => {
  it('não corta quando a imagem já está na proporção (±2%)', () => {
    expect(centerCropBox(960, 960, '1:1')).toBeNull();
    expect(centerCropBox(1080, 1920, '9:16')).toBeNull();
    expect(centerCropBox(1000, 1000, undefined)).toBeNull();
    expect(centerCropBox(1000, 1000, 'xx')).toBeNull();
  });

  it('quadrado → 9:16 corta as laterais, ao centro', () => {
    expect(centerCropBox(960, 960, '9:16')).toEqual({ left: 210, top: 0, width: 540, height: 960 });
  });

  it('quadrado → 16:9 corta topo e base, ao centro', () => {
    expect(centerCropBox(960, 960, '16:9')).toEqual({ left: 0, top: 210, width: 960, height: 540 });
  });

  it('retrato → 1:1 corta topo e base', () => {
    expect(centerCropBox(1080, 1920, '1:1')).toEqual({
      left: 0,
      top: 420,
      width: 1080,
      height: 1080,
    });
  });
});

describe('getFalUnitPrice', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('lê o preço em US$/segundo da API de pricing do fal e usa cache', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        prices: [{ endpoint_id: 'ep/a', unit_price: 0.14, unit: 'seconds', currency: 'USD' }],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    expect(await getFalUnitPrice('ep/a')).toBe(0.14);
    expect(await getFalUnitPrice('ep/a')).toBe(0.14);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('devolve null (sem lançar) quando a API falha ou a unidade não é segundo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rede')));
    expect(await getFalUnitPrice('ep/b')).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          prices: [{ endpoint_id: 'ep/c', unit_price: 1, unit: 'video', currency: 'USD' }],
        }),
      })
    );
    expect(await getFalUnitPrice('ep/c')).toBeNull();
  });
});

describe('getFalBalanceUsd', () => {
  const original = { ...process.env };
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...original };
  });

  it('lê o saldo em US$; sem FAL_KEY ou em falha devolve null', async () => {
    delete process.env.FAL_KEY;
    expect(await getFalBalanceUsd()).toBeNull();
    process.env.FAL_KEY = 'k';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    expect(await getFalBalanceUsd()).toBeNull();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ credits: { current_balance: 6.22, currency: 'USD' } }),
      })
    );
    expect(await getFalBalanceUsd()).toBe(6.22);
  });
});
