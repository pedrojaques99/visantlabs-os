/**
 * Foco no ouro (plano FOCO-OURO-2026-10): apps ESCONDIDOS da navegação.
 *
 * SSoT única. Consumida por /apps (AppsPage), launcher da HomePage, command
 * palette (useShellCommands), itens fixados (usePinnedNav) e rail (navConfig).
 * Esconder != apagar: rota, página e código seguem vivos, quem tem o link abre.
 * Vence o banco (`app_configs`): um app listado aqui some mesmo com isHidden=false.
 *
 * REVERSÍVEL: esvazie `HIDDEN_APP_IDS` e `HIDDEN_APP_LINKS` (ou ponha
 * `HIDE_APPS_ENABLED = false`) e tudo volta, sem tocar no banco.
 */
export const HIDE_APPS_ENABLED = true;

/** Ids de app (comparados normalizados: `mockupmachine` == `mockup-machine`). */
const HIDDEN_APP_IDS = [
  'naming-machine',
  'naming',
  'branding-machine',
  'branding-expert',
  'my-brandings',
  'budget-machine',
  'my-budgets',
  'campaigns',
  'playground',
  'moodboard-studio',
  'moodboard',
  'content-studio',
  'grid-machine',
  'grid-paint',
  'labs',
  'wind-tunnel',
  'benchmark',
  'copilot',
  'upscale',
  'visual-search',
  'ascii-vortex',
  'youtube-mixer',
  'ellipse-audio',
  'colorfy',
  'halftone-machine',
  'vsn-labs',
] as const;

/** Rotas internas (prefixo) e hosts externos. Cobre app cujo id no banco destoa do estático. */
const HIDDEN_APP_LINKS = [
  '/naming',
  '/branding-machine',
  '/branding-expert',
  '/my-brandings',
  '/budget-machine',
  '/my-budgets',
  '/campaigns',
  '/playground',
  '/moodboard',
  '/content-studio',
  '/grid-machine',
  '/grid-paint',
  '/labs',
  '/copilot',
  '/upscale',
  '/visual-search',
  'https://vsn-labs.vercel.app',
  'https://gradient-machine.vercel.app',
  'https://pedrojaques99.github.io/halftone-machine',
] as const;

/** Só tirados do rail principal; seguem em /apps e no launcher. */
export const RAIL_HIDDEN_SECTIONS = ['canvas'] as const;

const norm = (id: string) => id.toLowerCase().replace(/[^a-z0-9]/g, '');
const HIDDEN_IDS = new Set(HIDDEN_APP_IDS.map(norm));

/** true se o app (id e/ou link) está escondido da navegação. */
export function isAppHidden(app: { id?: string; appId?: string; link?: string; to?: string }) {
  if (!HIDE_APPS_ENABLED) return false;
  for (const id of [app.appId, app.id]) {
    if (id && HIDDEN_IDS.has(norm(id))) return true;
  }
  const link = app.link ?? app.to;
  if (!link) return false;
  return HIDDEN_APP_LINKS.some((h) => {
    if (!link.startsWith(h)) return false;
    const next = link[h.length];
    return next === undefined || next === '/' || next === '?' || next === '#';
  });
}
