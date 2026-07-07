/**
 * Naming Machine — prompt builder distilled from the Visant naming methodology
 * (`Z:\VISANT\E-book\Naming\metodologia-naming-visant.md`).
 *
 * Pure function, no I/O — testable in isolation. Consumed by
 * `POST /api/ai/generate-naming` (server/routes/ai.ts).
 *
 * Phonetics is ELIMINATORY, concept is classificatory: the model is instructed
 * to generate wide internally, filter by the phonetic ruler, and return only
 * survivors — never leak the wide/rejected pool into the response.
 */

export interface NamingPromptOptions {
  /** Free-form brief (or the rich `briefText` produced by naming-briefing). */
  brief: string;
  /** How many names to return. */
  count?: number;
  /** Optional style hint (minimal, playful, corporate, abstract, etc.). */
  style?: string;
  /** Optional brand context block (from buildBrandContextForImageGen). */
  brandContext?: string;
  /** Names already shown to the user — NEVER repeat these. */
  seen?: string[];
  /** Names the user liked (goes to shortlist). */
  liked?: string[];
  /** Names the user superliked — treated as the north star for this round. */
  superliked?: string[];
  /** Names the user explicitly rejected — extract the pattern and avoid it. */
  rejected?: string[];
  /** Qualitative taste reading (from naming-insight `pattern` mode). */
  tasteReading?: string;
  /** Symbolic territories to distribute the round across (~70/30 rule). */
  territories?: string[];
}

const MAX_LIST_ITEMS = 200;

function clip(list: string[] | undefined, max = MAX_LIST_ITEMS): string[] {
  if (!Array.isArray(list)) return [];
  return list.filter((s) => typeof s === 'string' && s.trim().length > 0).slice(0, max);
}

/**
 * Build the full prompt (single string — matches the Gemini `generateContent`
 * call site, which takes one prompt rather than system/user turns).
 */
