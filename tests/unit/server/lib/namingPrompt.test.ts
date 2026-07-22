import { describe, it, expect } from 'vitest';
import { buildNamingPrompt, normalizeTechniqueSlugs } from '@server/lib/prompts/namingPrompt';
import { NAMING_TECHNIQUES } from '@/lib/naming/constants';

/**
 * Cliente e servidor mantêm listas separadas de técnicas (o popover não pode
 * importar do server). Uma divergência de slug NÃO quebra nada visivelmente:
 * o slug desconhecido é descartado, a lista fica vazia e a geração cai no
 * fallback de "todas as 9 técnicas" — ou seja, a configuração do usuário some
 * em silêncio. Foi exatamente o que aconteceu com 'afixo' vs 'afixos'.
 */
describe('naming technique slug parity (client ↔ server)', () => {
  it('every client slug is understood by the prompt builder', () => {
    const clientSlugs = NAMING_TECHNIQUES.map((t) => t.slug);
    expect(normalizeTechniqueSlugs(clientSlugs).sort()).toEqual([...clientSlugs].sort());
  });

  it('restricting to a single client slug yields exactly one technique', () => {
    for (const { slug } of NAMING_TECHNIQUES) {
      const prompt = buildNamingPrompt({ brief: 'brief', settings: { techniques: [slug] } });
      expect(prompt, `slug "${slug}" fell back to all techniques`).toMatch(
        /Techniques — RESTRICTED/
      );
      const listed = prompt.split('\n').filter((l) => /^\d+\. /.test(l));
      expect(listed, `slug "${slug}" listed ${listed.length} techniques`).toHaveLength(1);
    }
  });

  it('keeps the legacy "afixo" slug working for already-saved settings', () => {
    expect(normalizeTechniqueSlugs(['afixo'])).toEqual(['afixos']);
  });

  it('drops unknown slugs without inventing techniques', () => {
    expect(normalizeTechniqueSlugs(['nope', 'blend'])).toEqual(['blend']);
  });
});

/**
 * O gerador vinha devolvendo rodada inteira em português. A causa não era o
 * modelo: 'auto' (o default) não emitia seção de idioma nenhuma, então o LLM
 * seguia o idioma do briefing. Estes testes travam o default universal.
 */
describe('language universality', () => {
  it('emits an explicit universal-language section by default (auto)', () => {
    const prompt = buildNamingPrompt({ brief: 'marca de café brasileira' });
    expect(prompt).toMatch(/Language — universal by default/);
    expect(prompt).toMatch(/Germanic/);
    expect(prompt).toMatch(/Nordic/);
    expect(prompt).toMatch(/Anglo-Saxon/);
    expect(prompt).toMatch(/Japanese/);
  });

  it('caps any single language family so the round cannot collapse into one', () => {
    expect(buildNamingPrompt({ brief: 'b' })).toMatch(/no single language family may exceed/i);
  });

  it('states that a local-market brief does not imply Portuguese names', () => {
    expect(buildNamingPrompt({ brief: 'b' })).toMatch(/does NOT mean Portuguese names/);
  });

  it('scopes the Romance phonetic rules so Germanic/Anglo names are not auto-rejected', () => {
    const prompt = buildNamingPrompt({ brief: 'b', settings: { ruler: 'strict' } });
    expect(prompt).toMatch(/apply in full only to Romance-rooted candidates/);
    expect(prompt).toMatch(/consonant clusters are a FEATURE/);
    expect(prompt).toMatch(/[Mm]onosyllabic punch is legitimate/);
  });

  it('confines the brief language to the rationale, not to the names', () => {
    const prompt = buildNamingPrompt({ brief: 'b' });
    expect(prompt).toMatch(/Write the RATIONALE in the same language as the brief/);
    expect(prompt).not.toMatch(/^Respond in the same language as the brief\.$/m);
  });

  it('multi mode demands at least 4 families with a tighter cap', () => {
    const prompt = buildNamingPrompt({ brief: 'b', settings: { language: 'multi' } });
    expect(prompt).toMatch(/at least 4 DISTINCT language families/);
    expect(prompt).toMatch(/30%/);
  });

  it('still honours an explicit single-language choice', () => {
    const pt = buildNamingPrompt({ brief: 'b', settings: { language: 'pt' } });
    expect(pt).toMatch(/Mine Portuguese explicitly/);
    expect(pt).not.toMatch(/universal by default/);
  });
});

