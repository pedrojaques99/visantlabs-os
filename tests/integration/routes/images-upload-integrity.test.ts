import { describe, it, expect, vi } from 'vitest';

import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';

// Integration test for the integrity guard on POST /api/images/upload.
//
// Why this guard exists: the only way to feed this endpoint is base64 in the
// request body, so an LLM agent has to re-emit the file's bytes itself. Past a
// few thousand characters it truncates them. `Buffer.from(x, 'base64')` drops an
// invalid tail WITHOUT throwing, so the route happily stored a cut-off image and
// answered 200 with a URL that does not open. The failure was invisible.
//
// The guard must thread a needle:
//   - reject a truncated png/jpeg/webp                       (the bug)
//   - never reject a payload just because the declared
//     contentType disagrees with the bytes                   (several internal
//     callers hardcode 'image/png' while the renderer returns JPEG — that has
//     always worked and must keep working)
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

// 1x1 transparent PNG — complete, ends with the IEND chunk.
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Same PNG with the tail cut off — exactly what a truncated transfer produces. */
function truncatedPng(): string {
  const buf = Buffer.from(TINY_PNG, 'base64');
  return buf.subarray(0, buf.length - 20).toString('base64');
}

/** Minimal complete JPEG: SOI + a comment segment + EOI. */
function tinyJpeg(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x04, 0x41, 0x42, 0xff, 0xd9, 0x00, 0x00]);
}

describe('POST /api/images/upload — integrity guard', () => {
  it('rejects a truncated PNG instead of storing a broken image', async () => {
    const { user } = await createUser({ isAdmin: true });
    const agent = await request();

    const res = await agent
      .post('/api/images/upload')
      .set('x-mcp-user-id', user.id)
      .send({ data: truncatedPng(), contentType: 'image/png' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('truncated_image');
  });

  it('rejects when the declared byte length does not match what was decoded', async () => {
    const { user } = await createUser({ isAdmin: true });
    const agent = await request();

    const res = await agent
      .post('/api/images/upload')
      .set('x-mcp-user-id', user.id)
      .send({ data: TINY_PNG, contentType: 'image/png', bytes: 999999 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('integrity_mismatch');
    expect(res.body.decoded).toBe(Buffer.from(TINY_PNG, 'base64').length);
  });

  it('rejects when the declared sha256 does not match', async () => {
    const { user } = await createUser({ isAdmin: true });
    const agent = await request();

    const res = await agent
      .post('/api/images/upload')
      .set('x-mcp-user-id', user.id)
      .send({ data: TINY_PNG, contentType: 'image/png', sha256: 'a'.repeat(64) });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('integrity_mismatch');
  });

  it('accepts a correct sha256 + byte length', async () => {
    const { createHash } = await import('crypto');
    const buf = Buffer.from(TINY_PNG, 'base64');
    const { user } = await createUser({ isAdmin: true });
    const agent = await request();

    const res = await agent
      .post('/api/images/upload')
      .set('x-mcp-user-id', user.id)
      .send({
        data: TINY_PNG,
        contentType: 'image/png',
        bytes: buf.length,
        sha256: createHash('sha256').update(buf).digest('hex'),
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // The regression this guard could easily have introduced.
  it('still accepts JPEG bytes declared as image/png', async () => {
    const { user } = await createUser({ isAdmin: true });
    const agent = await request();

    const res = await agent
      .post('/api/images/upload')
      .set('x-mcp-user-id', user.id)
      .send({ data: tinyJpeg().toString('base64'), contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('still accepts unrecognised bytes, as it did before the guard', async () => {
    const { user } = await createUser({ isAdmin: true });
    const agent = await request();

    const res = await agent
      .post('/api/images/upload')
      .set('x-mcp-user-id', user.id)
      .send({ data: Buffer.from('definitely not an image').toString('base64') });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
