/**
 * Navigation SSoT (plano APP-SHELL-REALIGNMENT, F0).
 *
 * Fonte única da navegação do app. Descreve, de forma pura e testável:
 *   • classifyRoute — a que shell (marketing/app) e modo (full/focus) uma rota
 *     pertence, e qual seção de nível 1 fica ativa;
 *   • resolveShell — a decisão final de shell combinando rota + auth;
 *   • NAV_SECTIONS — os destinos globais (nível 1) do rail lateral;
 *   • contextNav — a sub-navegação (nível 2) de cada seção.
 *
 * Regras deste arquivo: NADA de React aqui além do tipo `LucideIcon` (que é só
 * um tipo). Tudo são dados + funções puras de `(pathname | NavCtx)`. A UI
 * (AppSidebar/AppShell) consome; nenhum componente decide navegação por conta.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Home,
  Palette,
  Bot,
  LayoutGrid,
  User,
  Sparkles,
  Megaphone,
  Image as ImageIcon,
  KeyRound,
  Plug,
  Activity,
  Layers,
  FileText,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type ShellKind = 'marketing' | 'app';
export type ShellMode = 'full' | 'focus';
export type SectionId = 'cockpit' | 'brands' | 'copilot' | 'apps' | 'profile';

/** Flags de navegação — subconjunto de `src/config/featureFlags.ts`, injetado
 *  como dado (não importado direto) para as funções continuarem puras/testáveis. */
export interface NavFlags {
  cockpit: boolean;
  copilot: boolean;
}

/** Contexto passado às funções de visibilidade/sub-nav. Montado em runtime a
 *  partir de useLayout() (auth) + featureFlags + ActiveBrandContext. */
export interface NavCtx {
  isAuthenticated: boolean | null;
  /** admin OU tester — libera o conjunto ampliado de destinos. */
  isElevated: boolean;
  flags: NavFlags;
  activeBrandId: string | null;
}

export interface RouteClass {
  shell: ShellKind;
  mode: ShellMode;
  /** Qual destino de nível 1 destacar; null = rota de app sem destaque global. */
  section: SectionId | null;
}

/** Item da sub-navegação (nível 2) de uma seção. */
export interface ContextNavItem {
  id: string;
  /** chave i18n sob `nav.*`. */
  labelKey: string;
  to: string;
  icon?: LucideIcon;
}

