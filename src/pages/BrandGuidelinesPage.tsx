import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useLayout } from '@/hooks/useLayout';
import { brandGuidelineApi } from '@/services/brandGuidelineApi';
import { MediaKitGallery } from '@/components/brand/MediaKitGallery';
// import { BrandGuidelineEditor } from '@/components/brand/BrandGuidelineEditor';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
    GripVertical,
    X,
    Save,
} from 'lucide-react';

const NotionBlock: React.FC<{ 
    children: React.ReactNode; 
    title?: string; 
    icon?: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
    span?: '1' | '2' | '3';
    loading?: boolean;
}> = ({ children, title, icon, actions, className, span = '1', loading }) => {
    return (
        <motion.div 
            variants={{
                hidden: { opacity: 0, y: 10 },
                show: { opacity: 1, y: 0 }
            }}
            className={cn(
                "group relative flex flex-col gap-2 p-1",
                span === '2' && "md:col-span-2",
                span === '3' && "md:col-span-2 lg:col-span-3",
                className
            )}
        >
            {/* Notion Handle */}
            <div className="absolute -left-6 top-2 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing text-neutral-500 hidden lg:block">
                <GripVertical size={18} />
            </div>

            <div className="flex items-center justify-between px-2 mb-1 min-h-[24px]">
                <div className="flex items-center gap-2">
                    {icon && <div className="text-neutral-500 group-hover:text-brand-cyan transition-colors">{icon}</div>}
                    {title && <MicroTitle className="text-[10px] uppercase tracking-widest text-neutral-500">{title}</MicroTitle>}
                </div>
                <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex gap-1 items-center">
                    {loading && <Loader2 size={12} className="text-brand-cyan animate-spin mr-2" />}
                    {actions}
                </div>
            </div>

            <GlassPanel padding="md" className="flex-1 bg-neutral-900/20 hover:bg-neutral-900/30 border-white/[0.03] hover:border-white/[0.08] transition-all duration-300">
                {children}
            </GlassPanel>
        </motion.div>
    );
};

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
    const [editingBlock, setEditingBlock] = useState<string | null>(null);
    const [editedData, setEditedData] = useState<BrandGuideline | null>(null);
    const [isSaving, setIsSaving] = useState(false);

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
        setEditedData(g);
        setEditingBlock(null);
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

    const handleSaveBlock = async () => {
        if (!editedData?.id) return;
        setIsSaving(true);
        try {
            const updated = await brandGuidelineApi.update(editedData.id, editedData);
            setGuidelines(prev => prev.map(g => g.id === updated.id ? updated : g));
            setEditedData(updated);
            setEditingBlock(null);
            toast.success(t('common.success'));
        } catch {
            toast.error(t('brandGuidelines.saveError'));
        } finally {
            setIsSaving(false);
        }
    };

    const updateEditedData = (updater: (prev: BrandGuideline) => BrandGuideline) => {
        setEditedData(prev => prev ? updater(prev) : null);
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
                    <Breadcrumb className="mb-8 font-mono text-[10px]">
                        <BreadcrumbList>
                            <BreadcrumbItem>
                                <BreadcrumbLink href="/" className="text-neutral-600 hover:text-white transition-colors">Home</BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="text-neutral-800" />
                            <BreadcrumbItem>
                                <BreadcrumbPage className="text-neutral-400 uppercase tracking-widest">{t('brandGuidelines.title')}</BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>

                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                        <div className="space-y-4">
                            <h1 className="text-4xl md:text-5xl font-semibold font-manrope text-white tracking-tight">
                                {t('brandGuidelines.title')}
                                <span className="text-brand-cyan opacity-50">.</span>
                            </h1>
                            <p className="text-neutral-600 font-mono text-xs max-w-lg leading-relaxed opacity-80">
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
                        <div className="flex flex-col items-center justify-center py-40 gap-6">
                            <GlitchLoader size={40} />
                            <MicroTitle className="text-neutral-700 text-[9px] animate-pulse tracking-[0.3em] uppercase">Synchronizing Workspace</MicroTitle>
                        </div>
                    ) : guidelines.length === 0 ? (
                        <GlassPanel padding="lg" className="flex flex-col items-center justify-center py-24 gap-6 text-center border-dashed border-white/5 bg-neutral-900/10">
                            <div className="p-4 rounded-full bg-white/[0.02] border border-white/[0.03]">
                                <Palette size={32} strokeWidth={1} className="text-neutral-800" />
                            </div>
                            <div className="space-y-1">
                                <MicroTitle className="text-neutral-500 uppercase tracking-widest">{t('brandGuidelines.emptyState')}</MicroTitle>
                                <p className="text-neutral-700 text-[10px] font-mono max-w-xs">{t('brandGuidelines.createFirst')}</p>
                            </div>
                            <Button variant="ghost" 
                                onClick={() => { setEditingGuideline(null); setIsWizardOpen(true); }}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 text-neutral-400 font-mono text-[10px] hover:bg-white/10 hover:border-brand-cyan/30 transition-all group"
                            >
                                <Plus size={12} className="group-hover:text-brand-cyan transition-colors" />
                                {t('brandGuidelines.createFirst')}
                            </Button>
                        </GlassPanel>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-12">
                            {/* Simplified Sidebar List */}
                            <div className="flex flex-col gap-8">
                                <div className="space-y-2">
                                    <MicroTitle className="ml-1 opacity-50 uppercase text-[9px] tracking-[0.2em]">{t('brandGuidelines.private') || 'Workspace'}</MicroTitle>
                                    <div className="flex flex-col gap-0.5">
                                        {guidelines.map((g) => (
                                            <button
                                                key={g.id}
                                                onClick={() => handleSelect(g)}
                                                className={cn(
                                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 group text-left",
                                                    selectedId === g.id
                                                        ? "bg-white/[0.05] text-white font-medium"
                                                        : "text-neutral-600 hover:bg-white/[0.02] hover:text-neutral-400 font-normal"
                                                )}
                                            >
                                                <FileText 
                                                    size={14} 
                                                    className={cn(
                                                        "transition-colors",
                                                        selectedId === g.id ? "text-brand-cyan" : "text-neutral-800 group-hover:text-neutral-600"
                                                    )} 
                                                />
                                                <span className="truncate flex-1">
                                                    {g.identity?.name || 'Untitled'}
                                                </span>
                                                {selectedId === g.id && (
                                                    <div className="w-1 h-1 rounded-full bg-brand-cyan shadow-[0_0_8px_rgba(var(--brand-cyan-rgb),1)]" />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                    <Button 
                                        variant="ghost" 
                                        onClick={() => { setEditingGuideline(null); setIsWizardOpen(true); }}
                                        className="w-full justify-start gap-3 px-3 py-2 h-auto text-neutral-800 hover:text-neutral-600 hover:bg-white/[0.02] font-normal text-sm"
                                    >
                                        <Plus size={14} />
                                        <span>{t('brandGuidelines.createNew')}</span>
                                    </Button>
                                </div>
                                
                                <div className="mt-4 pt-6 border-t border-white/[0.03]">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" className="w-full justify-between gap-2 px-3 py-2 h-auto text-[10px] uppercase tracking-[0.3em] text-neutral-700 hover:text-neutral-500 font-mono">
                                                <div className="flex items-center gap-2">
                                                    <Settings size={12} />
                                                    View Settings
                                                </div>
                                                <ChevronRight size={12} className="opacity-40" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent className="w-56 bg-neutral-900 border-white/5 p-2 shadow-2xl" align="start">
                                            <MicroTitle className="px-2 py-2 mb-1 block text-[10px] opacity-40">Layout Modules</MicroTitle>
                                            <DropdownMenuItem onClick={() => toggleSection('tags')} className="flex items-center justify-between cursor-pointer focus:bg-white/5 p-2 rounded-lg">
                                                <div className="flex items-center gap-2 text-neutral-400">
                                                    <Tag size={12} className={activeSections.includes('tags') ? "text-brand-cyan" : "text-neutral-700"} />
                                                    <span className="text-xs">Tags</span>
                                                </div>
                                                {activeSections.includes('tags') && <div className="w-1 h-1 rounded-full bg-brand-cyan" />}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => toggleSection('media')} className="flex items-center justify-between cursor-pointer focus:bg-white/5 p-2 rounded-lg">
                                                <div className="flex items-center gap-2 text-neutral-400">
                                                    <ImageIcon size={12} className={activeSections.includes('media') ? "text-brand-cyan" : "text-neutral-700"} />
                                                    <span className="text-xs">Media Kit</span>
                                                </div>
                                                {activeSections.includes('media') && <div className="w-1 h-1 rounded-full bg-brand-cyan" />}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => toggleSection('tokens')} className="flex items-center justify-between cursor-pointer focus:bg-white/5 p-2 rounded-lg">
                                                <div className="flex items-center gap-2 text-neutral-400">
                                                    <Layers size={12} className={activeSections.includes('tokens') ? "text-brand-cyan" : "text-neutral-700"} />
                                                    <span className="text-xs">Design Tokens</span>
                                                </div>
                                                {activeSections.includes('tokens') && <div className="w-1 h-1 rounded-full bg-brand-cyan" />}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => toggleSection('editorial')} className="flex items-center justify-between cursor-pointer focus:bg-white/5 p-2 rounded-lg">
                                                <div className="flex items-center gap-2 text-neutral-400">
                                                    <FileText size={12} className={activeSections.includes('editorial') ? "text-brand-cyan" : "text-neutral-700"} />
                                                    <span className="text-xs">Editorial</span>
                                                </div>
                                                {activeSections.includes('editorial') && <div className="w-1 h-1 rounded-full bg-brand-cyan" />}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => toggleSection('accessibility')} className="flex items-center justify-between cursor-pointer focus:bg-white/5 p-2 rounded-lg">
                                                <div className="flex items-center gap-2 text-neutral-400">
                                                    <ShieldCheck size={12} className={activeSections.includes('accessibility') ? "text-brand-cyan" : "text-neutral-700"} />
                                                    <span className="text-xs">Accessibility</span>
                                                </div>
                                                {activeSections.includes('accessibility') && <div className="w-1 h-1 rounded-full bg-brand-cyan" />}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>

                            {/* Detail Panel: Notion-style Blocks */}
                            <div className="flex flex-col gap-4">
                                {selected ? (
                                    <motion.div
                                        key={selected.id}
                                        variants={containerVariants}
                                        initial="hidden"
                                        animate="show"
                                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                                    >
                                        {/* Block 1: Identity & Header (Full context) */}
                                        <NotionBlock 
                                            span="3" 
                                            icon={<FileText size={16} />} 
                                            title={t('brandGuidelines.identity')}
                                            loading={editingBlock === 'identity' && isSaving}
                                            actions={
                                                editingBlock === 'identity' ? (
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={() => setEditingBlock(null)}>
                                                            <X size={12} />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-brand-cyan" onClick={handleSaveBlock}>
                                                            <Save size={12} />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={() => setEditingBlock('identity')}>
                                                        <Pencil size={12} />
                                                    </Button>
                                                )
                                            }
                                        >
                                            <div className="flex flex-col md:flex-row justify-between gap-8 py-4">
                                                <div className="space-y-6 flex-1">
                                                    {editingBlock === 'identity' ? (
                                                        <div className="space-y-4">
                                                            <div className="space-y-1">
                                                                <MicroTitle className="text-[9px] opacity-40">Brand Name</MicroTitle>
                                                                <Input 
                                                                    value={editedData?.identity?.name || ''}
                                                                    onChange={(e) => updateEditedData(prev => ({ ...prev, identity: { ...prev.identity, name: e.target.value } }))}
                                                                    className="text-2xl font-bold bg-neutral-900/50 border-white/5"
                                                                    placeholder="Brand Name"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <MicroTitle className="text-[9px] opacity-40">Tagline</MicroTitle>
                                                                <Input 
                                                                    value={editedData?.identity?.tagline || ''}
                                                                    onChange={(e) => updateEditedData(prev => ({ ...prev, identity: { ...prev.identity, tagline: e.target.value } }))}
                                                                    className="text-sm font-mono bg-neutral-900/50 border-white/5"
                                                                    placeholder="Tagline"
                                                                />
                                                            </div>
                                                            <div className="space-y-1">
                                                                <MicroTitle className="text-[9px] opacity-40">Description</MicroTitle>
                                                                <Textarea 
                                                                    value={editedData?.identity?.description || ''}
                                                                    onChange={(e) => updateEditedData(prev => ({ ...prev, identity: { ...prev.identity, description: e.target.value } }))}
                                                                    className="text-sm bg-neutral-900/50 border-white/5 min-h-[100px]"
                                                                    placeholder="Description"
                                                                />
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <>
                                                            <div className="space-y-2">
                                                                <motion.h2 
                                                                    initial={{ opacity: 0, x: -10 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    className="text-4xl font-bold font-manrope text-white tracking-tight"
                                                                >
                                                                    {selected.identity?.name || 'Untitled Brand'}
                                                                </motion.h2>
                                                                {selected.identity?.tagline && (
                                                                    <p className="text-sm font-mono text-neutral-500 italic opacity-60">
                                                                        "{selected.identity.tagline}"
                                                                    </p>
                                                                )}
                                                            </div>
                                                            {selected.identity?.description && (
                                                                <p className="text-sm text-neutral-400 max-w-2xl leading-relaxed opacity-90">
                                                                    {selected.identity.description}
                                                                </p>
                                                            )}
                                                        </>
                                                    )}
                                                    
                                                    <div className="flex flex-wrap items-center gap-6 pt-2">
                                                        {selected.identity?.website && (
                                                            <a
                                                                href={selected.identity.website}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs font-mono text-neutral-600 hover:text-brand-cyan flex items-center gap-2 transition-colors group/link"
                                                            >
                                                                <Globe size={14} className="opacity-50 group-hover/link:opacity-100" />
                                                                {selected.identity.website.replace(/^https?:\/\//, '')}
                                                                <ExternalLink size={12} className="opacity-20 group-hover/link:opacity-50" />
                                                            </a>
                                                        )}
                                                        {selected._extraction && (
                                                            <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/[0.02] border border-white/5">
                                                                <ShieldCheck size={14} className="text-brand-cyan/40" />
                                                                <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-700 font-mono">
                                                                    Verified data {selected._extraction.completeness}%
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex flex-row md:flex-col gap-2 shrink-0">
                                                    {selected.identity?.website && (
                                                        <Button variant="ghost" 
                                                            size="icon"
                                                            onClick={handleReIngest}
                                                            className="h-9 w-9 text-neutral-800 hover:text-brand-cyan hover:bg-brand-cyan/10 transition-all border border-transparent hover:border-brand-cyan/20"
                                                            title={t('brandGuidelines.reExtract')}
                                                        >
                                                            <RefreshCw size={14} />
                                                        </Button>
                                                    )}
                                                    <Button variant="ghost" 
                                                        size="icon"
                                                        onClick={() => { setEditingGuideline(selected); setIsWizardOpen(true); }}
                                                        className="h-9 w-9 text-neutral-800 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
                                                        title={t('mockup.brandWizardEdit')}
                                                    >
                                                        <Pencil size={14} />
                                                    </Button>
                                                    <Button variant="ghost" 
                                                        size="icon"
                                                        onClick={() => handleDelete(selected.id!)}
                                                        disabled={deletingId === selected.id}
                                                        className="h-9 w-9 text-neutral-800 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20 disabled:opacity-50"
                                                        title={t('brandGuidelines.delete')}
                                                    >
                                                        {deletingId === selected.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                                    </Button>
                                                </div>
                                            </div>
                                        </NotionBlock>

                                        {/* Block 2: Primary Logos */}
                                        <NotionBlock icon={<ImageIcon size={14} />} title="Assets">
                                            <div className="flex flex-col items-center justify-center min-h-[160px] gap-4 py-2">
                                                {localLogos && localLogos.length > 0 ? (
                                                    <div className="relative group/logo">
                                                        <img
                                                            src={localLogos[0].url}
                                                            alt="Primary Logo"
                                                            className="max-h-[80px] w-auto object-contain filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.5)] group-hover/logo:scale-105 transition-transform duration-500"
                                                        />
                                                        {localLogos.length > 1 && (
                                                            <div className="mt-4 text-center">
                                                                <span className="text-[10px] font-mono text-neutral-700 uppercase tracking-widest opacity-60">
                                                                    +{localLogos.length - 1} library assets
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-3 opacity-10">
                                                        <ImageIcon size={40} strokeWidth={1} />
                                                        <span className="text-[9px] font-mono uppercase tracking-[0.3em]">Empty Gallery</span>
                                                    </div>
                                                )}
                                            </div>
                                            <Button variant="ghost" 
                                                onClick={() => toggleSection('media')}
                                                className="w-full mt-4 h-9 text-[9px] uppercase tracking-[0.25em] text-neutral-700 hover:text-brand-cyan border-t border-white/[0.03] rounded-none hover:bg-transparent transition-colors"
                                            >
                                                Full Media Library
                                            </Button>
                                        </NotionBlock>

                                        {/* Block 3: Colors */}
                                        <NotionBlock 
                                            icon={<Palette size={14} />} 
                                            title={t('brandGuidelines.colors')}
                                            loading={editingBlock === 'colors' && isSaving}
                                            actions={
                                                editingBlock === 'colors' ? (
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={() => setEditingBlock(null)}>
                                                            <X size={12} />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-brand-cyan" onClick={handleSaveBlock}>
                                                            <Save size={12} />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={() => setEditingBlock('colors')}>
                                                        <Pencil size={12} />
                                                    </Button>
                                                )
                                            }
                                        >
                                            <div className="grid grid-cols-4 gap-4 py-2">
                                                {editingBlock === 'colors' ? (
                                                    <>
                                                        {editedData?.colors?.map((c, i) => (
                                                            <div key={i} className="flex flex-col gap-1.5 group/color items-center relative">
                                                                <input
                                                                    type="color"
                                                                    value={c.hex}
                                                                    onChange={(e) => updateEditedData(prev => {
                                                                        const colors = [...(prev.colors || [])];
                                                                        colors[i] = { ...colors[i], hex: e.target.value };
                                                                        return { ...prev, colors };
                                                                    })}
                                                                    className="w-12 h-12 rounded-xl border border-white/5 cursor-pointer bg-transparent"
                                                                />
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white opacity-0 group-hover/color:opacity-100 transition-opacity"
                                                                    onClick={() => updateEditedData(prev => ({ ...prev, colors: (prev.colors || []).filter((_, idx) => idx !== i) }))}
                                                                >
                                                                    <X size={8} />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                        <Button 
                                                            variant="ghost" 
                                                            className="w-12 h-12 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-neutral-600 hover:text-brand-cyan hover:border-brand-cyan/30"
                                                            onClick={() => updateEditedData(prev => ({ ...prev, colors: [...(prev.colors || []), { hex: '#000000', name: 'New Color' }] }))}
                                                        >
                                                            <Plus size={14} />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        {selected.colors && selected.colors.length > 0 ? (
                                                            selected.colors.slice(0, 8).map((c, i) => (
                                                                <div key={i} className="flex flex-col gap-1.5 group/color items-center">
                                                                    <div
                                                                        className="w-12 h-12 rounded-xl border border-white/5 shadow-2xl group-hover/color:scale-110 transition-transform duration-300"
                                                                        style={{ backgroundColor: c.hex }}
                                                                        title={`${c.name || ''}: ${c.hex}`}
                                                                    />
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="col-span-4 py-12 text-center opacity-10 italic text-[10px] font-mono tracking-widest uppercase">No Palette</div>
                                                        )}
                                                        {selected.colors && selected.colors.length > 8 && (
                                                            <div className="w-12 h-12 rounded-xl border border-dashed border-white/5 flex items-center justify-center text-[10px] text-neutral-800 font-mono">
                                                                +{selected.colors.length - 8}
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </NotionBlock>

                                        {/* Block 4: Typography */}
                                        <NotionBlock 
                                            icon={<Type size={14} />} 
                                            title={t('brandGuidelines.typography')}
                                            loading={editingBlock === 'typography' && isSaving}
                                            actions={
                                                editingBlock === 'typography' ? (
                                                    <div className="flex gap-1">
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={() => setEditingBlock(null)}>
                                                            <X size={12} />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-brand-cyan" onClick={handleSaveBlock}>
                                                            <Save size={12} />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={() => setEditingBlock('typography')}>
                                                        <Pencil size={12} />
                                                    </Button>
                                                )
                                            }
                                        >
                                            <div className="space-y-6 py-2">
                                                {editingBlock === 'typography' ? (
                                                    <div className="space-y-4">
                                                        {editedData?.typography?.map((f, i) => (
                                                            <div key={i} className="flex flex-col gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5 group/font relative">
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <div className="space-y-1">
                                                                        <MicroTitle className="text-[8px] opacity-40">Role</MicroTitle>
                                                                        <Input 
                                                                            value={f.role || ''}
                                                                            onChange={(e) => updateEditedData(prev => {
                                                                                const typography = [...(prev.typography || [])];
                                                                                typography[i] = { ...typography[i], role: e.target.value };
                                                                                return { ...prev, typography };
                                                                            })}
                                                                            className="text-[10px] font-mono h-7 bg-transparent"
                                                                            placeholder="e.g. Body"
                                                                        />
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <MicroTitle className="text-[8px] opacity-40">Family</MicroTitle>
                                                                        <Input 
                                                                            value={f.family || ''}
                                                                            onChange={(e) => updateEditedData(prev => {
                                                                                const typography = [...(prev.typography || [])];
                                                                                typography[i] = { ...typography[i], family: e.target.value };
                                                                                return { ...prev, typography };
                                                                            })}
                                                                            className="text-[10px] font-mono h-7 bg-transparent font-bold"
                                                                            placeholder="Font Family"
                                                                        />
                                                                    </div>
                                                                </div>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="icon" 
                                                                    className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white opacity-0 group-hover/font:opacity-100 transition-opacity"
                                                                    onClick={() => updateEditedData(prev => ({ ...prev, typography: (prev.typography || []).filter((_, idx) => idx !== i) }))}
                                                                >
                                                                    <X size={8} />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                        <Button 
                                                            variant="ghost" 
                                                            className="w-full h-8 rounded-lg border border-dashed border-white/10 flex items-center justify-center text-neutral-600 hover:text-brand-cyan hover:border-brand-cyan/30 text-[9px] uppercase tracking-widest"
                                                            onClick={() => updateEditedData(prev => ({ ...prev, typography: [...(prev.typography || []), { family: 'Inter', role: 'body', style: 'Regular' }] }))}
                                                        >
                                                            <Plus size={10} className="mr-1" />
                                                            Add Font
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <>
                                                        {selected.typography && selected.typography.length > 0 ? (
                                                            selected.typography.slice(0, 2).map((f, i) => (
                                                                <div key={i} className="flex flex-col group/font border-l border-white/5 pl-4 py-1 hover:border-brand-cyan/30 transition-colors">
                                                                    <span className="text-[10px] text-neutral-700 font-mono tracking-widest mb-1.5 uppercase opacity-60 font-medium">{f.role}</span>
                                                                    <span className="text-xl font-bold text-white truncate group-hover:text-brand-cyan transition-colors">{f.family}</span>
                                                                    <div className="flex items-center gap-2 mt-1.5">
                                                                        <span className="text-[10px] text-neutral-500 font-mono opacity-80">{f.style || 'Regular'}</span>
                                                                        {f.size && <span className="text-neutral-900">·</span>}
                                                                        {f.size && <span className="text-[10px] text-neutral-800 font-mono">{f.size}px</span>}
                                                                    </div>
                                                                </div>
                                                            ))
                                                        ) : (
                                                            <div className="py-12 text-center opacity-10 italic text-[10px] font-mono tracking-widest uppercase">No Fonts</div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </NotionBlock>

                                        {/* Optional Blocks with AnimatePresence */}
                                        <AnimatePresence mode="popLayout">
                                            {activeSections.includes('tags') && (
                                                <NotionBlock 
                                                    icon={<Tag size={14} />} 
                                                    title="Strategy"
                                                    loading={editingBlock === 'tags' && isSaving}
                                                    actions={
                                                        editingBlock === 'tags' ? (
                                                            <div className="flex gap-1">
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={() => setEditingBlock(null)}>
                                                                    <X size={12} />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-brand-cyan" onClick={handleSaveBlock}>
                                                                    <Save size={12} />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={() => setEditingBlock('tags')}>
                                                                <Pencil size={12} />
                                                            </Button>
                                                        )
                                                    }
                                                >
                                                    <div className="flex flex-wrap gap-2 py-2">
                                                        {editingBlock === 'tags' ? (
                                                            <div className="w-full space-y-4">
                                                                <Textarea 
                                                                    value={JSON.stringify(editedData?.tags || {}, null, 2)}
                                                                    onChange={(e) => {
                                                                        try {
                                                                            const tags = JSON.parse(e.target.value);
                                                                            updateEditedData(prev => ({ ...prev, tags }));
                                                                        } catch {}
                                                                    }}
                                                                    className="text-[10px] font-mono bg-neutral-900/50 border-white/5 min-h-[120px]"
                                                                    placeholder='{"Category": ["Value"]}'
                                                                />
                                                                <p className="text-[8px] text-neutral-600 font-mono">Format: JSON object</p>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {selected.tags && Object.entries(selected.tags).length > 0 ? (
                                                                    Object.entries(selected.tags).map(([cat, vals]: any) => (
                                                                        vals.map((v: string, j: number) => (
                                                                            <span key={`${cat}-${j}`} className="px-3 py-1 rounded bg-white/[0.02] border border-white/[0.05] text-[10px] text-neutral-600 hover:text-brand-cyan hover:border-brand-cyan/20 transition-all cursor-default font-mono tracking-tighter">
                                                                                {v}
                                                                            </span>
                                                                        ))
                                                                    ))
                                                                ) : (
                                                                    <p className="text-[10px] text-neutral-900 italic font-mono uppercase tracking-widest opacity-20 py-8 text-center w-full">No Tags</p>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </NotionBlock>
                                            )}

                                            {activeSections.includes('tokens') && (
                                                <NotionBlock 
                                                    icon={<Layers size={14} />} 
                                                    title="Design Tokens"
                                                    loading={editingBlock === 'tokens' && isSaving}
                                                    actions={
                                                        editingBlock === 'tokens' ? (
                                                            <div className="flex gap-1">
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={() => setEditingBlock(null)}>
                                                                    <X size={12} />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-brand-cyan" onClick={handleSaveBlock}>
                                                                    <Save size={12} />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={() => setEditingBlock('tokens')}>
                                                                <Pencil size={12} />
                                                            </Button>
                                                        )
                                                    }
                                                >
                                                    <div className="space-y-6 py-2">
                                                        {editingBlock === 'tokens' ? (
                                                            <div className="space-y-4">
                                                                <Textarea 
                                                                    value={JSON.stringify(editedData?.tokens || {}, null, 2)}
                                                                    onChange={(e) => {
                                                                        try {
                                                                            const tokens = JSON.parse(e.target.value);
                                                                            updateEditedData(prev => ({ ...prev, tokens }));
                                                                        } catch {}
                                                                    }}
                                                                    className="text-[10px] font-mono bg-neutral-900/50 border-white/5 min-h-[150px]"
                                                                    placeholder='{"spacing": {"s": "4px"}, "radius": {"m": "8px"}}'
                                                                />
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {selected.tokens?.spacing && (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {Object.entries(selected.tokens.spacing).slice(0, 4).map(([k, v]) => (
                                                                            <div key={k} className="bg-white/[0.01] px-2.5 py-1.5 rounded border border-white/[0.03] text-center min-w-[42px] hover:border-brand-cyan/10 transition-colors">
                                                                                <span className="text-[8px] font-mono text-neutral-800 block uppercase tracking-tighter mb-0.5">{k}</span>
                                                                                <span className="text-[10px] font-mono text-neutral-500 font-bold">{v}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                {selected.tokens?.radius && (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {Object.entries(selected.tokens.radius).slice(0, 4).map(([k, v]) => (
                                                                            <div key={k} className="bg-white/[0.01] px-2.5 py-1.5 rounded border border-white/[0.03] text-center min-w-[42px] hover:border-brand-cyan/10 transition-colors">
                                                                                <span className="text-[8px] font-mono text-neutral-800 block uppercase tracking-tighter mb-0.5">{k}</span>
                                                                                <span className="text-[10px] font-mono text-neutral-500 font-bold">{v}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </NotionBlock>
                                            )}

                                            {activeSections.includes('editorial') && (
                                                <NotionBlock 
                                                    icon={<FileText size={14} />} 
                                                    title="Editorial"
                                                    loading={editingBlock === 'editorial' && isSaving}
                                                    actions={
                                                        editingBlock === 'editorial' ? (
                                                            <div className="flex gap-1">
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={() => setEditingBlock(null)}>
                                                                    <X size={12} />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-brand-cyan" onClick={handleSaveBlock}>
                                                                    <Save size={12} />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={() => setEditingBlock('editorial')}>
                                                                <Pencil size={12} />
                                                            </Button>
                                                        )
                                                    }
                                                >
                                                    <div className="space-y-4 py-2">
                                                        {editingBlock === 'editorial' ? (
                                                            <div className="space-y-4">
                                                                <div className="space-y-1">
                                                                    <MicroTitle className="text-[8px] opacity-40">Voice Tone</MicroTitle>
                                                                    <Input 
                                                                        value={editedData?.guidelines?.voice || ''}
                                                                        onChange={(e) => updateEditedData(prev => ({ ...prev, guidelines: { ...prev.guidelines, voice: e.target.value } }))}
                                                                        className="text-xs h-8 bg-transparent"
                                                                        placeholder="Voice Tone"
                                                                    />
                                                                </div>
                                                                <div className="space-y-1">
                                                                    <MicroTitle className="text-[8px] opacity-40">Do's (one per line)</MicroTitle>
                                                                    <Textarea 
                                                                        value={(editedData?.guidelines?.dos || []).join('\n')}
                                                                        onChange={(e) => updateEditedData(prev => ({ ...prev, guidelines: { ...prev.guidelines, dos: e.target.value.split('\n') } }))}
                                                                        className="text-xs bg-transparent min-h-[80px]"
                                                                        placeholder="Do's"
                                                                    />
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {selected.guidelines?.voice && (
                                                                    <div className="bg-brand-cyan/5 border border-brand-cyan/10 rounded px-3 py-2">
                                                                        <span className="text-[9px] text-neutral-700 uppercase font-mono block mb-1 tracking-widest">Voice Tone</span>
                                                                        <span className="text-xs text-brand-cyan/70 font-medium ">{selected.guidelines.voice}</span>
                                                                    </div>
                                                                )}
                                                                <div className="flex flex-col gap-2">
                                                                    {selected.guidelines?.dos?.slice(0, 3).map((item: string, i: number) => (
                                                                        <div key={i} className="text-[11px] text-neutral-600 flex items-start gap-2 bg-white/[0.01] p-1.5 rounded border border-transparent hover:border-white/[0.03] transition-colors line-clamp-1">
                                                                            <span className="text-brand-cyan font-bold opacity-30">+</span>
                                                                            {item}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </NotionBlock>
                                            )}

                                            {activeSections.includes('accessibility') && (
                                                <NotionBlock 
                                                    span="3" 
                                                    icon={<ShieldCheck size={14} />} 
                                                    title="Accessibility Core"
                                                    loading={editingBlock === 'accessibility' && isSaving}
                                                    actions={
                                                        editingBlock === 'accessibility' ? (
                                                            <div className="flex gap-1">
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={() => setEditingBlock(null)}>
                                                                    <X size={12} />
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 text-brand-cyan" onClick={handleSaveBlock}>
                                                                    <Save size={12} />
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Button variant="ghost" size="icon" className="h-6 w-6 text-neutral-500 hover:text-white" onClick={() => setEditingBlock('accessibility')}>
                                                                <Pencil size={12} />
                                                            </Button>
                                                        )
                                                    }
                                                >
                                                    <div className="py-4">
                                                        {editingBlock === 'accessibility' ? (
                                                            <Textarea 
                                                                value={editedData?.guidelines?.accessibility || ''}
                                                                onChange={(e) => updateEditedData(prev => ({ ...prev, guidelines: { ...prev.guidelines, accessibility: e.target.value } }))}
                                                                className="text-xs bg-neutral-900/50 border-white/5 min-h-[100px]"
                                                                placeholder="Accessibility guidelines..."
                                                            />
                                                        ) : (
                                                            <p className="text-xs text-neutral-500 leading-relaxed italic max-w-2xl opacity-70">
                                                                {selected.guidelines?.accessibility || "No comprehensive accessibility metrics defined for this workspace yet."}
                                                            </p>
                                                        )}
                                                    </div>
                                                </NotionBlock>
                                            )}

                                            {activeSections.includes('media') && (
                                                <NotionBlock span="3" icon={<ImageIcon size={14} />} title="Visual Library & Components">
                                                    <div className="py-6">
                                                        <MediaKitGallery 
                                                            guidelineId={selected.id!} 
                                                            media={localMedia || []} 
                                                            logos={localLogos || []} 
                                                            onMediaChange={setLocalMedia} 
                                                            onLogosChange={setLocalLogos} 
                                                            compact
                                                        />
                                                    </div>
                                                </NotionBlock>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-40 text-neutral-900 gap-8 border border-dashed border-white/[0.02] rounded-3xl bg-neutral-900/[0.02]">
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
