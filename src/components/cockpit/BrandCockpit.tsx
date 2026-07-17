import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Settings,
  Plus,
  Wand2,
  Megaphone,
  Palette,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  ExternalLink,
  Image as ImageIcon,
} from '@/lib/ui/icons';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { GridDotsBackground } from '@/components/ui/GridDotsBackground';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { DemoBrandBanner } from '@/components/onboarding/DemoBrandBanner';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import { extractBrandTheme } from '@/components/brand/BrandReadOnlyView';
import { useTheme } from '@/hooks/useTheme';
import { useBrandGuideline } from '@/hooks/queries/useBrandGuidelines';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';
import { useCampaigns } from '@/hooks/queries/useCampaigns';
import { useCreativeProjects } from '@/hooks/queries/useCreativeProjects';
import { useBrandMockups } from '@/hooks/queries/useBrandMockups';
import { useConnectBrandToAI } from '@/hooks/useConnectBrandToAI';
import { useTranslation } from '@/hooks/useTranslation';
import { computeBrandCompleteness, completenessLevel } from '@/lib/brandCompleteness';
import { brandGapHint } from '@/lib/brandGapHints';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { cn } from '@/lib/utils';
import { glassSurface } from '@/lib/ui/glass';
import { FEATURE_COPILOT } from '@/config/featureFlags';
import type { AppConfig } from '@/services/appsService';

// Mockup generator dialog — owner-only, loaded on demand (same as brand view).
const BrandMockupDialog = lazyWithRetry(() =>
  import('@/components/brand/guidelines/BrandMockupDialog').then((m) => ({
    default: m.BrandMockupDialog,
  }))
);

// Interactive band (ideias sazonais + connect-to-AI) — reusado da view pública
// (SSoT). Substitui o painel de "Sugestões" próprio do cockpit (era duplicação).
const BrandInteractivePanel = lazyWithRetry(() =>
  import('@/components/brand/BrandInteractivePanel').then((m) => ({
    default: m.BrandInteractivePanel,
  }))
);

// Feed de mockups on-brand grátis (render no browser via Scene Packages) — on demand
// pra manter o engine PSD fora do bundle inicial do cockpit.
const SurpriseMockupHero = lazyWithRetry(() =>
  import('@/components/cockpit/SurpriseMockupHero').then((m) => ({
    default: m.SurpriseMockupHero,
  }))
);

// Trocar logo principal (upload / da media / promover existente) — on demand.
const ChangeLogoDialog = lazyWithRetry(() =>
  import('@/components/brand/ChangeLogoDialog').then((m) => ({
    default: m.ChangeLogoDialog,
  }))
);

/**
 * Home cockpit (plano Revenue-Centric §4, FEATURE_COCKPIT): the logged-in home
 * becomes "your brand and its work in progress" instead of an app launcher.
 * Composes EXISTING data only — brand list, campaigns, creative projects and
 * the shared seasonal-suggestions hook. Zero new endpoints.
 *
 * Layout: brand hero header (avatar + name + palette strip) over a dense
 * bento grid — work-in-progress (2 cols, rich empty state with concrete CTAs),
 * connect-your-AI bento (visual sibling of BrandInteractivePanel §B), and a
 * suggestions card whose loading/error states stay inside the card frame.
 * Shortcuts collapse into a compact footer row.
 */

interface WorkItem {
  id: string;
  kind: 'campaign' | 'creative';
  title: string;
  meta: string;
  image: string | null;
  updatedAt: string;
}

interface BrandCockpitProps {
  /** Pinned launcher apps — same roster/sort as the TUI (SSoT lives in HomePage). */
  apps: AppConfig[];
  onSelectApp: (app: AppConfig) => void;
}

const cardCls = cn('rounded-2xl', glassSurface.panel);

/** Inner tile inside a bento card (one radius step down from the card). */
const tileCls = cn('rounded-xl', glassSurface.tile);

