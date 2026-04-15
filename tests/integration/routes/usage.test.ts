import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

// Mock geminiService to avoid actual AI calls
vi.mock('../../../src/services/geminiService.js', () => ({
  generateMockup: vi.fn(async () => ({
    success: true,
    mockupInfo: { 
      imageBase64: 'fake-base64',
      prompt: 'test prompt',
      tags: ['test'],
    }
  })),
  getErrorMessage: (e: any) => e.message || String(e),
}));

// Mock r2Service to avoid actual uploads
vi.mock('../../../server/services/r2Service.js', () => ({
  uploadImage: vi.fn(async () => 'https://r2.example.com/fake-image.png'),
  isR2Configured: vi.fn(() => true),
}));

describe('Usage & Credits Protection', () => {
  let userToken: string;
  let userId: string;

  beforeEach(async () => {
    // Fresh user with 20 monthly credits and 0 used
    const { user } = await createUser({ monthlyCredits: 20, creditsUsed: 0 });
    userId = user.id;
    userToken = signTestToken({ userId: user.id, email: user.email });
  });

  describe('POST /api/mockups/generate', () => {
    it('deducts credits correctly after successful generation', async () => {
      const agent = await request();
      const res = await agent
        .post('/api/mockups/generate')
        .set('Authorization', bearer(userToken))
        .send({
          promptText: 'A high-end mockup',
          aspectRatio: '1:1'
        });
      
      expect(res.status).toBe(200);
      expect(res.body.imageUrl || res.body.imageBase64).toBeDefined();
      
      // Verify credits were deducted in DB (check /usage endpoint)
      const usageRes = await agent
        .get('/api/payments/usage')
        .set('Authorization', bearer(userToken));
      
      expect(usageRes.status).toBe(200);
      // Depending on the model, it deducts N credits. MockupMachine usually deducts 1 or 2.
      expect(usageRes.body.creditsUsed).toBeGreaterThan(0);
    });

    it('blocks generation when credits are insufficient', async () => {
      // Create user with 0 credits
      const { user: brokeUser } = await createUser({ monthlyCredits: 0, creditsUsed: 0 });
      const brokeToken = signTestToken({ userId: brokeUser.id, email: brokeUser.email });
      
      const agent = await request();
      const res = await agent
        .post('/api/mockups/generate')
        .set('Authorization', bearer(brokeToken))
        .send({
          promptText: 'I am broke',
          aspectRatio: '1:1'
        });
      
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/credits|upgrade|limit|subscription/i);
    });
  });

  describe('Usage History', () => {
    it('records a usage record after generation', async () => {
      const agent = await request();
      
      // Trigger a generation
      await agent
        .post('/api/mockups/generate')
        .set('Authorization', bearer(userToken))
        .send({
          promptText: 'History record test',
          aspectRatio: '1:1'
        });
      
      // Check history
      const res = await agent
        .get('/api/usage/history')
        .set('Authorization', bearer(userToken));
      
      expect(res.status).toBe(200);
      expect(res.body.records).toBeDefined();
      expect(res.body.records.length).toBeGreaterThan(0);
      expect(res.body.records[0].feature).toBe('mockupmachine');
    });
  });
});
