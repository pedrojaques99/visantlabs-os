import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { MediaKitGallery } from '@/components/brand/MediaKitGallery';
import { BrandGuidelineEditor } from '@/components/brand/BrandGuidelineEditor';
import { BrandGuidelineWizardModal } from '@/components/mockupmachine/BrandGuidelineWizardModal';
import { GlitchLoader } from '@/components/ui/GlitchLoader';
import { SEO } from '@/components/SEO';
import { AuthModal } from '@/components/AuthModal';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import type { BrandGuideline } from '@/lib/figma-types';
import { GlassPanel } from '@/components/ui/GlassPanel';
import { MicroTitle } from '@/components/ui/MicroTitle';
import { PremiumButton } from '@/components/ui/PremiumButton';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button'
import {
    Plus,
    Pencil,
    Trash2,
    Globe,
    Palette,
    Loader2,
    ChevronRight,
    RefreshCw,
    ExternalLink,
    Layers,
    Type,
    Tag,
    Image as ImageIcon,
    FileText,
    ShieldCheck,
    Settings,
    CheckCircle2,
    CircleAlert,
} from 'lucide-react';

export const BrandGuidelinesPage: React.FC = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { isAuthenticated } = useLayout();

    const [guidelines, setGuidelines] = useState<BrandGuideline[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [editingGuideline, setEditingGuideline] = useState<BrandGuideline | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);

    // Dynamic sections state
    const [activeSections, setActiveSections] = useState<string[]>(['identity', 'logos', 'colors', 'typography']);

    // Local state for the selected guideline's media (live updates)
    const [localMedia, setLocalMedia] = useState<BrandGuideline['media']>([]);
    const [localLogos, setLocalLogos] = useState<BrandGuideline['logos']>([]);

    const fetchGuidelines = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await brandGuidelineApi.getAll();
            setGuidelines(data);
            if (!selectedId && data.length > 0) {
                const first = data[0];
                setSelectedId(first.id!);
                setLocalMedia(first.media || []);
                setLocalLogos(first.logos || []);
                
                // Determine active sections based on data
                const sections = ['identity', 'logos', 'colors', 'typography'];
                if (first.tags && Object.keys(first.tags).length > 0) sections.push('tags');
                if ((first.media?.length || 0) > 0) sections.push('media');
                if (first.tokens) sections.push('tokens');
                if (first.guidelines) sections.push('editorial');
                setActiveSections([...new Set(sections)]);
            }
        } catch {
            toast.error(t('mockup.errorLoadBrandGuidelines'));
        } finally {
            setIsLoading(false);
        }
    }, [selectedId, t]);

    useEffect(() => {
        if (isAuthenticated === false) {
            setShowAuthModal(true);
            return;
        }
        if (isAuthenticated) fetchGuidelines();
    }, [isAuthenticated]);

    const selected = useMemo(() => guidelines.find(g => g.id === selectedId), [guidelines, selectedId]);

    const handleSelect = (g: BrandGuideline) => {
        setSelectedId(g.id!);
        setLocalMedia(g.media || []);
        setLocalLogos(g.logos || []);
        
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
        fetchGuidelines();
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            await brandGuidelineApi.delete(id);
            const updated = guidelines.filter(g => g.id !== id);
            setGuidelines(updated);
            if (selectedId === id) {
                const next = updated[0];
                setSelectedId(next?.id || null);
                setLocalMedia(next?.media || []);
                setLocalLogos(next?.logos || []);
            }
            toast.success(t('brandGuidelines.deleteSuccess'));
        } catch {
            toast.error(t('brandGuidelines.deleteError'));
        } finally {
            setDeletingId(null);
        }
    };

    const handleReIngest = async () => {
        if (!selected?.id || !selected.identity?.website) return;
        try {
            toast.info(t('mockup.brandWizardExtracting'));
            await brandGuidelineApi.ingest(selected.id, { source: 'url', url: selected.identity.website });
            toast.success(t('mockup.brandWizardSuccessWithExtraction'));
            fetchGuidelines();
        } catch {
            toast.error(t('mockup.brandWizardErrorIngest'));
        }
    };

    const toggleSection = (section: string) => {
        setActiveSections(prev => 
            prev.includes(section) ? prev.filter(s => s !== section) : [...prev, section]
        );
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    return (
        <>
            <SEO
                title={t('brandGuidelines.seoTitle')}
                description={t('brandGuidelines.seoDescription')}
            />
            <div className="min-h-[calc(100vh-80px)] bg-background selection:bg-brand-cyan/30">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    {/* Breadcrumb */}
                    <Breadcrumb className="mb-8">
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbLink href="/" className="text-neutral-500 hover:text-white transition-colors">Home</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="text-neutral-800" />
                            <BreadcrumbItem>
                                <BreadcrumbPage className="text-white font-mono uppercase tracking-widest text-[10px]">{t('brandGuidelines.title')}</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                        <div className="space-y-2">
                            <h1 className="text-4xl md:text-5xl font-semibold font-manrope text-white tracking-tight">
                                {t('brandGuidelines.title')}
                                <span className="text-brand-cyan">.</span>
                            </h1>
                            <p className="text-neutral-500 font-mono text-xs max-w-lg leading-relaxed">
                                {t('brandGuidelines.subtitle')}
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <PremiumButton
                                onClick={() => { setEditingGuideline(null); setIsWizardOpen(true); }}
                                className="!py-3 !px-5 !text-xs min-w-[160px]"
                            >
                                {t('brandGuidelines.createNew')}
                            </PremiumButton>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-32 gap-4">
                            <GlitchLoader size={48} />
                            <MicroTitle className="text-neutral-600 text-[10px] animate-pulse">Synchronizing Brand Data...</MicroTitle>
                        </div>
                    ) : guidelines.length === 0 ? (
                        <GlassPanel padding="lg" className="flex flex-col items-center justify-center py-24 gap-6 text-center border-dashed border-white/10">
                            <div className="p-4 rounded-full bg-white/5 border border-white/5">
                                <Palette size={40} className="text-neutral-700" />
                            </div>
                            <div className="space-y-1">
                                <MicroTitle>{t('brandGuidelines.emptyState')}</MicroTitle>
                                <p className="text-neutral-600 text-xs font-mono max-w-xs">{t('brandGuidelines.createFirst')}</p>
                            </div>
                            <Button variant="ghost" 
                                onClick={() => { setEditingGuideline(null); setIsWizardOpen(true); }}
                                className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 border border-white/10 text-neutral-300 font-mono text-xs hover:bg-white/10 hover:border-brand-cyan/30 transition-all group"
                            >
                                <Plus size={14} className="group-hover:text-brand-cyan transition-colors" />
                                {t('brandGuidelines.createFirst')}
                            </Button>
                        </GlassPanel>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-10">
                            {/* Sidebar List */}
                            <div className="flex flex-col gap-3">
                                <MicroTitle className="mb-2 ml-1">My Brands</MicroTitle>
                                <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                                    {guidelines.map((g) => (
                                        <Button variant="ghost" 
                                            key={g.id}
                                            onClick={() => handleSelect(g)}
                                            className={cn(
                                                "w-full flex items-center justify-between px-5 py-4 rounded-2xl border text-left transition-all duration-300 relative overflow-hidden group",
                                                selectedId === g.id
                                                    ? "bg-brand-cyan/5 border-brand-cyan/30 text-white shadow-[0_0_30px_rgba(var(--brand-cyan-rgb),0.05)]"
                                                    : "bg-neutral-900/40 border-white/5 text-neutral-500 hover:bg-white/5 hover:text-neutral-300 hover:border-white/10"
                                            )}
                                        >
                                            {selectedId === g.id && (
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-cyan" />
                                            )}
                                            <div className="flex flex-col gap-1.5 min-w-0 flex-1">
                                                <span className="text-xs font-mono font-medium truncate tracking-tight">
                                                    {g.identity?.name || 'Unnamed'}
                                                </span>
                                                {g._extraction && (
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-0.5 flex-1 max-w-[60px] bg-white/5 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-brand-cyan/50 rounded-full transition-all duration-1000"
                                                                style={{ width: `${g._extraction.completeness}%` }}
                                                            />
                                                        </div>
                                                        <span className="text-[8px] font-mono text-neutral-700 tracking-tighter">
                                                            {g._extraction.completeness}%
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            <ChevronRight
                                                size={14}
                                                className={cn(
                                                    "flex-shrink-0 transition-transform duration-300",
                                                    selectedId === g.id ? "text-brand-cyan translate-x-1" : "text-neutral-800 group-hover:text-neutral-600 group-hover:translate-x-1"
                                                )}
                                            />
                                        </Button>
                                    ))}
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-dashed border-white/10 text-neutral-600 font-mono text-[10px] uppercase tracking-widest hover:border-white/20 hover:text-neutral-400 transition-all w-full">
                                            <Settings size={12} />
                                            Panel Layout
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent className="w-56 bg-neutral-900 border-white/5 p-2" align="start">
                                        <MicroTitle className="px-2 py-2 mb-1 block">Toggle Sections</MicroTitle>
                                        <DropdownMenuItem onClick={() => toggleSection('tags')} className="flex items-center justify-between cursor-pointer focus:bg-white/5 p-2 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <Tag size={12} className={activeSections.includes('tags') ? "text-brand-cyan" : "text-neutral-600"} />
                                                <span className="text-xs">Tags</span>
                                            </div>
                                            {activeSections.includes('tags') && <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toggleSection('media')} className="flex items-center justify-between cursor-pointer focus:bg-white/5 p-2 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <ImageIcon size={12} className={activeSections.includes('media') ? "text-brand-cyan" : "text-neutral-600"} />
                                                <span className="text-xs">Media Kit</span>
                                            </div>
                                            {activeSections.includes('media') && <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toggleSection('tokens')} className="flex items-center justify-between cursor-pointer focus:bg-white/5 p-2 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <Layers size={12} className={activeSections.includes('tokens') ? "text-brand-cyan" : "text-neutral-600"} />
                                                <span className="text-xs">Design Tokens</span>
                                            </div>
                                            {activeSections.includes('tokens') && <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toggleSection('editorial')} className="flex items-center justify-between cursor-pointer focus:bg-white/5 p-2 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <FileText size={12} className={activeSections.includes('editorial') ? "text-brand-cyan" : "text-neutral-600"} />
                                                <span className="text-xs">Editorial</span>
                                            </div>
                                            {activeSections.includes('editorial') && <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toggleSection('accessibility')} className="flex items-center justify-between cursor-pointer focus:bg-white/5 p-2 rounded-lg">
                                            <div className="flex items-center gap-2">
                                                <ShieldCheck size={12} className={activeSections.includes('accessibility') ? "text-brand-cyan" : "text-neutral-600"} />
                                                <span className="text-xs">Accessibility</span>
                                            </div>
                                            {activeSections.includes('accessibility') && <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {/* Detail Panel: Bento Grid */}
                            <div className="flex flex-col gap-6">
                                {selected ? (
                                    <motion.div
                                        key={selected.id}
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="show"
                                        className="grid grid-cols-1 md:grid-cols-6 gap-5"
                                    >
                                        {/* Bento: Identity (Spans 4 columns) */}
                                        <motion.div variants={itemVariants} className="md:col-span-4">
                                            <GlassPanel padding="md" className="h-full min-h-[220px] justify-between group">
                                                <div className="flex justify-between items-start">
                                                    <div className="space-y-4">
                                                        <div className="space-y-1">
                                                            <MicroTitle>{t('brandGuidelines.identity')}</MicroTitle>
                                                            <h2 className="text-3xl font-semibold font-manrope text-white group-hover:text-brand-cyan transition-colors duration-500">
                                                                {selected.identity?.name || 'Unnamed Brand'}
                                                            </h2>
                                                        </div>
                                                        {selected.identity?.tagline && (
                                                            <p className="text-sm font-mono text-neutral-500 italic border-l border-white/10 pl-3 py-1">
                                                                "{selected.identity.tagline}"
                                                            </p>
                                                        )}
                                                        {selected.identity?.description && (
                                                            <p className="text-xs text-neutral-500 max-w-lg leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all duration-300">
                                                                {selected.identity.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {selected.identity?.website && (
                                                            <Button variant="brand" 
                                                                onClick={handleReIngest}
                                                                className="p-2 rounded-xl bg-white/5 text-neutral-600 hover:text-brand-cyan hover:bg-brand-cyan/10 transition-all border border-transparent hover:border-brand-cyan/20"
                                                                title={t('brandGuidelines.reExtract')}
                                                            >
                                                                <RefreshCw size={14} className="group-hover:rotate-180 transition-transform duration-700" />
                                                            </Button>
                                                        )}
                                                        <Button variant="ghost" 
                                                            onClick={() => { setEditingGuideline(selected); setIsWizardOpen(true); }}
                                                            className="p-2 rounded-xl bg-white/5 text-neutral-600 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
                                                            title={t('mockup.brandWizardEdit')}
                                                        >
                                                            <Pencil size={14} />
                                                        </Button>
                                                        <Button variant="ghost" 
                                                            onClick={() => handleDelete(selected.id!)}
                                                            disabled={deletingId === selected.id}
                                                            className="p-2 rounded-xl bg-white/5 text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20 disabled:opacity-50"
                                                            title={t('brandGuidelines.delete')}
                                                        >
                                                            {deletingId === selected.id
                                                                ? <Loader2 size={14} className="animate-spin" />
                                                                : <Trash2 size={14} />
                                                            }
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6 mt-6 pt-6 border-t border-white/5">
                                                    {selected.identity?.website && (
                                                        <a
                                                            href={selected.identity.website}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[10px] font-mono text-neutral-600 hover:text-brand-cyan flex items-center gap-2 transition-colors group/link"
                                                        >
                                                            <Globe size={12} className="group-hover/link:animate-pulse" />
                                                            {selected.identity.website.replace(/^https?:\/\//, '')}
                                                            <ExternalLink size={10} className="opacity-0 group-hover/link:opacity-100 transition-opacity" />
                                                        </a>
                                                    )}
                                                    {selected._extraction && (
                                                        <div className="flex items-center gap-2">
                                                            <ShieldCheck size={12} className="text-brand-cyan/50" />
                                                            <MicroTitle className="text-[10px] text-neutral-700 tracking-tighter">Verified data: {selected._extraction.completeness}%</MicroTitle>
                                                        </div>
                                                    )}
                                                </div>
                                            </GlassPanel>
                                        </motion.div>

                                        {/* Bento: Logo Preview (Spans 2 columns) */}
                                        <motion.div variants={itemVariants} className="md:col-span-2">
                                            <GlassPanel padding="md" className="h-full flex flex-col justify-between overflow-hidden relative group">
                                                <div className="absolute inset-0 bg-gradient-to-br from-brand-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                                                <MicroTitle className="relative z-10">Main Assets</MicroTitle>
                                                <div className="flex-1 flex items-center justify-center py-4 relative z-10">
                                                    {localLogos && localLogos.length > 0 ? (
                                                        <div className="relative group/logo">
                                                            <img
                                                                src={localLogos[0].url}
                                                                alt="Main Logo"
                                                                className="max-h-[80px] w-auto object-contain filter drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] group-hover/logo:scale-110 transition-transform duration-500"
                                                            />
                                                            {localLogos.length > 1 && (
                                                                <div className="absolute -bottom-2 -right-2 bg-neutral-900 border border-white/10 text-[8px] font-mono px-1.5 py-0.5 rounded-full text-neutral-500">
                                                                    +{localLogos.length - 1} more
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col items-center gap-2 text-neutral-800">
                                                            <ImageIcon size={32} strokeWidth={1} />
                                                            <span className="text-[9px] font-mono uppercase tracking-widest">No assets yet</span>
                                                        </div>
                                                    )}
                                                </div>
                                                <Button variant="ghost" 
                                                    onClick={() => toggleSection('media')}
                                                    className="w-full text-center py-2 text-[9px] font-mono text-neutral-600 hover:text-brand-cyan border-t border-white/5 relative z-10 uppercase tracking-widest transition-colors"
                                                >
                                                    Open Library
                                                </Button>
                                            </GlassPanel>
                                        </motion.div>

                                        {/* Bento: Colors (Spans 3 columns) */}
                                        <motion.div variants={itemVariants} className="md:col-span-3">
                                            <GlassPanel padding="md" className="h-full group">
                                                <div className="flex justify-between items-center mb-6">
                                                    <MicroTitle>{t('brandGuidelines.colors')}</MicroTitle>
                                                    <div className="h-px flex-1 bg-white/5 mx-4" />
                                                    <Palette size={14} className="text-neutral-700 group-hover:text-brand-cyan transition-colors" />
                                                </div>
                                                <div className="flex flex-wrap gap-4">
                                                    {selected.colors && selected.colors.length > 0 ? (
                                                        selected.colors.slice(0, 5).map((c, i) => (
                                                            <div key={i} className="flex flex-col gap-2 group/color">
                                                                <div
                                                                    className="w-12 h-12 rounded-2xl border border-white/10 shadow-lg group-hover/color:scale-110 transition-transform duration-300"
                                                                    style={{ backgroundColor: c.hex }}
                                                                />
                                                                <div className="space-y-0.5">
                                                                    <MicroTitle className="text-[10px] text-white block truncate w-12">{c.name}</MicroTitle> <span className="text-[8px] text-neutral-700 tracking-tighter">{c.hex}</span>
                                                                </div>
                                                            </div>
                                                        ))
                                                    ) : (
                                                        <MicroTitle className="text-[10px] text-neutral-700 italic">{t('brandGuidelines.clickToAdd')}</MicroTitle> )} {selected.colors && selected.colors.length > 5 && ( <div className="w-12 h-12 rounded-2xl border border-dashed border-white/10 flex items-center justify-center text-[10px] text-neutral-700"> +{selected.colors.length - 5} </div> )} </div> </GlassPanel> </motion.div> {/* Bento: Typography (Spans 3 columns) */} <motion.div variants={itemVariants} className="md:col-span-3"> <GlassPanel padding="md" className="h-full group"> <div className="flex justify-between items-center mb-6"> <MicroTitle>{t('brandGuidelines.typography')}</MicroTitle> <div className="h-px flex-1 bg-white/5 mx-4" /> <Type size={14} className="text-neutral-700 group-hover:text-brand-cyan transition-colors" /> </div> <div className="space-y-4"> {selected.typography && selected.typography.length > 0 ? ( selected.typography.slice(0, 2).map((f, i) => ( <div key={i} className="flex flex-col gap-1 border-l-2 border-brand-cyan/20 pl-4 py-1 hover:border-brand-cyan transition-colors duration-500"> <span className="text-[9px] text-neutral-600">{f.role}</span>
                                                                <span className="text-lg font-medium text-white tracking-tight">{f.family}</span>
                                                                <div className="flex items-center gap-2">
                                                                    <MicroTitle className="text-[10px] ">{f.style || 'Regular'}</MicroTitle> {f.size && <span className="text-neutral-800">·</span>} {f.size && <span className="text-[10px] text-neutral-700">{f.size}px</span>} </div> </div> )) ) : ( <p className="text-[10px] text-neutral-700 italic">{t('brandGuidelines.clickToAdd')}</p> )} </div> </GlassPanel> </motion.div> {/* Optional Sections with AnimatePresence */} <AnimatePresence mode="popLayout"> {activeSections.includes('tags') && ( <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="md:col-span-2" > <GlassPanel padding="md" className="h-full"> <MicroTitle className="mb-4">Brand Strategy Tags</MicroTitle> <div className="flex flex-wrap gap-2"> {selected.tags && Object.entries(selected.tags).length > 0 ? ( Object.entries(selected.tags).map(([cat, vals]: any) => ( vals.map((v: string, j: number) => ( <span key={`${cat}-${j}`} className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] hover:text-brand-cyan hover:border-brand-cyan/20 transition-all cursor-default"> {v} </span> )) )) ) : ( <p className="text-[10px] text-neutral-800">No strategy tags defined</p> )} </div> </GlassPanel> </motion.div> )} {activeSections.includes('editorial') && ( <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="md:col-span-4" > <GlassPanel padding="md" className="h-full"> <div className="flex items-center justify-between mb-4"> <MicroTitle>Editorial Guidelines</MicroTitle> {selected.guidelines?.voice && ( <span className="text-[10px] text-brand-cyan bg-brand-cyan/10 px-2 py-0.5 rounded-full">{selected.guidelines.voice}</span> )} </div> <div className="grid grid-cols-2 gap-6"> <div className="space-y-4"> <span className="text-[10px] text-green-500/50 flex items-center gap-1.5">
                                                                    <CheckCircle2 size={10} />
                                                                    Principles
                                                                </span>
                                                                <ul className="space-y-1.5">
                                                                    {selected.guidelines?.dos?.map((item: string, i: number) => (
                                                                        <li key={i} className="text-xs text-neutral-400 flex items-start gap-2 bg-white/[0.02] p-1.5 rounded-lg border border-white/5">
                                                                            <span className="text-green-500 font-bold">+</span>
                                                                            {item}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                            <div className="space-y-4">
                                                                <MicroTitle className="text-[10px] text-red-500/50 flex items-center gap-1.5">
                                                                    <CircleAlert size={10} />
                                                                    Avoid
                                                                </MicroTitle>
                                                                <ul className="space-y-1.5">
                                                                    {selected.guidelines?.donts?.map((item: string, i: number) => (
                                                                        <li key={i} className="text-xs text-neutral-400 flex items-start gap-2 bg-white/[0.02] p-1.5 rounded-lg border border-white/5">
                                                                            <span className="text-red-500 font-bold">−</span>
                                                                            {item}
                                                                        </li>
                                                                    ))}
                                                                </ul>
                                                            </div>
                                                        </div>
                                                    </GlassPanel>
                                                </motion.div>
                                            )}

                                            {activeSections.includes('tokens') && (
                                                <motion.div
                                                    layout
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    exit={{ opacity: 0, scale: 0.95 }}
                                                    className="md:col-span-3"
                                                >
                                                    <GlassPanel padding="md" className="h-full">
                                                        <div className="flex items-center justify-between mb-4">
                                                            <MicroTitle>Design Tokens</MicroTitle>
                                                            <Layers size={14} className="text-neutral-700" />
                                                        </div>
                                                        <div className="space-y-4">
                                                            {selected.tokens?.spacing && (
                                                                <div className="space-y-2">
                                                                    <span className="text-[9px] font-mono text-neutral-600 uppercase tracking-widest">Spacing Scale</span>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {Object.entries(selected.tokens.spacing).map(([k, v]) => (
                                                                            <div key={k} className="flex flex-col items-center gap-1 bg-white/5 p-2 rounded-lg border border-white/5 min-w-[40px]">
                                                                                <span className="text-[8px] font-mono text-neutral-600 uppercase">{k}</span>
                                                                                <MicroTitle className="text-[10px] text-white">{v}px</MicroTitle> </div> ))} </div> </div> )} {selected.tokens?.radius && ( <div className="space-y-2"> <span className="text-[9px] text-neutral-600">Corner Radius</span>
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {Object.entries(selected.tokens.radius).map(([k, v]) => (
                                                                            <div key={k} className="flex flex-col items-center gap-1 bg-white/5 p-2 rounded-lg border border-white/5 min-w-[40px]">
                                                                                <span className="text-[8px] font-mono text-neutral-600 uppercase">{k}</span>
                                                                                <MicroTitle className="text-[10px] text-white">{v}px</MicroTitle> </div> ))} </div> </div> )} </div> </GlassPanel> </motion.div> )} {activeSections.includes('accessibility') && ( <motion.div layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="md:col-span-3" > <GlassPanel padding="md" className="h-full"> <div className="flex items-center justify-between mb-4"> <MicroTitle>Accessibility</MicroTitle> <ShieldCheck size={14} className="text-neutral-700" /> </div> <p className="text-xs text-neutral-400 leading-relaxed bg-white/[0.02] p-4 rounded-xl border border-white/5 italic"> {selected.guidelines?.accessibility || "No accessibility guidelines defined."} </p> </GlassPanel> </motion.div> )} {activeSections.includes('media') && ( <motion.div layout initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }} className="md:col-span-6" > <GlassPanel padding="md" className="w-full"> <div className="flex items-center justify-between mb-8"> <div className="flex items-center gap-3"> <div className="p-2 rounded-xl bg-brand-cyan/10 text-brand-cyan"> <ImageIcon size={18} /> </div> <div className="space-y-0.5"> <MicroTitle>Media Kit & Visual Library</MicroTitle> <p className="text-[10px] text-neutral-600">Unified storage for logos, headers, and reference media.</p> </div> </div> </div> <MediaKitGallery guidelineId={selected.id!} media={localMedia || []} logos={localLogos || []} onMediaChange={setLocalMedia} onLogosChange={setLocalLogos} /> </GlassPanel> </motion.div> )} </AnimatePresence> {/* Inline Editor (Hidden until specifically toggled or integrated into panels) */} <div className="md:col-span-6 mt-12 pt-12 border-t border-white/5"> <div className="flex items-center gap-4 mb-10"> <MicroTitle className="text-neutral-300">Detailed Configuration</MicroTitle> <div className="h-px flex-1 bg-white/5" /> </div> <BrandGuidelineEditor key={selected.id} guideline={selected} onUpdate={(updated) => { setGuidelines(prev => prev.map(g => g.id === updated.id ? updated : g)); }} /> </div> </motion.div> ) : ( <div className="flex flex-col items-center justify-center py-32 text-neutral-800 text-xs gap-4 border border-dashed border-white/5 rounded-3xl"> <ChevronRight size={32} strokeWidth={1} className="animate-pulse" /> <div className="text-center space-y-1"> <p className=" tracking-[0.3em] font-bold">Select a Cluster</p>
                                            <p className="text-neutral-900">Choose a brand identity to begin orchestration.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
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
                onSuccess={() => { setShowAuthModal(false); fetchGuidelines(); }}
                isSignUp={false}
            />
        </>
    );
};

