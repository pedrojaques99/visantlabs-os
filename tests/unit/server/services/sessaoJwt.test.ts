import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { assinarSessao, renovarSessao, SESSAO_TTL } from '../../../../server/services/sessaoJwt.js';

const secret = 'segredo-de-teste';
const usuario = { id: 'u1', email: 'a@b.com' };
const acharUsuario = async (id: string) => (id === 'u1' ? usuario : null);

describe('sessão de 30 dias', () => {
  it('assina com 30 dias', () => {
    expect(SESSAO_TTL).toBe('30d');
    const d = jwt.decode(assinarSessao(usuario, secret)) as { exp: number; iat: number };
    expect(d.exp - d.iat).toBe(30 * 24 * 3600);
  });

  it('renova uma sessão válida com o e-mail do banco', async () => {
    const velho = jwt.sign({ userId: 'u1', email: 'antigo@b.com' }, secret, { expiresIn: '7d' });
    const r = await renovarSessao(velho, { secret, acharUsuario });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const d = jwt.verify(r.token, secret) as {
        userId: string;
        email: string;
        exp: number;
        iat: number;
      };
      expect(d.userId).toBe('u1');
      expect(d.email).toBe('a@b.com');
      expect(d.exp - d.iat).toBe(30 * 24 * 3600);
    }
  });

  it('recusa sem token, token inválido e token vencido', async () => {
    expect(await renovarSessao(undefined, { secret, acharUsuario })).toMatchObject({
      ok: false,
      motivo: 'sem-token',
    });
    expect(await renovarSessao('lixo', { secret, acharUsuario })).toMatchObject({
      ok: false,
      motivo: 'token-invalido',
    });
    const outroSegredo = jwt.sign({ userId: 'u1', email: 'a@b.com' }, 'outro');
    expect(await renovarSessao(outroSegredo, { secret, acharUsuario })).toMatchObject({
      ok: false,
      motivo: 'token-invalido',
    });
    const vencido = jwt.sign(
      { userId: 'u1', email: 'a@b.com', exp: Math.floor(Date.now() / 1000) - 10 },
      secret
    );
    expect(await renovarSessao(vencido, { secret, acharUsuario })).toMatchObject({
      ok: false,
      motivo: 'token-invalido',
    });
  });

  it('não renova token de outro uso (checkout, OAuth, troca de senha)', async () => {
    for (const extra of [
      { scope: 'checkout' },
      { aud: 'mcp', sub: 'u1' },
      { type: 'password-reset' },
    ]) {
      const t = jwt.sign({ userId: 'u1', email: 'a@b.com', ...extra }, secret, { expiresIn: '1h' });
      expect(await renovarSessao(t, { secret, acharUsuario })).toMatchObject({
        ok: false,
        motivo: 'nao-e-sessao',
      });
    }
  });

  it('recusa quando o usuário não existe mais', async () => {
    const t = jwt.sign({ userId: 'sumiu', email: 'x@y.com' }, secret, { expiresIn: '7d' });
    expect(await renovarSessao(t, { secret, acharUsuario })).toMatchObject({
      ok: false,
      motivo: 'sem-usuario',
    });
  });
});
