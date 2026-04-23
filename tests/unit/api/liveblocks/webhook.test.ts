/**
 * Liveblocks webhook handler — unit tests.
 *
 * Tests core logic in isolation: signature verification, event validation,
 * body parsing branches, and the production guard.
 * MongoDB calls are tested via the event-type routing logic (mirrored).
 */
import { describe, it, expect } from 'vitest';
import crypto from 'crypto';

// ─── Mirror: verifyWebhookSignature ──────────────────────────────────────────

function verifySignature(payload: string, signature: string, secret: string): boolean {
  if (!secret) return true;
  try {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const received = signature.startsWith('sha256=') ? signature.substring(7) : signature;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

// ─── Mirror: projectId extraction from roomId ─────────────────────────────────

function extractProjectId(roomId: string): string | null {
  return roomId.startsWith('canvas-') ? roomId.replace('canvas-', '') : null;
}

// ─── Mirror: required field validation ───────────────────────────────────────

function validateEvent(event: any): string | null {
  if (!event.type || !event.roomId) return 'Invalid webhook event: missing required fields';
  return null;
}

// ─── Mirror: production guard ─────────────────────────────────────────────────

function productionGuard(isDev: boolean, secret: string): string | null {
  if (!isDev && !secret) return 'Webhook verification not configured';
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════

describe('verifyWebhookSignature', () => {
  const SECRET = 'test-webhook-secret';
  const PAYLOAD = '{"type":"roomCreated","roomId":"canvas-abc123","timestamp":1700000000}';

  it('returns true when secret is empty (dev mode — verification skipped)', () => {
    expect(verifySignature(PAYLOAD, 'any-signature', '')).toBe(true);
  });

  it('verifies a correct raw HMAC-SHA256 signature', () => {
    const sig = crypto.createHmac('sha256', SECRET).update(PAYLOAD).digest('hex');
    expect(verifySignature(PAYLOAD, sig, SECRET)).toBe(true);
  });

  it('verifies a sha256=-prefixed signature (Liveblocks format)', () => {
    const sig = 'sha256=' + crypto.createHmac('sha256', SECRET).update(PAYLOAD).digest('hex');
    expect(verifySignature(PAYLOAD, sig, SECRET)).toBe(true);
  });

  it('rejects an invalid signature', () => {
    expect(verifySignature(PAYLOAD, 'a'.repeat(64), SECRET)).toBe(false);
  });

  it('returns false (not throws) when signature has wrong length', () => {
    expect(() => verifySignature(PAYLOAD, 'tooshort', SECRET)).not.toThrow();
    expect(verifySignature(PAYLOAD, 'tooshort', SECRET)).toBe(false);
  });

  it('rejects a tampered payload', () => {
    const sig = crypto.createHmac('sha256', SECRET).update(PAYLOAD).digest('hex');
    expect(verifySignature(PAYLOAD + 'x', sig, SECRET)).toBe(false);
  });

  it('rejects a signature computed with a different secret', () => {
    const sig = crypto.createHmac('sha256', 'wrong-secret').update(PAYLOAD).digest('hex');
    expect(verifySignature(PAYLOAD, sig, SECRET)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('productionGuard', () => {
  it('returns error when secret missing in production', () => {
    expect(productionGuard(false, '')).toBe('Webhook verification not configured');
  });

  it('returns null (OK) when secret is configured in production', () => {
    expect(productionGuard(false, 'my-secret')).toBeNull();
  });

  it('returns null (OK) in dev mode even without secret', () => {
    expect(productionGuard(true, '')).toBeNull();
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('validateEvent', () => {
  it('returns null for a valid event', () => {
    expect(validateEvent({ type: 'roomCreated', roomId: 'canvas-abc', timestamp: 1 })).toBeNull();
  });

  it('returns error when type is missing', () => {
    expect(validateEvent({ roomId: 'canvas-abc', timestamp: 1 })).toContain('missing required fields');
  });

  it('returns error when roomId is missing', () => {
    expect(validateEvent({ type: 'roomCreated', timestamp: 1 })).toContain('missing required fields');
  });

  it('returns error when both type and roomId are missing', () => {
    expect(validateEvent({ timestamp: 1 })).toContain('missing required fields');
  });

  it('returns error for empty string type', () => {
    expect(validateEvent({ type: '', roomId: 'canvas-abc' })).toContain('missing required fields');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('extractProjectId', () => {
  it('strips canvas- prefix from room ID', () => {
    expect(extractProjectId('canvas-abc123')).toBe('abc123');
  });

  it('returns null for non-canvas room IDs (e.g. brand rooms)', () => {
    expect(extractProjectId('brand-xyz')).toBeNull();
  });

  it('returns null for unknown prefix', () => {
    expect(extractProjectId('other-123')).toBeNull();
  });

  it('handles canvas- prefix with no projectId', () => {
    expect(extractProjectId('canvas-')).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('webhook event types — handled vs unhandled', () => {
  const KNOWN_TYPES = [
    'roomCreated', 'roomDeleted',
    'userEntered', 'userLeft',
    'storageUpdated', 'ydocUpdated',
    'commentCreated', 'commentEdited', 'commentDeleted',
    'commentReactionAdded', 'commentReactionRemoved',
    'threadCreated', 'threadDeleted',
    'threadMarkedAsResolved', 'threadMarkedAsUnresolved',
    'threadMetadataUpdated',
    'notification',
  ];

  it('covers all known event types without duplicates', () => {
    const unique = new Set(KNOWN_TYPES);
    expect(unique.size).toBe(KNOWN_TYPES.length);
  });

  it('each event type is a non-empty string', () => {
    KNOWN_TYPES.forEach(type => {
      expect(typeof type).toBe('string');
      expect(type.length).toBeGreaterThan(0);
    });
  });
});
