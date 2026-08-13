import { describe, it, expect, vi } from 'vitest';

import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';

// These routes used to accept ONLY `imageBase64`. That is hostile to any MCP
// caller: an agent has to pull the whole file into its context and re-emit the
// bytes, which costs tokens proportional to file size and silently truncates
// past a few thousand characters. Meanwhile every generation endpoint on the
// platform already hands back a URL.
//
// `/upscale` had the mirror problem on the way out: it returned the upscaled
// image as base64. A 4K image as base64 is megabytes of text — unusable as a
// tool response.
//
// So: URL in, URL out.

const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const fetchedUrls: string[] = [];

vi.mock('../../../server/services/geminiService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../server/services/geminiService.js')>();
  return {
    ...actual,
    // Stand in for the network fetch so the test stays offline, while still
    // proving the route routed the URL into the resolver.
    resolveImageBase64: vi.fn(async (image: any) => {
      if (image?.base64) return image.base64;
      fetchedUrls.push(image.url);
      return TINY_PNG_B64;
    }),
    detectGridItems: vi.fn(async () => [{ x: 0, y: 0, w: 10, h: 10 }]),
    upscaleImageMoodboard: vi.fn(async () => TINY_PNG_B64),
  };
});

vi.mock('../../../server/services/r2Service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../server/services/r2Service.js')>();
  return {
    ...actual,
    isR2Configured: () => true,
    uploadImage: vi.fn(async (_b64: string, userId: string, imageId?: string) => {
      return `https://r2.test/${userId}/${imageId}.png`;
    }),
  };
});

vi.mock('../../../server/lib/credits.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../server/lib/credits.js')>();
  return { ...actual, chargeCredits: vi.fn(async () => undefined) };
});

describe('moodboard routes — image input by URL', () => {
  it('detect-grid accepts imageUrl instead of imageBase64', async () => {
    const { user } = await createUser({ isAdmin: true });
    const agent = await request();

    const res = await agent
      .post('/api/moodboard/detect-grid')
      .set('x-mcp-user-id', user.id)
      .send({ imageUrl: 'https://r2.test/some/board.png' });

    expect(res.status).toBe(200);
    expect(res.body.boxes).toHaveLength(1);
    expect(fetchedUrls).toContain('https://r2.test/some/board.png');
  });

  it('detect-grid still accepts imageBase64', async () => {
    const { user } = await createUser({ isAdmin: true });
    const agent = await request();

    const res = await agent
      .post('/api/moodboard/detect-grid')
      .set('x-mcp-user-id', user.id)
      .send({ imageBase64: TINY_PNG_B64 });

    expect(res.status).toBe(200);
    expect(res.body.boxes).toHaveLength(1);
  });

  it('detect-grid rejects a request with neither', async () => {
    const { user } = await createUser({ isAdmin: true });
    const agent = await request();

    const res = await agent
      .post('/api/moodboard/detect-grid')
      .set('x-mcp-user-id', user.id)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/imageUrl/);
  });

  it('upscale accepts imageUrl and returns a URL, not just base64', async () => {
    const { user } = await createUser({ isAdmin: true });
    const agent = await request();

    const res = await agent
      .post('/api/moodboard/upscale')
      .set('x-mcp-user-id', user.id)
      .send({ imageUrl: 'https://r2.test/some/cell.png', size: '4K' });

    expect(res.status).toBe(200);
    expect(res.body.url).toMatch(/^https:\/\/r2\.test\//);
    expect(res.body.size).toBe('4K');
  });

  it('upscale still rejects an invalid size', async () => {
    const { user } = await createUser({ isAdmin: true });
    const agent = await request();

    const res = await agent
      .post('/api/moodboard/upscale')
      .set('x-mcp-user-id', user.id)
      .send({ imageUrl: 'https://r2.test/some/cell.png', size: '8K' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/1K, 2K, or 4K/);
  });
});
