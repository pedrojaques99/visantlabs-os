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

/** Ruler strictness — how eliminatory the phonetic ruler is. */
export type NamingRuler = 'strict' | 'balanced' | 'free';

/** Which language(s) to mine for candidates. */
export type NamingLanguage = 'auto' | 'pt' | 'en' | 'multi';

export interface NamingSettings {
  /**
   * 'strict' (default) — phonetic ruler is ELIMINATORY, same as today.
   * 'balanced' — ruler becomes a strong PREFERENCE, not eliminatory: an
   *   exceptional concept may violate a rule.
   * 'free' — ruler is off; keep only basic pronounceability + anti-patterns.
   */
  ruler?: NamingRuler;
  /** Overrides the "max 10, ideal <=7" length guidance. 0/undefined = default. */
  maxLength?: number;
  /** Restrict generation to these technique slugs. Empty/undefined = all 9. */
  techniques?: string[];
  /**
   * 'auto' (default) — language of the brief.
   * 'pt' | 'en' — mine that language explicitly.
   * 'multi' — mine 2-3 language families explicitly.
   */
  language?: NamingLanguage;
}

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
  /** Generation settings — loosen/tighten the rules. Default = current strict behavior. */
  settings?: NamingSettings;
  /** Régua aprendida com os swipes desta sessão (deriveTasteRules). */
  tasteRules?: TasteRules;
}

/** Espelha `TasteRules` do cliente (src/lib/naming/tasteProfile.ts). */
export interface TasteRules {
  preferTechniques?: string[];
  avoidTechniques?: string[];
  preferFamilies?: string[];
  avoidFamilies?: string[];
  lengthBand?: { min: number; max: number };
  sampleSize?: number;
}

const MAX_LIST_ITEMS = 200;

/** Human-readable technique labels keyed by the slugs accepted in `settings.techniques`. */
const TECHNIQUE_LABELS: Record<string, string> = {
  blend: 'Morpheme blend (Pinterest = pin + interest).',
  invencao: 'Phonetic invention — a word that does not exist but sounds right (Kodak).',
  metafora: 'Metaphor from another domain (Apple, Nest).',
  truncamento: 'Truncation — cut to the essence (Canva from canvas).',
  raizes:
    'Foreign roots — mine Latin/Greek BUT ALSO German, Nordic, Japanese, Slavic and Tupi roots for resonance without literalness. Root yes, Latin ENDING no (still obeys the phonetic ruler).',
  contrabando:
    'Letter smuggling — a real word hiding another inside it (AÇOR hides aço/steel; VIGOR hides viga/beam).',
  jargao:
    'Tribe jargon — backstage technical terms elevated to brand names, a password of belonging for a technical B2B decision-maker (TRAFO, PLENUM, PRUMADA).',
  'costura-invisivel':
    'Invisible seam (signature technique) — fusion where the seam disappears. Works in ANY language: AMPARA, GALVA, MONTRIZ (Romance), KLARNA, NORDVIK (Nordic), STRALEN, KERNAU (Germanic).',
  afixos:
    'Affix families — a shared prefix/suffix that builds a naming system across a group of brands (SUPRA-, -MONT).',
};

/**
 * Slugs legados que já estão persistidos em `User.namingSettings` e precisam
 * continuar valendo. O cliente gravou 'afixo' por um tempo enquanto o prompt só
 * conhecia 'afixos' — a divergência fazia a seleção do usuário virar array vazio
 * e cair no fallback de "todas as técnicas", ou seja, a config não aplicava.
 */
const TECHNIQUE_ALIASES: Record<string, string> = {
  afixo: 'afixos',
};

/**
 * Normaliza slugs de técnica (resolve aliases) e descarta os desconhecidos.
 * Avisa no log em vez de silenciar: descarte mudo aqui vira fallback de 9
 * técnicas e o usuário não tem como perceber que a config foi ignorada.
 */
