import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Sparkles,
  Settings,
  Plus,
  RefreshCw,
  Wand2,
  Loader2,
  Megaphone,
  Palette,
  Compass,
  ArrowRight,
  AlertCircle,
  Bot,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { GridDotsBackground } from '@/components/ui/GridDotsBackground';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { DemoBrandBanner } from '@/components/onboarding/DemoBrandBanner';
import { BrandSwitcher } from '@/components/cockpit/BrandSwitcher';
import { ConnectAICard } from '@/components/cockpit/ConnectAICard';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import { useBrandGuideline } from '@/hooks/queries/useBrandGuidelines';
import { useActiveBrand } from '@/contexts/ActiveBrandContext';
import { useCampaigns } from '@/hooks/queries/useCampaigns';
import { useCreativeProjects } from '@/hooks/queries/useCreativeProjects';
import { useBrandSuggestions, SUGGESTION_KIND_META } from '@/hooks/useBrandSuggestions';
import { useConnectBrandToAI } from '@/hooks/useConnectBrandToAI';
import { useTranslation } from '@/hooks/useTranslation';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { cn } from '@/lib/utils';
import { glassSurface } from '@/lib/ui/glass';
import { FEATURE_COPILOT } from '@/config/featureFlags';
import type { AppConfig } from '@/services/appsService';
import type { BrandSuggestion } from '@/services/brandGuidelineApi';

