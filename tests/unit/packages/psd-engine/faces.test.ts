import { describe, it, expect } from 'vitest';
import { computeFaces, type FaceSo } from '@visant/psd-engine';

const so = (p: Partial<FaceSo> & { name: string }): FaceSo => ({
  path: p.name,
  innerWidth: 100,
  innerHeight: 100,
  ...p,
});

describe('computeFaces', () => {
  it('returns [] for no smart objects', () => {
    expect(computeFaces([])).toEqual([]);
  });

  it('detects an editable face by SO_TARGET name and cleans the display name', () => {
    const faces = computeFaces([so({ name: '(Edite Aqui) Frente' })]);
    expect(faces).toHaveLength(1);
    expect(faces[0].name).not.toMatch(/edite|aqui|[()]/i);
    expect(faces[0].smartObject).toBe('(Edite Aqui) Frente');
    expect(faces[0].linkedCount).toBe(1);
  });

  it('detects faces by the extended target vocab (change / PT verbs / sua arte)', () => {
    for (const name of [
      'CHANGE DESIGN',
      'Troque aqui a arte',
      'Coloque sua arte',
      'Substitua a imagem',
      'Sua Logo',
    ]) {
      const faces = computeFaces([so({ name, linkId: name })]);
      expect(faces, `"${name}" deveria virar face`).toHaveLength(1);
    }
  });

  it('groups linked SOs (same linkId) into one face', () => {
    const faces = computeFaces([
      so({ name: 'Design Here', linkId: 'L1' }),
      so({ name: 'Frente visivel', linkId: 'L1' }),
    ]);
    expect(faces).toHaveLength(1);
    expect(faces[0].linkedCount).toBe(2);
  });

  it('ignores purely decorative SO groups (sombra/luz)', () => {
    const faces = computeFaces([
      so({ name: 'Design Here', linkId: 'A' }),
      so({ name: 'Sombra', linkId: 'B', hidden: false }),
      so({ name: 'Luz Overlay', linkId: 'C' }),
    ]);
    const names = faces.map((f) => f.name.toLowerCase());
    expect(names.some((n) => n.includes('sombra') || n.includes('luz'))).toBe(false);
    expect(faces).toHaveLength(1);
  });

  it('falls back to the largest non-decorative SO when nothing matches a target', () => {
    const faces = computeFaces([
      so({ name: 'Camada A', innerWidth: 50, innerHeight: 50, hidden: true }),
      so({ name: 'Camada B', innerWidth: 300, innerHeight: 300, hidden: true }),
    ]);
    expect(faces).toHaveLength(1);
    expect(faces[0].innerWidth).toBe(300);
  });

  it('quando há marcador de arte, NÃO trata SOs de cena (bg/ambient) como face', () => {
    // Padrão BR Outdoor/Sign: a foto de fundo é um smart object ("BG") + a face "Arte Aqui".
    const faces = computeFaces([
      so({ name: 'BG', linkId: 'bg', innerWidth: 4000, innerHeight: 2000 }),
      so({ name: 'Ambient', linkId: 'amb', innerWidth: 4000, innerHeight: 2000 }),
      so({ name: 'Arte Aqui', linkId: 'art', innerWidth: 3000, innerHeight: 1200 }),
    ]);
    expect(faces).toHaveLength(1);
    expect(faces[0].name.toLowerCase()).not.toMatch(/\bbg\b|ambient/);
    expect(faces[0].smartObject).toBe('Arte Aqui');
  });

  it('sem nenhum marcador, mantém faces de conteúdo nomeadas (ex.: caixa "Face Frente/Lado")', () => {
    const faces = computeFaces([
      so({ name: '- Face Frente 01', linkId: 'f1' }),
      so({ name: '- Face Lado 02', linkId: 'f2' }),
      so({ name: 'box 5', linkId: 'b5', innerWidth: 4000, innerHeight: 2000 }),
    ]);
    // Nenhum bate SO_TARGET → heurística antiga (visível não-decorativo) mantém as faces de conteúdo.
    expect(faces.length).toBeGreaterThanOrEqual(2);
    expect(faces.map((f) => f.smartObject)).toEqual(
      expect.arrayContaining(['- Face Frente 01', '- Face Lado 02'])
    );
  });

  it('suffixes duplicate face names for the UI', () => {
    const faces = computeFaces([
      so({ name: 'Arte', linkId: 'A' }),
      so({ name: 'Arte', linkId: 'B' }),
    ]);
    expect(faces).toHaveLength(2);
    const names = faces.map((f) => f.name).sort();
    expect(names).toEqual(['Arte 1', 'Arte 2']);
  });
});
