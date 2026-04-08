import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { useBrandGuidelines, useUpdateGuideline } from '@/hooks/queries/useBrandGuidelines';
import { BrandGuidelineWizardModal } from '@/components/mockupmachine/BrandGuidelineWizardModal';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { SEO } from '@/components/SEO';
import { AuthModal } from '@/components/AuthModal';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { Button } from '@/components/ui/button';
import {
    BreadcrumbWithBack,
    BreadcrumbList,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/BreadcrumbWithBack';
import { Sheet, SheetTrigger, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { GuidelinesSidebar } from '@/components/brand/guidelines/GuidelinesSidebar';
import { GuidelineDetail } from '@/components/brand/guidelines/GuidelineDetail';
import { ShareGuidelineDialog } from '@/components/brand/guidelines/ShareGuidelineDialog';
import { Palette, Layers, AlignLeft, Share2, Eye, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { BrandGuideline } from '@/lib/figma-types';

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
                    <Palette size={48} className="text-brand-cyan" strokeWidth={1.2} />
                </div>

                <div className="space-y-4 max-w-md mx-auto">
                    <h2 className="text-2xl lg:text-3xl font-bold text-white tracking-tight">
                        {t('brandGuidelines.emptyState')}
                    </h2>
                    <p className="text-neutral-400 text-sm leading-relaxed max-w-xs mx-auto">
                        Crie e organize suas diretrizes de marca em um único lugar centralizado e profissional.
                    </p>
                </div>
            </div>

            <div className="relative z-10">
                <Button
                    onClick={onCreate}
                    className="h-12 px-8 bg-brand-cyan text-black hover:bg-brand-cyan/90 transition-all font-bold uppercase tracking-wider text-[11px] rounded-full shadow-lg shadow-brand-cyan/10"
                >
                    <Plus size={18} className="mr-2" />
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
    const updateMutation = useUpdateGuideline();

    // Section visibility
    const [activeSections, setActiveSections] = useState<string[]>([
        'identity', 'logos', 'colors', 'typography', 'figma',
    ]);

    // Auth guard
    React.useEffect(() => {
        if (isAuthenticated === false) setShowAuthModal(true);
    }, [isAuthenticated]);

    // Server state via react-query
    const { data: guidelines = [], isLoading } = useBrandGuidelines(isAuthenticated === true);

    const handleSelect = useCallback((g: BrandGuideline) => {
        setSelectedId(g.id!);
        // Restore persisted sections from DB, or auto-detect from data
        if (g.activeSections && g.activeSections.length > 0) {
            setActiveSections(g.activeSections);
        } else {
            const sections = ['identity', 'logos', 'colors', 'typography', 'figma'];
            
            // Special case for "Feira" - enable Media Kit by default
            const isFeira = g.folder?.toLowerCase().includes('feira') || g.name?.toLowerCase().includes('feira');
            if (isFeira) {
                sections.push('media');
            }

            // Add strategy only if it has content
            if (g.strategy?.manifesto || (g.strategy?.archetypes?.length ?? 0) > 0 || (g.strategy?.personas?.length ?? 0) > 0) {
                sections.push('strategy');
            }
            if (g.tags && Object.keys(g.tags).length > 0) sections.push('tags');
            if ((g.media?.length ?? 0) > 0) sections.push('media');
            if (g.tokens && (Object.keys(g.tokens.spacing || {}).length > 0 || Object.keys(g.tokens.radius || {}).length > 0)) sections.push('tokens');
            if (g.guidelines?.voice || (g.guidelines?.dos?.length ?? 0) > 0) sections.push('editorial');
            if (g.guidelines?.accessibility) sections.push('accessibility');
            setActiveSections([...new Set(sections)]);
        }
    }, []);

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

    const handleWizardSuccess = useCallback((id: string) => {
        setIsWizardOpen(false);
        setEditingGuideline(null);
        setSelectedId(id);
    }, []);

    const toggleSection = useCallback((section: string) => {
        setActiveSections((prev) => {
            const next = prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section];
            // Persist to DB
            if (selectedId) {
                updateMutation.mutate({ id: selectedId, data: { activeSections: next } });
            }
            return next;
        });
    }, [selectedId, updateMutation]);

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
                            activeSections={activeSections}
                            onSelect={handleSelect}
                            onCreate={() => handleOpenWizard()}
                            onToggleSection={toggleSection}
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
                        <div className="mb-4">
                            <BreadcrumbWithBack to="/">
                                <BreadcrumbList>
                                    <BreadcrumbItem>
                                        <BreadcrumbLink asChild>
                                            <Link to="/">{t('common.home') || 'Home'}</Link>
                                        </BreadcrumbLink>
                                    </BreadcrumbItem>
                                    <BreadcrumbSeparator />
                                    <BreadcrumbItem>
                                        <BreadcrumbPage>{t('brandGuidelines.title')}</BreadcrumbPage>
                                    </BreadcrumbItem>
                                </BreadcrumbList>
                            </BreadcrumbWithBack>
                        </div>

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                            <div className="sr-only">
                                <h1 className="text-3xl font-bold text-neutral-100 flex items-center gap-3">
                                    <Palette className="text-brand-cyan h-8 w-8 hidden lg:block" />
                                    {t('brandGuidelines.title')}
                                </h1>
                                <p className="text-neutral-500 mt-1">{t('brandGuidelines.subtitle')}</p>
                            </div>

                            <div className="lg:hidden fixed top-[72px] left-4 z-[45]">
                                <Sheet>
                                    <SheetTrigger asChild>
                                        <Button variant="outline" size="icon" className="h-10 w-10 rounded-full bg-neutral-950/80 backdrop-blur-xl border-white/10 text-brand-cyan shadow-2xl hover:scale-110 active:scale-95 transition-all">
                                            <AlignLeft className="h-5 w-5" />
                                        </Button>
                                    </SheetTrigger>
                                    <SheetContent side="left" className="w-[85vw] max-w-sm p-0 border-r border-white/10 bg-neutral-950/95 backdrop-blur-xl">
                                        <SheetTitle className="sr-only">Menu</SheetTitle>
                                        <GuidelinesSidebar
                                            guidelines={guidelines}
                                            selectedId={selectedId}
                                            activeSections={activeSections}
                                            onSelect={handleSelect}
                                            onCreate={() => handleOpenWizard()}
                                            onToggleSection={toggleSection}
                                        />
                                    </SheetContent>
                                </Sheet>
                            </div>

                            <div className="flex items-center gap-2">
                                {selected && selected.isPublic && (
                                    <Link to={`/brand/${selected.publicSlug}`}>
                                        <Button
                                            variant="ghost"
                                            className="h-9 px-4 gap-2 text-brand-cyan hover:text-brand-cyan hover:bg-brand-cyan/5 border border-brand-cyan/10"
                                        >
                                            <Eye size={14} />
                                            <span className="hidden sm:inline text-[10px] uppercase font-bold tracking-widest">Ver Página Pública</span>
                                        </Button>
                                    </Link>
                                )}
                                {selected && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => setIsShareOpen(true)}
                                        className="h-9 px-4 gap-2 text-neutral-400 hover:text-white border border-white/10 hover:border-white/10"
                                    >
                                        <Share2 size={14} />
                                        <span className="hidden sm:inline text-[10px] uppercase font-bold tracking-widest">Share</span>
                                    </Button>
                                )}
                            </div>
                        </div>

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
                                    <MicroTitle className="text-white/40 text-[11px] font-mono animate-pulse uppercase tracking-[0.2em]">
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
                                            <GuidelineDetail
                                                guideline={selected}
                                                activeSections={activeSections}
                                                onOpenWizard={() => handleOpenWizard(selected)}
                                            />
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
