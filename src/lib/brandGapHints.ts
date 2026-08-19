/**
 * Por que cada gap da marca importa PRA GERAÇÃO (guideline = INPUT da IA).
 *
 * Consequência concreta de preencher — NÃO gamificação ("+N pontos"). Copy de
 * apresentação chaveada por `rule.id` (a SSoT das regras vive em
 * `brandCompleteness.ts`, que fica puro). Reusado no cockpit ("Próximo passo")
 * e na `BrandCompletenessPill`.
 */
export const BRAND_GAP_HINTS: Record<string, string> = {
  name: 'Sem nome, a IA inventa um wordmark falso.',
  tagline: 'Guia o tom dos títulos que a IA escreve.',
  description: 'É o brief que a IA lê antes de gerar qualquer coisa.',
  colors_2: 'Sem paleta, os criativos saem fora da marca.',
  colors_named: 'Nomes e roles dizem à IA onde usar cada cor.',
  colors_role: 'Marcar primária/fundo evita a IA trocar as cores de lugar.',
  typography: 'Sem fonte definida, o texto sai numa serif genérica.',
  logo: 'A IA precisa do logo real pra aplicar nos mockups.',
  logo_variants: 'Dark/light: o mockup escolhe a versão certa por fundo.',
  manifesto: 'Dá propósito e voz ao texto gerado.',
  archetype: 'Ancora a personalidade — o criativo deixa de ser genérico.',
  persona: 'Faz o criativo falar com quem compra, não com todo mundo.',
  voice_tone: 'Define se o texto sai formal, ousado, técnico…',
  voice_dos: 'Ensina a IA o que a marca faz no texto.',
  voice_donts: 'Impede a IA de escrever o que a marca não diz.',
  spacing: 'Layouts gerados respeitam teu ritmo de espaçamento.',
  radius: 'Cantos consistentes nos componentes gerados.',
  shadow: 'Dá profundidade própria à marca em vez da sombra padrão de todo mundo.',
  border: 'Define a espessura e o traço que a marca usa, não o do template.',
  motion: 'A marca ganha ritmo próprio: o que anima rápido e o que anima devagar.',
  media: 'Referências reais afinam o que a IA produz.',
  public_or_figma: 'Conecta a marca ao Figma/link pra produzir em qualquer lugar.',
};

/** Dica de geração pra um gap (rule.id). undefined se não houver. */
export function brandGapHint(id: string): string | undefined {
  return BRAND_GAP_HINTS[id];
}
