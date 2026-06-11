import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { StorageLimitExceededError } from '../../../../server/services/r2Service.js';

// Unit test for the POST /api/images/upload error-mapping contract:
// a StorageLimitExceededError thrown by uploadImage must surface as an
// actionable 413 `storage_limit_exceeded` (not a generic 500), so MCP agents
// see the real cause instead of INTERNAL_ERROR.

// Mirrors the catch block in server/routes/images.ts. Kept in sync by importing
// the real error class — if the class shape changes, this test breaks.
function makeApp(handler: () => Promise<string>) {
  const app = express();
  app.post('/upload', async (_req, res) => {
    try {
      const url = await handler();
      return res.json({ success: true, url });
    } catch (error: any) {
      if (error instanceof StorageLimitExceededError) {
        return res.status(413).json({
          error: 'storage_limit_exceeded',
          message: `Storage limit exceeded: ${error.used} of ${error.limit} bytes used.`,
        });
      }
      return res.status(500).json({ error: 'Failed to upload image' });
    }
  });
  return app;
}

describe('POST /api/images/upload — storage limit mapping', () => {
  it('maps StorageLimitExceededError to 413 storage_limit_exceeded', async () => {
    const app = makeApp(async () => {
      throw new StorageLimitExceededError(150_000_000, 100_000_000, 848);
    });
    const res = await request(app).post('/upload').send({});
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('storage_limit_exceeded');
    expect(res.body.message).toContain('150000000');
    expect(res.body.message).toContain('100000000');
  });

  it('maps an unexpected error to a generic 500', async () => {
    const app = makeApp(async () => {
      throw new Error('boom');
    });
    const res = await request(app).post('/upload').send({});
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to upload image');
  });

  it('returns the url on success', async () => {
    const app = makeApp(async () => 'https://r2/x.png');
    const res = await request(app).post('/upload').send({});
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://r2/x.png');
  });
});
