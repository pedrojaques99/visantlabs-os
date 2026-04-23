import { describe, it, expect, vi, beforeEach } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

// Mock r2Service
vi.mock('../../../server/services/r2Service.js', () => ({
  getUserStorageLimit: (tier: string, isAdmin: boolean) => {
    if (isAdmin) return Number.MAX_SAFE_INTEGER;
    return tier === 'premium' ? 1024 * 1024 * 1024 : 100 * 1024 * 1024;
  },
  syncUserStorage: vi.fn(async () => 5000),
  calculateUserStorage: vi.fn(async () => 5000),
  isR2Configured: vi.fn(() => true),
}));

describe('Storage Routes', () => {
  let userToken: string;
  let adminToken: string;
  let userId: string;

  beforeEach(async () => {
    const { user: normalUser } = await createUser({ subscriptionTier: 'free', storageUsedBytes: 1000 });
    const { user: adminUser } = await createUser({ isAdmin: true, storageUsedBytes: 2000 });
    
    userId = normalUser.id;
    userToken = signTestToken({ userId: normalUser.id, email: normalUser.email });
    adminToken = signTestToken({ userId: adminUser.id, email: adminUser.email });
  });

  describe('GET /api/storage/usage', () => {
    it('returns storage usage for normal user', async () => {
      const agent = await request();
      const res = await agent.get('/api/storage/usage').set('Authorization', bearer(userToken));
      
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        used: 1000,
        limit: 100 * 1024 * 1024,
        tier: 'free',
        isAdmin: false
      });
      expect(res.body.formatted).toBeDefined();
    });

    it('returns storage usage for admin user', async () => {
      const agent = await request();
      const res = await agent.get('/api/storage/usage').set('Authorization', bearer(adminToken));
      
      expect(res.status).toBe(200);
      expect(res.body.isAdmin).toBe(true);
      expect(res.body.limit).toBeGreaterThan(1024 * 1024 * 1024);
    });

    it('triggers sync when requested', async () => {
      const agent = await request();
      const res = await agent
        .get('/api/storage/usage?sync=true')
        .set('Authorization', bearer(userToken));
      
      expect(res.status).toBe(200);
      expect(res.body.used).toBe(5000); // Value from mock syncUserStorage
      expect(res.body.synced).toBe(true);
    });

    it('returns 401 for anonymous', async () => {
      const agent = await request();
      const res = await agent.get('/api/storage/usage');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/storage/sync', () => {
    it('synchronizes storage and returns updated info', async () => {
      const agent = await request();
      const res = await agent.post('/api/storage/sync').set('Authorization', bearer(userToken));
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.used).toBe(5000);
      expect(res.body.message).toContain('synchronized');
    });

    it('returns 401 for anonymous', async () => {
      const agent = await request();
      const res = await agent.post('/api/storage/sync');
      expect(res.status).toBe(401);
    });
  });
});
