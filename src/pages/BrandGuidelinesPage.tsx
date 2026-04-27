import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { useBrandGuidelines, useUpdateGuideline } from '@/hooks/queries/useBrandGuidelines';
import { useQueryClient } from '@tanstack/react-query';
import { BrandGuidelineWizardModal } from '@/components/mockupmachine/BrandGuidelineWizardModal';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { SEO } from '@/components/SEO';
import { AuthModal } from '@/components/AuthModal';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { GuidelinesSidebar } from '@/components/brand/guidelines/GuidelinesSidebar';
import { GuidelineDetail } from '@/components/brand/guidelines/GuidelineDetail';
import { BrandRoomProvider } from '@/components/brand/guidelines/BrandCollaborators';
import { DesignSystemValidation } from '@/components/brand/guidelines/DesignSystemValidation';
import { ShareGuidelineDialog } from '@/components/brand/guidelines/ShareGuidelineDialog';
import { BrandIngestButton } from '@/components/brand/guidelines/BrandIngestButton';
import { Palette, Layers, AlignLeft, Share2, Eye, Plus, ClipboardCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { BrandGuideline } from '@/lib/figma-types';
import { SECTION_TABS, SECTION_BY_ID } from '@/components/brand/guidelines/sections-manifest';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const EmptyState = ({ onCreate }: { onCreate: () => void }) => {
    const { t } = useTranslation();
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-900/20 backdrop-blur-sm p-12 lg:p-24 flex flex-col items-center justify-center text-center gap-10"
        >
            <div className="relative z-10">
                <div className="relative mb-8 inline-flex p-8 rounded-3xl bg-neutral-950/50 border border-white/10">
                    <Palette size={48} className="text-neutral-500" strokeWidth={1.2} />
                </div>

                <div className="space-y-3 max-w-md mx-auto">
                    <h2 className="text-xl font-semibold text-neutral-200">
                        {t('brandGuidelines.emptyState')}
                    </h2>
                    <p className="text-neutral-500 text-sm leading-relaxed max-w-xs mx-auto">
                        Crie e organize suas diretrizes de marca em um único lugar centralizado e profissional.
                    </p>
                </div>
            </div>

            <div className="relative z-10">
                <Button onClick={onCreate} variant="outline" className="h-10 px-6 gap-2">
                    <Plus size={16} />
                    {t('brandGuidelines.createFirst')}
                </Button>
            </div>
        </motion.div>
    );
};

