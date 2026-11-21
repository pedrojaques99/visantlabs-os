import { describe, it, expect } from 'vitest';
import { emailDeCompra } from '../../../../server/services/clubMail.js';
import { HUBLA_ACESSO, CLUB_ACESSO } from '../../../../server/services/hublaWebhook.js';

const loginUrl = 'https://app.visant.club/entrar/link?token=t&next=%2Fcurso%2Fia-aplicada';

describe('emailDeCompra', () => {
  it('curso: boas-vindas ao IA Labs, assinado pelo Pedro, com o grupo da turma', () => {
    const m = emailDeCompra({ nome: 'Ana Lima', loginUrl, acesso: HUBLA_ACESSO['ia-aplicada'] });
    expect(m.assunto).toBe('Bem-vindo ao IA Labs');
    expect(m.texto).toContain('Oi, Ana. Aqui é o Pedro, da Visant.');
    expect(m.texto).toContain('Entrar no grupo da turma: https://app.visant.club/curso/ia-aplicada');
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