/** Destino global (nível 1) do rail lateral. */
export interface NavSection {
  id: SectionId;
  labelKey: string;
  icon: LucideIcon;
  to: string;
  visibleWhen: (ctx: NavCtx) => boolean;
  contextNav: (ctx: NavCtx) => ContextNavItem[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Classificação de rotas
// ─────────────────────────────────────────────────────────────────────────────

/** Normaliza: tira trailing slash (exceto raiz) e query/hash. */
function normalize(pathname: string): string {
  const clean = pathname.split('?')[0].split('#')[0];
  if (clean.length > 1 && clean.endsWith('/')) return clean.slice(0, -1);
  return clean || '/';
}

/** Rotas de website público — sempre no MarketingShell, mesmo logado. */
function isMarketing(p: string): boolean {
  if (p === '/') return true;
  if (['/pricing', '/about', '/design-system', '/community'].includes(p)) return true;
  if (['/privacy', '/terms', '/refund', '/usage-policy'].includes(p)) return true;
  if (p === '/docs' || p.startsWith('/docs/')) return true;
  if (p.startsWith('/community/')) return true;
  if (p.startsWith('/brand/')) return true; // guideline público /brand/:slug
  if (/^\/profile\/.+/.test(p)) return true; // perfil público da comunidade
  // Páginas de auth / retorno de checkout — fluxo próprio, sem chrome de app.
  const authExact = [
    '/login',
    '/auth',
    '/waitlist',
    '/forgot-password',
    '/verify-email',
    '/welcome',
    '/onboard',
    '/recharge-success',
  ];
  if (authExact.includes(p)) return true;
  if (p.startsWith('/connect/')) return true;
  if (p.startsWith('/thank-you')) return true;
  // Páginas "shared" públicas (leitura sem login).
  if (p.startsWith('/canvas/shared/')) return true;
  if (p.startsWith('/budget/shared/')) return true;
  if (p.startsWith('/playground/shared/')) return true;
  return false;
}

/** Prefixos de editor — rota de app em modo `focus` (rail fina / oculta). */
const EDITOR_PREFIXES = [
  '/mockupmachine',
  '/content-studio',
  '/branding-expert',
  '/branding-machine',
  '/budget-machine',
  '/3d-studio',
  '/image-lab',
  '/editor',
  '/moodboard',
  '/grid-machine',
  '/grid-paint',
  '/playground',
  '/labs',
  // mini-tools (workspace full-bleed)
  '/upscale',
  '/favicon',
  '/color-converter',
  '/color-palette',
  '/compress',
  '/pdf-compress',
  '/converter',
  '/svg-optimizer',
  '/og-image',
  '/watermark',
  '/remove-bg',
  '/qrcode',
  '/extractor',
  '/visual-search',
];

function isEditor(p: string): boolean {
  // /canvas (lista de projetos) é dashboard; /canvas/:id é editor.
  if (p.startsWith('/canvas/')) return true;
  // /create (studio) é editor; /create/projects é lista (dashboard).
  if (p === '/create') return true;
  // Nota: chats (/copilot, /admin/chat) são `full` (rail + ChatShell como
  // segundo pane), não focus — o dock flutuante sobrepunha a sidebar de
  // sessões do ChatShell e destoava do resto do app.
  return EDITOR_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + '/'));
}

/** Qual seção de nível 1 fica ativa para a rota (null = app sem destaque). */
function sectionFor(p: string): SectionId | null {
  if (p === '/cockpit') return 'cockpit';
  if (p === '/copilot') return 'copilot';
  if (p === '/apps') return 'apps';
  if (p === '/brand-guidelines' || p.startsWith('/brand-guidelines/')) return 'brands';
  if (p === '/my-brandings' || p.startsWith('/branding-machine')) return 'brands';
  if (p === '/profile') return 'profile';
  if (p.startsWith('/settings/') || p.startsWith('/developer')) return 'profile';
  return null;
}

/**
 * Classifica uma rota puramente pelo path (sem auth). A decisão final de shell
 * (que considera login) é `resolveShell`.
 */
export function classifyRoute(pathname: string): RouteClass {
  const p = normalize(pathname);
  if (isMarketing(p)) return { shell: 'marketing', mode: 'full', section: null };
  if (isEditor(p)) return { shell: 'app', mode: 'focus', section: sectionFor(p) };
  return { shell: 'app', mode: 'full', section: sectionFor(p) };
}

/**
 * Shell efetivo a renderizar. Rota de app só ganha o AppShell quando há sessão;
 * deslogado (ou ainda verificando) cai no MarketingShell — assim ferramentas
 * grátis (`/qrcode`, `/compress`…) seguem acessíveis sem login com o chrome
 * público de sempre, e não há flash de rail antes do auth resolver.
 */
export function resolveShell(pathname: string, isAuthenticated: boolean | null): ShellKind {
  const cls = classifyRoute(pathname);
  if (cls.shell === 'marketing') return 'marketing';
  return isAuthenticated === true ? 'app' : 'marketing';
}

/** Conveniência: o modo (full/focus) da rota atual. */
export function routeMode(pathname: string): ShellMode {
  return classifyRoute(pathname).mode;
}

// ─────────────────────────────────────────────────────────────────────────────
// Nível 2 — sub-navegação por seção
// ─────────────────────────────────────────────────────────────────────────────

function brandQuery(ctx: NavCtx, base: string): string {
  return ctx.activeBrandId ? `${base}?id=${ctx.activeBrandId}` : base;
}

