// Live seed: brand guideline (Visant Labs API) → the shape compileBrandTokens
// expects. This is the link the README's roadmap called "live API fetch by
// brand id"; without it every consumer hand-copies a fixture and the tokens
// drift from the vault the moment someone edits the brand.

const DEFAULT_BASE = 'https://api.visantlabs.com';

export class BrandFetchError extends Error {
  constructor(message, detail) {
    super(`@visant/brand-tokens: ${message}`);
    this.name = 'BrandFetchError';
    this.detail = detail;
  }
}

/**
 * Fetch the token-relevant sections of a brand guideline.
 *
 * Only `colors` and `typography` are requested. The rest of the vault (voice,
 * personas, manifesto) is large and irrelevant here — asking for `full` would
 * burn payload on every build for data the engine cannot use.
 *
 * @param {string} brandId
 * @param {{ token?: string, baseUrl?: string, fetchImpl?: typeof fetch }} [opts]
 */
export async function fetchBrand(brandId, opts = {}) {
  if (!brandId) throw new BrandFetchError('brandId is required');

  const token = opts.token ?? process.env.VISANT_API_TOKEN;
  if (!token) {
    throw new BrandFetchError('missing API token — set VISANT_API_TOKEN or pass { token }', {
      brandId,
    });
  }

  const base = opts.baseUrl ?? process.env.VISANT_API_URL ?? DEFAULT_BASE;
  const doFetch = opts.fetchImpl ?? globalThis.fetch;
  const url = `${base}/v1/brand-guidelines/${encodeURIComponent(brandId)}?sections=colors,typography`;

  const res = await doFetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new BrandFetchError(`brand fetch failed (HTTP ${res.status})`, {
      brandId,
      status: res.status,
      url,
    });
  }

  const raw = await res.json();
  return normalizeBrand(raw, brandId);
}

/**
 * Normalise an API payload into the engine's seed shape.
 *
 * Kept separate from `fetchBrand` so it can be tested without a network, and
 * so a payload captured by hand (or by the MCP tool) can be fed in directly.
 */
export function normalizeBrand(raw, brandId = null) {
  const body = raw?.guideline ?? raw?.data ?? raw;

  const colors = (body?.colors ?? [])
    .filter((c) => typeof c?.hex === 'string')
    .map((c) => ({
      hex: c.hex,
      name: c.name ?? null,
      role: c.role ?? null,
      usage: c.usage ?? null,
      usageRank: c.usageRank ?? null,
    }));

  const typography = (body?.typography ?? [])
    .filter((t) => typeof t?.family === 'string')
    .map((t) => ({
      family: t.family,
      role: t.role ?? null,
      style: t.style ?? null,
      size: t.size ?? null,
    }));

  if (!colors.length) {
    throw new BrandFetchError('brand publishes no colours', { brandId });
  }

  return {
    id: body?.id ?? brandId,
    name: body?.identity?.name ?? null,
    colors,
    typography,
    extraction: body?.extraction ?? null,
    currentVersion: body?.currentVersion ?? null,
    _source: `brand-guidelines-get(${body?.id ?? brandId}, [colors,typography])`,
  };
}

/** `Campo Neon` → `campo-neon`, for filenames and registry item names. */
export function brandSlug(brand) {
  const name = brand?.name ?? brand?.identity?.name ?? brand?.id ?? 'brand';
  return String(name)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}