// Mockup generator dialog — owner-only, loaded on demand (same as brand view).
const BrandMockupDialog = lazyWithRetry(() =>
  import('@/components/brand/guidelines/BrandMockupDialog').then((m) => ({
    default: m.BrandMockupDialog,
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

export const BrandCockpit: React.FC<BrandCockpitProps> = ({ apps, onSelectApp }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Marca ativa vem do SSoT global (ActiveBrandContext) — o cockpit não gere
  // mais o estado/localStorage localmente. O rail e o hero ficam em sincronia.
  const {
    brands: activeBrands,
    activeBrandId,
    setActiveBrand: selectBrand,
    activeBrand,
    isLoading: brandsLoading,
  } = useActiveBrand();
  const hasBrand = !!activeBrand?.id;

  // Full guideline detail (colors, logos) for the hero — list rows are the
  // placeholder, so the header renders instantly and enriches when it lands.
  const { data: brandDetail } = useBrandGuideline(activeBrand?.id);
  const heroBrand = brandDetail ?? activeBrand;
  const brandName = heroBrand?.identity?.name || heroBrand?.name || '';

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

  // ── Suggestions — same SSoT hook as the brand view panel ──
  const { suggestions, seasonal, loading, refreshing, error, load } = useBrandSuggestions(
    activeBrand?.id,
    3
  );

  const [mockupPrompt, setMockupPrompt] = useState<string | undefined>(undefined);
  const [isMockupOpen, setIsMockupOpen] = useState(false);

  const runSuggestion = useCallback(
    async (s: BrandSuggestion) => {
      const meta = SUGGESTION_KIND_META[s.kind] || SUGGESTION_KIND_META.mockup;
      if (meta.mode === 'inline') {
        // Same behavior as the brand view panel: seed the mockup generator.
        setMockupPrompt(s.prompt);
        setIsMockupOpen(true);
        return;
      }
      try {
        await navigator.clipboard.writeText(s.prompt);
        toast.success(t('cockpit.suggestions.briefCopied'));
      } catch {
        toast.error(t('cockpit.suggestions.copyFailed'));
      }
    },
    [t]
  );

  // ── Connect to AI (same mint/redirect flow as the brand view) ──
  const { connecting, connect } = useConnectBrandToAI();
  const handleConnect = useCallback(() => {
    if (!activeBrand) return;
    // Not public yet → land on the brand dashboard where sharing lives.
    connect(activeBrand.publicSlug, () =>
      navigate(activeBrand.id ? `/brand-guidelines?id=${activeBrand.id}` : '/brand-guidelines')
    );
  }, [activeBrand, connect, navigate]);

  // Concrete first steps when nothing is in progress — sell what IS possible.
  const emptyWorkActions = useMemo(
    () => [
      {
        key: 'mockups',
        label: t('cockpit.work.ctaMockups'),
        Icon: Wand2,
        onClick: () => setIsMockupOpen(true),
      },
      {
        key: 'campaign',
        label: t('cockpit.work.ctaCampaign'),
        Icon: Megaphone,
        onClick: () =>
          navigate(activeBrand?.id ? `/campaigns?brandId=${activeBrand.id}` : '/campaigns'),
      },
      FEATURE_COPILOT
        ? {
            key: 'copilot',
            label: t('cockpit.work.ctaCopilot'),
            Icon: Bot,
            onClick: () => navigate('/copilot'),
          }
        : {
            key: 'creative',
            label: t('cockpit.work.ctaCreative'),
            Icon: Palette,
            onClick: () => navigate('/create'),
          },
    ],
    [t, navigate, activeBrand]
  );

  // ── Render ──
  return (
    <div
      className="absolute inset-0 z-0 bg-neutral-950 overflow-y-auto"
      data-vsn-page="home"
      data-vsn-component="BrandCockpit"
    >
      <GridDotsBackground opacity={0.05} spacing={30} color="#ffffff" />
      <DemoBrandBanner brandId={activeBrand?.id} />

      <main
        className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 pt-8 pb-12 min-h-full flex flex-col"
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
          ) : activeBrands.length === 0 ? (
            /* ── Empty state = onboarding step 1: ingest your brand ── */
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn('rounded-3xl p-12 lg:p-24 flex flex-col items-center gap-8 text-center', glassSurface.panel)}
            >
              <div className="p-8 rounded-3xl bg-neutral-950/50 border border-white/10">
                <Compass size={48} className="text-brand-cyan" strokeWidth={1.2} />
              </div>
              <div className="space-y-3">
                <h2 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                  {t('cockpit.empty.title')}
                </h2>
                <p className="text-neutral-500 text-sm max-w-sm mx-auto">
                  {t('cockpit.empty.subtitle')}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  variant="brand"
                  className="h-12 px-8 rounded-full font-bold uppercase tracking-wider text-[11px]"
                  onClick={() => navigate('/welcome')}
                >
                  {t('cockpit.empty.cta')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/brand-guidelines')}
                  className="text-neutral-500 hover:text-neutral-200"
                >
                  {t('cockpit.empty.secondary')}
                </Button>
              </div>
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
                  <BrandAvatar
                    brand={heroBrand}
                    size={56}
                    rounded="md"
                    className="border-neutral-800 bg-neutral-900"
                  />
                  <div className="min-w-0">
                    <MicroTitle className="text-neutral-600">{t('cockpit.title')}</MicroTitle>
                    <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight truncate mt-0.5">
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
                            className="w-4 h-4 rounded-full border border-white/10 shrink-0"
                            style={{ backgroundColor: c.hex }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <BrandSwitcher
                    brands={activeBrands}
                    value={activeBrand?.id ?? null}
                    onChange={selectBrand}
                  />
                  <Button
                    variant="ghost"
                    size="icon-md"
                    aria-label={t('cockpit.settings')}
                    onClick={() => navigate('/profile')}
                    className="text-neutral-500 hover:text-neutral-200"
                  >
                    <Settings size={15} />
                  </Button>
                </div>
              </header>

              {/* ── Bento grid ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 content-start">
                {/* ── In progress (2 cols) ── */}
                <section
                  aria-label={t('cockpit.work.title')}
                  data-vsn-region="in-progress"
                  className={cn(cardCls, 'lg:col-span-2 p-5 flex flex-col')}
                >
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <MicroTitle className="text-neutral-500">{t('cockpit.work.title')}</MicroTitle>
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
                          <div className="aspect-square w-full bg-neutral-900 flex items-center justify-center overflow-hidden">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                                loading="lazy"
                              />
                            ) : item.kind === 'campaign' ? (
                              <Megaphone size={20} className="text-neutral-700" strokeWidth={1.2} />
                            ) : (
                              <Palette size={20} className="text-neutral-700" strokeWidth={1.2} />
                            )}
                          </div>
                          <div className="p-3 space-y-0.5 min-w-0">
                            <p className="text-xs font-medium text-neutral-200 truncate">
                              {item.title}
                            </p>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-neutral-600 truncate">
                              {item.meta}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    /* Rich empty state — sell what IS possible with this brand. */
                    <div className="flex-1 flex flex-col items-center justify-center text-center gap-5 py-10">
                      <div className="p-5 rounded-2xl bg-neutral-950/50 border border-white/10">
                        <Wand2 size={28} className="text-neutral-400" strokeWidth={1.2} />
                      </div>
                      <div className="space-y-1.5 max-w-sm">
                        <h3 className="text-sm font-semibold text-neutral-200">
                          {t('cockpit.work.emptyTitle')}
                        </h3>
                        <p className="text-xs text-neutral-500 leading-relaxed">
                          {t('cockpit.work.emptySubtitle')}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {emptyWorkActions.map(({ key, label, Icon, onClick }, i) => (
                          <Button
                            key={key}
                            variant={i === 0 ? 'brand' : 'surface'}
                            size="sm"
                            onClick={onClick}
                            className="gap-2 font-sans"
                          >
                            <Icon size={13} />
                            {label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                {/* ── Connect your AI (1 col) ── */}
                <ConnectAICard
                  onConnect={handleConnect}
                  connecting={connecting}
                  disabled={!hasBrand}
                />

                {/* ── Brand suggestions (full width) ── */}
                <section
                  aria-label={t('cockpit.suggestions.title')}
                  data-vsn-region="suggestions"
                  className={cn(cardCls, 'lg:col-span-3 p-5')}
                >
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Sparkles size={13} className="text-brand-cyan shrink-0" />
                      <MicroTitle className="text-neutral-500">
                        {t('cockpit.suggestions.title')}
                      </MicroTitle>
                      {seasonal && (
                        <MicroTitle className="hidden sm:inline text-[10px] text-neutral-500">
                          {seasonal.label} · ~{seasonal.daysAway}d
                        </MicroTitle>
                      )}
                    </div>
                    <button
                      onClick={() => load(true)}
                      disabled={loading || refreshing}
                      className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-neutral-500 hover:text-neutral-200 transition-colors disabled:opacity-40"
                      aria-label={t('cockpit.suggestions.refresh')}
                    >
                      <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
                      {t('cockpit.suggestions.refresh')}
                    </button>
                  </div>

                  {loading ? (
                    /* Skeleton tiles — keep the card structure while thinking. */
                    <div className="grid sm:grid-cols-3 gap-3" aria-hidden="true">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className={cn(tileCls, 'p-4 space-y-3 animate-pulse')}>
                          <div className="h-2.5 w-16 rounded bg-white/5" />
                          <div className="h-3.5 w-3/4 rounded bg-white/10" />
                          <div className="space-y-1.5">
                            <div className="h-2.5 w-full rounded bg-white/5" />
                            <div className="h-2.5 w-2/3 rounded bg-white/5" />
                          </div>
                          <div className="h-7 w-20 rounded-md bg-white/5" />
                        </div>
                      ))}
                    </div>
                  ) : error && suggestions.length === 0 ? (
                    /* Inline error — short message + retry, inside the frame. */
                    <div
                      className={cn(
                        tileCls,
                        'flex flex-col sm:flex-row items-center justify-center gap-3 px-5 py-6 text-center'
                      )}
                    >
                      <div className="flex items-center gap-2 text-xs text-neutral-500 min-w-0">
                        <AlertCircle size={13} className="text-warning shrink-0" />
                        <span className="truncate">{t('cockpit.suggestions.errorTitle')}</span>
                      </div>
                      <Button
                        variant="surface"
                        size="xs"
                        onClick={() => load(true)}
                        className="gap-1.5"
                      >
                        <RefreshCw size={11} />
                        {t('cockpit.suggestions.retry')}
                      </Button>
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-3 gap-3">
                      {suggestions.slice(0, 3).map((s, i) => {
                        const meta = SUGGESTION_KIND_META[s.kind] || SUGGESTION_KIND_META.mockup;
                        const Icon = meta.Icon;
                        return (
                          <div key={i} className={cn(tileCls, 'flex flex-col gap-2.5 p-4')}>
                            <div className="flex items-center gap-1.5 text-neutral-500">
                              <Icon size={12} className="shrink-0" />
                              <span className="text-[10px] font-mono uppercase tracking-wider">
                                {meta.label}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-neutral-200 leading-snug">
                              {s.title}
                            </span>
                            <p className="text-xs text-neutral-500 leading-relaxed line-clamp-2 flex-1">
                              {s.rationale}
                            </p>
                            <div className="pt-0.5">
                              <Button
                                variant="brand"
                                size="xs"
                                onClick={() => runSuggestion(s)}
                                className="gap-1.5"
                              >
                                {meta.mode === 'inline' ? (
                                  <Wand2 size={11} />
                                ) : (
                                  <Sparkles size={11} />
                                )}
                                {meta.mode === 'inline'
                                  ? t('cockpit.suggestions.generate')
                                  : t('cockpit.suggestions.useInAI')}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              {/* ── Shortcuts: the TUI launcher, shrunk to a footer row ── */}
              <section
                aria-label={t('cockpit.shortcuts.title')}
                data-vsn-region="shortcuts"
                className="flex items-center gap-2 flex-wrap pt-4 border-t border-neutral-800"
              >
                <MicroTitle className="text-neutral-600 mr-1">
                  {t('cockpit.shortcuts.title')}
                </MicroTitle>
                {apps.map((app) => (
                  <button
                    key={app.appId}
                    onClick={() => onSelectApp(app)}
                    disabled={app.badgeVariant === 'comingSoon'}
                    className="px-3.5 py-2 rounded-lg bg-white/5 border border-neutral-800 font-mono text-[10px] uppercase tracking-widest text-neutral-400 hover:text-white hover:bg-white/10 hover:border-white/15 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {app.name}
                  </button>
                ))}
                <button
                  onClick={() => navigate('/apps')}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg font-mono text-[10px] uppercase tracking-widest text-neutral-600 hover:text-neutral-300 transition-colors"
                >
                  {t('cockpit.shortcuts.allApps')}
                  <ArrowRight size={11} />
                </button>
              </section>
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
    </div>
  );
};
