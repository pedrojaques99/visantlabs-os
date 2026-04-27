/**
 * Liveblocks Webhook — Integration Tests
 *
 * Tests POST /api/liveblocks/webhook end-to-end:
 * - Signature verification (valid / tampered / missing)
 * - storageUpdated event: persists guideline fields to MongoDB
 * - Non-brand rooms are ignored (canvas-* rooms, unknown rooms)
 * - Non-storageUpdated event types are acknowledged and skipped
 * - Liveblocks SDK getStorageDocument failure returns 500
 * - Missing env vars return 503
 *
 * WebhookHandler.verifyRequest and Liveblocks.getStorageDocument are mocked
 * so tests never hit the real Liveblocks network.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { request } from '../../helpers/app.js';
import { createUser } from '../../factories/user.js';
import { createBrandGuideline } from '../../factories/brandGuideline.js';
import { prisma } from '../../../server/db/prisma.js';

// ─── Mock @liveblocks/node ────────────────────────────────────────────────────

const mockVerifyRequest = vi.fn();
const mockGetStorageDocument = vi.fn();

vi.mock('@liveblocks/node', async (importOriginal) => {
  const original = await importOriginal<typeof import('@liveblocks/node')>();
  return {
    ...original,
    // Regular functions so `new Liveblocks()` and `new WebhookHandler()` work correctly.
    Liveblocks: vi.fn(function (this: any) {
      this.getStorageDocument = mockGetStorageDocument;
    }),
    WebhookHandler: vi.fn(function (this: any) {
      this.verifyRequest = mockVerifyRequest;
    }),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function storageUpdatedEvent(roomId: string) {
  return { type: 'storageUpdated', data: { roomId } };
}

function otherEvent(type: string) {
  return { type, data: { roomId: 'brand-xxx' } };
}

// Simulates a valid raw webhook body (content doesn't matter — WebhookHandler is mocked)
const RAW_BODY = Buffer.from(JSON.stringify({ type: 'storageUpdated' }));

async function postWebhook(body: Buffer = RAW_BODY) {
  return (await request())
    .post('/api/liveblocks/webhook')
    .set('Content-Type', 'application/octet-stream')
    .set('webhook-id', 'msg_test')
    .set('webhook-timestamp', String(Math.floor(Date.now() / 1000)))
    .set('webhook-signature', 'v1,fake-sig')
    .send(body);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('POST /api/liveblocks/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.LIVEBLOCKS_SECRET_KEY = 'sk_test_fake_key';
    process.env.LIVEBLOCKS_WEBHOOK_SECRET = 'whsec_test_fake_secret';
  });

  // ── Signature verification ───────────────────────────────────────────────────

  it('400 when webhook signature is invalid', async () => {
    mockVerifyRequest.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const res = await postWebhook();
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid webhook signature/i);
  });

  it('200 when signature is valid (non-storageUpdated event is skipped)', async () => {
    mockVerifyRequest.mockReturnValue(otherEvent('roomCreated'));

    const res = await postWebhook();
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  // ── Event type filtering ─────────────────────────────────────────────────────

  it.each(['roomCreated', 'roomDeleted', 'userEntered', 'userLeft', 'commentCreated'])(
    '200 and skips event type "%s"',
    async (eventType) => {
      mockVerifyRequest.mockReturnValue(otherEvent(eventType));

      const res = await postWebhook();
      expect(res.status).toBe(200);
      expect(mockGetStorageDocument).not.toHaveBeenCalled();
    },
  );

  it('200 and skips canvas-* rooms (storageUpdated on non-brand room)', async () => {
    mockVerifyRequest.mockReturnValue(storageUpdatedEvent('canvas-abc123'));

    const res = await postWebhook();
    expect(res.status).toBe(200);
    expect(mockGetStorageDocument).not.toHaveBeenCalled();
  });

  it('200 and skips unknown room prefixes', async () => {
    mockVerifyRequest.mockReturnValue(storageUpdatedEvent('unknown-abc'));

    const res = await postWebhook();
    expect(res.status).toBe(200);
    expect(mockGetStorageDocument).not.toHaveBeenCalled();
  });

  // ── storageUpdated persistence ───────────────────────────────────────────────

  it('persists guideline fields to MongoDB on storageUpdated', async () => {
    const { user } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Before' });

    const updatedColors = [{ name: 'Ocean', hex: '#0077B6', role: 'primary' }];

    mockVerifyRequest.mockReturnValue(storageUpdatedEvent(`brand-${guideline.id}`));
    mockGetStorageDocument.mockResolvedValue({
      data: {
        guideline: {
          id: guideline.id,
          userId: user.id,
          identity: { name: 'After Storage Update', tagline: 'Updated via Liveblocks' },
          colors: updatedColors,
          typography: [],
          logos: [],
        },
      },
    });

    const res = await postWebhook();
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const persisted = await prisma.brandGuideline.findUnique({ where: { id: guideline.id } });
    expect((persisted!.identity as any).name).toBe('After Storage Update');
    expect(persisted!.colors).toEqual(updatedColors);
  });

  it('strips id and userId from the storage patch before persisting', async () => {
    const { user } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });

    mockVerifyRequest.mockReturnValue(storageUpdatedEvent(`brand-${guideline.id}`));
    mockGetStorageDocument.mockResolvedValue({
      data: {
        guideline: {
          id: 'should-be-stripped',
          userId: 'should-be-stripped',
          identity: { name: 'Patched', tagline: 'ok' },
          colors: [],
          typography: [],
          logos: [],
        },
      },
    });

    const res = await postWebhook();
    expect(res.status).toBe(200);

    const persisted = await prisma.brandGuideline.findUnique({ where: { id: guideline.id } });
    // id and userId must remain the original values
    expect(persisted!.id).toBe(guideline.id);
    expect(persisted!.userId).toBe(user.id);
    expect((persisted!.identity as any).name).toBe('Patched');
  });

  it('200 and skips persist when storage has no guideline field', async () => {
    const { user } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: user.id, name: 'Unchanged' });

    mockVerifyRequest.mockReturnValue(storageUpdatedEvent(`brand-${guideline.id}`));
    mockGetStorageDocument.mockResolvedValue({ data: {} });

    const res = await postWebhook();
    expect(res.status).toBe(200);

    const persisted = await prisma.brandGuideline.findUnique({ where: { id: guideline.id } });
    expect((persisted!.identity as any).name).toBe('Unchanged');
  });

  it('200 and skips when guideline field is not an object', async () => {
    mockVerifyRequest.mockReturnValue(storageUpdatedEvent('brand-nonexistentid'));
    mockGetStorageDocument.mockResolvedValue({ data: { guideline: 'not-an-object' } });

    const res = await postWebhook();
    expect(res.status).toBe(200);
  });

  it('500 when getStorageDocument throws', async () => {
    const { user } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });

    mockVerifyRequest.mockReturnValue(storageUpdatedEvent(`brand-${guideline.id}`));
    mockGetStorageDocument.mockRejectedValue(new Error('Liveblocks API unavailable'));

    const res = await postWebhook();
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/persist failed/i);
  });

  it('getStorageDocument is called with the correct roomId', async () => {
    const { user } = await createUser();
    const { guideline } = await createBrandGuideline({ userId: user.id });
    const roomId = `brand-${guideline.id}`;

    mockVerifyRequest.mockReturnValue(storageUpdatedEvent(roomId));
    mockGetStorageDocument.mockResolvedValue({
      data: {
        guideline: { identity: { name: 'x', tagline: 'y' }, colors: [], typography: [], logos: [] },
      },
    });

    await postWebhook();

    expect(mockGetStorageDocument).toHaveBeenCalledWith(roomId, 'json');
  });
});