/**
 * Régua adaptativa: os like-rates viravam só prosa na "leitura de gosto" e nunca
 * restringiam a geração. Aqui eles viram instrução — com piso de exploração,
 * senão a rodada colapsa no que o usuário já viu (viés de exposição, não gosto).
 */
describe('learned ruler (dynamic taste rules)', () => {
  const rules = {
    preferTechniques: ['costura-invisivel'],
    avoidTechniques: ['metafora'],
    preferFamilies: ['Nordic'],
    avoidFamilies: ['Romance'],
    lengthBand: { min: 5, max: 7 },
    sampleSize: 12,
  };

  it('turns measured preferences into explicit instructions', () => {
    const prompt = buildNamingPrompt({ brief: 'b', tasteRules: rules });
    expect(prompt).toMatch(/Learned ruler/);
    expect(prompt).toMatch(/derived from 12 swipes/);
    expect(prompt).toMatch(/costura-invisivel/);
    expect(prompt).toMatch(/Back off these techniques.*metafora/);
    expect(prompt).toMatch(/Nordic/);
    expect(prompt).toMatch(/5-7 characters/);
  });

  it('always keeps an exploration floor so the round cannot overfit', () => {
    const prompt = buildNamingPrompt({ brief: 'b', tasteRules: rules });
    expect(prompt).toMatch(/~30% MUST still explore outside these preferences/);
    expect(prompt).toMatch(/overfitted/);
  });

  it('omits the section entirely when there are no rules yet', () => {
    expect(buildNamingPrompt({ brief: 'b' })).not.toMatch(/Learned ruler/);
  });

  it('requires the family field so taste can be learned per sound', () => {
    expect(buildNamingPrompt({ brief: 'b' })).toMatch(/"family": string/);
  });
});

