/**
 * Build-time feature flags (plano Revenue-Centric Realignment §3.2).
 * Não há infra de flags no frontend, então segue o padrão mais simples:
 * env VITE_* explícita vence; sem valor definido, liga apenas em dev para
 * o time iterar localmente sem expor a feature em produção.
 */
const readFlag = (value: string | undefined): boolean => {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return import.meta.env.DEV;
};

/** Gate da rota /copilot + entrada no catálogo de apps. */
export const FEATURE_COPILOT = readFlag(import.meta.env.VITE_FEATURE_COPILOT);

/** Gate do billing por marca ativa: quota meter, archive UI e tier Agency no pricing. */
export const FEATURE_BRAND_BILLING = readFlag(import.meta.env.VITE_FEATURE_BRAND_BILLING);
