import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import {
  useBrandGuidelines,
  useBrandGuideline,
  useUpdateGuideline,
} from '@/hooks/queries/useBrandGuidelines';
import { useQueryClient } from '@tanstack/react-query';
import { BrandGuidelineWizardModal } from '@/components/mockupmachine/BrandGuidelineWizardModal';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SEO } from '@/components/SEO';
import { AuthModal } from '@/components/AuthModal';
import { Button } from '@/components/ui/button';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { GuidelinesSidebar } from '@/components/brand/guidelines/GuidelinesSidebar';
import { GuidelineDetail } from '@/components/brand/guidelines/GuidelineDetail';
import { BrandOverview } from '@/components/brand/guidelines/BrandOverview';
import { BrandRoomProvider } from '@/components/brand/guidelines/BrandCollaborators';
import { DesignSystemValidation } from '@/components/brand/guidelines/DesignSystemValidation';
import { ShareGuidelineDialog } from '@/components/brand/guidelines/ShareGuidelineDialog';
import { BrandIngestButton } from '@/components/brand/guidelines/BrandIngestButton';
import { BrandCompletenessPill } from '@/components/brand/guidelines/BrandCompletenessPill';
import { BrandAiPopulateDialog } from '@/components/brand/guidelines/BrandAiPopulateDialog';
import { BrandMockupDialog } from '@/components/brand/guidelines/BrandMockupDialog';
import { BrandAvatar } from '@/components/brand/BrandAvatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { Input } from '@/components/ui/input';
import { getProxiedUrl } from '@/utils/proxyUtils';
import { computeBrandCompleteness, completenessStatus } from '@/lib/brandCompleteness';
import {
  Palette,
  Layers,
  AlignLeft,
  Share2,
  Eye,
  Plus,
  ClipboardCheck,
  Zap,
  Figma,
  Copy,
  Check,
  Image,
  MoreHorizontal,
  SlidersHorizontal,
  Search,
  Globe,
  Folder,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { BrandGuideline } from '@/lib/figma-types';
import { SECTION_TABS, SECTION_BY_ID } from '@/components/brand/guidelines/sections-manifest';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { copyToClipboard } from '@/utils/clipboard';

const EmptyState = ({ onCreate }: { onCreate: () => void }) => {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full min-h-[70vh] flex flex-col items-center justify-center text-center gap-6 px-6"
    >
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
        <Layers size={26} strokeWidth={1.2} className="text-neutral-500" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-xl font-semibold text-neutral-200 tracking-tight">
          {t('brandGuidelines.emptyState')}
        </h2>
        <p className="text-neutral-500 text-sm leading-relaxed">
          {t('brandGuidelines.emptyStateDesc')}
        </p>
      </div>
      <Button onClick={onCreate} size="lg" className="h-11 px-6 gap-2 text-sm">
        <Plus size={15} />
        {t('brandGuidelines.createFirst')}
      </Button>
    </motion.div>
  );
};

const getCoverUrl = (g: BrandGuideline): string | null => {
  const bg = g.media?.find((m) => m.type === 'image' && m.category === 'background');
  if (bg) return bg.url;
  const firstImg = g.media?.find((m) => m.type === 'image');
  if (firstImg) return firstImg.url;
  const primaryLogo = g.logos?.find((l) => l?.variant === 'primary' || l?.variant === 'dark');
  if (primaryLogo) return primaryLogo.url;
  return null;
};

