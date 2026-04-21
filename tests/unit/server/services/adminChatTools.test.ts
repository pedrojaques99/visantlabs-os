import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock prisma BEFORE importing the tool module
vi.mock('../../../../server/db/prisma.js', () => ({
  prisma: {
    creativeProject: {
      create: vi.fn(async ({ data }: any) => ({ id: 'cp-test-id', ...data })),
      update: vi.fn(async ({ where }: any) => ({ id: where.id })),
    },
  },
}));

import { executeAdminChatTool } from '../../../../server/services/adminChatTools.js';

describe('executeAdminChatTool', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls /api/mockups/generate with an ABSOLUTE URL (not relative)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ imageUrl: 'https://cdn.test/x.png', creditsDeducted: 1, creditsRemaining: 10 }),
    } as any);

    await executeAdminChatTool(
      'generate_or_update_mockup',
      { prompt: 'test prompt' },
      'user-1',
      'sess-1',
      'Bearer fake-token'
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    // This is the regression guard for ERR_INVALID_URL from Node fetch on relative paths.
    expect(calledUrl).toMatch(/^https?:\/\//);
    expect(calledUrl).toContain('/api/mockups/generate');
  });

  it('forwards the Authorization header to the internal endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ imageUrl: 'https://cdn.test/x.png' }),
    } as any);

    await executeAdminChatTool(
      'generate_or_update_mockup',
      { prompt: 'test prompt' },
      'user-1',
      'sess-1',
      'Bearer fake-token'
    );

    const init = fetchMock.mock.calls[0][1] as any;
    expect(init.headers.Authorization).toBe('Bearer fake-token');
  });

  it('throws a descriptive error when the generation endpoint fails', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    } as any);

    await expect(
      executeAdminChatTool(
        'generate_or_update_mockup',
        { prompt: 'test' },
        'user-1',
        'sess-1',
        'Bearer x'
      )
    ).rejects.toThrow(/Mockup generation failed \(500\)/);
  });

  it('rejects unknown tool names', async () => {
    await expect(
      executeAdminChatTool('unknown_tool' as any, { prompt: 'x' }, 'user-1', 'sess-1', '')
    ).rejects.toThrow(/Unknown tool/);
  });
});
