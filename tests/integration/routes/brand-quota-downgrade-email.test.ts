import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createUser } from '../../factories/user.js';
import { createBrandGuideline } from '../../factories/brandGuideline.js';

// Enforcement is behind the flag — set BEFORE the lib is imported.
process.env.FEATURE_BRAND_BILLING = 'true';

// Spy on the outbound email without hitting Resend. importOriginal keeps every
// other export real (the app sends welcome/verification mails elsewhere).
const sendSpy = vi.fn().mockResolvedValue(true);
vi.mock('../../../server/services/emailService.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../server/services/emailService.js')>();
  return { ...actual, sendBrandQuotaDowngradeEmail: sendSpy };
});

describe('Brand billing — downgrade warning email', () => {
  beforeEach(() => sendSpy.mockClear());

  it('sends ONE email listing the least-recently-updated brands at risk', async () => {
    const { user } = await createUser();
    const { prisma } = await import('../../../server/db/prisma.js');
    const { enforceBrandQuotaOnDowngrade } = await import('../../../server/lib/brandQuota.js');

    // 3 active brands on a free account (limit 1) — 2 are over quota.
    await createBrandGuideline({ userId: user.id, name: 'Old 1' });
    await createBrandGuideline({ userId: user.id, name: 'Old 2' });
    const { guideline: b3 } = await createBrandGuideline({ userId: user.id, name: 'Newest' });
    // Make b3 the most recently updated → it's the survivor, the other two are at risk.
    await prisma.brandGuideline.update({ where: { id: b3.id }, data: { folder: 'touch' } });

    await enforceBrandQuotaOnDowngrade(user.id);

    expect(sendSpy).toHaveBeenCalledTimes(1);
    const arg = sendSpy.mock.calls[0][0];
    expect(arg.email).toBe(user.email);
    expect(arg.keepCount).toBe(1);
    expect([...arg.atRiskBrands].sort()).toEqual(['Old 1', 'Old 2']);
    expect(arg.graceUntil).toBeTruthy();
  });

  it('does NOT re-email on a repeated webhook for the same excess (no spam)', async () => {
    const { user } = await createUser();
    const { enforceBrandQuotaOnDowngrade } = await import('../../../server/lib/brandQuota.js');

    await createBrandGuideline({ userId: user.id, name: 'A' });
    await createBrandGuideline({ userId: user.id, name: 'B' });

    await enforceBrandQuotaOnDowngrade(user.id);
    await enforceBrandQuotaOnDowngrade(user.id); // same excess, same grace window

    expect(sendSpy).toHaveBeenCalledTimes(1);
  });
});
