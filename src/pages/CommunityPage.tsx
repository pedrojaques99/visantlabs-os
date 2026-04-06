import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Globe, Diamond, TrendingUp, Plus, Image as ImageIcon, Camera, Layers, MapPin, Sun, ArrowRight, ChevronDown, ChevronUp, Box, Settings, Palette, FolderOpen, Wand2, Figma } from 'lucide-react';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { BreadcrumbWithBack, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '../components/ui/BreadcrumbWithBack';
import { useLayout } from '@/hooks/useLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { getAllCommunityPresets, getCommunityStats, clearCommunityPresetsCache } from '../services/communityPresetsService';
import { mockupApi } from '../services/mockupApi';
import { cn } from '../lib/utils';
import { Github } from 'lucide-react';
import { getGithubUrl } from '../config/branding';
import { MicroTitle } from '../components/ui/MicroTitle';
import { GlassPanel } from '../components/ui/GlassPanel';
import { PremiumButton } from '../components/ui/PremiumButton';
import ClubLogo3D from '../components/3d/club-logo3d';
import { useMediaQuery } from '@/hooks/use-media-query';
import { CommunityPresetModal } from '../components/CommunityPresetModal';
import { WorkflowLibraryModal } from '../components/WorkflowLibraryModal';
import { canvasApi } from '../services/canvasApi';
import { authService } from '../services/authService';
import { toast } from 'sonner';
import { workflowApi } from '../services/workflowApi';
import type { CanvasWorkflow } from '../services/workflowApi';
import { WORKFLOW_CATEGORY_CONFIG } from '../types/workflow';
import { Workflow } from 'lucide-react';
import { Button } from '@/components/ui/button'
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion';

// --- Components ---

const CountUp: React.FC<{ value: number }> = ({ value }) => {
  const spring = useSpring(0, { mass: 1, stiffness: 100, damping: 30 });
  const displayValue = useTransform(spring, (current) => Math.round(current));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span>{displayValue}</motion.span>;
};

const BackgroundGlow = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-brand-cyan/10 blur-[120px] rounded-full" />
    <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-indigo-500/5 blur-[120px] rounded-full" />
  </div>
);

type PresetType = 'mockup' | 'angle' | 'texture' | 'ambience' | 'luminance' | '3d' | 'presets' | 'aesthetics' | 'themes' | 'ui-prompts' | 'figma-prompts';

interface PresetStats {
  mockup: number;
  angle: number;
  texture: number;
  ambience: number;
  luminance: number;
  '3d': number;
  presets: number;
  aesthetics: number;
  themes: number;
  'ui-prompts': number;
  'figma-prompts': number;
  total: number;
}

interface CategoryPresets {
  mockup: any[];
  angle: any[];
  texture: any[];
  ambience: any[];
  luminance: any[];
  '3d': any[];
  presets: any[];
  aesthetics: any[];
  themes: any[];
  'ui-prompts': any[];
  'figma-prompts': any[];
}

interface GlobalStats {
  totalUsers: number;
  totalPresets: number;
  totalBlankMockups: number;
}

