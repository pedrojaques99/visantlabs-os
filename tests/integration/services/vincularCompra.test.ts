import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { connectToMongoDB, getDb } from '../../../server/db/mongodb';
import { registrarCompra } from '../../../server/services/hublaCompras';
import {
  pedirVinculo,
  confirmarVinculo,
  COLECAO_VINCULOS,
} from '../../../server/services/vincularCompra';

const A = new ObjectId();
const B = new ObjectId();

async function db() {
  await connectToMongoDB();
  return getDb();
}

async function semearCompraEmA() {
  const d = await db();
  await d.collection('users').insertMany([
    {
      _id: A,
      email: 'a@x.com',
      name: 'Ana',
      entitlements: [
        { sku: 'ia-aplicada', kind: 'product', source: 'hubla', sessionId: 'hubla:sub1' },
      ],
    },
    { _id: B, email: 'b@x.com', entitlements: [] },
  ]);
  await registrarCompra(d, {
    subscriptionId: 'sub1',
    productId: 'p',
    alvo: 'ia-aplicada',
    status: 'ativa',
    email: 'a@x.com',
    userId: String(A),
  });
  return d;
}

/** Pede pelo B e devolve o token cru que foi pro e-mail. */
async function pedir(email = 'A@x.com ', now?: () => Date) {
  const d = await db();
  const enviarEmail = vi.fn().mockResolvedValue(undefined);
  const r = await pedirVinculo(d, String(B), email, { enviarEmail, now });
  return { r, enviarEmail, token: enviarEmail.mock.calls[0]?.[0]?.token as string | undefined };
}

beforeEach(async () => {
  const d = await db();
  await d.collection('users').deleteMany({});
  await d.collection('hubla_compras').deleteMany({});
  await d.collection(COLECAO_VINCULOS).deleteMany({});
  await d.collection('suporte_audit').deleteMany({});
});

describe('pedirVinculo', () => {
  it('e-mail sem conta (ou conta sem compra) responde igual e não cria token nem manda e-mail', async () => {
    const d = await db();
    await d.collection('users').insertMany([
      { _id: B, email: 'b@x.com' },
      { _id: A, email: 'a@x.com', entitlements: [] },
    ]);
    for (const email of ['ninguem@x.com', 'a@x.com']) {
      const { r, enviarEmail } = await pedir(email);
      expect(r).toEqual({ enviado: false });
      expect(enviarEmail).not.toHaveBeenCalled();
    }
    expect(await d.collection(COLECAO_VINCULOS).countDocuments()).toBe(0);
  });

  it('guarda só o hash do token e manda o cru pro e-mail A', async () => {
    const d = await semearCompraEmA();
    const { r, enviarEmail, token } = await pedir();
    expect(r).toEqual({ enviado: true });
    expect(enviarEmail).toHaveBeenCalledOnce();
    expect(enviarEmail.mock.calls[0][0]).toMatchObject({
      email: 'a@x.com',
      name: 'Ana',
      paraEmail: 'b@x.com',
    });
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const linhas = await d.collection(COLECAO_VINCULOS).find().toArray();
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({
      hash: createHash('sha256').update(token!).digest('hex'),
      deUserId: String(A),
      paraUserId: String(B),
      paraEmail: 'b@x.com',
      usadoEm: null,
    });
    expect(JSON.stringify(linhas[0])).not.toContain(token);
    expect(await d.collection('suporte_audit').findOne({ acao: 'vincular-pedido' })).toBeTruthy();
  });

  it('recusa o próprio e-mail da conta com 400 mesmo-email', async () => {
    await semearCompraEmA();
    await expect(pedir(' B@X.com')).rejects.toMatchObject({ code: 'mesmo-email', status: 400 });
    await expect(pedir('nao-e-email')).rejects.toMatchObject({ code: 'email-invalido' });
  });
});

describe('confirmarVinculo', () => {
  it('move a compra de A pra B, e o mesmo link não roda duas vezes', async () => {
    const d = await semearCompraEmA();
    const { token } = await pedir();
    const r = await confirmarVinculo(d, token);
    expect(r).toEqual({ paraEmail: 'b@x.com', transferidas: ['ia-aplicada'], falhas: [] });
    const [a, b] = await Promise.all([
      d.collection('users').findOne({ _id: A }),
      d.collection('users').findOne({ _id: B }),
    ]);
    expect(a!.entitlements).toEqual([]);
    expect(b!.entitlements[0]).toMatchObject({ sku: 'ia-aplicada', sessionId: 'hubla:sub1' });
    expect(
      await d.collection('suporte_audit').findOne({ acao: 'vincular-confirmado' })
    ).toMatchObject({ transferidas: ['ia-aplicada'], falhas: [] });

    await expect(confirmarVinculo(d, token)).rejects.toMatchObject({
      code: 'link-invalido',
      status: 410,
    });
  });

  it('clique duplo simultâneo transfere uma vez só', async () => {
    const d = await semearCompraEmA();
    const { token } = await pedir();
    const rs = await Promise.allSettled([confirmarVinculo(d, token), confirmarVinculo(d, token)]);
    expect(rs.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const b = await d.collection('users').findOne({ _id: B });
    expect(b!.entitlements).toHaveLength(1);
  });

  it('link vencido (24h) e token inventado dão 410', async () => {
    const d = await semearCompraEmA();
    const ontem = new Date(Date.now() - 25 * 3600 * 1000);
    const { token } = await pedir('a@x.com', () => ontem);
    await expect(confirmarVinculo(d, token)).rejects.toMatchObject({ code: 'link-invalido' });
    await expect(confirmarVinculo(d, 'inventado')).rejects.toMatchObject({
      code: 'link-invalido',
    });
    await expect(confirmarVinculo(d, undefined)).rejects.toMatchObject({ code: 'link-invalido' });
    const a = await d.collection('users').findOne({ _id: A });
    expect(a!.entitlements).toHaveLength(1);
  });
});
