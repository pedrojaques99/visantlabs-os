import { describe, it, expect } from 'vitest';
import { buildNamingPrompt } from '@server/lib/prompts/namingPrompt';

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
});