const NoSelectionState = () => {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full min-h-[400px] flex flex-col items-center justify-center text-center gap-6 border border-white/10 rounded-3xl bg-neutral-950/20 backdrop-blur-sm"
        >
            <div className="p-6 rounded-full bg-white/5 border border-white/10">
                <Layers size={32} strokeWidth={1} className="text-neutral-500" />
            </div>

            <div className="space-y-2">
                <h3 className="text-neutral-300 font-medium tracking-widest uppercase text-[11px]">Awaiting Selection</h3>
                <p className="text-neutral-500 text-sm max-w-xs mx-auto">
                    Selecione uma marca no menu lateral para visualizar e editar suas diretrizes.
                </p>
            </div>
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
    const [activeTabId, setActiveTabId] = useState(SECTION_TABS[0].id);
    const updateMutation = useUpdateGuideline();
    const queryClient = useQueryClient();

    const tabSections = useMemo(
        () => SECTION_TABS.find(t => t.id === activeTabId)?.sections ?? [],
        [activeTabId]
    );

    // All visible sections across every tab for the selected guideline.
    // Defaults to every known section ID (all on). Persisted in guideline.activeSections.
    const ALL_SECTION_IDS = useMemo(() => SECTION_TABS.flatMap(t => t.sections), []);
    const [allVisibleSections, setAllVisibleSections] = useState<string[]>(ALL_SECTION_IDS);

    // Derived: only sections that are in the current tab AND toggled on
    const visibleSections = useMemo(
        () => tabSections.filter(id => allVisibleSections.includes(id)),
        [tabSections, allVisibleSections]
    );

    const toggleSection = useCallback((sectionId: string) => {
        setAllVisibleSections(prev => {
            const next = prev.includes(sectionId)
                ? prev.filter(s => s !== sectionId)
                : [...prev, sectionId];
            if (selectedId) updateMutation.mutate({ id: selectedId, data: { activeSections: next } });
            return next;
        });
    }, [selectedId, updateMutation]);

    // Auth guard
    React.useEffect(() => {
        if (isAuthenticated === false) setShowAuthModal(true);
    }, [isAuthenticated]);

    // Server state via react-query
    const { data: guidelines = [], isLoading } = useBrandGuidelines(isAuthenticated === true);

    const handleSelect = useCallback((g: BrandGuideline) => {
        setSelectedId(g.id!);
        // Restore persisted visibility from DB, or default to all sections visible
        setAllVisibleSections(g.activeSections?.length ? g.activeSections : ALL_SECTION_IDS);
    }, [ALL_SECTION_IDS]);

    // Auto-select from URL param or first guideline
    React.useEffect(() => {
        if (guidelines.length === 0) return;

        // Priority: URL param > current selection > first guideline
        if (urlGuidelineId) {
            const fromUrl = guidelines.find(g => g.id === urlGuidelineId);
            if (fromUrl && selectedId !== urlGuidelineId) {
                handleSelect(fromUrl);
            }
        } else if (!selectedId) {
            handleSelect(guidelines[0]);
        }
    }, [guidelines, selectedId, urlGuidelineId, handleSelect]);

    const selected = useMemo(
        () => guidelines.find((g) => g.id === selectedId),
        [guidelines, selectedId]
    );

    const [reviewGuidelineId, setReviewGuidelineId] = useState<string | null>(null);

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
                        aria-label="Brand Guidelines Selection"
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
                    aria-label="Brand Guideline Content"
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

                        {/* Header: brand name + actions */}
                        <div className="flex items-center justify-between gap-4 mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                                {/* Mobile sidebar trigger */}
                                <div className="lg:hidden">
                                    <Sheet>
                                        <SheetTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500">
                                                <AlignLeft className="h-4 w-4" />
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent side="left" className="w-[85vw] max-w-sm p-0 border-r border-white/10 bg-neutral-950/95 backdrop-blur-xl">
                                            <SheetTitle className="sr-only">Menu</SheetTitle>
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
                                    <h1 className="text-sm font-semibold text-neutral-200 truncate">
                                        {selected ? (selected.identity?.name || selected.name || 'Untitled') : t('brandGuidelines.title')}
                                    </h1>
                                    {selected && (
                                        <p className="text-[10px] text-neutral-600 font-mono mt-0.5">{selected.identity?.tagline || selected.tagline || ''}</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                {selected && (
                                    <BrandIngestButton
                                        guideline={selected}
                                        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['brand-guidelines'] })}
                                    />
                                )}
                                {selected && selected.isPublic && (
                                    <Link to={`/brand/${selected.publicSlug}`}>
                                        <Button variant="ghost" className="h-8 px-3 gap-1.5 text-xs border border-white/10">
                                            <Eye size={13} />
                                            <span className="hidden sm:inline">Ver pública</span>
                                        </Button>
                                    </Link>
                                )}
                                {selected && (
                                    <Button variant="ghost" onClick={() => setIsShareOpen(true)} className="h-8 px-3 gap-1.5 text-xs border border-white/10">
                                        <Share2 size={13} />
                                        <span className="hidden sm:inline">Share</span>
                                    </Button>
                                )}
                            </div>
                        </div>

                        {/* Tab bar */}
                        {selected && (
                            <div className="flex items-center border-b border-white/[0.06] mb-6 overflow-x-auto">
                                {SECTION_TABS.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTabId(tab.id)}
                                        className={cn(
                                            'px-4 py-2 text-xs font-mono whitespace-nowrap transition-all border-b-2 -mb-px',
                                            activeTabId === tab.id
                                                ? 'text-neutral-200 border-neutral-400'
                                                : 'text-neutral-600 border-transparent hover:text-neutral-400 hover:border-white/10'
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                                {/* Section toggle menu */}
                                {tabSections.length > 0 && (
                                    <div className="ml-auto pl-2 shrink-0">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="flex items-center gap-1 px-2 py-1 text-neutral-700 hover:text-neutral-400 transition-colors mb-[2px]" aria-label="Toggle sections">
                                                    <Plus size={13} />
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
                                    <MicroTitle className="text-white/40 text-[11px] font-mono animate-pulse uppercase tracking-[0.1em]">
                                        Synchronizing Workspace
                                    </MicroTitle>
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
                                        <div className="w-full">
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
                                                />
                                            ) : (
                                                <>
                                                    {/* Review trigger button */}
                                                    {selected.validation && Object.values(selected.validation).some(v => v !== 'approved') && (
                                                        <button
                                                            onClick={() => setReviewGuidelineId(selected.id!)}
                                                            className="mb-6 w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
                                                        >
                                                            <ClipboardCheck size={16} className="text-neutral-500 group-hover:text-neutral-300 shrink-0 transition-colors" />
                                                            <div className="flex-1 text-left">
                                                                <p className="text-xs font-semibold text-neutral-300">Design System Review pending</p>
                                                                <p className="text-xs text-neutral-500">
                                                                    {Object.values(selected.validation).filter(v => v === 'approved').length}/{Object.keys(selected.validation).length} sections approved
                                                                </p>
                                                            </div>
                                                            <span className="text-xs font-mono text-neutral-600 group-hover:text-neutral-400 transition-colors">Review →</span>
                                                        </button>
                                                    )}
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
                                                </>
                                            )}
                                        </div>
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
        </div>
    );
};
