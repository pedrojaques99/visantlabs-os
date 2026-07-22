import { describe, it, expect } from 'vitest';
import {
  emptyProfile,
  updateProfile,
  deriveTasteRules,
  type NamingCard,
} from '@/lib/naming/tasteProfile';
import { normalizeAvailabilityFilter } from '@/lib/naming/constants';

const card = (over: Partial<NamingCard>): NamingCard => ({
  name: 'NOME',
  rationale: 'r',
  technique: 'blend',
  territory: 't',
  ...over,
});

/** Aplica uma sequência de vereditos e devolve o perfil resultante. */
function swipes(list: Array<[Partial<NamingCard>, 'like' | 'nope' | 'superlike']>) {
  return list.reduce((p, [c, v]) => updateProfile(p, card(c), v), emptyProfile());
}

describe('deriveTasteRules', () => {
  it('stays silent until there is enough signal to trust', () => {
    const p = swipes([
      [{ name: 'A' }, 'like'],
      [{ name: 'B' }, 'like'],
    ]);
    expect(deriveTasteRules(p)).toBeNull();
  });

  it('promotes a consistently liked technique and demotes a rejected one', () => {
    const p = swipes([
      [{ name: 'A', technique: 'costura-invisivel' }, 'superlike'],
      [{ name: 'B', technique: 'costura-invisivel' }, 'like'],
      [{ name: 'C', technique: 'metafora' }, 'nope'],
      [{ name: 'D', technique: 'metafora' }, 'nope'],
      [{ name: 'E', technique: 'metafora' }, 'nope'],
    ]);
    const rules = deriveTasteRules(p)!;
    expect(rules.preferTechniques).toContain('costura-invisivel');
    expect(rules.avoidTechniques).toContain('metafora');
  });

  it('learns which language family the user responds to', () => {
    const p = swipes([
      [{ name: 'A', family: 'Nordic' }, 'superlike'],
      [{ name: 'B', family: 'Nordic' }, 'like'],
      [{ name: 'C', family: 'Romance' }, 'nope'],
      [{ name: 'D', family: 'Romance' }, 'nope'],
      [{ name: 'E', family: 'Romance' }, 'nope'],
    ]);
    const rules = deriveTasteRules(p)!;
    expect(rules.preferFamilies).toContain('Nordic');
    expect(rules.avoidFamilies).toContain('Romance');
  });

  // Sem este teto, um usuário que só viu nomes latinos e recusou alguns acabaria
  // banindo família após família até a rodada não ter de onde tirar variedade.
  it('never bans more than two language families at once', () => {
    const p = swipes(
      ['Romance', 'Nordic', 'Germanic', 'Anglo', 'Japanese'].flatMap(
        (family) =>
          [
            [{ name: `${family}1`, family }, 'nope'],
            [{ name: `${family}2`, family }, 'nope'],
            [{ name: `${family}3`, family }, 'nope'],
          ] as Array<[Partial<NamingCard>, 'nope']>
      )
    );
    expect(deriveTasteRules(p)!.avoidFamilies.length).toBeLessThanOrEqual(2);
  });

  it('derives a length band from approved names only', () => {
    const p = swipes([
      [{ name: 'GALVA' }, 'like'], // 5
      [{ name: 'AMPARA' }, 'like'], // 6
      [{ name: 'MONTRIZ' }, 'superlike'], // 7
      [{ name: 'UMNOMEMUITOLONGO' }, 'nope'],
      [{ name: 'OUTRO' }, 'nope'],
    ]);
    const band = deriveTasteRules(p)!.lengthBand!;
    expect(band.min).toBe(4);
    expect(band.max).toBe(8);
  });

  it('ignores a technique with too small a sample', () => {
    const p = swipes([
      [{ name: 'A', technique: 'blend' }, 'like'],
      [{ name: 'B', technique: 'blend' }, 'like'],
      [{ name: 'C', technique: 'raizes' }, 'nope'],
      [{ name: 'D', technique: 'jargao' }, 'nope'],
      [{ name: 'E', technique: 'invencao' }, 'nope'],
    ]);
    const rules = deriveTasteRules(p)!;
    expect(rules.avoidTechniques).not.toContain('raizes');
  });
});

describe('normalizeAvailabilityFilter', () => {
  it('accepts the three levels', () => {
    expect(normalizeAvailabilityFilter('off')).toBe('off');
    expect(normalizeAvailabilityFilter('balanced')).toBe('balanced');
    expect(normalizeAvailabilityFilter('strict')).toBe('strict');
  });

  // Sessões salvas antes do filtro virar três níveis guardaram booleano.
  it('migrates the legacy boolean without losing the user setting', () => {
    expect(normalizeAvailabilityFilter(true)).toBe('balanced');
    expect(normalizeAvailabilityFilter(false)).toBe('off');
  });

  it('falls back to balanced on garbage', () => {
    expect(normalizeAvailabilityFilter(undefined)).toBe('balanced');
    expect(normalizeAvailabilityFilter('nope')).toBe('balanced');
  });
});
