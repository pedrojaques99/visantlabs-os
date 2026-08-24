import { describe, it, expect } from 'vitest';
import { brandAvatarBg } from '@/utils/brandAvatarBg';

const claro = '#F5F2EA';
const escuro = '#141312';
const meio = '#C24A16';

describe('brandAvatarBg', () => {
  it('mark claro pousa em fundo escuro da própria paleta', () => {
    const bg = brandAvatarBg({
      logos: [{ url: 'a.svg', variant: 'light' }],
      colors: [{ hex: claro }, { hex: escuro }],
      shownUrl: 'a.svg',
    });
    expect(bg).toBe(escuro);
  });

  it('mark escuro pousa em fundo claro', () => {
    const bg = brandAvatarBg({
      logos: [{ url: 'a.svg', variant: 'dark' }],
      colors: [{ hex: claro }, { hex: escuro }],
      shownUrl: 'a.svg',
    });
    expect(bg).toBe(claro);
  });

  it('sem variante declarada, usa a cor de FUNDO da marca', () => {
    const bg = brandAvatarBg({
      logos: [{ url: 'a.svg', variant: 'primary' }],
      colors: [
        { hex: meio, role: 'primary' },
        { hex: claro, role: 'background' },
      ],
      shownUrl: 'a.svg',
    });
    expect(bg).toBe(claro);
  });

  it('devolve null sem cor nenhuma — nunca inventa matiz', () => {
    expect(brandAvatarBg({ logos: [{ url: 'a.svg' }], colors: [] })).toBeNull();
    expect(brandAvatarBg({ logos: [], colors: [] })).toBeNull();
  });

  it('paleta sem contraste interno devolve null em vez de fundo inútil', () => {
    const bg = brandAvatarBg({
      logos: [{ url: 'a.svg', variant: 'primary' }],
      colors: [{ hex: '#2A2A2A' }, { hex: '#333333' }],
      shownUrl: 'a.svg',
    });
    expect(bg).toBeNull();
  });

  it('ignora hex inválido sem quebrar', () => {
    const bg = brandAvatarBg({
      logos: [{ url: 'a.svg', variant: 'light' }],
      colors: [{ hex: 'não é cor' }, { hex: escuro }, { hex: claro }],
      shownUrl: 'a.svg',
    });
    expect(bg).toBe(escuro);
  });
});
