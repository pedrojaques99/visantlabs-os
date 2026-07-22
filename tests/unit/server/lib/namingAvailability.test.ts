import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Redis é só cache aqui — mockado como sempre-vazio para que cada teste exercite
// o caminho de rede de verdade, sem depender de um Redis rodando.
vi.mock('@server/lib/redis', () => ({
  redisClient: {
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
  },
}));

const BOOTSTRAP = {
  services: [
    [['com'], ['https://rdap.verisign.com/com/v1/']],
    [['br'], ['https://rdap.registro.br/']],
  ],
};

/** Monta um fetch fake: bootstrap + status por domínio. */
function mockFetch(statusByDomain: Record<string, number | 'throw'>) {
  return vi.fn(async (url: string) => {
    if (String(url).includes('data.iana.org')) {
      return { ok: true, status: 200, json: async () => BOOTSTRAP } as any;
    }
    const domain = String(url).split('/domain/')[1];
    const status = statusByDomain[domain];
    if (status === 'throw' || status === undefined) throw new Error('network down');
    return { ok: status >= 200 && status < 300, status } as any;
  });
}

async function freshModule() {
  vi.resetModules();
  return import('@server/lib/naming/availability');
}

describe('naming availability (RDAP)', () => {
  beforeEach(() => vi.stubGlobal('fetch', vi.fn()));
  afterEach(() => vi.unstubAllGlobals());

  it('slugifies names into domain labels', async () => {
    const { slugifyName } = await freshModule();
    expect(slugifyName('Café Montriz')).toBe('cafemontriz');
    expect(slugifyName('AÇOR')).toBe('acor');
    expect(slugifyName('  Vi-gor 2 ')).toBe('vigor2');
  });

  it('marks a name as taken when BOTH .com and .com.br are registered', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'galva.com': 200, 'galva.com.br': 200 }));
    const { checkNames, statusOf } = await freshModule();
    const map = await checkNames(['GALVA']);
    const r = statusOf(map, 'GALVA');
    expect(r.status).toBe('taken');
    expect(r.registered).toEqual(['galva.com', 'galva.com.br']);
  });

  it('marks a name as partial when only one TLD is registered', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'ampara.com': 200, 'ampara.com.br': 404 }));
    const { checkNames, statusOf } = await freshModule();
    const map = await checkNames(['Ampara']);
    const r = statusOf(map, 'Ampara');
    expect(r.status).toBe('partial');
    expect(r.registered).toEqual(['ampara.com']);
  });

  it('marks a name as free when neither TLD is registered', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'montriz.com': 404, 'montriz.com.br': 404 }));
    const { checkNames, statusOf } = await freshModule();
    expect(statusOf(await checkNames(['MONTRIZ']), 'MONTRIZ').status).toBe('free');
  });

  // A garantia que importa: infraestrutura fora do ar não pode esvaziar o deck.
  it('degrades to unknown (never taken) when RDAP fails', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'konduz.com': 'throw', 'konduz.com.br': 'throw' }));
    const { checkNames, statusOf } = await freshModule();
    expect(statusOf(await checkNames(['KONDUZ']), 'KONDUZ').status).toBe('unknown');
  });

  it('treats a rate-limited (429) response as unknown, not as registered', async () => {
    vi.stubGlobal('fetch', mockFetch({ 'nordem.com': 429, 'nordem.com.br': 404 }));
    const { checkNames, statusOf } = await freshModule();
    expect(statusOf(await checkNames(['NORDEM']), 'NORDEM').status).toBe('unknown');
  });

  it('reports unknown for a name missing from the map (batch timeout)', async () => {
    const { statusOf } = await freshModule();
    expect(statusOf(new Map(), 'QUALQUER').status).toBe('unknown');
  });
});
