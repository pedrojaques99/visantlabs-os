// The network seam had no test, which is exactly how the URL drifted to
// `/v1/brand-guidelines/...` (HTTP 404) without anyone noticing: every green
// run exercised the engine from a fixture and never built a request. These
// tests pin the request itself, using the `fetchImpl` injection point the
// module already exposed.

import { describe, it, expect } from 'vitest';
import { fetchBrand, normalizeBrand, brandSlug, BrandFetchError } from '../src/fetch-brand.js';

const BRAND_ID = '6a56b9bc2fba948b46347dab';

/** A fetch double that records the request and replies with `body`. */
function stubFetch(body, { status = 200 } = {}) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    };
  };
  impl.calls = calls;
  return impl;
}

const PAYLOAD = {
  guideline: {
    id: BRAND_ID,
    identity: { name: 'Urban Stay®' },
    colors: [
      { hex: '#F8F4E2', name: 'Areia Clara', role: 'background' },
      { hex: '#1A3E56', name: 'Maré Funda', role: 'primary' },
      { hex: '#020608', name: 'Noite Urbana', role: 'text' },
    ],
    typography: [
      { family: 'Clash Grotesk', role: 'display', style: 'Bold', size: 96 },
      { family: 'Clash Grotesk', role: 'body', style: 'Regular', size: 16 },
    ],
    currentVersion: 8,
  },
};

describe('fetchBrand — request construction', () => {
  it('hits /brand-guidelines under the /api base, not /v1', async () => {
    const impl = stubFetch(PAYLOAD);
    await fetchBrand(BRAND_ID, { token: 't', fetchImpl: impl });

    const { url } = impl.calls[0];
    expect(url).toBe(
      `https://api.visantlabs.com/api/brand-guidelines/${BRAND_ID}?sections=colors,typography`
    );
    expect(url).not.toContain('/v1/');
  });

  it('sends the bearer token', async () => {
    const impl = stubFetch(PAYLOAD);
    await fetchBrand(BRAND_ID, { token: 'secret-token', fetchImpl: impl });
    expect(impl.calls[0].init.headers.Authorization).toBe('Bearer secret-token');
  });

  it('honours an explicit baseUrl and tolerates a trailing slash', async () => {
    const impl = stubFetch(PAYLOAD);
    await fetchBrand(BRAND_ID, {
      token: 't',
      baseUrl: 'http://localhost:8080/api/',
      fetchImpl: impl,
    });
    expect(impl.calls[0].url).toBe(
      `http://localhost:8080/api/brand-guidelines/${BRAND_ID}?sections=colors,typography`
    );
  });

  it('throws a typed error carrying the status and url on a non-2xx', async () => {
    const impl = stubFetch({}, { status: 404 });
    await expect(fetchBrand(BRAND_ID, { token: 't', fetchImpl: impl })).rejects.toThrow(
      BrandFetchError
    );
  });

  it('refuses to build a request without a brandId or token', async () => {
    const impl = stubFetch(PAYLOAD);
    await expect(fetchBrand('', { token: 't', fetchImpl: impl })).rejects.toThrow(BrandFetchError);
    await expect(
      fetchBrand(BRAND_ID, { token: '', baseUrl: 'x', fetchImpl: impl })
    ).rejects.toThrow(/missing API token/);
    expect(impl.calls).toHaveLength(0);
  });
});

describe('normalizeBrand', () => {
  it('unwraps the guideline envelope and keeps only token-relevant fields', () => {
    const brand = normalizeBrand(PAYLOAD, BRAND_ID);
    expect(brand.id).toBe(BRAND_ID);
    expect(brand.name).toBe('Urban Stay®');
    expect(brand.colors).toHaveLength(3);
    expect(brand.typography.map((t) => t.role)).toEqual(['display', 'body']);
    expect(brand.currentVersion).toBe(8);
  });

  it('drops malformed colour and type entries instead of passing them downstream', () => {
    const brand = normalizeBrand({
      guideline: {
        id: 'x',
        colors: [{ hex: '#000000' }, { name: 'no hex' }, { hex: 42 }],
        typography: [{ family: 'Clash Grotesk', role: 'body' }, { role: 'orphan' }],
      },
    });
    expect(brand.colors).toHaveLength(1);
    expect(brand.typography).toHaveLength(1);
  });

  it('fails loud when the brand publishes no colours — the engine cannot guess them', () => {
    expect(() => normalizeBrand({ guideline: { id: 'x', colors: [] } })).toThrow(BrandFetchError);
  });
});

describe('brandSlug', () => {
  it('strips diacritics and symbols so the filename is safe', () => {
    expect(brandSlug({ name: 'Urban Stay®' })).toBe('urban-stay');
    expect(brandSlug({ name: 'Céu Aberto & Cia.' })).toBe('ceu-aberto-cia');
  });
});
