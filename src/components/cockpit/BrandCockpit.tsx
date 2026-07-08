import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Sparkles,
  Plug,
  Settings,
  Plus,
  RefreshCw,
  Wand2,
  Loader2,
  Megaphone,
  Palette,
  Compass,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { GridDotsBackground } from '@/components/ui/GridDotsBackground';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { DemoBrandBanner } from '@/components/onboarding/DemoBrandBanner';
import { BrandSwitcher } from '@/components/cockpit/BrandSwitcher';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { useCampaigns } from '@/hooks/queries/useCampaigns';
import { useCreativeProjects } from '@/hooks/queries/useCreativeProjects';
import { useBrandSuggestions, SUGGESTION_KIND_META } from '@/hooks/useBrandSuggestions';
import { useConnectBrandToAI } from '@/hooks/useConnectBrandToAI';
import { useTranslation } from '@/hooks/useTranslation';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { cn } from '@/lib/utils';
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
 * Card visuals follow the AppsPage/CopilotPage card pattern
 * (`rounded-2xl border-neutral-800 bg-white/[0.03]`); empty state follows
 * DESIGN.md §4 and doubles as onboarding step 1 (ingest your brand).
 */

const ACTIVE_BRAND_LS_KEY = 'vsn_active_brand';

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

const cardCls =
  'rounded-2xl border border-neutral-800 bg-white/[0.03] hover:border-white/10 transition-colors';

export const BrandCockpit: React.FC<BrandCockpitProps> = ({ apps, onSelectApp }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const { data: brands = [], isLoading: brandsLoading } = useBrandGuidelines(true);
  const activeBrands = useMemo(() => brands.filter((g) => g.status !== 'archived'), [brands]);

  // Active brand — last one used persists in localStorage (multi-brand agencies).
  const [activeBrandId, setActiveBrandId] = useState<string | null>(
    () => localStorage.getItem(ACTIVE_BRAND_LS_KEY) || null
  );
  useEffect(() => {
    if (activeBrands.length === 0) return;
    const valid = activeBrandId && activeBrands.some((g) => g.id === activeBrandId);
    if (!valid) {
      // Prefer a real brand over the demo one when both exist.
      const fallback = activeBrands.find((g) => !g.isDemo) ?? activeBrands[0];
      if (fallback?.id) setActiveBrandId(fallback.id);
    }
  }, [activeBrands, activeBrandId]);

  const selectBrand = useCallback((id: string) => {
    setActiveBrandId(id);
    localStorage.setItem(ACTIVE_BRAND_LS_KEY, id);
  }, []);

  const activeBrand = useMemo(
    () => activeBrands.find((g) => g.id === activeBrandId) ?? null,
    [activeBrands, activeBrandId]
  );
  const hasBrand = !!activeBrand?.id;

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

  // ── Render ──
  return (
    <div
      className="fixed inset-0 z-10 bg-neutral-950 overflow-y-auto"
      data-vsn-page="home"
      data-vsn-component="BrandCockpit"
    >
      <GridDotsBackground opacity={0.05} spacing={30} color="#ffffff" />
      <DemoBrandBanner brandId={activeBrand?.id} />

      <main
        className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 pt-24 pb-16"
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
              className="rounded-3xl border border-white/10 bg-neutral-900/20 backdrop-blur-sm p-12 lg:p-24 flex flex-col items-center gap-8 text-center"
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
              className="space-y-10"
            >
              {/* ── Header: brand switcher · connect AI · settings ── */}
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <BrandSwitcher
                  brands={activeBrands}
                  value={activeBrand?.id ?? null}
                  onChange={selectBrand}
                />
                <div className="flex items-center gap-2">
                  <Button
                    variant="surface"
                    size="sm"
                    onClick={handleConnect}
                    disabled={connecting || !hasBrand}
                    data-vsn-component="CockpitConnectAI"
                  >
                    {connecting ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Plug size={13} />
                    )}
                    {t('cockpit.connectAI')}
                  </Button>
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
              </div>

              {/* ── In progress ── */}
              <section aria-label={t('cockpit.work.title')} data-vsn-region="in-progress">
                <MicroTitle className="text-neutral-500 tracking-[0.15em] mb-4">
                  {t('cockpit.work.title')}
                </MicroTitle>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  {workItems.map((item) => (
                    <button
                      key={`${item.kind}-${item.id}`}
                      onClick={() => openWorkItem(item)}
                      className={cn(cardCls, 'group text-left overflow-hidden flex flex-col')}
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

                  {/* + New — always last */}
                  <button
                    onClick={() => navigate(FEATURE_COPILOT ? '/copilot' : '/mockupmachine')}
                    className={cn(
                      cardCls,
                      'flex flex-col items-center justify-center gap-2 min-h-[120px] text-neutral-500 hover:text-neutral-200'
                    )}
                    data-vsn-component="CockpitNewWork"
                  >
                    <Plus size={18} strokeWidth={1.5} />
                    <span className="text-[10px] font-mono uppercase tracking-widest">
                      {t('cockpit.work.new')}
                    </span>
                  </button>
                </div>
                {workItems.length === 0 && (
                  <p className="text-xs text-neutral-600 mt-3">{t('cockpit.work.empty')}</p>
                )}
              </section>

              {/* ── Brand suggestions (seasonal) ── */}
              <section aria-label={t('cockpit.suggestions.title')} data-vsn-region="suggestions">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Sparkles size={13} className="text-brand-cyan shrink-0" />
                    <MicroTitle className="text-neutral-500 tracking-[0.15em]">
                      {t('cockpit.suggestions.title')}
                    </MicroTitle>
                    {seasonal && (
                      <span className="hidden sm:inline text-[10px] font-mono text-neutral-500">
                        {seasonal.label} · ~{seasonal.daysAway}d
                      </span>
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
                  <div className="flex items-center gap-2 text-xs text-neutral-500 py-8 justify-center">
                    <Loader2 size={13} className="animate-spin" />
                    {t('cockpit.suggestions.loading')}
                  </div>
                ) : error && suggestions.length === 0 ? (
                  <p className="text-xs text-neutral-600 py-6 text-center">{error}</p>
                ) : (
                  <div className="grid sm:grid-cols-3 gap-3">
                    {suggestions.slice(0, 3).map((s, i) => {
                      const meta = SUGGESTION_KIND_META[s.kind] || SUGGESTION_KIND_META.mockup;
                      const Icon = meta.Icon;
                      return (
                        <div key={i} className={cn(cardCls, 'flex flex-col gap-2.5 p-4')}>
                          <div className="flex items-center gap-1.5 text-neutral-500">
                            <Icon size={12} className="shrink-0" />
                            <span className="text-[9px] font-mono uppercase tracking-wider">
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

              {/* ── Shortcuts: the TUI launcher, shrunk to one row ── */}
              <section aria-label={t('cockpit.shortcuts.title')} data-vsn-region="shortcuts">
                <MicroTitle className="text-neutral-500 tracking-[0.15em] mb-4">
                  {t('cockpit.shortcuts.title')}
                </MicroTitle>
                <div className="flex items-center gap-2 flex-wrap">
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
                </div>
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
