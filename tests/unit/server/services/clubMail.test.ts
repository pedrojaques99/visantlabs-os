import { describe, it, expect, vi, afterEach } from 'vitest';
import { emailDeCompra, lerModelo, buscarModelo } from '../../../../server/services/clubMail.js';
import { HUBLA_ACESSO, CLUB_ACESSO } from '../../../../server/services/hublaWebhook.js';

const loginUrl = 'https://app.visant.club/entrar/link?token=t&next=%2Fcurso%2Fia-aplicada';

describe('emailDeCompra', () => {
  it('curso: boas-vindas ao IA Labs, assinado pelo Pedro, com o grupo da turma', () => {
    const m = emailDeCompra({ nome: 'Ana Lima', loginUrl, acesso: HUBLA_ACESSO['ia-aplicada'] });
    expect(m.assunto).toBe('Bem-vindo ao IA Labs');
    expect(m.texto).toContain('Oi, Ana. Aqui é o Pedro, da Visant.');
    expect(m.texto).toContain(
      'Entrar no grupo da turma: https://app.visant.club/curso/ia-aplicada'
    );
    expect(m.texto).toContain('Um abraço,\nPedro');
    expect(m.html).toContain('marca/banner-email.png');
    expect(m.html).toContain('marca/selo-email.png');
    expect(m.html).toContain(loginUrl.replace(/&/g, '&amp;'));
  });

  it('club: chama pra conhecer os membros e diz que a cobrança fica na Hubla', () => {
    const m = emailDeCompra({ nome: null, loginUrl, acesso: CLUB_ACESSO });
    expect(m.assunto).toBe('Bem-vindo ao Visant Club');
    expect(m.texto).toContain('Oi. Aqui é o Pedro');
    expect(m.texto).toContain('Conhecer os membros: https://app.visant.club/membros');
    expect(m.texto).toContain('app.hub.la');
  });

  it('e-book: sem convite de grupo, com o título no assunto', () => {
    const m = emailDeCompra({ nome: 'Bia', loginUrl, acesso: HUBLA_ACESSO['ebook-metodologia'] });
    expect(m.assunto).toBe('Seu e-book chegou: Metodologia Visant');
    expect(m.texto).not.toContain('grupo');
    expect(m.texto).not.toContain('app.hub.la');
  });

  it('escapa o nome de quem comprou', () => {
    const m = emailDeCompra({ nome: '<b>Ana</b>', loginUrl, acesso: CLUB_ACESSO });
    expect(m.html).not.toContain('<b>Ana');
  });
});

describe('modelo salvo no /admin/emails do Club (21/11/2026)', () => {
  const curso = HUBLA_ACESSO['ia-aplicada'];

  it('sem modelo, o e-mail é o mesmo de antes', () => {
    const a = emailDeCompra({ nome: 'Ana', loginUrl, acesso: curso });
    expect(emailDeCompra({ nome: 'Ana', loginUrl, acesso: curso }, null)).toEqual(a);
  });

  it('troca só os campos salvos, com as variáveis no lugar e escapadas', () => {
    const m = emailDeCompra(
      { nome: '<i>Ana</i> Lima', loginUrl, acesso: curso },
      {
        assunto: 'Chegou, {nome}',
        texto: 'Oi, {nome}.\n\nBem-vinda ao {curso}. <b>x</b>',
        botao: 'Abrir a aula',
      }
    );
    expect(m.assunto).toBe('Chegou, <i>Ana</i>');
    expect(m.texto).toContain('Bem-vinda ao IA Labs.');
    expect(m.html).not.toContain('<i>Ana');
    expect(m.html).not.toContain('<b>x');
    expect(m.html).toContain('Abrir a aula');
    // O que não veio fica como estava: convite, abraço, rodapé.
    expect(m.texto).toContain('Entrar no grupo da turma');
    expect(m.texto).toContain('Um abraço,\nPedro');
    expect(m.texto).toContain('app.visant.club/entrar');
  });

  it('sem nome, "Oi, {nome}." vira "Oi."', () => {
    const m = emailDeCompra(
      { nome: null, loginUrl, acesso: CLUB_ACESSO },
      { texto: 'Oi, {nome}. Que bom.' }
    );
    expect(m.texto.startsWith('Oi. Que bom.')).toBe(true);
  });

  it('visual: sem banner, outra variação, sem assinatura, assinado pela casa', () => {
    expect(
      emailDeCompra({ nome: 'A', loginUrl, acesso: curso }, { banner: false }).html
    ).not.toContain('banner-email');
    expect(emailDeCompra({ nome: 'A', loginUrl, acesso: curso }, { variacao: 3 }).html).toContain(
      'banner-email-3.png'
    );
    const m = emailDeCompra(
      { nome: 'A', loginUrl, acesso: curso },
      { assinatura: false, quem: 'club' }
    );
    expect(m.html).not.toContain('selo-email.png');
    expect(m.texto).not.toContain('Um abraço');
  });

  it('lerModelo descarta o que não tem a forma certa', () => {
    expect(lerModelo(null)).toBeNull();
    expect(lerModelo('x')).toBeNull();
    expect(lerModelo({ assunto: 'a\nBcc: x@y.com', variacao: 9, quem: 'outro' })).toBeNull();
    expect(lerModelo({ assunto: 'Oi', banner: false, lixo: 1 })).toEqual({
      assunto: 'Oi',
      banner: false,
    });
  });
});

describe('buscarModelo', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it('sem EMAIL_MODELO_SECRET nem chama o Club', async () => {
    delete process.env.EMAIL_MODELO_SECRET;
    const f = vi.fn();
    expect(await buscarModelo('curso', f as never)).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it('pede o modelo certo com o segredo, e lê a resposta', async () => {
    process.env.EMAIL_MODELO_SECRET = 's3';
    const f = vi.fn(async () => new Response(JSON.stringify({ modelo: { botao: 'Ir' } })));
    expect(await buscarModelo('ebook', f as never)).toEqual({ botao: 'Ir' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/api\/emails\/modelo\/compra-ebook$/);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer s3');
  });

  it('Club fora, 401 ou JSON ruim: null, e nunca lança', async () => {
    process.env.EMAIL_MODELO_SECRET = 's3';
    expect(
      await buscarModelo('club', (async () => {
        throw new Error('timeout');
      }) as never)
    ).toBeNull();
    expect(
      await buscarModelo('club', (async () => new Response('{}', { status: 401 })) as never)
    ).toBeNull();
    expect(
      await buscarModelo('club', (async () => new Response('não é json')) as never)
    ).toBeNull();
  });
});
