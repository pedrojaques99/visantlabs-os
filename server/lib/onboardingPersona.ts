// Persona do onboarding: a ÚNICA coisa que o próprio usuário pode gravar em
// `userCategory` (POST /api/auth/complete-onboarding).
//
// Allowlist fechada de propósito. `userCategory` também carrega privilégio
// ('tester' libera ferramenta premium aqui no Labs, e o Visant Club já leu
// 'team' como acesso a todo curso pago). Antes, a rota gravava qualquer string
// vinda do body: qualquer conta grátis virava 'tester'/'team' com um curl.
//
// Espelha os ids de SEGMENTS em src/components/onboarding/onboardingSegments.ts.
// O teste server/lib/__tests__/onboardingPersona.test.ts quebra se os dois
// divergirem — persona nova no front = adicionar aqui também.
export const ONBOARDING_PERSONAS = ['designer', 'agency', 'marketing', 'developer'] as const;

export type OnboardingPersona = (typeof ONBOARDING_PERSONAS)[number];

const PERSONA_SET: ReadonlySet<string> = new Set(ONBOARDING_PERSONAS);

/**
 * Categorias que dão privilégio. Só rota de admin escreve estas; o onboarding
 * nunca as grava nem as rebaixa para uma persona comum.
 */
export const PRIVILEGED_USER_CATEGORIES: ReadonlySet<string> = new Set(['tester', 'team', 'admin']);

/** Devolve a persona se ela for uma das oferecidas no onboarding; senão `null`. */
export function resolveOnboardingPersona(value: unknown): OnboardingPersona | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return PERSONA_SET.has(v) ? (v as OnboardingPersona) : null;
}
