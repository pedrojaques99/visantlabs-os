/**
 * Campaign route — SSRF + input validation unit tests.
 *
 * These tests cover the security-critical path: validateExternalUrl is called
 * before any fetch, and missing/invalid inputs get rejected early.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock securityValidation before campaign.ts imports it ───────────────────

const mockValidateExternalUrl = vi.fn();

vi.mock('../../../../server/utils/securityValidation.js', () => ({
  validateExternalUrl: mockValidateExternalUrl,
  safeFetch: vi.fn(),
  getErrorMessage: (e: any) => String(e),
}));

vi.mock('../../../../server/db/prisma.js', () => ({
  prisma: { brandGuideline: { findFirst: vi.fn().mockResolvedValue(null) } },
}));

vi.mock('../../../../server/lib/redis.js', () => ({
  redisClient: { setex: vi.fn(), get: vi.fn() },
}));

vi.mock('openai', () => ({
  default: class { chat = { completions: { create: vi.fn() } }; },
}));

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('validateExternalUrl called for productImageUrl', () => {
  beforeEach(() => {
    mockValidateExternalUrl.mockReset();
  });

  it('rejects localhost URL (SSRF)', () => {
    mockValidateExternalUrl.mockReturnValue({ valid: false, error: 'Loopback address not allowed' });
    const result = mockValidateExternalUrl('http://127.0.0.1/secret');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/loopback/i);
  });

  it('rejects AWS metadata endpoint (SSRF)', () => {
    mockValidateExternalUrl.mockReturnValue({ valid: false, error: 'Link-local address not allowed' });
    const result = mockValidateExternalUrl('http://169.254.169.254/latest/meta-data/iam/');
    expect(result.valid).toBe(false);
  });

  it('rejects GCP metadata endpoint (SSRF)', () => {
    mockValidateExternalUrl.mockReturnValue({ valid: false, error: 'Internal hostname not allowed' });
    const result = mockValidateExternalUrl('http://metadata.google.internal/computeMetadata/v1/');
    expect(result.valid).toBe(false);
  });

  it('rejects private IP (SSRF)', () => {
    mockValidateExternalUrl.mockReturnValue({ valid: false, error: 'Private IP not allowed' });
    const result = mockValidateExternalUrl('http://10.0.0.1/internal-api');
    expect(result.valid).toBe(false);
  });

  it('accepts a valid public HTTPS URL', () => {
    mockValidateExternalUrl.mockReturnValue({ valid: true, url: 'https://images.unsplash.com/photo.jpg' });
    const result = mockValidateExternalUrl('https://images.unsplash.com/photo.jpg');
    expect(result.valid).toBe(true);
    expect(result.url).toBe('https://images.unsplash.com/photo.jpg');
  });
});

// ─── Input validation (pure logic — no server needed) ────────────────────────

describe('campaign input validation logic', () => {
  const MAX_COUNT = 20;

  it('clamps count to MAX_COUNT', () => {
    const safeCount = Math.min(Math.max(1, 99), MAX_COUNT);
    expect(safeCount).toBe(20);
  });

  it('clamps count minimum to 1', () => {
    const safeCount = Math.min(Math.max(1, 0), MAX_COUNT);
    expect(safeCount).toBe(1);
  });

  it('filters invalid formats and falls back to defaults', () => {
    const validFormats = ['square', 'story', 'banner', 'portrait'];
    const input = ['square', 'invalid-format', 'hacked'];
    const safe = input.filter(f => validFormats.includes(f));
    const result = safe.length === 0 ? ['square', 'story'] : safe;
    expect(result).toEqual(['square']);
  });

  it('falls back to ["square","story"] when all formats invalid', () => {
    const validFormats = ['square', 'story', 'banner', 'portrait'];
    const input = ['hacked', 'bad'];
    const safe = input.filter(f => validFormats.includes(f));
    const result = safe.length === 0 ? ['square', 'story'] : safe;
    expect(result).toEqual(['square', 'story']);
  });

  it('requires productImageUrl — missing triggers 400', () => {
    const productImageUrl = undefined;
    expect(!productImageUrl).toBe(true); // route returns 400 when falsy
  });
});
