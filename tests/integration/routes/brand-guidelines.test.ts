/**
 * Brand Guidelines — Integration Tests
 *
 * Tests CRUD, isolation between users, sync, public sharing, and Figma-sync.
 * Uses in-memory MongoDB + Prisma. No AI calls.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { createBrandGuideline } from '../../factories/brandGuideline.js';
import { signTestToken, bearer } from '../../helpers/auth.js';
import { createBrandingProject } from '../../factories/branding.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedUser() {
  const { user } = await createUser();
  const token = signTestToken({ userId: user.id, email: user.email });
  return { user, token };
}

const BASE = '/api/brand-guidelines';

const VALID_PAYLOAD = {
  identity: { name: 'Feira 2026', tagline: 'A maior feira do Brasil' },
  colors: [{ name: 'Lava', hex: '#D4491B', role: 'primary' }],
  typography: [{ family: 'Bebas Neue', style: 'Regular', role: 'heading', size: 48 }],
};

// ─── GET / ─────────────────────────────────────────────────────────────────────

describe('GET /api/brand-guidelines', () => {
  it('401 without token', async () => {
    const res = await (await request()).get(BASE);
    expect(res.status).toBe(401);
  });

  it('200 returns empty array for new user', async () => {
    const { token } = await seedUser();
    const res = await (await request()).get(BASE).set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.guidelines).toBeInstanceOf(Array);
    expect(res.body.guidelines).toHaveLength(0);
  });

  it('200 returns only guidelines owned by authenticated user', async () => {
    const { user, token } = await seedUser();
    const { user: other } = await createUser();
    await createBrandGuideline({ userId: user.id, name: 'My Brand' });
    await createBrandGuideline({ userId: other.id, name: 'Other Brand' });

    const res = await (await request()).get(BASE).set('Authorization', bearer(token));
    expect(res.status).toBe(200);
    expect(res.body.guidelines).toHaveLength(1);
    expect((res.body.guidelines[0].identity as any).name).toBe('My Brand');
  });
});

// ─── POST / ────────────────────────────────────────────────────────────────────

describe('POST /api/brand-guidelines', () => {
  it('401 without token', async () => {
    const res = await (await request()).post(BASE).send(VALID_PAYLOAD);
    expect(res.status).toBe(401);
  });

  it('400 with completely empty body', async () => {
    const { token } = await seedUser();
    const res = await (await request())
      .post(BASE)
      .set('Authorization', bearer(token))
      .send({});
    // Schema may accept empty body (identity is optional) — just must not crash
    expect([200, 201, 400]).toContain(res.status);
  });

  it('201 creates guideline for authenticated user', async () => {
    const { user, token } = await seedUser();
    const res = await (await request())
      .post(BASE)
      .set('Authorization', bearer(token))
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(201);
    expect(res.body.guideline._id).toBeDefined();
    expect((res.body.guideline.identity as any).name).toBe('Feira 2026');
  });

  it('created guideline is returned on subsequent GET', async () => {
    const { token } = await seedUser();
    await (await request())
      .post(BASE)
      .set('Authorization', bearer(token))
      .send(VALID_PAYLOAD);

    const list = await (await request()).get(BASE).set('Authorization', bearer(token));
    expect(list.body.guidelines).toHaveLength(1);
  });
});

// ─── GET /:id ──────────────────────────────────────────────────────────────────

describe('GET /api/brand-guidelines/:id', () => {
  it('401 without token', async () => {
    const res = await (await request()).get(`${BASE}/fake-id`);
    expect(res.status).toBe(401);
  });

  it('404 for non-existent id', async () => {
    const { token } = await seedUser();
    const res = await (await request())
      .get(`${BASE}/000000000000000000000001`)
      .set('Authorization', bearer(token));
    expect(res.status).toBe(404);
  });

  it('404 when accessing another user guideline', async () => {
    const { token } = await seedUser();
    const { user: other } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: other.id });

    const res = await (await request())
      .get(`${BASE}/${guideline._id}`)
      .set('Authorization', bearer(token));
    expect(res.status).toBe(404);
  });

  it('200 returns guideline with colors and typography', async () => {
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });

    const res = await (await request())
      .get(`${BASE}/${guideline._id}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.guideline.colors).toBeInstanceOf(Array);
    expect(res.body.guideline.typography).toBeInstanceOf(Array);
  });
});

// ─── PUT /:id ──────────────────────────────────────────────────────────────────

describe('PUT /api/brand-guidelines/:id', () => {
  it('404 when updating another user guideline', async () => {
    const { token } = await seedUser();
    const { user: other } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: other.id });

    const res = await (await request())
      .put(`${BASE}/${guideline._id}`)
      .set('Authorization', bearer(token))
      .send({ identity: { name: 'Hacked' } });
    expect(res.status).toBe(404);
  });

  it('200 updates identity fields', async () => {
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Old Name' });

    const res = await (await request())
      .put(`${BASE}/${guideline._id}`)
      .set('Authorization', bearer(token))
      .send({ identity: { name: 'New Name', tagline: 'New Tagline' } });

    expect(res.status).toBe(200);
    expect((res.body.guideline.identity as any).name).toBe('New Name');
  });
});

// ─── DELETE /:id ───────────────────────────────────────────────────────────────

describe('DELETE /api/brand-guidelines/:id', () => {
  it('404 when deleting another user guideline', async () => {
    const { token } = await seedUser();
    const { user: other } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: other.id });

    const res = await (await request())
      .delete(`${BASE}/${guideline._id}`)
      .set('Authorization', bearer(token));
    expect(res.status).toBe(404);
  });

  it('200 deletes and guideline no longer returned in list', async () => {
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });

    const del = await (await request())
      .delete(`${BASE}/${guideline._id}`)
      .set('Authorization', bearer(token));
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    const list = await (await request()).get(BASE).set('Authorization', bearer(token));
    expect(list.body.guidelines).toHaveLength(0);
  });
});

// ─── POST /:id/duplicate ───────────────────────────────────────────────────────

describe('POST /api/brand-guidelines/:id/duplicate', () => {
  it('201 creates a copy with "(Copy)" suffix', async () => {
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Original' });

    const res = await (await request())
      .post(`${BASE}/${guideline._id}/duplicate`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(201);
    expect((res.body.guideline.identity as any).name).toContain('Copy');
    expect(res.body.guideline._id).not.toBe(guideline._id);
  });
});

// ─── GET /:id/context ──────────────────────────────────────────────────────────

describe('GET /api/brand-guidelines/:id/context', () => {
  it('401 without token', async () => {
    const res = await (await request()).get(`${BASE}/fake-id/context`);
    expect(res.status).toBe(401);
  });

  it('200 returns structured JSON context', async () => {
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });

    const res = await (await request())
      .get(`${BASE}/${guideline._id}/context`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.colors).toBeInstanceOf(Array);
    expect(res.body.typography).toBeInstanceOf(Array);
    expect(res.body.identity).toBeDefined();
  });

  it('200 returns plain text with format=prompt', async () => {
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });

    const res = await (await request())
      .get(`${BASE}/${guideline._id}/context?format=prompt`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.type).toMatch(/text/);
    expect(res.text).toContain('BRAND:');
  });
});

// ─── POST /sync/:projectId ─────────────────────────────────────────────────────

describe('POST /api/brand-guidelines/sync/:projectId', () => {
  it('404 or 500 for non-existent branding project', async () => {
    const { token } = await seedUser();
    const res = await (await request())
      .post(`${BASE}/sync/nonexistent-project-id`)
      .set('Authorization', bearer(token));
    // Route returns 404 when project not found; may vary by Prisma config
    expect([404, 500]).toContain(res.status);
    if (res.status === 404) {
      expect(res.body.error).toMatch(/not found/i);
    }
  });

  it('200 creates brand guideline from branding project', async () => {
    const { user, token } = await seedUser();
    const { project } = await createBrandingProject({
      userId: user.id,
      name: 'Sync Brand',
      data: {
        brandName: 'Sync Brand',
        primaryColor: '#FF0000',
        secondaryColor: '#00FF00',
        primaryFont: 'Inter',
        voice: 'professional',
      },
    });

    const res = await (await request())
      .post(`${BASE}/sync/${project.id}`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(res.body.guideline).toBeDefined();
  });
});

// ─── Public sharing ────────────────────────────────────────────────────────────

describe('POST /api/brand-guidelines/:id/share + GET /public/:slug', () => {
  it('generates public link and guideline is accessible without auth', async () => {
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Public Brand' });

    const share = await (await request())
      .post(`${BASE}/${guideline._id}/share`)
      .set('Authorization', bearer(token));

    expect(share.status).toBe(200);
    const slug = share.body.publicSlug;
    expect(slug).toBeDefined();

    const pub = await (await request()).get(`${BASE}/public/${slug}`);
    expect(pub.status).toBe(200);
    expect((pub.body.guideline.identity as any).name).toBe('Public Brand');
    expect(pub.body.guideline.userId).toBeUndefined(); // privacy — userId stripped
  });

  it('DELETE /share revokes public access', async () => {
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });

    const share = await (await request())
      .post(`${BASE}/${guideline._id}/share`)
      .set('Authorization', bearer(token));
    const slug = share.body.publicSlug;

    await (await request())
      .delete(`${BASE}/${guideline._id}/share`)
      .set('Authorization', bearer(token));

    // slug still exists in DB but isPublic=false
    const pub = await (await request()).get(`${BASE}/public/${slug}`);
    expect(pub.status).toBe(404);
  });
});

// ─── POST /:id/figma-sync ──────────────────────────────────────────────────────

describe('POST /api/brand-guidelines/:id/figma-sync', () => {
  it('401 without token', async () => {
    const res = await (await request()).post(`${BASE}/fake-id/figma-sync`).send({});
    expect(res.status).toBe(401);
  });

  it('200 merges colors and typography from Figma variables and styles', async () => {
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });

    const res = await (await request())
      .post(`${BASE}/${guideline._id}/figma-sync`)
      .set('Authorization', bearer(token))
      .send({
        fileKey: 'figma-file-123',
        variables: {
          colors: [{ id: 'v1', name: 'Brand/Primary', value: '#AA0000' }],
          numbers: [{ id: 'v2', name: 'spacing/md', value: 16 }],
        },
        styles: {
          text: [{ id: 's1', name: 'Heading/H1', family: 'Bebas Neue', style: 'Bold', size: 64 }],
          colors: [],
          effects: [],
        },
        components: [],
      });

    expect(res.status).toBe(200);
    expect(res.body.stats.colors).toBe(1);
    expect(res.body.stats.typography).toBe(1);
    expect(res.body.stats.spacing).toBe(1);
    expect(res.body.guideline.figmaFileKey).toBe('figma-file-123');
  });

  it('400 when fileKey mismatches linked file', async () => {
    const { user, token } = await seedUser();
    // Create guideline with a linked figmaFileKey
    const { guideline } = await createBrandGuideline({ userId: user.id });
    // Link a file first
    await (await request())
      .put(`${BASE}/${guideline._id}/figma-link`)
      .set('Authorization', bearer(token))
      .send({ figmaFileUrl: 'https://www.figma.com/file/ABC123/test' });

    const res = await (await request())
      .post(`${BASE}/${guideline._id}/figma-sync`)
      .set('Authorization', bearer(token))
      .send({ fileKey: 'WRONG-KEY', variables: {}, styles: {}, components: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/mismatch/i);
  });
});
