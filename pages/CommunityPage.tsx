import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Globe, Sparkles, TrendingUp, Plus, Image as ImageIcon, Camera, Layers, MapPin, Sun, ArrowRight, ChevronDown, ChevronUp, Box, Settings, Palette, FolderOpen } from 'lucide-react';
import { GridDotsBackground } from '../components/ui/GridDotsBackground';
import { BreadcrumbWithBack, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from '../components/ui/BreadcrumbWithBack';
import { useLayout } from '../hooks/useLayout';
import { useTranslation } from '../hooks/useTranslation';
import { getAllCommunityPresets, getCommunityStats, clearCommunityPresetsCache } from '../services/communityPresetsService';
import { mockupApi } from '../services/mockupApi';
import { cn } from '../lib/utils';
import { Github } from 'lucide-react';
import { getGithubUrl } from '../config/branding';
import ClubHero3D from '../components/3d/club-hero3d';
import { CommunityPresetModal } from '../components/CommunityPresetModal';
import { WorkflowLibraryModal } from '../components/WorkflowLibraryModal';
import { canvasApi } from '../services/canvasApi';
import { authService } from '../services/authService';
import { toast } from 'sonner';
import { workflowApi } from '../services/workflowApi';
import type { CanvasWorkflow } from '../services/workflowApi';
import { WORKFLOW_CATEGORY_CONFIG } from '../types/workflow';
import { Workflow } from 'lucide-react';

type PresetType = 'mockup' | 'angle' | 'texture' | 'ambience' | 'luminance' | '3d' | 'presets' | 'aesthetics' | 'themes';

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
    { type: 'themes', icon: Sparkles, label: t('communityPresets.categories.themes'), count: stats.themes, presets: categoryPresets.themes },
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
    <div className="min-h-screen bg-[#0A0A0A] text-zinc-300 pt-12 md:pt-14 relative overflow-x-hidden">
      <div className="fixed inset-0 z-0">
        <GridDotsBackground />
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
        <ClubHero3D
          className="mb-16 rounded-3xl border border-zinc-800/50 min-h-[400px] h-auto"
          color="#52ddeb"
          starColor="#52ddeb"
        >
          <div className="relative z-10 p-6 md:p-8 h-full flex flex-col justify-between">
            <div className="relative z-10 max-w-2xl pointer-events-auto">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-3 py-1 bg-brand-cyan/10 text-brand-cyan text-xs font-mono rounded-full border border-[#52ddeb]/20">
                  COMUNIDADE ATIVA
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-bold font-manrope text-white mb-4 leading-tight">
                {t('communityPresets.title')}
              </h1>
              <p className="text-zinc-400 text-base md:text-lg font-mono mb-6 max-w-xl leading-relaxed">
                {t('communityPresets.subtitle')}
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-cyan hover:bg-brand-cyan/90 text-black font-semibold rounded-xl transition-all hover:scale-105 active:scale-95 shadow-lg shadow-[#52ddeb]/20"
                >
                  <Plus size={18} />
                  <span className="font-mono uppercase tracking-wider text-sm">Criar um novo prompt</span>
                </button>
                <button
                  onClick={() => navigate('/community/presets')}
                  className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800/50 hover:bg-zinc-800 text-white font-semibold rounded-xl border border-zinc-700/50 transition-all hover:scale-105 active:scale-95 backdrop-blur-sm"
                >
                  <Globe size={18} />
                  <span className="font-mono uppercase tracking-wider text-sm">Ver Tudo</span>
                </button>
                <button
                  onClick={() => setShowWorkflowLibrary(true)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800/50 hover:bg-zinc-800 text-white font-semibold rounded-xl border border-zinc-700/50 transition-all hover:scale-105 active:scale-95 backdrop-blur-sm"
                >
                  <FolderOpen size={18} />
                  <span className="font-mono uppercase tracking-wider text-sm">{t('workflows.library.title') || 'Biblioteca'}</span>
                </button>
              </div>
            </div>

            {/* Global Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8 relative z-10 pointer-events-auto">
              <div className="bg-black/40 backdrop-blur-sm border border-zinc-800/50 rounded-xl p-4 transition-all hover:border-[#52ddeb]/30 group hover:bg-black/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Usuários</span>
                  <TrendingUp size={14} className="text-brand-cyan" />
                </div>
                <p className="text-3xl font-bold text-white font-mono group-hover:scale-110 transition-transform origin-left">
                  {isLoading ? '...' : globalCommunityStats.totalUsers}
                </p>
              </div>
              <div className="bg-black/40 backdrop-blur-sm border border-zinc-800/50 rounded-xl p-4 transition-all hover:border-[#52ddeb]/30 group hover:bg-black/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Presets Criados</span>
                  <Sparkles size={14} className="text-brand-cyan" />
                </div>
                <p className="text-3xl font-bold text-white font-mono group-hover:scale-110 transition-transform origin-left">
                  {isLoading ? '...' : globalCommunityStats.totalPresets}
                </p>
              </div>
              <div className="bg-black/40 backdrop-blur-sm border border-zinc-800/50 rounded-xl p-4 transition-all hover:border-[#52ddeb]/30 group hover:bg-black/60">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-500 font-mono text-xs uppercase tracking-widest">Public Mockups</span>
                  <ImageIcon size={14} className="text-brand-cyan" />
                </div>
                <p className="text-3xl font-bold text-white font-mono group-hover:scale-110 transition-transform origin-left">
                  {isLoading ? '...' : globalCommunityStats.totalBlankMockups}
                </p>
              </div>
            </div>
          </div>
        </ClubHero3D>

        {isCheckingAuth && (
          <div className="flex items-center justify-center py-20">
            <p className="text-zinc-400 font-mono animate-pulse">{t('common.loading')}</p>
          </div>
        )}

        {!isCheckingAuth && (
          <div className="space-y-24">
            {/* Exploration Categories */}
            <section className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white font-manrope">Explorar por Categoria</h2>
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
                  <button
                    key={category.type}
                    onClick={() => navigate(`/community/presets?type=${category.type}`)}
                    className="group relative bg-[#141414] border border-zinc-800/50 rounded-2xl p-6 flex flex-col h-full hover:border-[#52ddeb]/40 transition-all hover:-translate-y-1 active:translate-y-0"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-10 transition-opacity">
                      <category.icon size={64} className="text-brand-cyan" />
                    </div>

                    <div className="flex items-center justify-between mb-6">
                      <div className="p-3 bg-zinc-900 rounded-xl group-hover:bg-brand-cyan/10 transition-colors">
                        <category.icon size={24} className="text-zinc-400 group-hover:text-brand-cyan transition-colors" />
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-2xl font-bold font-mono text-white whitespace-nowrap">{category.count}</span>
                        <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">Presets</span>
                      </div>
                    </div>

                    <div className="mb-6 flex-1">
                      <h3 className="text-lg font-semibold text-white font-manrope mb-1 capitalize group-hover:text-brand-cyan transition-colors">
                        {category.label}
                      </h3>
                      <p className="text-xs text-zinc-500 font-mono line-clamp-2 leading-relaxed">
                        Explorar {category.label.toLowerCase()} criados pela nossa comunidade.
                      </p>
                    </div>

                    <div className="space-y-2 pt-4 border-t border-zinc-800/50 max-h-48 overflow-y-auto">
                      {category.presets.length > 0 ? (
                        category.presets.map((preset: any, index: number) => (
                          <div
                            key={`${category.type}-${preset.id || preset._id || index}`}
                            className="flex items-center gap-3 py-1 group/item"
                          >
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-700 group-hover/item:bg-brand-cyan transition-colors" />
                            <p className="text-xs font-mono text-zinc-500 group-hover/item:text-zinc-300 truncate transition-colors">
                              {preset.name}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="text-[10px] text-zinc-700 font-mono italic">Ainda sem presets</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* Workflows Section */}
            <section className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white font-manrope">Workflows da Comunidade</h2>
                  <p className="text-zinc-500 font-mono text-sm max-w-lg mt-2">
                    Workflows completos criados pela comunidade. Salve, compartilhe e reutilize estruturas de canvas inteiras.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/canvas')}
                  className="inline-flex items-center gap-2 text-brand-cyan hover:text-brand-cyan/80 font-mono text-sm transition-all hover:translate-x-1"
                >
                  Abrir Canvas
                  <ArrowRight size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {workflowsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="bg-[#141414] border border-zinc-800/50 rounded-2xl p-6 animate-pulse">
                      <div className="aspect-video bg-zinc-900 rounded-lg mb-4" />
                      <div className="h-4 bg-zinc-900 rounded mb-2" />
                      <div className="h-3 bg-zinc-900 rounded w-2/3" />
                    </div>
                  ))
                ) : workflows.length > 0 ? (
                  workflows.slice(0, 8).map((workflow) => {
                    const categoryConfig = WORKFLOW_CATEGORY_CONFIG[workflow.category as keyof typeof WORKFLOW_CATEGORY_CONFIG] || WORKFLOW_CATEGORY_CONFIG.general;
                    const CategoryIcon = categoryConfig.icon;

                    return (
                      <button
                        key={workflow._id}
                        onClick={() => navigate('/canvas')}
                        className="group relative bg-[#141414] border border-zinc-800/50 rounded-2xl p-6 flex flex-col h-full hover:border-[#52ddeb]/40 transition-all hover:-translate-y-1 active:translate-y-0 text-left"
                      >
                        {workflow.thumbnailUrl ? (
                          <div className="aspect-video rounded-lg overflow-hidden border border-zinc-700/30 bg-zinc-900/30 mb-4">
                            <img
                              src={workflow.thumbnailUrl}
                              alt={workflow.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                        ) : (
                          <div className="aspect-video rounded-lg border border-zinc-700/30 bg-zinc-900/30 flex items-center justify-center mb-4">
                            <CategoryIcon size={32} className="text-zinc-700" />
                          </div>
                        )}

                        <div className="flex-1">
                          <h3 className="text-base font-semibold text-white font-mono mb-1 line-clamp-1 group-hover:text-brand-cyan transition-colors">
                            {workflow.name}
                          </h3>
                          <p className="text-xs text-zinc-500 font-mono line-clamp-2 mb-3">
                            {workflow.description}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-3 border-t border-zinc-800/50">
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
                          <span className="px-2 py-0.5 bg-zinc-800/40 rounded border border-zinc-700/30 text-zinc-500 font-mono text-[10px] flex-shrink-0">
                            {Array.isArray(workflow.nodes) ? workflow.nodes.length : 0} nodes
                          </span>
                          {workflow.likesCount > 0 && (
                            <span className="px-2 py-0.5 bg-zinc-800/40 rounded border border-zinc-700/30 text-zinc-500 font-mono text-[10px] flex-shrink-0">
                              ❤️ {workflow.likesCount}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-full py-20 text-center bg-[#141414] rounded-3xl border border-zinc-800/50 border-dashed">
                    <div className="flex flex-col items-center gap-4">
                      <Workflow size={48} className="text-zinc-800" />
                      <p className="text-zinc-500 font-mono text-sm">
                        Nenhum workflow público disponível ainda
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {workflows.length > 8 && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => navigate('/canvas')}
                    className="flex items-center gap-2 px-6 py-2 bg-zinc-900/50 hover:bg-brand-cyan/10 text-zinc-500 hover:text-brand-cyan border border-zinc-800/50 rounded-full transition-all text-sm font-mono group"
                  >
                    Ver todos os workflows
                    <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                  </button>
                </div>
              )}
            </section>

            {/* Gallery Section */}
            <section className="space-y-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                  <h2 className="text-3xl font-bold text-white font-manrope">Galeria da Comunidade</h2>
                  <p className="text-zinc-500 font-mono text-sm max-w-lg">
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
                    <div key={i} className="aspect-square bg-zinc-900 rounded-2xl animate-pulse border border-zinc-800/50" />
                  ))
                ) : (isGalleryExpanded ? allPublicMockups : communityMockups).length > 0 ? (
                  (isGalleryExpanded ? allPublicMockups : communityMockups).map((mockup) => (
                    <Link
                      key={mockup._id}
                      to="/mockups"
                      className="group relative aspect-square bg-[#141414] rounded-2xl overflow-hidden border border-zinc-800/50 hover:border-[#52ddeb]/50 transition-all hover:shadow-2xl hover:shadow-[#52ddeb]/5"
                    >
                      {mockup.imageUrl || mockup.imageBase64 ? (
                        <img
                          src={mockup.imageUrl || mockup.imageBase64}
                          alt={mockup.prompt || 'Community Mockup'}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-800">
                          <ImageIcon size={48} />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 p-4 flex flex-col justify-end">
                        <p className="text-[10px] text-brand-cyan font-mono uppercase tracking-widest mb-1">Prompt</p>
                        <p className="text-xs text-white font-mono line-clamp-2 mb-2">
                          {mockup.prompt}
                        </p>
                        <div className="flex items-center gap-2 pt-2 border-t border-white/10">
                          <Plus size={10} className="text-brand-cyan" />
                          <span className="text-[9px] text-zinc-400 font-mono uppercase">Usar como referência</span>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center bg-[#141414] rounded-3xl border border-zinc-800/50 border-dashed">
                    <div className="flex flex-col items-center gap-4">
                      <ImageIcon size={48} className="text-zinc-800" />
                      <p className="text-zinc-500 font-mono text-sm">
                        Nenhum mockup encontrado na galeria pública
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {allPublicMockups.length > 10 && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setIsGalleryExpanded(!isGalleryExpanded)}
                    className="flex items-center gap-2 px-6 py-2 bg-zinc-900/50 hover:bg-brand-cyan/10 text-zinc-500 hover:text-brand-cyan border border-zinc-800/50 rounded-full transition-all text-sm font-mono group"
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
                  </button>
                </div>
              )}
            </section>

            {/* GitHub Ecosystem CTA */}
            <section className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#52ddeb]/5 to-transparent rounded-3xl" />
              <div className="relative z-10 p-8 md:p-12 rounded-3xl border border-zinc-800/50 bg-[#141414] overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="max-w-xl space-y-4 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-3 text-brand-cyan">
                    <Github size={24} />
                    <span className="font-mono text-sm font-semibold tracking-widest uppercase">Open Source</span>
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-white font-manrope leading-tight">
                    Vamos crescer junto
                  </h2>
                  <p className="text-zinc-400 font-mono text-sm md:text-base leading-relaxed">
                    Visant Labs é movido pela paixão e colaboração. Acesse nosso repositório no GitHub para contribuir, relatar bugs ou dar uma estrela.
                  </p>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <a
                    href={getGithubUrl()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 px-8 py-4 bg-white text-black font-bold rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-xl hover:shadow-white/10"
                  >
                    <Github size={22} className="group-hover:rotate-12 transition-transform" />
                    <span className="font-mono uppercase tracking-widest">Ver Repositório</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </a>
                  <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest animate-pulse">
                    v1.0.0-alpha • MIT License
                  </p>
                </div>
              </div>
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