export const CommunityPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthenticated: isUserAuthenticated, isCheckingAuth } = useLayout();
  const [stats, setStats] = useState<PresetStats>({
    mockup: 0,
    angle: 0,
    texture: 0,
    ambience: 0,
    luminance: 0,
    '3d': 0,
    presets: 0,
    aesthetics: 0,
    themes: 0,
    'ui-prompts': 0,
    'figma-prompts': 0,
    total: 0,
  });
  const [categoryPresets, setCategoryPresets] = useState<CategoryPresets>({
    mockup: [],
    angle: [],
    texture: [],
    ambience: [],
    luminance: [],
    '3d': [],
    presets: [],
    aesthetics: [],
    themes: [],
    'ui-prompts': [],
    'figma-prompts': [],
  });
  const [globalCommunityStats, setGlobalCommunityStats] = useState<GlobalStats>({
    totalUsers: 0,
    totalPresets: 0,
    totalBlankMockups: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeUsersCount, setActiveUsersCount] = useState<number>(0);
  const [communityMockups, setCommunityMockups] = useState<any[]>([]);
  const [allPublicMockups, setAllPublicMockups] = useState<any[]>([]);
  const [isGalleryExpanded, setIsGalleryExpanded] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [workflows, setWorkflows] = useState<CanvasWorkflow[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [showWorkflowLibrary, setShowWorkflowLibrary] = useState(false);

  // Check if user is admin (you might need to fetch user details or get from context if available)
  const [isAdmin, setIsAdmin] = useState(false); // Placeholder, ideally get from authService/context
  const isMobile = useMediaQuery('(max-width: 768px)');

  const handleLoadWorkflow = async (workflow: CanvasWorkflow) => {
    try {
      if (!isAuthenticated) {
        toast.error(t('workflows.errors.mustBeAuthenticated') || 'You must be logged in');
        return;
      }

      // Create a new project from this workflow
      // Ensure nodes/edges are properly typed/formatted if needed
      const newProject = await canvasApi.save(
        workflow.name,
        workflow.nodes,
        workflow.edges
      );

      toast.success(t('workflows.messages.loaded', { name: workflow.name }) || `Workflow loaded: ${workflow.name}`);
      navigate(`/canvas/${newProject._id}`);
    } catch (error) {
      console.error('Failed to load workflow:', error);
      toast.error(t('workflows.errors.failedToLoad') || 'Failed to load workflow');
    }
  };

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        const [allPresets, publicMockups, globalStats] = await Promise.all([
          getAllCommunityPresets(),
          mockupApi.getAllPublic().catch(() => []),
          getCommunityStats()
        ]);

        // Store all presets for each category (remove duplicates by id)
        const removeDuplicates = (presets: any[]) => {
          const seen = new Set<string | number>();
          return presets.filter((preset) => {
            if (!preset?.id) return false;
            if (seen.has(preset.id)) return false;
            seen.add(preset.id);
            return true;
          });
        };

        const newStats: PresetStats = {
          mockup: allPresets.mockup?.length || 0,
          angle: allPresets.angle?.length || 0,
          texture: allPresets.texture?.length || 0,
          ambience: allPresets.ambience?.length || 0,
          luminance: allPresets.luminance?.length || 0,
          '3d': allPresets['3d']?.length || 0,
          presets: allPresets.presets?.length || 0,
          aesthetics: allPresets.aesthetics?.length || 0,
          themes: allPresets.themes?.length || 0,
          'ui-prompts': allPresets['ui-prompts']?.length || 0,
          'figma-prompts': allPresets['figma-prompts']?.length || 0,
          total: 0,
        };
        newStats.total = Object.values(newStats).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
        setStats(newStats);
        setGlobalCommunityStats(globalStats);

        setCategoryPresets({
          mockup: removeDuplicates(allPresets.mockup || []),
          angle: removeDuplicates(allPresets.angle || []),
          texture: removeDuplicates(allPresets.texture || []),
          ambience: removeDuplicates(allPresets.ambience || []),
          luminance: removeDuplicates(allPresets.luminance || []),
          '3d': removeDuplicates(allPresets['3d'] || []),
          presets: removeDuplicates(allPresets.presets || []),
          aesthetics: removeDuplicates(allPresets.aesthetics || []),
          themes: removeDuplicates(allPresets.themes || []),
          'ui-prompts': removeDuplicates(allPresets['ui-prompts'] || []),
          'figma-prompts': removeDuplicates(allPresets['figma-prompts'] || []),
        });

        // Store latest mockups
        const sortedMockups = (publicMockups || [])
          .filter((mockup: any) => mockup?._id && (mockup.imageUrl || mockup.imageBase64))
          .sort((a: any, b: any) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
        setAllPublicMockups(sortedMockups);
        setCommunityMockups(sortedMockups.slice(0, 10));

        // Count unique users from all presets
        const allPresetsArray = [
          ...(allPresets.mockup || []),
          ...(allPresets.angle || []),
          ...(allPresets.texture || []),
          ...(allPresets.ambience || []),
          ...(allPresets.luminance || []),
          ...(allPresets['3d'] || []),
          ...(allPresets.presets || []),
          ...(allPresets.aesthetics || []),
          ...(allPresets.themes || []),
        ];
        const uniqueUserIds = new Set(
          allPresetsArray
            .map((preset: any) => preset.userId?.toString())
            .filter((id: string | undefined) => id)
        );
        setActiveUsersCount(uniqueUserIds.size);
      } catch (error) {
        console.error('Failed to load community stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, []);

  // Load workflows
  useEffect(() => {
    const loadWorkflows = async () => {
      setWorkflowsLoading(true);
      try {
        const publicWorkflows = await workflowApi.getPublic();
        setWorkflows(publicWorkflows);
      } catch (error) {
        console.error('Failed to load workflows:', error);
      } finally {
        setWorkflowsLoading(false);
      }
    };

    loadWorkflows();
  }, []);

  const presetTypes: Array<{ type: PresetType; icon: React.ComponentType<{ size?: number; className?: string }>; label: string; count: number; presets: any[] }> = [
    { type: 'mockup', icon: ImageIcon, label: t('communityPresets.tabs.mockup'), count: stats.mockup, presets: categoryPresets.mockup },
    { type: 'angle', icon: Camera, label: t('communityPresets.tabs.angle'), count: stats.angle, presets: categoryPresets.angle },
    { type: 'texture', icon: Layers, label: t('communityPresets.tabs.texture'), count: stats.texture, presets: categoryPresets.texture },
    { type: 'ambience', icon: MapPin, label: t('communityPresets.tabs.ambience'), count: stats.ambience, presets: categoryPresets.ambience },
    { type: 'luminance', icon: Sun, label: t('communityPresets.tabs.luminance'), count: stats.luminance, presets: categoryPresets.luminance },
    { type: '3d', icon: Box, label: t('communityPresets.categories.3d'), count: stats['3d'], presets: categoryPresets['3d'] },
    { type: 'presets', icon: Settings, label: t('communityPresets.categories.presets'), count: stats.presets, presets: categoryPresets.presets },
    { type: 'aesthetics', icon: Palette, label: t('communityPresets.categories.aesthetics'), count: stats.aesthetics, presets: categoryPresets.aesthetics },
    { type: 'themes', icon: Diamond, label: t('communityPresets.categories.themes'), count: stats.themes, presets: categoryPresets.themes },
    // AI-generated prompts
    { type: 'ui-prompts', icon: Wand2, label: 'UI Prompts', count: stats['ui-prompts'], presets: categoryPresets['ui-prompts'] },
    { type: 'figma-prompts', icon: Figma, label: 'Figma Prompts', count: stats['figma-prompts'], presets: categoryPresets['figma-prompts'] },
  ];

  const isAuthenticated = isUserAuthenticated === true;

  const handleSavePreset = useCallback(async (data: any) => {
    const token = authService.getToken();
    if (!token) {
      throw new Error(t('communityPresets.errors.mustBeAuthenticatedToCreate'));
    }

    const COMMUNITY_API = '/api/community/presets';
    const presetId = data.id;

    try {
      const body: any = {
        presetType: data.presetType,
        id: presetId,
        name: data.name,
        description: data.description,
        prompt: data.prompt,
        aspectRatio: data.aspectRatio,
        tags: data.tags && data.tags.length > 0 ? data.tags : undefined,
      };

      if (data.presetType === 'mockup' && data.referenceImageUrl !== undefined) {
        body.referenceImageUrl = data.referenceImageUrl;
      }

      const response = await fetch(COMMUNITY_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || t('communityPresets.errors.failedToCreate'));
      }

      clearCommunityPresetsCache();
      toast.success(t('communityPresets.messages.presetCreated'));

      // Reload stats after creating preset
      const [allPresets, globalStats] = await Promise.all([
        getAllCommunityPresets(),
        getCommunityStats()
      ]);

      const newStats: PresetStats = {
        mockup: allPresets.mockup?.length || 0,
        angle: allPresets.angle?.length || 0,
        texture: allPresets.texture?.length || 0,
        ambience: allPresets.ambience?.length || 0,
        luminance: allPresets.luminance?.length || 0,
        '3d': allPresets['3d']?.length || 0,
        presets: allPresets.presets?.length || 0,
        aesthetics: allPresets.aesthetics?.length || 0,
        themes: allPresets.themes?.length || 0,
        'ui-prompts': allPresets['ui-prompts']?.length || 0,
        'figma-prompts': allPresets['figma-prompts']?.length || 0,
        total: 0,
      };
      newStats.total = Object.values(newStats).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
      setStats(newStats);
      setGlobalCommunityStats(globalStats);
    } catch (saveError: any) {
      console.error('Save error:', saveError);
      throw saveError;
    }
  }, [t]);

  return (
    <div className="min-h-screen bg-[#0C0C0C] text-neutral-300 pt-12 md:pt-14 relative overflow-x-hidden">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] bg-gradient-to-b from-brand-cyan/5 via-transparent to-transparent opacity-50" />
        <div className="absolute top-[10%] left-[10%] w-[400px] h-[400px] bg-brand-cyan/[0.02] blur-[150px] rounded-full" />
        <div className="absolute top-[20%] right-[10%] w-[500px] h-[500px] bg-indigo-500/[0.01] blur-[150px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-4 pt-8 pb-16 md:pb-24 relative z-10">
        <div className="mb-8">
          <BreadcrumbWithBack to="/">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link to="/">{t('apps.home')}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{t('communityPresets.title')}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </BreadcrumbWithBack>
        </div>

        {/* Hero Section */}
        <div className="relative mb-16 min-h-[550px] flex items-center overflow-hidden rounded-3xl border border-white/[0.03] bg-neutral-900/10">
          <BackgroundGlow />
          
          {/* 3D Object - Repositioned for better balance */}
          <div className="absolute right-0 top-0 w-full md:w-1/2 h-full pointer-events-none z-0">
            <Suspense fallback={null}>
              <ClubLogo3D
                isMobile={isMobile}
                color="#0f0f0f"
                starColor="#52ddeb"
              />
            </Suspense>
          </div>

          {/* Content */}
          <div className="relative z-10 w-full max-w-6xl mx-auto px-6 md:px-12 py-16">
            <div className="max-w-2xl">
              {/* Badge - Premium Styling */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 backdrop-blur-md">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-cyan" />
                  <span className="text-[10px] font-bold font-mono text-brand-cyan uppercase tracking-widest">
                    Comunidade Ativa
                  </span>
                </div>
              </motion.div>

              {/* Title - Elegant & Impactful */}
              <motion.h1 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="text-5xl md:text-7xl font-bold text-white mb-4 leading-[1.1] font-manrope tracking-tight"
              >
                {t('communityPresets.title')}
              </motion.h1>

              {/* Description - Refined Typography */}
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-neutral-400 text-base md:text-lg mb-10 max-w-lg leading-relaxed font-manrope"
              >
                {t('communityPresets.subtitle')}
              </motion.p>

              {/* Action Buttons - Consistent & Premium */}
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-wrap gap-3"
              >
                <PremiumButton
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-2 h-12 px-6 text-sm min-w-[200px]"
                >
                  <Plus size={18} />
                  <span>Criar um novo prompt</span>
                </PremiumButton>
                
                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    onClick={() => navigate('/community/presets')}
                    className="h-12 px-5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 backdrop-blur-md transition-all flex items-center gap-2"
                  >
                    <Globe size={18} className="text-brand-cyan" />
                    <span className="font-manrope font-semibold">Explorar Galeria</span>
                  </Button>
                  
                  <Button 
                    variant="ghost" 
                    onClick={() => setShowWorkflowLibrary(true)}
                    className="h-12 px-5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 backdrop-blur-md transition-all flex items-center gap-2"
                  >
                    <FolderOpen size={18} className="text-neutral-400" />
                  </Button>
                </div>
              </motion.div>

              {/* Stats - Integrated Grid */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-16 max-w-xl"
              >
                <GlassPanel padding="sm" className="bg-white/[0.02] border-white/[0.05] hover:border-brand-cyan/30 transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter font-manrope">Membros</span>
                    <TrendingUp size={14} className="text-brand-cyan/40 group-hover:text-brand-cyan transition-colors" />
                  </div>
                  <p className="text-3xl font-bold text-white font-mono tracking-tighter">
                    {isLoading ? '...' : (globalCommunityStats.totalUsers === 0 ? '1' : <CountUp value={globalCommunityStats.totalUsers} />)}
                  </p>
                </GlassPanel>

                <GlassPanel padding="sm" className="bg-white/[0.02] border-white/[0.05] hover:border-brand-cyan/30 transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter font-manrope">Criações</span>
                    <Diamond size={14} className="text-brand-cyan/40 group-hover:text-brand-cyan transition-colors" />
                  </div>
                  <p className="text-3xl font-bold text-white font-mono tracking-tighter">
                    {isLoading ? '...' : (globalCommunityStats.totalPresets === 0 ? '!' : <CountUp value={globalCommunityStats.totalPresets} />)}
                  </p>
                </GlassPanel>

                <GlassPanel padding="sm" className="hidden sm:flex bg-white/[0.02] border-white/[0.05] hover:border-brand-cyan/30 transition-colors group">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter font-manrope">Publicado</span>
                    <ImageIcon size={14} className="text-brand-cyan/40 group-hover:text-brand-cyan transition-colors" />
                  </div>
                  <p className="text-3xl font-bold text-white font-mono tracking-tighter">
                    {isLoading ? '...' : (globalCommunityStats.totalBlankMockups === 0 ? '+' : <CountUp value={globalCommunityStats.totalBlankMockups} />)}
                  </p>
                </GlassPanel>
              </motion.div>
            </div>
          </div>
        </div>

        {isCheckingAuth && (
          <div className="flex items-center justify-center py-20">
            <p className="text-neutral-400 font-mono">{t('common.loading')}</p>
          </div>
        )}

        {!isCheckingAuth && (
          <div className="space-y-24">
            {/* Exploration Categories */}
            <section className="space-y-10">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                  <MicroTitle className="text-brand-cyan/60 tracking-[0.2em]">Curadoria</MicroTitle>
                  <h2 className="text-3xl font-bold text-white font-manrope tracking-tight">Explorar por Categoria</h2>
                </div>
                <Link
                  to="/community/presets"
                  className="inline-flex items-center gap-2 text-brand-cyan hover:text-brand-cyan/80 font-mono text-sm transition-all hover:translate-x-1"
                >
                  Todas as categorias
                  <ArrowRight size={16} />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                {presetTypes.map((category) => (
                  <GlassPanel
                    key={category.type}
                    className="group relative rounded-2xl p-6 flex flex-col h-full hover:border-brand-cyan/40 transition-all hover:-translate-y-1 active:translate-y-0 overflow-hidden cursor-pointer bg-white/[0.01]"
                    onClick={() => navigate(`/community/presets?type=${category.type}`)}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-10 transition-opacity [mask-image:linear-gradient(to_bottom_left,black,transparent)] scale-150">
                      <category.icon size={120} className="text-brand-cyan" />
                    </div>

                    <div className="flex items-center justify-between mb-6">
                      <div className="p-3 bg-white/5 rounded-xl group-hover:bg-brand-cyan/10 group-hover:scale-110 transition-all duration-300">
                        <category.icon size={24} className="text-neutral-400 group-hover:text-brand-cyan transition-colors" />
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-2xl font-bold font-mono text-white whitespace-nowrap group-hover:text-brand-cyan transition-colors">
                          <CountUp value={category.count} />
                        </span>
                        <span className="text-[9px] font-bold text-neutral-600 uppercase tracking-widest font-manrope">Presets</span>
                      </div>
                    </div>

                    <div className="mb-6 flex-1">
                      <h3 className="text-lg font-semibold text-white font-manrope mb-1 capitalize group-hover:text-brand-cyan transition-colors text-left">
                        {category.label}
                      </h3>
                      <p className="text-xs text-neutral-500 font-mono line-clamp-2 leading-relaxed text-left">
                        Explorar {category.label.toLowerCase()} criados pela nossa comunidade.
                      </p>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-neutral-800/50 max-h-48 overflow-y-auto w-full">
                      {category.presets.length > 0 ? (
                        category.presets.map((preset: any, index: number) => (
                          <div
                            key={`${category.type}-${preset.id || preset._id || index}`}
                            className="flex items-center gap-3 py-1 group/item"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-neutral-700 group-hover/item:bg-brand-cyan transition-colors" />
                            <p className="text-xs font-mono text-neutral-500 group-hover/item:text-neutral-300 truncate transition-colors text-left">
                              {preset.name}
                            </p>
                          </div>
                        ))
                      ) : (
                        <MicroTitle as="p" className=" text-neutral-700 text-left">Ainda sem presets</MicroTitle>
                      )}
                    </div>
                  </GlassPanel>
                ))}
              </div>
            </section>

            {/* Workflows Section */}
            <section className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white font-manrope">Workflows da Comunidade</h2>
                  <p className="text-neutral-500 font-mono text-sm max-w-lg mt-2">
                    Workflows completos criados pela comunidade. Salve, compartilhe e reutilize estruturas de canvas inteiras.
                  </p>
                </div>
                <Link
                  to="/canvas"
                  className="inline-flex items-center gap-2 text-brand-cyan hover:text-brand-cyan/80 font-mono text-sm transition-all hover:translate-x-1"
                >
                  Abrir Canvas
                  <ArrowRight size={16} />
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {workflowsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-[#141414] border border-neutral-800/50 rounded-md p-6">
                      <div className="aspect-video bg-neutral-900 rounded-md mb-4" />
                      <div className="h-4 bg-neutral-900 rounded mb-2" />
                      <div className="h-3 bg-neutral-900 rounded w-2/3" />
                    </div>
                  ))
                ) : workflows.length > 0 ? (
                  workflows.slice(0, 8).map((workflow) => {
                    const categoryConfig = WORKFLOW_CATEGORY_CONFIG[workflow.category as keyof typeof WORKFLOW_CATEGORY_CONFIG] || WORKFLOW_CATEGORY_CONFIG.general;
                    const CategoryIcon = categoryConfig.icon;

                    return (
                      <GlassPanel
                        key={workflow._id}
                        className="group relative rounded-md p-6 flex flex-col h-full hover:border-brand-cyan/40 transition-all hover:-translate-y-1 active:translate-y-0 text-left cursor-pointer"
                        onClick={() => navigate('/canvas')}
                      >
                        {workflow.thumbnailUrl ? (
                          <div className="aspect-video rounded-md overflow-hidden border border-neutral-700/30 bg-neutral-900/30 mb-4">
                            <img
                              src={workflow.thumbnailUrl}
                              alt={workflow.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        ) : (
                          <div className="aspect-video rounded-md border border-neutral-700/30 bg-neutral-900/30 flex items-center justify-center mb-4">
                            <CategoryIcon size={32} className="text-neutral-700" />
                          </div>
                        )}

                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-white font-mono mb-1 line-clamp-1 group-hover:text-brand-cyan transition-colors">
                            {workflow.name}
                          </h3>
                          <p className="text-xs text-neutral-500 font-mono line-clamp-2 mb-3">
                            {workflow.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-3 border-t border-neutral-800/50">
                          <span
                            className={cn(
                              'px-2 py-0.5 rounded border font-mono text-[10px] flex-shrink-0',
                              categoryConfig.color.replace('text-', 'bg-').replace('-400', '-500/20'),
                              categoryConfig.color.replace('text-', 'border-').replace('-400', '-500/30'),
                              categoryConfig.color
                            )}
                          >
                            {categoryConfig.label}
                          </span>
                          <span className="px-2 py-0.5 bg-neutral-800/40 rounded border border-neutral-700/30 text-neutral-500 font-mono text-[10px] flex-shrink-0">
                            {Array.isArray(workflow.nodes) ? workflow.nodes.length : 0} nodes
                          </span>
                          {workflow.likesCount > 0 && (
                            <span className="px-2 py-0.5 bg-neutral-800/40 rounded border border-neutral-700/30 text-neutral-500 font-mono text-[10px] flex-shrink-0">
                              ❤️ {workflow.likesCount}
                            </span>
                          )}
                        </div>
                      </GlassPanel>
                    );
                  })
                ) : (
                  <div className="col-span-full py-20 text-center bg-[#141414] rounded-md border border-neutral-800/50 border-dashed">
                    <div className="flex flex-col items-center gap-4">
                      <Workflow size={48} className="text-neutral-800" />
                      <p className="text-neutral-500 font-mono text-sm">
                        Nenhum workflow público disponível ainda
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {workflows.length > 8 && (
                <div className="flex justify-center mt-8">
                  <Button variant="ghost" onClick={() => setShowWorkflowLibrary(true)}
                    className="flex items-center gap-2 px-6 py-2 bg-neutral-900/50 hover:bg-brand-cyan/10 text-neutral-500 hover:text-brand-cyan border border-neutral-800/50 rounded-full transition-all text-sm font-mono group"
                  >
                    Ver todos os workflows
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </div>
              )}
            </section>

            {/* Gallery Section */}
            <section className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-white font-manrope">Galeria da Comunidade</h2>
                  <p className="text-neutral-500 font-mono text-sm max-w-lg">
                    Inspirado pelas criações enviadas pelos nossos usuários em tempo real.
                  </p>
                </div>
                <Link
                  to="/mockups"
                  className="inline-flex items-center gap-2 text-brand-cyan hover:text-brand-cyan/80 font-mono text-sm transition-all hover:translate-x-1"
                >
                  Ver galeria completa
                  <ArrowRight size={16} />
                </Link>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-neutral-900 rounded-md border border-neutral-800/50" />
                  ))
                ) : (isGalleryExpanded ? allPublicMockups : communityMockups).length > 0 ? (
                  (isGalleryExpanded ? allPublicMockups : communityMockups).map((mockup) => (
                    <GlassPanel
                      key={mockup._id}
                      className="group relative aspect-square rounded-md overflow-hidden hover:border-brand-cyan/50 transition-all hover:shadow-2xl hover:shadow-brand-cyan/5 cursor-pointer"
                    >
                      <Link to="/mockups" className="block w-full h-full">
                        {mockup.imageUrl || mockup.imageBase64 ? (
                          <img
                            src={mockup.imageUrl || mockup.imageBase64}
                            alt={mockup.prompt || 'Community Mockup'}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-neutral-800">
                            <ImageIcon size={48} />
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-300 transition-all duration-300 p-4 flex flex-col justify-end">
                          <MicroTitle as="p" className="text-brand-cyan mb-1">Prompt</MicroTitle>
                          <p className="text-xs text-white font-mono line-clamp-2 mb-2">
                            {mockup.prompt}
                          </p>
                          <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                            <Plus size={10} className="text-brand-cyan" />
                            <span className="text-[9px] text-neutral-400 font-mono uppercase">Usar como referência</span>
                          </div>
                        </div>
                      </Link>
                    </GlassPanel>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center bg-[#141414] rounded-md border border-neutral-800/50 border-dashed">
                    <div className="flex flex-col items-center gap-4">
                      <ImageIcon size={48} className="text-neutral-800" />
                      <p className="text-neutral-500 font-mono text-sm">
                        Nenhum mockup encontrado na galeria pública
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {allPublicMockups.length > 10 && (
                <div className="flex justify-center mt-8">
                  <Button variant="ghost" onClick={() => setIsGalleryExpanded(!isGalleryExpanded)}
                    className="flex items-center gap-2 px-6 py-2 bg-neutral-900/50 hover:bg-brand-cyan/10 text-neutral-500 hover:text-brand-cyan border border-neutral-800/50 rounded-full transition-all text-sm font-mono group"
                  >
                    {isGalleryExpanded ? (
                      <>
                        Ver menos <ChevronUp size={16} className="group-hover:-translate-y-0.5 transition-transform" />
                      </>
                    ) : (
                      <>
                        Ver mais <ChevronDown size={16} className="group-hover:translate-y-0.5 transition-transform" />
                      </>
                    )}
                  </Button>
                </div>
              )}
            </section>

            {/* GitHub Ecosystem CTA */}
            <section className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-brand-cyan/5 to-transparent rounded-md" />
              <GlassPanel padding="none" className="relative z-10 overflow-hidden">
                <div className="p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="max-w-xl space-y-4 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-3 text-brand-cyan">
                      <Github size={24} />
                      <MicroTitle as="span" className="font-semibold">Open Source</MicroTitle>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white font-manrope leading-tight">
                      Vamos crescer junto
                    </h2>
                    <p className="text-neutral-400 font-mono text-sm md:text-base leading-relaxed">
                      Visant Labs é movido pela paixão e colaboração. Acesse nosso repositório no GitHub para contribuir, relatar bugs ou dar uma estrela.
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-4">
                    <a
                      href={getGithubUrl()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-md transition-all hover:scale-105 active:scale-95 shadow-xl hover:shadow-white/10"
                    >
                      <Github size={22} className="group-hover:rotate-12 transition-transform" />
                      <span className="font-mono uppercase tracking-widest">Ver Repositório</span>
                      <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </a>
                    <MicroTitle as="p">
                      v1.0.0-alpha • MIT License
                    </MicroTitle>
                  </div>
                </div>
              </GlassPanel>
            </section>
          </div>
        )}

        {/* Create Preset Modal */}
        <CommunityPresetModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleSavePreset}
          isCreating={true}
        />

        <WorkflowLibraryModal
          isOpen={showWorkflowLibrary}
          onClose={() => setShowWorkflowLibrary(false)}
          onLoadWorkflow={handleLoadWorkflow}
          isAuthenticated={isAuthenticated}
          isAdmin={isAdmin}
          t={t}
        />
      </div>
    </div>
  );
};

export default CommunityPage;