const CoverFallback = ({ colors }: { colors?: BrandGuideline['colors'] }) => {
  const c1 = colors?.[0]?.hex || '#262626';
  const c2 = colors?.[1]?.hex || '#171717';
  const c3 = colors?.[2]?.hex || c1;
  return (
    <div
      className="absolute inset-0"
      style={{ background: `linear-gradient(135deg, ${c1} 0%, ${c2} 50%, ${c3} 100%)` }}
    >
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23fff' fill-opacity='1'%3E%3Cpath d='M0 0h20v20H0zM20 20h20v20H20z'/%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
};

const SCORE_COLORS = {
  low: 'bg-red-500',
  medium: 'bg-amber-400',
  high: 'bg-green-500',
} as const;

const BrandCard = ({
  guideline,
  onSelect,
  index,
}: {
  guideline: BrandGuideline;
  onSelect: (g: BrandGuideline) => void;
  index: number;
}) => {
  const [coverLoaded, setCoverLoaded] = useState(false);
  const coverUrl = getCoverUrl(guideline);
  const report = useMemo(() => computeBrandCompleteness(guideline), [guideline]);
  const status = completenessStatus(report.score);
  const primaryFont = guideline.typography?.find(
    (t) => t.role === 'heading' || t.role === 'headline'
  )?.family;
  const bodyFont = guideline.typography?.find(
    (t) => t.role === 'body' || t.role === 'paragraph'
  )?.family;
  const fontHint = [primaryFont, bodyFont].filter(Boolean).join(' / ');

  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.25 }}
      whileHover={{ y: -3 }}
      onClick={() => onSelect(guideline)}
      className="group relative flex flex-col sm:flex-col rounded-xl border border-white/[0.06] bg-neutral-900 hover:border-white/[0.14] hover:shadow-lg hover:shadow-black/20 transition-all duration-200 overflow-hidden text-left cursor-pointer"
    >
      {/* Cover */}
      <div className="relative w-full sm:w-full h-20 sm:h-24 shrink-0 overflow-hidden bg-neutral-800">
        {coverUrl && !coverLoaded && (
          <div className="absolute inset-0 animate-pulse bg-neutral-800" />
        )}
        {coverUrl ? (
          <img
            src={getProxiedUrl(coverUrl)}
            alt=""
            loading="lazy"
            onLoad={() => setCoverLoaded(true)}
            className={cn(
              'w-full h-full object-cover group-hover:scale-105 transition-all duration-500',
              coverLoaded ? 'opacity-80 group-hover:opacity-100' : 'opacity-0'
            )}
          />
        ) : (
          <CoverFallback colors={guideline.colors} />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-neutral-900/20 to-transparent" />

        {/* Badges overlay */}
        <div className="absolute top-2 right-2 flex items-center gap-1.5">
          {guideline.isPublic && (
            <Badge
              variant="secondary"
              className="bg-white/10 backdrop-blur-sm border-white/10 text-white/80 text-[10px] px-1.5 py-0 h-5 gap-1"
            >
              <Globe size={9} />
              Public
            </Badge>
          )}
          {guideline.folder && (
            <Badge
              variant="secondary"
              className="bg-white/10 backdrop-blur-sm border-white/10 text-white/70 text-[10px] px-1.5 py-0 h-5 gap-1"
            >
              <Folder size={9} />
              {guideline.folder}
            </Badge>
          )}
        </div>
      </div>

      {/* Avatar */}
      <div className="relative px-3 sm:px-4 -mt-5">
        <div className="ring-2 ring-neutral-900 rounded-lg">
          <BrandAvatar brand={guideline} size={40} rounded="md" preference="primary" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 px-3 sm:px-4 pt-2 pb-3 min-w-0 flex flex-col gap-1.5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-200 truncate group-hover:text-white transition-colors">
            {guideline.identity?.name || guideline.name || 'Untitled'}
          </p>
          {guideline.identity?.tagline && (
            <p className="text-[11px] text-neutral-600 truncate mt-0.5 leading-tight">
              {guideline.identity.tagline}
            </p>
          )}
        </div>

        {/* Footer: completeness + font hint */}
        <div className="flex items-center justify-between gap-2 mt-auto pt-1 border-t border-white/[0.04]">
          <Tooltip
            content={`${report.score}% complete — ${report.missing.length} items missing`}
            position="bottom"
          >
            <div className="flex items-center gap-1.5">
              <div className="w-16 h-1 rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', SCORE_COLORS[status])}
                  style={{ width: `${report.score}%` }}
                />
              </div>
              <span className="text-[10px] text-neutral-600 tabular-nums">{report.score}%</span>
            </div>
          </Tooltip>
          {fontHint && (
            <p className="text-[10px] text-neutral-700 truncate max-w-[50%]">{fontHint}</p>
          )}
        </div>
      </div>
    </motion.button>
  );
};

type SortMode = 'recent' | 'name' | 'completeness';