describe('buildNamingPrompt', () => {
  it('includes the eliminatory phonetic ruler', () => {
    const prompt = buildNamingPrompt({ brief: 'eco-friendly water bottle brand' });
    expect(prompt).toMatch(/CVCV/);
    expect(prompt).toMatch(/paroxytone/i);
    expect(prompt).toMatch(/10 characters/i);
    expect(prompt).toMatch(/hiatus/i);
  });

  it('includes all 9 techniques', () => {
    const prompt = buildNamingPrompt({ brief: 'brief' });
    expect(prompt).toMatch(/Morpheme blend/);
    expect(prompt).toMatch(/Phonetic invention/);
    expect(prompt).toMatch(/Metaphor from another domain/);
    expect(prompt).toMatch(/Truncation/);
    expect(prompt).toMatch(/Foreign roots/);
    expect(prompt).toMatch(/Letter smuggling/);
    expect(prompt).toMatch(/Tribe jargon/);
    expect(prompt).toMatch(/Invisible seam/);
    expect(prompt).toMatch(/Affix families/);
  });

  it('treats superliked names as the north star', () => {
    const prompt = buildNamingPrompt({ brief: 'brief', superliked: ['GALVA', 'AMPARA'] });
    expect(prompt).toMatch(/NORTH STAR/);
    expect(prompt).toMatch(/GALVA/);
    expect(prompt).toMatch(/AMPARA/);
  });

  it('excludes seen names from being repeated', () => {
    const prompt = buildNamingPrompt({ brief: 'brief', seen: ['Nordem', 'Konduz'] });
    expect(prompt).toMatch(/DO NOT repeat/);
    expect(prompt).toMatch(/Nordem/);
    expect(prompt).toMatch(/Konduz/);
  });

  it('distributes territories with a 70\\/30 exploitation/exploration split', () => {
    const prompt = buildNamingPrompt({ brief: 'brief', territories: ['solidez', 'energia'] });
    expect(prompt).toMatch(/70%/);
    expect(prompt).toMatch(/30%/);
    expect(prompt).toMatch(/solidez/);
    expect(prompt).toMatch(/energia/);
  });

  it('injects tasteReading verbatim', () => {
    const reading = 'curte paroxítonas curtas com Z final; rejeita hiatos';
    const prompt = buildNamingPrompt({ brief: 'brief', tasteReading: reading });
    expect(prompt).toContain(reading);
  });

  it('extracts the pattern from rejected names', () => {
    const prompt = buildNamingPrompt({ brief: 'brief', rejected: ['Meridio', 'Probus'] });
    expect(prompt).toMatch(/Rejected by the user/);
    expect(prompt).toMatch(/rejection is a gift/);
    expect(prompt).toMatch(/Meridio/);
  });

  it('defaults count to 10 and caps at 50', () => {
    const defaultPrompt = buildNamingPrompt({ brief: 'brief' });
    expect(defaultPrompt).toMatch(/Generate exactly 10 name suggestions/);

    const cappedPrompt = buildNamingPrompt({ brief: 'brief', count: 500 });
    expect(cappedPrompt).toMatch(/Generate exactly 50 name suggestions/);
  });

  it('requires the output JSON shape with rationale, technique, territory', () => {
    const prompt = buildNamingPrompt({ brief: 'brief' });
    expect(prompt).toMatch(/"rationale"/);
    expect(prompt).toMatch(/"technique"/);
    expect(prompt).toMatch(/"territory"/);
    expect(prompt).toMatch(/"riskFlag"/);
  });

  it('ignores empty/non-string entries in list params', () => {
    const prompt = buildNamingPrompt({
      brief: 'brief',
      seen: ['', '  ', 'Valid'] as any,
    });
    expect(prompt).toMatch(/Valid/);
  });

  it('defaults to the strict, eliminatory ruler with no settings', () => {
    const prompt = buildNamingPrompt({ brief: 'brief' });
    expect(prompt).toMatch(/ELIMINATORY/);
    expect(prompt).not.toMatch(/PREFERENCE, not eliminatory/);
  });

  describe('settings.ruler', () => {
    it('balanced: ruler becomes a preference, not eliminatory', () => {
      const prompt = buildNamingPrompt({ brief: 'brief', settings: { ruler: 'balanced' } });
      expect(prompt).toMatch(/PREFERENCE, not eliminatory/);
      expect(prompt).toMatch(/exceptional concept is allowed to violate a rule/);
      expect(prompt).not.toMatch(/## Phonetic ruler — ELIMINATORY/);
    });

    it('free: ruler is disabled entirely', () => {
      const prompt = buildNamingPrompt({ brief: 'brief', settings: { ruler: 'free' } });
      expect(prompt).toMatch(/## Phonetic ruler — OFF/);
      expect(prompt).not.toMatch(/CVCV-style consonant/);
      expect(prompt).not.toMatch(/ELIMINATORY/);
    });
  });

  it('settings.maxLength overrides the default length guidance', () => {
    const prompt = buildNamingPrompt({ brief: 'brief', settings: { maxLength: 5 } });
    expect(prompt).toMatch(/Max 5 characters/);
    expect(prompt).not.toMatch(/Max 10 characters/);
  });

  it('settings.techniques restricts generation to only the given techniques', () => {
    const prompt = buildNamingPrompt({
      brief: 'brief',
      settings: { techniques: ['costura-invisivel', 'blend'] },
    });
    expect(prompt).toMatch(/RESTRICTED to the following/);
    expect(prompt).toMatch(/Invisible seam/);
    expect(prompt).toMatch(/Morpheme blend/);
    expect(prompt).not.toMatch(/Phonetic invention/);
    expect(prompt).not.toMatch(/Tribe jargon/);
  });

  it('settings.language multi mines 2-3 language families explicitly', () => {
    const prompt = buildNamingPrompt({ brief: 'brief', settings: { language: 'multi' } });
    expect(prompt).toMatch(/at least 4 DISTINCT language families/);
  });
});
