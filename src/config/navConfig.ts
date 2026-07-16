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
import type { LucideIcon } from '@/lib/ui/icons';
import {
  Home,
  Bot,
  Workflow,
  LayoutGrid,
  User,
  KeyRound,
  Plug,
  Activity,
  Settings,
  Images,
  Users,
  Shapes,
  Compass,
  Image as ImageIcon,
  Camera,
  Layers,
  MapPin,
  Sun,
  Box,
  Palette,
  Diamond,
  Sparkles,
  Figma,
  Library,
  FolderOpen,
  Bookmark,
  PenTool,
} from '@/lib/ui/icons';

// ─────────────────────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────────────────────

export type ShellKind = 'marketing' | 'app';
export type ShellMode = 'full' | 'focus';
export type SectionId =
  | 'cockpit'
  | 'brands'
  | 'copilot'
  | 'canvas'
  | 'apps'
  | 'profile'
  | 'community'
  | 'references'
  | 'my-outputs';

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
  if (['/pricing', '/about', '/design-system'].includes(p)) return true;
  if (['/privacy', '/terms', '/refund', '/usage-policy'].includes(p)) return true;
  if (p === '/docs' || p.startsWith('/docs/')) return true;
  // /community e /community/* NÃO são marketing: logado ganham o AppShell (rail),
  // deslogado caem no MarketingShell via resolveShell (auth gating). São itens da
  // BIBLIOTECA (LIBRARY_ITEMS) — devem manter a rail-mãe como o resto do acervo.
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
// Editores que PRODUZEM para uma marca (guideline = INPUT de geração) — a espinha
// mostra o chip de marca ativa. /create e /canvas/:id são brand-scoped por natureza
// (tratados à parte em isEditor/isBrandScopedEditor).
const BRAND_EDITOR_PREFIXES = [
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
  '/naming',
];

