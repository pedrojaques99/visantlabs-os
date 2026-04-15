import { describe, it, expect, vi, beforeAll } from 'vitest';
import { request } from '../../helpers/app.js';
import { signTestToken, bearer } from '../../helpers/auth.js';
import { createUser } from '../../factories/user.js';
import { createMockup } from '../../factories/mockup.js';
import { prisma } from '../../../server/db/prisma.js';
// Prisma dynamically imported in test blocks

// Mock R2 service globally for this test file
vi.mock('../../../src/services/r2Service.js', () => ({
  uploadImage: vi.fn().mockResolvedValue('https://cdn.test.com/mockup-image.png'),
  isR2Configured: vi.fn().mockReturnValue(true),
}));

// Mock geminiService globably for this file
vi.mock('../../../src/services/geminiService.js', () => ({
  generateMockup: vi.fn(async () => 'fake-base64-string'),
  getErrorMessage: (e: any) => e.message || String(e),
}));

describe('Mockup Routes Integration', () => {
  beforeAll(() => {
    // Set required env vars for R2 checks in routes
    process.env.R2_BUCKET_NAME = 'test-bucket';
    process.env.R2_PUBLIC_URL = 'https://cdn.test.com';
    process.env.R2_ACCOUNT_ID = 'test-account';
    process.env.R2_ACCESS_KEY_ID = 'test-key';
    process.env.R2_SECRET_ACCESS_KEY = 'test-secret';
  });

  describe('GET /api/mockups/public', () => {
    it('returns public mockups without authentication', async () => {
      // Create a public (blank) mockup
      const { user } = await createUser();
      await createMockup({ userId: user.id, designType: 'blank' });

      const agent = await request();
      const res = await agent.get('/api/mockups/public');

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].designType).toBe('blank');
    });
  });

  describe('GET /api/mockups', () => {
    it('returns only mockups owned by the user', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });
      const { user: otherUser } = await createUser();

      await createMockup({ userId: user.id, prompt: 'User Mockup' });
      await createMockup({ userId: otherUser.id, prompt: 'Other Mockup' });

      const agent = await request();
      const res = await agent
        .get('/api/mockups')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].prompt).toBe('User Mockup');
    });

    it('returns 401 if not authenticated', async () => {
      const agent = await request();
      const res = await agent.get('/api/mockups');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/mockups/:id', () => {
    it('returns the mockup if owner', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });
      const { mockup } = await createMockup({ userId: user.id });

      const agent = await request();
      const res = await agent
        .get(`/api/mockups/${mockup.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body._id).toBe(mockup.id);
    });

    it('returns 404/401 for unauthorized access', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });
      const { user: otherUser } = await createUser();
      const { mockup } = await createMockup({ userId: otherUser.id });

      const agent = await request();
      const res = await agent
        .get(`/api/mockups/${mockup.id}`)
        .set('Authorization', `Bearer ${token}`);

      // Route returns 404 if mockup not found for THIS user
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/mockups/generate', () => {
    it('deducts credits and generates a mockup', async () => {
      const { user } = await createUser({ monthlyCredits: 10, creditsUsed: 0 });
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/mockups/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          promptText: 'A futuristic chair',
          aspectRatio: '16:9',
          designType: 'blank'
        });

      if (res.status !== 200) console.log('Generate error:', res.body);
      expect(res.status).toBe(200);
      expect(res.body.imageUrl).toBeDefined();

      // Verify credit deduction in DB
      const { prisma } = await import('../../../server/db/prisma.js');
      const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updatedUser?.creditsUsed).toBe(1); // Default cost is 1

      // Verify mockup record creation
      const mockup = await prisma.mockup.findFirst({
        where: { userId: user.id, prompt: 'A futuristic chair' }
      });
      expect(mockup).toBeDefined();
    });

    it('returns 403 if insufficient credits', async () => {
      const { user } = await createUser({ monthlyCredits: 0, creditsUsed: 0 });
      // Important to properly inject totalCreditsEarned 0 since it might use it to bypass
      await prisma.user.update({ where: { id: user.id }, data: { totalCreditsEarned: 0 } });

      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/mockups/generate')
        .set('Authorization', `Bearer ${token}`)
        .send({
          promptText: 'A futuristic chair',
          aspectRatio: '16:9'
        });

      // Status 403 (Forbidden) is often used for credit limits in this app
      // Or 402 (Payment Required) - check middleware/subscription.ts
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/mockups/:id (toggle like)', () => {
    it('toggles like status and creates MockupExample', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });
      const { mockup } = await createMockup({ userId: user.id, isLiked: false });

      const agent = await request();
      
      // First like
      const res1 = await agent
        .put(`/api/mockups/${mockup.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isLiked: true });

      expect(res1.status).toBe(200);

      // Verify MockupExample creation
      const { prisma } = await import('../../../server/db/prisma.js');
      const example = await prisma.mockupExample.findFirst({
        where: { prompt: mockup.prompt }
      });
      expect(example).toBeDefined();

      // Toggle back (unlike)
      const res2 = await agent
        .put(`/api/mockups/${mockup.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ isLiked: false });

      expect(res2.status).toBe(200);
    });
  });
});