export function buildNamingPrompt(opts: NamingPromptOptions): string {
  const count = opts.count && opts.count > 0 ? Math.min(opts.count, 50) : 10;
  const seen = clip(opts.seen);
  const liked = clip(opts.liked);
  const superliked = clip(opts.superliked);
  const rejected = clip(opts.rejected);
  const territories = clip(opts.territories, 20);

  const sections: string[] = [];

  if (opts.brandContext) {
    sections.push(`Brand context:\n${opts.brandContext}`);
  }

  sections.push(
    `You are a senior brand naming strategist trained in the Visant naming methodology — the discipline behind names like AMPARA, GALVA, MONTRIZ, NORDEM and KONDUZ. You do not generate generic startup names; you engineer names with phonetic craft AND hidden semantic layers.`
  );

  sections.push(`Brief: ${opts.brief}`);

  if (opts.style) {
    sections.push(`Style preference: ${opts.style}.`);
  }

  sections.push(
    [
      '## Core principle: invisible seam (costura invisível)',
      'The signature technique is a fusion of two words/morphemes where the seam disappears — surface reads as one fluid word, but investigation reveals layers. If you can guess what the company does just from the name, it is too literal. If nothing rewards a closer look, it is too shallow.',
    ].join('\n')
  );

  sections.push(
    [
      '## Phonetic ruler — ELIMINATORY (apply after generating wide internally; return ONLY survivors)',
      '- Pattern: CVCV-style consonant/vowel alternation.',
      '- Paroxytone (stress on penultimate syllable), 2-3 syllables.',
      '- Max 10 characters, ideal ≤7.',
      '- Clean endings: open vowel (-a/-o/-e) OR a single strong final consonant (R or Z).',
      '- The "shop floor test": must work shouted on a factory floor AND written on a spreadsheet.',
      '- REJECT: hiatus and -io/-ia endings; Latin -us/-um endings; long proparoxytones (stress 3+ syllables back); clogged consonant clusters; foreign words outside the brand\'s symbolic universe.',
      '- Read each candidate aloud fast, three times. If it trips once, discard it.',
      '- Generate broad internally (30-50 candidates), filter hard by this ruler, and surface only the survivors — never mention the discarded pool.',
    ].join('\n')
  );

  sections.push(
    [
      '## Techniques — vary across the round; at least 1/3 of names should use high-craft techniques',
      '1. Morpheme blend (Pinterest = pin + interest).',
      '2. Phonetic invention — a word that does not exist but sounds right (Kodak).',
      '3. Metaphor from another domain (Apple, Nest).',
      '4. Truncation — cut to the essence (Canva from canvas).',
      '5. Foreign roots — Latin/Greek/other roots for resonance without literalness. Root yes, Latin ENDING no (still obeys the phonetic ruler).',
      '6. Letter smuggling — a real word hiding another inside it (AÇOR hides aço/steel; VIGOR hides viga/beam).',
      '7. Tribe jargon — backstage technical terms elevated to brand names, a password of belonging for a technical B2B decision-maker (TRAFO, PLENUM, PRUMADA).',
      '8. Invisible seam (signature technique) — fusion where the seam disappears (AMPARA, GALVA, MONTRIZ).',
      '9. Affix families — a shared prefix/suffix that builds a naming system across a group of brands (SUPRA-, -MONT).',
      'Distribute the round across symbolic territories — never 20 variations of the same territory.',
    ].join('\n')
  );

  sections.push(
    [
      '## Anti-patterns — never do this',
      '- Generic/descriptive names (TechSol, SmartPay).',
      '- A name that explains the product outright — a great name creates intrigue, not explanation.',
      '- Presenting a name with no rationale/defense.',
      '- Repeating a rejected name.',
      '- Monolingual thinking — mine 2-3 language families, even for a local-market brand.',
      '- Promising availability/trademark clearance — that is not this tool\'s job.',
    ].join('\n')
  );

  if (seen.length) {
    sections.push(
      `## Already shown — DO NOT repeat, in any form/casing\n${seen.join(', ')}`
    );
  }

  if (rejected.length) {
    sections.push(
      `## Rejected by the user\n${rejected.join(', ')}\nExtract the pattern behind this rejection (phonetics, territory, technique) and actively avoid it — rejection is a gift, it teaches the ruler faster than positive references do.`
    );
  }

  if (liked.length) {
    sections.push(`## Liked by the user (shortlisted, keep the vein alive)\n${liked.join(', ')}`);
  }

  if (superliked.length) {
    sections.push(
      `## Superliked — treat as the NORTH STAR for this round\nThe user marked these as candidates to actually become the brand name: ${superliked.join(
        ', '
      )}. Prioritize this direction — same territory, same phonetic register, same craft level — while still bringing genuine variety.`
    );
  }

  if (opts.tasteReading) {
    sections.push(`## Taste reading (qualitative pattern from prior rounds)\n${opts.tasteReading}`);
  }

  if (territories.length) {
    sections.push(
      `## Symbolic territories to distribute this round across\n${territories.join(
        ', '
      )}\nAim for roughly 70% of names anchored in these territories (exploitation) and roughly 30% exploring adjacent/new territories (exploration) — never collapse the whole round into a single note.`
    );
  }

  sections.push(
    [
      `## Output`,
      `Generate exactly ${count} name suggestions.`,
      'Respond in the same language as the brief.',
      'Respond ONLY with valid JSON, no prose, no code fences:',
      '{ "names": [{ "name": string, "rationale": string, "riskFlag"?: string, "technique": string, "territory": string }] }',
      '- "rationale": the 1-3 line defense of the name (why it works, what layer it hides). Every name needs one — a name with no defense is an anti-pattern.',
      '- "riskFlag": only when honestly warranted (e.g. an obvious famous homonym in another category) — omit otherwise, never fabricate a risk.',
      '- "technique": which of the 9 techniques above was used.',
      '- "territory": the symbolic territory this name belongs to.',
    ].join('\n')
  );

  return sections.join('\n\n');
}
