import { describe, it, expect, beforeEach } from 'vitest';
import { ObjectId } from 'mongodb';
import { connectToMongoDB, getDb } from '../../../server/db/mongodb';
import {
  extrairComprador,
  registrarCompra,
  buscarCompras,
  transferirCompra,
  comprasDaConta,
  TransferenciaError,
} from '../../../server/services/hublaCompras';

const A = new ObjectId();
const B = new ObjectId();

async function db() {
  await connectToMongoDB();
  return getDb();
}

beforeEach(async () => {
  const d = await db();
  await d.collection('users').deleteMany({});
  await d.collection('hubla_compras').deleteMany({});
});

describe('extrairComprador', () => {
  it('guarda telefone em dígitos e só os 4 últimos do CPF', () => {
    const c = extrairComprador({
      user: { email: 'Ana@X.com', firstName: 'Ana', lastName: 'Lima', phone: '+55 (11) 98888-7777', document: '123.456.789-09' },
    });
    expect(c).toEqual({ email: 'ana@x.com', nome: 'Ana Lima', telefone: '5511988887777', cpf4: '8909' });
  });
  it('payload magro não inventa campo', () => {
    expect(extrairComprador({})).toEqual({ email: '', nome: undefined, telefone: undefined, cpf4: undefined });
  });
});

describe('registrarCompra + buscarCompras', () => {
  it('acha por e-mail, nome, telefone (8 finais), id e cpf4; evento magro não apaga', async () => {
    const d = await db();
    await registrarCompra(d, { subscriptionId: 'sub1', productId: 'p', alvo: 'ia-aplicada', status: 'ativa', email: 'ana@x.com', nome: 'Ana Lima', telefone: '5511988887777', cpf4: '8909', userId: String(A) });
    await registrarCompra(d, { subscriptionId: 'sub1', productId: 'p', alvo: 'ia-aplicada', status: 'removida', email: '' });
    for (const q of ['ana@x', 'Lima', '98888-7777', 'sub1', '8909']) {
      const r = await buscarCompras(d, q);
      expect(r.map((c) => c.subscriptionId), q).toEqual(['sub1']);
    }
    const [c] = await buscarCompras(d, 'sub1');
    expect(c.status).toBe('removida');
    expect(c.email).toBe('ana@x.com');
  });
});

describe('transferirCompra', () => {
  it('produto: o entitlement sai de A e entra em B, e o reembolso ainda acha pela sessionId', async () => {
    const d = await db();
    await d.collection('users').insertMany([
      { _id: A, email: 'a@x.com', entitlements: [{ sku: 'ia-aplicada', kind: 'product', source: 'hubla', sessionId: 'hubla:sub1' }] },
      { _id: B, email: 'b@x.com', entitlements: [] },
    ]);
    await registrarCompra(d, { subscriptionId: 'sub1', productId: 'p', alvo: 'ia-aplicada', status: 'ativa', email: 'a@x.com', userId: String(A) });

    const t = await transferirCompra(d, 'sub1', String(B));
    expect(t).toMatchObject({ alvo: 'ia-aplicada', deUserId: String(A), paraUserId: String(B) });
    const [a, b] = await Promise.all([d.collection('users').findOne({ _id: A }), d.collection('users').findOne({ _id: B })]);
    expect(a!.entitlements).toEqual([]);
    expect(b!.entitlements[0]).toMatchObject({ sku: 'ia-aplicada', sessionId: 'hubla:sub1', transferidoDe: String(A) });
    expect((await d.collection('users').findOne({ 'entitlements.sessionId': 'hubla:sub1' }))!._id).toEqual(B);
    expect((await buscarCompras(d, 'sub1'))[0].userId).toBe(String(B));
    expect(await comprasDaConta(d, String(B))).toEqual(['sub1']);
  });

  it('club: tier e assinatura vão pra B, A volta a free', async () => {
    const d = await db();
    await d.collection('users').insertMany([
      { _id: A, email: 'a@x.com', subscriptionTier: 'club', subscriptionStatus: 'active', clubSource: 'hubla', hublaSubscriptionId: 'subC', monthlyCredits: 60 },
      { _id: B, email: 'b@x.com', subscriptionTier: 'free', subscriptionStatus: 'free' },
    ]);
    await transferirCompra(d, 'subC', String(B));
    const [a, b] = await Promise.all([d.collection('users').findOne({ _id: A }), d.collection('users').findOne({ _id: B })]);
    expect(b).toMatchObject({ subscriptionTier: 'club', subscriptionStatus: 'active', clubSource: 'hubla', hublaSubscriptionId: 'subC', monthlyCredits: 60 });
    expect(a).toMatchObject({ subscriptionTier: 'free', subscriptionStatus: 'free' });
    expect(a!.hublaSubscriptionId).toBeUndefined();
  });

  it('recusa: destino que já assina, mesma conta e compra que não existe', async () => {
    const d = await db();
    await d.collection('users').insertMany([
      { _id: A, email: 'a@x.com', subscriptionTier: 'club', subscriptionStatus: 'active', clubSource: 'hubla', hublaSubscriptionId: 'subC' },
      { _id: B, email: 'b@x.com', subscriptionTier: 'fundador', subscriptionStatus: 'active' },
    ]);
    await expect(transferirCompra(d, 'subC', String(B))).rejects.toMatchObject({ code: 'destino-com-assinatura' });
    await expect(transferirCompra(d, 'subC', String(A))).rejects.toMatchObject({ code: 'mesma-conta' });
    await expect(transferirCompra(d, 'nada', String(B))).rejects.toBeInstanceOf(TransferenciaError);
  });
});
