import { describe, it, expect, beforeEach } from 'vitest';
import { request } from '../../helpers/app.js';
import { signTestToken, bearer } from '../../helpers/auth.js';
import { createUser } from '../../factories/user.js';

let token: string;
let otherToken: string;

async function seedAuth() {
  const { user } = await createUser();
  return {
    token: signTestToken({ userId: user.id, email: user.email }),
    userId: user.id,
  };
}

function buildFrameBuffer(frameSizes: number[]): Buffer {
  let total = 0;
  for (const s of frameSizes) total += 4 + s;
  const buf = Buffer.alloc(total);
  let offset = 0;
  for (const size of frameSizes) {
    buf.writeUInt32LE(size, offset);
    offset += 4;
    for (let i = 0; i < size; i++) buf[offset + i] = 0xff;
    offset += size;
  }
  return buf;
}

describe('render routes', () => {
  beforeEach(async () => {
    const auth1 = await seedAuth();
    const auth2 = await seedAuth();
    token = auth1.token;
    otherToken = auth2.token;
  });

  describe('GET /api/render/health', () => {
    it('returns ffmpeg status', async () => {
      const agent = await request();
      const res = await agent.get('/api/render/health');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('ffmpeg');
      expect(typeof res.body.ffmpeg).toBe('boolean');
    });
  });

  describe('POST /api/render/start', () => {
    it('401 without auth', async () => {
      const agent = await request();
      const res = await agent.post('/api/render/start').send({ width: 1920, height: 1080 });
      expect(res.status).toBe(401);
    });

    it('400 with invalid dimensions', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/render/start')
        .set('Authorization', bearer(token))
        .send({ width: 0, height: 1080 });
      expect(res.status).toBe(400);
    });

    it('400 with NaN dimensions', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/render/start')
        .set('Authorization', bearer(token))
        .send({ width: 'abc', height: 1080 });
      expect(res.status).toBe(400);
    });

    it('200 creates job', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/render/start')
        .set('Authorization', bearer(token))
        .send({ width: 1920, height: 1080 });
      expect(res.status).toBe(200);
      expect(res.body.jobId).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('PUT /api/render/:jobId/frames', () => {
    let jobId: string;

    beforeEach(async () => {
      const agent = await request();
      const res = await agent
        .post('/api/render/start')
        .set('Authorization', bearer(token))
        .send({ width: 640, height: 480 });
      jobId = res.body.jobId;
    });

    it('401 without auth', async () => {
      const agent = await request();
      const res = await agent
        .put(`/api/render/${jobId}/frames`)
        .set('Content-Type', 'application/octet-stream')
        .send(buildFrameBuffer([10]));
      expect(res.status).toBe(401);
    });

    it('404 for unknown job', async () => {
      const agent = await request();
      const res = await agent
        .put('/api/render/nonexistent/frames')
        .set('Authorization', bearer(token))
        .set('Content-Type', 'application/octet-stream')
        .send(buildFrameBuffer([10]));
      expect(res.status).toBe(404);
    });

    it('403 for wrong user', async () => {
      const agent = await request();
      const res = await agent
        .put(`/api/render/${jobId}/frames`)
        .set('Authorization', bearer(otherToken))
        .set('Content-Type', 'application/octet-stream')
        .send(buildFrameBuffer([10]));
      expect(res.status).toBe(403);
    });

    it('400 for empty body', async () => {
      const agent = await request();
      const res = await agent
        .put(`/api/render/${jobId}/frames`)
        .set('Authorization', bearer(token))
        .set('Content-Type', 'application/octet-stream')
        .send(Buffer.alloc(0));
      expect(res.status).toBe(400);
    });

    it('200 accepts valid frames', async () => {
      const agent = await request();
      const res = await agent
        .put(`/api/render/${jobId}/frames`)
        .set('Authorization', bearer(token))
        .set('Content-Type', 'application/octet-stream')
        .set('X-Frame-Start', '0')
        .send(buildFrameBuffer([100, 100, 100]));
      expect(res.status).toBe(200);
      expect(res.body.received).toBe(3);
      expect(res.body.totalFrames).toBe(3);
    });

    it('respects X-Frame-Start header', async () => {
      const agent = await request();
      const res = await agent
        .put(`/api/render/${jobId}/frames`)
        .set('Authorization', bearer(token))
        .set('Content-Type', 'application/octet-stream')
        .set('X-Frame-Start', '10')
        .send(buildFrameBuffer([50]));
      expect(res.status).toBe(200);
      expect(res.body.totalFrames).toBe(11);
    });
  });

  describe('POST /api/render/:jobId/finish', () => {
    let finishJobId: string;

    beforeEach(async () => {
      const agent = await request();
      const res = await agent
        .post('/api/render/start')
        .set('Authorization', bearer(token))
        .send({ width: 640, height: 480 });
      finishJobId = res.body.jobId;
    });

    it('404 for unknown job', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/render/nonexistent/finish')
        .set('Authorization', bearer(token))
        .send({ format: 'mp4', fps: 30 });
      expect(res.status).toBe(404);
    });

    it('400 for invalid format', async () => {
      const agent = await request();
      const res = await agent
        .post(`/api/render/${finishJobId}/finish`)
        .set('Authorization', bearer(token))
        .send({ format: 'avi', fps: 30 });
      expect(res.status).toBe(400);
    });

    it('400 for no frames uploaded', async () => {
      const agent = await request();
      const res = await agent
        .post(`/api/render/${finishJobId}/finish`)
        .set('Authorization', bearer(token))
        .send({ format: 'mp4', fps: 30 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No frames');
    });

    it('400 for invalid fps', async () => {
      const agent = await request();
      const res = await agent
        .post(`/api/render/${finishJobId}/finish`)
        .set('Authorization', bearer(token))
        .send({ format: 'mp4', fps: 120 });
      expect(res.status).toBe(400);
    });
  });
});