const BrandGrid = ({
  guidelines,
  onSelect,
}: {
  guidelines: BrandGuideline[];
  onSelect: (g: BrandGuideline) => void;
}) => {
  const [search, setSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>('recent');

  const folders = useMemo(() => {
    const s = new Set<string>();
    guidelines.forEach((g) => {
      if (g.folder) s.add(g.folder);
    });
    return Array.from(s).sort();
  }, [guidelines]);

  const filtered = useMemo(() => {
    let list = guidelines;
    if (folderFilter) list = list.filter((g) => g.folder === folderFilter);
    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter((g) => {
        const name = (g.identity?.name || g.name || '').toLowerCase();
        const folder = (g.folder || '').toLowerCase();
        const tagline = (g.identity?.tagline || '').toLowerCase();
        return name.includes(term) || folder.includes(term) || tagline.includes(term);
      });
    }
    if (sort === 'name') {
      list = [...list].sort((a, b) =>
        (a.identity?.name || a.name || '').localeCompare(b.identity?.name || b.name || '')
      );
    } else if (sort === 'completeness') {
      list = [...list].sort(
        (a, b) => computeBrandCompleteness(b).score - computeBrandCompleteness(a).score
      );
    }
    return list;
  }, [guidelines, search, folderFilter, sort]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full space-y-4">
      {/* Toolbar: search + folder pills + sort */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative w-full sm:w-56">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search brands..."
            className="h-8 pl-8 text-xs bg-white/[0.03] border-white/[0.06]"
          />
        </div>

        {folders.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setFolderFilter(null)}
              className={cn(
                'shrink-0 px-2.5 py-1 rounded-md text-[11px] border transition-colors',
                !folderFilter
                  ? 'bg-white/[0.08] border-white/[0.12] text-neutral-300'
                  : 'border-transparent text-neutral-600 hover:text-neutral-400'
              )}
            >
              All
            </button>
            {folders.map((f) => (
              <button
                key={f}
                onClick={() => setFolderFilter(folderFilter === f ? null : f)}
                className={cn(
                  'shrink-0 px-2.5 py-1 rounded-md text-[11px] border transition-colors flex items-center gap-1',
                  folderFilter === f
                    ? 'bg-white/[0.08] border-white/[0.12] text-neutral-300'
                    : 'border-transparent text-neutral-600 hover:text-neutral-400'
                )}
              >
                <Folder size={10} />
                {f}
              </button>
            ))}
          </div>
        )}

        <div className="sm:ml-auto shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] text-neutral-600 hover:text-neutral-400 border border-transparent hover:border-white/[0.06] transition-colors">
                <ArrowUpDown size={11} />
                {sort === 'recent' ? 'Recent' : sort === 'name' ? 'Name' : 'Completeness'}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[130px]">
              <DropdownMenuCheckboxItem
                className="text-xs"
                checked={sort === 'recent'}
                onCheckedChange={() => setSort('recent')}
              >
                Recent
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                className="text-xs"
                checked={sort === 'name'}
                onCheckedChange={() => setSort('name')}
              >
                Name
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                className="text-xs"
                checked={sort === 'completeness'}
                onCheckedChange={() => setSort('completeness')}
              >
                Completeness
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Count */}
      <p className="text-[11px] text-neutral-700">
        {filtered.length} of {guidelines.length} design system{guidelines.length !== 1 ? 's' : ''}
      </p>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {filtered.map((g, i) => (
          <BrandCard key={g.id} guideline={g} onSelect={onSelect} index={i} />
        ))}
      </div>

      {filtered.length === 0 && search.trim() && (
        <div className="flex flex-col items-center py-12 gap-3">
          <Search size={20} className="text-neutral-700" />
          <p className="text-xs text-neutral-600">No brands match "{search}"</p>
        </div>
      )}
    </motion.div>
  );
};

