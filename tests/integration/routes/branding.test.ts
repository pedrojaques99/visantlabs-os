import { describe, expect, it, vi, beforeEach } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { signTestToken } from '../../helpers/auth.js';
import { createBrandingProject } from '../../factories/branding.js';
import { ObjectId } from 'mongodb';

// Mock MSW or generic services
vi.mock('../../../src/services/geminiService.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual as any,
  };
});

describe('Branding Routes Integration', () => {

  describe('POST /api/branding/generate-step', () => {
    it('returns 401 if not authenticated', async () => {
      const agent = await request();
      const res = await agent.post('/api/branding/generate-step').send({
        step: 1,
        prompt: 'test prompt'
      });
      expect(res.status).toBe(401);
    });

    it('returns 403 if insufficient credits', async () => {
      const { user } = await createUser({ monthlyCredits: 0 }); // Free default is 20 if we don't pass anything, but via seed we use overrides
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/branding/generate-step')
        .set('Authorization', `Bearer ${token}`)
        .send({
          step: 1,
          prompt: 'A test brand'
        });

      // Free user explicitly initialized with 0 credits and without usage shouldn't generate (Wait, users test factory assigns monthlyCredits: 0)
      // Actually my user factory assigns monthlyCredits = 0 and uses 0? Let's check user.ts factory logic.
      // Assuming 0 credits triggers 403:
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Insufficient credits|free generations|subscribe/i);
    });

    it('deducts credits and generates content for market research (Step 1)', async () => {
      const { user } = await createUser({ monthlyCredits: 20 });
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/branding/generate-step')
        .set('Authorization', `Bearer ${token}`)
        .send({
          step: 1,
          prompt: 'A futuristic tech company'
        });

      if (res.status !== 200) console.log('Generate Error:', res.body);
      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.creditsDeducted).toBe(1);

      // Credits should go down by 1
      const remaining = res.body.creditsRemaining;
      expect(remaining).toBe(19);

      // Verify db state
      const { prisma } = await import('../../../server/db/prisma.js');
      const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
      expect(updatedUser?.creditsUsed).toBe(1);
    });

    it('generates palettes without throwing error if AI format is weird (Step 8)', async () => {
      const { user } = await createUser({ monthlyCredits: 20 });
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/branding/generate-step')
        .set('Authorization', `Bearer ${token}`)
        .send({
          step: 8,
          prompt: 'Tech company',
          previousData: {
            swot: { strengths: [] },
            references: []
          }
        });

      // Since MSW mock returns text, Step 8 (Palettes) fails JSON extraction but handles gracefully.
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.creditsDeducted).toBe(1);
    });
  });

  describe('POST /api/branding/save', () => {
    it('creates a new branding project when no ID provided', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/branding/save')
        .set('Authorization', `Bearer ${token}`)
        .send({
          prompt: 'Coffee shop',
          name: 'Central Perk',
          data: { step1: 'Research' }
        });

      expect(res.status).toBe(200);
      expect(res.body.project).toBeDefined();
      expect(res.body.project.name).toBe('Central Perk');
      expect(res.body.project._id).toBeDefined();
      
      const { prisma } = await import('../../../server/db/prisma.js');
      const saved = await prisma.brandingProject.findUnique({ where: { id: res.body.project._id } });
      expect(saved).not.toBeNull();
    });

    it('updates an existing project', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });
      const { project } = await createBrandingProject({ userId: user.id, name: 'Old Name' });

      const agent = await request();
      const res = await agent
        .post('/api/branding/save')
        .set('Authorization', `Bearer ${token}`)
        .send({
          projectId: project.id,
          prompt: 'Coffee shop',
          name: 'New Name',
          data: { step1: 'Updated' }
        });

      expect(res.status).toBe(200);
      expect(res.body.project.name).toBe('New Name');
      expect(res.body.project.id).toBe(project.id);
    });
  });

  describe('GET /api/branding', () => {
    it('returns only branding projects owned by the user', async () => {
      const { user: user1 } = await createUser();
      const { user: user2 } = await createUser();
      const token = signTestToken({ userId: user1.id, email: user1.email });

      await createBrandingProject({ userId: user1.id, name: 'Brand 1' });
      await createBrandingProject({ userId: user2.id, name: 'Brand 2' });

      const agent = await request();
      const res = await agent
        .get('/api/branding')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.projects)).toBe(true);
      expect(res.body.projects.length).toBe(1);
      expect(res.body.projects[0].name).toBe('Brand 1');
    });
  });

  describe('GET /api/branding/:id', () => {
    it('returns the branding project if owner', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });
      const { project } = await createBrandingProject({ userId: user.id });

      const agent = await request();
      const res = await agent
        .get(`/api/branding/${project.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.project._id).toBe(project.id);
    });

    it('returns 404 for unauthorized access to other user projects', async () => {
      const { user: user1 } = await createUser();
      const { user: user2 } = await createUser();
      const token = signTestToken({ userId: user1.id, email: user1.email });
      const { project } = await createBrandingProject({ userId: user2.id });

      const agent = await request();
      const res = await agent
        .get(`/api/branding/${project.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/branding/track-usage', () => {
    it('logs usage and increments total generations metric without doubling token deduction', async () => {
      const { user } = await createUser({ monthlyCredits: 20 });
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/branding/track-usage')
        .set('Authorization', `Bearer ${token}`)
        .send({
          success: true,
          stepNumber: 1,
          promptLength: 200,
        });

      if (res.status !== 200) console.log('Usage Error:', res.body);
      expect(res.status).toBe(200);
      expect(res.body.creditsDeducted).toBe(1);
      
      const { prisma } = await import('../../../server/db/prisma.js');
      const updatedUser = await prisma.user.findUnique({ where: { id: user.id } });
      // Total monthly credits should have been consumed
      expect(updatedUser?.creditsUsed).toBe(1);
    });
  });
});
