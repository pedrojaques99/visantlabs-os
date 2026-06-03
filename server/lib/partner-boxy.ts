const BOXY_API_URL = process.env.BOXY_PARTNER_API_URL || '';
const PARTNER_API_KEY = process.env.PARTNER_API_KEY || '';

const DOWNLOADS_BY_TIER: Record<string, number> = {
  premium: 5,
  pro: 10,
};

export async function grantBoxyDownloads(
  email: string,
  tier: string,
  stripeSubId: string
): Promise<void> {
  if (!BOXY_API_URL || !PARTNER_API_KEY) return;

  const bonusDownloads = DOWNLOADS_BY_TIER[tier] ?? 0;
  if (bonusDownloads === 0) return;

  try {
    await fetch(`${BOXY_API_URL}/partner-downloads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PARTNER_API_KEY },
      body: JSON.stringify({
        email,
        bonusDownloads,
        action: 'grant',
        source: 'visantlabs',
        ref: stripeSubId,
      }),
    });
    console.log(`✅ Boxy bonus downloads granted: ${bonusDownloads}/day for ${email}`);
  } catch (err: any) {
    console.error('❌ Boxy partner grant error:', err.message);
  }
}

export async function revokeBoxyDownloads(email: string, stripeSubId: string): Promise<void> {
  if (!BOXY_API_URL || !PARTNER_API_KEY) return;

  try {
    await fetch(`${BOXY_API_URL}/partner-downloads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': PARTNER_API_KEY },
      body: JSON.stringify({
        email,
        bonusDownloads: 0,
        action: 'revoke',
        source: 'visantlabs',
        ref: stripeSubId,
      }),
    });
    console.log(`✅ Boxy bonus downloads revoked for ${email}`);
  } catch (err: any) {
    console.error('❌ Boxy partner revoke error:', err.message);
  }
}