export const BrandGuidelinesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useLayout();

  const urlGuidelineId = searchParams.get('id');
  const [selectedId, setSelectedId] = useState<string | null>(urlGuidelineId);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingGuideline, setEditingGuideline] = useState<BrandGuideline | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [figmaCopied, setFigmaCopied] = useState(false);
  const [activeTabId, setActiveTabId] = useState(SECTION_TABS[0].id);
  const [isAiPopulateOpen, setIsAiPopulateOpen] = useState(false);
  const [isMockupOpen, setIsMockupOpen] = useState(false);
  const updateMutation = useUpdateGuideline();
  const queryClient = useQueryClient();

  // Server state via react-query
  const { data: guidelines = [], isLoading } = useBrandGuidelines(isAuthenticated === true);
  const { data: selected } = useBrandGuideline(selectedId);

  const tabSections = useMemo(
    () => SECTION_TABS.find((t) => t.id === activeTabId)?.sections ?? [],
    [activeTabId]
  );

  // All visible sections across every tab for the selected guideline.
  // Defaults to every known section ID (all on). Persisted in guideline.activeSections.
  const ALL_SECTION_IDS = useMemo(() => SECTION_TABS.flatMap((t) => t.sections), []);

  // Derived: only sections that are in the current tab AND toggled on
  const visibleSections = useMemo(() => {
    const activeSections = (selected?.activeSections as string[])?.length
      ? (selected?.activeSections as string[])
      : ALL_SECTION_IDS;
    return tabSections.filter((id) => activeSections.includes(id));
  }, [tabSections, selected, ALL_SECTION_IDS]);

  const toggleSection = useCallback(
    (sectionId: string) => {
      if (!selectedId || !selected) return;

      const currentActive = (selected.activeSections as string[])?.length
        ? (selected.activeSections as string[])
        : ALL_SECTION_IDS;

      const next = currentActive.includes(sectionId)
        ? currentActive.filter((s) => s !== sectionId)
        : [...currentActive, sectionId];

      updateMutation.mutate({ id: selectedId, data: { activeSections: next } });
    },
    [selectedId, selected, ALL_SECTION_IDS, updateMutation]
  );

  // Auth guard
  React.useEffect(() => {
    if (isAuthenticated === false) setShowAuthModal(true);
  }, [isAuthenticated]);

  const handleSelect = useCallback((g: BrandGuideline) => {
    setSelectedId(g.id!);
  }, []);

  const [reviewGuidelineId, setReviewGuidelineId] = useState<string | null>(null);
  const ingestTriggerRef = useRef<((files: FileList) => void) | null>(null);

  const handleWizardSuccess = useCallback(
    (id: string) => {
      setIsWizardOpen(false);
      setEditingGuideline(null);
      setSelectedId(id);
      // Auto-open review after new brand creation (not edit)
      if (!editingGuideline) setReviewGuidelineId(id);
    },
    [editingGuideline]
  );

  const handleOpenWizard = useCallback((guideline?: BrandGuideline | null) => {
    setEditingGuideline(guideline || null);
    setIsWizardOpen(true);
  }, []);

  const handleCloseWizard = useCallback(() => {
    setIsWizardOpen(false);
    setEditingGuideline(null);
  }, []);

  return (
    <div
      className="brand-guidelines-root"
      data-vsn-page="brand-guidelines"
      data-vsn-component="brand-explorer"
      data-vsn-selected-id={selectedId}
    >
      <SEO
        title={t('brandGuidelines.seoTitle')}
        description={t('brandGuidelines.seoDescription')}
      />
      <div className="fixed inset-0 z-0 bg-neutral-950" />

      <div className="min-h-screen bg-transparent relative z-10 flex">
        {/* Desktop Sidebar */}
        {!isLoading && guidelines.length > 0 && (
          <aside
            role="navigation"
            aria-label={t('brand.guidelines.brand_guidelines_selection')}
            className="hidden lg:flex flex-col fixed top-10 md:top-14 left-0 bottom-0 w-[260px] xl:w-[280px] border-r border-white/10 bg-neutral-950/80 backdrop-blur-xl z-30"
            data-vsn-region="sidebar"
          >
            <GuidelinesSidebar
              guidelines={guidelines}
              selectedId={selectedId}
              onSelect={handleSelect}
              onCreate={() => handleOpenWizard()}
            />
          </aside>
        )}

        {/* Main Content Area */}
        <main
          role="main"
          aria-label={t('brand.guidelines.brand_guideline_content')}
          className={cn(
            'flex-1 w-full min-h-screen transition-all duration-300',
            !isLoading && guidelines.length > 0 ? 'lg:ml-[260px] xl:ml-[280px]' : ''
          )}
          data-vsn-region="content"
        >
          <div
            className={cn(
              'mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16',
              !isLoading && guidelines.length > 0 ? 'max-w-5xl' : 'max-w-7xl'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-4 mb-6">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile sidebar trigger */}
                <div className="lg:hidden">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-md"
                        aria-label={t('brand.guidelines.open_menu')}
                      >
                        <AlignLeft className="h-4 w-4" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent
                      side="left"
                      className="w-[85vw] max-w-sm p-0 border-r border-white/10 bg-neutral-950/95 backdrop-blur-xl"
                    >
                      <SheetTitle className="sr-only">{t('brand.guidelines.menu')}</SheetTitle>
                      <GuidelinesSidebar
                        guidelines={guidelines}
                        selectedId={selectedId}
                        onSelect={handleSelect}
                        onCreate={() => handleOpenWizard()}
                      />
                    </SheetContent>
                  </Sheet>
                </div>
                <div className="min-w-0">
                  <h1 className="text-base font-semibold text-neutral-100 truncate">
                    {selected
                      ? selected.identity?.name || selected.name || 'Untitled'
                      : t('brandGuidelines.title')}
                  </h1>
                  {selected?.identity?.tagline && (
                    <p className="text-xs text-neutral-500 mt-0.5 truncate">
                      {selected.identity.tagline}
                    </p>
                  )}
                </div>
              </div>

              {selected && (
                <div className="flex items-center gap-2 shrink-0">
                  <BrandCompletenessPill guideline={selected} />
                  <Button
                    onClick={() => setIsAiPopulateOpen(true)}
                    variant="subtle"
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Zap size={13} />
                    <span className="hidden sm:inline">Generate</span>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-md">
                        <MoreHorizontal size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[180px]">
                      <Button variant="menuItem" onClick={() => setIsMockupOpen(true)}>
                        <Image size={13} /> Mockup
                      </Button>
                      <Button variant="menuItem" onClick={() => setIsShareOpen(true)}>
                        <Share2 size={13} /> Share
                      </Button>
                      {selected.isPublic && (
                        <Button variant="menuItem" asChild>
                          <Link to={`/brand/${selected.publicSlug}`}>
                            <Eye size={13} /> View Public
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="menuItem"
                        onClick={() => {
                          copyToClipboard(selected.id!);
                          setFigmaCopied(true);
                          setTimeout(() => setFigmaCopied(false), 2000);
                        }}
                      >
                        {figmaCopied ? (
                          <Check size={13} className="text-green-400" />
                        ) : (
                          <Figma size={13} />
                        )}
                        {figmaCopied ? 'Copied!' : 'Use in Figma'}
                      </Button>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <BrandIngestButton
                    guideline={selected}
                    onSuccess={() =>
                      queryClient.invalidateQueries({ queryKey: ['brand-guidelines'] })
                    }
                    triggerRef={ingestTriggerRef}
                  />
                </div>
              )}
            </div>

            {/* Tab bar */}
            {selected && (
              <div className="flex items-center border-b border-white/5 mb-8 overflow-x-auto scrollbar-none">
                {SECTION_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={cn(
                      'px-4 py-2.5 text-xs whitespace-nowrap transition-colors border-b-2 -mb-px',
                      activeTabId === tab.id
                        ? 'text-neutral-200 border-neutral-400'
                        : 'text-neutral-600 border-transparent hover:text-neutral-400'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
                {tabSections.length > 0 && (
                  <div className="ml-auto pl-2 shrink-0">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className="flex items-center px-2 py-1.5 text-neutral-700 hover:text-neutral-400 transition-colors"
                          aria-label={t('brand.guidelines.toggle_sections')}
                        >
                          <SlidersHorizontal size={13} />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-[160px]">
                        {tabSections.map((id) => {
                          const meta = SECTION_BY_ID[id];
                          if (!meta) return null;
                          return (
                            <DropdownMenuCheckboxItem
                              key={id}
                              className="text-xs gap-2"
                              checked={visibleSections.includes(id)}
                              onCheckedChange={() => toggleSection(id)}
                            >
                              {meta.label}
                            </DropdownMenuCheckboxItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div
                  key="loader"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-40 gap-6"
                >
                  <GlitchLoader size={40} />
                  <p className="text-neutral-600 text-xs animate-pulse">Loading...</p>
                </motion.div>
              ) : guidelines.length === 0 ? (
                <EmptyState key="empty" onCreate={() => handleOpenWizard()} />
              ) : (
                <motion.div
                  key="content"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col gap-8 md:gap-16 items-start w-full"
                >
                  {selected ? (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={selected.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="w-full"
                      >
                        {reviewGuidelineId === selected.id ? (
                          <DesignSystemValidation
                            guideline={selected}
                            onUpdate={(patch) =>
                              updateMutation.mutate({ id: selected.id!, data: patch })
                            }
                            onComplete={() => setReviewGuidelineId(null)}
                            onEditSection={(sectionId) => {
                              setReviewGuidelineId(null);
                              const tab = SECTION_TABS.find((t) => t.sections.includes(sectionId));
                              if (tab) setActiveTabId(tab.id);
                            }}
                            onExtractFiles={(files) => ingestTriggerRef.current?.(files)}
                          />
                        ) : (
                          <ErrorBoundary>
                            {/* Review trigger button */}
                            {selected.validation &&
                              Object.values(selected.validation).some((v) => v !== 'approved') && (
                                <GlassPanel intensity="subtle" asChild>
                                  <button
                                    onClick={() => setReviewGuidelineId(selected.id!)}
                                    className="mb-8 w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.04] transition-all group"
                                  >
                                    <ClipboardCheck
                                      size={15}
                                      className="text-neutral-600 group-hover:text-neutral-400 shrink-0 transition-colors"
                                    />
                                    <p className="flex-1 text-left text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors">
                                      {
                                        Object.values(selected.validation).filter(
                                          (v) => v === 'approved'
                                        ).length
                                      }{' '}
                                      of {Object.keys(selected.validation).length} sections reviewed
                                    </p>
                                    <span className="text-[11px] text-neutral-600 group-hover:text-neutral-400 transition-colors">
                                      {t('brand.guidelines.review')}
                                    </span>
                                  </button>
                                </GlassPanel>
                              )}
                            {activeTabId === 'overview' ? (
                              <BrandOverview guideline={selected} />
                            ) : (
                              <BrandRoomProvider
                                guideline={selected}
                                guidelineId={selected.id!}
                                onSave={(patch) =>
                                  updateMutation.mutate({ id: selected.id!, data: patch })
                                }
                              >
                                <GuidelineDetail
                                  guideline={selected}
                                  visibleSections={visibleSections}
                                  onHideSection={toggleSection}
                                  onOpenWizard={() => handleOpenWizard(selected)}
                                  onStartReview={() => setReviewGuidelineId(selected.id!)}
                                />
                              </BrandRoomProvider>
                            )}
                          </ErrorBoundary>
                        )}
                      </motion.div>
                    </AnimatePresence>
                  ) : (
                    <BrandGrid guidelines={guidelines} onSelect={handleSelect} />
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>
      </div>

      <BrandGuidelineWizardModal
        isOpen={isWizardOpen}
        onClose={handleCloseWizard}
        onSuccess={handleWizardSuccess}
        editGuideline={editingGuideline}
      />

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          navigate('/');
        }}
        onSuccess={() => {
          setShowAuthModal(false);
        }}
        isSignUp={false}
      />

      {selected && (
        <ShareGuidelineDialog
          isOpen={isShareOpen}
          onClose={() => setIsShareOpen(false)}
          guideline={selected}
          onUpdate={(updated) => {
            updateMutation.mutate({ id: updated.id!, data: updated });
          }}
        />
      )}

      {selected && (
        <BrandAiPopulateDialog
          open={isAiPopulateOpen}
          onOpenChange={setIsAiPopulateOpen}
          guideline={selected}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['brand-guidelines'] })}
        />
      )}

      {selected && (
        <BrandMockupDialog
          open={isMockupOpen}
          onOpenChange={setIsMockupOpen}
          guideline={selected}
        />
      )}
    </div>
  );
};
