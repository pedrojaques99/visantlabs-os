/**
 * Build-time feature flags (plano Revenue-Centric Realignment §3.2).
 * Não há infra de flags no frontend, então segue o padrão mais simples:
 * env VITE_* explícita vence; sem valor definido, liga apenas em dev para
 * o time iterar localmente sem expor a feature em produção.
 */
// Semântica espelhada no backend (mesmo helper, mesma regra): env explícita
// ('true'/'false') sempre vence; sem valor definido, liga em dev e desliga
// em produção — em ambos os lados (frontend Vite `DEV`, backend `NODE_ENV`).
const readFlag = (value: string | undefined): boolean => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return import.meta.env.DEV;
};

/** Gate da rota /copilot + entrada no catálogo de apps. */
export const FEATURE_COPILOT = readFlag(import.meta.env.VITE_FEATURE_COPILOT);

/** Gate do billing por marca ativa: quota meter, archive UI e tier Agency no pricing. */
export const FEATURE_BRAND_BILLING = readFlag(import.meta.env.VITE_FEATURE_BRAND_BILLING);

/** Gate do onboarding brand-first (Fase 3): wizard v2, checklist v2 e banner de marca demo. */
export const FEATURE_ONBOARDING_V2 = readFlag(import.meta.env.VITE_FEATURE_ONBOARDING_V2);

/** Gate do cockpit de marca: rota /cockpit + entrada no launcher TUI. */
export const FEATURE_COCKPIT = readFlag(import.meta.env.VITE_FEATURE_COCKPIT);

/**
 * Promove o cockpit a home logada de verdade (RCD §3.2): quando ligado, `/`
 * redireciona pro cockpit em vez do launcher TUI. Reversível — desligado, a
 * home volta a ser o TUI+3D. Depende de FEATURE_COCKPIT (registra a rota).
 */
export const FEATURE_COCKPIT_HOME = readFlag(import.meta.env.VITE_FEATURE_COCKPIT_HOME);

/** Gate da higiene de funil nas free tools (Fase 5): banner "conecte sua marca" + save-to-brand. */
export const FEATURE_FUNNEL_BANNER = readFlag(import.meta.env.VITE_FEATURE_FUNNEL_BANNER);

/**
 * Gate das superfícies em alphatest (`/create` e `/campaigns`). Desligado, elas
 * somem da TELA PRINCIPAL — cockpit e rail — mas as ROTAS continuam de pé: quem
 * tem o link entra e testa. Esconder ≠ remover.
 *
 * Regra herdada do `readFlag`: liga em dev, desliga em produção, e a env
 * `VITE_FEATURE_ALPHA_TOOLS` vence sempre.
 */
export const FEATURE_ALPHA_TOOLS = readFlag(import.meta.env.VITE_FEATURE_ALPHA_TOOLS);