export function normalizeTechniqueSlugs(slugs: string[]): string[] {
  const out: string[] = [];
  const unknown: string[] = [];
  for (const raw of slugs) {
    const slug = TECHNIQUE_ALIASES[raw] || raw;
    if (TECHNIQUE_LABELS[slug]) {
      if (!out.includes(slug)) out.push(slug);
    } else {
      unknown.push(raw);
    }
  }
  if (unknown.length) {
    console.warn('[namingPrompt] unknown technique slugs ignored:', unknown.join(', '));
  }
  return out;
}

function clip(list: string[] | undefined, max = MAX_LIST_ITEMS): string[] {
  if (!Array.isArray(list)) return [];
  // slice(-max): mantém os itens MAIS RECENTES (fim da lista). Antes pegava os
  // mais antigos, deixando os nomes recém-mostrados fora do avoid-list → repetição.
  return list.filter((s) => typeof s === 'string' && s.trim().length > 0).slice(-max);
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

  const ruler: NamingRuler = opts.settings?.ruler || 'strict';
  const maxLength =
    opts.settings?.maxLength && opts.settings.maxLength > 0
      ? Math.min(opts.settings.maxLength, 20)
      : undefined;
  const techniqueSlugs = normalizeTechniqueSlugs(clip(opts.settings?.techniques, 9));
  const language: NamingLanguage = opts.settings?.language || 'auto';

  const sections: string[] = [];

  if (opts.brandContext) {
    sections.push(`Brand context:\n${opts.brandContext}`);
  }

  sections.push(
    `You are a senior brand naming strategist trained in the Visant naming methodology — the discipline behind names like AMPARA, GALVA, MONTRIZ, NORDEM and KONDUZ. You do not generate generic startup names; you engineer names with phonetic craft AND hidden semantic layers.\nThose reference names are Portuguese because that is where the studio started — they calibrate the CRAFT LEVEL, not the language. You are equally fluent in the registers of BRAUN, ZEISS, BOSCH (German), KLARNA, OATLY, NOKIA (Nordic), STRIPE, SLACK, LUSH (Anglo), ON, LOGITECH, RICOLA (Swiss), MUJI, CANON (Japanese). A round that comes back entirely Romance is a failed round.`
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

  const lengthLine = maxLength
    ? `- Max ${maxLength} characters.`
    : '- Max 10 characters, ideal ≤7.';

  if (ruler === 'strict') {
    sections.push(
      [
        '## Phonetic ruler — ELIMINATORY (apply after generating wide internally; return ONLY survivors)',
        '- Pattern: CVCV-style consonant/vowel alternation.',
        '- Paroxytone (stress on penultimate syllable), 2-3 syllables.',
        lengthLine,
        '- Clean endings: open vowel (-a/-o/-e) OR a single strong final consonant (R or Z).',
        '- The "shop floor test": must work shouted on a factory floor AND written on a spreadsheet.',
        "- REJECT: hiatus and -io/-ia endings; Latin -us/-um endings; long proparoxytones (stress 3+ syllables back); clogged consonant clusters; foreign words outside the brand's symbolic universe.",
        '- Read each candidate aloud fast, three times. If it trips once, discard it.',
        '- Generate broad internally (30-50 candidates), filter hard by this ruler, and surface only the survivors — never mention the discarded pool.',
        '',
        "IMPORTANT — the rules above describe ROMANCE phonology and apply in full only to Romance-rooted candidates. Applying them literally to every language would ban BRAUN, ZEISS, STRIPE and KLARNA, which is wrong. For non-Romance candidates, enforce the EQUIVALENT bar in that language's own register:",
        '- Germanic/Swiss: initial-syllable stress, hard stops (B/K/T/Z), consonant clusters are a FEATURE not a defect (BRAUN, ZEISS, BOSCH).',
        '- Nordic: two syllables, soft consonants, open or -a endings (KLARNA, OATLY, NOKIA).',
        '- Anglo: monosyllabic punch is legitimate — one strong syllable beats forced CVCV (STRIPE, SLACK, LUSH).',
        '- Japanese: strict open syllables, no final consonant (MUJI, CANON).',
        'The invariant across ALL families is the shop-floor test: says fast, reads clean, does not trip the tongue. That is the real ruler — CVCV is just how it looks in Portuguese.',
      ].join('\n')
    );
  } else if (ruler === 'balanced') {
    sections.push(
      [
        '## Phonetic ruler — PREFERENCE, not eliminatory',
        'Prefer names that follow this ruler, but an exceptional concept is allowed to violate a rule when the payoff is worth it — craft over compliance.',
        '- Pattern: CVCV-style consonant/vowel alternation (preferred).',
        '- Paroxytone (stress on penultimate syllable), 2-3 syllables (preferred).',
        lengthLine.replace('Max', 'Preferred max'),
        '- Clean endings: open vowel (-a/-o/-e) OR a single strong final consonant (R or Z) (preferred).',
        '- The "shop floor test" is a good tie-breaker, not a hard gate.',
        '- Hiatus, -io/-ia endings, Latin -us/-um endings, proparoxytones and consonant clusters are DISCOURAGED, not banned — allow them only when the name is genuinely excellent.',
      ].join('\n')
    );
  } else {
    sections.push(
      [
        '## Phonetic ruler — OFF',
        'The strict phonetic ruler is disabled. Keep only basic pronounceability (a fluent native speaker can say it on first read) and the anti-patterns below — no CVCV/paroxytone/length constraints.',
      ].join('\n')
    );
  }

  const allTechniques: Array<[string, string]> = [
    ['blend', TECHNIQUE_LABELS.blend],
    ['invencao', TECHNIQUE_LABELS.invencao],
    ['metafora', TECHNIQUE_LABELS.metafora],
    ['truncamento', TECHNIQUE_LABELS.truncamento],
    ['raizes', TECHNIQUE_LABELS.raizes],
    ['contrabando', TECHNIQUE_LABELS.contrabando],
    ['jargao', TECHNIQUE_LABELS.jargao],
    ['costura-invisivel', TECHNIQUE_LABELS['costura-invisivel']],
    ['afixos', TECHNIQUE_LABELS.afixos],
  ];
  const activeTechniques = techniqueSlugs.length
    ? allTechniques.filter(([slug]) => techniqueSlugs.includes(slug))
    : allTechniques;

  sections.push(
    [
      techniqueSlugs.length
        ? '## Techniques — RESTRICTED to the following (do not use any other technique)'
        : '## Techniques — vary across the round; at least 1/3 of names should use high-craft techniques',
      ...activeTechniques.map(([, label], i) => `${i + 1}. ${label}`),
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
      '- Monolingual thinking — a round where every name comes from one language family is an automatic failure, even for a local-market brand.',
      '- Proposing a name that is ALREADY an established company or product you recognise (VALEO, KAIZEN, LUMINA, ARKEN, APEXUS, INVAR are all taken). You know the major brands — screen your own list against them BEFORE returning it and replace any hit. Obvious dictionary words and well-known Japanese/Latin business terms are almost always taken; prefer coined/fused forms.',
      "- Defaulting to the brief's language. Portuguese is ONE option among many, never the baseline.",
      "- Promising availability/trademark clearance — that is not this tool's job.",
    ].join('\n')
  );

  // Antes, 'auto' (o DEFAULT) não emitia seção nenhuma — sem instrução de idioma
  // o modelo seguia o idioma do briefing e devolvia rodada inteira em português.
  // O default agora é explicitamente universal; quem quer PT puro escolhe PT.
  const LANGUAGE_FAMILIES =
    'Germanic (German/Dutch), Nordic (Swedish/Danish/Norwegian/Finnish), Anglo-Saxon, Swiss/Alpine, Romance (Portuguese/Spanish/Italian/French), Latin/Greek roots, Slavic, Japanese, Tupi-Guarani';

  if (language === 'pt') {
    sections.push(
      '## Language\nMine Portuguese explicitly — candidates should read as Portuguese (or Portuguese-rooted) words.'
    );
  } else if (language === 'en') {
    sections.push(
      '## Language\nMine English explicitly — candidates should read as English (or English-rooted) words.'
    );
  } else if (language === 'multi') {
    sections.push(
      `## Language — mandatory diversity\nMine at least 4 DISTINCT language families across the round: ${LANGUAGE_FAMILIES}.\nNo single family may exceed 30% of the names. Name the family in each rationale.`
    );
  } else {
    sections.push(
      [
        '## Language — universal by default',
        `Do NOT default to the language of the brief. Spread the round across at least 3 distinct language families: ${LANGUAGE_FAMILIES}.`,
        'Hard cap: no single language family may exceed 40% of the names in this round.',
        'A Brazilian brief does NOT mean Portuguese names — BRAUN, KLARNA and STRIPE all sell fine in Brazil. Local market constrains MEANING and pronounceability, never the source language.',
        'Before returning, count your own names by family. If one family dominates, replace the excess.',
      ].join('\n')
    );
  }

  if (seen.length) {
    sections.push(`## Already shown — DO NOT repeat, in any form/casing\n${seen.join(', ')}`);
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

  // Régua adaptativa: as preferências medidas nos swipes viram restrição de
  // verdade, não só prosa. O piso de exploração é obrigatório — sem ele a
  // rodada colapsa no que o usuário já viu, que é viés de exposição e não gosto.
  const tr = opts.tasteRules;
  if (tr) {
    const lines: string[] = [
      `## Learned ruler — derived from ${tr.sampleSize ?? 0} swipes THIS session (overrides generic defaults)`,
    ];
    if (tr.preferTechniques?.length)
      lines.push(`- Favour these techniques (high like-rate): ${tr.preferTechniques.join(', ')}.`);
    if (tr.avoidTechniques?.length)
      lines.push(
        `- Back off these techniques (consistently rejected): ${tr.avoidTechniques.join(', ')}.`
      );
    if (tr.preferFamilies?.length)
      lines.push(
        `- The user responds to these language families: ${tr.preferFamilies.join(', ')}.`
      );
    if (tr.avoidFamilies?.length)
      lines.push(`- De-emphasise these families: ${tr.avoidFamilies.join(', ')}.`);
    if (tr.lengthBand)
      lines.push(
        `- Approved names cluster at ${tr.lengthBand.min}-${tr.lengthBand.max} characters. Centre the round there.`
      );
    lines.push(
      'Apply this as roughly 70% of the round (exploitation). The remaining ~30% MUST still explore outside these preferences — including language families not listed above. A round that satisfies the learned ruler 100% is overfitted and gives the user nothing new to react to.'
    );
    if (lines.length > 2) sections.push(lines.join('\n'));
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
      'Write the RATIONALE in the same language as the brief. This does NOT constrain the names themselves — they should span language families regardless of the brief language.',
      'Respond ONLY with valid JSON, no prose, no code fences:',
      '{ "names": [{ "name": string, "rationale": string, "riskFlag"?: string, "technique": string, "territory": string, "family": string }] }',
      '- "rationale": the 1-3 line defense of the name (why it works, what layer it hides). Every name needs one — a name with no defense is an anti-pattern.',
      '- "riskFlag": only when honestly warranted (e.g. an obvious famous homonym in another category) — omit otherwise, never fabricate a risk.',
      `- "technique": which of the ${activeTechniques.length} technique(s) above was used.`,
      '- "territory": the symbolic territory this name belongs to.',
      '- "family": the language family the name is mined from (Germanic, Nordic, Anglo, Romance, Latin/Greek, Slavic, Japanese, Tupi-Guarani...). Required — it is how the system learns which sound the user actually responds to.',
    ].join('\n')
  );

  return sections.join('\n\n');
}
