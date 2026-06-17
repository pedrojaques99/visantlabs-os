import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { SEO } from '@/components/SEO';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import {
  Download,
  AlertCircle,
  Palette,
  ChevronLeft,
  Sun,
  Moon,
  Home,
  Pencil,
  Eye,
  Plug,
  SlidersHorizontal,
  Zap,
  Image as ImageIcon,
  Share2,
  Figma,
  Check,
  ShieldCheck,
  MoreHorizontal,
  FileInput,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BrandGuideline } from '@/lib/figma-types';
import {
  BrandReadOnlyView,
  extractBrandTheme,
  getRelativeLuminance,
  toCSSVariables,
  type BrandViewSection,
} from '@/components/brand/BrandReadOnlyView';
import { BrandSectionNav } from '@/components/brand/BrandSectionNav';
import { PUBLIC_TABS, downloadBlob, safeFileName } from '@/components/brand/brand-shared-config';
import { buildMockTokens } from '@/components/brand/guidelines/preview/mockTokens';
import { BrandOverviewBento } from '@/components/brand/guidelines/preview/BrandOverviewBento';
import { BrandPreviewGallery } from '@/components/brand/guidelines/preview/BrandPreviewGallery';
import { useTranslation } from '@/hooks/useTranslation';
import { DEFAULT_SECTION_IDS } from '@/components/brand/guidelines/sections-manifest';
import { InlineEditable } from '@/components/brand/InlineEditable';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { BrandCompletenessPill } from '@/components/brand/guidelines/BrandCompletenessPill';
import { BrandIngestButton } from '@/components/brand/guidelines/BrandIngestButton';
import { copyToClipboard } from '@/utils/clipboard';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  BrandRoomProvider,
  BrandCollaboratorAvatars,
  SectionPresenceDot,
} from '@/components/brand/guidelines/BrandCollaborators';

// Lazy (with chunk-retry) — these are only needed by authenticated owners in edit
// mode; anonymous visitors never download them. lazyWithRetry recovers from stale
// chunks / MIME errors after a deploy.
const PublicSectionEditSheet = lazyWithRetry(
  () => import('@/components/brand/guidelines/PublicSectionEditSheet')
);

const GuidelineDetail = lazyWithRetry(() =>
  import('@/components/brand/guidelines/GuidelineDetail').then((m) => ({
    default: m.GuidelineDetail,
  }))
);

const BrandAiPopulateDialog = lazyWithRetry(() =>
  import('@/components/brand/guidelines/BrandAiPopulateDialog').then((m) => ({
    default: m.BrandAiPopulateDialog,
  }))
);
const BrandMockupDialog = lazyWithRetry(() =>
  import('@/components/brand/guidelines/BrandMockupDialog').then((m) => ({
    default: m.BrandMockupDialog,
  }))
);
const ShareGuidelineDialog = lazyWithRetry(() =>
  import('@/components/brand/guidelines/ShareGuidelineDialog').then((m) => ({
    default: m.ShareGuidelineDialog,
  }))
);
const DesignSystemValidation = lazyWithRetry(() =>
  import('@/components/brand/guidelines/DesignSystemValidation').then((m) => ({
    default: m.DesignSystemValidation,
  }))
);

// ─── Section label map ────────────────────────────────────────────────────────

const SECTION_LABELS: Record<BrandViewSection, string> = {
  identity: 'Identity',
  coreMessage: 'Core Message',
  pillars: 'Pillars',
  manifesto: 'Manifesto',
  archetypes: 'Archetypes',
  personas: 'Personas',
  voiceValues: 'Voice & Values',
  colors: 'Colors',
  typography: 'Typography',
  logos: 'Logos',
  media: 'Media',
  guidelines: 'Guidelines',
};

// ─── Main page ────────────────────────────────────────────────────────────────

