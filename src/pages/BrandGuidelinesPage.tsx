import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
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
import { Palette, Layers, AlignLeft, Share2, Eye, Sparkles, Plus, Command } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { GridDotsBackground } from '@/components/ui/GridDotsBackground';
import { PremiumButton } from '@/components/ui/PremiumButton';
import type { BrandGuideline } from '@/lib/figma-types';

const EmptyState = ({ onCreate }: { onCreate: () => void }) => {
    const { t } = useTranslation();
    return (
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full relative overflow-hidden rounded-3xl border border-white/5 bg-neutral-900/10 backdrop-blur-xl p-12 lg:p-24 flex flex-col items-center justify-center text-center gap-12"
        >
            <GridDotsBackground opacity={0.15} spacing={25} dotSize={1.2} />
            
            <div className="relative z-10">
                <motion.div
                    animate={{ 
                        scale: [1, 1.05, 1],
                        rotate: [0, 2, -2, 0]
                    }}
                    transition={{ 
                        duration: 8,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="relative mb-10"
                >
                    <div className="absolute inset-0 blur-3xl bg-brand-cyan/15 rounded-full scale-150" />
                    <div className="relative p-10 rounded-3xl bg-neutral-950/40 border border-white/10 shadow-2xl backdrop-blur-md">
                        <Palette size={56} className="text-brand-cyan" strokeWidth={1.5} />
                        <motion.div 
                            animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.1, 1] }}
                            transition={{ duration: 4, repeat: Infinity }}
                            className="absolute -inset-2 border border-brand-cyan/20 rounded-[inherit]"
                        />
                    </div>
                    
                    <motion.div 
                        animate={{ 
                            y: [0, -4, 0],
                            opacity: [0.5, 1, 0.5]
                        }}
                        transition={{ duration: 3, repeat: Infinity }}
                        className="absolute -top-4 -right-4 p-2 rounded-full bg-neutral-950 border border-brand-cyan/30 text-brand-cyan shadow-lg shadow-brand-cyan/10"
                    >
                        <Sparkles size={16} />
                    </motion.div>
                </motion.div>

                <div className="space-y-4 max-w-lg mx-auto">
                    <h2 className="text-2xl lg:text-3xl font-bold text-white tracking-tight uppercase font-mono">
                        {t('brandGuidelines.emptyState')}
                    </h2>
                    <p className="text-neutral-500 font-mono text-[11px] leading-relaxed uppercase tracking-wide opacity-80">
                        Authorize the identity vault protocol. Initialize your first brand ecosystem to start orchestration.
                    </p>
                </div>
            </div>

            <div className="relative z-10 w-full max-w-xs">
                <PremiumButton onClick={onCreate} className="h-14 shadow-[0_20px_50px_rgba(var(--brand-cyan-rgb),0.2)] hover:shadow-[0_20px_60px_rgba(var(--brand-cyan-rgb),0.3)] transition-all">
                    <span className="flex items-center gap-2">
                        <Plus size={18} />
                        {t('brandGuidelines.createFirst')}
                    </span>
                </PremiumButton>
            </div>

            {/* Decorative data points */}
            <div className="absolute bottom-8 left-8 flex flex-col gap-1 opacity-20 hidden lg:flex text-left">
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan animate-pulse" />
                    <span className="text-[9px] font-mono text-white uppercase tracking-widest leading-none">Status: Ready</span>
                </div>
                <span className="text-[8px] font-mono text-neutral-500 uppercase tracking-widest pl-3.5">Vault capacity: 100% available</span>
            </div>
            
            <div className="absolute top-8 right-8 opacity-20 hidden lg:block text-right">
                <span className="text-[9px] font-mono text-white uppercase tracking-widest flex items-center gap-2">
                    Orchestrator v2.4.0 <Command size={10} />
                </span>
            </div>
        </motion.div>
    );
};

