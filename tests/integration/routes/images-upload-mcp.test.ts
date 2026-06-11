import { describe, it, expect, vi } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';

// Integration test for the MCP path of POST /api/images/upload.
//
// The MCP auth path (x-mcp-user-id header, trusted from localhost) only sets
// req.userId — never req.isAdmin or the subscription tier. The route must
// therefore resolve the user from Prisma itself and pass tier + isAdmin to
// uploadImage, otherwise admins/premium users are wrongly treated as free and
// hit the 100MB storage cap on every call (the original INTERNAL_ERROR bug).
//
// We keep the REAL r2Service (real checkStorageLimit, real StorageLimitExceededError,
// real getUserStorageLimit reading storageUsedBytes from Prisma) and override only
// the two pieces that would touch the network: uploadImage's S3 PutObject and the
// R2-configured probe. The mocked uploadImage re-runs the real storage gate so the
// route's tier/isAdmin resolution is genuinely exercised.
vi.mock('../../../server/services/r2Service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../server/services/r2Service.js')>();
  return {
    ...actual,
    isR2Configured: () => true,
    uploadImage: vi.fn(
      async (
        base64Image: string,
        userId: string,
        imageId?: string,
        subscriptionTier?: string,
        isAdmin?: boolean
      ) => {
        // Real storage gate — admins bypass, free users over cap throw the real error.
        if (isAdmin !== true) {
          const buffer = Buffer.from(base64Image, 'base64');
          const check = await actual.checkStorageLimit(
            userId,
            buffer.length,
            subscriptionTier,
            isAdmin
          );
          if (!check.allowed) {
            throw new actual.StorageLimitExceededError(check.used, check.limit, buffer.length);
          }
        }
        return `https://r2.test/${userId}/${imageId}.png`;
      }
    ),
  };
});

// A 1x1 transparent PNG.
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

describe('POST /api/images/upload — MCP path (x-mcp-user-id)', () => {
  it('returns 413 storage_limit_exceeded for a free user over the cap', async () => {
    const { user } = await createUser({
      subscriptionTier: 'free',
      storageUsedBytes: 200 * 1024 * 1024, // 200MB — over the 100MB free cap
    });

    const agent = await request();
    const res = await agent
      .post('/api/images/upload')
      .set('x-mcp-user-id', user.id)
      .send({ data: TINY_PNG, contentType: 'image/png' });

    expect(res.status).toBe(413);
    expect(res.body.error).toBe('storage_limit_exceeded');
    expect(res.body.message).toMatch(/storage limit exceeded/i);
  });

  it('lets an admin upload successfully despite high storage usage', async () => {
    const { user } = await createUser({
      isAdmin: true,
      storageUsedBytes: 500 * 1024 * 1024, // 500MB — would fail any non-admin cap
    });

    const agent = await request();
    const res = await agent
      .post('/api/images/upload')
      .set('x-mcp-user-id', user.id)
      .send({ data: TINY_PNG, contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.url).toContain(user.id);
  });
});