const cockpitNav = (): ContextNavItem[] => [
  { id: 'overview', labelKey: 'nav.cockpit.overview', to: '/cockpit', icon: Home },
  { id: 'campaigns', labelKey: 'nav.cockpit.campaigns', to: '/campaigns', icon: Megaphone },
  { id: 'work', labelKey: 'nav.cockpit.work', to: '/create/projects', icon: ImageIcon },
];

const brandsNav = (ctx: NavCtx): ContextNavItem[] => {
  const items: ContextNavItem[] = [
    { id: 'all', labelKey: 'nav.brands.all', to: '/brand-guidelines', icon: Palette },
  ];
  if (ctx.activeBrandId) {
    items.push({
      id: 'guideline',
      labelKey: 'nav.brands.guideline',
      to: brandQuery(ctx, '/brand-guidelines'),
      icon: FileText,
    });
  }
  items.push(
    { id: 'branding-machine', labelKey: 'nav.brands.machine', to: '/branding-machine', icon: Sparkles },
    { id: 'my-brandings', labelKey: 'nav.brands.mine', to: '/my-brandings', icon: Layers }
  );
  return items;
};

/** Categorias estáveis do catálogo de apps. O roster real (com contagem/ícone
 *  por app) é mesclado em runtime a partir de `appsService`; aqui ficam só as
 *  âncoras de categoria que o /apps já usa. */
const appsNav = (): ContextNavItem[] => [
  { id: 'all', labelKey: 'nav.apps.all', to: '/apps', icon: LayoutGrid },
];

const profileNav = (): ContextNavItem[] => [
  { id: 'account', labelKey: 'nav.profile.account', to: '/profile?tab=overview', icon: User },
  { id: 'usage', labelKey: 'nav.profile.usage', to: '/profile?tab=history', icon: Activity },
  { id: 'api-keys', labelKey: 'nav.profile.apiKeys', to: '/settings/api-keys', icon: KeyRound },
  {
    id: 'connected-apps',
    labelKey: 'nav.profile.connectedApps',
    to: '/settings/connected-apps',
    icon: Plug,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Nível 1 — destinos globais do rail
// ─────────────────────────────────────────────────────────────────────────────

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'cockpit',
    labelKey: 'nav.cockpit.label',
    icon: Home,
    to: '/cockpit',
    visibleWhen: (ctx) => ctx.flags.cockpit,
    contextNav: cockpitNav,
  },
  {
    id: 'brands',
    labelKey: 'nav.brands.label',
    icon: Palette,
    to: '/brand-guidelines',
    visibleWhen: () => true,
    contextNav: brandsNav,
  },
  {
    id: 'copilot',
    labelKey: 'nav.copilot.label',
    icon: Bot,
    to: '/copilot',
    visibleWhen: (ctx) => ctx.flags.copilot,
    contextNav: () => [],
  },
  {
    id: 'apps',
    labelKey: 'nav.apps.label',
    icon: LayoutGrid,
    to: '/apps',
    visibleWhen: () => true,
    contextNav: appsNav,
  },
];

/** Seção do footer do rail (perfil/settings) — separada dos destinos primários. */
export const PROFILE_SECTION: NavSection = {
  id: 'profile',
  labelKey: 'nav.profile.label',
  icon: User,
  to: '/profile',
  visibleWhen: () => true,
  contextNav: profileNav,
};

/** Destinos de nível 1 visíveis no contexto atual (respeita flags/auth). */
export function visibleSections(ctx: NavCtx): NavSection[] {
  return NAV_SECTIONS.filter((s) => s.visibleWhen(ctx));
}

/** Sub-navegação (nível 2) da seção ativa da rota atual, ou [] em rota sem seção. */
export function contextNavFor(pathname: string, ctx: NavCtx): ContextNavItem[] {
  const section = classifyRoute(pathname).section;
  if (!section) return [];
  if (section === 'profile') return PROFILE_SECTION.contextNav(ctx);
  const def = NAV_SECTIONS.find((s) => s.id === section);
  return def ? def.contextNav(ctx) : [];
}
