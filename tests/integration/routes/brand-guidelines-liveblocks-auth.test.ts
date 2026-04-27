/**
 * Brand Guidelines — Liveblocks Auth Endpoint (HTTP integration)
 *
 * Tests POST /api/brand-guidelines/:id/liveblocks-auth end-to-end:
 * - Token structure returned by the real Liveblocks SDK
 * - Permission boundaries (FULL_ACCESS owner, FULL_ACCESS editor, READ_ACCESS viewer)
 * - 401 / 403 / 404 guards
 * - 503 when LIVEBLOCKS_SECRET_KEY is absent
 * - Room ID is correctly formed as `brand-<id>`
 *
 * The Liveblocks SDK makes an outbound HTTPS call to api.liveblocks.io during
 * session.authorize(). We intercept it with `vi.mock` so tests never hit the
 * real network and work in CI without credentials.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { createBrandGuideline } from '../../factories/brandGuideline.js';
import { signTestToken, bearer } from '../../helpers/auth.js';

// ─── Mock @liveblocks/node ────────────────────────────────────────────────────
// We mock at the module level so the route import picks up our fake.
// The mock must be hoisted — vi.mock() calls are hoisted by vitest.

const mockAuthorize = vi.fn();
const mockAllow = vi.fn();
const mockPrepareSession = vi.fn(() => ({
  allow: mockAllow,
  authorize: mockAuthorize,
  FULL_ACCESS: ['room:write', 'comments:write'],
  READ_ACCESS: ['room:read', 'room:presenceWrite'],
}));

vi.mock('@liveblocks/node', async (importOriginal) => {
  const original = await importOriginal<typeof import('@liveblocks/node')>();
  return {
    ...original,
    // Regular function so `new Liveblocks()` works correctly as a constructor.
    Liveblocks: vi.fn(function (this: any) {
      this.prepareSession = mockPrepareSession;
    }),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedUser() {
  const { user } = await createUser();
  const token = signTestToken({ userId: user.id, email: user.email });
  return { user, token };
}

const FAKE_LB_TOKEN = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.fake.liveblocks-token';

function mockLiveblocksSuccess() {
  mockAuthorize.mockResolvedValue({ body: FAKE_LB_TOKEN, status: 200 });
}

function mockLiveblocksFailure() {
  mockAuthorize.mockResolvedValue({ body: 'Unauthorized', status: 401 });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/brand-guidelines/:id/liveblocks-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LIVEBLOCKS_SECRET_KEY = 'sk_test_fake_key_for_tests';
  });

  // ── Auth guards ─────────────────────────────────────────────────────────────

  it('401 when no token is provided', async () => {
    const { user } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });

    const res = await (await request()).post(`/api/brand-guidelines/${guideline.id}/liveblocks-auth`);
    expect(res.status).toBe(401);
  });

  it('404 when guideline does not exist', async () => {
    mockLiveblocksSuccess();
    const { token } = await seedUser();
    const nonExistentId = '000000000000000000000001';

    const res = await (await request())
      .post(`/api/brand-guidelines/${nonExistentId}/liveblocks-auth`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it('403 when user has no access to the guideline', async () => {
    const { user: owner } = await seedUser();
    const { token: strangerToken } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: owner.id });

    const res = await (await request())
      .post(`/api/brand-guidelines/${guideline.id}/liveblocks-auth`)
      .set('Authorization', bearer(strangerToken));

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/access denied/i);
    expect(mockPrepareSession).not.toHaveBeenCalled();
  });

  it('503 when LIVEBLOCKS_SECRET_KEY is not set', async () => {
    delete process.env.LIVEBLOCKS_SECRET_KEY;

    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });

    const res = await (await request())
      .post(`/api/brand-guidelines/${guideline.id}/liveblocks-auth`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/not configured/i);
  });

  // ── Permission model ─────────────────────────────────────────────────────────

  it('owner receives Liveblocks token with FULL_ACCESS', async () => {
    mockLiveblocksSuccess();
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });

    const res = await (await request())
      .post(`/api/brand-guidelines/${guideline.id}/liveblocks-auth`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(200);
    expect(mockPrepareSession).toHaveBeenCalledWith(user.id, expect.objectContaining({
      userInfo: expect.objectContaining({ email: user.email }),
    }));
    // FULL_ACCESS path: session.allow called with FULL_ACCESS permissions
    expect(mockAllow).toHaveBeenCalledWith(
      `brand-${guideline.id}`,
      expect.arrayContaining(['room:write']),
    );
  });

  it('editor (in canEdit) receives FULL_ACCESS', async () => {
    mockLiveblocksSuccess();
    const { user: owner } = await seedUser();
    const { user: editor, token: editorToken } = await seedUser();
    const { guideline } = await createBrandGuideline({
      userId: owner.id,
      canEdit: [editor.id],
    });

    const res = await (await request())
      .post(`/api/brand-guidelines/${guideline.id}/liveblocks-auth`)
      .set('Authorization', bearer(editorToken));

    expect(res.status).toBe(200);
    expect(mockAllow).toHaveBeenCalledWith(
      `brand-${guideline.id}`,
      expect.arrayContaining(['room:write']),
    );
  });

  it('viewer (in canView) receives READ_ACCESS', async () => {
    mockLiveblocksSuccess();
    const { user: owner } = await seedUser();
    const { user: viewer, token: viewerToken } = await seedUser();
    const { guideline } = await createBrandGuideline({
      userId: owner.id,
      canView: [viewer.id],
    });

    const res = await (await request())
      .post(`/api/brand-guidelines/${guideline.id}/liveblocks-auth`)
      .set('Authorization', bearer(viewerToken));

    expect(res.status).toBe(200);
    expect(mockAllow).toHaveBeenCalledWith(
      `brand-${guideline.id}`,
      expect.arrayContaining(['room:read']),
    );
    // Must NOT grant write access to a viewer
    const [, permissions] = mockAllow.mock.calls[0];
    expect(permissions).not.toContain('room:write');
  });

  it('user in both canEdit and canView gets FULL_ACCESS (edit wins)', async () => {
    mockLiveblocksSuccess();
    const { user: owner } = await seedUser();
    const { user: editor, token: editorToken } = await seedUser();
    const { guideline } = await createBrandGuideline({
      userId: owner.id,
      canEdit: [editor.id],
      canView: [editor.id],
    });

    const res = await (await request())
      .post(`/api/brand-guidelines/${guideline.id}/liveblocks-auth`)
      .set('Authorization', bearer(editorToken));

    expect(res.status).toBe(200);
    expect(mockAllow).toHaveBeenCalledWith(
      `brand-${guideline.id}`,
      expect.arrayContaining(['room:write']),
    );
  });

  // ── Room ID contract ─────────────────────────────────────────────────────────

  it('room ID is always brand-<guidelineId>', async () => {
    mockLiveblocksSuccess();
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });

    await (await request())
      .post(`/api/brand-guidelines/${guideline.id}/liveblocks-auth`)
      .set('Authorization', bearer(token));

    const [roomId] = mockAllow.mock.calls[0];
    expect(roomId).toBe(`brand-${guideline.id}`);
  });

  // ── Liveblocks SDK failure propagation ───────────────────────────────────────

  it('forwards non-200 status from Liveblocks SDK', async () => {
    mockLiveblocksFailure();
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });

    const res = await (await request())
      .post(`/api/brand-guidelines/${guideline.id}/liveblocks-auth`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(401);
  });

  it('returns 500 when Liveblocks SDK throws', async () => {
    mockAuthorize.mockRejectedValue(new Error('Network error'));
    const { user, token } = await seedUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });

    const res = await (await request())
      .post(`/api/brand-guidelines/${guideline.id}/liveblocks-auth`)
      .set('Authorization', bearer(token));

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/failed to authenticate/i);
  });
});
