/**
 * Naming Machine — Configurações avançadas (opcionais, zero pedágio)
 *
 * SSoT das técnicas de naming + defaults das configurações do deck.
 * Ver .agent/plans/NAMING-MACHINE.md → "Régua de geração".
 *
 * Regra de produto: tudo aqui é opcional. Os defaults são inteligentes e
 * nada bloqueia o fluxo — mudanças aplicam na PRÓXIMA leva automaticamente.
 */

export type NamingRuler = 'strict' | 'balanced' | 'free';
export type NamingLanguage = 'auto' | 'pt' | 'en' | 'multi';

/** As 9 técnicas da metodologia de naming (slug do backend + label PT legível). */
export const NAMING_TECHNIQUES: { slug: string; label: string }[] = [
  { slug: 'costura-invisivel', label: 'Costura invisível' },
  { slug: 'blend', label: 'Blend' },
  { slug: 'invencao', label: 'Invenção' },
  { slug: 'metafora', label: 'Metáfora' },
  { slug: 'truncamento', label: 'Truncamento' },
  { slug: 'raizes', label: 'Raízes estrangeiras' },
  { slug: 'contrabando', label: 'Contrabando de letras' },
  { slug: 'jargao', label: 'Jargão de tribo' },
  { slug: 'afixo', label: 'Famílias por afixo' },
];

export const NAMING_RULERS: { value: NamingRuler; label: string; desc: string }[] = [
  { value: 'strict', label: 'Rígida', desc: 'eliminatória' },
  { value: 'balanced', label: 'Equilibrada', desc: 'preferência, conceito pode vencer' },
  { value: 'free', label: 'Livre', desc: 'só pronunciabilidade' },
];

export const NAMING_LANGUAGES: { value: NamingLanguage; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'pt', label: 'PT' },
  { value: 'en', label: 'EN' },
  { value: 'multi', label: 'Multi' },
];

/** Opções de tamanho máximo (0 = sem limite / livre). */
export const NAMING_MAX_LENGTHS: { value: number; label: string }[] = [
  { value: 7, label: '7' },
  { value: 10, label: '10' },
  { value: 0, label: 'livre' },
];

/** Nomes por leva. */
export const NAMING_BATCH_SIZES: number[] = [10, 20, 30];

/**
 * Estado completo das configurações do deck (client-side).
 * `techniques` vazio = todas ativas. `maxLength` 0 = sem limite.
 * `model` vazio = usa o modelo de chat preferido/default.
 */
export interface NamingSettings {
  ruler: NamingRuler;
  maxLength: number;
  techniques: string[];
  language: NamingLanguage;
  model: string;
  batchSize: number;
}

export const DEFAULT_NAMING_SETTINGS: NamingSettings = {
  ruler: 'strict',
  maxLength: 10,
  techniques: [],
  language: 'auto',
  model: '',
  batchSize: 20,
};
