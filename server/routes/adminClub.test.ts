import { describe, expect, it, vi } from 'vitest';

vi.mock('../db/prisma.js', () => ({ prisma: {} }));
vi.mock('../db/mongodb.js', () => ({ connectToMongoDB: vi.fn(), getDb: vi.fn() }));
vi.mock('../middleware/adminAuth.js', () => ({ validateAdmin: vi.fn() }));

const { filtroMembros, produtosDe } = await import('./adminClub.js');

describe('filtroMembros', () => {
  it('pagantes = assinante ativo OU dono de produto', () => {
    const f = filtroMembros('pagantes', '', '') as any;
    expect(f.$and[0].$or).toEqual([
      { subscriptionTier: { $in: ['club', 'fundador', 'visantista'] }, subscriptionStatus: 'active' },
      { 'entitlements.0': { $exists: true } },
    ]);
  });

  it('compradores filtra por produto e escapa a busca', () => {
    const f = filtroMembros('compradores', 'a.b+', 'ia-aplicada') as any;
    expect(f.$and).toHaveLength(3);
    expect(f.$and[1]).toEqual({ 'entitlements.sku': { $regex: '^ia-aplicada$', $options: 'i' } });
    expect(f.$and[2].$or[0].email.$regex).toBe('a\\.b\\+');
  });

  it('all sem filtro de pagante', () => {
    expect(filtroMembros('all', 'pedro', '')).toEqual({
      $and: [{ $or: [{ email: { $regex: 'pedro', $options: 'i' } }, { name: { $regex: 'pedro', $options: 'i' } }] }],
    });
  });
});

describe('produtosDe', () => {
  it('projeta só sku, origem e data; ignora lixo', () => {
    expect(
      produtosDe([
        { sku: 'ia-aplicada', source: 'hubla', sessionId: 'x', grantedAt: '2026-11-22T19:20:00Z' },
        null,
        { foo: 1 },
      ])
    ).toEqual([{ sku: 'ia-aplicada', source: 'hubla', grantedAt: '2026-11-22T19:20:00Z' }]);
    expect(produtosDe(undefined)).toEqual([]);
  });
});
