import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { useBrandGuidelines } from '@/hooks/queries/useBrandGuidelines';
import { BrandGuidelineWizardModal } from '@/components/mockupmachine/BrandGuidelineWizardModal';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { SEO } from '@/components/SEO';
import { AuthModal } from '@/components/AuthModal';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { PremiumButton } from '@/components/ui/PremiumButton';
import { Button } from '@/components/ui/button';
import { GridDotsBackground } from '@/components/ui/GridDotsBackground';
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
import { Plus, Palette, Layers, AlignLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import type { BrandGuideline } from '@/lib/figma-types';
import { cn } from '@/lib/utils';

export const BrandGuidelinesPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isAuthenticated } = useLayout();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [editingGuideline, setEditingGuideline] = useState<BrandGuideline | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);

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

    // Auto-select first guideline
    React.useEffect(() => {
        if (!selectedId && guidelines.length > 0) {
            handleSelect(guidelines[0]);
        }
    }, [guidelines]);

    const selected = useMemo(
        () => guidelines.find((g) => g.id === selectedId),
        [guidelines, selectedId]
    );

    const handleSelect = (g: BrandGuideline) => {
        setSelectedId(g.id!);
        // Auto-show sections that have data
        const sections = ['identity', 'logos', 'colors', 'typography'];
        if (g.tags && Object.keys(g.tags).length > 0) sections.push('tags');
        if ((g.media?.length || 0) > 0) sections.push('media');
        if (g.tokens && (Object.keys(g.tokens.spacing || {}).length > 0 || Object.keys(g.tokens.radius || {}).length > 0)) sections.push('tokens');
        if (g.guidelines?.voice || (g.guidelines?.dos?.length || 0) > 0) sections.push('editorial');
        if (g.guidelines?.accessibility) sections.push('accessibility');
        setActiveSections([...new Set(sections)]);
    };

    const handleWizardSuccess = (id: string) => {
        setIsWizardOpen(false);
        setEditingGuideline(null);
        setSelectedId(id);
    };

    const toggleSection = (section: string) => {
        setActiveSections((prev) =>
            prev.includes(section) ? prev.filter((s) => s !== section) : [...prev, section]
        );
    };

    const openWizard = (guideline?: BrandGuideline | null) => {
        setEditingGuideline(guideline || null);
        setIsWizardOpen(true);
    };

    return (
        <div className="brand-guidelines-root">
            <SEO
                title={t('brandGuidelines.seoTitle')}
                description={t('brandGuidelines.seoDescription')}
            />
            <div className="fixed inset-0 z-0">
                <GridDotsBackground />
            </div>

            <div className="min-h-screen bg-transparent relative z-10 flex">
                {/* Desktop Sidebar */}
                {!isLoading && guidelines.length > 0 && (
                    <aside className="hidden lg:flex flex-col fixed top-10 md:top-14 left-0 bottom-0 w-[260px] xl:w-[280px] border-r border-white/5 bg-neutral-950/80 backdrop-blur-xl z-30">
                        <GuidelinesSidebar
                            guidelines={guidelines}
                            selectedId={selectedId}
                            activeSections={activeSections}
                            onSelect={handleSelect}
                            onCreate={() => openWizard()}
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
                        <div className="mb-6">
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

                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                            <div>
                                <h1 className="text-3xl font-bold text-neutral-100 flex items-center gap-3">
                                    <Palette className="text-brand-cyan h-8 w-8 hidden lg:block" />

                                    <Sheet>
                                        <SheetTrigger asChild>
                                            <Button variant="ghost" size="icon" className="lg:hidden text-brand-cyan bg-brand-cyan/[0.05] border border-brand-cyan/20">
                                                <AlignLeft className="h-6 w-6" />
                                            </Button>
                                        </SheetTrigger>
                                        <SheetContent side="left" className="w-[85vw] max-w-sm p-0 border-r border-white/5 bg-neutral-950/95 backdrop-blur-xl">
                                            <SheetTitle className="sr-only">Menu</SheetTitle>
                                            <GuidelinesSidebar
                                                guidelines={guidelines}
                                                selectedId={selectedId}
                                                activeSections={activeSections}
                                                onSelect={handleSelect}
                                                onCreate={() => {
                                                    // Close sheet automatically when creating is handled implicitly by state change, 
                                                    // but since it's a dialog trigger, it might need manual close, 
                                                    // we can let the parent handle it or ignore it for now.
                                                    openWizard();
                                                }}
                                                onToggleSection={toggleSection}
                                            />
                                        </SheetContent>
                                    </Sheet>

                                    {t('brandGuidelines.title')}
                                </h1>
                                <p className="text-neutral-500 mt-1">{t('brandGuidelines.subtitle')}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <PremiumButton
                                    onClick={() => openWizard()}
                                    icon={Plus}
                                    className="shadow-xl"
                                >
                                    {t('brandGuidelines.createNew') || 'Nova Guideline'}
                                </PremiumButton>
                            </div>
                        </div>

                        {/* Content */}
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-40 gap-6">
                                <GlitchLoader size={40} />
                                <MicroTitle className="text-neutral-700 text-[9px] animate-pulse tracking-[0.3em] uppercase">
                                    Synchronizing Workspace
                                </MicroTitle>
                            </div>
                        ) : guidelines.length === 0 ? (
                            <GlassPanel padding="lg" className="flex flex-col items-center justify-center py-24 gap-6 text-center border-dashed border-white/5 bg-neutral-850/10">
                                <div className="p-4 rounded-full bg-white/[0.02] border border-white/[0.03]">
                                    <Palette size={32} strokeWidth={1} className="text-neutral-800" />
                                </div>
                                <div className="space-y-1">
                                    <MicroTitle className="text-neutral-500 uppercase tracking-widest">{t('brandGuidelines.emptyState')}</MicroTitle>
                                    <p className="text-neutral-700 text-[10px] font-mono max-w-xs">{t('brandGuidelines.createFirst')}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    onClick={() => openWizard()}
                                    className="flex items-center gap-2 px-6 py-2.5 rounded-md bg-white/5 border border-white/10 text-neutral-400 font-mono text-[10px] hover:bg-white/10 hover:border-brand-cyan/30 transition-all group"
                                >
                                    <Plus size={12} className="group-hover:text-brand-cyan transition-colors" />
                                    {t('brandGuidelines.createFirst')}
                                </Button>
                            </GlassPanel>
                        ) : (
                            <div className="flex flex-col gap-8 md:gap-16 items-start">
                                {/* Desktop content layout continues */}

                                {selected ? (
                                    <div className="w-full">
                                        <GuidelineDetail
                                            guideline={selected}
                                            activeSections={activeSections}
                                            onOpenWizard={() => openWizard(selected)}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-full flex flex-col items-center justify-center py-40 text-neutral-900 gap-8 border border-dashed border-white/[0.02] rounded-3xl bg-neutral-850/[0.02]">
                                        <div className="relative group/empty">
                                            <div className="absolute inset-0 blur-3xl bg-brand-cyan/5 rounded-full scale-150 transition-all group-hover/empty:bg-brand-cyan/10" />
                                            <Layers size={56} strokeWidth={1} className="relative text-neutral-800 opacity-20" />
                                        </div>
                                        <div className="text-center space-y-2 relative">
                                            <p className="text-[11px] uppercase tracking-[0.5em] font-bold text-neutral-700 opacity-80">Orchestrator Idle</p>
                                            <p className="text-[10px] text-neutral-900 font-mono opacity-40">Select a brand identity from the vault to modify.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </main>
            </div>

            <BrandGuidelineWizardModal
                isOpen={isWizardOpen}
                onClose={() => { setIsWizardOpen(false); setEditingGuideline(null); }}
                onSuccess={handleWizardSuccess}
                editGuideline={editingGuideline}
            />

            <AuthModal
                isOpen={showAuthModal}
                onClose={() => { setShowAuthModal(false); navigate('/'); }}
                onSuccess={() => { setShowAuthModal(false); }}
                isSignUp={false}
            />
        </div>
    );
};
