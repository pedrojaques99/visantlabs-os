import React, { useState, useMemo, useCallback, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { useBrandGuidelines, useUpdateGuideline } from '@/hooks/queries/useBrandGuidelines';
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
import { Palette, Layers, AlignLeft, Share2, Eye, Plus, ClipboardCheck, Zap, Figma, Copy, Check, Image, MoreHorizontal, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { BrandGuideline } from '@/lib/figma-types';
import { SECTION_TABS, SECTION_BY_ID } from '@/components/brand/guidelines/sections-manifest';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { copyToClipboard } from '@/utils/clipboard';

const EmptyState = ({ onCreate }: { onCreate: () => void }) => {
    const { t } = useTranslation();
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full flex flex-col items-center justify-center text-center py-24 gap-8"
        >
            <Palette size={36} className="text-neutral-700" strokeWidth={1} />

            <div className="space-y-2 max-w-sm mx-auto">
                <h2 className="text-lg font-medium text-neutral-300">
                    {t('brandGuidelines.emptyState')}
                </h2>
                <p className="text-neutral-600 text-sm leading-relaxed">
                    Crie e organize suas diretrizes de marca em um único lugar.
                </p>
            </div>

            <Button onClick={onCreate} variant="outline" className="h-9 px-5 gap-2 text-sm">
                <Plus size={15} />
                {t('brandGuidelines.createFirst')}
            </Button>
        </motion.div>
    );
};

const NoSelectionState = () => {
    const { t } = useTranslation();
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full min-h-[360px] flex flex-col items-center justify-center text-center gap-5"
        >
            <Layers size={28} strokeWidth={1} className="text-neutral-700" />
            <p className="text-neutral-600 text-sm max-w-xs mx-auto">
                {t('brand.guidelines.awaiting_selection')}
            </p>
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

    const selected = useMemo(
        () => guidelines.find((g) => g.id === selectedId),
        [guidelines, selectedId]
    );

    const tabSections = useMemo(
        () => SECTION_TABS.find(t => t.id === activeTabId)?.sections ?? [],
        [activeTabId]
    );

    // All visible sections across every tab for the selected guideline.
    // Defaults to every known section ID (all on). Persisted in guideline.activeSections.
    const ALL_SECTION_IDS = useMemo(() => SECTION_TABS.flatMap(t => t.sections), []);

    // Derived: only sections that are in the current tab AND toggled on
    const visibleSections = useMemo(() => {
        const activeSections = (selected?.activeSections as string[])?.length
            ? (selected?.activeSections as string[])
            : ALL_SECTION_IDS;
        return tabSections.filter(id => activeSections.includes(id));
    }, [tabSections, selected, ALL_SECTION_IDS]);

    const toggleSection = useCallback((sectionId: string) => {
        if (!selectedId || !selected) return;

        const currentActive = (selected.activeSections as string[])?.length
            ? (selected.activeSections as string[])
            : ALL_SECTION_IDS;

        const next = currentActive.includes(sectionId)
            ? currentActive.filter(s => s !== sectionId)
            : [...currentActive, sectionId];

        updateMutation.mutate({ id: selectedId, data: { activeSections: next } });
    }, [selectedId, selected, ALL_SECTION_IDS, updateMutation]);

    // Auth guard
    React.useEffect(() => {
        if (isAuthenticated === false) setShowAuthModal(true);
    }, [isAuthenticated]);

    const handleSelect = useCallback((g: BrandGuideline) => {
        setSelectedId(g.id!);
    }, []);

    const [reviewGuidelineId, setReviewGuidelineId] = useState<string | null>(null);
    const ingestTriggerRef = useRef<((files: FileList) => void) | null>(null);

    const handleWizardSuccess = useCallback((id: string) => {
        setIsWizardOpen(false);
        setEditingGuideline(null);
        setSelectedId(id);
        // Auto-open review after new brand creation (not edit)
        if (!editingGuideline) setReviewGuidelineId(id);
    }, [editingGuideline]);

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
                        "flex-1 w-full min-h-screen transition-all duration-300",
                        !isLoading && guidelines.length > 0 ? "lg:ml-[260px] xl:ml-[280px]" : ""
                    )}
                    data-vsn-region="content"
                >
                    <div className={cn(
                        "mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16",
                        !isLoading && guidelines.length > 0 ? "max-w-5xl" : "max-w-7xl"
                    )}>

                        {/* Header */}
                        <div className="flex items-center justify-between gap-4 mb-6">
                            <div className="flex items-center gap-3 min-w-0">
                                {/* Mobile sidebar trigger */}
                                <div className="lg:hidden">
                                    <Sheet>
                                        <SheetTrigger asChild>
                                            <Button variant="ghost" size="icon-md" aria-label={t('brand.guidelines.open_menu')}>
                                                <AlignLeft className="h-4 w-4" />
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent side="left" className="w-[85vw] max-w-sm p-0 border-r border-white/10 bg-neutral-950/95 backdrop-blur-xl">
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
                                        {selected ? (selected.identity?.name || selected.name || 'Untitled') : t('brandGuidelines.title')}
                                    </h1>
                                    {selected?.identity?.tagline && (
                                        <p className="text-xs text-neutral-500 mt-0.5 truncate">{selected.identity.tagline}</p>
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
                                                {figmaCopied ? <Check size={13} className="text-green-400" /> : <Figma size={13} />}
                                                {figmaCopied ? 'Copied!' : 'Use in Figma'}
                                            </Button>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                    <BrandIngestButton
                                        guideline={selected}
                                        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['brand-guidelines'] })}
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
                                                <button className="flex items-center px-2 py-1.5 text-neutral-700 hover:text-neutral-400 transition-colors" aria-label={t('brand.guidelines.toggle_sections')}>
                                                    <SlidersHorizontal size={13} />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="min-w-[160px]">
                                                {tabSections.map(id => {
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
                                    <p className="text-neutral-600 text-xs animate-pulse">
                                        Loading...
                                    </p>
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
                                                    onUpdate={(patch) => updateMutation.mutate({ id: selected.id!, data: patch })}
                                                    onComplete={() => setReviewGuidelineId(null)}
                                                    onEditSection={(sectionId) => {
                                                        setReviewGuidelineId(null);
                                                        const tab = SECTION_TABS.find(t => t.sections.includes(sectionId));
                                                        if (tab) setActiveTabId(tab.id);
                                                    }}
                                                    onExtractFiles={(files) => ingestTriggerRef.current?.(files)}
                                                />
                                            ) : (
                                                <ErrorBoundary>
                                                    {/* Review trigger button */}
                                                    {selected.validation && Object.values(selected.validation).some(v => v !== 'approved') && (
                                                        <GlassPanel
                                                            intensity="subtle"
                                                            asChild
                                                        >
                                                            <button
                                                                onClick={() => setReviewGuidelineId(selected.id!)}
                                                                className="mb-8 w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/[0.04] transition-all group"
                                                            >
                                                                <ClipboardCheck size={15} className="text-neutral-600 group-hover:text-neutral-400 shrink-0 transition-colors" />
                                                                <p className="flex-1 text-left text-xs text-neutral-500 group-hover:text-neutral-400 transition-colors">
                                                                    {Object.values(selected.validation).filter(v => v === 'approved').length} of {Object.keys(selected.validation).length} sections reviewed
                                                                </p>
                                                                <span className="text-[11px] text-neutral-600 group-hover:text-neutral-400 transition-colors">{t('brand.guidelines.review')}</span>
                                                            </button>
                                                        </GlassPanel>
                                                    )}
                                                    {activeTabId === 'overview' ? (
                                                        <BrandOverview guideline={selected} />
                                                    ) : (
                                                        <BrandRoomProvider
                                                            guideline={selected}
                                                            guidelineId={selected.id!}
                                                            onSave={(patch) => updateMutation.mutate({ id: selected.id!, data: patch })}
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
                                        <NoSelectionState />
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
                onClose={() => { setShowAuthModal(false); navigate('/'); }}
                onSuccess={() => { setShowAuthModal(false); }}
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