export const BrandCockpit: React.FC<BrandCockpitProps> = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Marca ativa vem do SSoT global (ActiveBrandContext) — o cockpit não gere
  // mais o estado/localStorage localmente. O rail e o hero ficam em sincronia.
  const { brands: activeBrands, activeBrand, isLoading: brandsLoading } = useActiveBrand();
  const hasBrand = !!activeBrand?.id;

  // "Todas as marcas" (isAllBrands) → o HomeRoute mostra o grid, não o cockpit;
  // então aqui a marca ativa é sempre concreta. Sem guard local (plano
  // HOME-ADAPTIVE-IA: uma casa só decide o adaptativo).

  // Full guideline detail (colors, logos) for the hero — list rows are the
  // placeholder, so the header renders instantly and enriches when it lands.
  const { data: brandDetail } = useBrandGuideline(activeBrand?.id);
  const heroBrand = brandDetail ?? activeBrand;
  const brandName = heroBrand?.identity?.name || heroBrand?.name || '';

  // Tema da marca (accent contrast-safe) — MESMO cálculo da view pública. Sem
  // isso o BrandInteractivePanel usa o `--accent` default e os botões saem cinza
  // ("Connect to your AI" morto) em vez da cor da marca.
  const { theme } = useTheme();
  const brandVars = useMemo(() => {
    const bt = extractBrandTheme(heroBrand, theme);
    return {
      '--accent': bt.accent,
      '--accent-rgb': bt.accentRgb,
      '--accent-text': bt.accentText,
      '--brand-bg': bt.bg,
      '--brand-surface': bt.surface,
      '--brand-text': bt.text,
    } as React.CSSProperties;
  }, [heroBrand, theme]);

  // Palette strip — the brand's real colors, most-used first (guideline data).
  const paletteColors = useMemo(() => {
    const colors = heroBrand?.colors ?? [];
    const seen = new Set<string>();
    return [...colors]
      .sort((a, b) => (a.usageRank ?? 99) - (b.usageRank ?? 99))
      .filter((c) => {
        const hex = c.hex?.toLowerCase();
        if (!hex || seen.has(hex)) return false;
        seen.add(hex);
        return true;
      })
      .slice(0, 6);
  }, [heroBrand]);

  // ── Work in progress (existing lists, brand-scoped, limit 5) ──
  const { data: campaigns = [] } = useCampaigns(activeBrand?.id, hasBrand);
  const { data: projects = [] } = useCreativeProjects(activeBrand?.id, hasBrand);
  // Per-brand output gallery — every generated mockup persists against the brand.
  const { data: brandMockups = [] } = useBrandMockups(activeBrand?.id, hasBrand);
  const workItems = useMemo<WorkItem[]>(() => {
    const items: WorkItem[] = [
      ...campaigns.map((c) => ({
        id: c.id,
        kind: 'campaign' as const,
        title: c.name,
        meta: `${t('cockpit.work.campaign')} · ${c.completedCount}/${c.totalCount}`,
        image: c.coverImageUrl,
        updatedAt: c.updatedAt,
      })),
      ...projects.map((p) => ({
        id: p.id,
        kind: 'creative' as const,
        title: p.name,
        meta: `${t('cockpit.work.creative')} · ${p.format}`,
        image: p.thumbnailUrl ?? p.backgroundUrl,
        updatedAt: p.updatedAt,
      })),
    ];
    return items
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 5);
  }, [campaigns, projects, t]);

  const openWorkItem = useCallback(
    (item: WorkItem) => {
      if (item.kind === 'campaign') {
        navigate(activeBrand?.id ? `/campaigns?brandId=${activeBrand.id}` : '/campaigns');
      } else {
        navigate(`/create?project=${item.id}`);
      }
    },
    [navigate, activeBrand]
  );

  const [mockupPrompt, setMockupPrompt] = useState<string | undefined>(undefined);
  const [isMockupOpen, setIsMockupOpen] = useState(false);
  const [changeLogoOpen, setChangeLogoOpen] = useState(false);

  // "Próximo passo" é colapsável e PERSISTE fechado (o card SISTEMA % já mostra o
  // progresso; quem fechou não quer ser incomodado de novo). Global por usuário.
  const [nbaCollapsed, setNbaCollapsed] = useState(
    () => typeof window !== 'undefined' && localStorage.getItem('vsn_cockpit_nba_collapsed') === '1'
  );
  const toggleNba = useCallback(() => {
    setNbaCollapsed((prev) => {
      const v = !prev;
      if (typeof window !== 'undefined')
        localStorage.setItem('vsn_cockpit_nba_collapsed', v ? '1' : '0');
      return v;
    });
  }, []);

  // Connect-to-AI — mesmo hook da view pública (SSoT). O BrandInteractivePanel
  // (que substituiu o painel de sugestões) consome isto; se a marca não é
  // compartilhável, o fallback abre a marca pra compartilhar antes de mintar o link.
  const { connecting, connect } = useConnectBrandToAI();
  const handleConnect = useCallback(async () => {
    await connect(heroBrand?.publicSlug, () =>
      navigate(activeBrand?.id ? `/brand-guidelines?id=${activeBrand.id}` : '/brand-guidelines')
    );
  }, [connect, heroBrand?.publicSlug, activeBrand?.id, navigate]);

  // ── Brand Depth — the "save file" of the brand: how deep the guideline is,
  // from the same completeness scorer the grid uses. Deterministic, zero backend.
  // A deeper brand = better MCP ammunition for every generation surface.
  const depthReport = useMemo(() => computeBrandCompleteness(brandDetail ?? null), [brandDetail]);
  const depthLevel = useMemo(() => completenessLevel(depthReport.score), [depthReport.score]);
  const nextActions = useMemo(
    () => [...depthReport.missing].sort((a, b) => b.weight - a.weight).slice(0, 3),
    [depthReport.missing]
  );
  const openGuideline = useCallback(
    () =>
      navigate(activeBrand?.id ? `/brand-guidelines?id=${activeBrand.id}` : '/brand-guidelines'),
    [navigate, activeBrand]
  );

  // "Ver guidelines" — abre a rota pública numa nova aba (o que o cliente/mundo vê).
  // Fallback pro editor do dono quando a marca ainda não foi publicada (sem slug).
  const viewPublicGuidelines = useCallback(() => {
    const slug = heroBrand?.publicSlug;
    const url = slug
      ? `/brand/${slug}`
      : activeBrand?.id
        ? `/brand-guidelines?id=${activeBrand.id}`
        : '/brand-guidelines';
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [heroBrand?.publicSlug, activeBrand?.id]);

  // ── Render ──
  // Guard defensivo FORA do AnimatePresence: o HomeRoute já garante marca ativa,
  // mas se cair aqui sem marca, redireciona ANTES de montar o AnimatePresence.
  // Um <Navigate> como filho do AnimatePresence dispara "removeChild" (o Navigate
  // desmonta a rota enquanto o AnimatePresence ainda segura o nó de saída).
  if (!brandsLoading && activeBrands.length === 0) {
    return <Navigate to="/brand-guidelines" replace />;
  }

  return (
    <div
      className="absolute inset-0 z-0 bg-background overflow-y-auto"
      data-vsn-page="home"
      data-vsn-component="BrandCockpit"
    >
      <GridDotsBackground opacity={0.05} spacing={30} />
      <DemoBrandBanner brandId={activeBrand?.id} />

      <main
        className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pt-8 pb-12 min-h-full flex flex-col"
        data-vsn-region="content"
      >
        <h1 className="sr-only">{t('cockpit.title')}</h1>

        <AnimatePresence mode="wait">
          {brandsLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-40 gap-6"
            >
              <GlitchLoader size={40} />
            </motion.div>
          ) : (
            <motion.div
              key="cockpit"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-5 flex-1"
            >
              {/* ── Hero: the brand is the protagonist ── */}
              <header
                className="flex items-end justify-between gap-4 flex-wrap"
                data-vsn-region="brand-hero"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Logo clicável → editor da marca (upload / selecionar da media /
                      set-primary já existem no LogosSection). Dialog inline = follow-up. */}
                  <button
                    onClick={() => setChangeLogoOpen(true)}
                    aria-label={t('cockpit.changeLogo') || 'Trocar logo'}
                    title={t('cockpit.changeLogo') || 'Trocar logo'}
                    className="relative group/logo shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan/40"
                  >
                    <BrandAvatar
                      brand={heroBrand}
                      size={56}
                      rounded="md"
                      className="border-border bg-muted"
                    />
                    <span className="absolute inset-0 flex items-center justify-center rounded-md bg-black/55 opacity-0 group-hover/logo:opacity-100 transition-opacity">
                      <ImageIcon size={16} className="text-white/90" />
                    </span>
                  </button>
                  <div className="min-w-0">
                    {/* "Cockpit da marca" era ruído visual — vira só a11y (leitor
                        de tela). O contexto já é óbvio pela marca + rail. */}
                    <MicroTitle className="sr-only">{t('cockpit.title')}</MicroTitle>
                    <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight truncate mt-0.5">
                      {brandName}
                    </h2>
                    {paletteColors.length > 0 && (
                      <div
                        className="flex items-center gap-1.5 mt-2"
                        role="img"
                        aria-label={t('cockpit.hero.palette')}
                      >
                        {paletteColors.map((c) => (
                          <span
                            key={c.hex}
                            title={c.name || c.hex}
                            className="w-4 h-4 rounded-full border border-border shrink-0"
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {/* Troca de marca vive no rail (SSoT). Aqui: Brand Depth — nível
                    nomeado + barra + distância pro próximo (goal-gradient do RCD). */}
                <div className="flex items-center gap-2">
                  {/* SISTEMA % — sinal DISCRETO inline (barra fina + %), não um card
                      competindo com o nome. Detalhe (nível + próximo) vai no hover. */}
                  {brandDetail && (
                    <button
                      onClick={openGuideline}
                      aria-label={t('cockpit.depth.title')}
                      title={`${t(`cockpit.depth.level.${depthLevel.key}`)} · ${
                        depthLevel.nextAt !== null
                          ? t('cockpit.depth.toNext', { n: depthLevel.toNext })
                          : t('cockpit.depth.complete')
                      }`}
                      className="group flex items-center gap-2.5 px-1"
                    >
                      <div className="h-1 w-20 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-cyan/70 transition-all"
                          style={{ width: `${depthReport.score}%` }}
                        />
                      </div>
                      <span className="text-[11px] tabular-nums text-muted-foreground group-hover:text-foreground transition-colors">
                        {depthReport.score}%
                      </span>
                    </button>
                  )}
                  <Button
                    variant="surface"
                    size="sm"
                    onClick={viewPublicGuidelines}
                    className="gap-2 font-sans"
                  >
                    <ExternalLink size={14} />
                    {t('cockpit.viewGuidelines')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-md"
                    aria-label={t('cockpit.settings')}
                    onClick={() => navigate('/profile')}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Settings size={15} />
                  </Button>
                </div>
              </header>

              {/* ── Next Best Action — the gaps that deepen the brand, by weight.
                  Deterministic from the completeness scorer; each opens the guideline. ── */}
              {nextActions.length > 0 ? (
                <section
                  aria-label={t('cockpit.nba.title')}
                  data-vsn-region="next-best-action"
                  className={cn('px-1', !nbaCollapsed && 'pb-1')}
                >
                  <button
                    onClick={toggleNba}
                    aria-expanded={!nbaCollapsed}
                    className="flex items-center justify-between gap-2 w-full text-left group/nba"
                  >
                    <MicroTitle className="text-muted-foreground">{t('cockpit.nba.title')}</MicroTitle>
                    <span className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground group-hover/nba:text-foreground transition-colors">
                      {nbaCollapsed && <span className="tabular-nums">{nextActions.length}</span>}
                      <ChevronDown
                        size={14}
                        className={cn('transition-transform', nbaCollapsed && '-rotate-90')}
                      />
                    </span>
                  </button>
                  {/* Lista compacta, monocromática, 1 linha por gap — a dica vai no
                      hover (title), não ocupa altura. Sem tile/accent (era slop). */}
                  {!nbaCollapsed && (
                    <ul className="mt-1.5 flex flex-col">
                      {nextActions.map((rule) => (
                        <li key={rule.id}>
                          <button
                            onClick={openGuideline}
                            title={brandGapHint(rule.id)}
                            className="group flex items-center justify-between gap-3 w-full py-1.5 text-left border-b border-border last:border-0"
                          >
                            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors truncate">
                              {rule.label}
                            </span>
                            <ChevronRight
                              size={12}
                              className="shrink-0 text-muted-foreground group-hover:text-foreground transition-colors"
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              ) : brandDetail ? (
                <section
                  data-vsn-region="next-best-action"
                  className={cn(cardCls, 'flex items-center gap-2.5 px-4 py-3')}
                >
                  <CheckCircle2 size={14} className="text-success shrink-0" />
                  <span className="text-xs text-muted-foreground">{t('cockpit.nba.complete')}</span>
                </section>
              ) : null}

              {/* PRODUZIR removido — dedupe: as MAKE SOMETHING cards do
                  BrandInteractivePanel (com o card Mockup) são a ÚNICA superfície
                  de produção agora (outcome-first). Fim da briga de hierarquia. */}

              {/* ── Bandas empilhadas full-width (igual à view pública): work em
                     andamento em cima, BrandInteractivePanel (MAKE SOMETHING +
                     LIVE AI CONTEXT) como faixa larga — ele precisa da largura
                     cheia pras suas 2 colunas internas não espremerem. ── */}
              <div className="flex flex-col gap-4 flex-1">
                {/* ── Produção PRIMEIRO (RCD: o principal aparece atraente antes do
                    resto): MAKE SOMETHING + Mockup + LIVE AI CONTEXT no topo. ── */}
                {activeBrand?.id && (
                  <div style={brandVars}>
                    <React.Suspense fallback={null}>
                      <BrandInteractivePanel
                        guidelineId={activeBrand.id}
                        fullWidth
                        isShared={!!(heroBrand?.isPublic || heroBrand?.publicSlug)}
                        connecting={connecting}
                        onConnect={handleConnect}
                        onMockup={() => setIsMockupOpen(true)}
                        onGenerate={(p) => {
                          setMockupPrompt(p);
                          setIsMockupOpen(true);
                        }}
                      />
                    </React.Suspense>
                  </div>
                )}

                {/* ── Bento: mockup grátis (1 cel) + trabalho em progresso (1 cel).
                    Antes o mockup era uma faixa full-width gigante; agora é uma
                    célula contida do bento (menos é mais). ── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1">
                  {activeBrand?.id && (
                    <React.Suspense fallback={null}>
                      <SurpriseMockupHero
                        brandId={activeBrand.id}
                        onAddAsset={() => setChangeLogoOpen(true)}
                      />
                    </React.Suspense>
                  )}

                  {/* ── In progress ── */}
                  <section
                    aria-label={t('cockpit.work.title')}
                    data-vsn-region="in-progress"
                    className={cn(cardCls, 'p-5 flex flex-col')}
                  >
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <MicroTitle className="text-muted-foreground">
                        {t('cockpit.work.title')}
                      </MicroTitle>
                      <Button
                        variant="surface"
                        size="xs"
                        onClick={() => navigate(FEATURE_COPILOT ? '/copilot' : '/mockupmachine')}
                        className="gap-1.5"
                        data-vsn-component="CockpitNewWork"
                      >
                        <Plus size={11} />
                        {t('cockpit.work.new')}
                      </Button>
                    </div>

                    {workItems.length > 0 ? (
                      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                        {workItems.map((item) => (
                          <button
                            key={`${item.kind}-${item.id}`}
                            onClick={() => openWorkItem(item)}
                            className={cn(tileCls, 'group text-left overflow-hidden flex flex-col')}
                          >
                            <div className="aspect-square w-full bg-muted flex items-center justify-center overflow-hidden">
                              {item.image ? (
                                <img
                                  src={item.image}
                                  alt=""
                                  className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                                  loading="lazy"
                                />
                              ) : item.kind === 'campaign' ? (
                                <Megaphone
                                  size={20}
                                  className="text-muted-foreground"
                                  strokeWidth={1.2}
                                />
                              ) : (
                                <Palette size={20} className="text-muted-foreground" strokeWidth={1.2} />
                              )}
                            </div>
                            <div className="p-3 space-y-0.5 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">
                                {item.title}
                              </p>
                              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground truncate">
                                {item.meta}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      /* Rich empty state — sell what IS possible with this brand. */
                      <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-10">
                        <div className="p-5 rounded-2xl bg-muted/40 border border-border">
                          <Wand2 size={28} className="text-muted-foreground" strokeWidth={1.2} />
                        </div>
                        <div className="space-y-1.5 max-w-sm">
                          <h3 className="text-sm font-semibold text-foreground">
                            {t('cockpit.work.emptyTitle')}
                          </h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {t('cockpit.work.emptySubtitle')}
                          </p>
                        </div>
                      </div>
                    )}
                  </section>
                </div>
              </div>

              {/* ── Output gallery — every generated asset, persisted per brand ── */}
              {brandMockups.length > 0 && (
                <section
                  aria-label={t('cockpit.gallery.title')}
                  data-vsn-region="output-gallery"
                  className={cn(cardCls, 'p-5')}
                >
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <MicroTitle className="text-muted-foreground">
                      {t('cockpit.gallery.title')}
                    </MicroTitle>
                    <Button
                      variant="surface"
                      size="xs"
                      onClick={() => navigate('/my-outputs')}
                      className="gap-1.5"
                    >
                      {t('cockpit.gallery.viewAll')}
                      <ChevronRight size={12} />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {brandMockups.slice(0, 12).map((m) => (
                      <button
                        key={m._id}
                        onClick={() => navigate('/my-outputs')}
                        title={m.prompt}
                        className={cn(tileCls, 'group aspect-square overflow-hidden')}
                      >
                        {m.imageUrl ? (
                          <img
                            src={m.imageUrl}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <Wand2 size={18} className="text-muted-foreground" strokeWidth={1.2} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mockup generator seeded by an inline suggestion (same as brand view). */}
      {isMockupOpen && activeBrand && (
        <React.Suspense fallback={null}>
          <BrandMockupDialog
            open={isMockupOpen}
            onOpenChange={(o: boolean) => {
              setIsMockupOpen(o);
              if (!o) setMockupPrompt(undefined);
            }}
            guideline={activeBrand}
            initialPrompt={mockupPrompt}
          />
        </React.Suspense>
      )}

      {/* Trocar logo principal — upload / da media / promover existente. */}
      {changeLogoOpen && heroBrand && (
        <React.Suspense fallback={null}>
          <ChangeLogoDialog
            guideline={heroBrand}
            open={changeLogoOpen}
            onOpenChange={setChangeLogoOpen}
          />
        </React.Suspense>
      )}
    </div>
  );
};
