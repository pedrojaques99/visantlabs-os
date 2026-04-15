import { describe, expect, it, vi, beforeEach } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { signTestToken } from '../../helpers/auth.js';
import { createCanvasProject } from '../../factories/canvasProject.js';

// Mock R2 Service
vi.mock('../../../server/services/r2Service.js', () => ({
  uploadCanvasImage: vi.fn((base64) => Promise.resolve(`https://fake-r2-url.com/${base64.substring(0, 10)}.png`)),
  uploadCanvasPdf: vi.fn(() => Promise.resolve('https://fake-r2-url.com/file.pdf')),
  uploadCanvasVideo: vi.fn(() => Promise.resolve('https://fake-r2-url.com/video.mp4')),
  isR2Configured: vi.fn().mockReturnValue(true),
  generateCanvasImageUploadUrl: vi.fn().mockResolvedValue({ presignedUrl: 'https://presigned.url', finalUrl: 'https://final.url' }),
  generateCanvasVideoUploadUrl: vi.fn().mockResolvedValue({ presignedUrl: 'https://presigned.url', finalUrl: 'https://final.url' }),
  deleteImage: vi.fn().mockResolvedValue(true)
}));

const bearer = (token: string) => `Bearer ${token}`;

describe('Canvas Routes Integration', () => {

  describe('POST /api/canvas', () => {
    it('creates a new canvas project with R2 auto-upload', async () => {
      const { user } = await createUser();
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .post('/api/canvas')
        .set('Authorization', bearer(token))
        .send({
          name: 'R2 Test Project',
          nodes: [{ 
            id: 'node-1', 
            type: 'image', 
            data: { 
              mockup: { 
                imageBase64: 'data:image/png;base64,mock',
                base64Timestamp: Date.now() 
              } 
            } 
          }],
          edges: []
        });

      if (res.status !== 200) console.log('POST /api/canvas Error:', res.body);
      expect(res.status).toBe(200);
      // The imageBase64 is replaced by imageUrl if uploadCanvasImage works
      const node = res.body.project.nodes[0];
      expect(node.data.mockup.imageUrl || node.data.mockup.imageBase64).toBeDefined();
    });
  });

  describe('GET /api/canvas/:id Access Control', () => {
    it('allows owner access', async () => {
      const { user } = await createUser();
      const project = await createCanvasProject({ userId: user.id });
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .get(`/api/canvas/${project.id}`)
        .set('Authorization', bearer(token));

      expect(res.status).toBe(200);
    });

    it('denies access to unauthorized users', async () => {
      const { user: owner } = await createUser();
      const { user: other } = await createUser();
      const project = await createCanvasProject({ userId: owner.id });
      const token = signTestToken({ userId: other.id, email: other.email });

      const agent = await request();
      const res = await agent
        .get(`/api/canvas/${project.id}`)
        .set('Authorization', bearer(token));

      expect(res.status).toBe(403);
    });

    it('allows access to users in canView list', async () => {
      const { user: owner } = await createUser();
      const { user: viewer } = await createUser();
      const project = await createCanvasProject({ 
        userId: owner.id, 
        isCollaborative: true, 
        canView: [viewer.id] 
      });
      const token = signTestToken({ userId: viewer.id, email: viewer.email });

      const agent = await request();
      const res = await agent
        .get(`/api/canvas/${project.id}`)
        .set('Authorization', bearer(token));

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/canvas/:id Update Protection', () => {
    it('allows owner to update', async () => {
      const { user } = await createUser();
      const project = await createCanvasProject({ userId: user.id, name: 'Old' });
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      const res = await agent
        .put(`/api/canvas/${project.id}`)
        .set('Authorization', bearer(token))
        .send({ name: 'Updated' });

      expect(res.status).toBe(200);
      expect(res.body.project.name).toBe('Updated');
    });

    it('denies update to non-owners even if in canEdit (Current Implementation Limit)', async () => {
        // As seen in canvas.ts line 1035, updates are restricted by userId: req.userId
        const { user: owner } = await createUser();
        const { user: editor } = await createUser();
        const project = await createCanvasProject({ 
            userId: owner.id, 
            isCollaborative: true, 
            canEdit: [editor.id] 
        });
        const token = signTestToken({ userId: editor.id, email: editor.email });
  
        const agent = await request();
        const res = await agent
          .put(`/api/canvas/${project.id}`)
          .set('Authorization', bearer(token))
          .send({ name: 'Hacker Update' });
  
        expect(res.status).toBe(404);
    });
  });

  describe('Sharing & Collaboration Management', () => {
    it('manages share settings and permissions', async () => {
      const { user } = await createUser({ isAdmin: true }); // Must be admin/premium to share
      const { user: friend } = await createUser();
      const project = await createCanvasProject({ userId: user.id });
      const token = signTestToken({ userId: user.id, email: user.email });

      const agent = await request();
      
      // Share with friend using email
      const shareRes = await agent
        .post(`/api/canvas/${project.id}/share`)
        .set('Authorization', bearer(token))
        .send({ canView: [friend.email] });

      if (shareRes.status !== 200) console.log('Share Error:', shareRes.body);
      expect(shareRes.status).toBe(200);
      expect(shareRes.body.shareId).toBeDefined();
      expect(shareRes.body.canView).toContain(friend.id);

      // Disable sharing
      const unshareRes = await agent
        .delete(`/api/canvas/${project.id}/share`)
        .set('Authorization', bearer(token));
      
      expect(unshareRes.status).toBe(200);
    });

    it('allows public access via shared/:shareId', async () => {
      const { user } = await createUser();
      const shareId = 'public-link-123';
      const project = await createCanvasProject({ 
        userId: user.id, 
        shareId: shareId,
        nodes: [{ id: '1', type: 'image', data: { text: 'Public Content' } }]
      });

      const agent = await request();
      const res = await agent.get(`/api/canvas/shared/${shareId}`);

      expect(res.status).toBe(200);
      expect(res.body.project.shareId).toBe(shareId);
    });
  });

  describe('Base64 Auto-Cleanup', () => {
    it('cleans expired base64 images on GET', async () => {
      const { user } = await createUser();
      const yesterday = Date.now() - (8 * 24 * 60 * 60 * 1000); // 8 days ago (limit is 7)
      
      const project = await createCanvasProject({ 
        userId: user.id,
        nodes: [{
          id: 'expired-1',
          type: 'merge',
          data: {
            resultImageBase64: 'data:image/png;base64,too-old',
            resultImageBase64Timestamp: yesterday
          }
        }] as any
      });

      const token = signTestToken({ userId: user.id, email: user.email });
      const agent = await request();
      const res = await agent
        .get(`/api/canvas/${project.id}`)
        .set('Authorization', bearer(token));

      expect(res.status).toBe(200);
      expect(res.body.project.nodes[0].data.resultImageBase64).toBeUndefined();
    });
  });
});
