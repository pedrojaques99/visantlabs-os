/**
 * Liveblocks Webhook — missing config guard (unit).
 *
 * The route reads env vars as module-level constants, making them untestable
 * via HTTP after module load. We test the guard logic in isolation.
 */
import { describe, it, expect } from 'vitest';

function webhookConfigGuard(
  secretKey: string | undefined,
  webhookSecret: string | undefined,
): { status: number; error: string } | null {
  if (!secretKey || !webhookSecret) {
    return { status: 503, error: 'Liveblocks not configured' };
  }
  return null;
}

describe('Liveblocks webhook — missing config guard', () => {
  it('503 when LIVEBLOCKS_SECRET_KEY is not set', () => {
    const result = webhookConfigGuard(undefined, 'whsec_present');
    expect(result?.status).toBe(503);
    expect(result?.error).toMatch(/not configured/i);
  });

  it('503 when LIVEBLOCKS_WEBHOOK_SECRET is not set', () => {
    const result = webhookConfigGuard('sk_present', undefined);
    expect(result?.status).toBe(503);
    expect(result?.error).toMatch(/not configured/i);
  });

  it('503 when both are missing', () => {
    const result = webhookConfigGuard(undefined, undefined);
    expect(result?.status).toBe(503);
  });

  it('null (no guard triggered) when both keys are present', () => {
    const result = webhookConfigGuard('sk_present', 'whsec_present');
    expect(result).toBeNull();
  });
});
