import { describe, it, expect, afterEach } from 'vitest';
import { resolveFalEndpoint, useFalForKling, buildFalInput } from '../falVideoService.js';

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
      { ...base, startFrame: url, duration: '5s', aspectRatio: '9:16' },
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
