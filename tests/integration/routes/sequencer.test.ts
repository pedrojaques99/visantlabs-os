import { describe, it, expect, beforeEach } from 'vitest';
import { request } from '../../helpers/app.js';
import { signTestToken, bearer } from '../../helpers/auth.js';
import { createUser } from '../../factories/user.js';

let token: string;

async function seedAuth() {
  const { user } = await createUser();
  return signTestToken({ userId: user.id, email: user.email });
}

/** A 1x1 PNG as a data URI — enough to exercise decode + validation paths. */
const PNG_1X1 =
  'data:image/png;base64,' +
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const photos = (n: number) => Array.from({ length: n }, () => PNG_1X1);

describe('sequencer routes', () => {
  beforeEach(async () => {
    token = await seedAuth();
  });

  describe('GET /api/sequencer/health', () => {
    it('reports ffmpeg and storage status', async () => {
      const agent = await request();
      const res = await agent.get('/api/sequencer/health');
      expect(res.status).toBe(200);
      expect(typeof res.body.ffmpeg).toBe('boolean');
      expect(typeof res.body.storage).toBe('boolean');
    });
  });

  describe('POST /api/sequencer', () => {
    it('401 without auth', async () => {
      const agent = await request();
      const res = await agent.post('/api/sequencer').send({ photos: photos(2) });
      expect(res.status).toBe(401);
    });

    it('400 when photos is missing', async () => {
      const agent = await request();
      const res = await agent.post('/api/sequencer').set('Authorization', bearer(token)).send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('photos');
    });

    it('400 when photos is not an array of strings', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/sequencer')
        .set('Authorization', bearer(token))
        .send({ photos: [1, 2, 3] });
      expect(res.status).toBe(400);
    });

    it('400 for an empty photo list', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/sequencer')
        .set('Authorization', bearer(token))
        .send({ photos: [] });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No photos');
    });

    it('400 for an invalid format', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/sequencer')
        .set('Authorization', bearer(token))
        .send({ photos: photos(2), format: 'avi' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('mp4');
    });

    it('400 for an invalid order', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/sequencer')
        .set('Authorization', bearer(token))
        .send({ photos: photos(2), order: 'backwards' });
      expect(res.status).toBe(400);
    });

    it('400 when perPhotoSec is below the floor', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/sequencer')
        .set('Authorization', bearer(token))
        .send({ photos: photos(2), perPhotoSec: 0 });
      expect(res.status).toBe(400);
    });

    it('400 when perPhotoSec is not a number', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/sequencer')
        .set('Authorization', bearer(token))
        .send({ photos: photos(2), perPhotoSec: 'fast' });
      expect(res.status).toBe(400);
    });

    it('400 when a dimension exceeds the cap', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/sequencer')
        .set('Authorization', bearer(token))
        .send({ photos: photos(2), width: 99999, height: 1080 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Max dimension');
    });

    it('400 when the photo count exceeds the cap', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/sequencer')
        .set('Authorization', bearer(token))
        .send({ photos: photos(301), perPhotoSec: 0.02 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Max 300 photos');
    });

    it('400 when the total duration exceeds the cap', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/sequencer')
        .set('Authorization', bearer(token))
        .send({ photos: photos(50), perPhotoSec: 30 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Total duration');
    });

    it('400 when loops is not a whole number', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/sequencer')
        .set('Authorization', bearer(token))
        .send({ photos: photos(2), loops: 2.5 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('whole number');
    });

    it('400 when loops is below 1', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/sequencer')
        .set('Authorization', bearer(token))
        .send({ photos: photos(2), loops: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('at least 1');
    });

    it('400 when loops exceeds the cap', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/sequencer')
        .set('Authorization', bearer(token))
        .send({ photos: photos(2), loops: 11 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('at most 10');
    });

    it('400 when photos × loops exceeds the timeline cap', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/sequencer')
        .set('Authorization', bearer(token))
        .send({ photos: photos(100), loops: 10, perPhotoSec: 0.02 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Photos × loops');
    });

    it('400 when looping pushes the total duration past the cap', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/sequencer')
        .set('Authorization', bearer(token))
        // 20 photos × 4s = 80s on its own (fine); ×10 loops = 800s (over the 600s cap).
        .send({ photos: photos(20), perPhotoSec: 4, loops: 10 });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Total duration');
    });

    it('400 when a photo is not valid base64 content', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/sequencer')
        .set('Authorization', bearer(token))
        .send({ photos: ['data:image/png;base64,'] });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('valid base64');
    });
  });
});
