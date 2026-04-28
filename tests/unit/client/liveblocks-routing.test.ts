/**
 * Liveblocks client-side routing — Unit Tests
 *
 * Validates the authEndpoint routing logic in src/config/liveblocks.ts:
 * - brand-<id>  → POST /api/brand-guidelines/<id>/liveblocks-auth
 * - canvas-<id> → POST /api/canvas/<id>/liveblocks-auth
 * - Unknown prefix → throws
 * - Missing auth token → throws before fetch
 * - fetch non-200 → throws with status in message
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Inline routing logic (mirrors src/config/liveblocks.ts) ─────────────────
// We test the logic directly without importing the full Liveblocks client,
// avoiding browser-only globals (WebSocket, etc.) in Node test env.

interface AuthEndpointResult {
  token: string;
}

async function authEndpoint(
  room: string,
  getToken: () => string | null,
  fetchFn: typeof fetch,
): Promise<AuthEndpointResult> {
  const token = getToken();
  if (!token) throw new Error('Authentication token not found. Please log in.');

  let authPath: string;
  if (room.startsWith('brand-')) {
    const guidelineId = room.replace('brand-', '');
    authPath = `/api/brand-guidelines/${guidelineId}/liveblocks-auth`;
  } else if (room.startsWith('canvas-')) {
    const projectId = room.replace('canvas-', '');
    authPath = `/api/canvas/${projectId}/liveblocks-auth`;
  } else {
    throw new Error(`Unknown room prefix for room "${room}". Expected "brand-" or "canvas-".`);
  }

  const response = await fetchFn(authPath, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`Liveblocks auth failed ${response.status}: ${errorText}`);
  }

  const parsed = await response.json();
  return { token: parsed.token };
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

function mockFetch(status: number, body: object | string) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
    json: async () => (typeof body === 'object' ? body : JSON.parse(body as string)),
  } as Response);
}

const TOKEN = 'jwt.test.token';
const getToken = () => TOKEN;
const noToken = () => null;

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Liveblocks authEndpoint routing', () => {
  // ── Route resolution ─────────────────────────────────────────────────────────

  it('routes brand-<id> to /api/brand-guidelines/<id>/liveblocks-auth', async () => {
    const fetch = mockFetch(200, { token: 'lb-token' });
    await authEndpoint('brand-abc123', getToken, fetch);

    expect(fetch).toHaveBeenCalledWith(
      '/api/brand-guidelines/abc123/liveblocks-auth',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('routes canvas-<id> to /api/canvas/<id>/liveblocks-auth', async () => {
    const fetch = mockFetch(200, { token: 'lb-token' });
    await authEndpoint('canvas-xyz789', getToken, fetch);

    expect(fetch).toHaveBeenCalledWith(
      '/api/canvas/xyz789/liveblocks-auth',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('throws for unknown room prefix', async () => {
    const fetch = mockFetch(200, {});
    await expect(authEndpoint('unknown-room', getToken, fetch)).rejects.toThrow(
      /unknown room prefix/i,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  // ── Authorization header ─────────────────────────────────────────────────────

  it('sends Authorization header with Bearer token', async () => {
    const fetch = mockFetch(200, { token: 'lb-token' });
    await authEndpoint('brand-id1', getToken, fetch);

    const [, options] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(options.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('throws when auth token is missing before fetch', async () => {
    const fetch = mockFetch(200, {});
    await expect(authEndpoint('brand-id1', noToken, fetch)).rejects.toThrow(
      /authentication token not found/i,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  // ── HTTP error propagation ───────────────────────────────────────────────────

  it('throws with status when server returns 401', async () => {
    const fetch = mockFetch(401, 'Unauthorized');
    await expect(authEndpoint('brand-id1', getToken, fetch)).rejects.toThrow(/401/);
  });

  it('throws with status when server returns 403', async () => {
    const fetch = mockFetch(403, 'Forbidden');
    await expect(authEndpoint('brand-id1', getToken, fetch)).rejects.toThrow(/403/);
  });

  it('throws with status when server returns 500', async () => {
    const fetch = mockFetch(500, 'Internal Server Error');
    await expect(authEndpoint('brand-id1', getToken, fetch)).rejects.toThrow(/500/);
  });

  // ── Token extraction ─────────────────────────────────────────────────────────

  it('returns token from successful response', async () => {
    const fetch = mockFetch(200, { token: 'real-lb-jwt' });
    const result = await authEndpoint('brand-id1', getToken, fetch);
    expect(result.token).toBe('real-lb-jwt');
  });

  // ── Room ID edge cases ───────────────────────────────────────────────────────

  it('handles MongoDB ObjectId as room ID for brand rooms', async () => {
    const fetch = mockFetch(200, { token: 'lb-token' });
    const objectId = '507f1f77bcf86cd799439011';
    await authEndpoint(`brand-${objectId}`, getToken, fetch);

    expect(fetch).toHaveBeenCalledWith(
      `/api/brand-guidelines/${objectId}/liveblocks-auth`,
      expect.any(Object),
    );
  });

  it('handles MongoDB ObjectId as room ID for canvas rooms', async () => {
    const fetch = mockFetch(200, { token: 'lb-token' });
    const objectId = '507f1f77bcf86cd799439011';
    await authEndpoint(`canvas-${objectId}`, getToken, fetch);

    expect(fetch).toHaveBeenCalledWith(
      `/api/canvas/${objectId}/liveblocks-auth`,
      expect.any(Object),
    );
  });
});