const NoSelectionState = () => {
    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full min-h-[500px] flex flex-col items-center justify-center text-center gap-10 border border-white/5 rounded-3xl bg-neutral-950/10 relative overflow-hidden backdrop-blur-[2px]"
        >
            <GridDotsBackground opacity={0.05} spacing={35} dotSize={1} />
            
            <motion.div
                animate={{ 
                    y: [0, -8, 0],
                    opacity: [0.4, 0.7, 0.4]
                }}
                transition={{ 
                    duration: 5,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="relative"
            >
                <div className="absolute inset-0 blur-2xl bg-brand-cyan/10 rounded-full scale-150" />
                <Layers size={72} strokeWidth={0.5} className="text-brand-cyan relative" />
                
                {/* Orbital dots */}
                <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute -inset-12 border border-dashed border-white/5 rounded-full pointer-events-none"
                />
            </motion.div>

            <div className="space-y-3 relative z-10">
                <MicroTitle className="text-brand-cyan/40 uppercase tracking-[0.3em] text-[10px]">Awaiting Instructions</MicroTitle>
                <p className="text-neutral-500 font-mono text-[10px] max-w-xs mx-auto leading-relaxed uppercase tracking-wider opacity-60">
                    Select a brand identity from the vault sidebar to load parameters into the orchestrator workspace.
                </p>
            </div>

            {/* Scanning light line */}
            <motion.div 
                animate={{ y: [0, 480, 0] }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-brand-cyan/10 to-transparent opacity-30"
            />
            
            {/* Corners */}
            <div className="absolute top-6 left-6 w-4 h-4 border-t border-l border-white/10" />
            <div className="absolute top-6 right-6 w-4 h-4 border-t border-r border-white/10" />
            <div className="absolute bottom-6 left-6 w-4 h-4 border-b border-l border-white/10" />
            <div className="absolute bottom-6 right-6 w-4 h-4 border-b border-r border-white/10" />
        </motion.div>
    );
};


export const BrandGuidelinesPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isAuthenticated } = useLayout();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [editingGuideline, setEditingGuideline] = useState<BrandGuideline | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [isShareOpen, setIsShareOpen] = useState(false);
    const updateMutation = useUpdateGuideline();

    // Section visibility
    const [activeSections, setActiveSections] = useState<string[]>([
        'identity', 'logos', 'colors', 'typography',
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
            const sections = ['identity', 'logos', 'colors', 'typography'];
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

    // Auto-select first guideline
    React.useEffect(() => {
        if (!selectedId && guidelines.length > 0) {
            handleSelect(guidelines[0]);
        }
    }, [guidelines, selectedId, handleSelect]);

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
        <div className="brand-guidelines-root">
            <SEO
                title={t('brandGuidelines.seoTitle')}
                description={t('brandGuidelines.seoDescription')}
            />
            <div className="fixed inset-0 z-0 bg-neutral-950" />

            <div className="min-h-screen bg-transparent relative z-10 flex">
                {/* Desktop Sidebar */}
                {!isLoading && guidelines.length > 0 && (
                    <aside className="hidden lg:flex flex-col fixed top-10 md:top-14 left-0 bottom-0 w-[260px] xl:w-[280px] border-r border-white/5 bg-neutral-950/80 backdrop-blur-xl z-30">
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
                <main className={cn(
                    "flex-1 w-full min-h-screen transition-all duration-300",
                    !isLoading && guidelines.length > 0 ? "lg:ml-[260px] xl:ml-[280px]" : ""
                )}>
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
                                    <SheetContent side="left" className="w-[85vw] max-w-sm p-0 border-r border-white/5 bg-neutral-950/95 backdrop-blur-xl">
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
                                        className="h-9 px-4 gap-2 text-neutral-400 hover:text-white border border-white/5 hover:border-white/10"
                                    >
                                        <Share2 size={14} />
                                        <span className="hidden sm:inline text-[10px] uppercase font-bold tracking-widest">Share</span>
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    onClick={() => handleOpenWizard()}
                                    className="h-9 px-6 gap-2 bg-brand-cyan/10 border-brand-cyan/20 text-brand-cyan hover:bg-brand-cyan hover:text-black transition-all shadow-[0_0_20px_rgba(var(--brand-cyan-rgb),0.1)]"
                                >
                                    <Plus size={14} />
                                    <span className="text-[10px] uppercase font-bold tracking-widest">New Guideline</span>
                                </Button>
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
                                    <MicroTitle className="text-neutral-700 text-[9px] animate-pulse uppercase">
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
