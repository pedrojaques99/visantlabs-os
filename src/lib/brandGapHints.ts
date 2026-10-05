/**
 * Por que cada gap da marca importa PRA GERAÇÃO (guideline = INPUT da IA).
 *
 * Consequência concreta de preencher, NÃO gamificação ("+N pontos"). Copy de
 * apresentação chaveada por `rule.id` (a SSoT das regras vive em
 * `brandCompleteness.ts`, que fica puro); o texto mora no i18n em
 * `brand.gapHints.<id>`. Reusado no cockpit ("Próximo passo") e na
 * `BrandCompletenessPill`.
 */
const BRAND_GAP_HINT_IDS = new Set([
  'name',
  'tagline',
  'description',
  'colors_2',
  'colors_named',
  'colors_role',
  'typography',
  'logo',
  'logo_variants',
  'manifesto',
  'archetype',
  'persona',
  'voice_tone',
  'voice_dos',
  'voice_donts',
  'spacing',
  'radius',
  'shadow',
  'border',
  'motion',
  'media',
  'public_or_figma',
]);

/** Chave i18n da dica de um gap (rule.id). undefined se não houver dica. */
export function brandGapHintKey(id: string): string | undefined {
  return BRAND_GAP_HINT_IDS.has(id) ? `brand.gapHints.${id}` : undefined;
}

/**
 * Dica de geração já traduzida pra um gap (rule.id). Sem `t`, devolve
 * undefined: o texto só existe traduzido.
 */
export function brandGapHint(id: string, t?: (key: string) => string): string | undefined {
  const key = brandGapHintKey(id);
  return key && t ? t(key) : undefined;
}
