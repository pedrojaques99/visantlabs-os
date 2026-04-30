/**
 * Brand Completeness — pure scoring function.
 *
 * Output is consumed by the pill in BrandGuidelinesPage header.
 * Designed for "quality of LLM input" — weights reflect how much each
 * field improves AI generation results.
 *
 * NOT a quality judgement. NO LLM call. NO network. Deterministic.
 */
import type { BrandGuideline } from './figma-types';

export interface CompletenessRule {
  id: string;
  label: string;
  weight: number;
  passed: boolean;
  group: 'identity' | 'visual' | 'strategy' | 'voice' | 'tokens' | 'assets';
}

export interface CompletenessReport {
  score: number;
  rules: CompletenessRule[];
  missing: CompletenessRule[];
  byGroup: Record<CompletenessRule['group'], { score: number; max: number }>;
}

const arr = <T,>(v: T[] | undefined | null): T[] => (Array.isArray(v) ? v : []);
const len = (v: unknown): number => (Array.isArray(v) ? v.length : 0);
const filled = (v: unknown): boolean =>
  typeof v === 'string' ? v.trim().length > 0 : v !== undefined && v !== null;

export function computeBrandCompleteness(g: BrandGuideline | null | undefined): CompletenessReport {
  if (!g) {
    return { score: 0, rules: [], missing: [], byGroup: emptyByGroup() };
  }

  const rules: CompletenessRule[] = [
    // Identity (15)
    { id: 'name',        label: 'Nome da marca',     weight: 5, group: 'identity', passed: filled(g.identity?.name || g.name) },
    { id: 'tagline',     label: 'Tagline',            weight: 4, group: 'identity', passed: filled(g.identity?.tagline || g.tagline) },
    { id: 'description', label: 'Descrição da marca', weight: 6, group: 'identity', passed: filled(g.identity?.description || g.description) },

    // Visual (35)
    { id: 'colors_2',     label: 'Pelo menos 2 cores',          weight: 8, group: 'visual', passed: len(g.colors) >= 2 },
    { id: 'colors_named', label: 'Cores com nomes ou roles',     weight: 5, group: 'visual', passed: arr(g.colors).some(c => filled(c.name) || filled(c.role)) },
    { id: 'colors_role',  label: 'Pelo menos 1 cor com role',    weight: 4, group: 'visual', passed: arr(g.colors).some(c => filled(c.role)) },
    { id: 'typography',   label: 'Pelo menos 1 tipografia',      weight: 8, group: 'visual', passed: len(g.typography) >= 1 },
    { id: 'logo',         label: 'Pelo menos 1 logo',            weight: 6, group: 'visual', passed: len(g.logos) >= 1 },
    { id: 'logo_variants',label: 'Logo com variantes (light/dark/icon)', weight: 4, group: 'visual', passed: new Set(arr(g.logos).map(l => l.variant)).size >= 2 },

    // Strategy (20)
    { id: 'manifesto',  label: 'Manifesto',          weight: 8, group: 'strategy', passed: filled(g.strategy?.manifesto) },
    { id: 'archetype',  label: 'Pelo menos 1 arquétipo', weight: 6, group: 'strategy', passed: len(g.strategy?.archetypes) >= 1 },
    { id: 'persona',    label: 'Pelo menos 1 persona',   weight: 6, group: 'strategy', passed: len(g.strategy?.personas) >= 1 },

    // Voice & guidelines (15)
    { id: 'voice_tone',  label: 'Tom de voz',                  weight: 5, group: 'voice', passed: filled(g.guidelines?.voice) || len(g.strategy?.voiceValues) >= 1 },
    { id: 'voice_dos',   label: 'Lista de "Do\'s"',            weight: 5, group: 'voice', passed: len(g.guidelines?.dos) >= 1 },
    { id: 'voice_donts', label: 'Lista de "Don\'ts"',          weight: 5, group: 'voice', passed: len(g.guidelines?.donts) >= 1 },

    // Tokens (10)
    { id: 'spacing', label: 'Spacing tokens',  weight: 5, group: 'tokens', passed: Object.keys(g.tokens?.spacing || {}).length >= 2 },
    { id: 'radius',  label: 'Radius tokens',   weight: 5, group: 'tokens', passed: Object.keys(g.tokens?.radius  || {}).length >= 1 },

    // Assets (5)
    { id: 'media',     label: 'Media kit ou knowledge', weight: 3, group: 'assets', passed: len(g.media) >= 1 || len(g.knowledgeFiles) >= 1 },
    { id: 'public_or_figma', label: 'Compartilhamento ou Figma vinculado', weight: 2, group: 'assets', passed: !!g.publicSlug || !!g.figmaFileUrl },
  ];

  const byGroup = emptyByGroup();
  for (const r of rules) {
    byGroup[r.group].max += r.weight;
    if (r.passed) byGroup[r.group].score += r.weight;
  }

  const totalMax = rules.reduce((s, r) => s + r.weight, 0);
  const totalScore = rules.reduce((s, r) => s + (r.passed ? r.weight : 0), 0);
  const score = totalMax === 0 ? 0 : Math.round((totalScore / totalMax) * 100);

  return {
    score,
    rules,
    missing: rules.filter(r => !r.passed),
    byGroup,
  };
}

function emptyByGroup(): CompletenessReport['byGroup'] {
  return {
    identity: { score: 0, max: 0 },
    visual:   { score: 0, max: 0 },
    strategy: { score: 0, max: 0 },
    voice:    { score: 0, max: 0 },
    tokens:   { score: 0, max: 0 },
    assets:   { score: 0, max: 0 },
  };
}

/** Map score to readable status — used for pill coloring. */
export function completenessStatus(score: number): 'low' | 'medium' | 'high' {
  if (score < 40) return 'low';
  if (score < 75) return 'medium';
  return 'high';
}