// `idOverride` makes this the unified owner-editor: load a brand by id (auth) and
// open straight into advanced edit. Without it, it's the public-by-slug view.
// `onBack` overrides the VOLTAR action (admin uses it to return to the dashboard).
export const PublicBrandGuideline: React.FC<{ idOverride?: string; onBack?: () => void }> = ({
  idOverride,
  onBack,
}) => {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [guideline, setGuideline] = useState<BrandGuideline | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  // Nav collapses from top-bar → sidebar once the hero scrolls out of view.
  const [navCollapsed, setNavCollapsed] = useState(false);
  const heroSentinelRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'brand' | 'light' | 'dark'>('brand');
  const [editMode, setEditMode] = useState(!!idOverride);
  const [activeEditSection, setActiveEditSection] = useState<BrandViewSection | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [advancedEdit, setAdvancedEdit] = useState(false);
  // Owner action dialogs (ported from the admin editor)
  const [isAiPopulateOpen, setIsAiPopulateOpen] = useState(false);
  const [isMockupOpen, setIsMockupOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [figmaCopied, setFigmaCopied] = useState(false);
  // Opens the (always-mounted, visually hidden) BrandIngestButton's drop-zone
  // modal from the overflow menu — keeps ingest's stream state outside the menu.
  const ingestOpenRef = useRef<(() => void) | null>(null);

  const fetchGuideline = useCallback(async () => {
    try {
      if (idOverride) {
        // Owner editor path — load by id (auth); owner of this brand can always edit.
        const g = await brandGuidelineApi.getById(idOverride);
        setGuideline(g);
        setCanEdit(true);
      } else if (slug) {
        const result = await brandGuidelineApi.getPublic(slug);
        setGuideline(result.guideline);
        setCanEdit(result.canEdit);
      } else {
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load brand guidelines');
    } finally {
      setIsLoading(false);
    }
  }, [slug, idOverride]);

  useEffect(() => {
    fetchGuideline();
  }, [fetchGuideline]);

  // onSave: called by LiveblocksEditorProvider on every patch — persist to DB + update local state
  const handleSave = useCallback(
    async (patch: Partial<BrandGuideline>) => {
      if (!guideline?.id) return;
      try {
        const updated = await brandGuidelineApi.update(guideline.id, patch);
        setGuideline(updated);
      } catch {
        toast.error('Failed to save changes');
      }
    },
    [guideline?.id]
  );

  // Theme: owners persist their pick as the brand's default (loaded first next time).
  const chooseTheme = useCallback(
    (next: 'brand' | 'light' | 'dark') => {
      setTheme(next);
      if (canEdit && guideline?.id) handleSave({ defaultTheme: next } as Partial<BrandGuideline>);
    },
    [canEdit, guideline?.id, handleSave]
  );

  // Load the brand's saved default theme on first load (once per brand).
  useEffect(() => {
    const dt = guideline?.defaultTheme;
    if (dt === 'brand' || dt === 'light' || dt === 'dark') setTheme(dt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guideline?.id]);

  // Advanced editor section visibility — persisted in guideline.activeSections (same as admin).
  const advancedVisibleSections = useMemo(() => {
    const active = ((guideline?.activeSections as string[]) || []).length
      ? (guideline!.activeSections as string[])
      : DEFAULT_SECTION_IDS;
    return DEFAULT_SECTION_IDS.filter((id) => active.includes(id));
  }, [guideline]);

  const handleHideSection = useCallback(
    (id: string) => {
      const active = ((guideline?.activeSections as string[]) || []).length
        ? (guideline!.activeSections as string[])
        : DEFAULT_SECTION_IDS;
      const next = active.includes(id) ? active.filter((s) => s !== id) : [...active, id];
      handleSave({ activeSections: next } as Partial<BrandGuideline>);
    },
    [guideline, handleSave]
  );

  const handleConnect = async () => {
    // Admin context loads by id (no slug) — fall back to the brand's publicSlug.
    const connectSlug = slug || guideline?.publicSlug;
    if (!connectSlug) {
      toast.error('Make the brand public first to connect it');
      setIsShareOpen(true);
      return;
    }
    setConnecting(true);
    try {
      const { connectUrl } = await brandGuidelineApi.getPublicConnectLink(connectSlug);
      window.location.href = connectUrl;
    } catch {
      toast.error('Failed to generate connect link');
      setConnecting(false);
    }
  };

  const handleDownloadJSON = () => {
    if (!guideline) return;
    const name = safeFileName(guideline.identity?.name, 'brand');
    downloadBlob(JSON.stringify(guideline, null, 2), `${name}-guidelines.json`, 'application/json');
    toast.success(t('public.brand.guideline.downloaded_as_json'));
  };

  const handleDownloadCSS = () => {
    if (!guideline) return;
    const name = safeFileName(guideline.identity?.name, 'brand');
    downloadBlob(toCSSVariables(guideline), `${name}-variables.css`, 'text/css');
    toast.success(t('public.brand.guideline.downloaded_as_css'));
  };

  const brandTheme = useMemo(() => extractBrandTheme(guideline, theme), [guideline, theme]);
  const tokens = useMemo(() => buildMockTokens(guideline), [guideline]);
  // Brand theme CSS vars — also passed to portaled overlays (dropdown) so their
  // glass surfaces match the live page theme.
  const themeVars = useMemo(
    () =>
      ({
        '--accent': brandTheme.accent,
        '--accent-rgb': brandTheme.accentRgb,
        '--accent-text': brandTheme.accentText,
        '--brand-bg': brandTheme.bg,
        '--brand-surface': brandTheme.surface,
        '--brand-text': brandTheme.text,
      }) as React.CSSProperties,
    [brandTheme]
  );

  // Preview tab (gallery) + Overview's Mockups tile render from local mock
  // tokens — available to anyone viewing the brand once there's enough to draw.
  const hasPreviewData =
    tokens.palette.length > 0 || !!tokens.primaryLogo || !!guideline?.identity?.name;
  const visibleTabs = useMemo(
    () => PUBLIC_TABS.filter((tab) => tab.id !== 'preview' || hasPreviewData),
    [hasPreviewData]
  );
  const currentTab = PUBLIC_TABS.find((t) => t.id === activeTab) || PUBLIC_TABS[0];
  const visibleSections = currentTab.sections;

  // Collapse the top nav into the sidebar once the hero sentinel leaves the top.
  useEffect(() => {
    const el = heroSentinelRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setNavCollapsed(!entry.isIntersecting), {
      threshold: 0,
      rootMargin: '-24px 0px 0px 0px',
    });
    io.observe(el);
    return () => io.disconnect();
  }, [guideline?.id]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="relative z-10 flex flex-col items-center gap-4"
        >
          <GlitchLoader size={40} />
          <MicroTitle className="text-neutral-600 uppercase tracking-[0.1em]">
            {t('public.brand.guideline.decrypting_brand_assets')}
          </MicroTitle>
        </motion.div>
      </div>
    );
  }

  if (error || !guideline) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
        <GlassPanel
          padding="lg"
          className="relative z-10 max-w-md text-center border-destructive/10 bg-destructive/[0.02]"
        >
          <AlertCircle size={48} className="mx-auto text-destructive/40 mb-4" />
          <h1 className="text-xl font-bold text-neutral-200 mb-2 font-manrope">
            {t('public.brand.guideline.access_denied')}
          </h1>
          <p className="text-neutral-500 text-sm mb-6 leading-relaxed">
            {error ||
              'This brand guideline is either private or does not exist in our secure vault.'}
          </p>
          <Link to="/">
            <Button
              variant="outline"
              className="text-[var(--accent)] border-[var(--accent)]/20 hover:bg-[var(--accent)]/5"
              style={
                { '--accent': guideline?.colors?.[0]?.hex || '#888888' } as React.CSSProperties
              }
            >
              Return to Surface
            </Button>
          </Link>
        </GlassPanel>
      </div>
    );
  }

  const brandName = guideline.identity?.name || 'Brand Guidelines';
  const isLightBg = getRelativeLuminance(brandTheme.bg) > 0.5;
  const navBtnClass = isLightBg
    ? 'bg-black/5 border-black/10 text-black hover:bg-black/10'
    : 'bg-white/5 border-white/10 text-white hover:bg-white/10';
  // Unified top-right control pill — same design system as HOME/VOLTAR (contrast-safe hover).
  const ctrlBtnClass = cn(
    'h-9 px-4 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest gap-2 border backdrop-blur-md transition-all',
    navBtnClass
  );
  // In admin context (idOverride) the global app Header (h-10 md:h-14) is present,
  // Admin view covers the whole viewport (incl. native header), so toolbars sit at top-5.
  const toolbarTop = 'top-5';

  // The Sheet and edit pencil buttons are placed inside the room so they can
  // access useBrandGuidelineEditor(). The room is only mounted when editMode=true
  // to avoid Liveblocks connections for anonymous visitors.
  const pageContent = (
    <div
      className={cn(
        'transition-all duration-1000 selection:bg-[var(--accent)]/30 overflow-x-hidden',
        // Admin (idOverride): cover the whole viewport over the native app header.
        // z-50 (tie with the header) wins by DOM order — same mechanism that lets
        // portaled overlays (dialogs/menus/sheets, z-50) render above this shell.
        // Going higher (z-[60]) trapped every overlay behind the shell.
        idOverride ? 'fixed inset-0 z-50 overflow-y-auto' : 'min-h-screen'
      )}
      style={
        {
          '--accent': brandTheme.accent,
          '--accent-rgb': brandTheme.accentRgb,
          '--accent-text': brandTheme.accentText,
          '--brand-bg': brandTheme.bg,
          '--brand-surface': brandTheme.surface,
          '--brand-text': brandTheme.text,
          backgroundColor: 'var(--brand-bg)',
          color: 'var(--brand-text)',
        } as React.CSSProperties
      }
    >
      <SEO
        title={`${brandName} - Brand Portal`}
        description={guideline.identity?.description || guideline.identity?.tagline}
      />

      {/* Section nav (top bar + sidebar) is rendered once, lower in the tree,
          by <BrandSectionNav/> so the tab list stays single-source. */}

      {/* Top-left nav buttons */}
      <div className={cn('flex gap-2 fixed left-5 z-40', toolbarTop)}>
        <Button
          onClick={() => navigate('/')}
          variant="ghost"
          className={cn(
            'h-9 px-4 text-[10px] font-mono gap-2 border backdrop-blur-md transition-all',
            navBtnClass
          )}
        >
          <Home size={14} /> <span className="hidden sm:inline">HOME</span>
        </Button>
        <Button
          onClick={() => (onBack ? onBack() : navigate(-1))}
          variant="ghost"
          className={cn(
            'h-9 px-4 text-[10px] font-mono gap-2 border backdrop-blur-md transition-all',
            navBtnClass
          )}
        >
          <ChevronLeft size={14} /> <span className="hidden sm:inline">VOLTAR</span>
        </Button>
      </div>

      {/* Top-right controls */}
      <div
        className={cn(
          'flex flex-wrap justify-end gap-2 fixed right-5 z-40 items-center max-w-[70vw]',
          toolbarTop
        )}
      >
        {/* Collaborator avatars — only visible in edit mode (inside room) */}
        {editMode && (
          <div className="mr-1">
            <BrandCollaboratorAvatars />
          </div>
        )}

        {/* Edit-mode primary tools: completeness status, the GENERATE CTA, and Share */}
        {canEdit && editMode && (
          <>
            <BrandCompletenessPill guideline={guideline} />
            <Button
              onClick={() => setIsAiPopulateOpen(true)}
              variant="ghost"
              className={cn(
                ctrlBtnClass,
                // Primary CTA — uses the brand accent so it reads as the main action.
                'bg-[var(--accent)] text-[var(--accent-text)] border-transparent hover:bg-[var(--accent)] shadow-[0_0_20px_rgba(var(--accent-rgb),0.25)]'
              )}
            >
              <Zap size={13} />
              <span className="hidden sm:inline">Generate</span>
            </Button>
            <Button onClick={() => setIsShareOpen(true)} variant="ghost" className={ctrlBtnClass}>
              <Share2 size={13} />
              <span className="hidden sm:inline">Share</span>
            </Button>
          </>
        )}

        {/* View / Edit toggle — owners/editors */}
        {canEdit && (
          <Button
            onClick={() => setEditMode((v) => !v)}
            variant="ghost"
            className={cn(
              ctrlBtnClass,
              editMode && 'bg-warning/20 border-warning/40 text-warning hover:bg-warning/30'
            )}
          >
            {editMode ? <Eye size={13} /> : <Pencil size={13} />}
            <span className="hidden sm:inline">
              {editMode
                ? t('public.brand.guideline.viewing_mode')
                : t('public.brand.guideline.edit_mode')}
            </span>
          </Button>
        )}

        {/* Unified overflow — every secondary action, grouped by intent */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className={ctrlBtnClass} aria-label="More actions">
              <MoreHorizontal size={14} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            style={themeVars}
            className="w-auto min-w-0 p-2 rounded-2xl border border-[var(--brand-text)]/10 bg-[var(--brand-bg)]/70 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.25)] text-[var(--brand-text)]"
          >
            {/* Import / Create — edit mode only */}
            {canEdit && editMode && (
              <>
                <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                  Import / Create
                </DropdownMenuLabel>
                {guideline.id && (
                  <Button variant="menuItem" onClick={() => ingestOpenRef.current?.()}>
                    <FileInput size={13} /> Ingest
                  </Button>
                )}
                <Button variant="menuItem" onClick={() => setIsMockupOpen(true)}>
                  <ImageIcon size={13} /> Mockup
                </Button>
                <DropdownMenuSeparator />
              </>
            )}

            {/* Export / Connect — always available */}
            <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Export / Connect
            </DropdownMenuLabel>
            <Button variant="menuItem" onClick={handleDownloadJSON}>
              <Download size={13} /> JSON
            </Button>
            <Button variant="menuItem" onClick={handleDownloadCSS}>
              <Download size={13} /> {t('public.brand.guideline.css_variables')}
            </Button>
            {canEdit && guideline.id && (
              <Button
                variant="menuItem"
                onClick={() => {
                  if (guideline.id) copyToClipboard(guideline.id);
                  setFigmaCopied(true);
                  setTimeout(() => setFigmaCopied(false), 2000);
                }}
              >
                {figmaCopied ? <Check size={13} className="text-success" /> : <Figma size={13} />}
                {figmaCopied ? 'Copied!' : 'Use in Figma'}
              </Button>
            )}
            <Button variant="menuItem" onClick={handleConnect} disabled={connecting}>
              <Plug size={13} className={connecting ? 'animate-pulse' : ''} />
              {connecting
                ? t('public.brand.guideline.connecting')
                : t('public.brand.guideline.connect')}
            </Button>

            {/* Quality — edit mode only */}
            {canEdit && editMode && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                  Quality
                </DropdownMenuLabel>
                <Button variant="menuItem" onClick={() => setIsReviewOpen(true)}>
                  <ShieldCheck size={13} /> Review
                </Button>
              </>
            )}

            {/* Display — theme (always) + advanced editor (edit mode) */}
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              Display
            </DropdownMenuLabel>
            {canEdit && editMode && (
              <Button
                variant="menuItem"
                onClick={() => setAdvancedEdit((v) => !v)}
                aria-pressed={advancedEdit}
              >
                <SlidersHorizontal size={13} /> Advanced editor
                {advancedEdit && <Check size={13} className="ml-auto text-success" />}
              </Button>
            )}
            {/* Theme — compact icon row, persisted as the brand default for owners */}
            <div
              className="flex items-center gap-1.5 px-2 py-1.5"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span className="text-[11px] font-medium opacity-60 mr-auto">Theme</span>
              {(
                [
                  { k: 'brand', Icon: Palette, label: 'Brand theme' },
                  { k: 'light', Icon: Sun, label: 'Light' },
                  { k: 'dark', Icon: Moon, label: 'Dark' },
                ] as const
              ).map(({ k, Icon, label }) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => chooseTheme(k)}
                  title={label}
                  aria-label={label}
                  aria-pressed={theme === k}
                  className={cn(
                    'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                    theme === k
                      ? 'bg-[var(--accent)] text-[var(--accent-text)]'
                      : 'opacity-50 hover:opacity-100 hover:bg-[var(--brand-text)]/10'
                  )}
                >
                  <Icon size={13} />
                </button>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Hidden ingest mount — its modal lives here; opened via ingestOpenRef from the menu */}
        {canEdit && editMode && guideline.id && (
          <BrandIngestButton
            guideline={guideline}
            onSuccess={fetchGuideline}
            openRef={ingestOpenRef}
            className="sr-only"
          />
        )}
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-20 md:pt-24 pb-16 md:pb-24">
        {/* Dynamic Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          className="relative mb-32"
        >
          {theme === 'dark' && brandTheme.isCustomBg && (
            <div className="absolute -top-40 -left-60 w-[800px] h-[800px] bg-[var(--accent)]/5 rounded-full blur-[160px] opacity-20 pointer-events-none" />
          )}

          <div className="flex flex-col md:flex-row items-start md:items-end justify-between gap-12">
            <div className="space-y-6">
              <MicroTitle className="text-[var(--accent)] tracking-[0.1em] font-bold opacity-60">
                <InlineEditable
                  as="span"
                  value={guideline.identity?.tagline || ''}
                  editable={canEdit && editMode}
                  placeholder="Brand Guidelines"
                  onCommit={(v) =>
                    handleSave({ identity: { ...(guideline.identity || {}), tagline: v } })
                  }
                />
              </MicroTitle>
              <InlineEditable
                as="h1"
                className="text-6xl md:text-8xl font-black font-manrope tracking-tight leading-[0.9]"
                value={guideline.identity?.name || ''}
                editable={canEdit && editMode}
                placeholder="Brand name"
                onCommit={(v) =>
                  handleSave({ identity: { ...(guideline.identity || {}), name: v } })
                }
              />
            </div>
          </div>
        </motion.div>

        {/* Hero sentinel: when it leaves the top, the nav collapses to sidebar. */}
        <div ref={heroSentinelRef} aria-hidden="true" className="h-px w-full" />

        {/* Unified, scroll-aware section nav (top bar ↔ sidebar) */}
        <BrandSectionNav
          tabs={visibleTabs}
          activeTab={activeTab}
          onTabChange={(id) => {
            setActiveTab(id);
            if (navCollapsed) window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          collapsed={navCollapsed}
          searchPlaceholder={t('public.brand.guideline.search_assets_colors_or_spe')}
          sectionsLabel={t('public.brand.guideline.brand_sections')}
        />

        {/* Content router:
            · Preview tab → grouped mock gallery (BrandPreviewGallery)
            · Overview (`all`) in view mode → compact bento snapshot
            · Overview in edit mode + every other tab → BrandReadOnlyView sections
              (kept for inline section editing / focused detail views) */}
        {activeTab === 'preview' ? (
          hasPreviewData && <BrandPreviewGallery tokens={tokens} brandName={brandName} />
        ) : activeTab === 'all' && !(canEdit && editMode) ? (
          <BrandOverviewBento guideline={guideline} tokens={tokens} onOpenTab={setActiveTab} />
        ) : (
          <BrandReadOnlyView
            guideline={guideline}
            sections={visibleSections}
            searchTerm={searchTerm}
            editable={canEdit && editMode}
            onPatch={handleSave}
            renderSectionActions={
              editMode
                ? (section) => (
                    <div className="flex items-center gap-1.5 opacity-0 group-hover/section:opacity-100 transition-opacity">
                      <SectionPresenceDot section={section} />
                      <button
                        type="button"
                        aria-label={`${t('public.brand.guideline.edit_section')}: ${SECTION_LABELS[section]}`}
                        onClick={() => setActiveEditSection(section)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-transparent border border-[var(--brand-text)]/15 text-[var(--brand-text)]/45 text-[10px] font-mono uppercase tracking-widest hover:border-warning/40 hover:text-warning hover:bg-warning/5 transition-colors"
                      >
                        <Pencil size={10} />
                        {SECTION_LABELS[section]}
                      </button>
                    </div>
                  )
                : undefined
            }
          />
        )}

        {/* Dynamic Footer */}
        <footer className="mt-40 pt-20 border-t border-[var(--brand-text)]/10 text-center space-y-8">
          <div className="flex justify-center gap-12">
            <div className="text-left space-y-2">
              <span className="text-[10px] font-mono opacity-30 uppercase tracking-widest">
                {t('public.brand.guideline.version')}
              </span>
              <p className="text-xs font-bold opacity-40">
                {t('public.brand.guideline.visant_labs')}
              </p>
            </div>
          </div>
        </footer>
      </div>

      {/* Section edit Sheet — renders via portal (outside brand theme vars) */}
      {editMode && (
        <Sheet
          open={activeEditSection !== null}
          onOpenChange={(open) => {
            if (!open) setActiveEditSection(null);
          }}
        >
          <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
            <SheetHeader className="mb-6">
              <SheetTitle className="text-sm font-mono uppercase tracking-widest text-neutral-400">
                {t('public.brand.guideline.editing_section')}
                {activeEditSection && (
                  <span className="text-white ml-2">— {SECTION_LABELS[activeEditSection]}</span>
                )}
              </SheetTitle>
            </SheetHeader>
            {activeEditSection && guideline.id && (
              <React.Suspense
                fallback={
                  <div className="p-6 text-neutral-500 text-sm font-mono">Loading editor...</div>
                }
              >
                <PublicSectionEditSheet
                  section={activeEditSection}
                  guidelineId={guideline.id}
                  initialLogos={guideline.logos}
                  initialMedia={guideline.media}
                />
              </React.Suspense>
            )}
          </SheetContent>
        </Sheet>
      )}

      {/* Advanced editor — full GuidelineDetail in a side panel (shared Sheet) */}
      {canEdit && guideline.id && (
        <Sheet open={advancedEdit} onOpenChange={(open) => setAdvancedEdit(open)}>
          <SheetContent
            side="right"
            className="w-full sm:max-w-3xl lg:max-w-4xl overflow-y-auto z-[1100]"
          >
            <SheetHeader className="mb-6">
              <SheetTitle className="text-sm font-mono uppercase tracking-widest text-neutral-400 flex items-center gap-2">
                <SlidersHorizontal size={14} /> Advanced editor
              </SheetTitle>
            </SheetHeader>
            <React.Suspense
              fallback={
                <div className="p-6 text-neutral-500 text-sm font-mono">Loading editor…</div>
              }
            >
              <GuidelineDetail
                guideline={guideline}
                visibleSections={advancedVisibleSections}
                onHideSection={handleHideSection}
                onOpenWizard={() => navigate(`/brand-guidelines?id=${guideline.id}`)}
              />
            </React.Suspense>
          </SheetContent>
        </Sheet>
      )}

      {/* Owner action dialogs (ported from admin editor) */}
      {/* One stable Suspense boundary while editing — gating it on the OR of the
          modal flags could unmount it mid-toggle and swallow a just-opened modal
          (the "Generate modal sometimes doesn't appear" bug). */}
      {canEdit && (
        <React.Suspense fallback={null}>
          {isAiPopulateOpen && (
            <BrandAiPopulateDialog
              open={isAiPopulateOpen}
              onOpenChange={setIsAiPopulateOpen}
              guideline={guideline}
              onSuccess={fetchGuideline}
            />
          )}
          {isMockupOpen && (
            <BrandMockupDialog
              open={isMockupOpen}
              onOpenChange={setIsMockupOpen}
              guideline={guideline}
            />
          )}
          {isShareOpen && (
            <ShareGuidelineDialog
              isOpen={isShareOpen}
              onClose={() => setIsShareOpen(false)}
              guideline={guideline}
              onUpdate={(g) => setGuideline(g)}
            />
          )}
          {isReviewOpen && guideline.id && (
            <DesignSystemValidation
              guideline={guideline}
              onUpdate={(patch) => handleSave(patch)}
              onComplete={() => setIsReviewOpen(false)}
              onEditSection={() => {
                setIsReviewOpen(false);
                setEditMode(true);
                setAdvancedEdit(true);
              }}
            />
          )}
        </React.Suspense>
      )}
    </div>
  );

  // Wrap in BrandRoomProvider only for owners in edit mode — anonymous visitors never connect
  if (editMode && canEdit && guideline.id) {
    return (
      <BrandRoomProvider guidelineId={guideline.id} guideline={guideline} onSave={handleSave}>
        {pageContent}
      </BrandRoomProvider>
    );
  }

  return pageContent;
};