// Ferramentas utilitárias full-bleed que NÃO operam sobre uma marca — a espinha
// não mostra chip de marca (decisão: "some completamente").
const UTILITY_TOOL_PREFIXES = [
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

const EDITOR_PREFIXES = [...BRAND_EDITOR_PREFIXES, ...UTILITY_TOOL_PREFIXES];

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

/**
 * Editor que opera SOBRE uma marca (guideline = INPUT de geração). Nesses a
 * espinha (AppSpine, modo focus) mostra o chip de marca ativa; ferramentas
 * utilitárias (/qrcode, /compress…) não mostram chip. /create e /canvas/:id
 * são brand-scoped por natureza. Ver plano APP-SPINE-CONSOLIDATION.
 */
export function isBrandScopedEditor(pathname: string): boolean {
  const p = normalize(pathname);
  if (p === '/create' || p.startsWith('/canvas/')) return true;
  return BRAND_EDITOR_PREFIXES.some((prefix) => p === prefix || p.startsWith(prefix + '/'));
}

/**
 * Editor focus que traz um header top-0 COMPLETO próprio → NÃO recebe a AppSpine.
 *
 * Hoje só o canvas: `CanvasHeader` é um header `fixed top-0` que ocupa a faixa do
 * topo por conta própria. Os demais editores (MiniAppShell/ToolEditorShell) são
 * `fixed inset-0 top-10 md:top-14` — eles RESERVAM a faixa do topo pra uma barra
 * global e põem a própria toolbar logo abaixo. Portanto PRECISAM da AppSpine
 * preenchendo essa faixa (senão fica um buraco); não devem ser excluídos.
 */
export function editorHasOwnChrome(pathname: string): boolean {
  return normalize(pathname).startsWith('/canvas/');
}

// Listas de produção filtráveis por marca. Nelas o BrandSwitcher VIRA o filtro
// (ganha a opção "Todas as marcas") — unifica o antigo BrandFilterChip. A lista
// segue a marca ativa (SSoT ActiveBrandContext); null = todas.
// `/references`: o switcher não FILTRA a lista (biblioteca é global), mas RANQUEIA
// o feed pela marca ativa (feed inteligente). "Todas as marcas" = feed neutro.
const BRAND_FILTERED_LISTS = ['/canvas', '/my-outputs', '/create/projects', '/references'];

/** Rota de lista onde o switcher oferece "Todas as marcas" e filtra a lista. */
export function isBrandFilteredList(pathname: string): boolean {
  return BRAND_FILTERED_LISTS.includes(normalize(pathname));
}

/** Qual seção de nível 1 fica ativa para a rota (null = app sem destaque). */
function sectionFor(p: string): SectionId | null {
  if (p === '/cockpit') return 'cockpit';
  if (p === '/copilot') return 'copilot';
  if (p === '/canvas' || p.startsWith('/canvas/')) return 'canvas';
  if (p === '/apps') return 'apps';
  // /community e /community/presets — a L2 (COMMUNITY_NAV) vira o índice de
  // categorias/tipos no rail-mãe (a "sidebar da community"). Não há item L1 de
  // comunidade (é item da BIBLIOTECA), então não há destaque global — só a L2.
  if (p === '/community' || p.startsWith('/community/')) return 'community';
  // /references — biblioteca de referências (drill-in: scope/kind viram a rail).
  if (p === '/references' || p.startsWith('/references/')) return 'references';
  // /my-outputs — galeria pessoal (drill-in: a tag cloud vira a L2 no rail,
  // mesmo padrão SSoT da /references via RailSlotContext).
  if (p === '/my-outputs') return 'my-outputs';
  // Início adaptativo: cockpit e grid de marcas são a MESMA casa → mesmo destaque
  // ('cockpit' = Início). Ver plano HOME-ADAPTIVE-IA.
  if (p === '/brand-guidelines' || p.startsWith('/brand-guidelines/')) return 'cockpit';
  // Saídas de produção da marca (mockups/campanhas geradas) = área do cockpit
  // (Início). Sem isso ficavam órfãs: shell sem breadcrumb nem destaque no rail.
  if (p === '/mockups' || p === '/campaigns') return 'cockpit';
  // Branding Machine (gera identidade do zero) + lista de brandings = seção 'apps'
  // (ferramentas/gestão): dá âncora no rail e mantém "sem chip de marca" — a
  // ferramenta CRIA marca, não opera sobre a ativa. ('brands' nunca teve entrada
  // em NAV_SECTIONS → rail ficava sem destaque; ver auditoria UX.)
  if (p === '/my-brandings' || p.startsWith('/branding-machine')) return 'apps';
  if (p === '/profile') return 'profile';
  if (p.startsWith('/settings/')) return 'profile';
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

/**
 * A marca ativa é contexto de PRODUÇÃO (cockpit, copilot, canvas, criativos,
 * mockups, campanhas — você produz *para* uma marca), não de GESTÃO/navegação
 * (biblioteca de marcas, catálogo de apps, settings, admin — ali você transita
 * entre todas). Só nas rotas de produção o chrome (top bar) mostra a marca.
 */
const BRAND_MANAGEMENT_SECTIONS = new Set<SectionId>(['brands', 'apps', 'profile']);
export function isBrandContext(pathname: string): boolean {
  const p = normalize(pathname);
  if (p === '/admin' || p.startsWith('/admin/')) return false;
  // O grid/biblioteca de marcas (e a view unificada ?id=) é GESTÃO, não produção
  // — sem chip de marca. Mesmo agora que a seção dele é 'cockpit' (Início), o
  // grid não opera "para" uma marca. Ver plano HOME-ADAPTIVE-IA.
  if (p === '/brand-guidelines' || p.startsWith('/brand-guidelines/')) return false;
  const section = classifyRoute(p).section;
  if (section && BRAND_MANAGEMENT_SECTIONS.has(section)) return false;
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Nível 2 — sub-navegação por seção
// ─────────────────────────────────────────────────────────────────────────────

// L2 vazia para seções cuja própria página já traz a sub-navegação com mais
// contexto (lista de marcas em /brand-guidelines, CATEGORIAS em /apps): repetir
// no rail era redundante. O valor único do rail (sempre-presente) vem de
// RECENTES + FIXADOS, renderizados direto no AppSidebar. Só `profile` mantém L2,
// porque ali ela unifica rotas soltas (/settings/*) que não estão nas abas.
const emptyNav = (): ContextNavItem[] => [];

// Sub-nav ÚNICA da seção profile (SSoT). As abas horizontais in-page foram
// removidas — este é o único índice de Conta/Uso/Configurações/API/Apps, e o
// AppSidebar o renderiza como CONTEXTO. `configuration` cobre a antiga aba
// (BYOK + segurança + zona de perigo); `apiKeys` são as chaves DEV do Visant
// (distintas do BYOK), `connectedApps` são os apps OAuth autorizados.
const profileNav = (): ContextNavItem[] => [
  { id: 'account', labelKey: 'nav.profile.account', to: '/profile?tab=overview', icon: User },
  { id: 'usage', labelKey: 'nav.profile.usage', to: '/profile?tab=history', icon: Activity },
  {
    id: 'configuration',
    labelKey: 'nav.profile.configuration',
    to: '/profile?tab=configuration',
    icon: Settings,
  },
  { id: 'api-keys', labelKey: 'nav.profile.apiKeys', to: '/settings/api-keys', icon: KeyRound },
  {
    id: 'connected-apps',
    labelKey: 'nav.profile.connectedApps',
    to: '/settings/connected-apps',
    icon: Plug,
  },
];

/**
 * BIBLIOTECA — acervo pessoal + descoberta. Não é produção (cockpit/canvas) nem
 * gestão de conta (profile); são destinos "onde estão minhas coisas" que antes
 * ficavam escondidos como botões no card de profile. Grupo fixo no rail (entre
 * L1 e FIXADOS), renderizado direto pelo AppSidebar. Highlight por pathname.
 */
export const LIBRARY_ITEMS: ContextNavItem[] = [
  {
    id: 'creative-projects',
    labelKey: 'nav.library.creativeProjects',
    to: '/create/projects',
    icon: Shapes,
  },
  { id: 'my-outputs', labelKey: 'nav.library.myOutputs', to: '/my-outputs', icon: Images },
  { id: 'references', labelKey: 'nav.library.references', to: '/references', icon: Library },
  { id: 'community', labelKey: 'nav.library.community', to: '/community', icon: Users },
];

/**
 * Sub-navegação (L2) da seção 'community' — o índice de tipos/categorias de
 * presets e prompts, renderizado no rail-mãe quando a rota é /community[/presets]
 * (a "sidebar da community"). Cada item leva a `/community/presets?type=…`, que a
 * CommunityPresetsPage lê via `?type` (SSoT de conteúdo = CATEGORY_CONFIG em
 * PresetCard). Ordem: visão geral → tudo → família mockup → estilos → prompts.
 */
export const COMMUNITY_NAV: ContextNavItem[] = [
  { id: 'overview', labelKey: 'nav.community.overview', to: '/community', icon: Compass },
  { id: 'all', labelKey: 'nav.community.all', to: '/community/presets', icon: LayoutGrid },
  {
    id: 'mockup',
    labelKey: 'nav.community.mockup',
    to: '/community/presets?type=mockup',
    icon: ImageIcon,
  },
  {
    id: 'angle',
    labelKey: 'nav.community.angle',
    to: '/community/presets?type=angle',
    icon: Camera,
  },
  {
    id: 'texture',
    labelKey: 'nav.community.texture',
    to: '/community/presets?type=texture',
    icon: Layers,
  },
  {
    id: 'ambience',
    labelKey: 'nav.community.ambience',
    to: '/community/presets?type=ambience',
    icon: MapPin,
  },
  {
    id: 'luminance',
    labelKey: 'nav.community.luminance',
    to: '/community/presets?type=luminance',
    icon: Sun,
  },
  { id: '3d', labelKey: 'nav.community.threeD', to: '/community/presets?type=3d', icon: Box },
  {
    id: 'presets',
    labelKey: 'nav.community.presets',
    to: '/community/presets?type=presets',
    icon: Settings,
  },
  {
    id: 'aesthetics',
    labelKey: 'nav.community.aesthetics',
    to: '/community/presets?type=aesthetics',
    icon: Palette,
  },
  {
    id: 'themes',
    labelKey: 'nav.community.themes',
    to: '/community/presets?type=themes',
    icon: Diamond,
  },
  {
    id: 'ui-prompts',
    labelKey: 'nav.community.uiPrompts',
    to: '/community/presets?type=ui-prompts',
    icon: Sparkles,
  },
  {
    id: 'figma-prompts',
    labelKey: 'nav.community.figmaPrompts',
    to: '/community/presets?type=figma-prompts',
    icon: Figma,
  },
];

/**
 * Sub-navegação (drill) da seção 'references'. A página é um workbench de filtro
 * (scope × kind × facets); só os eixos que são NAVEGAÇÃO real viram tabs da rail
 * (scope + kind → params `?scope`/`?kind`). Os 9 facets são filtros multi-seleção
 * e continuam in-page. A ReferencesPage lê esses params e sincroniza o estado.
 */
export const REFERENCES_NAV: ContextNavItem[] = [
  { id: 'library', labelKey: 'nav.references.library', to: '/references', icon: LayoutGrid },
  { id: 'logos', labelKey: 'nav.references.logos', to: '/references?kind=branding', icon: PenTool },
  {
    id: 'mockups',
    labelKey: 'nav.references.mockups',
    to: '/references?kind=mockup',
    icon: ImageIcon,
  },
  {
    id: 'collections',
    labelKey: 'nav.references.collections',
    to: '/references?scope=collections',
    icon: FolderOpen,
  },
  { id: 'mine', labelKey: 'nav.references.mine', to: '/references?scope=mine', icon: Bookmark },
];

/**
 * Seções "drill-in": a seção SUBSTITUI a rail-mãe pelas próprias tabs + seta de
 * voltar (em vez de empilhar um L2 embaixo de tudo). Reservado a hubs
 * secundários ricos (biblioteca/descoberta). Destinos L1 (apps) ficam com
 * categorias in-page — trocar a rail-mãe deles esconderia a navegação primária.
 */
const DRILL_IN_SECTIONS = new Set<SectionId>(['community', 'references', 'my-outputs', 'apps']);
export function isDrillInSection(section: SectionId | null): boolean {
  return section != null && DRILL_IN_SECTIONS.has(section);
}

// Seções cuja L2 é DINÂMICA e injetada pela página no rail (tag cloud, categorias)
// via RailSlotContext, em vez de itens estáticos do navConfig. Elas entram em
// drill-in mesmo sem `contextNav` fixa, e o rail renderiza o slot host pra elas.
const RAIL_SLOT_SECTIONS = new Set<SectionId>(['references', 'my-outputs', 'apps']);
export function sectionUsesRailSlot(section: SectionId | null): boolean {
  return section != null && RAIL_SLOT_SECTIONS.has(section);
}

/** Título (labelKey) do header de voltar de cada seção drill-in. */
export const DRILL_TITLES: Partial<Record<SectionId, string>> = {
  community: 'nav.library.community',
  references: 'nav.library.references',
  'my-outputs': 'nav.library.myOutputs',
  apps: 'nav.apps.label',
};

// ─────────────────────────────────────────────────────────────────────────────
// Nível 1 — destinos globais do rail
// ─────────────────────────────────────────────────────────────────────────────

export const NAV_SECTIONS: NavSection[] = [
  {
    // Início adaptativo (plano HOME-ADAPTIVE-IA): com marca ativa → Cockpit; sem
    // marca / "Todas as marcas" → grid de marcas. Absorve o antigo destino
    // 'Marcas' — um destino de casa só. Sempre visível (a flag FEATURE_COCKPIT
    // decide cockpit-vs-grid DENTRO do HomeRoute, não a presença do item).
    id: 'cockpit',
    labelKey: 'nav.cockpit.label',
    icon: Home,
    to: '/cockpit',
    visibleWhen: () => true,
    contextNav: emptyNav,
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
    id: 'canvas',
    labelKey: 'nav.canvas.label',
    icon: Workflow,
    to: '/canvas',
    visibleWhen: () => true,
    contextNav: emptyNav,
  },
  {
    id: 'apps',
    labelKey: 'nav.apps.label',
    icon: LayoutGrid,
    to: '/apps',
    visibleWhen: () => true,
    contextNav: emptyNav,
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
  if (section === 'community') return COMMUNITY_NAV;
  if (section === 'references') return REFERENCES_NAV;
  const def = NAV_SECTIONS.find((s) => s.id === section);
  return def ? def.contextNav(ctx) : [];
}
